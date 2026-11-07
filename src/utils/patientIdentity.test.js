import { splitFullName, joinFullName, toFrenchGender, phoneWithType, titleLabel } from './patientIdentity';
import { aggregatePresetText } from '../phmc-field-data/shared/PresetTextField';

test('découpage du nom complet', () => {
    expect(splitFullName('Jane Marie Doe')).toEqual({ first: 'Jane', middle: 'Marie', last: 'Doe' });
    expect(splitFullName('Jane Doe')).toEqual({ first: 'Jane', middle: '', last: 'Doe' });
    expect(splitFullName('  Jane ')).toEqual({ first: 'Jane', middle: '', last: '' });
    expect(splitFullName('')).toEqual({ first: '', middle: '', last: '' });
    expect(joinFullName('Jane', '', 'Doe')).toBe('Jane Doe');
});

test('genre, téléphone et titre en français', () => {
    expect(toFrenchGender('Male')).toBe('Homme');
    expect(toFrenchGender('Female')).toBe('Femme');
    expect(toFrenchGender('Homme')).toBe('Homme');
    expect(toFrenchGender('Non-binaire')).toBe('Non-binaire');
    expect(phoneWithType('555-0142', 'Home')).toBe('555-0142 (Domicile)');
    expect(phoneWithType('555-0142', '')).toBe('555-0142');
    expect(titleLabel('Mrs')).toBe('Mme');
    expect(titleLabel('Mstr')).toBe('Maître');
});

test('texte regroupé des champs à choix par défaut', () => {
    expect(aggregatePresetText(['Asthme', 'Diabète'], 'depuis 2020')).toBe('Asthme ; Diabète ; depuis 2020');
    expect(aggregatePresetText([], '  ')).toBe('');
    expect(aggregatePresetText(['Aucune allergie connue'], '')).toBe('Aucune allergie connue');
});
