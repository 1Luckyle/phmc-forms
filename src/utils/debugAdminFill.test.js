import { debugFieldValue, debugFillChamps } from './debugAdminFill';
import { CONTRACT_TYPES, emptyContractFields, visibleFields, validateDocFields } from './contractDocs';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), onValue: jest.fn() }));

describe('remplissage de test des formulaires d’administration', () => {
    test('chaque type de champ reçoit une valeur plausible', () => {
        expect(debugFieldValue({ key: 'a', label: 'Note', type: 'textarea' })).toMatch(/Texte de test/);
        expect(debugFieldValue({ key: 'date', label: 'Date', type: 'date' })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(debugFieldValue({ key: 'finCdd', label: 'Date de fin', type: 'date' })).not.toBe(debugFieldValue({ key: 'debut', label: 'Début', type: 'date' }));
        expect(debugFieldValue({ key: 's', label: 'S', type: 'select', options: [{ value: '', label: '—' }, { value: 'x', label: 'X' }] })).toBe('x');
        expect(debugFieldValue({ key: 'p', label: 'P', type: 'text', placeholder: 'ex. Médecin' })).toBe('Médecin');
        expect(debugFieldValue({ key: 'c', label: 'C', type: 'checkbox' })).toBeUndefined();
        expect(debugFieldValue({ key: 'r', label: 'R', type: 'role' })).toBeUndefined();
    });
    test('ne remplace jamais une valeur déjà saisie, et remplit en plusieurs passes quand un choix fait apparaître des champs', () => {
        const defs = (values) => [
            { key: 'a', label: 'A', type: 'text' },
            { key: 'mode', label: 'Mode', type: 'select', options: [{ value: 'x', label: 'X' }] },
            ...(values.mode ? [{ key: 'b', label: 'B', type: 'text' }] : []),
        ];
        const filled = debugFillChamps(defs, { a: 'déjà saisi' });
        expect(filled).toMatchObject({ a: 'déjà saisi', mode: 'x' });
        expect(filled.b).toBe('Test — B');
    });
    test.each(Object.keys(CONTRACT_TYPES))('contrat « %s » : tous les champs visibles obligatoires sont remplis (hors contrat ou convocation de référence)', (type) => {
        const filled = debugFillChamps((champs) => visibleFields(type, champs, {}), emptyContractFields(type), { role: 'Médecin Titulaire', echelon: 'Échelon 1' });
        const missing = visibleFields(type, filled, {}).filter((field) => field.required && !['contratRef', 'convocationRef', 'checkbox'].includes(field.type) && String(filled[field.key] ?? '').trim() === '');
        expect(missing.map((field) => field.key)).toEqual([]);
    });
});

describe('accords commerciaux : remplissage de test', () => {
    const agreements = require('./commercialAgreements');
    test.each(Object.keys(agreements.AGREEMENT_TYPES))('accord « %s » : le remplissage de test donne un brouillon sans erreur', (type) => {
        const filled = debugFillChamps((values) => agreements.visibleFields(type, values), agreements.emptyAgreementFields(type));
        expect(agreements.validateAgreement(type, filled).errors).toEqual([]);
    });
});
