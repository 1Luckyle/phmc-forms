import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { isAdministrativeMember } from '../../utils/interviews';

jest.mock('../../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), push: jest.fn(), set: jest.fn() }));

let mockMembers = [];
let resolveMembers;
jest.mock('../../utils/staffAdmin', () => ({
    loadStaffMembers: () => new Promise((resolve) => { resolveMembers = () => resolve(mockMembers); }),
    rankLabel: (service, rank) => rank,
}));

const InterviewModal = require('./InterviewModal').default;

const application = { id: 'a1', nomCandidat: 'Jean Testard', poste: 'Chirurgien Résident' };
const DIRECTRICE_SECONDAIRE = { name: 'Dr. Rose Callahan', displayName: 'Dr. Rose Callahan', service: 'phmc', rank: 'Médecin Titulaire', extraRanks: ['Directeur(trice)'] };
const MEDECIN = { name: 'Dr. Edmund Messina', displayName: 'Dr. Edmund Messina', service: 'coroner', rank: 'Médecin légiste' };

describe('rôles secondaires et décharge d\'entretien', () => {
    test('isAdministrativeMember : rôle principal ou rôle secondaire (liste ou objet)', () => {
        expect(isAdministrativeMember({ rank: 'Directeur(trice)' })).toBe(true);
        expect(isAdministrativeMember({ rank: 'Médecin Titulaire', extraRanks: ['Directeur(trice)'] })).toBe(true);
        expect(isAdministrativeMember({ rank: 'Médecin Titulaire', extraRanks: { 0: 'Assistant(e) de Direction' } })).toBe(true);
        expect(isAdministrativeMember({ rank: 'Médecin Titulaire', extraRanks: ['Chef de Service'] })).toBe(false);
        expect(isAdministrativeMember({ rank: 'Médecin Titulaire' })).toBe(false);
        expect(isAdministrativeMember(null)).toBe(false);
    });

    test('une Directrice en rôle SECONDAIRE n\'a pas de décharge à signer, même si la liste du personnel arrive après l\'ouverture', async () => {
        mockMembers = [DIRECTRICE_SECONDAIRE, MEDECIN];
        render(<InterviewModal show onHide={() => {}} application={application} interview={null} actor={{ name: 'Dr. Rose Callahan', uid: 'u1' }} onSubmit={() => Promise.resolve()} />);
        // Liste pas encore chargée : rien ne prouve encore sa fonction.
        expect(screen.getByText(/Aucun personnel administratif n'est prévu : décharge à signer/)).toBeTruthy();
        await act(async () => { resolveMembers(); });
        await waitFor(() => expect(screen.queryByText(/Aucun personnel administratif n'est prévu/)).toBeNull());
        expect(screen.getByText(/Du personnel administratif est prévu à l'entretien/)).toBeTruthy();
    });

    test('les rôles connus de la session servent de repli, avant même le chargement de la liste', () => {
        mockMembers = [];
        render(<InterviewModal show onHide={() => {}} application={application} interview={null} actor={{ name: 'Dr. Rose Callahan', uid: 'u1', administrative: true }} onSubmit={() => Promise.resolve()} />);
        expect(screen.queryByText(/Aucun personnel administratif n'est prévu/)).toBeNull();
        expect(screen.getByText(/Du personnel administratif est prévu à l'entretien/)).toBeTruthy();
    });

    test('sans rôle administratif (ni principal ni secondaire) : la décharge reste demandée', async () => {
        mockMembers = [{ ...DIRECTRICE_SECONDAIRE, extraRanks: [] }, MEDECIN];
        render(<InterviewModal show onHide={() => {}} application={application} interview={null} actor={{ name: 'Dr. Rose Callahan', uid: 'u1' }} onSubmit={() => Promise.resolve()} />);
        await act(async () => { resolveMembers(); });
        expect(screen.getByText(/Aucun personnel administratif n'est prévu : décharge à signer/)).toBeTruthy();
    });

    test('modification d\'un entretien : une personne administrative déjà présente dispense de décharge dès le chargement de la liste', async () => {
        mockMembers = [{ name: 'Dr. Rose Callahan', displayName: 'Dr. Rose Callahan', service: 'phmc', rank: 'Médecin Titulaire', extraRanks: ['Assistant(e) de Direction'] }, MEDECIN];
        const interview = { date: '2026-11-20T10:00:00.000Z', recruteur: { nom: 'Dr. Edmund Messina' }, presents: [{ nom: 'Dr. Rose Callahan' }] };
        render(<InterviewModal show onHide={() => {}} application={application} interview={interview} actor={{ name: 'Dr. Edmund Messina', uid: 'u2' }} onSubmit={() => Promise.resolve()} />);
        expect(screen.getByText(/Aucun personnel administratif n'est prévu : décharge à signer/)).toBeTruthy();
        await act(async () => { resolveMembers(); });
        await waitFor(() => expect(screen.getByText(/Du personnel administratif est prévu à l'entretien/)).toBeTruthy());
    });
});
