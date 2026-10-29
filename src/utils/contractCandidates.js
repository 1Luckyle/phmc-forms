// src/utils/contractCandidates.js
//
// Rôle facultatif « en attente de signature de contrat » : après l'acceptation d'une candidature, le
// recruteur peut le poser sur le compte Civil du candidat (candidatsContrat/{uid}). Ce rôle donne
// accès à « Mes contrats » (lire, signer, consulter), SANS
// transformer le candidat en membre du personnel. Il n'est jamais posé automatiquement.
//
// Enregistrement (français) : { definiPar, definiParNom, definiLe, candidatureId, poste, role }.
// L'ancien nœud contractCandidates (champs anglais) reste lu tant qu'il n'a pas été migré.
import { ref, get, set, remove } from 'firebase/database';
import { database } from '../firebase';
import { normalizeRank } from '../constants/ranks';

const NEW_NODE = 'candidatsContrat';
const OLD_NODE = 'contractCandidates';

export const normalizeContractCandidate = (raw) => {
    const source = raw || {};
    return {
        definiPar: source.definiPar ?? source.setBy ?? null,
        definiParNom: source.definiParNom ?? source.setByName ?? null,
        definiLe: source.definiLe ?? source.setAt ?? null,
        candidatureId: source.candidatureId ?? source.applicationId ?? null,
        poste: source.poste ?? source.position ?? null,
        role: source.role ? normalizeRank(source.role) : null,
    };
};

// { [uid]: candidat normalisé } — nouveau et ancien nœud fusionnés (le nouveau l'emporte).
export async function loadContractCandidates() {
    const [newSnap, oldSnap] = await Promise.all([get(ref(database, NEW_NODE)), get(ref(database, OLD_NODE)).catch(() => null)]);
    const merged = {};
    if (oldSnap && oldSnap.exists()) Object.entries(oldSnap.val()).forEach(([uid, raw]) => { merged[uid] = normalizeContractCandidate(raw); });
    if (newSnap.exists()) Object.entries(newSnap.val()).forEach(([uid, raw]) => { merged[uid] = normalizeContractCandidate(raw); });
    return merged;
}

export async function setContractCandidate(uid, { byUid, byName, applicationId = null, position = null, role = null }) {
    await set(ref(database, `${NEW_NODE}/${uid}`), {
        definiPar: byUid || null,
        definiParNom: byName || null,
        definiLe: Date.now(),
        candidatureId: applicationId,
        poste: position,
        // Rôle du personnel relié au poste (référentiel ranks.js), pour pré-remplir contrat et fiche.
        role,
    });
}

export async function clearContractCandidate(uid) {
    await remove(ref(database, `${NEW_NODE}/${uid}`));
    try { await remove(ref(database, `${OLD_NODE}/${uid}`)); } catch (error) { /* ancien nœud absent ou non modifiable */ }
}
