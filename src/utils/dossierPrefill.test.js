import { dossierPrefillPatch, candidaturePrefillPatch } from './dossierPrefill';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn() }));

const donnees = {
    patientFirstName: 'Jean', patientPH: '555-0000', patientBloodType: 'A+', patientAllergies: 'Pénicilline', patientChronicDiseases: 'Asthme', patientCurrentMedicine: 'Ventoline',
    patientMental: 'Anxiété', maritalStatus: 'Single',
};
const fields = (...keys) => keys;

describe('pré-remplissage depuis le dossier', () => {
    test('dossier avancé : tous les champs connus du formulaire, sans écraser une saisie', () => {
        const patch = dossierPrefillPatch(3, donnees, { patientPH: 'déjà saisi', patientAllergies: '' }, fields('patientFirstName', 'patientPH', 'patientAllergies', 'patientMental', 'maritalStatus', 'champInconnuDuDossier'));
        expect(patch).toEqual({ patientFirstName: 'Jean', patientAllergies: 'Pénicilline', patientMental: 'Anxiété', maritalStatus: 'Single' });
    });
    test('mise à jour : valeurs actuelles, y compris dans les champs « nouveau » des informations générales', () => {
        const patch = dossierPrefillPatch(26, donnees, {}, fields('patientFirstName', 'patientFirstNameNew', 'patientPHNew', 'patientBloodType'));
        expect(patch).toEqual({ patientFirstName: 'Jean', patientFirstNameNew: 'Jean', patientPHNew: '555-0000', patientBloodType: 'A+' });
    });
    test('formulaire de soins : identité du patient et fond médical (jamais ce qui se détermine en consultation)', () => {
        const patch = dossierPrefillPatch(20, donnees, {}, fields('patientAllergies', 'patientChronicDiseases', 'patientCurrentMedicine', 'patientBloodType', 'patientMental', 'patientFirstName'));
        expect(patch).toEqual({ patientFirstName: 'Jean', patientAllergies: 'Pénicilline', patientChronicDiseases: 'Asthme', patientCurrentMedicine: 'Ventoline' });
    });
    test('formulaire de soins : date de naissance et sexe du dossier (« Homme » devient « Male »)', () => {
        const withIdentity = { ...donnees, patientMiddleName: 'Michel', patientLastName: 'Testard', patientDateOfBirth: '1990-05-14', patientGender: 'Homme' };
        const patch = dossierPrefillPatch(5, withIdentity, {}, fields('patientFirstName', 'patientMiddleName', 'patientLastName', 'patientDateOfBirth', 'patientSex'));
        expect(patch).toEqual({ patientFirstName: 'Jean', patientMiddleName: 'Michel', patientLastName: 'Testard', patientDateOfBirth: '1990-05-14', patientSex: 'Male' });
        expect(dossierPrefillPatch(5, { patientGender: 'Femme' }, {}, fields('patientSex'))).toEqual({ patientSex: 'Female' });
        expect(dossierPrefillPatch(5, { patientGender: 'Autre' }, {}, fields('patientSex'))).toEqual({ patientSex: 'Other' });
    });
    test('certificats (maladie, vol) : identité seulement, pas de fond médical', () => {
        const patch = dossierPrefillPatch(35, donnees, {}, fields('patientFirstName', 'patientAllergies'));
        expect(patch).toEqual({ patientFirstName: 'Jean' });
    });
    test('un champ déjà rempli n’est jamais écrasé', () => {
        expect(dossierPrefillPatch(6, donnees, { patientFirstName: 'Saisi' }, fields('patientFirstName'))).toEqual({});
    });
    test('un formulaire sans rapport avec le dossier (libération, DMEC) n’est pas touché', () => {
        expect(dossierPrefillPatch(24, donnees, {}, fields('patientAllergies'))).toEqual({});
        expect(dossierPrefillPatch(1, donnees, {}, fields('patientAllergies'))).toEqual({});
    });
});

describe('pré-remplissage des candidatures', () => {
    const identity = { patientID: 'PHMC-2752', firstName: 'Jean', middleName: 'Paul', lastName: 'Testard', dateOfBirth: '1990-05-14', address: '1 rue', zip: '90001', phone: '555-0000', email: 'jean@mail.eyefind.fr', discord: 'jean#1' };
    test('reprend l’identité du compte (titre, prénoms, nom, naissance, adresse, ville, contacts), sans écraser un champ rempli', () => {
        const patch = candidaturePrefillPatch(identity, { patientTitle: 'Mr', patientZIPCity: 'Mission Row' }, { applicantPhone: 'déjà saisi' });
        expect(patch).toMatchObject({
            patientID: 'PHMC-2752', applicantTitle: 'Mr', applicantFirstName: 'Jean', applicantMiddleName: 'Paul', applicantLastName: 'Testard', applicantDOB: '1990-05-14', applicantZIP: '90001',
            applicantZIPCity: 'Mission Row', applicantEmail: 'jean@mail.eyefind.fr', oocDiscord: 'jean#1',
        });
        expect(patch).not.toHaveProperty('applicantPhone');
        expect(patch.applicantAddress).toBe('1 rue');
    });
    test('plus de genre ni de résumé médical dans une candidature', () => {
        const patch = candidaturePrefillPatch(identity, { patientAllergies: 'Pénicilline', patientGender: 'Homme' }, {});
        expect(patch).not.toHaveProperty('genderMale');
        expect(patch).not.toHaveProperty('applicantMedicalConditions');
    });
    test('le titre « Mineur » d’un ancien dossier n’est pas repris pour un adulte', () => {
        expect(candidaturePrefillPatch(identity, { patientTitle: 'Mineur' }, {})).not.toHaveProperty('applicantTitle');
    });
});
