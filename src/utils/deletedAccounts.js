// src/utils/deletedAccounts.js
//
// Suppression d'un compte = on retire les INFORMATIONS PERSONNELLES (fiche, profil, connexion, droits, créations) mais on
// CONSERVE les archives liées à l'ID patient : rapports rédigés, dossier patient, factures, candidatures, contrats.
// Un marqueur comptesSupprimes/{ID patient} signale au personnel que cette personne « n'est plus liée à un compte actif »
// (ancien membre du personnel, ou compte supprimé). Il disparaît quand le compte est recréé : la personne retrouve alors ses
// archives (les rapports par son ID, candidatures et contrats via la fonction serveur adoptArchivedRecords).
import { ref, get, set, remove } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from './patientId';

const NODE = 'comptesSupprimes';

// ID patient d'une fiche du personnel : celui de son profil Civil, sinon PHMC-{personnage GTA World}, sinon PHMC-{chiffres du badge}.
// (Même règle que « myPatientID » dans EmployeeAuthContext.)
export const staffPatientIdOf = (member, civilPatientId = '') => {
    if (civilPatientId) return canonicalPatientId(civilPatientId);
    if (member?.gtawCharacterId != null) return canonicalPatientId(`PHMC-${member.gtawCharacterId}`);
    const badge = String(member?.badge || '');
    const digits = badge.includes('-') ? badge.split('-').slice(1).join('') : badge.replace(/\D/g, '');
    return digits ? canonicalPatientId(`PHMC-${digits}`) : '';
};

// type : 'personnel' | 'civil'
export const markAccountDeleted = async (patientID, { type, nom, role = '' }) => {
    const node = canonicalPatientId(patientID);
    if (!node) return;
    await set(ref(database, `${NODE}/${node}`), { type, nom: String(nom || '').slice(0, 120), role: String(role || '').slice(0, 80), supprimeLe: Date.now() });
};

// Compte recréé : la personne n'est plus « sans compte ».
export const clearDeletedMark = async (patientID) => {
    const node = canonicalPatientId(patientID);
    if (!node) return;
    try { await remove(ref(database, `${NODE}/${node}`)); } catch (error) { /* marqueur absent ou règle refusée : sans conséquence */ }
};

export const loadDeletedMark = async (patientID) => {
    const node = canonicalPatientId(patientID);
    if (!node) return null;
    try {
        const snapshot = await get(ref(database, `${NODE}/${node}`));
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        return null;
    }
};
