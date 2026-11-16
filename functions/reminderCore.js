// functions/reminderCore.js
//
// Règles PURES des rappels automatiques (tâche planifiée « rappels quotidiens », voir functions/index.js) : qui est à relancer, et quand. Aucune dépendance (ni Firebase ni
// réseau) : tout est testé dans src/utils/reminderCore.test.js. Les marqueurs « déjà envoyé » (rappelsEnvoyes/{clé}) évitent d'écrire deux fois la même notification.

export const DAY_MS = 86400000;

const toMs = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const safeKey = (...parts) => parts.map((part) => String(part ?? '').replace(/[.#$[\]/]/g, '_')).join('_');
const flatten = (tree) => Object.entries(tree || {}).flatMap(([uid, items]) => Object.entries(items || {}).map(([id, value]) => ({ uid, id, value }))).filter((entry) => entry.value && typeof entry.value === 'object');

// ───────────── Messagerie : récapitulatif des messages non lus ─────────────
/** entries : messagerie/{uid} ; → null s'il n'y a rien à signaler, sinon { count, items, more }. Seuls comptent les messages non lus depuis plus de `minAgeMs` (par défaut 24 h) : on ne relance pas pour un message tout frais. */
export const unreadDigest = (entries, now, { minAgeMs = DAY_MS, maxItems = 8 } = {}) => {
    const unread = Object.values(entries || {}).filter((entry) => entry && entry.role === 'recu' && entry.lu !== true);
    if (!unread.length || !unread.some((entry) => now - (Number(entry.le) || 0) >= minAgeMs)) return null;
    const sorted = [...unread].sort((a, b) => (Number(b.le) || 0) - (Number(a.le) || 0));
    return {
        count: unread.length,
        items: sorted.slice(0, maxItems).map((entry) => `${entry.de || 'Un collègue'} : ${entry.objet || '(sans objet)'}`),
        more: Math.max(0, unread.length - maxItems),
    };
};

// ───────────── Candidatures ─────────────
const INTERVIEW_STATUSES = ['entretien_programme', 'interview_scheduled'];
const SUBMITTED_STATUSES = ['soumise', 'submitted'];

/** candidatures : candidatures/{uid}/{id} ; entretiens prévus dans les prochaines `leadMs` (36 h) → [{ key, uid, id, nom, poste, when, recruteurUid, recruteurNom }] (une clé par entretien ET par date : un entretien déplacé est rappelé de nouveau). */
export const dueInterviews = (candidatures, now, { leadMs = 36 * 3600000 } = {}) => flatten(candidatures)
    .filter(({ value }) => INTERVIEW_STATUSES.includes(value.statut || value.status))
    .map(({ uid, id, value }) => ({ uid, id, value, when: toMs(value.entretien?.date ?? value.dateEntretien ?? value.interviewDateTime) }))
    .filter(({ when }) => when !== null && when > now && when - now <= leadMs)
    .map(({ uid, id, value, when }) => ({
        key: safeKey('entretien', uid, id, when), uid, id, nom: value.nomCandidat || '', poste: value.poste || '', when,
        recruteurUid: value.entretien?.recruteur?.uid || '', recruteurNom: value.entretien?.recruteur?.nom || '',
    }));

/** Candidatures soumises, sans prise en charge, depuis plus de `afterDays` jours (par défaut 5) → [{ key, uid, id, nom, poste, jours }] ; une seule alerte par candidature. */
export const staleApplications = (candidatures, now, { afterDays = 5 } = {}) => flatten(candidatures)
    .filter(({ value }) => SUBMITTED_STATUSES.includes(value.statut || value.status) && !value.priseEnChargePar)
    .map(({ uid, id, value }) => ({ uid, id, value, since: toMs(value.modifieLe) ?? toMs(value.creeLe) }))
    .filter(({ since }) => since !== null && now - since >= afterDays * DAY_MS)
    .map(({ uid, id, value, since }) => ({ key: safeKey('stale', uid, id), uid, id, nom: value.nomCandidat || '', poste: value.poste || '', jours: Math.floor((now - since) / DAY_MS) }));

// ───────────── Contrats et documents ─────────────
const SENT_STATUSES = ['envoye', 'sent'];
const SIGNED_STATUSES = ['signe', 'signed'];
const contractTitle = (contract) => contract.champs?.poste || contract.reference || 'document';

/**
 * contrats : contrats/{id} ; sent : rappelsEnvoyes (marqueurs). Documents ENVOYÉS et jamais signés depuis plus de `afterDays` jours (3), relancés tous les `repeatDays` jours (3), au plus
 * `maxReminders` fois (4), tant que l'offre n'est pas expirée → [{ key, id, uid, nom, titre, n }].
 */
export const unsignedDocuments = (contrats, now, sent = {}, { afterDays = 3, repeatDays = 3, maxReminders = 4 } = {}) => Object.entries(contrats || {})
    .filter(([, contract]) => contract && SENT_STATUSES.includes(contract.statut) && contract.employeUid)
    .filter(([, contract]) => !contract.offreExpireLe || contract.offreExpireLe > now)
    .map(([id, contract]) => ({ id, contract, key: safeKey('doc', id), sentAt: toMs(contract.envoyeLe) }))
    .filter(({ sentAt, key }) => {
        if (sentAt === null || now - sentAt < afterDays * DAY_MS) return false;
        const marker = sent[key];
        return !marker || ((Number(marker.n) || 0) < maxReminders && now - (Number(marker.last) || 0) >= repeatDays * DAY_MS);
    })
    .map(({ id, contract, key }) => ({ key, id, uid: contract.employeUid, nom: contract.employeNom || '', titre: contractTitle(contract), n: (Number(sent[key]?.n) || 0) + 1 }));

/** Contrats SIGNÉS qui se terminent dans les `leadDays` jours (30) → [{ key, id, uid, nom, titre, fin }] ; une alerte par contrat. */
export const endingContracts = (contrats, now, { leadDays = 30 } = {}) => Object.entries(contrats || {})
    .filter(([, contract]) => contract && SIGNED_STATUSES.includes(contract.statut))
    .map(([id, contract]) => ({ id, contract, fin: toMs(contract.champs?.dateFin) }))
    .filter(({ fin }) => fin !== null && fin > now && fin - now <= leadDays * DAY_MS)
    .map(({ id, contract, fin }) => ({ key: safeKey('fin', id), id, uid: contract.employeUid || '', nom: contract.employeNom || '', titre: contractTitle(contract), fin }));

// ───────────── Échéances des certificats et ordonnances ─────────────
/**
 * echeances : echeances/{id} = { type: 'certificat_vol' | 'aptitude' | 'ordonnance', finLe (ms), delaiJours (préavis), patientID, patientNom?, titre, auteurUid?, notifie? } (posées à l'enregistrement du rapport).
 * À prévenir : préavis atteint, pas déjà fait, et pas échue depuis plus de 30 jours → [{ id, ...échéance, joursRestants }].
 */
export const dueExpiries = (echeances, now) => Object.entries(echeances || {})
    .filter(([, item]) => item && !item.notifie && Number.isFinite(Number(item.finLe)))
    .filter(([, item]) => now >= Number(item.finLe) - (Number(item.delaiJours) || 30) * DAY_MS && now < Number(item.finLe) + 30 * DAY_MS)
    .map(([id, item]) => ({ id, ...item, finLe: Number(item.finLe), joursRestants: Math.ceil((Number(item.finLe) - now) / DAY_MS) }));

export const frDateOf = (ms) => {
    const date = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
};
export const frDateTimeOf = (ms) => {
    const date = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} à ${pad(date.getHours())}h${pad(date.getMinutes())}`;
};
