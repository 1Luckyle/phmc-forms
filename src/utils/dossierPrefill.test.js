import { dossierPrefillPatch } from './dossierPrefill';

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
