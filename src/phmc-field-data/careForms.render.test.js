// Formulaires du personnel soignant : en-tête commun, équipe chirurgicale, certificats, mail externe. Rendu réel (jsdom) avec une identité simulée : repère les erreurs d'exécution
// (effets, listes verrouillées, bandeaux) que la compilation ne voit pas.
import React, { useState } from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';

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
const Shrink = require('./Shrink').default;

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

    test('évaluation physique : nom en trois champs, date non future, employé verrouillé, plus de « Fonction »', async () => {
        render(<Harness Component={PhysEval} />);
        expect(screen.getByPlaceholderText('Prénom du patient')).toBeTruthy();
        expect(screen.getByPlaceholderText('Deuxième prénom')).toBeTruthy();
        expect(screen.getByPlaceholderText('Nom de famille')).toBeTruthy();
        expect(screen.queryByText('Fonction au sein du PHMC')).toBeNull();
        const date = screen.getByLabelText ? document.querySelector('input[name="date"]') : null;
        expect(date.getAttribute('max')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

describe("assistant clinique de la consultation générale", () => {
    const props = { admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], assignedDepartment: [], departmentLarge: [], Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] };
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });
    const patient = { patientAgeYears: '35', patientSex: 'Female', patientWeight: '60', patientHeight: '165', clinicalConditions: ['entorse_luxation'], clinicalSeverity: 'Moderate', patientID: 'PHMC-2752', date: '2026-11-11' };

    test("les motifs proposent plan, examens à prescrire et médicaments, sans champs propres aux urgences", async () => {
        render(<Harness Component={GeneralConsult} initial={patient} extra={props} />);
        expect(screen.getByText('Motifs de la consultation (choix multiple)')).toBeTruthy();
        await act(async () => { screen.getByText('Tout appliquer').click(); });
        const state = stateOf();
        expect(state.patientChiefComplaint).toMatch(/Douleur articulaire/);
        expect(state.patientProcedure).toMatch(/- /);
        expect(state.examsOrdered).toEqual(['Xray']);
        expect(state.clinicalMeds.map((m) => m.medId)).toEqual(['paracetamol', 'ibuprofene']);
        expect(state.Imaging).toBeUndefined();
        expect(state.routineCare).toBeUndefined();
        expect(state.painLevel).toBeUndefined();
        expect(state.dischargeDestination).toBeUndefined();
        expect(state.admission).toBe('No');
    });
});

describe('soignants : chirurgien et soignants supplémentaires', () => {
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });
    const staff = [
        { label: 'Chirurgien(ne)', options: [careOption('Dr. Surgeon', ['Chirurgien(ne)'])] },
        { label: 'Médecin titulaire', options: [careOption('Dr. Medecin', ['Médecin titulaire'])] },
    ];

    test('le chirurgien principal se choisit parmi les chirurgiens seulement', () => {
        render(<Harness Component={Surgical} initial={{ phmcEmployee: 'Dr. Interne' }} extra={{ unrestrictedPhmcGroupedOptions: staff }} />);
        fireEvent.keyDown(screen.getByText(/Sélectionner un chirurgien/), { key: 'ArrowDown', keyCode: 40 });
        expect(screen.getByText('Dr. Surgeon')).toBeTruthy();
        expect(screen.queryByText('Dr. Medecin')).toBeNull();
        expect(screen.getByText('Seuls les chirurgiens sont proposés.')).toBeTruthy();
    });

    test("protocole d'urgence : champ multi-sélection des soignants supplémentaires, sans le rédacteur", () => {
        render(<Harness Component={EmergencyForm} initial={{ phmcEmployee: 'Dr. Interne', extraStaff: [] }} extra={{ unrestrictedPhmcGroupedOptions: staff, admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] }} />);
        expect(screen.getByText('Autres soignants présents (facultatif)')).toBeTruthy();

        fireEvent.keyDown(screen.getByText(/Ajouter les soignants qui ont participé/), { key: 'ArrowDown', keyCode: 40 });
        expect(screen.getByText('Dr. Medecin')).toBeTruthy();
        expect(screen.getByText('Dr. Surgeon')).toBeTruthy();
    });

    test("l'assistant clinique porte son petit nom", () => {
        render(<Harness Component={EmergencyForm} initial={{}} extra={{ unrestrictedPhmcGroupedOptions: staff, admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] }} />);
        expect(screen.getByText('· Pilou 💊')).toBeTruthy();
    });
});

describe('décès du patient (urgences, opération)', () => {
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });
    const emergencyProps = { admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] };

    test("urgences : l'interrupteur ouvre les champs du décès et passe l'orientation de sortie à « Décès » ; Pilou préremplit d'après les motifs", async () => {
        render(<Harness Component={EmergencyForm} initial={{ patientAgeYears: '35', patientSex: 'Male', clinicalConditions: ['polytraumatisme'], clinicalSeverity: 'Critical', careEndTime: '15:20', phmcEmployee: 'Dr. Interne' }} extra={emergencyProps} />);
        expect(document.querySelector('input[name="careDeathTime"]')).toBeNull();
        await act(async () => { fireEvent.click(document.getElementById('careDeceased')); });
        expect(stateOf()).toMatchObject({ careDeceased: 'Yes', dischargeDestination: 'Death' });
        expect(document.querySelector('input[name="careDeathTime"]')).toBeTruthy();
        await act(async () => { screen.getByText(/Préremplir avec Pilou/).click(); });
        const state = stateOf();
        expect(state).toMatchObject({ careDeathTime: '15:20', careDeathManner: 'Accidental', careDeathResuscitation: 'Attempted', careDeathBody: 'Coroner' });
        expect(state.careDeathCause).toMatch(/polytraumatisme/);
        // Décocher referme les champs et rend l'orientation.
        await act(async () => { fireEvent.click(document.getElementById('careDeceased')); });
        expect(stateOf()).toMatchObject({ careDeceased: '', dischargeDestination: '' });
        expect(document.querySelector('input[name="careDeathTime"]')).toBeNull();
    });

    test("opération : même bloc, Pilou propose la cause d'après l'intervention choisie ; un texte déjà écrit n'est pas écrasé", async () => {
        render(<Harness Component={Surgical} initial={{ surgeryProcedureIds: ['appendicectomie'], phmcEmployee: 'Dr. Interne', careDeceased: 'Yes', careDeathCause: 'Cause déjà saisie.' }} />);
        await act(async () => { screen.getByText(/Préremplir avec Pilou/).click(); });
        const state = stateOf();
        expect(state.careDeathCause).toBe('Cause déjà saisie.');
        expect(state).toMatchObject({ careDeathManner: 'CauseUndetermined', careDeathBody: 'Coroner' });
    });
});

describe('opération : libellés en français ; patient décédé : plus de suites ni de prescription', () => {
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });
    const yesNo = [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }];
    const emergencyProps = { admission: [{ value: 'Yes', label: 'Oui' }], followup: [{ value: 'AsNeeded', label: 'Au besoin' }], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] };
    const meds = [{ medId: 'paracetamol', regimenId: 'iv', dose: 1000, count: 4, note: '' }, { medId: 'ketoprofene', regimenId: 'po', dose: 100, count: 2, note: '', prescribed: true, days: 5, startDate: '2026-11-12' }];

    test('les trois listes « Yes / No » de l’enquête chirurgicale s’affichent en « Oui / Non »', () => {
        render(<Harness Component={Surgical} initial={{ phmcEmployee: 'Dr. Interne' }} extra={{ patientConsent: yesNo, complications: yesNo, procedureGood: yesNo }} />);
        expect(screen.getAllByText('Oui')).toHaveLength(3);
        expect(screen.getAllByText('Non')).toHaveLength(3);
        expect(screen.queryByText('Yes')).toBeNull();
        expect(screen.queryByText('No')).toBeNull();
        // La valeur enregistrée reste « Yes » / « No » (les rapports existants ne changent pas).
        expect(document.querySelector('select[name="patientConsentOption"] option[value="Yes"]').textContent).toBe('Oui');
    });

    test('opération avec un patient vivant : détails post-opératoires, surveillance, consignes et médicaments post-opératoires', () => {
        render(<Harness Component={Surgical} initial={{ phmcEmployee: 'Dr. Interne', clinicalMeds: meds }} />);
        expect(screen.getByPlaceholderText(/Détails de l'anesthésie post-opératoire/)).toBeTruthy();
        expect(screen.getByText('Surveillance post-opératoire')).toBeTruthy();
        expect(screen.getByPlaceholderText(/Consignes post-opératoires/)).toBeTruthy();
        expect(screen.getByText('Médicaments post-opératoires')).toBeTruthy();
        expect(screen.getByText('Résumé de la procédure et suites')).toBeTruthy();
        expect(screen.getByText('Rapport post-anesthésie')).toBeTruthy();
    });

    test('opération avec un patient décédé : tout cela disparaît, le résumé de la procédure reste', () => {
        render(<Harness Component={Surgical} initial={{ phmcEmployee: 'Dr. Interne', clinicalMeds: meds, careDeceased: 'Yes' }} />);
        expect(screen.queryByPlaceholderText(/Détails de l'anesthésie post-opératoire/)).toBeNull();
        expect(screen.queryByText('Surveillance post-opératoire')).toBeNull();
        expect(screen.queryByPlaceholderText(/Consignes post-opératoires/)).toBeNull();
        expect(screen.queryByText('Médicaments post-opératoires')).toBeNull();
        expect(screen.queryByText('Surveillance post-op')).toBeNull();
        expect(screen.getByText('Résumé de la procédure')).toBeTruthy();
        expect(screen.getByPlaceholderText("Type et dosage d'anesthésie administrée")).toBeTruthy();
        // Pas de réveil : la section s'appelle « Anesthésie administrée » et garde le champ des produits et doses.
        expect(screen.getByText('Anesthésie administrée')).toBeTruthy();
        expect(screen.queryByText('Rapport post-anesthésie')).toBeNull();
    });

    test('urgences : un patient décédé n’a plus d’admission, de traitement à poursuivre, de suivi, d’orientation ni d’ordonnance', async () => {
        const initial = { patientAgeYears: '35', patientSex: 'Male', patientWeight: '75', date: '2026-11-11', phmcEmployee: 'Dr. Interne', clinicalMeds: meds };
        const { unmount } = render(<Harness Component={EmergencyForm} initial={initial} extra={emergencyProps} />);
        expect(screen.getByText('Patient admis?')).toBeTruthy();
        expect(screen.getByText('Suivi requis?')).toBeTruthy();
        expect(screen.getByPlaceholderText(/Autres traitements, conseils verbaux/)).toBeTruthy();
        expect(screen.getByText('Orientation de sortie')).toBeTruthy();
        expect(document.querySelectorAll('input[id^="rx-"]')).toHaveLength(2);
        expect(screen.getByText("Tout mettre sur l'ordonnance")).toBeTruthy();
        unmount();

        render(<Harness Component={EmergencyForm} initial={{ ...initial, careDeceased: 'Yes', dischargeDestination: 'Death' }} extra={emergencyProps} />);
        expect(screen.queryByText('Patient admis?')).toBeNull();
        expect(screen.queryByText('Suivi requis?')).toBeNull();
        expect(screen.queryByPlaceholderText(/Autres traitements, conseils verbaux/)).toBeNull();
        expect(screen.queryByText('Orientation de sortie')).toBeNull();
        // Ni orientation de sortie ni soins systématiques : tout le bloc « Sortie et soins systématiques » disparaît.
        expect(screen.queryByText('Sortie et soins systématiques')).toBeNull();
        expect(screen.queryByText('Soins systématiques réalisés')).toBeNull();
        // Aucune ordonnance : ni case, ni encadré ; la ligne déjà mise sur l'ordonnance est masquée, le médicament administré reste.
        expect(document.querySelectorAll('input[id^="rx-"]')).toHaveLength(0);
        expect(screen.queryByText("Tout mettre sur l'ordonnance")).toBeNull();
        expect(screen.queryByText("Copier l'ordonnance")).toBeNull();
        expect(screen.getAllByText('Paracétamol')).toHaveLength(1);
        expect(screen.queryByText('Kétoprofène')).toBeNull();
        // Pilou ne propose plus l'orientation (admission, suivi, conseils).
        expect(screen.queryByText('Orientation', { selector: 'button' })).toBeNull();
    });
});

describe("interrupteur « patient décédé » : dans l'assistant Pilou", () => {
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });
    const emergencyProps = { admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] };
    const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    test("urgences : l'interrupteur est dans la section Assistant clinique (avant « Arrivée aux urgences »), sans rubrique « Décès du patient » tant que le patient est vivant", () => {
        render(<Harness Component={EmergencyForm} initial={{}} extra={emergencyProps} />);
        const toggle = document.getElementById('careDeceased');
        expect(toggle).toBeTruthy();
        expect(after(screen.getByText('Assistant clinique'), toggle)).toBe(true);
        expect(after(toggle, screen.getByText('Arrivée aux urgences'))).toBe(true);
        expect(screen.queryByText('Décès du patient')).toBeNull();
        expect(document.querySelector('input[name="careDeathTime"]')).toBeNull();
    });

    test("cocher : Pilou l'annonce, et la rubrique « Décès du patient » (champs) apparaît dans le formulaire", async () => {
        render(<Harness Component={EmergencyForm} initial={{ phmcEmployee: 'Dr. Interne' }} extra={emergencyProps} />);
        await act(async () => { fireEvent.click(document.getElementById('careDeceased')); });
        expect(screen.getByText(/en tient compte/)).toBeTruthy();
        expect(screen.getByText('Décès du patient')).toBeTruthy();
        expect(document.querySelector('input[name="careDeathTime"]')).toBeTruthy();
    });

    test("opération : même interrupteur, dans l'assistant chirurgical", () => {
        render(<Harness Component={Surgical} initial={{ phmcEmployee: 'Dr. Interne' }} />);
        const toggle = document.getElementById('careDeceased');
        expect(toggle).toBeTruthy();
        expect(after(screen.getByText('Assistant chirurgical'), toggle)).toBe(true);
        expect(after(toggle, screen.getByText('Enquête chirurgicale'))).toBe(true);
    });

    test("consultation générale : pas d'interrupteur (le décès ne concerne que les urgences et l'opération)", () => {
        render(<Harness Component={GeneralConsult} initial={{}} extra={{ ...emergencyProps, assignedDepartment: [], departmentLarge: [] }} />);
        expect(document.getElementById('careDeceased')).toBeNull();
    });
});

describe("opération : Pilou remplit toute l'enquête chirurgicale, et la liste des chirurgiens vient de vraies fiches", () => {
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });
    const patient = { patientAgeYears: '35', patientSex: 'Male', patientWeight: '75', patientHeight: '178', surgeryProcedureIds: ['appendicectomie'], patientID: 'PHMC-2752', date: '2026-11-11', phmcEmployee: 'Dr. Interne' };

    test('patient vivant : consentement, complications et réussite de la procédure sont renseignés', async () => {
        render(<Harness Component={Surgical} initial={patient} />);
        await act(async () => { screen.getByText('Tout appliquer').click(); });
        expect(stateOf()).toMatchObject({ patientConsentOption: 'Yes', patientComplicationOptions: 'No', procedureGoodOptions: 'Yes' });
        expect(stateOf().patientComplicationsYes).toBeUndefined();
        expect(stateOf().procedureGoodNo).toBeUndefined();
    });

    test('un champ déjà choisi par le chirurgien n’est pas écrasé', async () => {
        render(<Harness Component={Surgical} initial={{ ...patient, patientComplicationOptions: 'Yes', patientComplicationsYes: 'Plaie vasculaire.' }} />);
        await act(async () => { screen.getByText('Tout appliquer').click(); });
        expect(stateOf()).toMatchObject({ patientConsentOption: 'Yes', patientComplicationOptions: 'Yes', patientComplicationsYes: 'Plaie vasculaire.', procedureGoodOptions: 'Yes' });
    });

    test('patient décédé : le décès d’abord, puis complication fatale, procédure non aboutie (avec leur détail) et résumé interrompu', async () => {
        render(<Harness Component={Surgical} initial={{ ...patient, careDeceased: 'Yes' }} />);
        await act(async () => { screen.getByText('Tout appliquer').click(); });
        const state = stateOf();
        expect(state).toMatchObject({ careDeathManner: 'CauseUndetermined', careDeathBody: 'Coroner', careDeathResuscitation: 'Attempted', patientConsentOption: 'Yes', patientComplicationOptions: 'Yes', procedureGoodOptions: 'No' });
        expect(state.careDeathCause).toMatch(/^Décès survenu au cours de l'intervention/);
        expect(state.patientComplicationsYes).toContain("cause non établie");
        expect(state.procedureGoodNo).toMatch(/interrompue avant son terme/);
        expect(state.patientSummary).toContain("Interruption de l'intervention");
        // Pas de suites pour un patient décédé.
        expect(state.postOpMonitoring).toBeUndefined();
        expect(state.surgeryPostOpInstructions).toBeUndefined();
        expect(state.clinicalMeds).toBeUndefined();
    });

    test('la nature du décès au bloc est une liste explicite ; aux urgences, la liste générale', () => {
        const options = (name) => [...document.querySelectorAll(`select[name="${name}"] option`)].map((option) => option.textContent);
        const { unmount } = render(<Harness Component={Surgical} initial={{ phmcEmployee: 'Dr. Interne', careDeceased: 'Yes' }} />);
        const surgical = options('careDeathManner');
        expect(surgical).toEqual(expect.arrayContaining(['Hémorragie peropératoire non contrôlée', "Complication de l'anesthésie (voies aériennes, hémodynamique, produits)", 'Choc anaphylactique peropératoire', "Cause indéterminée (à préciser par l'autopsie)"]));
        expect(surgical).not.toContain('Mort naturelle (maladie)');
        expect(screen.getByText('Cause du décès au bloc')).toBeTruthy();
        unmount();
        render(<Harness Component={EmergencyForm} initial={{ phmcEmployee: 'Dr. Interne', careDeceased: 'Yes' }} extra={{ admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] }} />);
        const emergency = options('careDeathManner');
        expect(emergency).toContain('Mort naturelle (maladie)');
        expect(emergency).not.toContain('Hémorragie peropératoire non contrôlée');
    });

    test('chirurgien principal : les chirurgiens sont retrouvés dans la liste construite comme dans l’application (rôle principal ou cumulé)', () => {
        const { phmcOptionOf } = require('../utils/staffOptions');
        const fiches = [
            { name: 'Dr. Rose Callahan', category: 'Médecin Titulaire', lastName: 'Callahan', extraRanks: ['Directeur(trice)', 'Chirurgien(ne)'] },
            { name: 'Dr. Adrien Valmont', category: 'Médecin Titulaire', lastName: 'Valmont' },
            { name: 'Paul Martin', category: 'Chirurgien(ne)', lastName: 'Martin' },
        ];
        const groups = [{ label: 'Médecin Titulaire', options: fiches.slice(0, 2).map(phmcOptionOf) }, { label: 'Chirurgien(ne)', options: [phmcOptionOf(fiches[2])] }];
        render(<Harness Component={Surgical} initial={{ phmcEmployee: 'Dr. Interne' }} extra={{ unrestrictedPhmcGroupedOptions: groups }} />);
        fireEvent.keyDown(screen.getByText(/Sélectionner un chirurgien/), { key: 'ArrowDown', keyCode: 40 });
        expect(screen.getByText('Dr. Rose Callahan')).toBeTruthy();
        expect(screen.getByText('Paul Martin')).toBeTruthy();
        expect(screen.queryByText('Dr. Adrien Valmont')).toBeNull();
        expect(screen.queryByText('Aucun chirurgien dans la liste du personnel')).toBeNull();
    });
});

describe('ordonnance dans la liste de médicaments', () => {
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });
    const emergencyProps = { admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] };
    const meds = [{ medId: 'paracetamol', regimenId: 'iv', dose: 1000, count: 4, note: '' }, { medId: 'paracetamol', regimenId: 'po', dose: 1000, count: 3, note: '' }];
    const initial = { patientAgeYears: '35', patientSex: 'Male', patientWeight: '75', date: '2026-11-11', patientName: 'Jean Test', patientID: 'PHMC-1', phmcEmployee: 'Dr. Interne', clinicalMeds: meds };

    test("le début se choisit par médicament (« Demain » lève le dépassement) ; l'ordonnance a son menu et son aperçu", async () => {
        render(<Harness Component={EmergencyForm} initial={{ ...initial, clinicalMeds: [meds[0], { ...meds[1], prescribed: true, startDate: '2026-11-11' }] }} extra={emergencyProps} />);
        expect(screen.getByText(/cumulés sur 24 h/)).toBeTruthy();
        expect(screen.getByText(/indiquez sa date de début/)).toBeTruthy();
        await act(async () => { screen.getByText('Demain').click(); });
        expect(stateOf().clinicalMeds[1].startDate).toBe('2026-11-12');
        expect(screen.queryByText(/cumulés sur 24 h/)).toBeNull();
        expect(screen.getByText("Copier l'ordonnance")).toBeTruthy();
        await act(async () => { screen.getByText('Aperçu').click(); });
        expect(document.querySelector('iframe')).toBeTruthy();
    });

    test("cocher « Sur l'ordonnance » pose la date de début par défaut : le lendemain pour un médicament déjà administré", async () => {
        render(<Harness Component={EmergencyForm} initial={initial} extra={emergencyProps} />);
        const boxes = document.querySelectorAll('input[type="checkbox"][id^="rx-"]');
        expect(boxes).toHaveLength(2);
        await act(async () => { fireEvent.click(boxes[1]); });
        expect(stateOf().clinicalMeds[1]).toMatchObject({ prescribed: true, startDate: '2026-11-12' });
    });
});


describe("assistant chirurgical de l'opération", () => {
    const props = {};
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });
    const patient = { patientAgeYears: '35', patientSex: 'Male', patientWeight: '75', patientHeight: '178', surgeryProcedureIds: ['appendicectomie'], patientID: 'PHMC-2752', date: '2026-11-11' };

    test('sans intervention : poids, taille et liste de médicaments post-opératoires, aucune suggestion', () => {
        render(<Harness Component={Surgical} initial={{ patientAgeYears: '35' }} extra={props} />);
        expect(screen.getByText('Assistant chirurgical')).toBeTruthy();
        expect(screen.queryByText('Tout appliquer')).toBeNull();
        expect(screen.getByText('Médicaments post-opératoires')).toBeTruthy();
    });

    test("une intervention propose l'anesthésie dosée et les suites, appliquées au clic sans écraser un champ rempli", async () => {
        render(<Harness Component={Surgical} initial={{ ...patient, surgeryProcedures: 'Nom du chirurgien' }} extra={props} />);
        expect(screen.getByText(/Suggestions/)).toBeTruthy();
        expect(stateOf().surgeryAnesthesiaType).toBeUndefined();
        await act(async () => { screen.getByText('Tout appliquer').click(); });
        const state = stateOf();
        expect(state.surgeryProcedures).toBe('Nom du chirurgien');
        expect(state.surgeryPreOpDiagnosis).toBe('Appendicite aiguë.');
        expect(state.surgeryAnesthesiaType).toBe('General');
        expect(state.surgeryDuration).toBe('45');
        expect(state.surgeryAsa).toBe('ASA1');
        expect(state.postOpMonitoring).toBe('RecoveryRoom');
        expect(state.patientSummaryConsultation).toContain('Propofol 150 mg');
        expect(state.patientSummary).toMatch(/Cœlioscopie/);
        expect(state.clinicalMeds.map((m) => m.medId)).toEqual(['paracetamol', 'ketoprofene', 'ondansetron']);
    });

    test('un bouton applique une seule section', async () => {
        render(<Harness Component={Surgical} initial={patient} extra={props} />);
        await act(async () => { screen.getByText('Risque (ASA)', { selector: 'button' }).click(); });
        const state = stateOf();
        expect(state.surgeryAsa).toBe('ASA1');
        expect(state.surgeryAnesthesiaType).toBeUndefined();
    });
});

describe('choix par défaut des formulaires de consultation', () => {
    const props = { admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], Imaging: [], Appearance: [], Behavior: [], Speech: [], Mood: [], Affect: [], ThoughtProcess: [], ThoughtContent: [], Insight: [], Cognition: [], Risk: [], BodyMassIndex: [], temperature: [], heartRate: [], breathing: [], bloodPressure: [], patientJob: [], patientJobRisks: [], patientAllergiesRisk: [], patientMedicineRegular: [], patientOther: [], predisposition: [] };
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });
    const typeInto = (name, value) => act(() => { fireEvent.change(document.querySelector(`textarea[name="${name}"]`), { target: { value } }); });

    test('évaluation physique : listes de choix sur les champs libres, texte libre regroupé', () => {
        render(<Harness Component={PhysEval} initial={{ patientJob: 'Yes', patientJobRisks: 'Yes', patientAllergiesRisk: 'Yes', patientMedicineRegular: 'Yes', patientOther: 'Yes' }} extra={props} />);
        ['patientCareer', 'careerRisks', 'patientAllergies', 'patientMedicine', 'patientImpairments'].forEach((name) => expect(document.querySelector(`textarea[name="${name}Free"]`)).toBeTruthy());
        expect(document.querySelector('textarea[name="patientSummary"]')).toBeTruthy();
        typeInto('patientImpairmentsFree', 'Verres correcteurs');
        expect(stateOf()).toMatchObject({ patientImpairments: 'Verres correcteurs', patientImpairmentsFree: 'Verres correcteurs', patientImpairmentsPresets: [] });
    });

    test('évaluation physique : constantes normales en un clic', async () => {
        render(<Harness Component={PhysEval} extra={props} />);
        await act(async () => { screen.getByText('Constantes normales').click(); });
        expect(stateOf()).toMatchObject({ temperature: 'patientTempNormal', heartRate: 'patientHeartRateNormal', breathing: 'patientBreathingNormal', bloodPressure: 'patientBloodPressureNormal' });
    });

    test("évaluation physique : déclaration type d'après la conclusion, désactivée sans conclusion", async () => {
        const { unmount } = render(<Harness Component={PhysEval} extra={props} />);
        expect(screen.getByText('Proposer une déclaration').closest('button').disabled).toBe(true);
        unmount();
        render(<Harness Component={PhysEval} initial={{ aptitudeConclusion: 'Apte', evalReason: 'Renewal', date: '2026-11-11', aptitudeValidityMonths: '12' }} extra={props} />);
        await act(async () => { screen.getByText('Proposer une déclaration').click(); });
        expect(stateOf().patientSummary).toContain('déclaré APTE');
        expect(stateOf().patientSummary).toContain('(renouvellement)');
    });

    test('consultation psychiatrique : motif, notes, diagnostic, procédure et médicaments à choix', () => {
        render(<Harness Component={MentalHealth} extra={props} />);
        ['patientChiefComplaint', 'patientNotes', 'patientDiagnosis', 'patientProcedure', 'patientMedicine'].forEach((name) => expect(document.querySelector(`textarea[name="${name}Free"]`)).toBeTruthy());
        typeInto('patientMedicineFree', 'Sertraline 50 mg le matin');
        expect(stateOf().patientMedicine).toBe('Sertraline 50 mg le matin');
    });

    test('évaluation psychologique : tous les champs libres ont leurs choix par défaut', () => {
        render(<Harness Component={Shrink} extra={props} />);
        expect(document.querySelectorAll('.preset-select').length).toBeGreaterThanOrEqual(26);
        expect(document.querySelector('textarea[name="patientSafetyFree"]')).toBeTruthy();
        typeInto('patientSafetyFree', 'Voisin joignable');
        expect(stateOf()).toMatchObject({ patientSafety: 'Voisin joignable' });
    });
});

describe('fond médical complété depuis une consultation', () => {
    const props = { admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: [], assignedDepartment: [], departmentLarge: [], Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] };
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; });

    test("allergie ajoutée : case « Ajouter aussi au dossier » cochée par défaut, décochable", async () => {
        mockDossier = { status: 'found', donnees: { patientAllergies: 'Pénicilline' } };
        render(<Harness Component={GeneralConsult} initial={{ patientID: 'PHMC-2752', patientAllergies: 'Pénicilline, latex' }} extra={props} />);
        const box = await screen.findByLabelText(/Ajouter aussi au dossier du patient \(allergies\)/);
        expect(box.checked).toBe(true);
        await act(async () => { box.click(); });
        expect(stateOf().patientBackgroundSync).toBe('No');
        await act(async () => { screen.getByLabelText(/Ajouter aussi au dossier du patient/).click(); });
        expect(stateOf().patientBackgroundSync).toBe('Yes');
    });

    test("rien d'ajouté : pas de case ; pas de dossier : pas de case", () => {
        mockDossier = { status: 'found', donnees: { patientAllergies: 'Pénicilline' } };
        const { unmount } = render(<Harness Component={GeneralConsult} initial={{ patientID: 'PHMC-2752', patientAllergies: 'Pénicilline' }} extra={props} />);
        expect(screen.queryByLabelText(/Ajouter aussi au dossier du patient/)).toBeNull();
        unmount();
        mockDossier = { status: 'missing', donnees: null };
        render(<Harness Component={GeneralConsult} initial={{ patientID: 'PHMC-2752', patientAllergies: 'Latex' }} extra={props} />);
        expect(screen.queryByLabelText(/Ajouter aussi au dossier du patient/)).toBeNull();
    });

    test("assistant : l'antécédent évoqué par le motif se propose, s'ajoute en un clic, puis disparaît", async () => {
        mockDossier = { status: 'idle', donnees: null };
        render(<Harness Component={EmergencyForm} initial={{ patientAgeYears: '30', clinicalConditions: ['asthme'], patientChronicDiseases: 'Hypertension' }} extra={props} />);
        expect(screen.getByText('À vérifier dans le dossier du patient')).toBeTruthy();
        await act(async () => { screen.getByText('+ Asthme').click(); });
        expect(stateOf().patientChronicDiseases).toBe('Hypertension ; Asthme');
        expect(screen.queryByText('+ Asthme')).toBeNull();
    });

    test("assistant : une allergie grave rappelle de noter l'allergène", () => {
        mockDossier = { status: 'idle', donnees: null };
        render(<Harness Component={EmergencyForm} initial={{ patientAgeYears: '30', clinicalConditions: ['anaphylaxie'] }} extra={props} />);
        expect(screen.getByText(/Notez l'allergène identifié/)).toBeTruthy();
    });
});

describe("assistant clinique : patient inconnu et champs complets", () => {
    const oxy = [{ value: 'oxy-ok', label: 'Normal (≥ 95 %)' }, { value: 'oxy-low', label: 'Hypoxie (< 95 %)' }];
    const props = { admission: [], followup: [], painLevel: [], findings: [], lungs: [], pupils: [], wounds: [], ecg: [], sono: [], lab: [], bloodOxy: oxy, Imaging: [], XrayResults: [], ctResults: [], mriResults: [], ultrasoundResults: [], otherResults: [] };
    beforeEach(() => { mockAuth = { staffName: 'Dr. Interne', isAdmin: false, currentEmployee: { uid: 'u1' }, staffProfile: { rank: 'Interne en Médecine' }, isCivilian: false, civilianProfile: null }; mockDossier = { status: 'idle', donnees: null }; });

    test("sans âge ni sexe : remarques affichées, puis « Tout appliquer » complète le patient et tous les champs", async () => {
        render(<Harness Component={EmergencyForm} initial={{ patientID: 'PHMC-2752', date: '2026-11-11', clinicalConditions: ['fracture_fermee'], clinicalSeverity: 'Moderate' }} extra={props} />);
        expect(screen.getByText(/Date de naissance non renseignée/)).toBeTruthy();
        expect(screen.getByText(/Sexe non renseigné/)).toBeTruthy();
        await act(async () => { screen.getByText('Tout appliquer').click(); });
        const state = stateOf();
        expect(state.patientDateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(['Male', 'Female']).toContain(state.patientSex);
        expect(state.patientAllergies).toBe('Aucune connue');
        expect(state.bloodOxy).toBe('oxy-ok');
        expect(state).toMatchObject({ arrivalMode: 'Walk-in', lungs: 'patientNormal', pupils: 'patientPupilsNormal', ecg: 'patientSinusRhythm', sono: 'patientNormal', XrayResults: ['Displaced Fracture'] });
        expect(state.arrivalTime).toMatch(/^\d{2}:\d{2}$/);
        expect(state.careStartTime).toMatch(/^\d{2}:\d{2}$/);
        expect(state.patientMedicine).toMatch(/Repos de la zone atteinte/);
    });

    test("le bouton « Patient » ne remplace jamais ce qui est saisi, même avec « Remplacer »", async () => {
        render(<Harness Component={EmergencyForm} initial={{ patientID: 'PHMC-2752', date: '2026-11-11', patientSex: 'Female', patientAllergies: 'Pénicilline', clinicalConditions: ['asthme'] }} extra={props} />);
        await act(async () => { screen.getByLabelText(/Remplacer ce qui est déjà saisi/).click(); });
        await act(async () => { screen.getByText('Patient', { selector: 'button' }).click(); });
        const state = stateOf();
        expect(state).toMatchObject({ patientSex: 'Female', patientAllergies: 'Pénicilline', patientChronicDiseases: 'Asthme' });
        expect(state.patientDateOfBirth).toBeTruthy();
    });

    test("sexe incompatible avec l'intervention : remarque dans l'assistant chirurgical", () => {
        render(<Harness Component={Surgical} initial={{ patientAgeYears: '30', patientSex: 'Male', surgeryProcedureIds: ['cesarienne'] }} extra={{}} />);
        expect(screen.getByText(/concerne un patient de sexe féminin/)).toBeTruthy();
    });

    test("la consultation n'a pas de bouton « Arrivée »", () => {
        render(<Harness Component={GeneralConsult} initial={{ patientAgeYears: '30', clinicalConditions: ['asthme'] }} extra={{ ...props, assignedDepartment: [], departmentLarge: [] }} />);
        expect(screen.queryByText('Arrivée', { selector: 'button' })).toBeNull();
        expect(screen.getByText('Patient', { selector: 'button' })).toBeTruthy();
    });
});
