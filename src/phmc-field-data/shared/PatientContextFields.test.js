// Contexte patient : bascule « date de naissance / âge » et listes de choix pour allergies, antécédents et traitements habituels.
import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

jest.mock('../../firebase', () => ({ database: {}, auth: {} }));
jest.mock('../../utils/dossierLookup', () => ({ usePatientDossier: () => ({ status: 'idle', donnees: null }) }));

const PatientContextFields = require('./PatientContextFields').default;
const { itemsOf } = require('./PresetTextField');

const Harness = ({ initial = {}, showHistory = true }) => {
    const [formData, setFormData] = useState(initial);
    const handleChange = (event) => setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    return (
        <>
            <PatientContextFields formData={formData} setFormData={setFormData} handleChange={handleChange} showHistory={showHistory} />
            <pre data-testid="state">{JSON.stringify(formData)}</pre>
        </>
    );
};
const stateOf = () => JSON.parse(screen.getByTestId('state').textContent);

describe('champ à choix par défaut : un seul champ', () => {
    test('les étiquettes viennent des choix enregistrés, de l’ancien texte libre, ou du texte regroupé d’un ancien rapport', () => {
        expect(itemsOf({ patientAllergiesPresets: ['Latex'], patientAllergiesFree: '' }, 'patientAllergies')).toEqual(['Latex']);
        expect(itemsOf({ patientAllergiesPresets: ['Latex'], patientAllergiesFree: 'Noix ; Latex' }, 'patientAllergies')).toEqual(['Latex', 'Noix']);
        expect(itemsOf({ patientAllergies: 'Pénicilline ; Aspirine' }, 'patientAllergies')).toEqual(['Pénicilline', 'Aspirine']);
        expect(itemsOf({ patientAllergiesPresets: [], patientAllergiesFree: '', patientAllergies: 'Pénicilline' }, 'patientAllergies')).toEqual(['Pénicilline']);
        expect(itemsOf({}, 'patientAllergies')).toEqual([]);
    });
});

describe('contexte patient', () => {
    test('par défaut, la date de naissance est demandée et l’âge se calcule', async () => {
        render(<Harness initial={{ date: '2026-11-11' }} />);
        expect(document.querySelector('input[name="patientDateOfBirth"]')).toBeTruthy();
        expect(document.querySelector('input[name="patientAgeYears"]')).toBeNull();
        await act(async () => { fireEvent.change(document.querySelector('input[name="patientDateOfBirth"]'), { target: { name: 'patientDateOfBirth', value: '1990-11-11' } }); });
        expect(stateOf().patientAgeYears).toBe('36');
    });

    test('le bouton « Âge » permet de saisir l’âge quand la date de naissance est inconnue ; revenir à la date retire l’âge saisi', async () => {
        render(<Harness initial={{ date: '2026-11-11', patientDateOfBirth: '1990-11-11', patientAgeYears: '36' }} />);
        await act(async () => { screen.getByRole('button', { name: 'Âge' }).click(); });
        expect(document.querySelector('input[name="patientDateOfBirth"]')).toBeNull();
        expect(stateOf().patientDateOfBirth).toBe('');
        await act(async () => { fireEvent.change(document.querySelector('input[name="patientAgeYears"]'), { target: { name: 'patientAgeYears', value: '34' } }); });
        expect(stateOf().patientAgeYears).toBe('34');
        expect(stateOf().patientDateOfBirth).toBe('');
        await act(async () => { screen.getByRole('button', { name: 'Date de naissance' }).click(); });
        expect(document.querySelector('input[name="patientDateOfBirth"]')).toBeTruthy();
        expect(stateOf().patientAgeYears).toBe('');
    });

    test('un formulaire rechargé avec un âge seul s’ouvre en saisie d’âge', () => {
        render(<Harness initial={{ patientAgeYears: '41' }} />);
        expect(document.querySelector('input[name="patientAgeYears"]').value).toBe('41');
        expect(document.querySelector('input[name="patientDateOfBirth"]')).toBeNull();
    });

    test('allergies, antécédents et traitements habituels : un seul champ (choix + texte écrit), repris dans le champ comme avant', async () => {
        render(<Harness />);
        ['patientAllergies', 'patientChronicDiseases', 'patientCurrentMedicine'].forEach((name) => {
            expect(document.querySelector(`input[type="hidden"][name="${name}"]`)).toBeTruthy();
            expect(document.querySelector(`textarea[name="${name}Free"]`)).toBeNull();
        });
        const input = document.querySelector('input[type="hidden"][name="patientAllergies"]').closest('[class*="-container"]').querySelector('input:not([type="hidden"])');
        await act(async () => { fireEvent.change(input, { target: { value: 'Pénicilline' } }); fireEvent.blur(input); });
        expect(stateOf().patientAllergies).toBe('Pénicilline');
        expect(stateOf().patientAllergiesPresets).toEqual(['Pénicilline']);
    });

    test('sans historique (évaluation physique, psychiatrie), seuls la date, l’âge et le sexe sont demandés', () => {
        render(<Harness showHistory={false} />);
        expect(document.querySelector('input[type="hidden"][name="patientAllergies"]')).toBeNull();
        expect(document.querySelector('select[name="patientSex"]')).toBeTruthy();
    });
});
