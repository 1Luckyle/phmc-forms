jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

import { checkList, addDaysIso, prescriptionText, prescriptionParts, clinicalWarnings } from './engine';
import { defaultStartDate, prescribeEntry, applyMeds } from './apply';
import generatePrescription, { hasPrescription, prescriptionTitle, prescriptionOfReport, prescriptionRows } from '../phmc-bbcode-generators/generatePrescription';

const adult = { ageYears: 35, sex: 'Male', weightKg: 75, heightCm: 178, allergies: '', chronic: '', currentMeds: '' };
const iv = { medId: 'paracetamol', regimenId: 'iv', dose: 1000, count: 4, note: '' };
const po = { medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, note: '', prescribed: true, days: 5 };
const listMessages = (entries, date = '2026-11-11') => checkList(entries, { patient: adult, date }).list.map((m) => m.text);

describe('dates de début et cumul sur 24 h', () => {
    test('addDaysIso', () => {
        expect(addDaysIso('2026-11-11', 1)).toBe('2026-11-12');
        expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
        expect(addDaysIso('n’importe quoi', 1)).toBe('');
    });

    test("deux lignes du même jour dépassent le maximum, avec la piste de la date de début pour une ordonnance", () => {
        const messages = listMessages([iv, po]);
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatch(/Paracétamol : 7 000 mg cumulés sur 24 h, au-dessus du maximum de 4 000 mg\./);
        expect(messages[0]).toMatch(/indiquez sa date de début/);
        // Deux médicaments administrés : pas de piste de date.
        expect(listMessages([iv, { ...iv }])[0]).not.toMatch(/date de début/);
    });

    test("un traitement qui commence le lendemain ne s'additionne pas à ce qui est administré aujourd'hui", () => {
        expect(listMessages([iv, { ...po, startDate: '2026-11-12' }])).toEqual([]);
        // Le jour du rapport, le chevauchement reste signalé.
        expect(listMessages([iv, { ...po, startDate: '2026-11-11' }])).toHaveLength(1);
        // Début tardif sans lien avec la date du rapport : c'est la date du rapport qui compte.
        expect(listMessages([iv, { ...po, startDate: '2026-11-20' }])).toEqual([]);
    });

    test("deux ordonnances qui se chevauchent dans le temps dépassent ; qui se suivent, non", () => {
        const a = { ...po, count: 4, startDate: '2026-11-12', days: 3 };
        expect(listMessages([a, { ...po, count: 4, startDate: '2026-11-14', days: 3 }])).toHaveLength(1); // 14 et 15 novembre : 8 prises
        expect(listMessages([a, { ...po, count: 4, startDate: '2026-11-15', days: 3 }])).toEqual([]);
    });

    test("sans date (anciens rapports), le comportement d'avant est conservé", () => {
        expect(listMessages([iv, { ...po, startDate: undefined }])).toHaveLength(1);
        expect(checkList([iv, { ...po, startDate: undefined }], { patient: adult }).list).toHaveLength(1);
    });

    test('les avertissements du formulaire utilisent la date du rapport', () => {
        const base = { patientAgeYears: '35', patientSex: 'Male', patientWeight: '75', date: '2026-11-11' };
        expect(clinicalWarnings({ ...base, clinicalMeds: [iv, po] }).join(' ')).toMatch(/cumulés/);
        expect(clinicalWarnings({ ...base, clinicalMeds: [iv, { ...po, startDate: '2026-11-12' }] }).join(' ')).not.toMatch(/cumulés/);
    });
});

describe('début par défaut et ligne d\'ordonnance', () => {
    test('le lendemain quand le même médicament vient d\'être administré, sinon le jour du rapport', () => {
        expect(defaultStartDate(po, [iv, po], '2026-11-11')).toBe('2026-11-12');
        expect(defaultStartDate(po, [po], '2026-11-11')).toBe('2026-11-11');
        expect(defaultStartDate({ ...po, medId: 'ketoprofene' }, [iv, po], '2026-11-11')).toBe('2026-11-11');
        expect(prescribeEntry({ ...iv }, [iv, po], '2026-11-11')).toMatchObject({ prescribed: true, startDate: '2026-11-12' });
        expect(prescribeEntry({ ...iv, startDate: '2026-11-15' }, [iv], '2026-11-11').startDate).toBe('2026-11-15');
    });

    test("les suites d'opération proposées prennent la date du rapport (ou le lendemain d'un médicament administré)", () => {
        const next = applyMeds({ date: '2026-11-11', clinicalMeds: [iv] }, [{ medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, note: '' }, { medId: 'ketoprofene', regimenId: 'po', dose: 100, count: 2, note: '' }], false, { prescribed: true });
        expect(next.clinicalMeds.slice(1).map((e) => [e.medId, e.startDate])).toEqual([['paracetamol', '2026-11-12'], ['ketoprofene', '2026-11-11']]);
    });

    test('texte et morceaux avec début, durée et fin', () => {
        expect(prescriptionText({ ...po, startDate: '2026-11-12' })).toMatch(/, à partir du 12\/11\/2026, pendant 5 jours$/);
        expect(prescriptionText({ ...po, startDate: undefined })).not.toMatch(/à partir/);
        expect(prescriptionParts({ ...po, startDate: '2026-11-12', note: 'au repas' })).toMatchObject({ name: 'Paracétamol', start: '2026-11-12', days: 5, end: '2026-11-16', note: 'au repas' });
        expect(prescriptionParts({ medId: 'inconnu' })).toBeNull();
    });
});

describe("ordonnance : document à part", () => {
    const form = { patientName: 'Jean Test', patientID: 'PHMC-1', date: '2026-11-11', phmcEmployee: 'Dr. Interne', phmcRank: 'Interne en Médecine', clinicalMeds: [iv, { ...po, startDate: '2026-11-12' }] };

    test('seuls les médicaments cochés sont sur l\'ordonnance', () => {
        expect(prescriptionRows(form)).toHaveLength(1);
        expect(hasPrescription(form)).toBe(true);
        expect(hasPrescription({ clinicalMeds: [iv] })).toBe(false);
        expect(generatePrescription({ clinicalMeds: [iv] })).toBe('');
        expect(prescriptionTitle(form)).toBe('[PHMC-1] Ordonnance - 11/11/2026');
    });

    test("en-tête des rapports de soins, tableau (médicament, posologie, début, durée) et pied de page", () => {
        const bb = generatePrescription(form, 19);
        expect(bb).toContain('[b][size=150]ORDONNANCE[/size][/b]');
        expect(bb).toContain('/img/phmc.png');
        expect(bb).toContain('PATIENT: Jean Test');
        expect(bb).toContain('Prescripteur: Dr. Interne — Interne en Médecine');
        expect(bb).toContain('[b]Médicament[/b]');
        expect(bb).toContain('[b]Paracétamol[/b]');
        expect(bb).toContain('1 000 mg — PO, 3 prises/24 h (toutes les 6 h)');
        expect(bb).toContain('12/11/2026');
        expect(bb).toContain("5 jours (jusqu'au 16/11/2026)");
        expect(bb).toContain("Ordonnance remise à la suite de : Protocole d'urgence du 11/11/2026.");
        expect(bb).toContain('Téléphone: 50056'); // pied de page du centre
        expect(bb).not.toContain('Perfusion');
    });

    test("ordonnance d'un rapport enregistré : titre et BBCode, rien sans ordonnance", () => {
        const found = prescriptionOfReport({ bbCodeVersion: 5, data: form });
        expect(found.title).toBe('[PHMC-1] Ordonnance - 11/11/2026');
        expect(found.bbCode).toContain('Opération chirurgicale');
        expect(prescriptionOfReport({ bbCodeVersion: 19, data: { ...form, clinicalMeds: [iv] } })).toBeNull();
        expect(prescriptionOfReport({ bbCodeVersion: 19 })).toBeNull();
        expect(prescriptionOfReport(null)).toBeNull();
    });
});
