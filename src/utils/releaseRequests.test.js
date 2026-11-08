import {
    releaseCategoryOf, eligibleReleaseEntries, canShareReport, isServiceChief, practitionersOf, practitionerLabel, toSelection,
    shareableItems, requestsVisibleTo, shareRequestItems, isReleaseFormGone, isReleasePaymentPending, cancelReleaseRequest, RELEASE_STATUS, ITEM_STATUS,
} from './releaseRequests';
import { loadPatientInvoices } from './patientInvoices';
import { ref, get, update } from 'firebase/database';
import * as notifications from './notifications';

jest.mock('../firebase', () => ({ database: {}, auth: { currentUser: { uid: 'me' } } }));
jest.mock('firebase/database', () => ({
    ref: jest.fn((db, path) => path), get: jest.fn(), set: jest.fn(), update: jest.fn(() => Promise.resolve()), push: jest.fn(() => ({ key: 'newid' })),
    query: jest.fn(), orderByChild: jest.fn(), equalTo: jest.fn(), onValue: jest.fn(),
}));
jest.mock('./patientInvoices', () => ({ loadPatientInvoices: jest.fn() }));
jest.mock('./notifications', () => ({ notifyUser: jest.fn(), findCivilianUidByPatientId: jest.fn(), findStaffUidByNode: jest.fn() }));

// La configuration de Create React App remet les simulations à zéro avant chaque test : leurs retours se posent ici.
beforeEach(() => {
    loadPatientInvoices.mockResolvedValue([]);
    ref.mockImplementation((db, path) => path);
    update.mockImplementation(() => Promise.resolve());
    notifications.notifyUser.mockResolvedValue(true);
    notifications.findCivilianUidByPatientId.mockResolvedValue('civil-uid');
    notifications.findStaffUidByNode.mockResolvedValue('doc-uid');
});

const entry = (over = {}) => ({ indexKey: 'k1', bbCodeVersion: 19, timestamp: new Date('2026-03-10T12:00:00').getTime(), visibility: 'staff-only', creatorName: 'Alice Martin', title: 'Urgence', ...over });

describe('catégories de divulgation', () => {
    test('chaque formulaire de soins tombe dans sa catégorie, les formulaires du DMEC et les candidatures dans aucune', () => {
        expect(releaseCategoryOf(19)).toBe('ERVisit');
        expect(releaseCategoryOf(5)).toBe('Outpatient');
        expect(releaseCategoryOf(14)).toBe('PsychologyVisits');
        expect(releaseCategoryOf(25)).toBe('Other');
        expect(releaseCategoryOf(4)).toBeNull();
        expect(releaseCategoryOf(24)).toBeNull();
        expect(releaseCategoryOf(53)).toBeNull();
    });
    test('les anciens formulaires médicaux sont couverts, un futur formulaire tombe dans « Autre », les courriels jamais', () => {
        expect(releaseCategoryOf(6)).toBe('HospitalStay');
        expect(releaseCategoryOf(9)).toBe('OfficeClinic');
        expect(releaseCategoryOf(13)).toBe('OfficeClinic');
        expect(releaseCategoryOf(77)).toBe('Other');
        expect(releaseCategoryOf(22)).toBeNull(); // notes de service : notes internes, jamais divulguées
        expect(releaseCategoryOf(23)).toBeNull();
        expect(releaseCategoryOf(27)).toBeNull();
        expect(releaseCategoryOf(18)).toBeNull();
        expect(releaseCategoryOf(undefined)).toBeNull();
    });
});

describe('eligibleReleaseEntries', () => {
    const entries = [
        entry({ indexKey: 'a' }),
        entry({ indexKey: 'b', bbCodeVersion: 5, timestamp: new Date('2026-01-05T08:00:00').getTime() }),
        entry({ indexKey: 'c', copiedFrom: { reportPath: 'x' } }),
        entry({ indexKey: 'd', visibility: 'owner' }),
        entry({ indexKey: 'e', ownerDeleted: true }),
        entry({ indexKey: 'f', bbCodeVersion: 4 }),
    ];
    test('ne garde que les rapports d’origine du personnel dans les catégories choisies', () => {
        expect(eligibleReleaseEntries(entries, { categories: ['ERVisit', 'Outpatient'] }).map((e) => e.indexKey)).toEqual(['a', 'b']);
        expect(eligibleReleaseEntries(entries, { categories: [] })).toEqual([]);
    });
    test('la période réduit la liste, bornes comprises', () => {
        expect(eligibleReleaseEntries(entries, { categories: ['ERVisit', 'Outpatient'], from: '2026-03-10', to: '2026-03-10' }).map((e) => e.indexKey)).toEqual(['a']);
        expect(eligibleReleaseEntries(entries, { categories: ['ERVisit', 'Outpatient'], to: '2026-02-01' }).map((e) => e.indexKey)).toEqual(['b']);
    });
});

describe('qui peut partager', () => {
    test('chacun ses rapports ; un admin ou un chef de service tous', () => {
        expect(canShareReport({ authorName: 'Alice Martin', staffName: 'Alice Martin' })).toBe(true);
        expect(canShareReport({ authorName: 'Alice Martin', staffName: 'Bob Durand' })).toBe(false);
        expect(canShareReport({ authorName: 'Alice Martin', staffName: 'Bob Durand', isChief: true })).toBe(true);
        expect(canShareReport({ authorName: 'Alice Martin', staffName: 'Bob Durand', isAdmin: true })).toBe(true);
        expect(canShareReport({ authorName: '', staffName: '' })).toBe(false);
    });
    test('chef de service : rôle principal ou supplémentaire', () => {
        expect(isServiceChief({ rank: 'Chef de Service' })).toBe(true);
        expect(isServiceChief({ rank: 'Médecin Titulaire', extraRanks: ['Chef de Service'] })).toBe(true);
        expect(isServiceChief({ rank: 'Médecin Titulaire' })).toBe(false);
        expect(isServiceChief(null)).toBe(false);
    });
});

describe('praticien consulté déduit des rapports', () => {
    test('liste les médecins distincts, dans l’ordre', () => {
        const selection = [entry({ indexKey: 'a' }), entry({ indexKey: 'b', creatorName: 'Bob Durand' }), entry({ indexKey: 'c' })].map(toSelection);
        expect(practitionersOf(selection)).toEqual(['Alice Martin', 'Bob Durand']);
        expect(practitionerLabel(selection)).toBe('Alice Martin, Bob Durand');
        expect(practitionerLabel([])).toBe('');
    });
});

describe('partage d’une demande', () => {
    const request = {
        id: 'r1', patientNode: 'PHMC-1234', patientNom: 'Jean Test', demandeurUid: 'u9', demandeurRole: 'patient', statut: RELEASE_STATUS.PENDING,
        elements: {
            a: { titre: 'Urgence', auteur: 'Alice Martin', statut: ITEM_STATUS.WAITING },
            b: { titre: 'Chirurgie', auteur: 'Bob Durand', statut: ITEM_STATUS.WAITING },
            c: { titre: 'Déjà fait', auteur: 'Alice Martin', statut: ITEM_STATUS.SHARED },
        },
    };
    const alice = { staffName: 'Alice Martin', isAdmin: false, isChief: false };
    const chief = { staffName: 'Chloé Chef', isAdmin: false, isChief: true };
    const stranger = { staffName: 'Zoé Autre', isAdmin: false, isChief: false };

    test('un médecin ne voit et ne partage que ses rapports, un chef de service tous', () => {
        expect(shareableItems(request, alice).map((i) => i.key)).toEqual(['a']);
        expect(shareableItems(request, chief).map((i) => i.key).sort()).toEqual(['a', 'b']);
        expect(requestsVisibleTo([request], stranger)).toEqual([]);
        expect(requestsVisibleTo([request], alice)).toHaveLength(1);
        expect(requestsVisibleTo([request], chief)).toHaveLength(1);
    });

    test('une demande sans rapport précis est visible des admins et chefs de service seulement', () => {
        const manual = { id: 'm1', patientNode: 'PHMC-1234', manuelle: true, statut: RELEASE_STATUS.PENDING, categories: ['Other'] };
        expect(requestsVisibleTo([manual], chief)).toHaveLength(1);
        expect(requestsVisibleTo([manual], { staffName: 'X', isAdmin: true, isChief: false })).toHaveLength(1);
        expect(requestsVisibleTo([manual], alice)).toEqual([]);
        expect(shareableItems(manual, chief)).toEqual([]);
    });

    test('une demande qui a aussi une partie manuelle reste en attente après le partage des rapports', async () => {
        get.mockResolvedValue({ exists: () => true, val: () => ({ visibility: 'staff-only' }) });
        update.mockClear();
        await shareRequestItems({ ...request, manuelle: true }, chief, { author: 'Chloé Chef' });
        expect(update.mock.calls[0][1]['releaseRequests/r1/statut']).toBeUndefined();
    });

    test('partager ses rapports passe le rapport à « partagé » sans toucher à ceux des autres', async () => {
        get.mockResolvedValue({ exists: () => true, val: () => ({ visibility: 'staff-only' }) });
        update.mockClear();
        const outcome = await shareRequestItems(request, alice, { author: 'Alice Martin' });
        expect(outcome).toEqual({ shared: 1, removed: 0, left: 1 });
        const written = update.mock.calls[0][1];
        expect(written['patientRecords/PHMC-1234/a/visibility']).toBe('shared');
        expect(written['releaseRequests/r1/elements/a/statut']).toBe(ITEM_STATUS.SHARED);
        expect(Object.keys(written).some((path) => path.includes('/b/'))).toBe(false);
        expect(written['releaseRequests/r1/statut']).toBeUndefined();
    });

    test('quand le dernier élément est partagé, la demande est terminée', async () => {
        get.mockResolvedValue({ exists: () => true, val: () => ({ visibility: 'staff-only' }) });
        update.mockClear();
        const outcome = await shareRequestItems(request, chief, { author: 'Chloé Chef' });
        expect(outcome.shared).toBe(2);
        expect(update.mock.calls[0][1]['releaseRequests/r1/statut']).toBe(RELEASE_STATUS.DONE);
    });

    test('un rapport supprimé entre-temps est marqué « retiré »', async () => {
        get.mockResolvedValue({ exists: () => false, val: () => null });
        update.mockClear();
        const outcome = await shareRequestItems(request, alice, {});
        expect(outcome).toEqual({ shared: 0, removed: 1, left: 1 });
        expect(update.mock.calls[0][1]['releaseRequests/r1/elements/a/statut']).toBe(ITEM_STATUS.REMOVED);
    });
});

describe('formulaire de libération supprimé par le patient', () => {
    const request = { id: 'r1', patientNode: 'PHMC-1234', reportPath: 'savedReports/Jean_Test/rel_1' };
    const snap = (exists, value) => ({ exists: () => exists, val: () => value });

    test('supprimé pour de bon (ni index ni rapport) ou simplement retiré (ownerDeleted) : la demande est caduque', async () => {
        get.mockImplementation(() => Promise.resolve(snap(false, null)));
        expect(await isReleaseFormGone(request)).toBe(true);
        get.mockImplementation(() => Promise.resolve(snap(true, { ownerDeleted: true })));
        expect(await isReleaseFormGone(request)).toBe(true);
    });
    test('formulaire toujours là : la demande reste', async () => {
        get.mockImplementation(() => Promise.resolve(snap(true, { visibility: 'owner' })));
        expect(await isReleaseFormGone(request)).toBe(false);
    });
    test('lecture refusée : on ne conclut jamais à une suppression', async () => {
        get.mockImplementation(() => Promise.reject(new Error('PERMISSION_DENIED')));
        expect(await isReleaseFormGone(request)).toBe(false);
    });
});

describe('paiement du formulaire et annulation', () => {
    const request = {
        id: 'r1', patientNode: 'PHMC-1234', reportPath: 'savedReports/Jean_Test/rel_1', demandeurRole: 'patient', statut: RELEASE_STATUS.PENDING,
        elements: {
            a: { titre: 'Urgence', auteur: 'Alice Martin', statut: ITEM_STATUS.WAITING },
            b: { titre: 'Chirurgie', auteur: 'Bob Durand', statut: ITEM_STATUS.WAITING },
            c: { titre: 'Déjà fait', auteur: 'Alice Martin', statut: ITEM_STATUS.SHARED },
        },
    };
    const alice = { staffName: 'Alice Martin', isAdmin: false, isChief: false };

    test('facture à payer : rien ne se partage ; payée ou sans facture : le partage est permis', async () => {
        loadPatientInvoices.mockResolvedValue([{ id: 'rel_1', statutEffectif: 'a_payer' }]);
        expect(await isReleasePaymentPending(request)).toBe(true);
        update.mockClear();
        const blocked = await shareRequestItems(request, alice, {});
        expect(blocked).toMatchObject({ shared: 0, blocked: 'paiement' });
        expect(update).not.toHaveBeenCalled();

        loadPatientInvoices.mockResolvedValue([{ id: 'rel_1', statutEffectif: 'paye' }]);
        expect(await isReleasePaymentPending(request)).toBe(false);
        loadPatientInvoices.mockResolvedValue([]);
        expect(await isReleasePaymentPending(request)).toBe(false);
    });

    test('facture illisible : par prudence, on attend', async () => {
        loadPatientInvoices.mockRejectedValue(new Error('PERMISSION_DENIED'));
        expect(await isReleasePaymentPending(request)).toBe(true);
    });

    test('annuler une demande annule ce qui n’est pas partagé et laisse ce qui l’est déjà', async () => {
        update.mockClear();
        await cancelReleaseRequest(request, 'le patient');
        const written = update.mock.calls[0][1];
        expect(written['releaseRequests/r1/statut']).toBe(RELEASE_STATUS.CANCELLED);
        expect(written['releaseRequests/r1/elements/a/statut']).toBe(ITEM_STATUS.CANCELLED);
        expect(written['releaseRequests/r1/elements/b/statut']).toBe(ITEM_STATUS.CANCELLED);
        expect(written['releaseRequests/r1/elements/c/statut']).toBeUndefined();
    });
});
