import { notifyUser, notifyGroup, MAIL_TYPES } from './notifications';

const mockSet = jest.fn();
jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: { uid: 'me' } } }));
jest.mock('firebase/database', () => ({
    ref: jest.fn((db, path) => path), push: jest.fn((reference) => `${reference}/new`), set: (...args) => mockSet(...args),
    get: jest.fn(), update: jest.fn(), onValue: jest.fn(), query: jest.fn(), limitToLast: jest.fn(),
}));

beforeEach(() => { mockSet.mockReset(); mockSet.mockResolvedValue(); });
const lastEntry = () => mockSet.mock.calls[mockSet.mock.calls.length - 1][1];

describe('notifications : cloche + mail', () => {
    test('partage, copie et décès partent toujours aussi par mail', async () => {
        expect([...MAIL_TYPES].sort()).toEqual(['copie', 'deces', 'partage']);
        for (const type of ['partage', 'copie', 'deces']) {
            await notifyUser('u1', { type, titre: 'Titre' });
            expect(lastEntry().mail).toBe(true);
        }
    });
    test('les autres événements n\'ont pas de mail, sauf demande explicite', async () => {
        await notifyUser('u1', { type: 'statut', titre: 'Exemption accordée' });
        expect(lastEntry()).not.toHaveProperty('mail');
        await notifyUser('u1', { type: 'statut', titre: 'Ordonnance', mail: true });
        expect(lastEntry().mail).toBe(true);
        await notifyUser('u1', { type: 'statut', titre: 'x', mail: 'oui' });
        expect(lastEntry()).not.toHaveProperty('mail');
    });
    test('notification de groupe : mail seulement si demandé', async () => {
        await notifyGroup('admin', { type: 'demande', titre: 'Contestation de décès : PHMC-1', mail: true });
        expect(lastEntry().mail).toBe(true);
        await notifyGroup('admin', { type: 'demande', titre: 'Autre demande' });
        expect(lastEntry()).not.toHaveProperty('mail');
    });
    test('jamais de notification à soi-même', async () => {
        expect(await notifyUser('me', { type: 'partage', titre: 'x' })).toBe(false);
    });
});
