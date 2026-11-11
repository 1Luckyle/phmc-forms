// src/utils/externalMails.js
//
// Partage des MAILS EXTERNES (formulaire 42) entre membres du personnel.
//
// Un mail externe n'a pas d'ID patient : il n'est rangé dans aucun dossier patient. Il vit sous savedReports/{nœud du créateur}/{clé} et seul son créateur (et les admins) le lit. Son créateur
// peut le PARTAGER avec d'autres membres du personnel, sans en céder la propriété : il reste le seul à pouvoir le modifier, le supprimer ou retirer le partage.
//   savedReports/{ownerNode}/{key}/partageAvec/{nœud du destinataire}   = nom du destinataire (ce qui autorise sa lecture, voir database.rules.json) ;
//   partagesRecus/{nœud du destinataire}/{ownerNode}__{key}            = { ownerNode, reportKey, titre, de, le } : la liste « partagés avec moi » du destinataire.
// Le « nœud » d'une personne est son nom rangé par comprehensiveSanitize (le même que celui de ses rapports enregistrés).
import { ref, get, update } from 'firebase/database';
import { database } from '../firebase';
import { comprehensiveSanitize } from './patientRecords';
import { loadStaffMembers } from './staffAdmin';
import { notifyUser } from './notifications';

export const EXTERNAL_MAIL_VERSION = 42;
export const isExternalMail = (report) => Number(report?.bbCodeVersion) === EXTERNAL_MAIL_VERSION;

export const shareId = (ownerNode, reportKey) => `${ownerNode}__${reportKey}`;
export const nodeOfName = (name) => comprehensiveSanitize(name);

// Personnel avec qui on peut partager (tout le personnel sauf soi-même) : [{ uid, name, node, rank }].
export const loadShareTargets = async (myNode) => {
    const members = await loadStaffMembers();
    const seen = new Set();
    return members
        .filter((member) => member.uid && member.name)
        .map((member) => ({ uid: member.uid, name: member.name, label: member.displayName || member.name, node: nodeOfName(member.name), rank: member.rank || member.category || '' }))
        .filter((member) => member.node && member.node !== myNode && !seen.has(member.node) && seen.add(member.node));
};

// Personnes avec qui ce mail est déjà partagé : { nœud: nom }.
export const loadMailShares = async (ownerNode, reportKey) => {
    const snap = await get(ref(database, `savedReports/${ownerNode}/${reportKey}/partageAvec`));
    return snap.exists() ? snap.val() : {};
};

// Partage avec ces personnes ([{ uid, name, node }]). Retourne le nombre de partages ajoutés.
export const shareMail = async ({ ownerNode, reportKey, title, fromName, recipients }) => {
    const list = (recipients || []).filter((recipient) => recipient && recipient.node && recipient.node !== ownerNode);
    if (!ownerNode || !reportKey || list.length === 0) return 0;
    const now = Date.now();
    const updates = {};
    list.forEach((recipient) => {
        updates[`savedReports/${ownerNode}/${reportKey}/partageAvec/${recipient.node}`] = recipient.name;
        updates[`partagesRecus/${recipient.node}/${shareId(ownerNode, reportKey)}`] = { ownerNode, reportKey, titre: String(title || 'Mail externe').slice(0, 200), de: String(fromName || '').slice(0, 120), le: now };
    });
    await update(ref(database), updates);
    list.forEach((recipient) => {
        notifyUser(recipient.uid, { type: 'partage', titre: `${fromName || 'Un collègue'} a partagé un mail externe avec vous`, texte: title || undefined, lien: { cible: 'rapports' } });
    });
    return list.length;
};

// Retire le partage avec UNE personne (le mail reste intact chez son créateur).
export const unshareMail = async ({ ownerNode, reportKey, node }) => {
    if (!ownerNode || !reportKey || !node) return;
    await update(ref(database), {
        [`savedReports/${ownerNode}/${reportKey}/partageAvec/${node}`]: null,
        [`partagesRecus/${node}/${shareId(ownerNode, reportKey)}`]: null,
    });
};

// Avant de supprimer un mail partagé : retire les lignes des listes de ses destinataires (sinon elles resteraient sans mail).
export const purgeMailShares = async ({ ownerNode, reportKey }) => {
    try {
        const shares = await loadMailShares(ownerNode, reportKey);
        const updates = {};
        Object.keys(shares).forEach((node) => { updates[`partagesRecus/${node}/${shareId(ownerNode, reportKey)}`] = null; });
        if (Object.keys(updates).length > 0) await update(ref(database), updates);
    } catch (error) { console.warn('Partages du mail non nettoyés :', error?.message || error); }
};

// Mails partagés AVEC MOI : chaque ligne de ma liste est relue sur le mail lui-même ; une ligne dont le mail a disparu (supprimé) ou dont le partage a été retiré est ignorée et nettoyée.
// → [{ id, ownerNode, reportKey, titre, de, le, bbCode, title, timestamp }]
export const loadMailsSharedWithMe = async (myNode) => {
    if (!myNode) return [];
    const snap = await get(ref(database, `partagesRecus/${myNode}`));
    const lines = snap.exists() ? Object.entries(snap.val() || {}) : [];
    const items = [];
    const stale = {};
    await Promise.all(lines.map(async ([id, line]) => {
        try {
            const mail = (await get(ref(database, `savedReports/${line.ownerNode}/${line.reportKey}`))).val();
            if (!mail || !mail.partageAvec || !mail.partageAvec[myNode]) { stale[`partagesRecus/${myNode}/${id}`] = null; return; }
            items.push({ id, ownerNode: line.ownerNode, reportKey: line.reportKey, titre: line.titre, de: line.de || mail.authorName || '', le: line.le, bbCode: mail.bbCode || '', title: mail.title || line.titre, timestamp: mail.timestamp || line.le });
        } catch (error) {
            // lecture refusée : le partage a été retiré entre-temps
            stale[`partagesRecus/${myNode}/${id}`] = null;
        }
    }));
    if (Object.keys(stale).length > 0) update(ref(database), stale).catch(() => {});
    return items.sort((a, b) => (b.le || 0) - (a.le || 0));
};

// Retire une ligne de MA liste (le mail reste chez son créateur).
export const dropSharedMail = (myNode, id) => update(ref(database), { [`partagesRecus/${myNode}/${id}`]: null });
