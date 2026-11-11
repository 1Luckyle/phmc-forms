let mockDb = {};
const mockPath = (path) => String(path || '').split('/').filter(Boolean);
const mockGetAt = (path) => mockPath(path).reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), mockDb);
const mockSetAt = (path, value) => {
    const keys = mockPath(path);
    let node = mockDb;
    keys.slice(0, -1).forEach((key) => { if (!node[key] || typeof node[key] !== 'object') node[key] = {}; node = node[key]; });
    if (value === null || value === undefined) delete node[keys[keys.length - 1]]; else node[keys[keys.length - 1]] = JSON.parse(JSON.stringify(value));
};
jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: { uid: 'S1' } } }));
jest.mock('firebase/database', () => ({
    ref: (db, path = '') => ({ path }),
    orderByChild: (child) => ({ child }),
    equalTo: (value) => ({ value }),
    query: (reference, order, equal) => ({ path: reference.path, child: order.child, value: equal.value }),
    get: async (reference) => {
        let value = mockGetAt(reference.path);
        if (reference.child && value) value = Object.fromEntries(Object.entries(value).filter(([, entry]) => entry && entry[reference.child] === reference.value));
        return { exists: () => value !== undefined && value !== null && (typeof value !== 'object' || Object.keys(value).length > 0), val: () => (value === undefined ? null : JSON.parse(JSON.stringify(value))) };
    },
    set: async (reference, value) => mockSetAt(reference.path, value),
    remove: async (reference) => mockSetAt(reference.path, null),
    update: async (reference, values) => Object.entries(values).forEach(([key, value]) => mockSetAt(`${reference.path}/${key}`, value)),
}));
const mockNotifyUser = jest.fn();
jest.mock('./notifications', () => ({ notifyUser: (...args) => mockNotifyUser(...args) }));

const {
    buildDeathSignal, deathSignalToDmecForm, deathSignalSummary, syncDeathSignal, retractDeathSignal, markDeathSignalTreated, loadDeathSignals, loadDeathSignalsFor, notifyDmecOfDeathSignal,
} = require('./deathSignals');

const care = {
    patientID: '2752', patientName: 'Jean Michel Testard', patientFirstName: 'Jean', patientMiddleName: 'Michel', patientLastName: 'Testard', patientDateOfBirth: '1990-05-17', date: '2026-11-11', phmcEmployee: 'Dr. Callahan',
    careDeceased: 'Yes', careDeathTime: '15:12', careDeathCause: 'Polytraumatisme avec choc hémorragique.', careDeathManner: 'Accidental', careDeathResuscitation: 'Attempted', careDeathFamily: 'ToInform', careDeathBody: 'Coroner',
};

describe('décès signalé : la fiche', () => {
    test('construite seulement pour un décès aux urgences ou en opération, avec un ID patient', () => {
        const signal = buildDeathSignal({ version: 19, formData: care, authorName: 'Dr. Callahan', uid: 'S1', now: 1000 });
        expect(signal).toEqual({
            patientID: 'PHMC-2752', patientName: 'Jean Michel Testard', prenom: 'Jean', deuxiemePrenom: 'Michel', nom: 'Testard', dateNaissance: '1990-05-17', kind: 'urgence', date: '2026-11-11', heure: '15:12',
            cause: 'Polytraumatisme avec choc hémorragique.', nature: 'Accidental', reanimation: 'Attempted', famille: 'ToInform', destination: 'Coroner', par: 'Dr. Callahan', uid: 'S1', creeLe: 1000, statut: 'a_traiter',
        });
        expect(buildDeathSignal({ version: 5, formData: care }).kind).toBe('chirurgie');
        expect(buildDeathSignal({ version: 20, formData: care })).toBeNull();
        expect(buildDeathSignal({ version: 19, formData: { ...care, careDeceased: '' } })).toBeNull();
        expect(buildDeathSignal({ version: 19, formData: { ...care, patientID: '' } })).toBeNull();
    });

    test('jamais de valeur vide (la base refuse undefined) ni le rapport médical', () => {
        const signal = buildDeathSignal({ version: 19, formData: { patientID: '1234', careDeceased: 'Yes', patientChiefComplaint: 'secret médical', patientDiagnosis: 'diagnostic' } });
        Object.values(signal).forEach((value) => expect(value).not.toBe(undefined));
        expect(JSON.stringify(signal)).not.toMatch(/secret médical|diagnostic/);
        expect(signal.par).toBe('Un soignant');
    });

    test('préremplissage de « Services de Médecine Légale »', () => {
        const form = deathSignalToDmecForm({ ...buildDeathSignal({ version: 19, formData: care, authorName: 'Dr. Callahan', uid: 'S1' }), key: 'sig1' });
        expect(form).toMatchObject({
            patientID: 'PHMC-2752', decedentFirstName: 'Jean', decedentMiddleName: 'Michel', decedentLastName: 'Testard', dateTime: '2026-11-11T15:12', pronouncedTimeOfDeath: '15:12',
            probableCauseOfDeath: 'Polytraumatisme avec choc hémorragique.', mannerOfDeath: 'Mort accidentelle',
        });
        expect(form.synopsis).toContain("protocole d'urgence");
        expect(form.synopsis).toContain('Dr. Callahan');
        expect(form.synopsis).toContain('DMEC (médecine légale)');
        expect(deathSignalToDmecForm({ patientID: 'PHMC-1', date: '2026-11-11' }).dateTime).toBe('2026-11-11T00:00');
        expect(deathSignalSummary({ patientName: 'Jean Testard', patientID: 'PHMC-2752', kind: 'chirurgie', date: '2026-11-11', heure: '15:12' })).toBe('Jean Testard (PHMC-2752) — Opération chirurgicale, 11/11/2026 à 15:12');
    });
});

describe('décès signalé : suit le rapport de soins', () => {
    beforeEach(() => {
        mockDb = { staff: { coroner: { a: { uid: 'D1' }, b: { uid: 'D2' }, c: { uid: 'S1' }, d: {} } } };
        mockNotifyUser.mockReset();
    });

    test('posée à l’enregistrement et le DMEC prévenu une seule fois ; corrigée ensuite sans nouvelle notification', async () => {
        expect(await syncDeathSignal({ key: 'rep1', version: 19, formData: care, authorName: 'Dr. Callahan' })).toBe('publiee');
        expect(mockDb.decesSignales.rep1).toMatchObject({ patientID: 'PHMC-2752', statut: 'a_traiter', uid: 'S1' });
        expect(mockNotifyUser.mock.calls.map((call) => call[0]).sort()).toEqual(['D1', 'D2']); // pas soi-même, pas de fiche sans uid
        expect(mockNotifyUser.mock.calls[0][1]).toMatchObject({ type: 'deces', lien: { cible: 'decesSignales', id: 'rep1' } });
        const firstCreated = mockDb.decesSignales.rep1.creeLe;

        mockNotifyUser.mockReset();
        expect(await syncDeathSignal({ key: 'rep1', version: 19, formData: { ...care, careDeathTime: '15:30' }, authorName: 'Dr. Callahan' })).toBe('publiee');
        expect(mockDb.decesSignales.rep1.heure).toBe('15:30');
        expect(mockDb.decesSignales.rep1.creeLe).toBe(firstCreated);
        expect(mockNotifyUser).not.toHaveBeenCalled();
    });

    test('retirée quand le décès est décoché, tant qu’elle est à traiter', async () => {
        await syncDeathSignal({ key: 'rep1', version: 19, formData: care, authorName: 'Dr. Callahan' });
        expect(await syncDeathSignal({ key: 'rep1', version: 19, formData: { ...care, careDeceased: '' }, authorName: 'Dr. Callahan' })).toBe('retiree');
        expect(mockDb.decesSignales.rep1).toBeUndefined();
        expect(await syncDeathSignal({ key: 'rep1', version: 19, formData: { ...care, careDeceased: '' }, authorName: 'x' })).toBe('rien');
    });

    test('une fiche déjà traitée par le DMEC n’est plus modifiée ni retirée', async () => {
        await syncDeathSignal({ key: 'rep1', version: 5, formData: care, authorName: 'Dr. Callahan' });
        await markDeathSignalTreated('rep1', { reportPath: 'savedReports/D_One/d9', byName: 'Dr. Légiste' });
        expect(mockDb.decesSignales.rep1).toMatchObject({ statut: 'traite', traitePar: 'Dr. Légiste', rapportDmec: 'savedReports/D_One/d9' });
        expect(await syncDeathSignal({ key: 'rep1', version: 5, formData: { ...care, careDeathTime: '16:00' }, authorName: 'x' })).toBe('rien');
        expect(mockDb.decesSignales.rep1.heure).toBe('15:12');
        expect(await retractDeathSignal('rep1')).toBe(false);
        expect(mockDb.decesSignales.rep1).toBeDefined();
    });

    test('autres formulaires : rien ; suppression du rapport : la fiche disparaît', async () => {
        expect(await syncDeathSignal({ key: 'rep2', version: 20, formData: care, authorName: 'x' })).toBe('rien');
        expect(mockDb.decesSignales).toBeUndefined();
        await syncDeathSignal({ key: 'rep3', version: 19, formData: care, authorName: 'x' });
        expect(await retractDeathSignal('rep3')).toBe(true);
        expect(await retractDeathSignal('inconnue')).toBe(false);
    });

    test('liste du DMEC, bandeau du dossier par patient, notification sans lecture possible', async () => {
        await syncDeathSignal({ key: 'rep1', version: 19, formData: care, authorName: 'x' });
        await syncDeathSignal({ key: 'rep2', version: 5, formData: { ...care, patientID: '9999' }, authorName: 'x' });
        expect((await loadDeathSignals()).map((signal) => signal.key).sort()).toEqual(['rep1', 'rep2']);
        expect((await loadDeathSignalsFor('2752')).map((signal) => signal.key)).toEqual(['rep1']);
        expect(await loadDeathSignalsFor('')).toEqual([]);
        mockDb.staff = undefined;
        expect(await notifyDmecOfDeathSignal('rep1', { patientID: 'PHMC-2752', par: 'x' })).toBe(0);
    });
});
