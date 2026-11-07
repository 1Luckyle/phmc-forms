import { splitFullName, joinFullName, toFrenchGender, titleLabel, withTitle } from './patientIdentity';
import { aggregatePresetText } from '../phmc-field-data/shared/PresetTextField';

test('découpage du nom complet', () => {
    expect(splitFullName('Jane Marie Doe')).toEqual({ first: 'Jane', middle: 'Marie', last: 'Doe' });
    expect(splitFullName('Jane Doe')).toEqual({ first: 'Jane', middle: '', last: 'Doe' });
    expect(splitFullName('  Jane ')).toEqual({ first: 'Jane', middle: '', last: '' });
    expect(splitFullName('')).toEqual({ first: '', middle: '', last: '' });
    expect(joinFullName('Jane', '', 'Doe')).toBe('Jane Doe');
});

test('genre et titre en français', () => {
    expect(toFrenchGender('Male')).toBe('Homme');
    expect(toFrenchGender('Female')).toBe('Femme');
    expect(toFrenchGender('Homme')).toBe('Homme');
    expect(toFrenchGender('Non-binaire')).toBe('Non-binaire');
    expect(titleLabel('Mrs')).toBe('Mme');
    expect(titleLabel('Mstr')).toBe('Maître');
});

test('texte regroupé des champs à choix par défaut', () => {
    expect(aggregatePresetText(['Asthme', 'Diabète'], 'depuis 2020')).toBe('Asthme ; Diabète ; depuis 2020');
    expect(aggregatePresetText([], '  ')).toBe('');
    expect(aggregatePresetText(['Aucune allergie connue'], '')).toBe('Aucune allergie connue');
});

test('le titre se place devant le nom, jamais devant un texte « Non renseigné »', () => {
    expect(withTitle('Mr', 'Jean Dupont')).toBe('M. Jean Dupont');
    expect(withTitle('', 'Jean Dupont')).toBe('Jean Dupont');
    expect(withTitle('Mrs', 'Non renseigné')).toBe('Non renseigné');
    expect(withTitle('Mrs', '')).toBe('');
});
