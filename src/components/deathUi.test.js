import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';

let mockAuth = { myPatientID: 'PHMC-1', realIsAdmin: false, logoutEmployee: () => {}, staffName: 'Dr. DMEC' };
jest.mock('../contexts/EmployeeAuthContext', () => ({ useEmployeeAuth: () => mockAuth }));
jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: { uid: 'C' } } }));
const mockListeners = {};
const mockSet = jest.fn();
jest.mock('firebase/database', () => ({
    ref: (db, path = '') => ({ path }),
    onValue: (reference, onData) => { mockListeners[reference.path] = onData; return () => { delete mockListeners[reference.path]; }; },
    set: (...args) => mockSet(...args),
    get: async () => ({ exists: () => false, val: () => null }), update: jest.fn(), remove: jest.fn(), query: jest.fn(), orderByChild: jest.fn(), equalTo: jest.fn(), push: jest.fn(),
}));
const mockNotifyGroup = jest.fn();
jest.mock('../utils/notifications', () => ({ notifyGroup: (...args) => mockNotifyGroup(...args), notifyUser: jest.fn() }));
const mockLoadSignals = jest.fn();
const mockLoadSignalsFor = jest.fn();
jest.mock('../utils/deathSignals', () => ({
    ...jest.requireActual('../utils/deathSignals'),
    loadDeathSignals: (...args) => mockLoadSignals(...args),
    loadDeathSignalsFor: (...args) => mockLoadSignalsFor(...args),
}));
const mockRegister = jest.fn();
const mockRequest = jest.fn();
const mockLoadTemp = jest.fn();
jest.mock('../utils/temporaryIds', () => ({
    ...jest.requireActual('../utils/temporaryIds'),
    loadTemporaryIds: (...args) => mockLoadTemp(...args),
    registerTemporaryId: (...args) => mockRegister(...args),
    requestRealIdAssignment: (...args) => mockRequest(...args),
}));

const DeceasedGuard = require('./DeceasedGuard').default;
const DeathSignalsModal = require('./DeathSignalsModal').default;
const DeathSignalBanner = require('./DeathSignalBanner').default;
const TemporaryIdPicker = require('../phmc-field-data/shared/TemporaryIdPicker').default;

const snap = (value) => ({ exists: () => value !== null && value !== undefined, val: () => value });
const emit = async (path, value) => { await act(async () => { mockListeners[path](snap(value)); }); };

describe('patient déclaré décédé : page à la place du site', () => {
    beforeEach(() => {
        mockAuth = { myPatientID: 'PHMC-1', realIsAdmin: false, logoutEmployee: jest.fn(), staffName: '' };
        Object.keys(mockListeners).forEach((key) => delete mockListeners[key]);
        mockSet.mockReset();
        mockNotifyGroup.mockReset();
    });
    const open = () => render(<DeceasedGuard><div>Le site</div></DeceasedGuard>);

    test('sans marqueur de décès, le site s’affiche', async () => {
        open();
        await emit('patientsDecedes/PHMC-1', null);
        expect(screen.getByText('Le site')).toBeTruthy();
    });

    test('avec le marqueur : la page indique le décès et propose de contester ; le site n’est plus accessible', async () => {
        open();
        await emit('contestationsDeces/PHMC-1', null);
        await emit('patientsDecedes/PHMC-1', { depuis: 1762819200000, uid: 'D1' });
        expect(screen.getByText('Vous avez été déclaré(e) décédé(e)')).toBeTruthy();
        expect(screen.queryByText('Le site')).toBeNull();
        expect(screen.getByText(/PHMC-1/)).toBeTruthy();
        expect(screen.getByText('Se déconnecter')).toBeTruthy();
        // Dès que l'administration lève le blocage, le site revient tout seul.
        await emit('patientsDecedes/PHMC-1', null);
        expect(screen.getByText('Le site')).toBeTruthy();
    });

    test('la contestation part aux administrateurs avec le message du patient', async () => {
        open();
        await emit('patientsDecedes/PHMC-1', { depuis: 1, uid: 'D1' });
        const send = screen.getByText('Envoyer la contestation').closest('button');
        expect(send.disabled).toBe(true);
        fireEvent.change(screen.getByPlaceholderText(/Expliquez pourquoi/), { target: { value: 'Mon personnage est vivant.' } });
        await act(async () => { fireEvent.click(screen.getByText('Envoyer la contestation')); });
        await waitFor(() => expect(mockSet).toHaveBeenCalled());
        expect(mockSet.mock.calls[0][0].path).toBe('contestationsDeces/PHMC-1');
        expect(mockSet.mock.calls[0][1]).toMatchObject({ uid: 'C', message: 'Mon personnage est vivant.', statut: 'en_attente' });
        expect(mockNotifyGroup).toHaveBeenCalledWith('admin', expect.objectContaining({ titre: 'Contestation de décès : PHMC-1', lien: { cible: 'admin', section: 'users' } }));
    });

    test('contestation en attente : pas de nouveau formulaire ; rejetée : la réponse s’affiche et une nouvelle est possible', async () => {
        open();
        await emit('patientsDecedes/PHMC-1', { depuis: 1, uid: 'D1' });
        await emit('contestationsDeces/PHMC-1', { uid: 'C', message: 'Erreur', creeLe: 2, statut: 'en_attente' });
        expect(screen.getByText(/en attente de réponse/)).toBeTruthy();
        expect(screen.queryByText('Envoyer la contestation')).toBeNull();
        await emit('contestationsDeces/PHMC-1', { uid: 'C', message: 'Erreur', creeLe: 2, statut: 'rejetee', reponse: 'Décès confirmé par le DMEC.' });
        expect(screen.getByText(/Décès confirmé par le DMEC\./)).toBeTruthy();
        expect(screen.getByText('Envoyer la contestation')).toBeTruthy();
    });

    test('le personnel est bloqué comme un Civil (ID patient de sa fiche) ; l’avis de décès levé rend le site', async () => {
        mockAuth = { myPatientID: 'PHMC-5', realIsAdmin: false, logoutEmployee: jest.fn(), staffName: 'Dr. X' };
        open();
        await emit('patientsDecedes/PHMC-5', { depuis: 1, uid: 'D1' });
        expect(screen.getByText('Vous avez été déclaré(e) décédé(e)')).toBeTruthy();
        expect(screen.queryByText('Le site')).toBeNull();
        await emit('patientsDecedes/PHMC-5', null);
        expect(screen.getByText('Le site')).toBeTruthy();
        expect(screen.queryByText('Vous avez été déclaré(e) décédé(e)')).toBeNull();
    });

    test('seuls les admins ne sont jamais enfermés hors du site (même si leur ID patient est déclaré décédé)', async () => {
        mockAuth = { myPatientID: 'PHMC-5', realIsAdmin: true, logoutEmployee: jest.fn(), staffName: 'Admin' };
        open();
        expect(Object.keys(mockListeners)).toEqual([]);
        expect(screen.getByText('Le site')).toBeTruthy();
    });

    test('un compte sans ID patient n’est pas concerné', async () => {
        mockAuth = { myPatientID: '', realIsAdmin: false, logoutEmployee: jest.fn(), staffName: '' };
        open();
        expect(Object.keys(mockListeners)).toEqual([]);
        expect(screen.getByText('Le site')).toBeTruthy();
    });

    test('une ancienne contestation acceptée n’empêche pas de contester un nouveau décès', async () => {
        open();
        await emit('patientsDecedes/PHMC-1', { depuis: 9, uid: 'D1' });
        await emit('contestationsDeces/PHMC-1', { uid: 'C', message: 'Erreur', creeLe: 2, statut: 'acceptee', reponse: 'Rétabli.' });
        expect(screen.queryByText(/Rétabli./)).toBeNull();
        expect(screen.getByText('Envoyer la contestation')).toBeTruthy();
    });
});

describe('décès signalés (DMEC)', () => {
    const signal = { key: 'sig1', patientID: 'PHMC-2752', patientName: 'Jean Testard', kind: 'urgence', date: '2026-11-11', heure: '15:12', cause: 'Polytraumatisme', nature: 'Accidental', reanimation: 'Attempted', destination: 'Coroner', par: 'Dr. Callahan', creeLe: 5, statut: 'a_traiter' };
    const done = { ...signal, key: 'sig2', patientName: 'Marie Durand', patientID: 'PHMC-3', statut: 'traite', traitePar: 'Dr. Légiste', traiteLe: 9 };

    test('la liste montre l’essentiel, sépare à traiter / traités et ouvre le rapport de décès prérempli', async () => {
        mockLoadSignals.mockResolvedValue([signal, done]);
        const onCreate = jest.fn();
        const onHide = jest.fn();
        render(<DeathSignalsModal show onHide={onHide} onCreateReport={onCreate} />);
        expect(await screen.findByText(/Jean Testard \(PHMC-2752\) — Protocole d'urgence, 11\/11\/2026 à 15:12/)).toBeTruthy();
        expect(screen.getByText('À traiter (1)')).toBeTruthy();
        expect(screen.getByText('Mort accidentelle')).toBeTruthy();
        expect(screen.getByText('DMEC (médecine légale)')).toBeTruthy();
        expect(screen.queryByText(/Marie Durand/)).toBeNull();
        fireEvent.click(screen.getByText('Créer le rapport de décès'));
        expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ key: 'sig1' }));
        expect(onHide).toHaveBeenCalled();
        fireEvent.click(screen.getByText('Traités (1)'));
        expect(screen.getByText(/Marie Durand/)).toBeTruthy();
        expect(screen.getByText(/traité par Dr\. Légiste/)).toBeTruthy();
        expect(screen.queryByText('Créer le rapport de décès')).toBeNull();
    });

    test('bandeau du dossier patient : à traiter avec le bouton du DMEC, traité sans', async () => {
        mockLoadSignalsFor.mockResolvedValue([signal, done]);
        const onCreate = jest.fn();
        render(<DeathSignalBanner patientID="PHMC-2752" onCreate={onCreate} />);
        expect(await screen.findByText(/reste à établir par le DMEC/)).toBeTruthy();
        expect(screen.getByText(/Rapport de décès établi par Dr\. Légiste/)).toBeTruthy();
        expect(screen.getAllByText('Créer le rapport de décès')).toHaveLength(1);
        fireEvent.click(screen.getByText('Créer le rapport de décès'));
        expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ key: 'sig1' }));
        mockLoadSignalsFor.mockResolvedValue([]);
        const { container } = render(<DeathSignalBanner patientID="PHMC-9" />);
        await waitFor(() => expect(container.textContent).toBe(''));
    });
});

describe('ID temporaire dans les formulaires du DMEC', () => {
    const Harness = ({ initial }) => {
        const [formData, setFormData] = React.useState(initial);
        return (<><TemporaryIdPicker formData={formData} setFormData={setFormData} /><pre data-testid="state">{JSON.stringify(formData)}</pre></>);
    };
    const stateOf = () => JSON.parse(screen.getByTestId('state').textContent);
    beforeEach(() => {
        mockAuth = { isCivilian: false, civilianProfile: null, staffName: 'Dr. Légiste' };
        mockRegister.mockReset();
        mockRequest.mockReset();
        mockLoadTemp.mockReset();
        mockLoadTemp.mockResolvedValue({ 'TMP-ABCDE': { nom: 'Jean Dupont', creeLe: 1, statut: 'temporaire' }, 'TMP-FGHJK': { nom: 'Marie Durand', creeLe: 2, statut: 'temporaire' } });
    });

    test('sans ID : génération d’un ID temporaire, qui prend la place de l’ID patient', async () => {
        mockRegister.mockResolvedValue('TMP-NEWID');
        render(<Harness initial={{ patientID: '', decedentFirstName: 'Paul', decedentLastName: 'Martin' }} />);
        await act(async () => { fireEvent.click(screen.getByText(/générer un ID temporaire/)); });
        expect(mockRegister).toHaveBeenCalledWith({ nom: 'Paul Martin', byName: 'Dr. Légiste' });
        expect(stateOf().patientID).toBe('TMP-NEWID');
        expect(await screen.findByText('ID temporaire TMP-NEWID')).toBeTruthy();
    });

    test('un ID temporaire déjà créé pour le même nom est proposé pour relier les rapports', async () => {
        render(<Harness initial={{ patientID: '', decedentName: 'Dupont Jean' }} />);
        const reuse = await screen.findByText(/TMP-ABCDE · Jean Dupont/);
        expect(screen.queryByText(/TMP-FGHJK/)).toBeNull();
        await act(async () => { fireEvent.click(reuse); });
        expect(stateOf().patientID).toBe('TMP-ABCDE');
    });

    test('avec un ID temporaire : demande d’attribution de l’ID réel aux administrateurs ; avec un ID réel : rien', async () => {
        mockRequest.mockResolvedValue(true);
        const { container, unmount } = render(<Harness initial={{ patientID: 'tmp-abcde' }} />);
        const ask = screen.getByText("Demander l'attribution aux administrateurs").closest('button');
        expect(ask.disabled).toBe(true);
        fireEvent.change(screen.getByPlaceholderText(/ID réel/), { target: { value: '2752' } });
        await act(async () => { fireEvent.click(screen.getByText("Demander l'attribution aux administrateurs")); });
        expect(mockRequest).toHaveBeenCalledWith({ tempId: 'TMP-ABCDE', realId: '2752', byName: 'Dr. Légiste' });
        expect(await screen.findByText('Demande envoyée')).toBeTruthy();
        fireEvent.click(screen.getByText("Retirer l'ID temporaire"));
        expect(stateOf().patientID).toBe('');
        unmount();
        const real = render(<Harness initial={{ patientID: 'PHMC-2752' }} />);
        expect(real.container.querySelector('button')).toBeNull();
        expect(container).toBeTruthy();
    });
});
