import { dossierBbCode, mergeDossierValues } from './dossierView';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), onValue: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn() }));

const donnees = {
    patientFirstName: 'Jean', patientLastName: 'Testard', patientDateOfBirth: '1990-05-14', patientGender: 'Homme', patientBloodType: 'A+', patientAllergies: 'Pénicilline',
    patientMental: 'Anxiété', patientPH: '555-0000',
};

describe('affichage du dossier patient', () => {
    test('au format PHMC : titre du dossier, sections, pied de page, sans signature, clause ni paiement', () => {
        const text = dossierBbCode(donnees, { patientID: 'PHMC-7', patientEmail: 'jean@mail.eyefind.fr' });
        expect(text).toContain('DOSSIER MÉDICAL');
        expect(text).not.toContain('INFORMATIONS AVANCÉES');
        expect(text).toContain('PATIENT PHMC-7');
        expect(text).toContain('Jean Testard');
        expect(text).toContain('Pénicilline');
        expect(text).toContain('Historique de santé mentale');
        expect(text).not.toContain('Clause de non-responsabilité');
        expect(text).not.toContain('Paiement');
        expect(text).not.toMatch(/Signature: /);
        expect(text).toContain('Pillbox Hill Medical Center');
    });
    test('les coordonnées du profil priment sur celles du dossier (modifiables sans payer)', () => {
        expect(mergeDossierValues({ patientPH: 'ancien', patientBloodType: 'A+' }, { patientPH: 'nouveau', patientDiscord: '' })).toEqual({ patientPH: 'nouveau', patientBloodType: 'A+' });
        const text = dossierBbCode(donnees, { patientID: 'PHMC-7', patientPH: '555-9999' });
        expect(text).toContain('555-9999');
        expect(text).not.toContain('555-0000');
    });
});
