// src/utils/patientSignatures.js
//
// Signature d'un PATIENT, rattachée à son ID patient (signaturesPatients/{PHMC-id}) :
//   { url, deleteUrl, text, style, creeLe, creePar: { uid, nom }, source: 'ama' | 'civil' }
//
// Elle sert à signer les documents du patient (formulaire AMA…). Si le patient n'en a pas encore, elle est créée AUTOMATIQUEMENT
// à partir de son nom (police manuscrite) à la première signature, et rangée à son ID. S'il a un compte Civil, il l'HÉRITE : elle
// devient sa signature (userCreations) ; et s'il en crée une depuis son compte, elle remplace celle du patient. Une seule par ID.
import { ref, get, set, remove } from 'firebase/database';
import { database, auth } from '../firebase';
import { canonicalPatientId } from './patientId';
import { renderSignatureDataUrl, SIGNATURE_STYLES } from './signatureRenderer';

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

export const loadPatientSignature = async (patientID) => {
    const id = canonicalPatientId(patientID);
    if (!id) return null;
    const snap = await get(ref(database, `signaturesPatients/${id}`));
    return snap.exists() ? snap.val() : null;
};

export const savePatientSignature = async (patientID, { url, deleteUrl, text, style, source }, actorName = '') => {
    const id = canonicalPatientId(patientID);
    if (!id || !url) throw new Error('ID patient ou image de signature manquant.');
    const record = {
        url, deleteUrl: deleteUrl || '', text: clean(text, 120), style: style || SIGNATURE_STYLES[0].key,
        creeLe: Date.now(), creePar: { uid: auth.currentUser?.uid || null, nom: clean(actorName, 120) }, source: source || 'ama',
    };
    await set(ref(database, `signaturesPatients/${id}`), record);
    return record;
};

export const removePatientSignature = async (patientID) => {
    const id = canonicalPatientId(patientID);
    if (id) await remove(ref(database, `signaturesPatients/${id}`));
};

// Signature du patient prête à imprimer : celle qui existe, sinon une nouvelle, créée à partir de son nom et enregistrée à son ID.
// `uploadImageDetailed(dataUrl)` → { url, deleteUrl }. Retourne { signature, created }.
export const ensurePatientSignature = async ({ patientID, patientName, uploadImageDetailed, actorName }) => {
    const existing = await loadPatientSignature(patientID);
    if (existing?.url) return { signature: existing, created: false };
    const text = clean(patientName, 120);
    if (!text) throw new Error('Le nom du patient est nécessaire pour créer sa signature.');
    const style = SIGNATURE_STYLES[0].key;
    const dataUrl = await renderSignatureDataUrl(text, style);
    const uploaded = await uploadImageDetailed(dataUrl);
    const signature = await savePatientSignature(patientID, { url: uploaded.url, deleteUrl: uploaded.deleteUrl, text, style, source: 'ama' }, actorName);
    return { signature, created: true };
};
