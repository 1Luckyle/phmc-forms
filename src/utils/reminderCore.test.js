import { DAY_MS, unreadDigest, dueInterviews, staleApplications, unsignedDocuments, endingContracts, dueExpiries, frDateOf } from '../../functions/reminderCore';

const NOW = Date.UTC(2026, 10, 16, 8, 0, 0);

describe('récapitulatif des messages non lus', () => {
    test('seulement s\'il y a un message non lu depuis plus de 24 h', () => {
        expect(unreadDigest({}, NOW)).toBeNull();
        expect(unreadDigest({ a: { role: 'recu', lu: false, le: NOW - 3600000, objet: 'Frais', de: 'X' } }, NOW)).toBeNull();
        expect(unreadDigest({ a: { role: 'recu', lu: true, le: NOW - 3 * DAY_MS } }, NOW)).toBeNull();
        expect(unreadDigest({ a: { role: 'envoye', lu: true, le: NOW - 3 * DAY_MS } }, NOW)).toBeNull();
    });
    test('compte tous les non lus, liste les plus récents', () => {
        const entries = {};
        for (let i = 0; i < 10; i += 1) entries[`m${i}`] = { role: 'recu', lu: false, le: NOW - (i + 1) * DAY_MS, objet: `Objet ${i}`, de: 'Dr Doe' };
        const digest = unreadDigest(entries, NOW);
        expect(digest.count).toBe(10);
        expect(digest.items).toHaveLength(8);
        expect(digest.items[0]).toBe('Dr Doe : Objet 0');
        expect(digest.more).toBe(2);
    });
});

describe('candidatures', () => {
    const apps = {
        u1: {
            a1: { statut: 'entretien_programme', nomCandidat: 'Jane', poste: 'Médecin', entretien: { date: new Date(NOW + 20 * 3600000).toISOString(), recruteur: { nom: 'Rec', uid: 'r1' } } },
            a2: { statut: 'entretien_programme', dateEntretien: NOW + 5 * DAY_MS },
            a3: { statut: 'soumise', nomCandidat: 'Paul', poste: 'Infirmier', creeLe: NOW - 6 * DAY_MS },
            a4: { statut: 'soumise', creeLe: NOW - 6 * DAY_MS, priseEnChargePar: { nom: 'x' } },
            a5: { statut: 'soumise', creeLe: NOW - 1 * DAY_MS },
            a6: { statut: 'refusee', dateEntretien: NOW + 3600000 },
        },
    };
    test('entretiens des prochaines 36 h, avec le recruteur', () => {
        const due = dueInterviews(apps, NOW);
        expect(due).toHaveLength(1);
        expect(due[0]).toMatchObject({ uid: 'u1', id: 'a1', nom: 'Jane', poste: 'Médecin', recruteurUid: 'r1', recruteurNom: 'Rec' });
        expect(due[0].key).toContain('entretien_u1_a1_');
    });
    test('candidatures sans réponse depuis 5 jours : seulement les soumises non prises en charge', () => {
        const stale = staleApplications(apps, NOW);
        expect(stale.map((s) => s.id)).toEqual(['a3']);
        expect(stale[0]).toMatchObject({ jours: 6, nom: 'Paul' });
    });
});

describe('documents et contrats', () => {
    const contrats = {
        c1: { statut: 'envoye', employeUid: 'e1', employeNom: 'Jane', envoyeLe: NOW - 4 * DAY_MS, champs: { poste: 'Médecin' } },
        c2: { statut: 'envoye', employeUid: 'e2', envoyeLe: NOW - 1 * DAY_MS },
        c3: { statut: 'envoye', employeUid: 'e3', envoyeLe: NOW - 10 * DAY_MS, offreExpireLe: NOW - DAY_MS },
        c4: { statut: 'signe', employeUid: 'e4', employeNom: 'Paul', champs: { poste: 'Stagiaire', dateFin: new Date(NOW + 10 * DAY_MS).toISOString().slice(0, 10) } },
        c5: { statut: 'signe', employeUid: 'e5', champs: { dateFin: new Date(NOW + 90 * DAY_MS).toISOString().slice(0, 10) } },
    };
    test('document envoyé et non signé depuis 3 jours : relance, puis tous les 3 jours, 4 fois au plus', () => {
        const first = unsignedDocuments(contrats, NOW, {});
        expect(first.map((d) => d.id)).toEqual(['c1']);
        expect(first[0]).toMatchObject({ uid: 'e1', titre: 'Médecin', n: 1 });
        expect(unsignedDocuments(contrats, NOW, { [first[0].key]: { n: 1, last: NOW - DAY_MS } })).toEqual([]);
        expect(unsignedDocuments(contrats, NOW, { [first[0].key]: { n: 1, last: NOW - 3 * DAY_MS } })[0].n).toBe(2);
        expect(unsignedDocuments(contrats, NOW, { [first[0].key]: { n: 4, last: NOW - 30 * DAY_MS } })).toEqual([]);
    });
    test('contrats signés qui se terminent dans les 30 jours', () => {
        const ending = endingContracts(contrats, NOW);
        expect(ending.map((c) => c.id)).toEqual(['c4']);
        expect(ending[0]).toMatchObject({ uid: 'e4', titre: 'Stagiaire' });
    });
});

describe('échéances des certificats et ordonnances', () => {
    const fin = NOW + 20 * DAY_MS;
    const echeances = {
        e1: { type: 'certificat_vol', finLe: fin, delaiJours: 30, patientID: 'PHMC-1', titre: 'Certificat de vol' },
        e2: { type: 'certificat_vol', finLe: NOW + 90 * DAY_MS, delaiJours: 30 },
        e3: { type: 'ordonnance', finLe: NOW + 2 * DAY_MS, delaiJours: 3, notifie: true },
        e4: { type: 'ordonnance', finLe: NOW + 2 * DAY_MS, delaiJours: 3 },
        e5: { type: 'aptitude', finLe: NOW - 60 * DAY_MS, delaiJours: 30 },
    };
    test('préavis atteint, pas déjà prévenu, pas échu depuis longtemps', () => {
        const due = dueExpiries(echeances, NOW);
        expect(due.map((d) => d.id).sort()).toEqual(['e1', 'e4']);
        expect(due.find((d) => d.id === 'e1').joursRestants).toBe(20);
        expect(frDateOf(Date.UTC(2027, 10, 12))).toBe('12/11/2027');
    });
});
