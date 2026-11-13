import { FIELD_CONDITIONS, conditionOf, conditionTextOf, isFieldApplicable } from './fieldApplicability';
import { setFormOverrides, requiredFieldsOf, isFieldRequired, lockedReasonOf, fieldKeysOf } from './formRulesCore';
import { validateReport, validateApplication } from './formValidation';
import { VERSION_FIELDS } from '../constants/formFieldCatalog';

afterEach(() => setFormOverrides({}));

const yearsAgo = (years) => { const d = new Date(); d.setFullYear(d.getFullYear() - years); return d.toISOString().slice(0, 10); };
const release = (over = {}) => ({
    patientFirstName: 'Jane', patientLastName: 'Doe', patientEmail: 'jane@mail.eyefind.fr', patientID: '2752', MedicalRecordsRelease: ['Allergies'], ...over,
});

describe('champs conditionnels : libération médicale (représentant légal)', () => {
    test('un patient majeur : aucun représentant légal demandé, rien ne bloque', () => {
        const data = release({ patientDateOfBirth: yearsAgo(30), patientTitle: 'Mr' });
        expect(isFieldApplicable(24, 'guardianName', data)).toBe(false);
        expect(isFieldApplicable(24, 'guardianRelation', data)).toBe(false);
        expect(validateReport(24, data).errors.join(' ')).not.toMatch(/représentant légal|Représentant légal|Lien avec le patient/i);
    });

    test('un patient mineur : représentant légal et lien obligatoires', () => {
        const data = release({ patientDateOfBirth: yearsAgo(12), patientTitle: 'Mineur' });
        expect(isFieldApplicable(24, 'guardianName', data)).toBe(true);
        const errors = validateReport(24, data).errors;
        expect(errors.join(' ')).toMatch(/représentant légal : le nom est obligatoire/i);
        expect(errors.join(' ')).toMatch(/lien avec le patient/i);
        expect(validateReport(24, { ...data, guardianName: 'Marie Doe', guardianRelation: 'Mère' }).errors.join(' ')).not.toMatch(/représentant légal/i);
    });

    test('un mineur émancipé signe lui-même : plus de représentant exigé', () => {
        const data = release({ patientDateOfBirth: yearsAgo(16), patientTitle: 'Mineur', patientEmancipated: true });
        expect(isFieldApplicable(24, 'guardianName', data)).toBe(false);
        expect(validateReport(24, data).errors.join(' ')).not.toMatch(/représentant légal/i);
    });

    test('les deux champs figurent parmi les champs obligatoires du formulaire, verrouillés par règle, avec leur condition affichée', () => {
        expect(requiredFieldsOf(24)).toEqual(expect.arrayContaining(['guardianName', 'guardianRelation']));
        expect(lockedReasonOf(24, 'guardianName')).toBe('rule');
        expect(conditionTextOf(24, 'guardianName')).toMatch(/moins de 18 ans/);
    });
});

describe('un champ rendu obligatoire dans le back-office ne bloque que lorsqu\'il s\'affiche', () => {
    test('formulaire d\'urgences : la destination de transfert n\'est exigée que pour un transfert', () => {
        setFormOverrides({ 19: { transferTo: true } });
        const base = { patientName: 'Jane Doe', patientID: '2752', date: '2026-11-02', phmcEmployee: 'Dr X' };
        expect(validateReport(19, { ...base, dischargeDestination: 'Home' }).errors).toEqual([]);
        expect(validateReport(19, { ...base, dischargeDestination: 'Transfer' }).errors).toContain('Établissement de transfert : champ obligatoire.');
        expect(validateReport(19, { ...base, dischargeDestination: 'Transfer', transferTo: 'Hôpital Central' }).errors).toEqual([]);
        // patient décédé : plus d'orientation de sortie, donc plus de transfert
        expect(validateReport(19, { ...base, careDeceased: 'Yes', dischargeDestination: 'Transfer' }).errors).not.toContain('Établissement de transfert : champ obligatoire.');
    });

    test('mise à jour du dossier : un champ d\'une rubrique non cochée n\'est pas exigé', () => {
        setFormOverrides({ 26: { patientSmoker: true, patientWeight: true } });
        const base = { patientFirstName: 'A', patientLastName: 'B', date: '2026-11-02', patientID: '2752', patientEmail: 'a@b.fr', UpdateMedicalFile: ['Lifestyle'] };
        const errors = validateReport(26, base).errors.join(' ');
        expect(errors).toMatch(/tabac|fum/i);
        expect(errors).not.toMatch(/poids/i);
    });

    test('rapport public de décès : champs propres au défunt non identifié', () => {
        setFormOverrides({ 37: { hairColor: true, patientID: true } });
        const base = { caseNumber: '1', decedentFirstName: 'A', decedentLastName: 'B', decedentOOC: 'C', dateOfDeath: '2026-11-01' };
        const identified = validateReport(37, { ...base, deathRecordType: 'Identified' }).errors.join(' ');
        expect(identified).toMatch(/ID patient/i);
        expect(identified).not.toMatch(/cheveux/i);
        const unidentified = validateReport(37, { ...base, deathRecordType: 'Unidentified' }).errors.join(' ');
        expect(unidentified).toMatch(/cheveux/i);
        expect(unidentified).not.toMatch(/ID patient/i);
    });

    test('sans type de défunt, le formulaire reste bloqué (le type est lui-même obligatoire)', () => {
        const errors = validateReport(37, {}).errors.join(' ');
        expect(errors).toMatch(/Type de dossier de décès/i);
    });

    test('certificat de vol : un examen hors de la classe choisie n\'est pas exigé', () => {
        setFormOverrides({ 41: { flightCert_cardio: true } });
        expect(isFieldApplicable(41, 'flightCert_cardio', { flightCertClass: 'Class2' })).toBe(false);
        expect(isFieldApplicable(41, 'flightCert_cardio', { flightCertClass: 'Class1' })).toBe(true);
    });

    test('candidature : la précision « Autre » du genre n\'est exigée que si « Autre » est coché', () => {
        setFormOverrides({ 52: { applicantGenderOtherText: true } });
        const base = {
            recruitmentPosition: 'X', applicantTitleAndFullName: 'Mme Jane Doe', genderFemale: true, applicantDOBAndPlace: '01/01/1990 Los Santos', applicantAddress: 'Rue 1', applicantPhone: '555-0142',
            applicantEmail: 'a@b.fr', applicantMedicalConditions: 'N/A', citizenUS: true, eduHighSchool: true, applicantSchoolName: 'S', applicantEnrollmentTerm: '2010', applicantMajor: 'M',
            applicantLanguages: 'FR', applicantPrevEmployment: 'E', applicantPrevDuties: 'D', applicantPrevDismissalReason: 'R', applicantMotivationLetter: 'L',
            oocUcpName: 'u', oocForumName: 'f', oocDiscord: 'd', oocTimezone: 'tz',
        };
        expect(validateApplication(52, base, { mode: 'submit' }).errors.join(' ')).not.toMatch(/précision/i);
        expect(validateApplication(52, { ...base, genderFemale: false, genderOther: true }, { mode: 'submit' }).errors.join(' ')).toMatch(/Genre|précision/i);
    });
});

describe('les champs verrouillés « titre » et « facturation » ne sont jamais conditionnels', () => {
    test('un champ du titre reste toujours exigé', () => {
        expect(isFieldApplicable(37, 'decedentFirstName', {})).toBe(true);
        expect(isFieldApplicable(25, 'patientEmail', {})).toBe(true);
        expect(isFieldRequired(37, 'decedentFirstName')).toBe(true);
    });
});

describe('cohérence de la table des conditions', () => {
    test('chaque champ conditionnel existe au catalogue de son formulaire', () => {
        const unknown = [];
        Object.entries(FIELD_CONDITIONS).forEach(([version, fields]) => Object.keys(fields).forEach((field) => {
            if (!fieldKeysOf(version).includes(field)) unknown.push(`v${version}.${field}`);
        }));
        expect(unknown).toEqual([]);
    });

    test('chaque condition a un texte lisible et ne plante pas sur un formulaire vide', () => {
        Object.entries(FIELD_CONDITIONS).forEach(([version, fields]) => Object.keys(fields).forEach((field) => {
            const condition = conditionOf(version, field);
            expect(typeof condition.text).toBe('string');
            expect(condition.text.length).toBeGreaterThan(5);
            expect(() => condition.when({})).not.toThrow();
        }));
    });

    test('un champ du catalogue sans condition s\'affiche toujours', () => {
        expect(isFieldApplicable(22, 'patientNotes', {})).toBe(true);
        expect(conditionTextOf(22, 'patientNotes')).toBe('');
        expect(Object.keys(VERSION_FIELDS).length).toBeGreaterThan(25);
    });
});
