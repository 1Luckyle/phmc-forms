// src/utils/customRoles.js
//
// Rôles du personnel créés dans l'interface (fenêtre d'ajout d'un poste de recrutement) : un nom, une famille, un préfixe de badge. Ils s'ajoutent aux rôles
// d'origine de constants/ranks.js (registerCustomRoles) et se choisissent partout comme eux : fiche du personnel, contrat, grille salariale.
// Stockage : adminSettings/rolesPersonnalises/{clé}: { value, pole, badgePrefix, filiere, creeLe, creePar } (lecture publique, comme le reste de adminSettings ;
// création par un admin ou un recruteur ; modification et suppression : admins). Voir database.rules.json.
import { ref, get, set, onValue } from 'firebase/database';
import { database } from '../firebase';
import { registerCustomRoles, ROLES, STAFF_FAMILIES } from '../constants/ranks';

export const CUSTOM_ROLES_PATH = 'adminSettings/rolesPersonnalises';

// Filière proposée par défaut dans chaque famille (les filières servent à grouper les rôles dans les listes).
export const DEFAULT_FILIERE = {
    soignant: 'Autres professions de santé',
    administration: 'Administration',
    polyvalent: 'Personnel non soignant',
    dmec: 'Médecine légale',
};

const FORBIDDEN_CHARS = /[.#$[\]/]/;
const simplify = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Clé Firebase d'un rôle : son nom sans accent ni caractère interdit.
export const roleKeyOf = (value) => simplify(value).replace(/\s+/g, '_').slice(0, 60);

// Préfixe de badge conseillé pour un nom : initiales en majuscules (« Technicien de laboratoire » → « TL »), 1 à 4 lettres.
export const suggestBadgePrefix = (value) => {
    const words = simplify(value).split(' ').filter((word) => word.length > 2 || /^[a-z]$/.test(word));
    const initials = words.map((word) => word[0]).join('').toUpperCase().slice(0, 3);
    return initials || simplify(value).slice(0, 2).toUpperCase();
};

// → liste de messages d'erreur (vide si le rôle peut être créé).
export const validateNewRole = ({ value, pole, badgePrefix }) => {
    const errors = [];
    const name = String(value || '').trim();
    if (name.length < 2) errors.push('Donnez un nom au nouveau rôle (2 caractères au moins).');
    else if (name.length > 60) errors.push('Le nom du rôle est trop long (60 caractères au plus).');
    else if (FORBIDDEN_CHARS.test(name)) errors.push('Le nom du rôle ne peut pas contenir « . # $ [ ] / ».');
    else if (ROLES.some((role) => simplify(role.value) === simplify(name))) errors.push(`Le rôle « ${name} » existe déjà : choisissez-le dans la liste.`);
    if (!STAFF_FAMILIES[pole]) errors.push('Choisissez la famille du rôle.');
    if (!/^[A-Z]{1,4}$/.test(String(badgePrefix || ''))) errors.push('Le préfixe de badge doit comporter 1 à 4 lettres majuscules (ex. TL).');
    return errors;
};

let customEntries = {};   // { [clé]: entrée } telle qu'en base

const applyEntries = () => registerCustomRoles(Object.values(customEntries));

// À lancer une fois au démarrage : suit les rôles personnalisés de la base et les enregistre dans le référentiel au fil des changements.
export const startCustomRolesSync = () => onValue(
    ref(database, CUSTOM_ROLES_PATH),
    (snapshot) => { customEntries = snapshot.exists() ? snapshot.val() || {} : {}; applyEntries(); },
    (error) => console.warn('Rôles personnalisés illisibles :', error?.message || error),
);

// Crée un rôle et l'enregistre tout de suite dans le référentiel (sans attendre le retour de la base). Retourne le rôle créé.
export const createCustomRole = async ({ value, pole, badgePrefix, filiere }, byName = '') => {
    const clean = { value: String(value || '').trim(), pole, badgePrefix: String(badgePrefix || '').trim().toUpperCase() };
    const errors = validateNewRole(clean);
    if (errors.length) throw new Error(errors[0]);
    const key = roleKeyOf(clean.value);
    if (!key) throw new Error('Le nom du rôle est invalide.');
    const existing = await get(ref(database, `${CUSTOM_ROLES_PATH}/${key}`));
    if (existing.exists()) throw new Error(`Un rôle de clé « ${key} » existe déjà.`);
    const entry = {
        ...clean,
        filiere: String(filiere || '').trim().slice(0, 60) || DEFAULT_FILIERE[pole],
        creeLe: Date.now(),
        ...(byName ? { creePar: String(byName).slice(0, 120) } : {}),
    };
    await set(ref(database, `${CUSTOM_ROLES_PATH}/${key}`), entry);
    customEntries = { ...customEntries, [key]: entry };
    applyEntries();
    return entry;
};
