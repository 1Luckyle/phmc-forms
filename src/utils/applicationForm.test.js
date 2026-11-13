import {
    migrateApplicationData, applicantDisplayName, jobProblems, jobPeriod, enrollmentPeriod, timezoneOptions, utcOffsetLabel, timezoneLabel, licensesOf,
    NO_OTHER_LANGUAGE, APPLICATION_FIELDS, EDUCATION_LEVELS, CITIZENSHIP_OPTIONS,
} from './applicationForm';
import { validateApplication } from './formValidation';
import { setFormOverrides } from './formRulesCore';
import generateApplicationDocument from '../phmc-recruitment-generators/shared/applicationDocument';
import generatePhysician from '../phmc-recruitment-generators/generatePhysician';
import { VERSION_FIELDS } from '../constants/formFieldCatalog';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));

afterEach(() => setFormOverrides({}));

const complete = (over = {}) => ({
    recruitmentPosition: 'Attending', applicantTitle: 'Mrs', applicantFirstName: 'Jane', applicantMiddleName: '', applicantLastName: 'Doe', applicantDOB: '1990-05-14',
    applicantAddress: '1 Rue', applicantZIP: '90001', applicantPhone: '555-0142', applicantEmail: 'jane@mail.eyefind.fr', applicantCitizenship: CITIZENSHIP_OPTIONS[0],
    applicantEducationLevel: EDUCATION_LEVELS[4], applicantSchoolName: 'Univ', applicantEnrollmentStart: '2010-09-01', applicantEnrollmentEnd: '2014-06-30', applicantMajor: 'Biologie',
    applicantLanguages: ['Anglais'], applicantJobs: [{ company: 'LSGH', role: 'Infirmière', start: '2015-01-05', left: false, end: '', duties: 'Soins', leaveReason: '' }],
    oocDiscord: 'jane', oocTimezone: 'Europe/Paris', oocMedicalExperience: 'Trois ans',
    ...over,
});

describe('candidature : champs communs', () => {
    test('une candidature complète est valide pour tous les formulaires', () => {
        [50, 51, 53, 54].forEach((version) => expect(validateApplication(version, complete(), { mode: 'submit' }).errors).toEqual([]));
        expect(validateApplication(52, complete({ oocMedicalExperience: '' }), { mode: 'submit' }).errors).toEqual([]);
    });

    test('les champs retirés ne sont plus demandés (genre, lieu de naissance, condition médicale, lettre, forum, UCP)', () => {
        const errors = validateApplication(50, {}, { mode: 'submit' });
        expect(errors.errors.length).toBeGreaterThan(0);
        const labels = validateApplication(50, { recruitmentPosition: 'X' }, { mode: 'submit' }).errors.join(' ');
        ['Genre', 'Lieu de naissance', 'Problèmes de santé', 'Lettre de motivation', 'forum', 'UCP'].forEach((word) => expect(labels).not.toMatch(new RegExp(word, 'i')));
        VERSION_FIELDS[50] && ['genderMale', 'applicantBirthPlace', 'applicantMedicalConditions', 'applicantMotivationLetter', 'oocForumName', 'oocUcpName'].forEach((field) => expect(VERSION_FIELDS[50][field]).toBeUndefined());
    });

    test('le titre suit l\'âge : « Mineur » sous 18 ans, jamais au-delà', () => {
        const year = new Date().getFullYear() - 12;
        expect(validateApplication(50, complete({ applicantDOB: `${year}-01-01`, applicantTitle: 'Mr' }), { mode: 'submit' }).errors.join(' ')).toMatch(/obligatoirement le titre « Mineur »/);
        expect(validateApplication(50, complete({ applicantTitle: 'Mineur' }), { mode: 'submit' }).errors.join(' ')).toMatch(/Titre « Mineur » : la date de naissance/);
    });

    test('expérience : un emploi complet, ou « aucune expérience » ; fin obligatoire si l\'emploi est quitté', () => {
        expect(validateApplication(50, complete({ applicantJobs: [] }), { mode: 'submit' }).errors.join(' ')).toMatch(/Expérience professionnelle/);
        expect(validateApplication(50, complete({ applicantJobs: [], applicantNoExperience: true }), { mode: 'submit' }).errors).toEqual([]);
        const left = validateApplication(50, complete({ applicantJobs: [{ company: 'A', role: 'B', start: '2015-01-01', left: true, end: '', duties: 'x' }] }), { mode: 'submit' }).errors.join(' ');
        expect(left).toMatch(/Emploi 1 : renseignez date de fin/);
    });

    test('scolarité : fin obligatoire sauf études en cours', () => {
        expect(validateApplication(50, complete({ applicantEnrollmentEnd: '' }), { mode: 'submit' }).errors.join(' ')).toMatch(/Fin de la scolarité/);
        expect(validateApplication(50, complete({ applicantEnrollmentEnd: '', applicantEnrollmentOngoing: true }), { mode: 'submit' }).errors).toEqual([]);
    });

    test('paramédical : expérience pour tous ; autres rôles : licence (capture) et motivation en plus', () => {
        const selectOptions = { postesParamedical: { Paramedic: { nom: 'Paramedic', statut: 'OUVERT', role: 'Paramedic' }, Cadet: { nom: 'Cadet', statut: 'OUVERT', role: 'Cadet' } } };
        expect(validateApplication(55, complete({ recruitmentPosition: 'Paramedic' }), { mode: 'submit', selectOptions }).errors).toEqual([]);
        const other = validateApplication(55, complete({ recruitmentPosition: 'Cadet', applicantJobs: [] }), { mode: 'submit', selectOptions }).errors.join(' ');
        expect(other).toMatch(/Expérience professionnelle/);
        expect(other).toMatch(/Licences : ajoutez au moins une capture/);
        expect(other).toMatch(/programme à temps partiel/);
        expect(other).not.toMatch(/Nom Discord|Fuseau/);
    });

    test('licences : captures facultatives hors rôles EMS particuliers ; seules les adresses https sont gardées', () => {
        expect(validateApplication(50, complete({ applicantLicenses: [] }), { mode: 'submit' }).errors).toEqual([]);
        expect(licensesOf({ applicantLicenses: ['https://i.ibb.co/a.png', 'javascript:alert(1)', 'http://x.fr/a.png'] })).toEqual(['https://i.ibb.co/a.png']);
    });
});

describe('anciennes candidatures reprises dans le formulaire actuel', () => {
    const old = {
        recruitmentPosition: 'Attending', applicantTitleAndFullName: 'Mme Jane Marie Doe', genderFemale: true, applicantDOBAndPlace: '14/05/1990 à Los Santos',
        applicantAddress: '1 Rue', citizenUS: true, eduBachelor: true, applicantEnrollmentTerm: '01/09/2010 à 30/06/2014', applicantLanguages: 'Anglais, Espagnol',
        applicantPrevEmployment: 'Infirmière chez LSGH', applicantPrevDuties: 'Soins', applicantPrevDismissalReason: 'N/A', oocTimezone: 'EST', oocUcpName: 'janedoe', emsLicenseLink: 'https://i.ibb.co/lic.png',
        applicantMotivationLetter: 'Texte',
    };
    const data = migrateApplicationData(old);
    test('nom, titre, naissance, citoyenneté, études, langues, emploi, licence', () => {
        expect(data).toMatchObject({ applicantTitle: 'Mrs', applicantFirstName: 'Jane', applicantMiddleName: 'Marie', applicantLastName: 'Doe', applicantDOB: '1990-05-14', applicantCitizenship: CITIZENSHIP_OPTIONS[0], applicantEducationLevel: EDUCATION_LEVELS[4] });
        expect(data).toMatchObject({ applicantEnrollmentStart: '2010-09-01', applicantEnrollmentEnd: '2014-06-30', applicantLanguages: ['Anglais', 'Espagnol'], applicantLocation: 'PHMC' });
        expect(data.applicantJobs).toHaveLength(1);
        expect(data.applicantJobs[0]).toMatchObject({ company: 'Infirmière chez LSGH', duties: 'Soins', leaveReason: '' });
        expect(data.applicantLicenses).toEqual(['https://i.ibb.co/lic.png']);
        expect(data.oocTimezone).toBe('');   // « EST » n'est pas un vrai fuseau : à rechoisir
        expect(data.applicantTitleAndFullName).toBe('Mme Jane Marie Doe');
    });
    test('les champs supprimés disparaissent', () => {
        ['genderFemale', 'applicantDOBAndPlace', 'citizenUS', 'eduBachelor', 'applicantEnrollmentTerm', 'applicantPrevEmployment', 'oocUcpName', 'applicantMotivationLetter', 'emsLicenseLink'].forEach((field) => expect(data).not.toHaveProperty(field));
    });
    test('idempotent, et « N/A » = aucune expérience / aucune autre langue', () => {
        expect(migrateApplicationData(data)).toEqual(data);
        const none = migrateApplicationData({ applicantPrevEmployment: 'N/A', applicantLanguages: 'N/A' });
        expect(none.applicantNoExperience).toBe(true);
        expect(none.applicantLanguages).toEqual([NO_OTHER_LANGUAGE]);
    });
});

describe('fuseaux horaires et périodes', () => {
    test('vrais fuseaux avec leur décalage', () => {
        const options = timezoneOptions(new Date(Date.UTC(2026, 0, 15, 12)));
        const paris = options.find((option) => option.value === 'Europe/Paris');
        expect(paris.label).toBe('Europe / Paris (UTC+01:00)');
        expect(utcOffsetLabel('America/Los_Angeles', new Date(Date.UTC(2026, 0, 15)))).toBe('UTC-08:00');
        expect(timezoneLabel('')).toBe('');
    });
    test('périodes d\'emploi et de scolarité', () => {
        expect(jobPeriod({ start: '2019-03-01', left: true, end: '2022-11-30' })).toBe('du 01/03/2019 au 30/11/2022');
        expect(jobPeriod({ start: '2019-03-01', left: false })).toBe('depuis le 01/03/2019');
        expect(enrollmentPeriod({ applicantEnrollmentStart: '2010-09-01', applicantEnrollmentOngoing: true })).toMatch(/études en cours/);
        expect(jobProblems({ company: 'A', role: 'B', start: '2020-01-01', duties: 'x', left: true, end: '2019-01-01' })).toEqual(['date de fin postérieure au début']);
    });
});

describe('aperçu de la candidature', () => {
    const doc = generateApplicationDocument({ ...complete({ applicantLicenses: ['https://i.ibb.co/lic.png'] }), positionDetailsData: { Attending: { nom: 'Médecin titulaire' } } }, { categoryLabel: 'Médecine' });
    test('même style que les autres formulaires, sans les éléments retirés', () => {
        expect(doc).toContain('CANDIDATURE');
        expect(doc).toContain('Médecin titulaire');
        expect(doc).toContain('Mme Jane Doe');
        expect(doc).toContain('Infirmière chez LSGH');
        expect(doc).toContain('[img=320]https://i.ibb.co/lic.png[/img]');
        expect(doc).toContain('Europe / Paris (UTC+');
        ['Faculté Médicale', 'Guide des Visiteurs', 'LES POSTES SONT', 'ajoutez un c', '[cb]', '[color=#FF0000]1[/color]', 'Lettre de Motivation', 'UCP', 'Forum'].forEach((text) => expect(doc).not.toContain(text));
    });
    test('les six formulaires utilisent le même document', () => {
        expect(generatePhysician({ ...complete(), positionDetailsData: {} })).toContain('Centre de Carrières — Médecine');
    });
    test('un crochet saisi ne devient pas une balise', () => {
        expect(generateApplicationDocument({ ...complete({ oocMedicalExperience: 'Vu [b]gras[/b] ici' }) })).toContain('Vu ［b］gras［/b］ ici');
    });
    test('tous les champs du formulaire sont enregistrés avec la candidature', () => {
        expect(APPLICATION_FIELDS).toEqual(expect.arrayContaining(['applicantJobs', 'applicantLicenses', 'applicantTitle', 'oocTimezone']));
    });
});
