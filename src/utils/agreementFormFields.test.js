import { AGREEMENT_TYPES, fieldsFor, visibleFields, emptyAgreementFields } from './commercialAgreements';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), update: jest.fn(), push: jest.fn(), remove: jest.fn(), query: jest.fn(), orderByChild: jest.fn(), equalTo: jest.fn() }));

describe('accords commerciaux : placeholders et libellés', () => {
    test('tout champ saisi au clavier porte un placeholder, pour chaque type d\'accord', () => {
        const missing = [];
        Object.keys(AGREEMENT_TYPES).forEach((type) => fieldsFor(type).forEach((field) => {
            if (['text', 'textarea', 'number'].includes(field.type) && !String(field.placeholder || '').trim()) missing.push(`${type}/${field.key}`);
        }));
        expect(missing).toEqual([]);
    });

    test('aucun libellé, aide ni placeholder ne dit « facultatif » : les couleurs le disent', () => {
        const wordy = [];
        Object.keys(AGREEMENT_TYPES).forEach((type) => fieldsFor(type).forEach((field) => {
            if (/facultatif/i.test(`${field.label} ${field.help || ''} ${field.placeholder || ''}`)) wordy.push(`${type}/${field.key}`);
        }));
        expect(wordy).toEqual([]);
    });

    test('les cases à cocher existent toujours (obligatoire ou facultatif se lit à leur couleur) et démarrent décochées sauf recommandation', () => {
        const fields = emptyAgreementFields('prestation');
        expect(fields.confidentialite).toBe(true);
        expect(fields.assurance).toBe(false);
        expect(visibleFields('prestation', fields).filter((field) => field.type === 'checkbox').length).toBeGreaterThanOrEqual(2);
    });
});
