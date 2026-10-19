// src/utils/contractCandidates.js
//
// Rôle facultatif « en attente de signature de contrat » : après l'acceptation d'une candidature, le
// recruteur peut le poser sur le compte Civil du candidat (contractCandidates/{uid}). Ce rôle donne
// accès à « Mes contrats » (lire, signer, consulter) et à la création de sa signature, SANS
// transformer le candidat en membre du personnel. Il n'est jamais posé automatiquement.
import { ref, get, set, remove } from 'firebase/database';
import { database } from '../firebase';

export async function loadContractCandidates() {
    const snap = await get(ref(database, 'contractCandidates'));
    return snap.exists() ? snap.val() : {};
}

export async function setContractCandidate(uid, { byUid, byName, applicationId = null, position = null }) {
    await set(ref(database, `contractCandidates/${uid}`), {
        setBy: byUid || null,
        setByName: byName || null,
        setAt: Date.now(),
        applicationId,
        position,
    });
}

export async function clearContractCandidate(uid) {
    await remove(ref(database, `contractCandidates/${uid}`));
}
