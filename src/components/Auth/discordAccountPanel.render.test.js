import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

jest.mock('../../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/auth', () => ({ signInWithCustomToken: () => Promise.resolve({ user: { uid: 'u1' } }) }));
jest.mock('firebase/database', () => ({ ref: () => ({}), get: () => Promise.resolve({ exists: () => false }), set: () => Promise.resolve(), remove: () => Promise.resolve() }));
jest.mock('../ZipCityField', () => (props) => <input aria-label="zip" value={props.zip} onChange={(event) => props.onZipChange(event.target.value)} />);

const { DISCORD_RESULT_KEY } = require('../../utils/discordOAuth');
const DiscordAccountPanel = require('./DiscordAccountPanel').default;

const session = (characters) => ({ ticket: 'a'.repeat(48), expiresAt: Date.now() + 20 * 60 * 1000, discordUsername: 'rose', characters, flow: { type: 'onboarding' } });
const store = (value) => sessionStorage.setItem(DISCORD_RESULT_KEY, JSON.stringify(value));

describe('panneau Discord du guide (version classique)', () => {
    beforeEach(() => { sessionStorage.clear(); global.fetch = undefined; });

    test('sans retour de Discord : un seul bouton « Continuer avec Discord »', () => {
        render(<DiscordAccountPanel kind="civil" />);
        expect(screen.getByText('Continuer avec Discord')).toBeTruthy();
    });

    test('personnages du compte Discord : connexion si compte, création sinon, demande en attente signalée', () => {
        store(session([
            { id: 'p1', firstName: 'Rose', lastName: 'Callahan', patientID: 'PHMC-01234', account: { type: 'civilian', customToken: 't' }, pending: true },
            { id: 'p2', firstName: 'Max', lastName: 'Payne', patientID: 'PHMC-04321', account: null, pending: false },
        ]));
        render(<DiscordAccountPanel kind="civil" />);
        expect(screen.getByText(/Connecté avec Discord/)).toBeTruthy();
        expect(screen.getByText('Se connecter')).toBeTruthy();
        expect(screen.getByText('Créer le compte Civil')).toBeTruthy();
        expect(screen.getByText(/Demande du personnel en attente/)).toBeTruthy();
    });

    test('Personnel : demande proposée pour un personnage sans compte ou Civil, jamais s’il est déjà du personnel ou en attente', () => {
        store(session([
            { id: 'p1', firstName: 'Rose', lastName: 'Callahan', patientID: 'PHMC-1', account: { type: 'civilian', customToken: 't' }, pending: false },
            { id: 'p2', firstName: 'Max', lastName: 'Payne', patientID: 'PHMC-2', account: { type: 'phmc', customToken: 't' }, pending: false },
            { id: 'p3', firstName: 'Ana', lastName: 'Lys', patientID: 'PHMC-3', account: null, pending: true },
        ]));
        render(<DiscordAccountPanel kind="staff" rankOptions={[{ value: 'Interne', label: 'Interne', badgePrefix: 'MD' }]} />);
        expect(screen.getAllByText('Demander un compte du personnel')).toHaveLength(1);
    });

    test('création du compte Civil : le profil part avec le ticket, puis l’ID patient et l’adresse fictive s’affichent', async () => {
        store(session([{ id: 'p2', firstName: 'Max', lastName: 'Payne', patientID: 'PHMC-04321', account: null, pending: false }]));
        const calls = [];
        global.fetch = (url, options) => {
            calls.push({ url, body: JSON.parse(options.body) });
            return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ customToken: 't', patientID: 'PHMC-04321', email: 'max.payne@phmc.health' })) });
        };
        const { container } = render(<DiscordAccountPanel kind="civil" />);
        fireEvent.click(screen.getByText('Créer le compte Civil'));
        const set = (name, value) => fireEvent.change(container.querySelector(`[name="${name}"]`), { target: { value } });
        set('dateOfBirth', '1990-01-01');
        set('address', '1 rue du Port');
        set('phone', '555-0100');
        fireEvent.change(container.querySelector('select'), { target: { value: 'Male' } });
        fireEvent.change(screen.getByLabelText('zip'), { target: { value: '90001' } });
        await act(async () => { fireEvent.click(screen.getByText('Créer mon compte')); });
        expect(calls[0].url).toMatch(/discordCreateCivil$/);
        expect(calls[0].body).toMatchObject({ ticket: 'a'.repeat(48), persoId: 'p2', profile: { phone: '555-0100', discord: 'rose' } });
        expect(screen.getByDisplayValue('PHMC-04321')).toBeTruthy();
        expect(screen.getByDisplayValue('max.payne@phmc.health')).toBeTruthy();
    });

    test('grade de médecin : boutons Dr. / Pr., le titre part avec la demande ; autre grade : ni boutons ni titre', async () => {
        const { DOCTOR_RANKS } = require('../../constants/ranks');
        store(session([{ id: 'p1', firstName: 'Rose', lastName: 'Callahan', patientID: 'PHMC-1', account: null, pending: false }]));
        const calls = [];
        global.fetch = (url, options) => {
            calls.push(JSON.parse(options.body));
            return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ ok: true, persoId: 'p1', patientID: 'PHMC-1', hasCivil: false })) });
        };
        const ranks = [{ value: DOCTOR_RANKS[0], label: DOCTOR_RANKS[0], badgePrefix: 'MD' }, { value: 'Ambulancier', label: 'Ambulancier', badgePrefix: 'EMT' }];
        const { container } = render(<DiscordAccountPanel kind="staff" rankOptions={ranks} />);
        fireEvent.click(screen.getByText('Demander un compte du personnel'));
        expect(screen.queryByText('Dr.')).toBeNull();
        // Choix du grade de médecin dans la liste react-select.
        fireEvent.keyDown(container.querySelector('input[id^="react-select"]'), { key: 'ArrowDown' });
        fireEvent.click(screen.getByText(DOCTOR_RANKS[0]));
        fireEvent.click(screen.getByText('Dr.'));
        expect(screen.getByText(/Dr\. Rose Callahan/)).toBeTruthy();
        const set = (name, value) => fireEvent.change(container.querySelector(`[name="${name}"]`), { target: { value } });
        set('phNumber', '555-0100');
        fireEvent.change(screen.getByPlaceholderText('Badge : 4 ou 5 chiffres *'), { target: { value: '12345' } });
        await act(async () => { fireEvent.click(screen.getByText('Envoyer la demande')); });
        expect(calls[0]).toMatchObject({ persoId: 'p1', titlePrefix: 'Dr.', request: { badge: 'MD-12345', discord: 'rose' } });
    });

    test('ticket expiré : retour au bouton Discord', () => {
        store({ ...session([]), expiresAt: Date.now() - 1000 });
        render(<DiscordAccountPanel kind="civil" />);
        expect(screen.getByText('Continuer avec Discord')).toBeTruthy();
    });
});
