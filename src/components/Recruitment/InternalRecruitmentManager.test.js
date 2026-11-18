import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

jest.mock('../../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));
jest.mock('../../utils/lockdownGuard', () => ({ assertNotLocked: jest.fn() }));
jest.mock('../../utils/activityLog', () => ({ logActivity: jest.fn() }));
jest.mock('../../utils/notifications', () => ({ notifyUser: jest.fn(), notifyGroup: jest.fn() }));
jest.mock('../../utils/recruitmentStore', () => ({ loadApplicationsOf: jest.fn(), saveApplication: jest.fn() }));
jest.mock('../../utils/staffAdmin', () => ({ loadStaffMembers: jest.fn() }));
jest.mock('../../utils/mailTemplates', () => ({ sendTemplatedMail: jest.fn() }));
jest.mock('../Admin/adminUtils', () => ({ sendAdminActionWebhook: jest.fn() }));

let mockDebug = { debugDeleteApplicationsEnabled: false };
jest.mock('../../contexts/DebugContext', () => ({ useDebug: () => mockDebug }));
jest.mock('../../contexts/EmployeeAuthContext', () => ({ useEmployeeAuth: () => ({ currentEmployee: { uid: 'admin1', email: 'a@b.fr' }, isAdmin: true, staffName: 'Dr. Rose Callahan' }) }));

const { update, get } = require('firebase/database');
const { logActivity } = require('../../utils/activityLog');
const { deleteInternalRequest } = require('../../utils/internalRecruitment');
const InternalRecruitmentManager = require('./InternalRecruitmentManager').default;

const answer = (value) => ({ exists: () => value !== null && value !== undefined, val: () => value });
const REQUESTS = { u1: { statut: 'terminee', creeLe: 1, nom: 'Alaric Veyn', role: 'Enquêteur(trice) Médico-Légal(e)', motif: 'Je voudrais recommencer à candidater.' }, u2: { statut: 'acceptee', creeLe: 2, nom: 'Jane Doe', motif: 'Mobilité.' } };

beforeEach(() => {
    jest.clearAllMocks();
    mockDebug = { debugDeleteApplicationsEnabled: false };
    get.mockImplementation(async (reference) => (reference === 'demandesMobilite' ? answer(REQUESTS) : reference === 'statutsMobilite' ? answer({ u2: { accordeLe: 5 } }) : answer(null)));
    require('firebase/database').ref.mockImplementation((_db, path) => path);
    update.mockResolvedValue();
});

describe('Évolutions internes : suppression d\'une demande (mode debug)', () => {
    test('la suppression efface la demande ET le statut accordé en une seule écriture, et se consigne', async () => {
        await deleteInternalRequest({ uid: 'u2', nom: 'Jane Doe', statut: 'acceptee', actif: true }, { byName: 'Dr. Rose Callahan' });
        expect(update).toHaveBeenCalledWith(undefined, { 'demandesMobilite/u2': null, 'statutsMobilite/u2': null });
        expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'internal_request_deleted', severity: 'warning', target: 'Jane Doe', details: expect.stringContaining('statut de recrutement interne accordé a été retiré') }));
        await expect(deleteInternalRequest(null)).rejects.toThrow('Demande introuvable');
    });

    test('interrupteur désactivé : aucun bouton « Supprimer »', async () => {
        render(<InternalRecruitmentManager showNotification={() => {}} />);
        await waitFor(() => expect(screen.getByText(/Toutes \(2\)/)).toBeTruthy());
        fireEvent.click(screen.getByText(/Toutes \(2\)/));
        expect(screen.getByText('Alaric Veyn')).toBeTruthy();
        expect(screen.queryByText('Supprimer')).toBeNull();
    });

    test('interrupteur activé : « Supprimer » sur chaque demande, avec confirmation ; refusée, rien n\'est supprimé', async () => {
        mockDebug = { debugDeleteApplicationsEnabled: true };
        render(<InternalRecruitmentManager showNotification={() => {}} />);
        await waitFor(() => expect(screen.getByText(/Toutes \(2\)/)).toBeTruthy());
        fireEvent.click(screen.getByText(/Toutes \(2\)/));
        expect(screen.getAllByText('Supprimer')).toHaveLength(2);
        const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
        fireEvent.click(screen.getAllByText('Supprimer')[0]);
        expect(confirm).toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        // confirmée : suppression, avertissement sur le statut actif de la demande acceptée
        confirm.mockReturnValue(true);
        await act(async () => { fireEvent.click(screen.getAllByText('Supprimer')[0]); }); // liste du plus récent au plus ancien : Jane Doe (acceptée, statut actif) en premier
        expect(confirm.mock.calls[1][0]).toContain('Jane Doe');
        expect(confirm.mock.calls[1][0]).toContain('statut de recrutement interne encore actif');
        await waitFor(() => expect(update).toHaveBeenCalledWith(undefined, { 'demandesMobilite/u2': null, 'statutsMobilite/u2': null }));
        confirm.mockRestore();
    });
});
