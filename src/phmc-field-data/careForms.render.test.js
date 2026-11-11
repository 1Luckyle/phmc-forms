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
jest.mock('../hooks/useTitleOptions', () => ({ __esModule: true, default: () => [{ value: 'Mr', label: 'M.' }] }));

const Surgical = require('./Surgical').default;
const SicknessEmail = require('./SicknessEmail').default;
const FlightCertificate = require('./FlightCertificate').default;
const ExternalMail = require('./ExternalMail').default;
const FormChecklist = require('../components/FormChecklist').default;
const PhysEval = require('./PhysEvalPHMC').default;
const MentalHealth = require('./MentalHealth').default;
const EmergencyForm = require('./EmergencyForm').default;
const GeneralConsult = require('./GeneralConsult').default;

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

describe('champs ajoutés aux formulaires de soins', () => {
    const allProps = { admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], assignedDepartment: [], departmentLarge: [], Imaging: [], Appearance: [], Behavior: [], Speech: [], Mood: [], Affect: [], ThoughtProcess: [], ThoughtContent: [], Insight: [], Cognition: [], Risk: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] };
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });

    test("l'en-tête commun propose l'heure, le motif d'adressage, le médecin adressant et l'accompagnant", () => {
        render(<Harness Component={PhysEval} extra={allProps} />);
        expect(document.querySelector('input[name="appointmentTime"]')).toBeTruthy();
        expect(screen.getByText("Motif d'adressage")).toBeTruthy();
        expect(screen.getByText('Médecin adressant (facultatif)')).toBeTruthy();
        expect(document.querySelector('input[name="companionName"]')).toBeTruthy();
        expect(document.querySelector('select[name="referralReason"]').textContent).toContain('Adressé par les secours (EMS / 911)');
    });

    test("évaluation physique : conclusion d'aptitude, durée de validité par défaut, restrictions", async () => {
        render(<Harness Component={PhysEval} initial={{ aptitudeConclusion: 'Apte avec restrictions', date: '2026-11-11' }} extra={allProps} />);
        await waitFor(() => expect(stateOf().aptitudeValidityMonths).toBe('12'));
        expect(screen.getByText("Valable jusqu'au 11/11/2027.")).toBeTruthy();
        expect(document.querySelector('textarea[name="aptitudeRestrictions"]')).toBeTruthy();
    });

    test("psychiatrie : risque, conduite à tenir, contrainte et contact d'urgence du dossier", () => {
        mockDossier = { status: 'found', donnees: { patientEmergencyContactFirstName: 'Marie', patientEmergencyContactNumber: '555-0199' } };
        render(<Harness Component={MentalHealth} initial={{ patientID: 'PHMC-2752', patientEmergencyContactFirstName: 'Marie', patientEmergencyContactNumber: '555-0200' }} extra={allProps} />);
        expect(screen.getByText('Risque suicidaire')).toBeTruthy();
        expect(screen.getAllByText('Hospitalisation sous contrainte').length).toBeGreaterThan(0);
        expect(screen.getByText(/dossier du patient sera mis à jour/)).toBeTruthy();
    });

    test("urgences : temps de prise en charge calculé, orientation de sortie, soins systématiques", () => {
        render(<Harness Component={EmergencyForm} initial={{ careStartTime: '23:30', careEndTime: '00:15', dischargeDestination: 'Transfer' }} extra={allProps} />);
        expect(screen.getByDisplayValue('45 min')).toBeTruthy();
        expect(screen.getByText('Orientation de sortie')).toBeTruthy();
        expect(screen.getByText('Établissement de transfert')).toBeTruthy();
        expect(document.querySelector('select[name="arrivalMode"]').textContent).toContain('Hélicoptère');
    });

    test("consultation générale : arrêt de travail avec bouton de préremplissage du certificat", () => {
        const onPrefillSickLeave = jest.fn();
        render(<Harness Component={GeneralConsult} initial={{ workStoppage: 'Yes', workStoppageDays: '3' }} extra={{ ...allProps, onPrefillSickLeave }} />);
        expect(screen.getByText('Service orienté après consultation')).toBeTruthy();
        const button = screen.getByText('Préremplir le Certificat de Maladie');
        act(() => { button.click(); });
        expect(onPrefillSickLeave).toHaveBeenCalled();
    });

    test('fond médical corrigé par rapport au dossier : mention affichée et mémorisée', async () => {
        mockDossier = { status: 'found', donnees: { patientAllergies: 'Pénicilline' } };
        render(<Harness Component={GeneralConsult} initial={{ patientID: 'PHMC-2752', patientAllergies: 'Pénicilline, latex' }} extra={allProps} />);
        await waitFor(() => expect(stateOf().patientBackgroundUpdated).toEqual(['allergies']));
        expect(screen.getByText(/mis à jour lors de cette consultation/)).toBeTruthy();
    });
});

describe("assistant clinique du protocole d'urgence", () => {
    const props = { admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] };
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });
    const patient = { patientAgeYears: '35', patientSex: 'Male', patientWeight: '75', patientHeight: '178', clinicalConditions: ['fracture_fermee'], clinicalSeverity: 'Moderate', patientID: 'PHMC-2752', date: '2026-11-11' };

    test('sans motif : poids, taille, gravité et liste de médicaments, aucune suggestion', () => {
        render(<Harness Component={EmergencyForm} initial={{ patientAgeYears: '35' }} extra={props} />);
        expect(screen.getByText('Assistant clinique')).toBeTruthy();
        expect(document.querySelector('input[name="patientWeight"]')).toBeTruthy();
        expect(screen.queryByText('Tout appliquer')).toBeNull();
        expect(screen.getByText('Médicaments administrés ou prescrits')).toBeTruthy();
    });

    test('un motif propose des suggestions, appliquées seulement au clic, sans écraser un champ rempli', async () => {
        render(<Harness Component={EmergencyForm} initial={{ ...patient, patientDiagnosis: 'Diagnostic du soignant' }} extra={props} />);
        expect(screen.getByText(/Suggestions/)).toBeTruthy();
        expect(stateOf().heartRateValue).toBeUndefined();
        await act(async () => { screen.getByText('Tout appliquer').click(); });
        const state = stateOf();
        expect(state.patientDiagnosis).toBe('Diagnostic du soignant');
        expect(state.patientChiefComplaint).toMatch(/impotence/);
        expect(Number(state.heartRateValue)).toBeGreaterThan(40);
        expect(state.bloodPressureValue).toMatch(/^\d{2,3}\/\d{2,3}$/);
        expect(state.painLevel).toBe('patientMildPain');
        expect(state.Imaging).toEqual(['XRay']);
        expect(state.clinicalMeds.map((m) => m.medId)).toEqual(['paracetamol', 'ketoprofene']);
        expect(state.clinicalMeds[0]).toMatchObject({ regimenId: 'po', dose: 1000 });
    });

    test('« Remplacer » écrase les champs déjà saisis', async () => {
        render(<Harness Component={EmergencyForm} initial={{ ...patient, patientDiagnosis: 'Ancien' }} extra={props} />);
        await act(async () => { screen.getByLabelText(/Remplacer ce qui est déjà saisi/).click(); });
        await act(async () => { screen.getByText('Diagnostic', { selector: 'button' }).click(); });
        expect(stateOf().patientDiagnosis).toMatch(/Fracture fermée/);
    });

    test("allergie : le médicament concerné n'est pas proposé et la raison s'affiche", async () => {
        render(<Harness Component={EmergencyForm} initial={{ ...patient, patientAllergies: 'Allergique aux AINS' }} extra={props} />);
        expect(screen.getByText(/Non proposés/).textContent).toMatch(/Kétoprofène.*Allergie/);
        await act(async () => { screen.getByText('Médicaments', { selector: 'button' }).click(); });
        expect(stateOf().clinicalMeds.map((m) => m.medId)).toEqual(['paracetamol']);
    });

    test('alertes en direct sur une dose trop forte, sans bloquer', () => {
        const meds = [{ medId: 'paracetamol', regimenId: 'po', dose: 2000, count: 1, note: '' }];
        render(<Harness Component={EmergencyForm} initial={{ ...patient, clinicalConditions: [], clinicalMeds: meds }} extra={props} />);
        expect(screen.getByText(/Dose maximale d'une prise dépassée/)).toBeTruthy();
        expect(screen.getByText('Paracétamol')).toBeTruthy();
        const { container } = render(<FormChecklist version={19} formData={{ ...patient, clinicalMeds: meds }} />);
        expect(container.textContent).toContain("Dose maximale d'une prise dépassée");
    });

    test('enfant sans poids : rappel', () => {
        render(<Harness Component={EmergencyForm} initial={{ patientAgeYears: '6' }} extra={props} />);
        expect(screen.getByText(/moins de 15 ans/)).toBeTruthy();
    });
});
