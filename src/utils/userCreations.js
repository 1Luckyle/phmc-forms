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
import { loadPatientSignature, savePatientSignature, removePatientSignature } from './patientSignatures';

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

// Drapeaux publics (booléens seulement) : permettent à l'annuaire d'indiquer qui a une signature / une carte de visite.
const syncCreationFlags = async (uid, creations) => {
    try {
        await set(ref(database, `creationsFlags/${uid}`), { signature: !!creations.signature, carte: !!creations.businessCard });
    } catch (error) { /* sans conséquence : seulement l'affichage de l'annuaire */ }
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

// `patientID` (compte Civil) : sans signature à lui, la personne HÉRITE de celle de son ID patient (créée par exemple lors d'un
// formulaire AMA) : elle devient sa signature.
export const loadUserCreations = async (uid, { patientID } = {}) => {
    if (!uid) return { businessCard: null, signature: null };
    const snap = await get(ref(database, `userCreations/${uid}`));
    const value = snap.exists() ? snap.val() : {};
    const creations = { businessCard: value.businessCard || null, signature: value.signature || null };
    if (!creations.signature && patientID) {
        try {
            const inherited = await loadPatientSignature(patientID);
            if (inherited?.url) {
                creations.signature = { url: inherited.url, deleteUrl: inherited.deleteUrl || '', text: inherited.text || '', style: inherited.style, createdAt: inherited.creeLe || Date.now(), inheritedFromPatient: true };
                await set(ref(database, `userCreations/${uid}/signature`), creations.signature);
            }
        } catch (error) { console.warn('Signature du patient non reprise :', error?.message || error); }
    }
    setCachedSignatureUrl(creations.signature?.url || '');
    await syncCreationFlags(uid, creations);
    return creations;
};

// Enregistre (ou remplace) la création de ce type. Retourne l'ancienne (pour proposer sa suppression).
export const saveUserCreation = async (uid, kind, data, { patientID, actorName } = {}) => {
    const previous = (await get(ref(database, `userCreations/${uid}/${kind}`))).val() || null;
    const record = { ...data, createdAt: Date.now() };
    await set(ref(database, `userCreations/${uid}/${kind}`), record);
    await queueImgbbDeletion(uid, kind, previous);
    await syncCreationFlags(uid, { ...(await loadFlagsBase(uid)), [kind]: record });
    if (kind === CREATION_KINDS.signature) {
        setCachedSignatureUrl(record.url);
        // Compte Civil : la signature est aussi celle de son ID patient (les formulaires AMA signent avec).
        if (patientID) await savePatientSignature(patientID, { url: record.url, deleteUrl: record.deleteUrl, text: record.text, style: record.style, source: 'civil' }, actorName).catch((error) => console.warn('Signature du patient non synchronisée :', error?.message || error));
    }
    return { saved: record, previous };
};

// État courant des deux créations (pour recalculer les drapeaux après une écriture).
const loadFlagsBase = async (uid) => {
    const value = (await get(ref(database, `userCreations/${uid}`))).val() || {};
    return { businessCard: value.businessCard || null, signature: value.signature || null };
};

export const removeUserCreation = async (uid, kind, { patientID } = {}) => {
    const previous = (await get(ref(database, `userCreations/${uid}/${kind}`))).val() || null;
    await remove(ref(database, `userCreations/${uid}/${kind}`));
    await syncCreationFlags(uid, { ...(await loadFlagsBase(uid)), [kind]: null });
    await queueImgbbDeletion(uid, kind, previous);
    if (kind === CREATION_KINDS.signature) {
        setCachedSignatureUrl('');
        if (patientID) await removePatientSignature(patientID).catch(() => {});
    }
};
