// src/utils/recruitmentStore.js
//
// Accès aux POSTES de recrutement et aux CANDIDATURES, avec compatibilité entre l'ancien schéma (nœuds et
// champs anglais) et le nouveau (français), tant que la migration n'a pas été faite — voir
// constants/recruitment.js pour la correspondance.
//
//   Postes        : selectOptions/postesMedecine… (nouveau) ou selectOptions/physicianRecruitmentDetails… (ancien).
//                   Par catégorie : dès que le nœud français contient des postes, c'est lui qui fait foi.
//   Candidatures  : candidatures/{uid}/{id} (nouveau) fusionné avec jobApplications/{uid}/{id} (ancien) ;
//                   à égalité, le nouveau l'emporte. Toute écriture va dans le nouveau nœud et retire l'ancien.
import { ref, get, set, update, remove } from 'firebase/database';
import { database } from '../firebase';
import {
    normalizePosition, toLegacyPosition, toStoredPosition,
    STATUT_FERME, STATUT_OUVERT, normalizeApplication, toStoredApplication,
    positionsFromSelectOptions, getCategoryPositions,
} from '../constants/recruitment';

// ───────────────────────────── Postes ─────────────────────────────

const hasEntries = (value) => !!value && typeof value === 'object' && Object.keys(value).length > 0;

// Lecture depuis l'objet selectOptions déjà chargé : voir constants/recruitment.js.
export { positionsFromSelectOptions, getCategoryPositions };

// Nœud actif d'une catégorie : « nouveau » (français) s'il contient des postes, sinon « ancien ».
export const getActiveStore = async (category) => {
    const snap = await get(ref(database, `selectOptions/${category.node}`));
    return snap.exists() && hasEntries(snap.val()) ? 'nouveau' : 'ancien';
};

export const positionsPath = (category, store) => `selectOptions/${store === 'nouveau' ? category.node : category.legacyNode}`;

// Charge les postes d'une catégorie (panneau de gestion) : { store, positions }.
export const loadPositions = async (category) => {
    const store = await getActiveStore(category);
    const snap = await get(ref(database, positionsPath(category, store)));
    const raw = snap.exists() ? snap.val() : {};
    return {
        store,
        positions: Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, normalizePosition(value, category.key, key)])),
    };
};

// Enregistre (crée ou remplace) un poste dans le nœud actif, au format de ce nœud.
export const savePosition = async (category, key, position, store) => {
    const activeStore = store || await getActiveStore(category);
    const path = `${positionsPath(category, activeStore)}/${key}`;
    await set(ref(database, path), activeStore === 'nouveau'
        ? toStoredPosition({ ...position, groupe: category.key })
        : toLegacyPosition(position, category.legacyGroup));
};

// Ouvre / ferme un poste.
export const setPositionOpen = async (category, key, open, store) => {
    const activeStore = store || await getActiveStore(category);
    const path = `${positionsPath(category, activeStore)}/${key}`;
    if (activeStore === 'nouveau') await update(ref(database, path), { statut: open ? STATUT_OUVERT : STATUT_FERME });
    else await update(ref(database, path), { status: open ? 'OPEN' : 'CLOSED' });
};

// ───────────────────────────── Candidatures ─────────────────────────────
const NEW_NODE = 'candidatures';
const OLD_NODE = 'jobApplications';

const flatten = (tree, source) => {
    const items = [];
    Object.entries(tree || {}).forEach(([uid, apps]) => {
        Object.entries(apps || {}).forEach(([id, raw]) => items.push({ key: `${uid}/${id}`, source, application: normalizeApplication(raw, id, uid) }));
    });
    return items;
};

// Toutes les candidatures (panneau recrutement), anciennes et nouvelles fusionnées, plus récentes d'abord.
export const loadAllApplications = async () => {
    const [newSnap, oldSnap] = await Promise.all([get(ref(database, NEW_NODE)), get(ref(database, OLD_NODE)).catch(() => null)]);
    const merged = new Map();
    flatten(oldSnap && oldSnap.exists() ? oldSnap.val() : {}, 'ancien').forEach((item) => merged.set(item.key, item));
    flatten(newSnap.exists() ? newSnap.val() : {}, 'nouveau').forEach((item) => merged.set(item.key, item));
    return [...merged.values()].map((item) => item.application).sort((a, b) => (b.modifieLe || 0) - (a.modifieLe || 0));
};

// Candidatures d'un candidat (« Mes candidatures »).
export const loadApplicationsOf = async (uid) => {
    const [newSnap, oldSnap] = await Promise.all([get(ref(database, `${NEW_NODE}/${uid}`)), get(ref(database, `${OLD_NODE}/${uid}`)).catch(() => null)]);
    const merged = new Map();
    if (oldSnap && oldSnap.exists()) Object.entries(oldSnap.val()).forEach(([id, raw]) => merged.set(id, normalizeApplication(raw, id, uid)));
    if (newSnap.exists()) Object.entries(newSnap.val()).forEach(([id, raw]) => merged.set(id, normalizeApplication(raw, id, uid)));
    return [...merged.values()].sort((a, b) => (b.modifieLe || 0) - (a.modifieLe || 0));
};

export const loadApplication = async (uid, id) => {
    const newSnap = await get(ref(database, `${NEW_NODE}/${uid}/${id}`));
    if (newSnap.exists()) return normalizeApplication(newSnap.val(), id, uid);
    const oldSnap = await get(ref(database, `${OLD_NODE}/${uid}/${id}`)).catch(() => null);
    return oldSnap && oldSnap.exists() ? normalizeApplication(oldSnap.val(), id, uid) : null;
};

// Écrit une candidature dans le nœud français (champs français) et retire son éventuelle copie ancienne.
export const saveApplication = async (uid, id, application) => {
    await set(ref(database, `${NEW_NODE}/${uid}/${id}`), toStoredApplication(application));
    try { await remove(ref(database, `${OLD_NODE}/${uid}/${id}`)); } catch (error) { /* ancien nœud absent ou non modifiable : sans conséquence */ }
};

export const removeApplication = async (uid, id) => {
    await remove(ref(database, `${NEW_NODE}/${uid}/${id}`));
    try { await remove(ref(database, `${OLD_NODE}/${uid}/${id}`)); } catch (error) { /* idem */ }
};
