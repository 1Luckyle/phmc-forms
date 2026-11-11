// src/utils/emergencyContactUpdates.js
//
// Mises à jour du DOSSIER PATIENT demandées depuis un formulaire de soins :
//  • contact d'urgence modifié (santé mentale : psychiatrie, évaluation psychologique) → remplace les valeurs du contact ;
//  • allergies, antécédents ou traitements en cours oubliés (opération, psychiatrie, urgences, consultation générale) → AJOUTÉS au dossier, jamais retirés ni corrigés.
// Le dossier n'est JAMAIS écrit par un client : l'enregistrement du rapport pose une demande (contactsUrgenceMaj/{ID patient}/{clé}) que la fonction serveur reconcileDossiers applique (sous une minute) puis supprime.
import { ref, push, set } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from './patientId';
import { lookupDossier, forgetDossierLookup } from './dossierLookup';
import { emergencyContactChanges, backgroundAdditions } from './careFormRules';
import { MENTAL_HEALTH_VERSIONS, BACKGROUND_UPDATE_VERSIONS } from '../constants/careFormOptions';

export const hasDossierUpdateRules = (version) => MENTAL_HEALTH_VERSIONS.includes(Number(version)) || BACKGROUND_UPDATE_VERSIONS.includes(Number(version));

/**
 * Pose la demande de mise à jour du dossier. Rien si le patient n'a pas de dossier, ou s'il n'y a rien à changer.
 * `formData.patientBackgroundSync === 'No'` : le soignant a décoché l'ajout au dossier du fond médical.
 * → { contact: boolean, additions: [champs] } (contact false et additions vide : rien posé)
 */
export const queueDossierUpdate = async ({ patientID, formData, authorName, reportTitle, version }) => {
    const none = { contact: false, additions: [] };
    const node = canonicalPatientId(patientID);
    if (!node) return none;
    forgetDossierLookup(node); // lecture fraîche : le dossier a pu changer depuis le début de la saisie
    const { status, donnees } = await lookupDossier(node);
    if (status !== 'found') return none;
    const request = {};
    if (MENTAL_HEALTH_VERSIONS.includes(Number(version))) {
        const changes = emergencyContactChanges(donnees, formData);
        if (Object.keys(changes).length) request.champs = changes;
    }
    if (BACKGROUND_UPDATE_VERSIONS.includes(Number(version)) && formData.patientBackgroundSync !== 'No') {
        const additions = backgroundAdditions(donnees, formData);
        if (Object.keys(additions).length) request.ajouts = additions;
    }
    if (!request.champs && !request.ajouts) return none;
    await set(push(ref(database, `contactsUrgenceMaj/${node}`)), { ...request, par: String(authorName || '').slice(0, 120), titre: String(reportTitle || '').slice(0, 160), creeLe: Date.now() });
    forgetDossierLookup(node);
    return { contact: !!request.champs, additions: Object.keys(request.ajouts || {}) };
};
