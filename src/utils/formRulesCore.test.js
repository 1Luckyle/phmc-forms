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
        const errors = validateReport(25, { patientFirstName: 'A', patientLastName: 'B', patientDateOfBirth: '1990-01-01', patientID: '2752' }).errors;
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

describe('titre « Mineur » obligatoire', () => {
    const recent = (years) => { const d = new Date(); d.setFullYear(d.getFullYear() - years); return d.toISOString().slice(0, 10); };
    const base = { patientFirstName: 'A', patientLastName: 'B', patientEmail: 'a@b.fr', patientID: '2752', patientWeight: '60', patientHeight: '170' };
    test('un patient de moins de 18 ans sans le titre « Mineur » ne peut pas être enregistré', () => {
        const errors = validateReport(25, { ...base, patientDateOfBirth: recent(10), patientTitle: 'Mr' }).errors;
        expect(errors.join(' ')).toMatch(/obligatoirement le titre « Mineur »/);
        expect(validateReport(25, { ...base, patientDateOfBirth: recent(10), patientTitle: 'Mineur' }).errors).toEqual([]);
    });
    test('un adulte ne peut pas avoir le titre « Mineur »', () => {
        expect(validateReport(25, { ...base, patientDateOfBirth: recent(30), patientTitle: 'Mineur' }).errors.join(' ')).toMatch(/moins de 18 ans/);
    });
});

describe('poids et taille du dossier médical', () => {
    const base = { patientFirstName: 'A', patientLastName: 'B', patientEmail: 'a@b.fr', patientID: '2752', patientDateOfBirth: '1990-01-01', patientTitle: 'Mr' };
    test('obligatoires dans le dossier basique et avancé, lisibles en kg et en cm', () => {
        [25, 3].forEach((version) => {
            expect(validateReport(version, base).errors.join(' ')).toMatch(/Poids du patient : champ obligatoire[\s\S]*Taille du patient : champ obligatoire/);
            expect(validateReport(version, { ...base, patientWeight: '75 kg', patientHeight: '1,78' }).errors.join(' ')).not.toMatch(/Poids|Taille/);
            expect(validateReport(version, { ...base, patientWeight: 'lourd', patientHeight: '5000' }).errors.join(' ')).toMatch(/Poids du patient : valeur invalide[\s\S]*Taille du patient : valeur invalide/);
        });
    });
    test('facultatifs dans la mise à jour, contrôlés seulement avec la section « Historique médical »', () => {
        const update = { patientFirstName: 'A', patientLastName: 'B', date: '2026-01-01', patientEmail: 'a@b.fr', patientID: '2752', UpdateMedicalFile: ['Medical History'] };
        expect(validateReport(26, update).errors.join(' ')).not.toMatch(/Poids|Taille/);
        expect(validateReport(26, { ...update, patientWeight: '0' }).errors.join(' ')).toMatch(/Poids du patient : valeur invalide/);
        expect(validateReport(26, { ...update, UpdateMedicalFile: ['EmergencyContact'], patientWeight: '0' }).errors.join(' ')).not.toMatch(/Poids/);
    });
});

describe('mise à jour du dossier : nouveau titre', () => {
    const recent = (years) => { const d = new Date(); d.setFullYear(d.getFullYear() - years); return d.toISOString().slice(0, 10); };
    const base = { patientFirstName: 'A', patientLastName: 'B', date: recent(10), patientEmail: 'a@b.fr', patientID: '2752', patientTitleOptions: 'Mineur', UpdateMedicalFile: ['GeneralInformation'] };
    test('un mineur a forcément le nouveau titre « Maître (Enfant <18 ans) »', () => {
        expect(validateReport(26, { ...base, patientTitleNew: 'Mr' }).errors.join(' ')).toMatch(/obligatoirement le titre « Maître/);
        expect(validateReport(26, { ...base, patientTitleNew: 'Mstr' }).errors).toEqual([]);
        expect(validateReport(26, { ...base, date: recent(30), patientTitleOptions: 'Mr', patientTitleNew: 'Mstr' }).errors.join(' ')).toMatch(/moins de 18 ans/);
    });
});
