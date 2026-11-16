import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { getToolAccess } from '../../utils/viewAs';

jest.mock('../../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));
jest.mock('../BaseModal', () => ({ __esModule: true, default: ({ children, title }) => <div><h1>{title}</h1>{children}</div> }));

const PilouModal = require('./PilouModal').default;

const pick = (name, value) => fireEvent.change(document.querySelector(`select[name="${name}"]`), { target: { value } });

describe('Pilou dans la Boîte à outils', () => {
    test('affiché aux soignants et aux admins seulement : ni Civils, ni DMEC, ni administration', () => {
        const base = { currentEmployee: { uid: 'u' }, staffName: 'Dr X', isCivilian: false };
        expect(getToolAccess({ ...base, isAdmin: true }).pilou).toBe(true);
        expect(getToolAccess({ ...base, staffProfile: { type: 'PHMC', category: 'Médecin Titulaire' } }).pilou).toBe(true);
        expect(getToolAccess({ ...base, staffProfile: { type: 'coroner', category: 'Médecin légiste' } }).pilou).toBe(false);
        expect(getToolAccess({ isCivilian: true, isAdmin: false }).pilou).toBe(false);
    });

    test('tout est à choisir : listes obligatoires (rouge) et facultatives (bleu), aucune saisie libre', () => {
        render(<PilouModal show onHide={() => {}} />);
        expect(document.querySelector('[data-guide-zone]')).toBeTruthy();
        ['pilouAge', 'pilouSexe', 'pilouPoids', 'pilouTaille', 'pilouGravite'].forEach((name) => expect(document.querySelector(`select[name="${name}"]`).required).toBe(true));
        expect(document.querySelector('input[type="text"]:not([role]):not([id^="react-select"])')).toBeNull();
        expect(document.querySelector('input[type="number"]')).toBeNull();
        expect(document.querySelector('textarea')).toBeNull();
        expect(screen.getByText('Obligatoire')).toBeTruthy();
        expect(screen.getByText('Facultatif')).toBeTruthy();
        expect(screen.getByText(/Il manque : l'âge, le sexe, le poids, la taille, au moins un motif/)).toBeTruthy();
    });

    test('champs obligatoires remplis + motif choisi → prise en charge complète, copiable', async () => {
        const notify = jest.fn();
        Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue() } });
        render(<PilouModal show onHide={() => {}} showNotification={notify} />);
        pick('pilouAge', '45'); pick('pilouSexe', 'Male'); pick('pilouPoids', '80'); pick('pilouTaille', '175');
        expect(screen.queryByText('Procédure, étape par étape')).toBeNull();
        expect(screen.getByText(/Il manque : au moins un motif/)).toBeTruthy();
        await act(async () => { fireEvent.keyDown(screen.getByText(/Choisir dans la liste \(plusieurs choix possibles\)/), { key: 'ArrowDown', keyCode: 40 }); });
        await act(async () => { fireEvent.click(screen.getByText('Douleur thoracique / syndrome coronarien')); });
        expect(screen.getByText('Procédure, étape par étape')).toBeTruthy();
        expect(screen.getByText('Matériel à préparer')).toBeTruthy();
        expect(screen.getByText('Gestes à réaliser')).toBeTruthy();
        expect(screen.getByText(/Médicaments proposés/)).toBeTruthy();
        expect(screen.getByText('Orientation')).toBeTruthy();
        await act(async () => { fireEvent.click(screen.getByText('Copier')); });
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('PILOU —'));
        await act(async () => { fireEvent.click(screen.getByText('Nouveau patient')); });
        expect(screen.getByText(/Il manque : l'âge/)).toBeTruthy();
    });
});
