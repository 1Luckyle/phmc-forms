import React from 'react';
import { render } from '@testing-library/react';
import { SimpleSelect } from './PatientGeneralInfo';

jest.mock('../../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), onValue: jest.fn() }));

describe('SimpleSelect : choix sans texte', () => {
    test('une entrée vide de la liste n’apparaît pas comme une ligne blanche', () => {
        const { container } = render(<SimpleSelect name="t" value="" onChange={() => {}} placeholder="Titre" options={[{ value: 'Mr', label: 'M.' }, { value: 'X', label: '' }, { value: 'Y', label: '   ' }, { value: 'Mrs', label: 'Mme' }]} />);
        const labels = Array.from(container.querySelectorAll('option')).map((option) => option.textContent);
        expect(labels).toEqual(['Titre', 'M.', 'Mme']);
    });
    test('la valeur déjà enregistrée reste affichée même si elle n’est plus dans la liste', () => {
        const { container } = render(<SimpleSelect name="t" value="Ancien" onChange={() => {}} placeholder="Titre" options={[{ value: 'Mr', label: 'M.' }]} />);
        expect(Array.from(container.querySelectorAll('option')).map((option) => option.textContent)).toEqual(['Titre', 'Ancien', 'M.']);
    });
});
