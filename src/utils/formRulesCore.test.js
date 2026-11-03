import { DEFAULT_REQUIRED, setFormOverrides, isFieldRequired, requiredFieldsOf, lockedReasonOf, specialRulesOf } from './formRulesCore';
import { validateReport } from './formValidation';
import { buildReportTitle, frDay } from './reportTitle';
import { VERSION_FIELDS } from '../constants/formFieldCatalog';
import { FIELD_INFO } from '../constants/fieldInfo';

afterEach(() => setFormOverrides({}));

describe('champs obligatoires', () => {
    test('par défaut : le minimum du code', () => {
        expect(requiredFieldsOf(22)).toEqual(expect.arrayContaining(['patientName', 'date']));
        expect(isFieldRequired(22, 'patientNotes')).toBe(false);
    });

    test('le back-office peut rendre un champ obligatoire, jamais facultatif un champ verrouillé', () => {
        setFormOverrides({ 22: { patientNotes: true, patientName: false } });
        expect(isFieldRequired(22, 'patientNotes')).toBe(true);
        expect(lockedReasonOf(22, 'patientName')).toBe('title');
        expect(isFieldRequired(22, 'patientName')).toBe(true);
    });

    test('un champ obligatoire vide bloque l\'enregistrement, avec le bon libellé', () => {
        setFormOverrides({ 22: { patientNotes: true } });
        const { errors } = validateReport(22, { patientName: 'Jane Doe', date: '2026-11-02' });
        expect(errors).toEqual(['Notes : champ obligatoire.']);
        expect(validateReport(22, { patientName: 'Jane Doe', date: '2026-11-02', patientNotes: 'ok' }).errors).toEqual([]);
    });

    test('un champ par défaut rendu facultatif ne bloque plus (hors verrous)', () => {
        setFormOverrides({ 25: { patientEmail: false, patientAddress: true } });
        // patientEmail est verrouillé (facturation) : reste exigé
        const errors = validateReport(25, { patientName: 'A B', patientDateOfBirth: '1990-01-01', patientID: '2752' }).errors;
        expect(errors).toEqual(expect.arrayContaining(['E-mail du patient : champ obligatoire.', 'Adresse du patient : champ obligatoire.']));
    });

    test('les règles propres au formulaire restent', () => {
        const errors = validateReport(24, { patientEmail: 'a@b.fr', patientID: '2752' }).errors;
        expect(errors.join(' ')).toMatch(/Prénom ou nom du patient/);
        expect(errors.join(' ')).toMatch(/au moins un élément/);
        expect(specialRulesOf(24).length).toBeGreaterThan(0);
    });

    test('les défauts ne mentionnent que des champs connus du catalogue', () => {
        Object.entries(DEFAULT_REQUIRED).forEach(([version, fields]) => fields.forEach((field) => {
            expect(VERSION_FIELDS[version]?.[field]).toBeDefined();
        }));
    });

    test('chaque champ du catalogue a un libellé et une aide', () => {
        const missing = new Set();
        Object.values(VERSION_FIELDS).forEach((fields) => Object.keys(fields).forEach((key) => { if (!FIELD_INFO[key]) missing.add(key); }));
        expect([...missing]).toEqual([]);
    });
});

describe('titres des rapports', () => {
    test('dates au format JJ/MM/AAAA', () => {
        expect(frDay('2026-11-02')).toBe('02/11/2026');
        expect(frDay('2026-11-02T14:30')).toBe('02/11/2026 14:30');
        expect(buildReportTitle(22, { patientID: '2752', date: '2026-11-02' }, 'Note de Service')).toBe('[PHMC-2752] Note de Service - 02/11/2026');
        expect(buildReportTitle(5, { patientName: 'Jane Doe' }, 'Opération Chirurgicale')).toBe('[Jane Doe] Opération Chirurgicale - Date inconnue');
        expect(buildReportTitle(37, { caseNumber: '2026-0042', decedentName: 'A', decedentOOC: 'B', dateOfDeath: '2026-11-02' }, 'Rapport Public de Décès')).toBe('[A] Rapport Public de Décès - 02/11/2026');
        expect(buildReportTitle(1, { patientID: '2752', decedentName: 'A', dateTime: '2026-11-02T14:30' }, 'Services de Médecine Légale')).toBe('[PHMC-2752] Services de Médecine Légale - 02/11/2026 14:30');
        expect(buildReportTitle(4, { decedentName: 'John Doe', decedentOOC: 'John S', autopsyDate: '2026-11-02' }, "Rapport d'Autopsie")).toBe("[John Doe] Rapport d'Autopsie - 02/11/2026");
        expect(buildReportTitle(11, { dateTime: '2026-11-02T10:00', decedents: [{ decedentName: 'A' }, { decedentName: 'B' }] }, 'Rapport de Tuerie/Accident de Masse')).toBe('[A, B] Rapport de Tuerie/Accident de Masse - 02/11/2026');
    });
});
