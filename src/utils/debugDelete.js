// src/utils/debugDelete.js
//
// Suppressions « de test » : quand l'interrupteur Debug « Autoriser la suppression » est activé (Admin → Debug), un admin peut supprimer n'importe quelle
// entrée des nouveaux formulaires (Take Home Car, sécurité incendie, vidéosurveillance, contrats commerciaux…) : vider des tests, des demandes
// farfelues. Les règles Firebase donnent déjà l'écriture aux admins ; l'interrupteur évite seulement les suppressions par erreur.
import { ref, get, update, remove } from 'firebase/database';
import { database } from '../firebase';
import { logActivity } from './activityLog';

const logDelete = (action, summary, details) => logActivity({ category: 'comptes', action, severity: 'warning', summary, details });

// Demande de Take Home Car (et l'attribution qu'elle a créée, si elle est encore en cours).
export async function removeTakeHomeRequest(request) {
    const updates = { [`demandes/${request.uid}/${request.id}`]: null };
    const holder = await get(ref(database, `takeHomeCars/attributions/${request.plaque}`));
    if (holder.exists() && holder.val().demandeId === request.id) updates[`attributions/${request.plaque}`] = null;
    await update(ref(database, 'takeHomeCars'), updates);
    logDelete('debug_take_home_deleted', `Take Home Car supprimé (debug) : ${request.plaque}`, `Demandeur : ${request.demandeurNom || '—'}`);
}

// Sécurité incendie : kind = 'controles' | 'nonConformites' | 'exercices'.
export async function removeFireRecord(kind, id) {
    await remove(ref(database, `securiteIncendie/${kind}/${id}`));
    logDelete('debug_fire_deleted', `Sécurité incendie : entrée supprimée (debug) — ${kind}`, id);
}

// Demande de vidéosurveillance, avec son entrée dans l'index du demandeur.
export async function removeCctvRequest(request) {
    const updates = { [`cctvRequests/${request.id}`]: null };
    if (request.by?.uid) updates[`cctvParDemandeur/${request.by.uid}/${request.id}`] = null;
    await update(ref(database), updates);
    logDelete('debug_cctv_deleted', `Demande de vidéosurveillance supprimée (debug) : ${request.titre || request.id}`, request.by?.name);
}

// Accord commercial, y compris signé (sinon seuls les brouillons et accords envoyés se suppriment).
export async function removeAgreementAnyStatus(agreement) {
    const updates = { [`accordsCommerciaux/${agreement.id}`]: null };
    if (agreement.partieUid) updates[`accordsParPartie/${agreement.partieUid}/${agreement.id}`] = null;
    await update(ref(database), updates);
    logDelete('debug_agreement_deleted', `Accord commercial supprimé (debug) : ${agreement.champs?.titre || agreement.id}`, agreement.champs?.partieNom);
}
