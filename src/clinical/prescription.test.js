import { prescriptionText } from './engine';
import { clinicalMedLines, prescriptionLines, prescriptionPlainText, applyMeds } from './apply';
import { clinicalMedsBBCode, postOpBBCode } from '../phmc-bbcode-generators/shared/careExtras';
import generateEmergencyProtocol from '../phmc-bbcode-generators/generateEmergencyProtocol';
import { reportCopyRecipients, copyNotificationContent, hasCopyRecipients } from '../utils/reportCopyRecipients';
import { ASSISTANT_NAME } from './assistantName';

const given = { medId: 'paracetamol', regimenId: 'iv', dose: 1000, count: 1, note: '' };
const rx = { medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, note: '', prescribed: true, days: 5 };
const form = { patientName: 'Jean Test', patientID: 'PHMC-1', date: '2026-11-11', phmcEmployee: 'Dr. Interne', clinicalMeds: [given, rx] };

describe('ordonnance', () => {
    test("un médicament sur l'ordonnance sort de la liste « administrés » et porte sa durée", () => {
        expect(clinicalMedLines(form)).toHaveLength(1);
        expect(prescriptionLines(form)).toHaveLength(1);
        expect(prescriptionLines(form)[0]).toMatch(/Paracétamol 1 000 mg — PO, 3 prises\/24 h.*, pendant 5 jours$/);
        expect(prescriptionText({ ...rx, days: 1 })).toMatch(/pendant 1 jour$/);
        expect(prescriptionText({ ...rx, days: '' })).not.toMatch(/pendant/);
        expect(prescriptionText({})).toBe('');
    });

    test('texte brut à copier : patient, date, lignes et prescripteur ; vide sans ordonnance', () => {
        const text = prescriptionPlainText(form);
        expect(text).toMatch(/^ORDONNANCE\nPatient : Jean Test \(PHMC-1\)\nDate : 2026-11-11\n\n• Paracétamol/);
        expect(text).toMatch(/Prescripteur : Dr\. Interne$/);
        expect(prescriptionPlainText({ clinicalMeds: [given] })).toBe('');
    });

    test('BBCode : administrés et ordonnance séparés, prescripteur cité', () => {
        const bb = clinicalMedsBBCode(form);
        expect(bb).toContain('[u]Médicaments administrés: [/u]');
        expect(bb).toContain('[u]Ordonnance (prescrite par Dr. Interne): [/u]');
        expect(bb.indexOf('administrés')).toBeLessThan(bb.indexOf('Ordonnance'));
        expect(clinicalMedsBBCode({ clinicalMeds: [rx] })).not.toContain('administrés');
        expect(postOpBBCode(form)).toContain('[tr][td]Ordonnance (prescrite par Dr. Interne)[/td]');
        expect(postOpBBCode({ clinicalMeds: [rx] })).toContain('Ordonnance');
    });

    test("les suites d'opération proposées par l'assistant vont directement sur l'ordonnance", () => {
        const next = applyMeds({}, [{ ...given, forCondition: 'x' }], false, { prescribed: true });
        expect(next.clinicalMeds[0]).toMatchObject({ medId: 'paracetamol', prescribed: true });
        expect(next.clinicalMeds[0].forCondition).toBeUndefined();
        expect(applyMeds({}, [given]).clinicalMeds[0].prescribed).toBeUndefined();
    });

    test("l'assistant a un petit nom", () => {
        expect(ASSISTANT_NAME).toBe('Pilou');
    });
});

describe('soignants mentionnés : copie du rapport', () => {
    test('opération : chirurgien et personnel présent, sans le rédacteur ni doublon', () => {
        const data = { phmcEmployee: 'Dr. Interne', surgeonEmployee: 'Dr. Surgeon', extraStaff: ['Dr. Interne', 'Inf. A', 'dr. surgeon', 'Inf. A', ''] };
        expect(reportCopyRecipients(5, data)).toEqual([{ name: 'Dr. Surgeon', kind: 'surgeon' }, { name: 'Inf. A', kind: 'present' }]);
        expect(reportCopyRecipients(5, { phmcEmployee: 'Dr. Surgeon', surgeonEmployee: 'Dr. Surgeon', extraStaff: [] })).toEqual([]);
    });
    test("protocole d'urgence : soignants supplémentaires seulement (pas de chirurgien)", () => {
        expect(reportCopyRecipients(19, { phmcEmployee: 'Dr. Interne', surgeonEmployee: 'Dr. Surgeon', extraStaff: ['Inf. A'] })).toEqual([{ name: 'Inf. A', kind: 'present' }]);
    });
    test('autres formulaires : personne', () => {
        expect(hasCopyRecipients(20)).toBe(false);
        expect(reportCopyRecipients(20, { phmcEmployee: 'X', extraStaff: ['Inf. A'] })).toEqual([]);
    });
    test('contenu de la notification : invitation à copier le rapport', () => {
        const data = { phmcEmployee: 'Dr. Interne', patientName: 'Jean Test', patientID: 'PHMC-1' };
        const present = copyNotificationContent(19, data, { name: 'Inf. A', kind: 'present' });
        expect(present.titre).toBe("Dr. Interne vous a mentionné(e) dans un protocole d'urgence");
        expect(present.texte).toMatch(/Jean Test \(PHMC-1\).*Récupérer une copie/);
        expect(copyNotificationContent(5, data, { name: 'Dr. Surgeon', kind: 'surgeon' }).titre).toBe('Dr. Interne vous adresse un rapport chirurgical');
    });
});

describe("protocole d'urgence : soignants supplémentaires", () => {
    test("cités dans l'en-tête, sans le rédacteur", () => {
        const bb = generateEmergencyProtocol({ ...form, extraStaff: ['Inf. A', 'Dr. Interne', 'Dr. B'] });
        expect(bb.split('[/divbox]')[0]).toContain('Avec: Inf. A, Dr. B');
        expect(generateEmergencyProtocol({ ...form, extraStaff: [] })).not.toContain('Avec:');
    });
    test("l'ordonnance est imprimée dans la thérapie", () => {
        expect(generateEmergencyProtocol(form)).toContain('Ordonnance (prescrite par Dr. Interne)');
    });
});
