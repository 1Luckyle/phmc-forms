import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ZipCityField from './ZipCityField';

jest.mock('../utils/cities', () => {
    const list = [{ nom: 'Paleto Bay', cp: '95437' }, { nom: 'Mission Row', cp: '90001' }];
    return {
        useCities: () => list,
        cityOfZip: (cities, zip) => cities.find((c) => c.cp === String(zip || '').trim()) || null,
        getCitiesSnapshot: () => list,
    };
});
jest.mock('../firebase', () => ({ database: {}, auth: {} }));

const Harness = ({ withName = true }) => {
    const [zip, setZip] = React.useState('');
    const [city, setCity] = React.useState('');
    return (
        <>
            <ZipCityField fieldName="patientZIP" zip={zip} onZipChange={setZip} {...(withName ? { city, onCityChange: setCity } : {})} />
            <output data-testid="state">{JSON.stringify({ zip, city })}</output>
        </>
    );
};

describe('ZipCityField', () => {
    test('« Autre » demande le nom de la ville ET le code postal', () => {
        render(<Harness />);
        fireEvent.change(screen.getByLabelText('Ville'), { target: { value: '__autre__' } });
        fireEvent.change(screen.getByLabelText('Nom de la ville'), { target: { value: 'Sandy Shores' } });
        fireEvent.change(screen.getByLabelText('Code postal'), { target: { value: '92274' } });
        expect(JSON.parse(screen.getByTestId('state').textContent)).toEqual({ zip: '92274', city: 'Sandy Shores' });
    });
    test('choisir une ville de la liste remplit le code postal et efface le nom saisi', () => {
        render(<Harness />);
        fireEvent.change(screen.getByLabelText('Ville'), { target: { value: '__autre__' } });
        fireEvent.change(screen.getByLabelText('Nom de la ville'), { target: { value: 'Sandy Shores' } });
        fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Paleto Bay' } });
        expect(JSON.parse(screen.getByTestId('state').textContent)).toEqual({ zip: '95437', city: '' });
    });
    test('sans enregistrement du nom (profils), « Autre » ne demande que le code postal', () => {
        render(<Harness withName={false} />);
        fireEvent.change(screen.getByLabelText('Ville'), { target: { value: '__autre__' } });
        expect(screen.queryByLabelText('Nom de la ville')).toBeNull();
        expect(screen.getByLabelText('Code postal')).toBeTruthy();
    });
    test('le menu porte le nom du champ pour l’infobulle', () => {
        render(<Harness />);
        expect(screen.getByLabelText('Ville').getAttribute('data-field-name')).toBe('patientZIP');
    });
});
