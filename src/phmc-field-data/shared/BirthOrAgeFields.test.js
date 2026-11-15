import React from 'react';
import { render, screen, act } from '@testing-library/react';
import BirthOrAgeFields from './BirthOrAgeFields';
import generateFlightCertificate from '../../phmc-bbcode-generators/generateFlightCertificate';
import { patientAgeFor, validityMonthsFor } from '../../utils/flightCertificate';
import { VERSION_FIELDS } from '../../constants/formFieldCatalog';
import { isFieldApplicable } from '../../utils/fieldApplicability';

const Harness = ({ initial, props }) => {
    const [formData, setFormData] = React.useState(initial);
    const handleChange = (event) => setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
    return (
        <>
            <BirthOrAgeFields formData={formData} setFormData={setFormData} handleChange={handleChange} {...props} />
            <output data-testid="state">{JSON.stringify(formData)}</output>
        </>
    );
};
const state = () => JSON.parse(screen.getByTestId('state').textContent);

describe('BirthOrAgeFields : date de naissance OU âge', () => {
    test('avec une date de naissance, l’âge se calcule à la date de référence et se range sous le nom d’âge demandé', () => {
        render(<Harness initial={{ patientDateOfBirth: '1984-03-12', dateofdeath: '2026-11-10' }} props={{ ageName: 'patientAge', refDate: '2026-11-10' }} />);
        expect(state().patientAge).toBe('42');
    });
    test('le bouton « Âge » ouvre la saisie de l’âge et retire la date ; revenir à la date retire l’âge saisi', async () => {
        render(<Harness initial={{ patientDateOfBirth: '1984-03-12', date: '2026-11-10' }} props={{}} />);
        await act(async () => { screen.getByRole('button', { name: 'Âge' }).click(); });
        expect(state().patientDateOfBirth).toBe('');
        expect(document.querySelector('input[name="patientAgeYears"]')).toBeTruthy();
        await act(async () => { screen.getByRole('button', { name: 'Date de naissance' }).click(); });
        expect(state().patientAgeYears).toBe('');
        expect(document.querySelector('input[name="patientDateOfBirth"]')).toBeTruthy();
    });
    test('un âge déjà saisi sans date de naissance rouvre directement le mode « âge »', () => {
        render(<Harness initial={{ patientAge: '37' }} props={{ ageName: 'patientAge' }} />);
        expect(document.querySelector('input[name="patientAge"]').value).toBe('37');
    });
});

describe('certificat de vol : âge à la place de la date de naissance', () => {
    test('l’âge saisi sert à la durée de validité (40 ans et plus : durée réduite) et remplace la date sur le certificat', () => {
        expect(patientAgeFor('', '2026-11-10', '45')).toBe(45);
        expect(patientAgeFor('1990-01-01', '2026-11-10', '99')).toBe(36); // la date de naissance prime
        expect(patientAgeFor('', '2026-11-10', '')).toBeNull();
        expect(validityMonthsFor('Class1', '', '2026-11-10', '45')).toBe(6);
        expect(validityMonthsFor('Class1', '', '2026-11-10', '30')).toBe(12);
        const base = { flightCertClass: 'Class1', date: '2026-11-10', flightCertConclusion: 'Apte', patientID: 'PHMC-1' };
        const withAge = generateFlightCertificate({ ...base, patientAgeYears: '45' });
        expect(withAge).toContain('[b]Âge[/b][/td][td]45 ans');
        expect(withAge).not.toContain('Date de naissance');
        expect(generateFlightCertificate({ ...base, patientDateOfBirth: '1990-01-01' })).toContain('Date de naissance');
    });
});

describe('catalogue et page admin', () => {
    test('le certificat de vol et le certificat de décès connaissent la bascule', () => {
        expect(VERSION_FIELDS[41].patientAgeYears).toBe('number');
        expect(VERSION_FIELDS[8].patientAge).toBe('number');
        expect(isFieldApplicable(41, 'patientDateOfBirth', { patientAgeYears: '45' })).toBe(false);
        expect(isFieldApplicable(8, 'patientDateOfBirth', { patientAge: '45' })).toBe(false);
        expect(isFieldApplicable(8, 'patientAge', { patientDateOfBirth: '1984-03-12' })).toBe(false);
        expect(isFieldApplicable(8, 'patientAge', {})).toBe(true);
    });
});
