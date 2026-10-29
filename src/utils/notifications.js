// src/utils/notifications.js
//
// Central de notifications (la cloche) : tout ce qui nous est adressé — réponse à un message, changement de statut d'une demande ou d'une candidature,
// partage ou copie d'un dossier, nouveau contrat à signer — et, pour l'administration, tout ce qui arrive en son absence (bug, demande de
// fonctionnalité, problème de sécurité incendie, contrat signé, demande de vidéosurveillance…).
//
// Stockage (Firebase Realtime Database) :
//   notifications/{uid}/{id}                 notifications PERSONNELLES (lisibles par leur destinataire seul) ;
//   notificationsGroupes/{groupe}/{id}       notifications de GROUPE (admin, recrutement, incendie), lisibles par les membres du groupe ;
//   notificationsLecture/{uid}               état de lecture de chacun : { luJusqua, groupesDepuis, lues: { clé: true } }.
// Une notification est immuable une fois créée : « lu » ne se range que dans notificationsLecture (une même notification de groupe peut ainsi
// être lue par l'un et pas par l'autre). Tout est « au mieux » : l'envoi d'une notification ne fait jamais échouer l'action qui l'a déclenchée.
//
// lien : { cible, section?, id? } — où mène un clic (voir handleNotificationNavigate dans MainApp).
import { ref, push, set, get, update, onValue, query, limitToLast } from 'firebase/database';
import { database, auth } from '../firebase';
import { canonicalPatientId } from './patientId';

export const NOTIFICATION_GROUPS = {
    admin: { label: 'Administration', color: '#f2cc60' },
    recrutement: { label: 'Recrutement', color: '#d2a8ff' },
    incendie: { label: 'Sécurité incendie', color: '#ff7b72' },
    administration: { label: 'Direction & administration', color: '#79c0ff' },
};

// Type -> icône et couleur d'affichage.
export const NOTIFICATION_TYPES = {
    message: { icon: 'fa-comment-dots', color: '#58a6ff' },
    statut: { icon: 'fa-circle-check', color: '#3fb950' },
    partage: { icon: 'fa-share-nodes', color: '#a371f7' },
    copie: { icon: 'fa-copy', color: '#a371f7' },
    contrat: { icon: 'fa-file-signature', color: '#d2a8ff' },
    recrutement: { icon: 'fa-user-plus', color: '#d2a8ff' },
    demande: { icon: 'fa-inbox', color: '#ffa657' },
    bug: { icon: 'fa-bug', color: '#ff7b72' },
    fonctionnalite: { icon: 'fa-lightbulb', color: '#e3b341' },
    incendie: { icon: 'fa-fire-extinguisher', color: '#ff7b72' },
    compte: { icon: 'fa-user-gear', color: '#79c0ff' },
    cctv: { icon: 'fa-video', color: '#79c0ff' },
};

const FEED_LIMIT = 60;
const clean = (value, max) => String(value ?? '').trim().slice(0, max);

const buildEntry = ({ type, titre, texte, lien }) => {
    const user = auth.currentUser;
    const entry = {
        type: NOTIFICATION_TYPES[type] ? type : 'demande',
        titre: clean(titre, 160),
        creeLe: Date.now(),
        deUid: user?.uid || '',
    };
    const body = clean(texte, 400);
    if (body) entry.texte = body;
    if (lien && lien.cible) {
        entry.lien = { cible: clean(lien.cible, 40) };
        if (lien.section) entry.lien.section = clean(lien.section, 120);
        if (lien.id) entry.lien.id = clean(lien.id, 120);
    }
    return entry;
};

// Notification personnelle. Jamais pour soi-même ; échec silencieux.
export const notifyUser = async (uid, payload) => {
    try {
        if (!uid || !auth.currentUser || uid === auth.currentUser.uid) return false;
        const entry = buildEntry(payload);
        if (!entry.titre) return false;
        await set(push(ref(database, `notifications/${uid}`)), entry);
        return true;
    } catch (error) {
        console.warn('Notification non envoyée :', error?.message || error);
        return false;
    }
};

// Notification de groupe (admin, recrutement, incendie) : vue par tous ses membres, y compris l'expéditeur s'il en fait partie.
export const notifyGroup = async (group, payload) => {
    try {
        if (!NOTIFICATION_GROUPS[group] || !auth.currentUser) return false;
        const entry = buildEntry(payload);
        if (!entry.titre) return false;
        await set(push(ref(database, `notificationsGroupes/${group}`)), entry);
        return true;
    } catch (error) {
        console.warn('Notification de groupe non envoyée :', error?.message || error);
        return false;
    }
};

// Groupes que la personne peut lire (les règles Firebase appliquent les mêmes conditions).
export const groupsFor = ({ isAdmin, canManageRecruitment, canManageFire }) => [
    ...(isAdmin ? ['admin'] : []),
    ...(isAdmin || canManageRecruitment ? ['recrutement'] : []),
    ...(isAdmin || canManageFire ? ['incendie', 'administration'] : []),
];

const PERSONAL = 'personnel';

// Abonnement en direct. onData({ items, unread }) : items = [{ key, feed, id, lu, type, titre, texte, lien, creeLe, deNom? }] du plus récent au plus ancien.
// Retourne la fonction de désabonnement.
export const subscribeNotifications = ({ uid, groups = [], onData }) => {
    if (!uid) { onData({ items: [], unread: 0 }); return () => {}; }
    const startedAt = Date.now();
    const feeds = {};          // feed -> [{...}]
    let lecture = null;        // notificationsLecture/{uid}
    const unsubscribers = [];

    const emit = () => {
        const lues = (lecture && lecture.lues) || {};
        const readUntil = Number(lecture?.luJusqua) || 0;
        // Les groupes ne remontent pas leur historique : seulement ce qui arrive après la première ouverture de la cloche.
        const groupsSince = Number(lecture?.groupesDepuis) || startedAt;
        const items = Object.values(feeds).flat().map((item) => {
            const since = item.feed === PERSONAL ? 0 : groupsSince;
            const lu = !!lues[item.key] || item.creeLe <= readUntil || item.creeLe < since;
            return { ...item, lu, hidden: item.creeLe < since };
        }).filter((item) => !item.hidden).sort((a, b) => b.creeLe - a.creeLe);
        onData({ items, unread: items.filter((item) => !item.lu).length });
    };

    const listen = (feed, path) => {
        unsubscribers.push(onValue(query(ref(database, path), limitToLast(FEED_LIMIT)), (snapshot) => {
            const value = snapshot.val() || {};
            feeds[feed] = Object.entries(value).filter(([, entry]) => entry && entry.titre).map(([id, entry]) => ({
                ...entry, id, feed, key: feed === PERSONAL ? `p_${id}` : `g_${feed}_${id}`, creeLe: Number(entry.creeLe) || 0,
            }));
            emit();
        }, () => { feeds[feed] = []; emit(); }));
    };

    unsubscribers.push(onValue(ref(database, `notificationsLecture/${uid}`), (snapshot) => {
        lecture = snapshot.val() || {};
        // Première ouverture : on fixe le point de départ des notifications de groupe.
        if (groups.length > 0 && !lecture.groupesDepuis) {
            update(ref(database, `notificationsLecture/${uid}`), { groupesDepuis: startedAt }).catch(() => {});
        }
        emit();
    }, () => { lecture = {}; emit(); }));
    listen(PERSONAL, `notifications/${uid}`);
    groups.forEach((group) => listen(group, `notificationsGroupes/${group}`));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};

export const markNotificationRead = (uid, key) => update(ref(database, `notificationsLecture/${uid}/lues`), { [key]: true });

// Tout marquer comme lu : on avance le repère de lecture (et on vide la liste des lues individuelles, devenue inutile).
export const markAllNotificationsRead = async (uid, items = []) => {
    const latest = items.reduce((max, item) => Math.max(max, item.creeLe || 0), 0);
    await update(ref(database, `notificationsLecture/${uid}`), { luJusqua: Math.max(Date.now(), latest), lues: null });
};

// ───────── Retrouver le destinataire ─────────
// Compte Civil d'un patient (par son ID patient) : lisible par le personnel et les admins. null si introuvable ou lecture refusée.
export const findCivilianUidByPatientId = async (patientID) => {
    try {
        const wanted = canonicalPatientId(patientID);
        if (!wanted) return null;
        const snap = await get(ref(database, 'civilians'));
        const civil = Object.values(snap.val() || {}).find((entry) => entry && entry.uid && entry.patientID && canonicalPatientId(entry.patientID) === wanted);
        return civil?.uid || null;
    } catch (error) {
        return null;
    }
};

// Membre du personnel propriétaire d'un nœud de rapports (savedReports/{nœud}) : `sanitize` est la fonction qui range un nom dans un nœud.
export const findStaffUidByNode = async (nodeKey, sanitize) => {
    try {
        for (const path of ['staff/phmc', 'staff/coroner']) {
            const snap = await get(ref(database, path));
            const member = Object.values(snap.val() || {}).find((entry) => entry && entry.uid && sanitize(entry.name) === nodeKey);
            if (member) return member.uid;
        }
    } catch (error) { /* lecture refusée : pas de notification */ }
    return null;
};
