jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

import { buildSuggestions } from './engine';
import { CONDITIONS } from './conditions';
import { MEDICATION_BY_ID } from './medications';
import { applyMeds, applySection, applyAll, prescriptionLines } from './apply';
import { clinicalMedLines } from './apply';

const adult = { ageYears: 35, sex: 'Male', weightKg: 75, heightCm: 178, allergies: '', chronic: '', currentMeds: '' };
const suggest = (conditionIds, severity = 'Moderate', patient = adult) => buildSuggestions({ conditionIds, severity, patient, seed: 's', formData: {} });
const rx = (s) => s.prescription.map((m) => [m.medId, m.days]);

describe("ordonnance de sortie : composée d'après les motifs, pas recopiée des soins", () => {
    test('chaque médicament de sortie existe, par voie orale', () => {
        CONDITIONS.forEach((condition) => (condition.home || []).forEach(({ options }) => options.forEach(([medId, days]) => {
            expect(MEDICATION_BY_ID[medId]).toBeTruthy();
            expect(MEDICATION_BY_ID[medId].regimens.some((regimen) => regimen.id === 'po')).toBe(true);
            expect(days).toBeGreaterThan(0);
        })));
    });

    test('fracture fermée : antalgique 5 jours (3 prises) + AINS 5 jours — rien des soins sur place (morphine IV…)', () => {
        const s = suggest(['fracture_fermee']);
        expect(s.destination).toBe('Home');
        expect(rx(s)).toEqual([['paracetamol', 5], ['ketoprofene', 5]]);
        expect(s.prescription[0]).toMatchObject({ regimenId: 'po', count: 3 });
        expect(s.prescription.every((m) => m.regimenId === 'po')).toBe(true);
    });

    test('plaie : pas de recopie de la lidocaïne, du vaccin ni de la céfazoline ; antalgique seulement (superficielle) ou + antibiotique oral (profonde)', () => {
        expect(rx(suggest(['plaie_superficielle'], 'Mild'))).toEqual([['paracetamol', 2]]);
        const deep = suggest(['plaie_profonde'], 'Moderate');
        expect(rx(deep)).toEqual([['paracetamol', 3], ['amoxicilline_clav', 7]]);
        ['lidocaine', 'vaccin_tetanique', 'cefazoline'].forEach((id) => expect(deep.prescription.map((m) => m.medId)).not.toContain(id));
    });

    test('un motif sans suite à domicile : aucune ordonnance (le soin sur place suffit)', () => {
        ['hypoglycemie', 'intox_alcool', 'syncope', 'coup_chaleur'].forEach((id) => expect(suggest([id], 'Moderate').prescription).toEqual([]));
    });

    test("asthme : corticoïde oral 5 jours ; allergie légère : antihistaminique, + corticoïde si la réaction est modérée", () => {
        expect(rx(suggest(['asthme'], 'Moderate'))).toEqual([['prednisolone', 5]]);
        expect(rx(suggest(['allergie_legere'], 'Mild'))).toEqual([['cetirizine', 5]]);
        expect(rx(suggest(['allergie_legere'], 'Moderate'))).toEqual([['cetirizine', 5], ['prednisolone', 3]]);
    });

    test('la gravité décide : une plaie par arme blanche légère rentre avec antalgique + antibiotique ; dès « modérée » elle est hospitalisée, sans ordonnance', () => {
        expect(rx(suggest(['plaie_arme_blanche'], 'Mild'))).toEqual([['paracetamol', 3], ['amoxicilline_clav', 5]]);
        expect(suggest(['plaie_arme_blanche'], 'Moderate').destination).toBe('Ward');
        expect(suggest(['plaie_arme_blanche'], 'Moderate').prescription).toEqual([]);
    });

    test('allergie : on passe à l’option suivante ; l’alternative est indiquée dans « non proposés » seulement quand rien ne convient', () => {
        const aines = suggest(['fracture_fermee'], 'Moderate', { ...adult, allergies: 'Allergique aux AINS' });
        expect(aines.prescription.map((m) => m.medId)).toEqual(['paracetamol', 'tramadol']);
        expect(aines.skipped.map((item) => item.medId)).toContain('ketoprofene');
        const penicillin = suggest(['plaie_profonde'], 'Moderate', { ...adult, allergies: 'Pénicilline' });
        expect(penicillin.prescription.map((m) => m.medId)).toEqual(['paracetamol', 'azithromycine']);
        expect(penicillin.prescription[1].days).toBe(3);
        // Enfant : le tramadol est réservé à l'adulte, l'AINS reste.
        const child = suggest(['fracture_fermee'], 'Moderate', { ...adult, ageYears: 8, weightKg: 26, allergies: '' });
        expect(child.prescription.map((m) => m.medId)).not.toContain('tramadol');
    });

    test('jamais deux AINS ni deux antibiotiques ; un même médicament demandé par deux motifs : une fois, pour la durée la plus longue', () => {
        const s = suggest(['fracture_fermee', 'entorse_luxation', 'pneumopathie'], 'Mild');
        const ids = s.prescription.map((m) => m.medId);
        expect(ids.filter((id) => /AINS/.test(MEDICATION_BY_ID[id].category))).toHaveLength(1);
        expect(ids.filter((id) => /Antibiotique/.test(MEDICATION_BY_ID[id].category))).toHaveLength(1);
        expect(ids.filter((id) => id === 'paracetamol')).toHaveLength(1);
        expect(s.prescription.find((m) => m.medId === 'paracetamol').days).toBe(5);
        // Deux motifs qui appellent un antibiotique : un seul est prescrit.
        const twoAntibiotics = suggest(['pneumopathie', 'plaie_arme_blanche'], 'Mild').prescription.map((m) => m.medId);
        expect(twoAntibiotics.filter((id) => /Antibiotique/.test(MEDICATION_BY_ID[id].category))).toHaveLength(1);
    });

    test('un motif hémorragique écarte les AINS : l’ordonnance prend l’antalgique de palier 2 à la place', () => {
        const s = suggest(['fracture_fermee', 'plaie_profonde'], 'Moderate');
        expect(s.prescription.map((m) => m.medId)).toEqual(expect.arrayContaining(['paracetamol', 'tramadol']));
        expect(s.prescription.map((m) => m.medId)).not.toContain('ketoprofene');
        expect(s.skipped.find((item) => item.medId === 'ketoprofene').reasons[0]).toMatch(/hémorragie/);
    });

    test('hospitalisation ou bloc : pas d’ordonnance de sortie', () => {
        expect(suggest(['fracture_fermee'], 'Severe').destination).toBe('OperatingRoom');
        expect(suggest(['fracture_fermee'], 'Severe').prescription).toEqual([]);
        expect(suggest(['pneumopathie'], 'Critical').prescription).toEqual([]);
    });
});

describe('Pilou applique l’ordonnance séparément des soins administrés', () => {
    test('la section « Médicaments » ajoute les soins ET l’ordonnance ; début demain pour un médicament déjà administré', () => {
        const s = suggest(['fracture_fermee']);
        const next = applySection({ date: '2026-11-11' }, 'meds', s, { mode: 'emergency' });
        const given = next.clinicalMeds.filter((m) => !m.prescribed);
        const prescribed = next.clinicalMeds.filter((m) => m.prescribed);
        expect(given.map((m) => m.medId)).toEqual(['paracetamol', 'ketoprofene']);
        expect(prescribed.map((m) => m.medId)).toEqual(['paracetamol', 'ketoprofene']);
        expect(prescribed.every((m) => m.startDate === '2026-11-12' && m.days === 5 && !m.forCondition)).toBe(true);
        expect(prescriptionLines(next)).toHaveLength(2);
        expect(clinicalMedLines(next)).toHaveLength(2);
    });

    test('un médicament administré mais sans suite à domicile reste « administré » seulement', () => {
        const next = applySection({ date: '2026-11-11' }, 'meds', suggest(['plaie_profonde']), { mode: 'emergency' });
        const given = next.clinicalMeds.filter((m) => !m.prescribed).map((m) => m.medId);
        expect(given).toEqual(expect.arrayContaining(['lidocaine', 'vaccin_tetanique']));
        expect(next.clinicalMeds.filter((m) => m.prescribed).map((m) => m.medId)).not.toEqual(expect.arrayContaining(['lidocaine']));
    });

    test('réappliquer ne double rien ; les lignes cochées « sur l’ordonnance » et administrées sont distinguées', () => {
        const s = suggest(['fracture_fermee']);
        const once = applySection({ date: '2026-11-11' }, 'meds', s, { mode: 'emergency' });
        const twice = applySection(once, 'meds', s, { mode: 'emergency' });
        expect(twice.clinicalMeds).toHaveLength(once.clinicalMeds.length);
    });

    test('patient décédé, hospitalisation, bloc : jamais d’ordonnance', () => {
        const s = suggest(['fracture_fermee']);
        expect(applySection({ date: '2026-11-11', careDeceased: 'Yes' }, 'meds', s, { mode: 'emergency' }).clinicalMeds.every((m) => !m.prescribed)).toBe(true);
        expect(applySection({ date: '2026-11-11' }, 'meds', suggest(['fracture_fermee'], 'Severe'), { mode: 'emergency' }).clinicalMeds.every((m) => !m.prescribed)).toBe(true);
    });

    test('« Tout appliquer » : le texte de l’ordonnance est prêt à copier', () => {
        const next = applyAll({ date: '2026-11-11', patientName: 'Jean Test', phmcEmployee: 'Dr. Interne' }, suggest(['asthme']), false, 'emergency');
        expect(prescriptionLines(next)[0]).toMatch(/^Prednisolone .*pendant 5 jours$/);
    });

    test('suites d’opération : tout va sur l’ordonnance (inchangé) ; sans ordonnance proposée, rien d’ajouté', () => {
        const entry = { medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, note: '' };
        expect(applyMeds({ date: '2026-11-11' }, [entry], false, { prescribed: true }).clinicalMeds[0].prescribed).toBe(true);
        expect(applyMeds({ date: '2026-11-11' }, [entry]).clinicalMeds[0].prescribed).toBeUndefined();
    });
});
