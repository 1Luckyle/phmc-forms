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
    test('formulaire de soins : seulement le fond médical (jamais ce qui se détermine en consultation)', () => {
        const patch = dossierPrefillPatch(20, donnees, {}, fields('patientAllergies', 'patientChronicDiseases', 'patientCurrentMedicine', 'patientBloodType', 'patientMental', 'patientFirstName'));
        expect(patch).toEqual({ patientAllergies: 'Pénicilline', patientChronicDiseases: 'Asthme', patientCurrentMedicine: 'Ventoline' });
    });
    test('un formulaire sans rapport avec le dossier (libération, DMEC) n’est pas touché', () => {
        expect(dossierPrefillPatch(24, donnees, {}, fields('patientAllergies'))).toEqual({});
        expect(dossierPrefillPatch(1, donnees, {}, fields('patientAllergies'))).toEqual({});
    });
});

describe('pré-remplissage des candidatures', () => {
    const identity = { firstName: 'Jean', lastName: 'Testard', dateOfBirth: '1990-05-14', gender: 'Homme', address: '1 rue', zip: '90001', phone: '555-0000', email: 'jean@mail.eyefind.fr', discord: 'jean#1' };
    test('reprend l’identité du compte et un résumé médical du dossier, sans écraser un champ rempli', () => {
        const patch = candidaturePrefillPatch(identity, { patientAllergies: 'Pénicilline', patientChronicDiseases: 'Asthme', patientTitle: 'Mr' }, { applicantPhone: 'déjà saisi' });
        expect(patch).toMatchObject({ applicantDOB: '1990-05-14', applicantEmail: 'jean@mail.eyefind.fr', oocDiscord: 'jean#1', genderMale: true });
        expect(patch.applicantTitleAndFullName).toMatch(/Jean Testard$/);
        expect(patch.applicantMedicalConditions).toBe('Allergies : Pénicilline ; Maladies chroniques : Asthme');
        expect(patch).not.toHaveProperty('applicantPhone');
        expect(patch.applicantAddress).toContain('1 rue');
    });
    test('le genre n’est pas posé si une case est déjà cochée', () => {
        expect(candidaturePrefillPatch(identity, {}, { genderFemale: true })).not.toHaveProperty('genderMale');
    });
});
