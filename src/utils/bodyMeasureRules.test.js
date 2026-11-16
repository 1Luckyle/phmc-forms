import { bodyMeasureProblems } from './bodyMeasureRules';
import { validateReport } from './formValidation';
import { BODY_LIMITS, parseAgeYears, parseWeightKg, parseHeightCm, bmiOf, bmiCategory, isBmiImplausible } from '../clinical/bodyLimits';
import { AGE_OPTIONS, WEIGHT_OPTIONS, HEIGHT_OPTIONS } from '../clinical/pilouChoices';
import { buildCase } from '../clinical/protocols';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));

describe('bornes communes à tout le site', () => {
    test('lecture de l\'âge, du poids et de la taille', () => {
        expect(parseAgeYears('42 ans')).toBe(42);
        expect(parseAgeYears('0')).toBe(0);
        expect(parseAgeYears('121')).toBeNull();
        expect(parseAgeYears('-1')).toBeNull();
        expect(parseWeightKg('75,5')).toBe(75.5);
        expect(parseWeightKg('400')).toBe(400);
        expect(parseWeightKg('401')).toBeNull();
        expect(parseWeightKg('0,5')).toBeNull();
        expect(parseHeightCm('1,80 m')).toBe(180);
        expect(parseHeightCm('29')).toBeNull();
        expect(parseHeightCm('261')).toBeNull();
    });
    test('IMC calculé sur toute la plage, interprété pour un adulte', () => {
        expect(bmiOf('75', '178')).toBe(23.7);
        expect(bmiOf('400', '260')).toBe(59.2);
        expect(bmiOf('1', '30')).toBe(11.1);
        expect(bmiOf('75', '')).toBeNull();
        expect(bmiCategory(23.7, 40).label).toBe('corpulence normale');
        expect(bmiCategory(41, 40).label).toBe('obésité morbide');
        expect(bmiCategory(15, 40).level).toBe('warn');
        expect(bmiCategory(15, 10).label).toMatch(/courbes de croissance/);
        expect(isBmiImplausible(bmiOf('300', '60'))).toBe(true);
        expect(isBmiImplausible(23.7)).toBe(false);
    });
    test('les listes de Pilou couvrent exactement les mêmes bornes', () => {
        expect(Number(AGE_OPTIONS[0].value)).toBe(BODY_LIMITS.ageYears.min);
        expect(Number(AGE_OPTIONS[AGE_OPTIONS.length - 1].value)).toBe(BODY_LIMITS.ageYears.max);
        expect(Number(WEIGHT_OPTIONS[0].value)).toBe(BODY_LIMITS.weightKg.min);
        expect(Number(WEIGHT_OPTIONS[WEIGHT_OPTIONS.length - 1].value)).toBe(BODY_LIMITS.weightKg.max);
        expect(Number(HEIGHT_OPTIONS[0].value)).toBe(BODY_LIMITS.heightCm.min);
        expect(Number(HEIGHT_OPTIONS[HEIGHT_OPTIONS.length - 1].value)).toBe(BODY_LIMITS.heightCm.max);
    });
    test('Pilou prend en charge les extrêmes : nourrisson de 1 kg, patient de 400 kg, 120 ans', () => {
        [{ ageYears: '0', weightKg: '1', heightCm: '30' }, { ageYears: '35', weightKg: '400', heightCm: '260' }, { ageYears: '120', weightKg: '40', heightCm: '150' }].forEach((patient) => {
            const result = buildCase({ ...patient, sex: 'Male', severity: 'Moderate', conditionIds: ['fracture_fermee'] });
            expect(result).not.toBeNull();
            expect(result.patient.bmi).toBeGreaterThan(0);
            expect(result.patient.bmiLabel).toBeTruthy();
            expect(result.vitals.hr).toBeGreaterThan(0);
            result.meds.forEach((m) => expect(m.text).toMatch(/\d/));
        });
    });
});

describe('contrôles dans tous les formulaires', () => {
    test('dossier médical : poids et taille hors bornes refusés', () => {
        const base = { patientFirstName: 'A', patientLastName: 'B', patientDateOfBirth: '1990-01-01', patientID: '2752', patientEmail: 'a@b.fr', patientTitle: 'Mr' };
        expect(validateReport(25, { ...base, patientWeight: '450', patientHeight: '178' }).errors.join(' ')).toMatch(/Poids du patient : valeur invalide/);
        expect(validateReport(25, { ...base, patientWeight: '75', patientHeight: '20' }).errors.join(' ')).toMatch(/Taille du patient : valeur invalide/);
        expect(validateReport(25, { ...base, patientWeight: '75', patientHeight: '1,78' }).errors.join(' ')).not.toMatch(/invalide/);
    });
    test('formulaires de soins : poids, taille et âge contrôlés aussi', () => {
        const base = { patientName: 'Jane Doe', patientID: '2752', date: '2026-11-02', phmcEmployee: 'Dr X' };
        const errors = validateReport(19, { ...base, patientWeight: 'beaucoup', patientHeight: '300', patientAgeYears: '150' }).errors.join(' ');
        expect(errors).toMatch(/Poids/);
        expect(errors).toMatch(/Taille/);
        expect(errors).toMatch(/Âge/);
        expect(validateReport(19, { ...base, patientWeight: '75', patientHeight: '178', patientAgeYears: '35' }).errors.join(' ')).not.toMatch(/invalide/);
    });
    test('mise à jour du dossier : seulement si la rubrique « Historique médical » est cochée', () => {
        const base = { patientFirstName: 'A', patientLastName: 'B', date: '2026-11-02', patientID: '2752', patientEmail: 'a@b.fr', patientWeight: '999' };
        expect(validateReport(26, { ...base, UpdateMedicalFile: ['Lifestyle'] }).errors.join(' ')).not.toMatch(/Poids/);
        expect(validateReport(26, { ...base, UpdateMedicalFile: ['Medical History'] }).errors.join(' ')).toMatch(/Poids/);
    });
    test('fiches du DMEC : texte libre toléré tant qu\'aucun nombre ne sort des bornes', () => {
        expect(bodyMeasureProblems(4, { decedentWeight: 'inconnu', decedentHeight: '1,80 m', decedentAge: 'environ 40 ans' }).errors).toEqual([]);
        expect(bodyMeasureProblems(4, { decedentWeight: '800 kg' }).errors.join(' ')).toMatch(/invalide/);
        expect(bodyMeasureProblems(37, { deathRecordType: 'Unidentified', weight: '80 kg', height: '1,80 m', age: '35' }).errors).toEqual([]);
        expect(bodyMeasureProblems(37, { deathRecordType: 'Unidentified', height: '5 m', age: '200' }).errors).toHaveLength(2);
        // défunt identifié : taille et poids ne s'affichent pas, donc ne sont pas contrôlés
        expect(bodyMeasureProblems(37, { deathRecordType: 'Identified', height: '5 m' }).errors).toEqual([]);
    });
    test('IMC très improbable : avertissement, jamais bloquant', () => {
        const result = bodyMeasureProblems(25, { patientWeight: '300', patientHeight: '60' });
        expect(result.errors).toEqual([]);
        expect(result.warnings.join(' ')).toMatch(/IMC/);
    });
    test('un champ absent du formulaire n\'est jamais contrôlé', () => {
        expect(bodyMeasureProblems(22, { patientWeight: '9999' })).toEqual({ errors: [], warnings: [] });
    });
});
