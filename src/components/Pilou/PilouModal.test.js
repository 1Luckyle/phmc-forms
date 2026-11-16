import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { getToolAccess } from '../../utils/viewAs';

jest.mock('../../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));
jest.mock('../BaseModal', () => ({ __esModule: true, default: ({ children, title }) => <div><h1>{title}</h1>{children}</div> }));

const { default: PilouModal, PILOU_STORAGE_KEY, reviveCase, EMPTY_CASE } = require('./PilouModal');

const pick = (name, value) => fireEvent.change(document.querySelector(`[name="${name}"]`), { target: { value } });
const openTab = (label) => fireEvent.click(screen.getByRole('tab', { name: label }));
const fillPatient = () => { pick('pilouAge', '45'); pick('pilouSexe', 'Male'); pick('pilouPoids', '80'); pick('pilouTaille', '177'); };
const chooseCondition = async (label) => {
    await act(async () => { fireEvent.keyDown(screen.getByText(/Choisir dans la liste \(plusieurs choix possibles\)/), { key: 'ArrowDown', keyCode: 40 }); });
    await act(async () => { fireEvent.click(screen.getByText(label)); });
};

beforeEach(() => window.sessionStorage.clear());

describe('Pilou dans la Boîte à outils', () => {
    test('affiché aux soignants et aux admins seulement : ni Civils, ni DMEC, ni administration', () => {
        const base = { currentEmployee: { uid: 'u' }, staffName: 'Dr X', isCivilian: false };
        expect(getToolAccess({ ...base, isAdmin: true }).pilou).toBe(true);
        expect(getToolAccess({ ...base, staffProfile: { type: 'PHMC', category: 'Médecin Titulaire' } }).pilou).toBe(true);
        expect(getToolAccess({ ...base, staffProfile: { type: 'coroner', category: 'Médecin légiste' } }).pilou).toBe(false);
        expect(getToolAccess({ isCivilian: true, isAdmin: false }).pilou).toBe(false);
    });

    test('à l\'ouverture, Pilou propose le choix entre l\'aide à la prise en charge et le manuel médical', () => {
        render(<PilouModal show onHide={() => {}} />);
        expect(screen.getByText('Commencer un cas')).toBeTruthy();
        expect(screen.getByText('Ouvrir le manuel')).toBeTruthy();
        expect(document.querySelector('[name="pilouAge"]')).toBeNull();
        fireEvent.click(screen.getByText('Commencer un cas'));
        expect(document.querySelector('[name="pilouAge"]')).toBeTruthy();
        openTab('Manuel médical');
        expect(screen.getByText('Comment utiliser ce manuel', { selector: 'h4' })).toBeTruthy();
        openTab('Accueil');
        expect(screen.getByText('Ouvrir le manuel')).toBeTruthy();
    });
});

describe('aide à la prise en charge', () => {
    test('champs obligatoires (rouge) et facultatifs (bleu) : listes partout, sauf âge, poids et taille en nombres bornés', () => {
        render(<PilouModal show onHide={() => {}} />);
        openTab('Aide à la prise en charge');
        expect(document.querySelector('[data-guide-zone]')).toBeTruthy();
        ['pilouSexe', 'pilouGravite'].forEach((name) => expect(document.querySelector(`select[name="${name}"]`).required).toBe(true));
        [['pilouAge', '0', '120'], ['pilouPoids', '1', '400'], ['pilouTaille', '30', '260']].forEach(([name, min, max]) => {
            const input = document.querySelector(`input[type="number"][name="${name}"]`);
            expect(input.required).toBe(true);
            expect(input.min).toBe(min);
            expect(input.max).toBe(max);
        });
        expect(document.querySelectorAll('input[type="number"]')).toHaveLength(3);
        expect(document.querySelector('input[type="text"]:not([role]):not([id^="react-select"])')).toBeNull();
        expect(document.querySelector('textarea')).toBeNull();
        expect(screen.getByText('Obligatoire')).toBeTruthy();
        expect(screen.getByText('Facultatif')).toBeTruthy();
        expect(screen.getByText(/Il manque : l'âge, le sexe, le poids, la taille, au moins un motif/)).toBeTruthy();
    });

    test('valeur hors limites signalée ; cas complet → parcours en six temps, copiable', async () => {
        const notify = jest.fn();
        Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue() } });
        render(<PilouModal show onHide={() => {}} showNotification={notify} />);
        openTab('Aide à la prise en charge');
        fillPatient(); pick('pilouPoids', '450');
        expect(screen.getByText(/Valeur hors limites : poids de 1 à 400 kg/)).toBeTruthy();
        expect(screen.getByText(/Il manque : le poids, au moins un motif/)).toBeTruthy();
        pick('pilouPoids', '81.5');
        expect(screen.queryByText(/Valeur hors limites/)).toBeNull();
        expect(screen.getByText(/Il manque : au moins un motif/)).toBeTruthy();
        await chooseCondition('Douleur thoracique / syndrome coronarien');
        ['Premier regard', 'Gestes immédiats', 'Examen et bilan', 'Traitement', 'Surveillance', 'Orientation et suites'].forEach((label) => expect(screen.getByText(label, { selector: 'h6' })).toBeTruthy());
        expect(screen.getByText("Faire l'ECG")).toBeTruthy();
        // la dose est affichée sur l'étape qui demande le médicament, et dans le récapitulatif des médicaments
        expect(within(screen.getByText("Donner l'aspirine").closest('.pl-step')).getByText(/^Aspirine \d+ mg/)).toBeTruthy();
        expect(screen.queryByText(/^Administrer : /)).toBeNull();
        expect(screen.getByText(/Médicaments et doses pour ce patient \(\d+\)/)).toBeTruthy();
        expect(within(document.querySelector('.pl-medlist')).getByText(/^Aspirine \d+ mg/)).toBeTruthy();
        expect(screen.getByText(/0 \/ \d+ étapes faites/)).toBeTruthy();
        await act(async () => { fireEvent.click(screen.getByText('Copier')); });
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('PILOU — Douleur thoracique'));
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('GESTES IMMÉDIATS'));
        await act(async () => { fireEvent.click(screen.getByText('Nouveau patient')); });
        expect(screen.getByText(/Il manque : l'âge/)).toBeTruthy();
    });

    test('précisions sur les blessures : mêmes arguments que le formulaire d\'urgence, sans texte libre, et elles changent le parcours', async () => {
        render(<PilouModal show onHide={() => {}} />);
        openTab('Aide à la prise en charge');
        fillPatient();
        expect(screen.queryByText('Précisions sur les blessures')).toBeNull();
        await chooseCondition('Plaie par arme à feu');
        expect(screen.getByText('Précisions sur les blessures')).toBeTruthy();
        expect(screen.getByText('Zone du corps')).toBeTruthy();
        expect(screen.getByText('Trajet du projectile')).toBeTruthy();
        expect(screen.getByText('Mutilations et atteintes associées')).toBeTruthy();
        expect(document.querySelector('input[name="injuryNote"]')).toBeNull(); // pas de champ libre dans Pilou
        expect(screen.queryByText('Balle logée', { selector: '.pl-step-title' })).toBeNull();
        pick('injuryTrajectory-plaie_arme_feu-0', 'Lodged');
        expect(screen.getByText('Balle logée', { selector: '.pl-step-title' })).toBeTruthy();
        expect(screen.getByText('Lésions renseignées')).toBeTruthy();
        pick('injuryCount-plaie_arme_feu-0', '3');
        expect(screen.getByText(/^Lésions multiples \(3 impacts de balle\)/)).toBeTruthy();
    });

    test('suivi pas à pas : étape en cours, « fait — étape suivante », saut à une étape, avancement conservé', async () => {
        render(<PilouModal show onHide={() => {}} />);
        openTab('Aide à la prise en charge');
        fillPatient();
        await chooseCondition('Hypoglycémie');
        openTab('Suivi pas à pas');
        const total = Number(/Étape 1 sur (\d+)/.exec(document.querySelector('.pl-current-head').textContent)[1]);
        expect(total).toBeGreaterThan(15);
        expect(screen.getByText('Se protéger et se présenter', { selector: 'h5' })).toBeTruthy();
        fireEvent.click(screen.getByText('Fait — étape suivante'));
        expect(screen.getByText('Faire le bilan primaire A B C D E', { selector: 'h5' })).toBeTruthy();
        expect(screen.getByText(`1 / ${total} étapes faites`)).toBeTruthy();
        expect(document.querySelector('.pl-current-head').textContent).toMatch(/Étape 2 sur/);
        // sauter directement à un temps du parcours, puis revenir en arrière
        fireEvent.click(document.querySelector('.pl-phase-chip:nth-child(4)'));
        expect(within(document.querySelector('.pl-current')).getByText(/Traitement/)).toBeTruthy();
        fireEvent.click(screen.getByText('Précédente'));
        expect(within(document.querySelector('.pl-current')).getByText(/Examen et bilan/)).toBeTruthy();
        // l'avancement est gardé dans l'onglet : on le retrouve en rouvrant Pilou
        const saved = JSON.parse(window.sessionStorage.getItem(PILOU_STORAGE_KEY));
        expect(saved).toMatchObject({ age: '45', selected: ['hypoglycemie'], done: ['start-safety'], view: 'track' });
        // la vue complète montre la même étape cochée
        openTab('Vue complète');
        expect(document.getElementById('pilou-step-start-safety').checked).toBe(true);
        fireEvent.click(document.getElementById('pilou-step-start-safety'));
        expect(screen.getByText(`0 / ${total} étapes faites`)).toBeTruthy();
    });

    test('l\'humeur de Pilou suit le cas : endormi sans cas, inquiet sur une alerte médicament, content quand tout est fait', async () => {
        render(<PilouModal show onHide={() => {}} />);
        fireEvent.click(screen.getByText('Commencer un cas'));
        expect(document.querySelector('.pl-empty [data-mood="sleepy"]')).toBeTruthy();
        pick('pilouAge', '35'); pick('pilouSexe', 'Male'); pick('pilouPoids', '75'); pick('pilouTaille', '178'); pick('pilouGravite', 'Severe');
        await chooseCondition('Plaie par arme à feu');
        // allergie sévère à la pénicilline : l'antibiotique porte une alerte
        await act(async () => { fireEvent.keyDown(document.querySelector('[name="pilouAllergies"]').parentElement.querySelector('input[role="combobox"], input'), { key: 'ArrowDown', keyCode: 40 }); });
        await act(async () => { fireEvent.click(screen.getByText('Pénicilline / amoxicilline')); });
        expect(document.querySelector('.pl-head [data-mood]').getAttribute('data-mood')).toBe('alert');
        document.querySelectorAll('input[id^="pilou-step-"]').forEach((box) => { if (!box.checked) fireEvent.click(box); });
        expect(document.querySelector('.pl-head [data-mood]').getAttribute('data-mood')).toBe('happy');
        openTab('Suivi pas à pas');
        expect(screen.getByText(/Bravo, parcours terminé/)).toBeTruthy();
    });

    test('cas en cours retrouvé à la réouverture ; un stockage abîmé redonne un cas vide', () => {
        window.sessionStorage.setItem(PILOU_STORAGE_KEY, JSON.stringify({ age: '30', sex: 'Female', weight: '60', height: '165', severity: 'Mild', selected: ['migraine', 'motif_supprime'], done: ['start-safety'], view: 'track' }));
        render(<PilouModal show onHide={() => {}} />);
        expect(screen.getByText('Reprendre le cas en cours')).toBeTruthy();
        fireEvent.click(screen.getByText('Reprendre le cas en cours'));
        expect(document.querySelector('[name="pilouAge"]').value).toBe('30');
        expect(screen.getByText('Migraine / céphalée', { selector: 'h5' })).toBeTruthy();
        expect(document.querySelector('.pl-current')).toBeTruthy();
        expect(reviveCase('{pas du json')).toEqual(EMPTY_CASE);
        expect(reviveCase(JSON.stringify({ selected: 'x', sex: 'Autre', severity: 'Extrême', injuryDetails: [null, { conditionId: 'inconnu' }] }))).toEqual(EMPTY_CASE);
    });
});

describe('manuel médical', () => {
    test('sommaire, lecture section par section, schémas et tableaux générés', () => {
        render(<PilouModal show onHide={() => {}} />);
        fireEvent.click(screen.getByText('Ouvrir le manuel'));
        expect(screen.getByText('Comment utiliser ce manuel', { selector: 'h4' })).toBeTruthy();
        fireEvent.click(screen.getByText('Suivant'));
        expect(screen.getByText("Les six temps d'une prise en charge", { selector: 'h4' })).toBeTruthy();
        expect(document.querySelector('figure[data-figure="phases"] svg')).toBeTruthy();
        fireEvent.click(screen.getByText(/Le bilan du patient/));
        expect(screen.getByText('Le bilan primaire A B C D E', { selector: 'h4' })).toBeTruthy();
        fireEvent.click(screen.getByText('Les constantes vitales'));
        expect(screen.getByText('Moins de 1 an')).toBeTruthy();
        expect(screen.getByText('110 à 160')).toBeTruthy();
    });

    test('recherche, fiche réflexe, leçon liée et envoi du motif dans l\'aide à la prise en charge', () => {
        render(<PilouModal show onHide={() => {}} />);
        openTab('Manuel médical');
        fireEvent.change(screen.getByLabelText('Rechercher dans le manuel'), { target: { value: 'anaphylaxie' } });
        expect(screen.getByText(/résultat/)).toBeTruthy();
        fireEvent.click(screen.getByText('Choc anaphylactique', { selector: '.pm-result span' }));
        expect(screen.getByText('Choc anaphylactique', { selector: 'h4' })).toBeTruthy();
        expect(screen.getByText("Injecter l'adrénaline")).toBeTruthy();
        fireEvent.click(screen.getByText(/Comprendre : Allergies/));
        expect(screen.getByText('Allergies', { selector: 'h4' })).toBeTruthy();
        fireEvent.click(screen.getByText('Choc anaphylactique', { selector: '.pm-related button' }));
        fireEvent.click(screen.getByText(/Utiliser ce motif dans l'aide à la prise en charge/));
        expect(document.querySelector('[name="pilouAge"]')).toBeTruthy();
        expect(screen.getByText('Choc anaphylactique')).toBeTruthy();
        expect(JSON.parse(window.sessionStorage.getItem(PILOU_STORAGE_KEY)).selected).toEqual(['anaphylaxie']);
    });

    test('depuis un cas, la leçon du manuel correspondante s\'ouvre en un clic', async () => {
        render(<PilouModal show onHide={() => {}} />);
        openTab('Aide à la prise en charge');
        fillPatient();
        await chooseCondition('Brûlure');
        fireEvent.click(screen.getByText(/Manuel : Brûlures/));
        expect(screen.getByText('Brûlures', { selector: 'h4' })).toBeTruthy();
        expect(document.querySelector('figure[data-figure="rule-of-nines"] svg')).toBeTruthy();
    });
});
