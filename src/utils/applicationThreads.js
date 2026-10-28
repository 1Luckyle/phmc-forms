// src/utils/applicationThreads.js
//
// Échanges entre un candidat et le recrutement, sur une candidature (même principe que les demandes CCTV).
//   echangesCandidature/{candidatUid}/{candidatureId}/messages/{id}  { ts, par: { uid, name, role, staff }, texte }
//   echangesCandidature/{candidatUid}/{candidatureId}/ferme          { le, par, motif } — fil fermé, personne n'écrit plus
//   echangesMeta/{candidatUid}/{candidatureId}                       { ts, staff, par } — dernier message (pastilles « à répondre »)
//
// Ouvert tant que la candidature est en cours d'examen, en entretien ou acceptée (THREAD_OPEN_STATUSES) ; fermé
//   • au refus (le statut sort de la liste : rien à écrire),
//   • à la signature du contrat d'une candidature acceptée (closeThreadsAfterContract).
// Les règles Firebase appliquent les mêmes conditions (database.rules.json).
import { ref, push, update, set, onValue } from 'firebase/database';
import { database, auth } from '../firebase';
import { THREAD_OPEN_STATUSES } from '../constants/recruitment';
import { loadApplicationsOf } from './recruitmentStore';
import { assertNotLocked } from './lockdownGuard';

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

export const isThreadOpenStatus = (status) => THREAD_OPEN_STATUSES.includes(status);

// Fil en direct d'une candidature → { messages: [...du plus ancien au plus récent], ferme: {...}|null }.
export const subscribeThread = (candidatUid, id, onData, onError) => onValue(
    ref(database, `echangesCandidature/${candidatUid}/${id}`),
    (snap) => {
        const value = snap.val() || {};
        const messages = Object.entries(value.messages || {}).map(([messageId, message]) => ({ id: messageId, ...message })).sort((a, b) => (a.ts || 0) - (b.ts || 0));
        onData({ messages, ferme: value.ferme || null });
    },
    onError,
);

// Dernier message de chaque candidature, pour le recrutement : { 'uid/id': { ts, staff, par } }.
export const subscribeAllThreadMeta = (onData, onError) => onValue(ref(database, 'echangesMeta'), (snap) => {
    const flat = {};
    Object.entries(snap.val() || {}).forEach(([uid, byId]) => Object.entries(byId || {}).forEach(([id, meta]) => { flat[`${uid}/${id}`] = meta; }));
    onData(flat);
}, onError);

// Idem pour un candidat (ses propres candidatures) : { id: { ts, staff, par } }.
export const subscribeMyThreadMeta = (candidatUid, onData, onError) => onValue(
    ref(database, `echangesMeta/${candidatUid}`), (snap) => onData(snap.val() || {}), onError,
);

// Envoie un message. `application` : candidature normalisée (id, candidatUid, statut). `staff` : true pour le recrutement.
export const sendThreadMessage = async ({ application, text, staff, authorName, authorRole }) => {
    assertNotLocked();
    const user = auth.currentUser;
    if (!user) throw new Error('Connexion requise.');
    if (!isThreadOpenStatus(application.statut)) throw new Error("Les échanges ne sont pas ouverts sur cette candidature (ou ne le sont plus).");
    const body = clean(text, 4000);
    if (!body) throw new Error('Message vide.');
    const base = `echangesCandidature/${application.candidatUid}/${application.id}`;
    const messageId = push(ref(database, `${base}/messages`)).key;
    const now = Date.now();
    const par = {
        uid: user.uid, name: clean(authorName || user.email || 'Inconnu', 120),
        role: clean(authorRole || (staff ? 'Recrutement' : 'Candidat'), 80), staff: !!staff,
    };
    await update(ref(database), {
        [`${base}/messages/${messageId}`]: { ts: now, par, texte: body },
        [`echangesMeta/${application.candidatUid}/${application.id}`]: { ts: now, staff: !!staff, par: par.name },
    });
    return { id: messageId, ts: now, par, texte: body };
};

// Ferme un fil (aucun message possible ensuite). Lève la fermeture : réservé au recrutement (suppression du nœud).
export const closeThread = async (candidatUid, id, { par, motif }) => {
    await set(ref(database, `echangesCandidature/${candidatUid}/${id}/ferme`), { le: Date.now(), par: clean(par, 120) || null, motif: clean(motif, 200) || null });
};

// Contrat signé : les fils des candidatures ACCEPTÉES de cette personne se ferment (best-effort, ne bloque jamais la signature).
export const closeThreadsAfterContract = async (candidatUid) => {
    try {
        const applications = await loadApplicationsOf(candidatUid);
        await Promise.all(applications
            .filter((application) => application.statut === 'acceptee')
            .map((application) => closeThread(candidatUid, application.id, { par: 'Système', motif: 'Contrat signé' }).catch(() => {})));
    } catch (error) {
        console.warn('Fils de candidature non fermés après la signature du contrat :', error?.message || error);
    }
};
