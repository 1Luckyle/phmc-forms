// Formulaires de candidature : rendu réel (jsdom) du composant commun, pour repérer les erreurs d'exécution que la compilation ne voit pas.
import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: null } }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn(() => () => {}), query: jest.fn(), limitToLast: jest.fn() }));
jest.mock('../contexts/SiteConfigContext', () => ({ useSiteConfig: () => ({ pbcEnabled: true }) }));
jest.mock('../hooks/useTitleOptions', () => ({ __esModule: true, default: () => [{ value: 'Mr', label: 'M.' }, { value: 'Mrs', label: 'Mme' }, { value: 'Mineur', label: 'Mineur' }] }));
jest.mock('../utils/imageUploadApi', () => ({ uploadImageToServer: jest.fn(async () => ({ url: 'https://i.ibb.co/lic.png' })) }));
jest.mock('../utils/cities', () => ({ useCities: () => [{ nom: 'Mission Row', cp: '90001' }], cityOfZip: (cities, zip) => cities.find((c) => c.cp === zip) || null, getCitiesSnapshot: () => [] }));

const Physician = require('./Physician').default;
const Ems = require('./Ems').default;
const { uploadImageToServer } = require('../utils/imageUploadApi');

const Harness = ({ Component, initial = {}, extra = {} }) => {
    const [formData, setFormData] = useState(initial);
    const handleChange = (event) => setFormData((prev) => ({ ...prev, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
    return (
        <>
            <Component formData={formData} setFormData={setFormData} handleChange={handleChange} {...extra} />
            <pre data-testid="state">{JSON.stringify(formData)}</pre>
        </>
    );
};
const stateOf = () => JSON.parse(screen.getByTestId('state').textContent);
const positions = { Attending: { nom: 'Médecin titulaire', statut: 'OUVERT' }, Closed: { nom: 'Chirurgien', statut: 'FERMÉ' } };

beforeEach(() => {
    try { localStorage.clear(); } catch (error) { /* ignoré */ }
    uploadImageToServer.mockResolvedValue({ url: 'https://i.ibb.co/lic.png' });   // CRA réinitialise les mocks entre les tests
});

describe('candidature : formulaire commun', () => {
    test('rubriques actuelles ; plus de genre, lettre de motivation, forum, UCP, condition médicale ni lieu de naissance', () => {
        render(<Harness Component={Physician} extra={{ physicianRecruitmentDetails: positions }} />);
        ['Poste visé', 'Identité', 'Formation', 'Expérience professionnelle', 'Licences', '(( Informations hors personnage ))'].forEach((title) => expect(screen.getByText(title)).toBeTruthy());
        ['Genre', 'Lettre de motivation', 'forum', 'UCP', 'condition médicale', 'Lieu de naissance'].forEach((word) => expect(document.body.textContent.toLowerCase()).not.toContain(word.toLowerCase()));
        expect(document.querySelector('option[value="Closed"]').disabled).toBe(true);
        expect(document.body.textContent).not.toMatch(/est requis/);
    });

    test('la date de naissance donne l\'âge, et « Mineur » est imposé sous 18 ans', async () => {
        const year = new Date().getFullYear() - 14;
        render(<Harness Component={Physician} extra={{ physicianRecruitmentDetails: positions }} />);
        await act(async () => { fireEvent.change(document.querySelector('input[name="applicantDOB"]'), { target: { name: 'applicantDOB', value: `${year}-01-01` } }); });
        expect(screen.getByText(/ans?$/)).toBeTruthy();
        expect(stateOf().applicantTitle).toBe('Mineur');
    });

    test('le nom complet est recomposé avec le titre', async () => {
        render(<Harness Component={Physician} initial={{ applicantTitle: 'Mrs' }} extra={{ physicianRecruitmentDetails: positions }} />);
        await act(async () => { fireEvent.change(document.querySelector('input[name="applicantFirstName"]'), { target: { name: 'applicantFirstName', value: 'Jane' } }); });
        await act(async () => { fireEvent.change(document.querySelector('input[name="applicantLastName"]'), { target: { name: 'applicantLastName', value: 'Doe' } }); });
        expect(stateOf().applicantTitleAndFullName).toBe('Mme Jane Doe');
    });

    test('expérience : le bouton + ajoute une fiche, la case « quitté » active la date de fin, la corbeille retire', async () => {
        render(<Harness Component={Physician} extra={{ physicianRecruitmentDetails: positions }} />);
        await act(async () => { screen.getByText('Ajouter un emploi').click(); });
        expect(screen.getByText('Emploi 1')).toBeTruthy();
        const end = () => document.querySelectorAll('input[type="date"][max]')[2];
        expect(stateOf().applicantJobs).toHaveLength(1);
        await act(async () => { fireEvent.click(document.getElementById('job-left-0')); });
        expect(stateOf().applicantJobs[0].left).toBe(true);
        expect(end()).toBeTruthy();
        await act(async () => { screen.getByLabelText("Retirer l'emploi 1").click(); });
        expect(stateOf().applicantJobs).toHaveLength(0);
    });

    test('licences : une capture envoyée apparaît en vignette et se retire', async () => {
        render(<Harness Component={Physician} extra={{ physicianRecruitmentDetails: positions }} />);
        const input = document.querySelector('input[type="file"]');
        const file = new File(['x'], 'licence.png', { type: 'image/png' });
        await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
        await act(async () => { await Promise.resolve(); await Promise.resolve(); });
        expect(uploadImageToServer).toHaveBeenCalled();
        await screen.findByAltText('Licence 1');
        expect(stateOf().applicantLicenses).toEqual(['https://i.ibb.co/lic.png']);
        await act(async () => { screen.getByLabelText('Retirer la licence 1').click(); });
        expect(stateOf().applicantLicenses).toEqual([]);
    });

    test('un brouillon d\'avant la refonte est repris dans les champs actuels', async () => {
        localStorage.setItem('applicationDraft_medecine', JSON.stringify({ timestamp: Date.now(), data: { applicantTitleAndFullName: 'Mme Jane Doe', citizenUS: true, applicantPrevEmployment: 'N/A' } }));
        render(<Harness Component={Physician} extra={{ physicianRecruitmentDetails: positions }} />);
        await act(async () => {});
        expect(stateOf()).toMatchObject({ applicantFirstName: 'Jane', applicantLastName: 'Doe', applicantTitle: 'Mrs', applicantNoExperience: true });
    });
});

describe('candidature paramédicale', () => {
    const selectOptions = { postesParamedical: { Paramedic: { nom: 'Paramedic', statut: 'OUVERT', role: 'Paramedic' }, Cadet: { nom: 'Cadet', statut: 'OUVERT', role: 'Cadet' } } };
    test('paramédic : expérience et expérience médicale ; autres rôles : expérience, licences et programme à temps partiel', () => {
        const { unmount } = render(<Harness Component={Ems} initial={{ recruitmentPosition: 'Paramedic' }} extra={{ selectOptions }} />);
        expect(screen.getByText('Expérience professionnelle')).toBeTruthy();
        expect(screen.getByText('Expérience médicale réelle ou RP médical passé')).toBeTruthy();
        expect(screen.queryByText('Programme à temps partiel')).toBeNull();
        unmount();
        render(<Harness Component={Ems} initial={{ recruitmentPosition: 'Cadet' }} extra={{ selectOptions }} />);
        expect(screen.getByText('Expérience professionnelle')).toBeTruthy();
        expect(screen.getByText('Licences')).toBeTruthy();
        expect(screen.getByText('Programme à temps partiel')).toBeTruthy();
        expect(screen.getByText(/Licence BLS\/ALS/)).toBeTruthy();
    });
});
