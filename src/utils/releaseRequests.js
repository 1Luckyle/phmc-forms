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
//      Sans rapport précis (aucun rapport ne correspond, ou « Autres dossiers » décrits en texte), la demande n'a pas de médecin désigné : elle est signalée à
//      l'administration (notification de groupe) et traitée à la main par un administrateur ou un chef de service (« manuelle »).
//   4. Tant que le patient n'a pas PAYÉ le formulaire (facture à payer), rien n'est partagé : ni par les médecins, ni par l'administration.
//   5. Tant que le formulaire existe, la demande reste « en attente » ; s'il est supprimé (annulation), la demande est annulée : les rapports pas encore
//      partagés ne le seront pas, ceux déjà partagés le restent (le patient avait payé).
//
// Stockage : releaseRequests/{id} = { patientNode, patientID, patientNom, demandeurUid, demandeurNom, demandeurRole, reportPath, categories, du, au, statut,
//   creeLe, elements: { [clé d'index du rapport]: { titre, version, auteur, ts, statut: 'attente' | 'partage' | 'retire', partageLe?, partagePar? } } }.
// Les droits (« chacun ses rapports ») sont appliqués ici, côté application, comme pour le bouton « Partager avec le patient » : la base laisse tout le
// personnel écrire dans patientRecords.
import { ref, get, set, update, push, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from './patientId';
import { findPatientNodes, comprehensiveSanitize } from './patientRecords';
import { notifyUser, notifyGroup, findCivilianUidByPatientId, findStaffUidByNode } from './notifications';
import { isDmecReportVersion } from './reportAccess';
import { extraRanksOf, normalizeRank } from '../constants/ranks';
import { loadPatientInvoices } from './patientInvoices';
import { INVOICE_STATUS } from './patientBilling';

export const RELEASE_VERSION = 24;
export const RELEASE_STATUS = { PENDING: 'en_attente', DONE: 'terminee', CANCELLED: 'annulee' };
export const ITEM_STATUS = { WAITING: 'attente', SHARED: 'partage', REMOVED: 'retire', CANCELLED: 'annule' };

// Catégorie du formulaire (valeurs de « Dossiers médicaux à divulguer ») -> versions de formulaires de soins qu'elle regroupe (anciens formulaires compris :
// 6 évaluation physique PHMC ; 9, 10, 12, 13 obstétrique et gynécologie, dont les rapports existent encore dans les dossiers).
// « Autre » reprend les dossiers qui ne rentrent dans aucune catégorie précise, ET tout formulaire qui n'est pas listé ci-dessous ni exclu : un futur
// formulaire médical est donc divulgable sans rien changer. Les formulaires du DMEC, les candidatures, la libération elle-même, les courriels et les
// formulaires AMA n'en font jamais partie. Pour classer un formulaire autrement, c'est ici.
export const RELEASE_CATEGORIES = {
    ERVisit: [19],                              // Protocole d'urgence
    HospitalStay: [],                           // DÉSACTIVÉE pour l'instant : plus proposée dans les choix (voir adaptReleaseOptions), aucun formulaire n'y est rangé
    Outpatient: [5],                            // Opération chirurgicale
    OfficeClinic: [6, 7, 9, 10, 12, 13, 20, 21], // Évaluations physiques, consultations générales, obstétrique, gynécologie
    PsychologyVisits: [14, 16, 28, 29],         // Consultations et évaluations psychiatriques / psychologiques
    Certificate: [35, 41],                      // Certificat de maladie, certificat de vol
    Other: [3, 25, 26],                         // Dossiers médicaux (basique, avancé), mise à jour
};

// Catégories retirées des choix du formulaire de libération (valeur de « Dossiers médicaux à divulguer »).
export const DISABLED_RELEASE_CATEGORIES = ['HospitalStay'];
export const PSYCHOLOGY_RELEASE_LABEL = 'Visites psychologiques et psychiatriques';
export const CERTIFICATE_RELEASE_OPTION = { value: 'Certificate', label: 'Certificats : certificat de maladie, certificat de vol' };

// Liste des choix du formulaire à partir de celle de la base : sans les catégories désactivées, « Visites psychologiques » renommée, et la catégorie « Certificats »
// ajoutée (juste avant « Autre »). Le libellé de la base garde ses précisions : seul le début change.
export const adaptReleaseOptions = (options) => {
    const base = (Array.isArray(options) ? options : []).filter((option) => !DISABLED_RELEASE_CATEGORIES.includes(option.value))
        .map((option) => (option.value === 'PsychologyVisits'
            ? { ...option, label: String(option.label || '').replace(/^Visites? (de )?psychologi(ques?|e)/i, PSYCHOLOGY_RELEASE_LABEL) || PSYCHOLOGY_RELEASE_LABEL }
            : option));
    if (base.some((option) => option.value === CERTIFICATE_RELEASE_OPTION.value)) return base;
    const otherIndex = base.findIndex((option) => option.value === 'Other');
    return otherIndex === -1 ? [...base, CERTIFICATE_RELEASE_OPTION] : [...base.slice(0, otherIndex), CERTIFICATE_RELEASE_OPTION, ...base.slice(otherIndex)];
};
// Jamais divulgués par ce circuit : les notes de service (22, 23 : notes internes du personnel), la libération (24), les courriels (27), le retour d'agence (18),
// les candidatures (50 à 55) et le panneau admin.
const NEVER_RELEASED = [18, 22, 23, 24, 27, 50, 51, 52, 53, 54, 55, 999];

export const releaseCategoryOf = (version) => {
    const wanted = Number(version);
    const listed = Object.keys(RELEASE_CATEGORIES).find((key) => RELEASE_CATEGORIES[key].includes(wanted));
    if (listed) return listed;
    if (!Number.isFinite(wanted) || wanted <= 0 || NEVER_RELEASED.includes(wanted) || isDmecReportVersion(wanted)) return null;
    return 'Other';
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

export async function createReleaseRequest({ patientID, patientName, requester, reportPath, categories, from, to, selection, otherText = '' }) {
    const node = canonicalPatientId(patientID);
    const elements = itemsOf(selection);
    if (!node) return null;
    const id = push(ref(database, 'releaseRequests')).key;
    const waiting = Object.values(elements).filter((item) => item.statut === ITEM_STATUS.WAITING).length;
    const autres = String(otherText || '').trim().slice(0, 400);
    // Partie à traiter à la main : aucun rapport précis, ou « Autres dossiers » décrits en texte.
    const manuelle = Object.keys(elements).length === 0 || !!autres;
    const payload = {
        patientNode: node, patientID: node, patientNom: String(patientName || '').slice(0, 120),
        demandeurUid: requester?.uid || '', demandeurNom: String(requester?.name || '').slice(0, 120), demandeurRole: requester?.role === 'patient' ? 'patient' : 'personnel',
        reportPath: reportPath || '', categories: Array.isArray(categories) ? categories.slice(0, 10) : [], du: from || '', au: to || '',
        statut: waiting > 0 || manuelle ? RELEASE_STATUS.PENDING : RELEASE_STATUS.DONE, creeLe: Date.now(),
        ...(Object.keys(elements).length > 0 ? { elements } : {}),
        ...(manuelle ? { manuelle: true } : {}),
        ...(autres ? { autres } : {}),
    };
    await set(ref(database, `releaseRequests/${id}`), payload);
    // Partie manuelle : l'administration est prévenue (les chefs de service la retrouvent dans le panneau du Dossier Patient).
    if (manuelle) {
        await notifyGroup('admin', { type: 'demande', titre: 'Demande de divulgation à traiter à la main', texte: `${payload.patientNom || node} : ${autres || 'aucun rapport précis'}`, lien: { cible: 'divulgation', id } });
    }
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
// Le formulaire de libération a-t-il été supprimé (ou retiré par le patient) ? On lit l'index du dossier, que le personnel peut toujours lire ;
// s'il est absent, on regarde le rapport lui-même. Une lecture impossible n'annule jamais la demande.
export async function isReleaseFormGone(request) {
    if (!request?.reportPath || !request.patientNode) return false;
    const indexKey = String(request.reportPath).split('/').pop();
    try {
        const index = await get(ref(database, `patientRecords/${request.patientNode}/${indexKey}`));
        if (index.exists()) return !!(index.val() && index.val().ownerDeleted);
    } catch (error) { return false; }
    try {
        const report = await get(ref(database, `${request.reportPath}/bbCodeVersion`));
        if (!report.exists()) return true;
        const flag = await get(ref(database, `${request.reportPath}/ownerDeleted`));
        return flag.val() === true;
    } catch (error) { return false; }
}

// Le patient a-t-il encore à PAYER le formulaire de libération ? (facture « à payer » du formulaire : la même que dans « Dossier Patient »). Pas de facture
// (gratuit, exempté) = rien à payer. Une lecture impossible bloque par prudence : mieux vaut attendre que partager un dossier non payé.
export async function isReleasePaymentPending(request) {
    if (!request?.reportPath || !request.patientNode) return false;
    const indexKey = String(request.reportPath).split('/').pop();
    try {
        const invoices = await loadPatientInvoices(request.patientNode);
        const invoice = (invoices || []).find((entry) => entry.id === indexKey);
        return !!invoice && invoice.statutEffectif === INVOICE_STATUS.A_PAYER;
    } catch (error) {
        return true;
    }
}

// Annule une demande : elle ne se traite plus ; les rapports pas encore partagés ne le seront pas, ceux déjà partagés le restent.
const cancelUpdates = (request, by) => {
    const updates = {
        [`releaseRequests/${request.id}/statut`]: RELEASE_STATUS.CANCELLED,
        [`releaseRequests/${request.id}/annuleLe`]: Date.now(),
        [`releaseRequests/${request.id}/annulePar`]: String(by || 'personnel').slice(0, 120),
    };
    waitingItems(request).forEach((item) => { updates[`releaseRequests/${request.id}/elements/${item.key}/statut`] = ITEM_STATUS.CANCELLED; });
    return updates;
};

export async function loadPendingReleaseRequests() {
    const snap = await get(query(ref(database, 'releaseRequests'), orderByChild('statut'), equalTo(RELEASE_STATUS.PENDING)));
    const requests = Object.entries(snap.val() || {}).map(([id, request]) => ({ id, ...request }));
    const alive = [];
    await Promise.all(requests.map(async (request) => {
        if (await isReleaseFormGone(request)) {
            update(ref(database), cancelUpdates(request, 'formulaire supprimé')).catch(() => {});
            return;
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
    ? (waitingItems(request).length > 0 || !!request.manuelle)
    : shareableItems(request, viewer).length > 0);

// Partage les éléments que le lecteur a le droit de partager : le rapport passe à « partagé » dans le dossier du patient. Retourne { shared, removed, left }.
export async function shareRequestItems(request, viewer, { author = '' } = {}) {
    const items = shareableItems(request, viewer);
    // Rien ne se partage tant que le patient n'a pas payé son formulaire (revérifié ici : l'écran peut dater).
    if (items.length > 0 && await isReleasePaymentPending(request)) return { shared: 0, removed: 0, left: waitingItems(request).length, blocked: 'paiement' };
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
    // Une demande qui a aussi une partie à traiter à la main reste en attente jusqu'à « Marquer comme traitée ».
    if (items.length > 0 && left <= 0 && !request.manuelle) updates[`releaseRequests/${request.id}/statut`] = RELEASE_STATUS.DONE;
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

// Clôture une demande traitée à la main (administrateur ou chef de service) ; le patient en est informé.
export async function completeReleaseRequest(request, by) {
    if (await isReleasePaymentPending(request)) throw new Error('Le patient n’a pas encore payé son formulaire.');
    await update(ref(database, `releaseRequests/${request.id}`), { statut: RELEASE_STATUS.DONE, traiteLe: Date.now(), traitePar: String(by || 'personnel').slice(0, 120) });
    findCivilianUidByPatientId(request.patientNode).then((uid) => notifyUser(uid, {
        type: 'statut', titre: 'Votre demande de divulgation a été traitée', texte: request.autres || undefined, lien: { cible: 'dossierPatient' },
    }));
}

export const canCancelRequest = (request, { uid, isAdmin }) => !!isAdmin || (!!uid && request?.demandeurUid === uid);

export async function cancelReleaseRequest(request, by) {
    await update(ref(database), cancelUpdates(request, by));
}
