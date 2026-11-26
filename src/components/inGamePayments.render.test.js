import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

let mockMode = 'classique';
let mockAuth = { isAdmin: false, myPatientID: 'PHMC-99999' };
let mockComptable = false;
let mockInvoices = [];
jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: { uid: 'u1', getIdToken: () => Promise.resolve('jeton') } } }));
jest.mock('../contexts/SiteConfigContext', () => ({ useSiteMode: () => ({ isClassic: mockMode === 'classique', isGtaw: mockMode !== 'classique', siteMode: mockMode }) }));
jest.mock('../contexts/EmployeeAuthContext', () => ({ useEmployeeAuth: () => mockAuth }));
jest.mock('../utils/accountingAccess', () => ({ useAccountingAccess: (isAdmin) => isAdmin || mockComptable }));
jest.mock('./FleecaPaymentPanel', () => () => <div>Panneau Fleeca</div>);
jest.mock('../utils/patientInvoices', () => {
    const actual = jest.requireActual('../utils/patientInvoices');
    return {
        ...actual,
        subscribeToPatientInvoices: (id, callback) => { callback(mockInvoices); return () => {}; },
        createInvoicePayment: () => Promise.resolve({}),
        settleInvoices: (...args) => global.mockSettle(...args),
    };
});

const SitePaymentPanel = require('./SitePaymentPanel').default;
const PatientInvoicesPanel = require('./PatientInvoicesPanel').default;
const { staffPaymentLine } = require('../utils/patientBilling');
const generateEmail = require('../phmc-bbcode-generators/generateEmail').default;

const due = (id, montant = 500) => ({ id, patientNode: 'PHMC-01234', titre: `Rapport ${id}`, montant, statut: 'a_payer', statutEffectif: 'a_payer', creeLe: 1 });

describe('paiement en jeu (version classique)', () => {
    beforeEach(() => {
        mockMode = 'classique'; mockAuth = { isAdmin: false, myPatientID: 'PHMC-99999' }; mockComptable = false; mockInvoices = [];
        global.mockSettle = jest.fn(() => Promise.resolve({ done: ['k1'], total: 500 }));
        window.confirm = () => true;
        window.prompt = () => 'Erreur de saisie';
    });

    test('formulaire rempli par le personnel : case « Réglé sur place », et paiementEnJeu suit la version', () => {
        let latest = {};
        const Harness = () => {
            const [formData, setFormData] = useState({});
            latest = formData;
            return <SitePaymentPanel staff formData={formData} setFormData={setFormData} amount={500} />;
        };
        render(<Harness />);
        expect(latest.paiementEnJeu).toBe(true);
        fireEvent.click(screen.getByLabelText(/Réglé sur place/));
        expect(latest.regleSurPlace).toBe(true);
        expect(screen.queryByText('Panneau Fleeca')).toBeNull();
    });

    test('patient qui remplit lui-même : pas de lien, indication du paiement en jeu ; version GTA World : le panneau Fleeca d’origine', () => {
        const { rerender } = render(<SitePaymentPanel formData={{}} setFormData={() => {}} amount={500} />);
        expect(screen.getByText(/en jeu/)).toBeTruthy();
        mockMode = 'gtaw';
        rerender(<SitePaymentPanel formData={{}} setFormData={() => {}} amount={500} />);
        expect(screen.getByText('Panneau Fleeca')).toBeTruthy();
    });

    test('ligne du rapport : « à régler en jeu », ou « réglés sur place »', () => {
        const formData = { paiementEnJeu: true, UpdateMedicalFile: [] };
        expect(staffPaymentLine(25, formData)).toMatch(/en jeu, auprès du personnel/);
        expect(staffPaymentLine(25, { ...formData, regleSurPlace: true })).toMatch(/réglés sur place/);
        expect(staffPaymentLine(25, {})).toMatch(/Fleeca/);
    });

    test('côté patient : ni « Payer » ni vérification Fleeca, mais l’indication du paiement en jeu', () => {
        mockInvoices = [due('k1')];
        render(<PatientInvoicesPanel patientID="PHMC-01234" />);
        expect(screen.queryByText('Payer')).toBeNull();
        expect(screen.queryByText(/vérifier/)).toBeNull();
        expect(screen.getByText(/À régler en jeu/)).toBeTruthy();
    });

    test('côté personnel : « Marquer payé » envoie l’action au serveur ; pas de dispense sans la Comptabilité', async () => {
        mockInvoices = [due('k1'), due('k2', 300)];
        render(<PatientInvoicesPanel staffMode patientID="PHMC-01234" />);
        expect(screen.queryByText('Dispenser')).toBeNull();
        await act(async () => { fireEvent.click(screen.getAllByText('Marquer payé')[0]); });
        expect(global.mockSettle).toHaveBeenCalledWith({ patientID: 'PHMC-01234', invoiceIds: ['k1'], action: 'payer', note: '' });
        await act(async () => { fireEvent.click(screen.getByText('Tout marquer payé (2 factures)')); });
        expect(global.mockSettle).toHaveBeenLastCalledWith(expect.objectContaining({ invoiceIds: ['k1', 'k2'], action: 'payer' }));
    });

    test('Comptabilité : dispenser une facture due, annuler un paiement reçu en jeu (avec motif)', async () => {
        mockComptable = true;
        mockInvoices = [due('k1'), { ...due('k2'), statut: 'paye', statutEffectif: 'paye', modePaiement: 'en_jeu', encaissePar: { nom: 'Dr. Test' }, payeLe: 2 }];
        render(<PatientInvoicesPanel staffMode patientID="PHMC-01234" />);
        expect(screen.getByText(/encaissé par Dr. Test/)).toBeTruthy();
        await act(async () => { fireEvent.click(screen.getByText('Dispenser')); });
        expect(global.mockSettle).toHaveBeenLastCalledWith({ patientID: 'PHMC-01234', invoiceIds: ['k1'], action: 'dispenser', note: 'Erreur de saisie' });
        await act(async () => { fireEvent.click(screen.getByText('Annuler le paiement')); });
        expect(global.mockSettle).toHaveBeenLastCalledWith(expect.objectContaining({ invoiceIds: ['k2'], action: 'annuler' }));
    });

    test('son propre dossier : aucun bouton de règlement', () => {
        mockAuth = { isAdmin: true, myPatientID: 'PHMC-01234' };
        mockInvoices = [due('k1')];
        render(<PatientInvoicesPanel staffMode patientID="PHMC-01234" />);
        expect(screen.queryByText('Marquer payé')).toBeNull();
        expect(screen.getByText(/un collègue doit enregistrer votre paiement/)).toBeTruthy();
    });

    test('courriel du DMEC : frais à régler en jeu, sans lien Fleeca', () => {
        const bbCode = generateEmail({ paiementEnJeu: true, autopsyPaymentLink: 'https://fleeca.example/x' });
        expect(bbCode).toMatch(/à régler en jeu/);
        expect(bbCode).not.toMatch(/Fleeca/);
    });
});
