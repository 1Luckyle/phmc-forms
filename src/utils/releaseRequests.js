// src/utils/releaseRequests.js
//
// Demandes de divulgation du dossier médical (formulaire « Libération médicale », version 24).
//
// Circuit :
//   1. Dans le formulaire, la personne choisit des CATÉGORIES de dossiers et une PÉRIODE ; elle voit alors les rapports qui existent (titre, date, médecin
//      responsable : jamais leur contenu) et coche ceux à divulguer. Le « praticien consulté » se déduit de ces rapports (leurs auteurs).
//   2. À l'enregistrement du formulaire, une DEMANDE est créée (releaseRequests/{id}) et chaque médecin concerné est notifié.
//   3. Chaque médecin partage SES rapports (« Dossier Patient » → Demandes de divulgation) : le rapport passe à « partagé » et le patient le retrouve dans
//      son dossier (il est notifié). Un administrateur ou un chef de service peut tout partager si un soignant ne le fait pas.
//   4. Tant que le formulaire existe, la demande reste « en attente » ; s'il est supprimé (annulation), la demande est annulée.
//
// Stockage : releaseRequests/{id} = { patientNode, patientID, patientNom, demandeurUid, demandeurNom, demandeurRole, reportPath, categories, du, au, statut,
//   creeLe, elements: { [clé d'index du rapport]: { titre, version, auteur, ts, statut: 'attente' | 'partage' | 'retire', partageLe?, partagePar? } } }.
// Les droits (« chacun ses rapports ») sont appliqués ici, côté application, comme pour le bouton « Partager avec le patient » : la base laisse tout le
// personnel écrire dans patientRecords.
import { ref, get, set, update, push, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from './patientId';
import { findPatientNodes, comprehensiveSanitize } from './patientRecords';
import { notifyUser, findCivilianUidByPatientId, findStaffUidByNode } from './notifications';
import { isDmecReportVersion } from './reportAccess';
import { extraRanksOf, normalizeRank } from '../constants/ranks';

export const RELEASE_VERSION = 24;
export const RELEASE_STATUS = { PENDING: 'en_attente', DONE: 'terminee', CANCELLED: 'annulee' };
export const ITEM_STATUS = { WAITING: 'attente', SHARED: 'partage', REMOVED: 'retire' };

// Catégorie du formulaire (valeurs de « Dossiers médicaux à divulguer ») -> versions de formulaires de soins qu'elle regroupe.
// « Autre » reprend les dossiers qui ne rentrent dans aucune catégorie précise. Les formulaires du DMEC, les candidatures et les formulaires AMA n'en font
// jamais partie. Pour classer un formulaire autrement, c'est ici.
export const RELEASE_CATEGORIES = {
    ERVisit: [19],                       // Protocole d'urgence
    HospitalStay: [7, 22, 23],           // Évaluation physique, notes de service
    Outpatient: [5],                     // Opération chirurgicale
    OfficeClinic: [20, 21],              // Consultation générale
    PsychologyVisits: [14, 16, 28, 29],  // Consultations et évaluations psychiatriques / psychologiques
    Other: [3, 25, 26, 35, 41],          // Dossiers médicaux, mise à jour, certificats
};

export const releaseCategoryOf = (version) => {
    const wanted = Number(version);
    return Object.keys(RELEASE_CATEGORIES).find((key) => RELEASE_CATEGORIES[key].includes(wanted)) || null;
};

// Chef de service : rôle principal ou supplémentaire « Chef de Service ».
export const isServiceChief = (member) => !!member
    && [member.rank || member.category, ...extraRanksOf(member)].some((rank) => normalizeRank(rank) === 'Chef de Service');

const sameName = (a, b) => !!a && !!b && comprehensiveSanitize(a).toLowerCase() === comprehensiveSanitize(b).toLowerCase();

// Médecin responsable d'un rapport (son créateur, pas celui qui en a gardé une copie).
export const reportAuthorOf = (entry) => String(entry?.creatorName || entry?.authorName || '').trim();

// Qui peut partager un rapport avec le patient : son créateur, un administrateur ou un chef de service.
export const canShareReport = ({ authorName, staffName, isAdmin = false, isChief = false }) => !!isAdmin || !!isChief || sameName(authorName, staffName);

// Rapports proposés à la divulgation : rapports d'origine du personnel (ni copies, ni rapports créés par le patient, ni DMEC), dans les catégories
// choisies et dans la période (dates AAAA-MM-JJ, bornes comprises), du plus récent au plus ancien.
export const eligibleReleaseEntries = (entries, { categories = [], from = '', to = '' } = {}) => {
    const wanted = new Set(categories);
    const fromMs = /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00`).getTime() : null;
    const toMs = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999`).getTime() : null;
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
        if (!entry || entry.copiedFrom || entry.ownerDeleted || entry.kind === 'ama' || entry.visibility === 'owner') return false;
        if (isDmecReportVersion(entry.bbCodeVersion)) return false;
        const category = releaseCategoryOf(entry.bbCodeVersion);
        if (!category || !wanted.has(category)) return false;
        const at = Number(entry.timestamp) || 0;
        if (fromMs !== null && at < fromMs) return false;
        if (toMs !== null && at > toMs) return false;
        return true;
    }).sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
};

// Rapport retenu, tel que gardé dans le formulaire (k = clé d'index, n = nœud du patient, t = titre, a = médecin, v = version, ts = date, s = partagé ?).
export const toSelection = (entry) => ({
    k: entry.indexKey, n: entry.patientNode || '', t: String(entry.title || entry.originalKey || 'Rapport').slice(0, 200),
    a: reportAuthorOf(entry).slice(0, 120), v: Number(entry.bbCodeVersion) || 0, ts: Number(entry.timestamp) || 0, s: entry.visibility === 'shared',
});

export const practitionersOf = (selection) => {
    const names = [];
    (Array.isArray(selection) ? selection : []).forEach((item) => { if (item?.a && !names.some((name) => sameName(name, item.a))) names.push(item.a); });
    return names;
};
export const practitionerLabel = (selection) => practitionersOf(selection).join(', ');

// ───────────── Lecture des rapports proposés ─────────────

// Entrées d'index (titre, médecin, date, partage…) du dossier d'un patient : sans lire les rapports eux-mêmes.
export async function loadReleaseCandidates(patientID) {
    const nodes = await findPatientNodes(patientID);
    const byKey = new Map();
    for (const node of nodes) {
        let snap;
        try { snap = await get(ref(database, `patientRecords/${node}`)); } catch (error) { continue; }
        Object.entries(snap.val() || {}).forEach(([indexKey, entry]) => {
            if (entry && entry.reportPath && !byKey.has(indexKey)) byKey.set(indexKey, { indexKey, patientNode: node, ...entry });
        });
    }
    return [...byKey.values()];
}

// ───────────── Création de la demande ─────────────

const itemsOf = (selection) => {
    const items = {};
    (Array.isArray(selection) ? selection : []).forEach((item) => {
        if (!item?.k) return;
        items[item.k] = {
            titre: item.t || 'Rapport', version: Number(item.v) || 0, auteur: item.a || '', ts: Number(item.ts) || 0,
            statut: item.s ? ITEM_STATUS.SHARED : ITEM_STATUS.WAITING,
        };
    });
    return items;
};

export async function createReleaseRequest({ patientID, patientName, requester, reportPath, categories, from, to, selection }) {
    const node = canonicalPatientId(patientID);
    const elements = itemsOf(selection);
    if (!node || Object.keys(elements).length === 0) return null;
    const id = push(ref(database, 'releaseRequests')).key;
    const waiting = Object.values(elements).filter((item) => item.statut === ITEM_STATUS.WAITING).length;
    const payload = {
        patientNode: node, patientID: node, patientNom: String(patientName || '').slice(0, 120),
        demandeurUid: requester?.uid || '', demandeurNom: String(requester?.name || '').slice(0, 120), demandeurRole: requester?.role === 'patient' ? 'patient' : 'personnel',
        reportPath: reportPath || '', categories: Array.isArray(categories) ? categories.slice(0, 10) : [], du: from || '', au: to || '',
        statut: waiting > 0 ? RELEASE_STATUS.PENDING : RELEASE_STATUS.DONE, creeLe: Date.now(), elements,
    };
    await set(ref(database, `releaseRequests/${id}`), payload);
    // Chaque médecin concerné est prévenu (au mieux : un échec ne bloque jamais l'enregistrement).
    const authors = practitionersOf(Object.values(elements).filter((item) => item.statut === ITEM_STATUS.WAITING).map((item) => ({ a: item.auteur })));
    await Promise.all(authors.map(async (name) => {
        const uid = await findStaffUidByNode(comprehensiveSanitize(name), comprehensiveSanitize);
        const mine = Object.values(elements).filter((item) => item.statut === ITEM_STATUS.WAITING && sameName(item.auteur, name)).length;
        if (uid) await notifyUser(uid, { type: 'demande', titre: 'Demande de divulgation à traiter', texte: `${payload.patientNom || node} : ${mine} de vos rapports à partager`, lien: { cible: 'divulgation', id } });
    }));
    return { id, ...payload };
}

// ───────────── Traitement par le personnel ─────────────

// Demandes en attente dont le formulaire existe encore (un formulaire supprimé = demande annulée, constatée ici).
export async function loadPendingReleaseRequests() {
    const snap = await get(query(ref(database, 'releaseRequests'), orderByChild('statut'), equalTo(RELEASE_STATUS.PENDING)));
    const requests = Object.entries(snap.val() || {}).map(([id, request]) => ({ id, ...request }));
    const alive = [];
    await Promise.all(requests.map(async (request) => {
        if (request.reportPath) {
            try {
                const exists = (await get(ref(database, request.reportPath))).exists();
                if (!exists) {
                    update(ref(database, `releaseRequests/${request.id}`), { statut: RELEASE_STATUS.CANCELLED, annuleLe: Date.now(), annulePar: 'formulaire supprimé' }).catch(() => {});
                    return;
                }
            } catch (error) { /* lecture refusée : on garde la demande visible */ }
        }
        alive.push(request);
    }));
    return alive.sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));
}

export const waitingItems = (request) => Object.entries(request?.elements || {})
    .filter(([, item]) => item && item.statut === ITEM_STATUS.WAITING).map(([key, item]) => ({ key, ...item }));

// Éléments que CETTE personne peut partager parmi ceux qui attendent.
export const shareableItems = (request, viewer) => waitingItems(request).filter((item) => canShareReport({ authorName: item.auteur, ...viewer }));

// Demandes à montrer à cette personne : toutes pour un administrateur ou un chef de service, sinon celles qui contiennent un de SES rapports.
export const requestsVisibleTo = (requests, viewer) => (requests || []).filter((request) => (viewer.isAdmin || viewer.isChief)
    ? waitingItems(request).length > 0
    : shareableItems(request, viewer).length > 0);

// Partage les éléments que le lecteur a le droit de partager : le rapport passe à « partagé » dans le dossier du patient. Retourne { shared, removed, left }.
export async function shareRequestItems(request, viewer, { author = '' } = {}) {
    const items = shareableItems(request, viewer);
    const now = Date.now();
    const updates = {};
    let shared = 0;
    let removed = 0;
    for (const item of items) {
        const indexPath = `patientRecords/${request.patientNode}/${item.key}`;
        let entry = null;
        try { const snap = await get(ref(database, indexPath)); entry = snap.exists() ? snap.val() : null; } catch (error) { entry = null; }
        if (!entry || entry.ownerDeleted) {
            updates[`releaseRequests/${request.id}/elements/${item.key}/statut`] = ITEM_STATUS.REMOVED;
            removed += 1;
            continue;
        }
        if (entry.visibility !== 'shared' && entry.visibility !== 'owner') updates[`${indexPath}/visibility`] = 'shared';
        updates[`releaseRequests/${request.id}/elements/${item.key}/statut`] = ITEM_STATUS.SHARED;
        updates[`releaseRequests/${request.id}/elements/${item.key}/partageLe`] = now;
        updates[`releaseRequests/${request.id}/elements/${item.key}/partagePar`] = String(author || viewer.staffName || 'admin').slice(0, 120);
        shared += 1;
    }
    const left = waitingItems(request).length - items.length;
    if (items.length > 0 && left <= 0) updates[`releaseRequests/${request.id}/statut`] = RELEASE_STATUS.DONE;
    if (Object.keys(updates).length > 0) await update(ref(database), updates);
    if (shared > 0) {
        // Le patient est prévenu, ainsi que la personne qui a fait la demande si ce n'est pas lui.
        findCivilianUidByPatientId(request.patientNode).then((uid) => notifyUser(uid, {
            type: 'partage', titre: 'Des rapports ont été partagés avec vous', texte: `Demande de divulgation : ${shared} rapport(s) disponible(s) dans votre dossier`, lien: { cible: 'dossierPatient' },
        }));
        if (request.demandeurUid && request.demandeurRole !== 'patient') {
            notifyUser(request.demandeurUid, { type: 'partage', titre: 'Demande de divulgation : rapports partagés', texte: `${request.patientNom || request.patientNode} : ${shared} rapport(s)`, lien: { cible: 'divulgation', id: request.id } });
        }
    }
    return { shared, removed, left: Math.max(0, left) };
}

export const canCancelRequest = (request, { uid, isAdmin }) => !!isAdmin || (!!uid && request?.demandeurUid === uid);

export async function cancelReleaseRequest(request, by) {
    await update(ref(database, `releaseRequests/${request.id}`), { statut: RELEASE_STATUS.CANCELLED, annuleLe: Date.now(), annulePar: String(by || 'personnel').slice(0, 120) });
}
