import { shouldLogLogin, forgetLogin, LOGIN_LOG_COOLDOWN_MS } from './activityLog';

jest.mock('../firebase', () => ({ database: {}, auth: {} }));
jest.mock('firebase/database', () => ({ ref: jest.fn(), push: jest.fn(), set: jest.fn() }));

const memoryStorage = () => {
    const data = {};
    return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
};
const HOUR = 3600000;

describe('connexions répétées : une ligne de journal par personne toutes les 6 h', () => {
    test('la première connexion est journalisée, les suivantes (autres onglets, rechargements) non', () => {
        const storage = memoryStorage();
        const t0 = 1_700_000_000_000;
        expect(shouldLogLogin('u1', 'site', { now: t0, storage })).toBe(true);
        expect(shouldLogLogin('u1', 'site', { now: t0 + 1000, storage })).toBe(false);
        expect(shouldLogLogin('u1', 'site', { now: t0 + HOUR, storage })).toBe(false);
        expect(shouldLogLogin('u1', 'site', { now: t0 + LOGIN_LOG_COOLDOWN_MS - 1, storage })).toBe(false);
    });
    test('après 6 h, une nouvelle ligne est journalisée, puis le délai repart de là', () => {
        const storage = memoryStorage();
        const t0 = 1_700_000_000_000;
        shouldLogLogin('u1', 'site', { now: t0, storage });
        expect(shouldLogLogin('u1', 'site', { now: t0 + LOGIN_LOG_COOLDOWN_MS, storage })).toBe(true);
        expect(shouldLogLogin('u1', 'site', { now: t0 + LOGIN_LOG_COOLDOWN_MS + HOUR, storage })).toBe(false);
    });
    test('chaque personne et chaque type de connexion ont leur propre délai', () => {
        const storage = memoryStorage();
        const t0 = 1_700_000_000_000;
        expect(shouldLogLogin('u1', 'site', { now: t0, storage })).toBe(true);
        expect(shouldLogLogin('u2', 'site', { now: t0 + 1, storage })).toBe(true);
        expect(shouldLogLogin('u1', 'admin', { now: t0 + 2, storage })).toBe(true);
        expect(shouldLogLogin('u1', 'admin', { now: t0 + 3, storage })).toBe(false);
    });
    test('une déconnexion volontaire remet le compteur à zéro', () => {
        const storage = memoryStorage();
        const t0 = 1_700_000_000_000;
        shouldLogLogin('u1', 'site', { now: t0, storage });
        shouldLogLogin('u1', 'admin', { now: t0, storage });
        forgetLogin('u1', { storage });
        expect(shouldLogLogin('u1', 'site', { now: t0 + 1000, storage })).toBe(true);
        expect(shouldLogLogin('u1', 'admin', { now: t0 + 1000, storage })).toBe(true);
    });
    test('cas limites : pas d\'identifiant, stockage indisponible, horloge dans le futur → on journalise', () => {
        expect(shouldLogLogin('', 'site', { storage: memoryStorage() })).toBe(true);
        const broken = { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); }, removeItem: () => { throw new Error('bloqué'); } };
        expect(shouldLogLogin('u1', 'site', { storage: broken })).toBe(true);
        expect(() => forgetLogin('u1', { storage: broken })).not.toThrow();
        const storage = memoryStorage();
        storage.setItem('activityLoginAt:site:u1', String(1_700_000_000_000 + 10 * HOUR));
        expect(shouldLogLogin('u1', 'site', { now: 1_700_000_000_000, storage })).toBe(true);
    });
});
