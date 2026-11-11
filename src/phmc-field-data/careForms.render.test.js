// Formulaires du personnel soignant : en-tête commun, équipe chirurgicale, certificats, mail externe. Rendu réel (jsdom) avec une identité simulée : repère les erreurs d'exécution
// (effets, listes verrouillées, bandeaux) que la compilation ne voit pas.
import React, { useState } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

let mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null };
jest.mock('../contexts/EmployeeAuthContext', () => ({ useEmployeeAuth: () => mockAuth }));
jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn() }));
let mockDossier = { status: 'missing', donnees: null };
jest.mock('../utils/dossierLookup', () => ({ usePatientDossier: () => mockDossier, lookupDossier: jest.fn(), isLookupId: () => true }));
jest.mock('../components/Messaging/RichMessageEditor', () => {
    const React = require('react');
    return React.forwardRef(() => <div data-testid="rich-editor" />);
});
jest.mock('../utils/staffAdmin', () => ({ loadStaffMembers: jest.fn() }));
jest.mock('../utils/notifications', () => ({ notifyUser: jest.fn() }));

const Surgical = require('./Surgical').default;
const SicknessEmail = require('./SicknessEmail').default;
const FlightCertificate = require('./FlightCertificate').default;
const ExternalMail = require('./ExternalMail').default;
const FormChecklist = require('../components/FormChecklist').default;
const PhysEval = require('./PhysEvalPHMC').default;

const careOption = (name, roles) => ({ value: name, label: name, rank: roles[0], roles, families: ['soignant'], lastName: name.split(' ').pop() });
const phmcGroups = [{ label: 'Interne en Médecine', options: [careOption('Dr. Interne', ['Interne en Médecine'])] }];
const unrestricted = [
    { label: 'Chirurgien(ne)', options: [careOption('Dr. Surgeon', ['Chirurgien(ne)'])] },
    { label: 'Administration', options: [{ value: 'M. Admin', label: 'M. Admin', families: ['administration'] }] },
];

const Harness = ({ Component, initial = {}, extra = {} }) => {
    const [formData, setFormData] = useState(initial);
    const handleChange = (event) => setFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    return (
        <>
            <Component formData={formData} setFormData={setFormData} handleChange={handleChange} phmcGroupedOptions={phmcGroups} unrestrictedPhmcGroupedOptions={unrestricted}
                patientConsent={[]} complications={[]} procedureGood={[]} phmcRank={[]} BodyMassIndex={[]} temperature={[]} heartRate={[]} breathing={[]} bloodPressure={[]}
                patientJob={[]} patientJobRisks={[]} patientAllergiesRisk={[]} patientMedicineRegular={[]} patientOther={[]} predisposition={[]} handleSelectChange={() => {}} {...extra} />
            <pre data-testid="state">{JSON.stringify(formData)}</pre>
        </>
    );
};
const stateOf = () => JSON.parse(screen.getByTestId('state').textContent);

describe('en-tête commun des formulaires de soins', () => {
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'missing', donnees: null }; });

    test('évaluation physique : nom en trois champs, date non passée, employé verrouillé, plus de « Fonction »', async () => {
        render(<Harness Component={PhysEval} />);
        expect(screen.getByPlaceholderText('Prénom du patient')).toBeTruthy();
        expect(screen.getByPlaceholderText('Deuxième prénom')).toBeTruthy();
        expect(screen.getByPlaceholderText('Nom de famille')).toBeTruthy();
        expect(screen.queryByText('Fonction au sein du PHMC')).toBeNull();
        const date = screen.getByLabelText ? document.querySelector('input[name="date"]') : null;
        expect(date.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        await waitFor(() => expect(stateOf().phmcEmployee).toBe('Dr. Interne'));
        expect(stateOf().phmcRank).toBe('Interne en Médecine');
        // un patient sans dossier : encadré d'invitation
        expect(screen.getByText(/n'a pas encore de/)).toBeTruthy();
    });

    test("le patient avec dossier : mention « reprises du dossier »", () => {
        mockDossier = { status: 'found', donnees: {} };
        render(<Harness Component={PhysEval} />);
        expect(screen.getByText(/Informations reprises du dossier du patient/)).toBeTruthy();
    });

    test('la date de naissance donne l\'âge automatiquement', async () => {
        render(<Harness Component={PhysEval} initial={{ patientDateOfBirth: '1990-05-14', date: '2026-11-11' }} />);
        await waitFor(() => expect(stateOf().patientAgeYears).toBe('36'));
    });
});

describe('opération chirurgicale', () => {
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });

    test('un signataire non chirurgien rejoint le personnel présent et choisit le chirurgien', async () => {
        render(<Harness Component={Surgical} />);
        await waitFor(() => expect(stateOf().phmcEmployee).toBe('Dr. Interne'));
        await waitFor(() => expect(stateOf().extraStaff).toEqual(['Dr. Interne']));
        expect(screen.getByText(/Vous n'êtes pas chirurgien/)).toBeTruthy();
        expect(stateOf().surgeonEmployee || '').toBe('');
    });

    test('un signataire chirurgien est le chirurgien principal', async () => {
        const surgeons = [{ label: 'Chirurgien(ne)', options: [careOption('Dr. Surgeon', ['Chirurgien(ne)'])] }];
        mockAuth = { ...mockAuth, staffName: 'Dr. Surgeon' };
        const Wrapped = (props) => <Surgical {...props} phmcGroupedOptions={surgeons} />;
        render(<Harness Component={Wrapped} />);
        await waitFor(() => expect(stateOf().surgeonEmployee).toBe('Dr. Surgeon'));
        expect(screen.getByText(/Vous êtes chirurgien/)).toBeTruthy();
    });
});

describe('certificats et mail externe', () => {
    test('certificat de maladie : les champs suivent le type de courrier', () => {
        render(<Harness Component={SicknessEmail} initial={{ emailPurpose: 'Work Stoppage', sicknessStartDate: '2026-11-10', sicknessEndDate: '2026-11-12' }} />);
        expect(screen.getByText(/ITT calculée/)).toBeTruthy();
        expect(screen.getByText('3 jours')).toBeTruthy();
        expect(screen.getByText('Sorties')).toBeTruthy();
    });

    test('certificat de vol : plus d\'image de signature', () => {
        render(<Harness Component={FlightCertificate} />);
        expect(screen.queryByText('Image de signature')).toBeNull();
        expect(screen.getByText(/Identifiants de l'employé/)).toBeTruthy();
    });

    test('mail externe : objet, destinataire, expéditeur, éditeur', () => {
        render(<Harness Component={ExternalMail} />);
        expect(screen.getByText('Objet')).toBeTruthy();
        expect(screen.getByText(/Destinataire \(personne ou organisation\)/)).toBeTruthy();
        expect(screen.getByTestId('rich-editor')).toBeTruthy();
    });

    test('bandeau « À compléter avant d\'enregistrer »', () => {
        const { container } = render(<FormChecklist version={41} formData={{}} />);
        expect(container.textContent).toContain("À compléter avant d'enregistrer");
        expect(container.textContent).toContain('Choisissez la classe du certificat.');
    });

    test('bandeau vide quand tout est renseigné', async () => {
        await act(async () => {});
        const { container } = render(<FormChecklist version={42} formData={{ externalMailSubject: 'Objet', externalMailRecipient: 'X', externalMailBody: 'Texte' }} />);
        expect(container.textContent).toBe('');
    });
});
