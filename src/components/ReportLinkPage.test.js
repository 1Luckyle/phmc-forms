import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

let mockAuth = { isLoading: false, currentEmployee: { uid: 'u1' }, civilianProfile: null };
jest.mock('../contexts/EmployeeAuthContext', () => ({ useEmployeeAuth: () => mockAuth }));
jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
const mockGet = jest.fn();
jest.mock('firebase/database', () => ({ ref: (db, path) => ({ path }), get: (...args) => mockGet(...args), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));

const ReportLinkPage = require('./ReportLinkPage').default;
const { peekPendingReportLink, clearPendingReportLink } = require('../utils/reportLinks');

const open = (url = '/rapport/Dr_Test/-Nabc') => render(
    <MemoryRouter initialEntries={[url]}>
        <Routes>
            <Route path="/rapport/:node/:key" element={<ReportLinkPage />} />
            <Route path="/" element={<div>Accueil du site</div>} />
        </Routes>
    </MemoryRouter>,
);
const snapshot = (value) => ({ exists: () => value !== null && value !== undefined, val: () => value });

describe('page ouverte par un lien direct vers un rapport', () => {
    beforeEach(() => { mockAuth = { isLoading: false, currentEmployee: { uid: 'u1' }, civilianProfile: null }; mockGet.mockReset(); clearPendingReportLink(); });

    test('un rapport accessible s\'affiche avec son titre, son auteur et ses actions', async () => {
        mockGet.mockResolvedValue(snapshot({ title: '[PHMC-1] Protocole d\'Urgence - 11/11/2026', bbCode: '[b]Rapport[/b]', creatorName: 'Dr. Test', timestamp: 1762819200000 }));
        open();
        expect(await screen.findByText("[PHMC-1] Protocole d'Urgence - 11/11/2026")).toBeTruthy();
        expect(mockGet.mock.calls[0][0].path).toBe('savedReports/Dr_Test/-Nabc');
        expect(screen.getByText('Copier le lien')).toBeTruthy();
        expect(screen.getByText(/Dr\. Test/)).toBeTruthy();
    });

    test("sans accès, la base refuse la lecture : un message clair l'indique", async () => {
        mockGet.mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' }));
        open();
        expect(await screen.findByText("Vous n'avez pas accès à ce rapport")).toBeTruthy();
    });

    test('rapport supprimé ou retiré par son auteur : introuvable', async () => {
        mockGet.mockResolvedValue(snapshot(null));
        open();
        expect(await screen.findByText('Rapport introuvable')).toBeTruthy();
        mockGet.mockResolvedValue(snapshot({ title: 'x', bbCode: 'x', ownerDeleted: true }));
        open('/rapport/Dr_Test/-Nxyz');
        await waitFor(() => expect(screen.getAllByText('Rapport introuvable').length).toBe(2));
    });

    test('non connecté : invitation à se connecter, le lien est retenu pour y revenir après la connexion, rien n\'est lu', async () => {
        mockAuth = { isLoading: false, currentEmployee: null, civilianProfile: null };
        open('/rapport/Dr_Test/-Nabc');
        expect(await screen.findByText('Connexion requise')).toBeTruthy();
        expect(screen.getByText('Se connecter')).toBeTruthy();
        expect(peekPendingReportLink()).toBe('/rapport/Dr_Test/-Nabc');
        expect(mockGet).not.toHaveBeenCalled();
    });

    test("pendant le chargement du compte, rien n'est décidé ni lu", () => {
        mockAuth = { isLoading: true, currentEmployee: null, civilianProfile: null };
        open();
        expect(screen.getByText('Ouverture du rapport…')).toBeTruthy();
        expect(mockGet).not.toHaveBeenCalled();
        expect(peekPendingReportLink()).toBe('');
    });

    test('un lien qui ne désigne aucun rapport valide est refusé sans lire la base', async () => {
        open('/rapport/a.b/c');
        expect(await screen.findByText('Lien invalide')).toBeTruthy();
        expect(mockGet).not.toHaveBeenCalled();
    });
});
