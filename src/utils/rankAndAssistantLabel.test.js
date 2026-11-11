jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));

import { signedLine } from '../phmc-bbcode-generators/shared/patientContext';
import { staffSignatureBlock } from '../phmc-bbcode-generators/shared/bbStyles';
import { getDebugTemplate } from './debugTemplates';
import { ASSISTANT_NAME, ASSISTANT_EMOJI, ASSISTANT_LABEL } from '../clinical/assistantName';

describe('grade du signataire dans les rapports', () => {
    test('les anciens grades en anglais sont imprimés en français', () => {
        expect(signedLine({ phmcEmployee: 'Dr. Adrien Valmont', phmcRank: 'Student Nurse' })).toBe('Dr. Adrien Valmont — Externe / Étudiant(e) Infirmier(ère)');
        expect(signedLine({ phmcEmployee: 'Dr. Rose Callahan', phmcRank: 'Physician' })).toBe('Dr. Rose Callahan — Médecin Titulaire');
        expect(signedLine({ phmcEmployee: 'Dr. X', phmcRank: 'Surgeon' })).toBe('Dr. X — Chirurgien(ne)');
        expect(staffSignatureBlock({ name: 'Dr. X', rank: 'Registered Nurse', service: 'Urgences' })).toContain('Infirmier(ère)');
    });
    test('un grade déjà français, personnalisé ou absent reste tel quel', () => {
        expect(signedLine({ phmcEmployee: 'Dr. Rose Callahan', phmcRank: 'Médecin Titulaire' })).toBe('Dr. Rose Callahan — Médecin Titulaire');
        expect(signedLine({ phmcEmployee: 'Dr. Y', phmcRank: 'Grade Maison' })).toBe('Dr. Y — Grade Maison');
        expect(signedLine({ phmcEmployee: 'Dr. Z' })).toBe('Dr. Z');
    });
});

describe('remplissage debug : le grade est celui de l’employé choisi', () => {
    const employee = { value: 'Dr. Adrien Valmont', label: 'Dr. Adrien Valmont', lastName: 'Valmont', rank: 'Médecin Titulaire', roles: ['Médecin Titulaire'] };
    // L'ancienne liste « phmcRank » de la base commence par « Student Nurse » : elle ne doit plus écraser le grade réel.
    const selectOptions = { phmcRank: [{ value: 'Student Nurse', label: 'Student Nurse' }, { value: 'Surgeon', label: 'Surgeon' }] };
    const ctx = { selectOptions, formData: {}, phmcOptions: [employee], coronerOptions: [], unrestrictedPhmcOptions: [employee], unrestrictedCoronerOptions: [] };

    test.each([5, 19, 20, 21])('formulaire %i : grade de l’employé, jamais « Student Nurse »', (version) => {
        const template = getDebugTemplate(version, ctx);
        expect(template.phmcEmployee).toBe('Dr. Adrien Valmont');
        expect(template.phmcRank).toBe('Médecin Titulaire');
    });

    test('sans employé disponible, le repli sur la liste de la base reste possible', () => {
        expect(getDebugTemplate(19, { ...ctx, phmcOptions: [], unrestrictedPhmcOptions: [] }).phmcRank).toBe('Student Nurse');
    });
});

describe('petit nom de l’assistant', () => {
    test('Pilou, avec son petit emoji dans les formulaires', () => {
        expect(ASSISTANT_NAME).toBe('Pilou');
        expect(ASSISTANT_EMOJI).toBe('💊');
        expect(ASSISTANT_LABEL).toBe('Pilou 💊');
    });
});
