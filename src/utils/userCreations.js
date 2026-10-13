// src/utils/userCreations.js
//
// « Mes créations » : chaque employé / recruteur / admin possède AU PLUS UNE carte de visite et
// UNE signature. Elles sont mémorisées dans Firebase (userCreations/{uid}/businessCard|signature)
// avec le lien ImgBB et le lien de suppression ImgBB (`deleteUrl`).
//
// ImgBB n'a pas d'API de suppression : « supprimer » = retirer l'association côté application,
// puis mettre le lien `deleteUrl` dans la file « imgbbDeleteQueue » : un administrateur le supprime
// depuis le panneau admin (Images à supprimer) et l'entrée disparaît de la file.
import { ref, get, set, remove, push } from 'firebase/database';
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

// Ajoute le lien de suppression ImgBB d'une ancienne image à la file consultée par les admins.
// Best-effort : un échec ici ne doit jamais bloquer la création / suppression de l'utilisateur.
const queueImgbbDeletion = async (uid, kind, creation) => {
    if (!creation || !creation.deleteUrl) return;
    try {
        await push(ref(database, 'imgbbDeleteQueue'), {
            deleteUrl: creation.deleteUrl,
            imageUrl: creation.url || '',
            kind,
            ownerUid: uid,
            ownerLabel: creation.name || creation.text || '',
            queuedAt: Date.now(),
        });
    } catch (error) {
        console.error('Impossible de mettre le lien de suppression ImgBB en file :', error);
    }
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
    await queueImgbbDeletion(uid, kind, previous);
    if (kind === CREATION_KINDS.signature) setCachedSignatureUrl(record.url);
    return { saved: record, previous };
};

export const removeUserCreation = async (uid, kind) => {
    const previous = (await get(ref(database, `userCreations/${uid}/${kind}`))).val() || null;
    await remove(ref(database, `userCreations/${uid}/${kind}`));
    await queueImgbbDeletion(uid, kind, previous);
    if (kind === CREATION_KINDS.signature) setCachedSignatureUrl('');
};
