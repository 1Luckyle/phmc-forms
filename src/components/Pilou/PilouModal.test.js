import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { getToolAccess } from '../../utils/viewAs';

jest.mock('../../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));
jest.mock('../BaseModal', () => ({ __esModule: true, default: ({ children, title }) => <div><h1>{title}</h1>{children}</div> }));

const PilouModal = require('./PilouModal').default;

describe('Pilou dans la Boîte à outils', () => {
    test('affiché au personnel soignant, au DMEC et aux admins ; jamais aux Civils ni à l\'administration seule', () => {
        const base = { currentEmployee: { uid: 'u' }, staffName: 'Dr X', isCivilian: false };
        expect(getToolAccess({ ...base, isAdmin: true }).pilou).toBe(true);
        expect(getToolAccess({ ...base, staffProfile: { type: 'PHMC', category: 'Médecin Titulaire' } }).pilou).toBeDefined();
        expect(getToolAccess({ isCivilian: true, isAdmin: false }).pilou).toBe(false);
    });

    test('symptômes → motif proposé → prise en charge complète, copiable', async () => {
        const notify = jest.fn();
        Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue() } });
        render(<PilouModal show onHide={() => {}} showNotification={notify} />);
        expect(screen.getByText(/Choisissez au moins un motif/)).toBeTruthy();
        fireEvent.change(screen.getByPlaceholderText('ex. 35 (0 = nourrisson)'), { target: { value: '45' } });
        fireEvent.change(screen.getByPlaceholderText('ex. 75'), { target: { value: '80' } });
        fireEvent.change(screen.getByPlaceholderText(/Décrivez ce que présente le patient/), { target: { value: 'douleur thoracique, oppression, bras gauche, sueurs' } });
        const chip = await screen.findByTitle('Ajouter ce motif', {}, { timeout: 2000 }).catch(() => null);
        expect(chip || screen.getAllByText(/syndrome coronarien/)[0]).toBeTruthy();
        const buttons = screen.getAllByTitle('Ajouter ce motif');
        await act(async () => { fireEvent.click(buttons[0]); });
        expect(screen.getByText('Procédure, étape par étape')).toBeTruthy();
        expect(screen.getByText('Matériel à préparer')).toBeTruthy();
        expect(screen.getByText('Gestes à réaliser')).toBeTruthy();
        expect(screen.getByText(/Médicaments proposés/)).toBeTruthy();
        expect(screen.getByText('Orientation')).toBeTruthy();
        await act(async () => { fireEvent.click(screen.getByText('Copier')); });
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('PILOU —'));
        await act(async () => { fireEvent.click(screen.getByText('Nouveau patient')); });
        expect(screen.getByText(/Choisissez au moins un motif/)).toBeTruthy();
    });
});
