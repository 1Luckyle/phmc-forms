import { placeWithCity } from './places';

jest.mock('./cities', () => ({
    getCitiesSnapshot: () => [{ nom: 'Paleto Bay', cp: '95437' }],
    cityOfZip: (cities, zip) => cities.find((c) => c.cp === String(zip || '').trim()) || null,
}));

describe('placeWithCity', () => {
    test('ville de la liste : nom déduit du code postal', () => {
        expect(placeWithCity('12 Rue', '95437')).toBe('12 Rue, Paleto Bay (95437)');
    });
    test('ville saisie à la main (« Autre ») : son nom accompagne le code postal', () => {
        expect(placeWithCity('12 Rue', '92274', 'Sandy Shores')).toBe('12 Rue, Sandy Shores (92274)');
    });
    test('nom sans code postal et code seul', () => {
        expect(placeWithCity('', '', 'Sandy Shores')).toBe('Sandy Shores');
        expect(placeWithCity('', '92274')).toBe('92274');
    });
});
