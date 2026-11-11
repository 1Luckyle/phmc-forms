jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));
jest.mock('../contexts/EmployeeAuthContext', () => ({ useEmployeeAuth: () => ({ staffName: '', isAdmin: false }) }));

import { phmcOptionOf } from './staffOptions';
import { careStaffOnly } from '../phmc-field-data/shared/PhmcEmployeeSelect';

// Fiches du personnel telles que la base les porte : le rôle principal est la catégorie, les autres rôles sont cumulés (extraRanks).
const rose = { name: 'Dr. Rose Callahan', category: 'Médecin Titulaire', rank: 'Médecin Titulaire', lastName: 'Callahan', extraRanks: ['Directeur(trice)', 'Chirurgien(ne)'] };
const adrien = { name: 'Dr. Adrien Valmont', category: 'Médecin Titulaire', lastName: 'Valmont' };
const paul = { name: 'Paul Martin', category: 'Chirurgien(ne)', lastName: 'Martin' };
const admin = { name: 'Anne Direction', category: 'Directeur(trice)', lastName: 'Direction' };

describe('option du personnel PHMC (sélecteurs)', () => {
    test('porte les rôles — principal et cumulés — le grade, les familles et le nom', () => {
        const option = phmcOptionOf(rose);
        expect(option).toMatchObject({ value: 'Dr. Rose Callahan', label: 'Dr. Rose Callahan', category: 'Médecin Titulaire', rank: 'Médecin Titulaire', lastName: 'Callahan' });
        expect(option.roles).toEqual(['Médecin Titulaire', 'Directeur(trice)', 'Chirurgien(ne)']);
        expect(option.families).toContain('soignant');
    });

    test('un chirurgien peut l’être par son rôle principal ou par un rôle cumulé ; un médecin seul ne l’est pas', () => {
        expect(phmcOptionOf(paul).roles).toContain('Chirurgien(ne)');
        expect(phmcOptionOf(rose).roles).toContain('Chirurgien(ne)');
        expect(phmcOptionOf(adrien).roles).not.toContain('Chirurgien(ne)');
        expect(phmcOptionOf(adrien).rank).toBe('Médecin Titulaire');
    });

    test('le sélecteur du chirurgien principal retrouve les chirurgiens dans la liste NON restreinte construite ainsi', () => {
        const groups = [{ label: 'Médecin Titulaire', options: [rose, adrien].map(phmcOptionOf) }, { label: 'Chirurgien(ne)', options: [phmcOptionOf(paul)] }, { label: 'Direction', options: [phmcOptionOf(admin)] }];
        const surgeons = careStaffOnly(groups)
            .map((group) => ({ ...group, options: group.options.filter((option) => Array.isArray(option.roles) && option.roles.includes('Chirurgien(ne)')) }))
            .filter((group) => group.options.length > 0);
        expect(surgeons.flatMap((group) => group.options.map((option) => option.value))).toEqual(['Dr. Rose Callahan', 'Paul Martin']);
    });
});
