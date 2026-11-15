import {
    prescriptionItemsOf, activePrescriptions, prescriptionStatus, prescriptionStatusLabel, prescriptionBadgeText, activePrescriptionText, habitualMedicineText,
} from './activePrescriptions';
import { patientFromForm, checkPrescription } from '../clinical/engine';
import { prescriptionOfReport } from '../phmc-bbcode-generators/generatePrescription';
import { buildPatientContextBBCode } from '../phmc-bbcode-generators/shared/patientContext';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));

const rx = (over = {}) => ({ medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, prescribed: true, days: 5, startDate: '2026-11-11', note: '', ...over });

describe('lignes d’ordonnance rangées dans l’index', () => {
    test('seuls les médicaments « sur l’ordonnance » sont gardés, avec leur début et leur fin', () => {
        const items = prescriptionItemsOf({ clinicalMeds: [rx(), rx({ medId: 'ibuprofene', prescribed: false })] });
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ medId: 'paracetamol', name: 'Paracétamol', start: '2026-11-11', end: '2026-11-15' });
    });
    test('patient décédé : aucune ordonnance', () => {
        expect(prescriptionItemsOf({ careDeceased: 'Yes', clinicalMeds: [rx()] })).toEqual([]);
    });
    test('l’ordonnance d’un rapport porte sa date de fin (« fin »), vide sans durée', () => {
        const data = { patientID: 'PHMC-1', date: '2026-11-11', clinicalMeds: [rx(), rx({ medId: 'ibuprofene', days: 10 })] };
        expect(prescriptionOfReport({ data, bbCodeVersion: 19 }).fin).toBe('2026-11-20');
        expect(prescriptionOfReport({ data: { ...data, clinicalMeds: [rx({ days: 0 })] }, bbCodeVersion: 19 }).fin).toBe('');
    });
});

describe('ordonnances en cours', () => {
    const entries = {
        a: { title: '[PHMC-1] Consultation Générale - 11/11/2026', ordonnances: [{ medId: 'paracetamol', name: 'Paracétamol', posology: '1 g', start: '2026-11-11', end: '2026-11-15' }, { medId: 'ibuprofene', name: 'Ibuprofène', posology: '400 mg', start: '2026-11-11', end: '2026-11-13' }] },
        b: { title: '[PHMC-1] Protocole d\'Urgence - 12/11/2026', ordonnances: [{ medId: 'paracetamol', name: 'Paracétamol', posology: '500 mg', start: '2026-11-12', end: '2026-11-20' }] },
        c: { title: 'copie', copiedFrom: 'x', ordonnances: [{ medId: 'amoxicilline', name: 'Amoxicilline', start: '2026-11-11', end: '2026-11-30' }] },
        d: { title: 'sans durée', ordonnances: [{ medId: 'amoxicilline', name: 'Amoxicilline', start: '2026-11-11', end: '' }] },
        e: { title: 'sans ordonnance' },
    };
    test('on ne garde que ce qui est en cours à la date du rapport, une seule ligne par médicament (la fin la plus tardive)', () => {
        const list = activePrescriptions(entries, { asOf: '2026-11-14' });
        expect(list.map((item) => item.medId)).toEqual(['paracetamol']);
        expect(list[0]).toMatchObject({ end: '2026-11-20', posology: '500 mg' });
    });
    test('une ordonnance terminée n’est plus comptée, le jour de sa fin elle l’est encore', () => {
        expect(activePrescriptions(entries, { asOf: '2026-11-13' }).map((item) => item.medId)).toEqual(['ibuprofene', 'paracetamol']);
        expect(activePrescriptions(entries, { asOf: '2026-11-14' }).map((item) => item.medId)).not.toContain('ibuprofene');
        expect(activePrescriptions(entries, { asOf: '2026-12-01' })).toEqual([]);
    });
    test('une ordonnance qui commence plus tard (autre date de rapport) n’est pas comptée', () => {
        expect(activePrescriptions(entries, { asOf: '2026-11-05' })).toEqual([]);
    });
    test('copies, ordonnances sans fin, rapport en cours de modification et médicaments retirés sont ignorés', () => {
        expect(activePrescriptions(entries, { asOf: '2026-11-13' }).map((item) => item.medId)).not.toContain('amoxicilline');
        expect(activePrescriptions(entries, { asOf: '2026-11-13', excludeTitle: entries.a.title }).map((item) => item.medId)).toEqual(['paracetamol']);
        expect(activePrescriptions(entries, { asOf: '2026-11-13', off: ['paracetamol'] }).map((item) => item.medId)).toEqual(['ibuprofene']);
    });
    test('l’index renvoyé par Firebase peut donner un objet au lieu d’un tableau', () => {
        const fromFirebase = { a: { title: 't', ordonnances: { 0: { medId: 'paracetamol', name: 'Paracétamol', start: '2026-11-11', end: '2026-11-15' } } } };
        expect(activePrescriptions(fromFirebase, { asOf: '2026-11-12' })).toHaveLength(1);
    });
});

describe('état d’une ordonnance', () => {
    test('en cours, terminée ou sans durée', () => {
        expect(prescriptionStatus('2026-11-20', '2026-11-15')).toBe('active');
        expect(prescriptionStatus('2026-11-15', '2026-11-15')).toBe('active');
        expect(prescriptionStatus('2026-11-14', '2026-11-15')).toBe('ended');
        expect(prescriptionStatus('', '2026-11-15')).toBe('undated');
        expect(prescriptionStatusLabel('2026-11-20', '2026-11-15')).toBe('en cours jusqu\'au 20/11/2026');
        expect(prescriptionStatusLabel('2026-11-14', '2026-11-15')).toBe('terminée le 14/11/2026');
        expect(prescriptionBadgeText({ fin: '' }, '2026-11-15')).toBe('Ordonnance · durée non précisée');
    });
});

describe('traitements habituels + ordonnances en cours', () => {
    const active = [{ medId: 'ibuprofene', name: 'Ibuprofène', end: '2026-11-20' }];
    test('le texte du rapport ajoute chaque ordonnance en cours avec sa date de fin, sans toucher au champ du dossier', () => {
        expect(activePrescriptionText(active[0])).toBe('Ibuprofène (ordonnance en cours jusqu\'au 20/11/2026)');
        expect(habitualMedicineText({ patientCurrentMedicine: 'Ramipril 5 mg', patientActivePrescriptions: active })).toBe('Ramipril 5 mg ; Ibuprofène (ordonnance en cours jusqu\'au 20/11/2026)');
        expect(habitualMedicineText({ patientActivePrescriptions: active })).toBe('Ibuprofène (ordonnance en cours jusqu\'au 20/11/2026)');
        expect(habitualMedicineText({ patientCurrentMedicine: 'Ramipril 5 mg' })).toBe('Ramipril 5 mg');
        const formData = { patientCurrentMedicine: 'Ramipril 5 mg', patientActivePrescriptions: active };
        expect(buildPatientContextBBCode(formData)).toContain('Ibuprofène (ordonnance en cours jusqu\'au 20/11/2026)');
        expect(formData.patientCurrentMedicine).toBe('Ramipril 5 mg');
    });
});

describe('assistant Pilou : ordonnances en cours', () => {
    const entry = { medId: 'ibuprofene', regimenId: 'po', dose: 400, count: 3 };
    test('elles comptent avec les traitements du patient', () => {
        const patient = patientFromForm({ patientAgeYears: '40', patientCurrentMedicine: 'Ramipril', patientActivePrescriptions: [{ medId: 'paracetamol', name: 'Paracétamol', end: '2026-11-20' }] });
        expect(patient.currentMeds).toBe('Ramipril ; Paracétamol');
        expect(patient.activeRx).toHaveLength(1);
        expect(patientFromForm({ patientCurrentMedicine: 'Ramipril' }).currentMeds).toBe('Ramipril');
    });
    test('même médicament déjà prescrit : alerte avec la date de fin', () => {
        const patient = patientFromForm({ patientAgeYears: '40', patientWeight: '75', patientActivePrescriptions: [{ medId: 'ibuprofene', name: 'Ibuprofène', end: '2026-11-20' }] });
        const messages = checkPrescription(entry, { patient }).messages.map((m) => m.text);
        expect(messages.some((text) => /déjà prescrit : ordonnance en cours jusqu'au 20\/11\/2026/.test(text))).toBe(true);
    });
    test('même famille qu’une ordonnance en cours : alerte de cumul', () => {
        const patient = patientFromForm({ patientAgeYears: '40', patientWeight: '75', patientActivePrescriptions: [{ medId: 'ketoprofene', name: 'Kétoprofène', end: '2026-11-20' }] });
        const sameFamily = checkPrescription(entry, { patient }).messages.map((m) => m.text);
        const other = patientFromForm({ patientAgeYears: '40', patientWeight: '75', patientActivePrescriptions: [{ medId: 'paracetamol', name: 'Paracétamol', end: '2026-11-20' }] });
        expect(checkPrescription(entry, { patient: other }).messages.some((m) => /ordonnance en cours/.test(m.text))).toBe(false);
        expect(sameFamily.some((text) => text.includes('Même famille que Kétoprofène') && text.includes('jusqu\'au 20/11/2026'))).toBe(true);
    });
});
