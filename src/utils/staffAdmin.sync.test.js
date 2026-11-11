// La synchronisation admin pose idsPatientParCompte/{uid} : sans cette table, les règles Firebase ne peuvent pas bloquer un membre du personnel dont le patient est déclaré décédé.
let mockDb = {};
const mockPath = (path) => String(path || '').split('/').filter(Boolean);
const mockGetAt = (path) => mockPath(path).reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), mockDb);
const mockSetAt = (path, value) => {
    const keys = mockPath(path);
    let node = mockDb;
    keys.slice(0, -1).forEach((key) => { if (!node[key] || typeof node[key] !== 'object') node[key] = {}; node = node[key]; });
    if (value === null || value === undefined) delete node[keys[keys.length - 1]]; else node[keys[keys.length - 1]] = value;
};
jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: { uid: 'A' } } }));
jest.mock('firebase/database', () => ({
    ref: (db, path = '') => ({ path }),
    get: async (reference) => { const value = mockGetAt(reference.path); return { exists: () => value !== undefined && value !== null, val: () => (value === undefined ? null : JSON.parse(JSON.stringify(value))) }; },
    set: async (reference, value) => mockSetAt(reference.path, value),
    remove: async (reference) => mockSetAt(reference.path, null),
    update: async (reference, values) => Object.entries(values).forEach(([key, value]) => mockSetAt(`${reference.path ? `${reference.path}/` : ''}${key}`, value)),
    push: jest.fn(), onValue: jest.fn(), query: jest.fn(), orderByChild: jest.fn(), equalTo: jest.fn(),
}));

const { syncStaffUids } = require('./staffAdmin');

describe("synchronisation admin : ID patient de chaque compte du personnel", () => {
    beforeEach(() => {
        mockDb = {
            staff: {
                phmc: {
                    a: { uid: 'S1', name: 'Dr. Rose Callahan', rank: 'Médecin Titulaire', badge: 'PHMC-4521', gtawCharacterId: 28761 },
                    b: { uid: 'S2', name: 'Inf. Paul Martin', rank: 'Infirmier(ère)', badge: 'PHMC-4600' },
                    c: { name: 'Sans compte', badge: 'PHMC-1' },
                },
                coroner: { d: { uid: 'D1', name: 'Dr. Légiste', rank: 'Médecin Légiste', badge: 'DMEC-77' } },
            },
            idsPatientParCompte: { OLD: 'PHMC-1', S2: 'PHMC-9999' },
        };
    });

    test('table posée (ID du personnage, sinon badge), corrigée, et nettoyée pour un compte qui n’a plus de fiche', async () => {
        await syncStaffUids();
        expect(mockDb.idsPatientParCompte).toEqual({ S1: 'PHMC-28761', S2: 'PHMC-4600', D1: 'PHMC-77' });
        expect(mockDb.staffUIDs).toMatchObject({ S1: true, S2: true, D1: true });
    });
});
