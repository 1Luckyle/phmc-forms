import { emptyRequest, validateRequest, serviceOptionsFrom, serviceLabel, DEFAULT_SERVICES, OTHER_SERVICE } from './lawEnforcement';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), get: jest.fn(), set: jest.fn(), push: jest.fn(), remove: jest.fn(), query: jest.fn(), orderByChild: jest.fn(), equalTo: jest.fn() }));

const valid = { ...emptyRequest('soins'), service: 'LSPD', serviceChoice: 'LSPD', agent: 'Off. Dupont #4521', decision: 'refuse' };

describe('Demandes des forces de l\'ordre : service demandeur en menu déroulant', () => {
    test('un service doit être choisi', () => {
        expect(validateRequest(valid)).toEqual([]);
        expect(validateRequest({ ...valid, service: '', serviceChoice: '' })).toEqual(['Choisissez le service demandeur.']);
    });
    test('« Autre service » : il faut préciser son nom', () => {
        expect(validateRequest({ ...valid, serviceChoice: OTHER_SERVICE, service: '' })).toEqual(['Précisez le service demandeur.']);
        expect(validateRequest({ ...valid, serviceChoice: OTHER_SERVICE, service: '   ' })).toEqual(['Précisez le service demandeur.']);
        expect(validateRequest({ ...valid, serviceChoice: OTHER_SERVICE, service: 'FIB' })).toEqual([]);
    });
    test('la liste est celle de la base (tableau de { value, label } ou de textes), à défaut la liste par défaut', () => {
        expect(serviceOptionsFrom([{ value: 'LSPD', label: 'Los Santos Police' }, 'LSSD', { value: 'X' }, null, {}])).toEqual([
            { value: 'LSPD', label: 'Los Santos Police' }, { value: 'LSSD', label: 'LSSD' }, { value: 'X', label: 'X' },
        ]);
        expect(serviceOptionsFrom(undefined)).toBe(DEFAULT_SERVICES);
        expect(serviceOptionsFrom([])).toBe(DEFAULT_SERVICES);
        expect(serviceOptionsFrom({ a: { value: 'LSFD', label: 'LSFD' } })).toEqual([{ value: 'LSFD', label: 'LSFD' }]);
        expect(DEFAULT_SERVICES.map((option) => option.value)).toEqual(expect.arrayContaining(['LSPD', 'LSSD', 'LSFD', 'SANFIRE', 'SADCR', 'LSGOV', 'PHMC', '911 Call', 'Protech']));
    });
    test('libellé affiché dans le registre : liste, ancien texte libre conservé tel quel', () => {
        expect(serviceLabel('911 Call')).toBe('Emergency 911 Dispatch');
        expect(serviceLabel('LSPD')).toBe('LSPD');
        expect(serviceLabel('FIB')).toBe('FIB');
        expect(serviceLabel('FIB', [{ value: 'FIB', label: 'Federal Investigation Bureau' }])).toBe('Federal Investigation Bureau');
    });
});
