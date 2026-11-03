// src/utils/accountDeletion.js
//
// Suppression de compte, à la demande de la personne :
//   • compte CIVIL : suppression directe (après confirmation) par la fonction serveur deleteOwnCivilAccount ;
//   • PERSONNEL : demande envoyée aux admins (demandesSuppression/{uid}), qui suppriment le compte ou refusent (Admin → Demandes de suppression).
// Dans les deux cas les archives liées à l'ID patient (dossier, rapports, factures, candidatures, contrats) sont conservées : voir deletedAccounts.js.
import { ref, get, set, remove } from 'firebase/database';
import { database, auth } from '../firebase';
import { logActivity } from './activityLog';
import { notifyGroup } from './notifications';

const NODE = 'demandesSuppression';
const clean = (text, max) => String(text || '').trim().slice(0, max);

export const CONFIRM_WORD = 'SUPPRIMER';

// Suppression immédiate de SON compte Civil. Lève une erreur si la fonction serveur la refuse (personnel, admin, profil introuvable…).
export async function deleteOwnCivilAccount() {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Connexion requise.');
    const response = await fetch(`https://europe-west1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/deleteOwnCivilAccount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({}),
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Suppression impossible (${response.status}).`);
    }
}

export async function loadMyDeletionRequest(uid) {
    if (!uid) return null;
    const snap = await get(ref(database, `${NODE}/${uid}`));
    return snap.exists() ? snap.val() : null;
}

// Le membre du personnel demande la suppression de son compte.
export async function requestStaffDeletion({ uid, name, email, rank, reason }) {
    if (!uid) throw new Error('Connexion requise.');
    const entry = {
        demandeLe: Date.now(), nom: clean(name, 120) || 'Sans nom', statut: 'en_attente',
        ...(clean(email, 200) ? { email: clean(email, 200) } : {}),
        ...(clean(rank, 120) ? { rang: clean(rank, 120) } : {}),
        ...(clean(reason, 500) ? { motif: clean(reason, 500) } : {}),
    };
    await set(ref(database, `${NODE}/${uid}`), entry);
    notifyGroup('administration', { type: 'demande', titre: 'Demande de suppression de compte', texte: `${entry.nom}${entry.rang ? ` — ${entry.rang}` : ''}`, lien: { cible: 'admin', section: 'accountDeletions' } });
    logActivity({ category: 'comptes', action: 'deletion_requested', severity: 'warning', summary: `Demande de suppression de compte : ${entry.nom}`, details: entry.motif, target: entry.nom });
    return entry;
}

export async function cancelDeletionRequest(uid) {
    await remove(ref(database, `${NODE}/${uid}`));
}

// Admin : toutes les demandes, les plus anciennes d'abord.
export async function loadDeletionRequests() {
    const snap = await get(ref(database, NODE));
    return Object.entries(snap.exists() ? snap.val() : {})
        .map(([uid, value]) => ({ uid, ...value }))
        .sort((a, b) => (a.demandeLe || 0) - (b.demandeLe || 0));
}

// Admin : retire la demande une fois traitée (compte supprimé ou refus).
export async function closeDeletionRequest(uid) {
    await remove(ref(database, `${NODE}/${uid}`));
}
