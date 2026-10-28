// src/utils/cctvRequests.js
//
// Demandes de vidéosurveillance (CCTV) : enregistrées dans RTDB (cctvRequests), traitées par l'administration du
// PHMC (Directeur(trice), Assistant(e) de Direction, Personnel Administratif) et les admins, consultables par leur
// auteur. Chaque demande porte un fil de réponses. Voir database.rules.json et la fonction syncCctvAccess.
import { useEffect, useState } from 'react';
import { ref, push, update, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { database, auth } from '../firebase';
import { logActivity, getActivityActorName } from './activityLog';
import { canonicalPatientId } from './patientId';

const SYNC_ACCESS_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/syncCctvAccess';

export const CCTV_STATUSES = {
    nouvelle:  { label: 'Nouvelle',        color: '#58a6ff', hint: 'Reçue, pas encore lue par la direction.' },
    en_cours:  { label: 'En cours',        color: '#e3b341', hint: "En cours d'examen." },
    acceptee:  { label: 'Acceptée',        color: '#3fb950', hint: 'Les images seront transmises.' },
    refusee:   { label: 'Refusée',         color: '#ff7b72', hint: 'La demande ne peut pas aboutir.' },
};
// Ancien statut « Clôturée » (retiré : une demande est acceptée ou refusée) : seulement pour afficher correctement les demandes
// qui l'avaient déjà, sans le proposer.
export const CCTV_LEGACY_STATUSES = {
    cloturee: { label: 'Clôturée', color: '#8b949e', hint: 'Dossier terminé.' },
};
export const cctvStatusInfo = (status) => CCTV_STATUSES[status] || CCTV_LEGACY_STATUSES[status] || CCTV_STATUSES.nouvelle;
export const CCTV_OPEN_STATUSES = ['nouvelle', 'en_cours'];

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

// Champs de la demande, dans l'ordre du formulaire. Les obligatoires ne peuvent pas être vidés à la modification.
export const CCTV_FIELD_LABELS = [
    "Grade de l'officier requérant", 'Officier requérant', "Numéro de téléphone de l'officier", 'Département requérant', "Nom d'utilisateur Discord",
    "Date/heure de l'incident", 'Raison de la demande', 'Emplacement de la vidéosurveillance', 'Description des événements', 'Notes hors jeu',
];
const OPTIONAL_FIELD_LABELS = ['Notes hors jeu'];
export const isCctvFieldRequired = (label) => !OPTIONAL_FIELD_LABELS.includes(label);

// Tant que la demande n'est ni acceptée ni refusée, son auteur peut la modifier (et écrire dans le fil).
export const isCctvEditable = (request) => CCTV_OPEN_STATUSES.includes(request?.statut);

// Demande d'accès au traitement : ajuste le drapeau serveur d'après le rôle (sans effet si la personne n'a pas le rôle).
let lastSync = 0;
export const syncCctvAccess = async () => {
    const user = auth.currentUser;
    if (!user || Date.now() - lastSync < 60000) return;
    lastSync = Date.now();
    try {
        const token = await user.getIdToken();
        await fetch(SYNC_ACCESS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
    } catch (error) {
        console.warn('Vérification des droits CCTV impossible :', error?.message || error);
    }
};

// true si la personne connectée peut traiter les demandes (administration du PHMC ou admin).
export const useCctvManager = (isAdmin) => {
    const [flag, setFlag] = useState(false);
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) { setFlag(false); return undefined; }
        syncCctvAccess();
        return onValue(ref(database, `cctvGestionnaires/${user.uid}`), (snapshot) => setFlag(snapshot.val() === true), () => setFlag(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.currentUser?.uid]);
    return !!isAdmin || flag;
};

// fields : [{ label, value }] dans l'ordre d'affichage. summary : { agent, departement, lieu } pour les listes.
export const submitCctvRequest = async ({ title, fields, discord, patientID, summary = {} }) => {
    const user = auth.currentUser;
    if (!user) return { ok: false, reason: 'not-signed-in' };
    const requestRef = push(ref(database, 'cctvRequests'));
    const id = requestRef.key;
    const now = Date.now();
    const entry = {
        ts: now,
        maj: now,
        statut: 'nouvelle',
        titre: clean(title, 200) || 'Demande de vidéosurveillance',
        by: { uid: user.uid, name: clean(getActivityActorName() || user.email || 'Inconnu', 120) },
        champs: (fields || []).map(({ label, value }) => ({ l: clean(label, 120), v: clean(value, 5000) })).filter((field) => field.l && field.v),
        resume: {
            agent: clean(summary.agent, 120),
            departement: clean(summary.departement, 120),
            lieu: clean(summary.lieu, 200),
        },
    };
    if (user.email) entry.by.email = clean(user.email, 120);
    if (discord) entry.by.discord = clean(discord, 80);
    // ID patient du demandeur : si son compte est supprimé puis recréé, la demande lui est rattachée (adoptArchivedRecords).
    if (patientID) entry.by.patientID = clean(canonicalPatientId(patientID), 40);
    try {
        await update(ref(database), {
            [`cctvRequests/${id}`]: entry,
            [`cctvParDemandeur/${user.uid}/${id}`]: true,
        });
        logActivity({ category: 'demandes', action: 'request_cctv', summary: `Demande de vidéosurveillance : ${entry.titre}`, target: id });
        return { ok: true, id };
    } catch (error) {
        console.error('Envoi de la demande CCTV impossible :', error);
        return { ok: false, reason: 'write-failed', error };
    }
};

// Une réponse dans le fil. `staff` : message de l'administration (affiché comme tel). `status` : nouveau statut (optionnel, gestionnaires).
export const addCctvReply = async ({ request, text, staff, status, authorName, authorRole }) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Connexion requise.');
    if (!staff && ['acceptee', 'refusee', 'cloturee'].includes(request.statut)) throw new Error('Cette demande est traitée : vous ne pouvez plus y envoyer de message.');
    const replyId = push(ref(database, `cctvRequests/${request.id}/reponses`)).key;
    const now = Date.now();
    const reply = {
        ts: now,
        par: { uid: user.uid, name: clean(authorName || getActivityActorName() || user.email || 'Inconnu', 120), role: clean(authorRole || (staff ? 'Administration' : 'Demandeur'), 80), staff: !!staff },
        texte: clean(text, 4000),
    };
    if (status && staff) reply.statut = status;
    const updates = { [`cctvRequests/${request.id}/reponses/${replyId}`]: reply, [`cctvRequests/${request.id}/maj`]: now };
    if (staff && status && status !== request.statut) {
        updates[`cctvRequests/${request.id}/statut`] = status;
        updates[`cctvRequests/${request.id}/traitePar`] = { uid: user.uid, name: reply.par.name, ts: now };
    }
    await update(ref(database), updates);
    if (staff) {
        logActivity({
            category: 'demandes', action: 'cctv_reply',
            summary: `Réponse à la demande CCTV « ${request.titre} »${status && status !== request.statut ? ` — ${CCTV_STATUSES[status]?.label || status}` : ''}`,
            target: request.id,
        });
    }
};

export const setCctvStatus = async (request, status, authorName) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Connexion requise.');
    const now = Date.now();
    const actor = clean(authorName || getActivityActorName() || user.email, 120);
    const historyId = push(ref(database, `cctvRequests/${request.id}/historique`)).key;
    await update(ref(database), {
        [`cctvRequests/${request.id}/statut`]: status,
        [`cctvRequests/${request.id}/maj`]: now,
        [`cctvRequests/${request.id}/traitePar`]: { uid: user.uid, name: actor, ts: now },
        [`cctvRequests/${request.id}/historique/${historyId}`]: { ts: now, type: 'statut', statut: status, de: request.statut || null, par: { uid: user.uid, name: actor, staff: true } },
    });
    logActivity({ category: 'demandes', action: 'cctv_status', summary: `Demande CCTV « ${request.titre} » : ${CCTV_STATUSES[status]?.label || status}`, target: request.id });
};

// Modifie la demande par son auteur (statut « nouvelle » ou « en cours » seulement). `values` : { [libellé du champ]: valeur }.
// Les champs modifiés sont consignés dans l'historique (avant / après) pour que l'administration voie ce qui a changé.
// Retourne { changed: false } s'il n'y a rien à enregistrer.
export const editCctvRequest = async ({ request, values, authorName }) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Connexion requise.');
    if (request.by?.uid !== user.uid) throw new Error('Seul l\'auteur de la demande peut la modifier.');
    if (!isCctvEditable(request)) throw new Error('Cette demande est traitée (acceptée ou refusée) : elle ne peut plus être modifiée.');

    const before = Object.fromEntries((request.champs || []).map((field) => [field.l, field.v]));
    const labels = [...CCTV_FIELD_LABELS, ...(request.champs || []).map((field) => field.l).filter((label) => !CCTV_FIELD_LABELS.includes(label))];
    const next = {};
    labels.forEach((label) => { next[label] = clean(label in values ? values[label] : before[label], 5000); });
    const missing = labels.filter((label) => isCctvFieldRequired(label) && (label in before || label in values) && !next[label]);
    if (missing.length) throw new Error(`Champ(s) obligatoire(s) vide(s) : ${missing.join(', ')}.`);

    const modifs = labels
        .filter((label) => (before[label] || '') !== next[label])
        .map((label) => ({ l: label, avant: clean(before[label] || '', 1000), apres: clean(next[label], 1000) }));
    if (modifs.length === 0) return { changed: false };

    const champs = labels.map((label) => ({ l: label, v: next[label] })).filter((field) => field.v);
    const resume = {
        agent: clean(next['Officier requérant'], 120),
        departement: clean(next['Département requérant'], 120),
        lieu: clean(next['Emplacement de la vidéosurveillance'], 200),
    };
    const titre = clean(`${(next['Emplacement de la vidéosurveillance'] || '').split('\n')[0] || 'Lieu non précisé'} — ${next['Département requérant'] || 'Service non précisé'}`, 200);
    const now = Date.now();
    const historyId = push(ref(database, `cctvRequests/${request.id}/historique`)).key;
    await update(ref(database), {
        [`cctvRequests/${request.id}/champs`]: champs,
        [`cctvRequests/${request.id}/resume`]: resume,
        [`cctvRequests/${request.id}/titre`]: titre,
        [`cctvRequests/${request.id}/maj`]: now,
        [`cctvRequests/${request.id}/historique/${historyId}`]: {
            ts: now, type: 'modification',
            par: { uid: user.uid, name: clean(authorName || getActivityActorName() || user.email || 'Inconnu', 120), staff: false },
            modifs,
        },
    });
    logActivity({
        category: 'demandes', action: 'cctv_edited', summary: `Demande de vidéosurveillance modifiée : ${titre}`, target: request.id,
        details: modifs.map((modif) => modif.l).join(', '),
    });
    return { changed: true, modifs };
};

// Historique d'une demande, du plus ancien au plus récent : dépôt, modifications du demandeur, changements de statut
// (par réponse ou seuls). Le dépôt et les statuts posés par une réponse se déduisent de la demande elle-même.
export const historyOf = (request) => {
    const entries = [];
    entries.push({ id: 'creation', ts: request.ts || 0, type: 'creation', par: { name: request.by?.name || 'Demandeur', staff: false } });
    Object.entries(request.historique || {}).forEach(([id, entry]) => entries.push({ id, ...entry }));
    repliesOf(request).filter((reply) => reply.statut).forEach((reply) => entries.push({
        id: `reply-${reply.id}`, ts: reply.ts, type: 'statut', statut: reply.statut, par: reply.par,
    }));
    return entries.sort((a, b) => (a.ts || 0) - (b.ts || 0));
};

// Réponses d'une demande, en liste triée par date.
export const repliesOf = (request) => Object.entries(request.reponses || {})
    .map(([id, reply]) => ({ id, ...reply }))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));

// Toutes les demandes (gestionnaires), temps réel.
export const subscribeToAllCctvRequests = (callback, onError) => onValue(
    query(ref(database, 'cctvRequests'), orderByChild('ts'), limitToLast(500)),
    (snapshot) => {
        const list = [];
        snapshot.forEach((child) => { list.push({ id: child.key, ...child.val() }); });
        callback(list.reverse());
    },
    onError,
);

// Les demandes de la personne connectée : index cctvParDemandeur puis lecture individuelle (temps réel).
export const subscribeToMyCctvRequests = (callback, onError) => {
    const user = auth.currentUser;
    if (!user) { callback([]); return () => {}; }
    const requests = {};
    const itemUnsubscribers = {};
    const emit = () => callback(Object.values(requests).sort((a, b) => (b.ts || 0) - (a.ts || 0)));
    const indexUnsubscribe = onValue(ref(database, `cctvParDemandeur/${user.uid}`), (snapshot) => {
        const ids = Object.keys(snapshot.val() || {});
        Object.keys(itemUnsubscribers).filter((id) => !ids.includes(id)).forEach((id) => { itemUnsubscribers[id](); delete itemUnsubscribers[id]; delete requests[id]; });
        ids.filter((id) => !itemUnsubscribers[id]).forEach((id) => {
            itemUnsubscribers[id] = onValue(ref(database, `cctvRequests/${id}`), (itemSnapshot) => {
                if (itemSnapshot.exists()) requests[id] = { id, ...itemSnapshot.val() }; else delete requests[id];
                emit();
            }, onError);
        });
        emit();
    }, onError);
    return () => { indexUnsubscribe(); Object.values(itemUnsubscribers).forEach((unsubscribe) => unsubscribe()); };
};

