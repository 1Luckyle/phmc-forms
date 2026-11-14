import { DEFAULT_REQUIRED, setFormOverrides, isFieldRequired, isDefaultRequired, requiredFieldsOf, lockedReasonOf, specialRulesOf } from './formRulesCore';
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
        expect(buildReportTitle(1, { patientID: '2752', decedentName: 'A', dateTime: '2026-11-02T14:30' }, 'Services de Médecine Légale')).toBe('[PHMC-2752] Services de Médecine Légale - 02/11/2026');
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

describe('DMEC : titre par ID patient, date seule, champs obligatoires', () => {
    const DMEC = [1, 2, 4, 8, 37];
    const names = { 1: 'Services de Médecine Légale', 2: 'Email DMEC', 4: "Rapport d'Autopsie", 8: 'Certificat de Décès', 37: 'Rapport Public de Décès' };
    const dates = { 1: { dateTime: '2026-11-02T14:30' }, 2: {}, 4: { autopsyDate: '2026-11-02' }, 8: { date: '2026-11-02' }, 37: { dateOfDeath: '2026-11-02' } };

    test.each(DMEC)('formulaire %i : le titre commence par l’ID patient du défunt, pas par son nom', (version) => {
        const data = { patientID: '2752', decedentName: 'John Doe', decedentOOC: 'John S', ...dates[version] };
        const title = buildReportTitle(version, data, names[version]);
        expect(title.startsWith(`[PHMC-2752] ${names[version]} - `)).toBe(true);
        expect(buildReportTitle(version, data, names[version])).not.toMatch(/John/);
    });

    test('un ID temporaire fait aussi le titre', () => {
        expect(buildReportTitle(4, { patientID: 'tmp-ab3cd', autopsyDate: '2026-11-02' }, "Rapport d'Autopsie")).toBe("[TMP-AB3CD] Rapport d'Autopsie - 02/11/2026");
    });

    test('jamais l’heure dans un titre, même quand le champ en contient une', () => {
        expect(buildReportTitle(1, { patientID: '2752', dateTime: '2026-11-02T23:59' }, 'Services de Médecine Légale')).toBe('[PHMC-2752] Services de Médecine Légale - 02/11/2026');
        expect(buildReportTitle(11, { dateTime: '2026-11-02T10:00', decedents: [{ decedentName: 'A' }] }, 'Tuerie')).toBe('[A] Tuerie - 02/11/2026');
    });

    test('tuerie / accident de masse : le titre est la suite des ID de tous les défunts (leurs noms seulement pour un ancien rapport sans ID)', () => {
        const base = { dateTime: '2026-11-02' };
        expect(buildReportTitle(11, { ...base, decedents: [{ decedentName: 'A', patientID: '12' }, { decedentName: 'B', patientID: 'TMP-ZZ9QA' }, { decedentName: 'C', patientID: 'phmc-7' }] }, 'Tuerie')).toBe('[PHMC-12, TMP-ZZ9QA, PHMC-7] Tuerie - 02/11/2026');
        // Le même ID saisi deux fois n'apparaît qu'une fois.
        expect(buildReportTitle(11, { ...base, decedents: [{ patientID: '12' }, { patientID: 'PHMC-12' }] }, 'Tuerie')).toBe('[PHMC-12] Tuerie - 02/11/2026');
        expect(buildReportTitle(11, { ...base, decedents: [{ decedentName: 'A' }, { decedentName: 'B' }] }, 'Tuerie')).toBe('[A, B] Tuerie - 02/11/2026');
    });

    test('tuerie / accident de masse : chaque défunt doit avoir son ID patient', () => {
        const { validateReport } = require('./formValidation');
        const base = { dateTime: '2026-11-02' };
        const errors = validateReport(11, { ...base, decedents: [{ decedentName: 'A', patientID: '12' }, { decedentName: 'B' }, { decedentName: 'C', patientID: '  ' }] }).errors;
        expect(errors).toEqual(expect.arrayContaining(['Défunt n°2 : ID patient obligatoire (ID temporaire TMP-… s\'il n\'en a pas).', 'Défunt n°3 : ID patient obligatoire (ID temporaire TMP-… s\'il n\'en a pas).']));
        expect(errors.join(' ')).not.toMatch(/Défunt n°1/);
        expect(validateReport(11, { ...base, decedents: [{ decedentName: 'A', patientID: '12' }, { decedentName: 'B', patientID: 'TMP-AB3CD' }] }).errors).toEqual([]);
    });

    test('panneau admin : le rapport de masse montre une ligne « ID patient de chaque défunt », obligatoire et verrouillée', () => {
        const { fieldKeysOf } = require('./formRulesCore');
        expect(fieldKeysOf(11)).toContain('decedentPatientIDs');
        expect(isDefaultRequired(11, 'decedentPatientIDs')).toBe(true);
        expect(lockedReasonOf(11, 'decedentPatientIDs')).toBe('title');
        expect(isFieldRequired(11, 'decedentPatientIDs', { 11: { decedentPatientIDs: false } })).toBe(true);
        // Le courriel DMEC n'expose pas la liste des ID supplémentaires comme un champ à rendre obligatoire.
        expect(fieldKeysOf(2)).not.toContain('additionalPatientIDs');
    });

    test('courriel DMEC : le titre est la suite de l’ID du défunt puis des ID ajoutés', () => {
        const title = buildReportTitle(2, { patientID: '2752', additionalPatientIDs: ['TMP-AB3CD', '', 'PHMC-2752', 'phmc-9'] }, 'Email DMEC');
        expect(title.startsWith('[PHMC-2752, TMP-AB3CD, PHMC-9] Email DMEC - ')).toBe(true);
        expect(buildReportTitle(2, { patientID: '2752' }, 'Email DMEC').startsWith('[PHMC-2752] Email DMEC - ')).toBe(true);
    });

    test.each([1, 2, 4, 8, 37])('formulaire %i : l’ID patient est obligatoire ET verrouillé (il compose le titre)', (version) => {
        expect(isDefaultRequired(version, 'patientID')).toBe(true);
        expect(lockedReasonOf(version, 'patientID')).toBe('title');
        expect(isFieldRequired(version, 'patientID', { [version]: { patientID: false } })).toBe(true);
    });

    test('le Discord du défunt n’est plus verrouillé (il ne compose plus le titre) mais reste demandé ; l’admin peut le rendre facultatif', () => {
        [1, 4, 37].forEach((version) => {
            expect(lockedReasonOf(version, 'decedentOOC')).toBeNull();
            expect(isDefaultRequired(version, 'decedentOOC')).toBe(true);
            expect(isFieldRequired(version, 'decedentOOC', { [version]: { decedentOOC: false } })).toBe(false);
        });
    });

    test('les noms du défunt ne sont plus verrouillés (autopsie, certificat, rapport public) ; la date du titre l’est toujours', () => {
        [4, 8, 37].forEach((version) => {
            expect(lockedReasonOf(version, 'decedentFirstName')).toBeNull();
            expect(lockedReasonOf(version, 'decedentLastName')).toBeNull();
        });
        expect(lockedReasonOf(1, 'dateTime')).toBe('title');
        expect(lockedReasonOf(4, 'autopsyDate')).toBe('title');
        expect(lockedReasonOf(8, 'date')).toBe('title');
        expect(lockedReasonOf(37, 'dateOfDeath')).toBe('title');
    });

    test('à l’enregistrement : sans ID patient, chaque formulaire DMEC est refusé', () => {
        const { validateReport } = require('./formValidation');
        [1, 2, 4, 8, 37].forEach((version) => {
            const errors = validateReport(version, { deathRecordType: 'Identified' }).errors.join(' ');
            expect(errors).toMatch(/ID patient du défunt : champ obligatoire/);
        });
        expect(validateReport(2, { patientID: 'TMP-AB3CD', coronerEmployee: 'X', requestingOfficer: 'Y' }).errors.join(' ')).not.toMatch(/ID patient|Nom IC/);
    });

    test('Services de Médecine Légale : le champ « Date et heure » devient une date', () => {
        const { VERSION_FIELDS } = require('../constants/formFieldCatalog');
        expect(VERSION_FIELDS[1].dateTime).toBe('date');
    });
});
