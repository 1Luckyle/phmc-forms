// Base simulée en mémoire : assez pour jouer le transfert d'un ID temporaire vers l'ID réel de bout en bout.
let mockDb = {};
const mockPath = (path) => String(path || '').split('/').filter(Boolean);
const mockGetAt = (path) => mockPath(path).reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), mockDb);
const mockSetAt = (path, value) => {
    const keys = mockPath(path);
    if (!keys.length) { mockDb = value || {}; return; }
    let node = mockDb;
    keys.slice(0, -1).forEach((key) => { if (!node[key] || typeof node[key] !== 'object') node[key] = {}; node = node[key]; });
    if (value === null || value === undefined) delete node[keys[keys.length - 1]]; else node[keys[keys.length - 1]] = JSON.parse(JSON.stringify(value));
};
jest.mock('../firebase', () => ({ database: { __db: true }, auth: { currentUser: { uid: 'D1' } } }));
jest.mock('firebase/database', () => ({
    ref: (db, path = '') => ({ path }),
    get: async (reference) => { const value = mockGetAt(reference.path); return { exists: () => value !== undefined && value !== null, val: () => (value === undefined ? null : JSON.parse(JSON.stringify(value))) }; },
    set: async (reference, value) => mockSetAt(reference.path, value),
    remove: async (reference) => mockSetAt(reference.path, null),
    update: async (reference, values) => Object.entries(values).forEach(([key, value]) => mockSetAt(`${reference.path ? `${reference.path}/` : ''}${key}`, value)),
}));
jest.mock('./patientRecords', () => ({ findPatientNodes: async (id) => [id] }));
let mockFrozen = {};
jest.mock('./judicialFreeze', () => ({ loadFreeze: async (path) => mockFrozen[path] || null, isFrozen: (entry) => !!entry && entry.actif === true }));
jest.mock('./activityLog', () => ({ logActivity: jest.fn() }));
const mockNotifyGroup = jest.fn();
jest.mock('./notifications', () => ({ notifyGroup: (...args) => mockNotifyGroup(...args) }));

const {
    generateTemporaryId, isTemporaryId, nameKey, findTemporaryIdsByName, buildTransferUpdates, registerTemporaryId, assignTemporaryId, loadTemporaryIdAlias, requestRealIdAssignment,
} = require('./temporaryIds');

describe('identifiants temporaires : forme et recherche par nom', () => {
    test('TMP-XXXXX sans caractères ambigus, reconnu quelle que soit la casse', () => {
        for (let i = 0; i < 500; i += 1) {
            const id = generateTemporaryId();
            expect(id).toMatch(/^TMP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
            expect(isTemporaryId(id)).toBe(true);
        }
        expect(generateTemporaryId(() => 0)).toBe('TMP-AAAAA');
        expect(isTemporaryId('tmp-abcde')).toBe(true);
        ['PHMC-2752', 'TMP-ABC', 'TMP-ABCDEF', 'TMP-ABC1E', '', null].forEach((value) => expect(isTemporaryId(value)).toBe(false));
    });

    test('au moins deux lettres : un ID tout en chiffres ne se confond jamais avec un ID patient', () => {
        // Même avec un tirage aléatoire qui ne donnerait que des chiffres, deux lettres sont garanties.
        const digitsOnly = () => 0.999;
        for (const random of [digitsOnly, () => 0.5, () => 0.9999, () => 0.001]) {
            const suffix = generateTemporaryId(random).slice(4);
            expect((suffix.match(/[A-Z]/g) || []).length).toBeGreaterThanOrEqual(2);
        }
        for (let i = 0; i < 2000; i += 1) expect((generateTemporaryId().slice(4).match(/[A-Z]/g) || []).length).toBeGreaterThanOrEqual(2);
        ['TMP-99999', 'TMP-23456', 'TMP-9A999', 'TMP-A9999', 'tmp-99a99'].forEach((value) => expect(isTemporaryId(value)).toBe(false));
        ['TMP-99AA9', 'TMP-A9A99', 'TMP-AB234'].forEach((value) => expect(isTemporaryId(value)).toBe(true));
    });

    test('le même nom se retrouve malgré l’ordre, les accents et la casse ; un nom partiel de deux mots suffit', () => {
        expect(nameKey('Jean  DUPONT')).toBe(nameKey('dupont, jean'));
        expect(nameKey('Éloïse Müller')).toBe('eloise muller');
        const registry = {
            'TMP-AAAAA': { nom: 'Jean Michel Dupont', creeLe: 1, statut: 'temporaire' },
            'TMP-BBBBB': { nom: 'Dupont Jean', creeLe: 2, statut: 'temporaire' },
            'TMP-CCCCC': { nom: 'Jean Dupont', creeLe: 3, statut: 'attribue', idReel: 'PHMC-7' },
            'TMP-DDDDD': { nom: 'Marie Durand', creeLe: 4, statut: 'temporaire' },
            'TMP-EEEEE': { nom: 'Dupont', creeLe: 5, statut: 'temporaire' },
        };
        expect(findTemporaryIdsByName(registry, 'jean dupont').map((m) => m.id)).toEqual(['TMP-BBBBB', 'TMP-AAAAA']);
        expect(findTemporaryIdsByName(registry, 'Dupont').map((m) => m.id)).toEqual(['TMP-EEEEE']);
        expect(findTemporaryIdsByName(registry, '')).toEqual([]);
        expect(findTemporaryIdsByName(null, 'Jean')).toEqual([]);
    });
});

describe('transfert vers l’ID réel (écritures)', () => {
    test('index déplacé, ID et titre réécrits dans le rapport et son BBCode', () => {
        const { updates, moved } = buildTransferUpdates({
            tempId: 'TMP-ABCDE', realId: 'PHMC-2752',
            items: [{
                indexKey: 'k1', entry: { reportPath: 'savedReports/D_One/k1', title: '[TMP-ABCDE] Certificat de Décès - 11/11/2026', originalKey: '[TMP-ABCDE] Certificat de Décès - 11/11/2026', bbCodeVersion: 8, visibility: 'staff-only' },
                reportPath: 'savedReports/D_One/k1', report: { title: '[TMP-ABCDE] Certificat de Décès - 11/11/2026', originalKey: '[TMP-ABCDE] Certificat de Décès - 11/11/2026', bbCode: 'ID PATIENT: TMP-ABCDE et TMP-ABCDE', data: { patientID: 'TMP-ABCDE' } },
            }, { indexKey: 'k2', entry: { reportPath: 'savedReports/D_Two/k2', title: null }, reportPath: '', report: null }],
        });
        expect(moved).toBe(2);
        expect(updates['patientRecords/TMP-ABCDE/k1']).toBeNull();
        expect(updates['patientRecords/PHMC-2752/k1']).toMatchObject({ title: '[PHMC-2752] Certificat de Décès - 11/11/2026', visibility: 'staff-only', bbCodeVersion: 8 });
        expect(updates['savedReports/D_One/k1/data/patientID']).toBe('PHMC-2752');
        expect(updates['savedReports/D_One/k1/title']).toBe('[PHMC-2752] Certificat de Décès - 11/11/2026');
        expect(updates['savedReports/D_One/k1/bbCode']).toBe('ID PATIENT: PHMC-2752 et PHMC-2752');
        // Sans rapport lisible : l'index est tout de même déplacé, rien n'est écrit dans un rapport.
        expect(updates['patientRecords/PHMC-2752/k2']).toBeDefined();
        expect(Object.keys(updates).some((path) => path.startsWith('savedReports/D_Two'))).toBe(false);
    });
});

describe('identifiants temporaires : registre et attribution (base simulée)', () => {
    beforeEach(() => {
        mockNotifyGroup.mockReset();
        mockFrozen = {};
        mockDb = {};
    });

    test('un ID temporaire s’enregistre une fois, au nom du DMEC connecté', async () => {
        const id = await registerTemporaryId({ nom: 'Jean Dupont', byName: 'Dr. Médecin Légiste' });
        expect(isTemporaryId(id)).toBe(true);
        expect(mockDb.identifiantsTemporaires[id]).toMatchObject({ nom: 'Jean Dupont', nomCle: 'dupont jean', uid: 'D1', par: 'Dr. Médecin Légiste', statut: 'temporaire' });
        const other = await registerTemporaryId({ nom: '' });
        expect(other).not.toBe(id);
        expect(mockDb.identifiantsTemporaires[other].nom).toBe('Inconnu(e)');
        expect(await loadTemporaryIdAlias(id)).toMatchObject({ statut: 'temporaire' });
        expect(await loadTemporaryIdAlias('PHMC-1')).toBeNull();
    });

    test('l’attribution transfère les rapports, le marqueur de décès et les rapports publics, puis garde l’alias', async () => {
        mockDb = {
            identifiantsTemporaires: { 'TMP-ABCDE': { nom: 'Jean Dupont', creeLe: 1, uid: 'D1', statut: 'temporaire' } },
            patientRecords: {
                'TMP-ABCDE': {
                    k1: { reportPath: 'savedReports/D_One/k1', title: '[TMP-ABCDE] Services de Médecine Légale - 11/11/2026', bbCodeVersion: 1, visibility: 'staff-only' },
                    k2: { reportPath: 'savedReports/D_Two/k2', title: '[TMP-ABCDE] Rapport d\'Autopsie - 12/11/2026', bbCodeVersion: 4, visibility: 'staff-only' },
                    k3: { reportPath: 'savedReports/D_One/k3', title: '[TMP-ABCDE] Certificat de Décès - 12/11/2026', bbCodeVersion: 8, visibility: 'staff-only' },
                },
            },
            savedReports: {
                D_One: {
                    k1: { title: '[TMP-ABCDE] Services de Médecine Légale - 11/11/2026', bbCode: 'ID: TMP-ABCDE', data: { patientID: 'TMP-ABCDE' } },
                    k3: { title: '[TMP-ABCDE] Certificat de Décès - 12/11/2026', bbCode: 'ID: TMP-ABCDE', data: { patientID: 'TMP-ABCDE' } },
                },
                D_Two: { k2: { title: '[TMP-ABCDE] Rapport d\'Autopsie - 12/11/2026', bbCode: 'ID: TMP-ABCDE', data: { patientID: 'TMP-ABCDE' } } },
            },
            patientsDecedes: { 'TMP-ABCDE': { depuis: 5, uid: 'D1', rapport: 'savedReports/D_One/k1' } },
            rapportsPublics: { pub: { reportPath: 'savedReports/D_Two/k2', uid: 'D2', publieLe: 1, patientID: 'TMP-ABCDE' }, autre: { reportPath: 'x', uid: 'D2', publieLe: 1, patientID: 'PHMC-9' } },
        };
        mockFrozen = { 'savedReports/D_One/k3': { actif: true } }; // gel judiciaire : intouchable

        const result = await assignTemporaryId({ tempId: 'tmp-abcde', realId: '2752', byName: 'Admin Test' });
        expect(result).toMatchObject({ moved: 2, frozen: ['k3'], publics: 1, deathMarker: true });

        expect(Object.keys(mockDb.patientRecords['PHMC-2752'])).toEqual(['k1', 'k2']);
        expect(mockDb.patientRecords['PHMC-2752'].k1.title).toBe('[PHMC-2752] Services de Médecine Légale - 11/11/2026');
        expect(mockDb.patientRecords['TMP-ABCDE']).toEqual({ k3: expect.any(Object) }); // le rapport gelé reste sous l'ID temporaire
        expect(mockDb.savedReports.D_One.k1.data.patientID).toBe('PHMC-2752');
        expect(mockDb.savedReports.D_One.k1.bbCode).toBe('ID: PHMC-2752');
        expect(mockDb.savedReports.D_Two.k2.title).toBe("[PHMC-2752] Rapport d'Autopsie - 12/11/2026");
        expect(mockDb.savedReports.D_One.k3.data.patientID).toBe('TMP-ABCDE');
        expect(mockDb.patientsDecedes['PHMC-2752']).toMatchObject({ depuis: 5, uid: 'D1' });
        expect(mockDb.patientsDecedes['TMP-ABCDE']).toBeUndefined();
        expect(mockDb.rapportsPublics.pub.patientID).toBe('PHMC-2752');
        expect(mockDb.rapportsPublics.autre.patientID).toBe('PHMC-9');
        expect(mockDb.identifiantsTemporaires['TMP-ABCDE']).toMatchObject({ statut: 'attribue', idReel: 'PHMC-2752', attribuePar: 'Admin Test', nom: 'Jean Dupont' });
    });

    test('un marqueur de décès déjà posé sur l’ID réel est conservé', async () => {
        mockDb = {
            patientRecords: { 'TMP-ABCDE': { k1: { reportPath: 'savedReports/D_One/k1', title: 't' } } },
            savedReports: { D_One: { k1: { title: 't', bbCode: 'x', data: { patientID: 'TMP-ABCDE' } } } },
            patientsDecedes: { 'TMP-ABCDE': { depuis: 5, uid: 'D1' }, 'PHMC-2752': { depuis: 1, uid: 'D2' } },
        };
        const result = await assignTemporaryId({ tempId: 'TMP-ABCDE', realId: 'PHMC-2752' });
        expect(result.deathMarker).toBe(false);
        expect(mockDb.patientsDecedes['PHMC-2752']).toEqual({ depuis: 1, uid: 'D2' });
        expect(mockDb.patientsDecedes['TMP-ABCDE']).toBeUndefined();
    });

    test('refus : ce n’est pas un ID temporaire, ID réel invalide ou identique', async () => {
        await expect(assignTemporaryId({ tempId: 'PHMC-1', realId: 'PHMC-2' })).rejects.toThrow(/temporaire/);
        await expect(assignTemporaryId({ tempId: 'TMP-ABCDE', realId: '' })).rejects.toThrow(/ID réel/);
        await expect(assignTemporaryId({ tempId: 'TMP-ABCDE', realId: 'TMP-FGHJK' })).rejects.toThrow(/ID réel/);
    });

    test('un ancien ID temporaire attribué mène à l’ID réel ; un ID temporaire ouvert, un ID réel ou inconnu restent tels quels', async () => {
        mockDb = { identifiantsTemporaires: {
            'TMP-ABCDE': { nom: 'Jean', creeLe: 1, uid: 'D1', statut: 'attribue', idReel: 'PHMC-2752' },
            'TMP-FGHJK': { nom: 'Marie', creeLe: 1, uid: 'D1', statut: 'temporaire' },
        } };
        const { resolvePatientIdAlias } = require('./temporaryIds');
        expect(await resolvePatientIdAlias('tmp-abcde')).toEqual({ id: 'PHMC-2752', from: 'TMP-ABCDE' });
        expect(await resolvePatientIdAlias('TMP-FGHJK')).toEqual({ id: 'TMP-FGHJK', from: '' });
        expect(await resolvePatientIdAlias('TMP-ZZZZ9')).toEqual({ id: 'TMP-ZZZZ9', from: '' });
        expect(await resolvePatientIdAlias('2752')).toEqual({ id: 'PHMC-2752', from: '' });
        expect(await resolvePatientIdAlias('')).toEqual({ id: '', from: '' });
    });

    test('la demande d’attribution du DMEC prévient les administrateurs', async () => {
        await requestRealIdAssignment({ tempId: 'tmp-abcde', realId: '2752', byName: 'Dr. Légiste' });
        expect(mockNotifyGroup).toHaveBeenCalledWith('admin', expect.objectContaining({ titre: expect.stringContaining('Dr. Légiste'), texte: expect.stringContaining('TMP-ABCDE → PHMC-2752') }));
    });
});
