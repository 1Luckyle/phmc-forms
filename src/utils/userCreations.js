// src/utils/userCreations.js
//
// « Mes créations » : chaque employé / recruteur / admin possède AU PLUS UNE carte de visite et
// UNE signature. Elles sont mémorisées dans Firebase (userCreations/{uid}/businessCard|signature)
// avec le lien ImgBB et le lien de suppression ImgBB (`deleteUrl`).
//
// ImgBB n'a pas d'API de suppression : « supprimer » = retirer l'association côté application,
// puis ouvrir la page `deleteUrl` d'ImgBB où l'utilisateur confirme la suppression de l'image.
import { ref, get, set, remove } from 'firebase/database';
import { database } from '../firebase';

export const CREATION_KINDS = { card: 'businessCard', signature: 'signature' };

const SIGNATURE_CACHE_KEY = 'mySignatureUrl';

// Copie locale du lien de la signature : permet aux formulaires de la proposer sans requête.
export const getCachedSignatureUrl = () => {
    try { return localStorage.getItem(SIGNATURE_CACHE_KEY) || ''; } catch (e) { return ''; }
};
const setCachedSignatureUrl = (url) => {
    try {
        if (url) localStorage.setItem(SIGNATURE_CACHE_KEY, url);
        else localStorage.removeItem(SIGNATURE_CACHE_KEY);
    } catch (e) { /* stockage indisponible : sans conséquence */ }
};

export const loadUserCreations = async (uid) => {
    if (!uid) return { businessCard: null, signature: null };
    const snap = await get(ref(database, `userCreations/${uid}`));
    const value = snap.exists() ? snap.val() : {};
    const creations = { businessCard: value.businessCard || null, signature: value.signature || null };
    setCachedSignatureUrl(creations.signature?.url || '');
    return creations;
};

// Enregistre (ou remplace) la création de ce type. Retourne l'ancienne (pour proposer sa suppression).
export const saveUserCreation = async (uid, kind, data) => {
    const previous = (await get(ref(database, `userCreations/${uid}/${kind}`))).val() || null;
    const record = { ...data, createdAt: Date.now() };
    await set(ref(database, `userCreations/${uid}/${kind}`), record);
    if (kind === CREATION_KINDS.signature) setCachedSignatureUrl(record.url);
    return { saved: record, previous };
};

export const removeUserCreation = async (uid, kind) => {
    await remove(ref(database, `userCreations/${uid}/${kind}`));
    if (kind === CREATION_KINDS.signature) setCachedSignatureUrl('');
};

// Ouvre la page de suppression ImgBB (l'utilisateur y confirme). Retourne false si bloqué/absent.
export const openImgbbDeletePage = (deleteUrl) => {
    if (!deleteUrl) return false;
    const opened = window.open(deleteUrl, '_blank', 'noopener,noreferrer');
    return !!opened;
};
