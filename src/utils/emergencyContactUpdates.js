// src/utils/emergencyContactUpdates.js
//
// Contact d'urgence modifié depuis un formulaire de santé mentale (psychiatrie, évaluation psychologique) : le dossier du patient est mis à jour. Le dossier n'est JAMAIS écrit par un client :
// l'enregistrement du rapport pose une demande (contactsUrgenceMaj/{ID patient}/{clé}) que la fonction serveur reconcileDossiers applique (sous une minute) puis supprime.
import { ref, push, set } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from './patientId';
import { lookupDossier, forgetDossierLookup } from './dossierLookup';
import { emergencyContactChanges } from './careFormRules';

// Retourne true si une demande de mise à jour a été posée. Rien si le patient n'a pas de dossier, ou si le contact n'a pas changé.
export const queueEmergencyContactUpdate = async ({ patientID, formData, authorName, reportTitle }) => {
    const node = canonicalPatientId(patientID);
    if (!node) return false;
    forgetDossierLookup(node); // lecture fraîche : le dossier a pu changer depuis le début de la saisie
    const { status, donnees } = await lookupDossier(node);
    if (status !== 'found') return false;
    const changes = emergencyContactChanges(donnees, formData);
    if (Object.keys(changes).length === 0) return false;
    await set(push(ref(database, `contactsUrgenceMaj/${node}`)), { champs: changes, par: String(authorName || '').slice(0, 120), titre: String(reportTitle || '').slice(0, 160), creeLe: Date.now() });
    forgetDossierLookup(node);
    return true;
};
