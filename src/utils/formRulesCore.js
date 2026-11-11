// src/utils/formRulesCore.js
//
// Champs OBLIGATOIRES de chaque formulaire, en un seul endroit (module sans Firebase ni React). Trois couches :
//   1. DEFAULT_REQUIRED : le minimum prévu par le code (valeurs par défaut) ;
//   2. LOCKED_FIELDS    : champs qu'on ne peut pas rendre facultatifs, car le titre du rapport (utils/reportTitle.js) ou la facturation en dépendent ;
//   3. les réglages du back-office (Admin → Champs obligatoires, enregistrés dans adminSettings/champsObligatoires/{version}/{champ}: true | false),
//      qui rendent un champ obligatoire (true) ou facultatif (false) par-dessus les valeurs par défaut.
// Le moteur d'infobulles (components/FieldGuide.js), la validation (utils/formValidation.js) et la page d'administration lisent tous ce module.

import { VERSION_FIELDS } from '../constants/formFieldCatalog';

// Minimum prévu par le code. Les règles qui ne se résument pas à « rempli / vide » sont dans SPECIAL_RULES.
export const DEFAULT_REQUIRED = {
    1: ['decedentOOC', 'dateTime'],
    2: ['coronerEmployee', 'requestingOfficer'],
    3: ['patientFirstName', 'patientLastName', 'patientDateOfBirth', 'patientEmail', 'patientID', 'patientWeight', 'patientHeight'],
    4: ['decedentFirstName', 'decedentLastName', 'decedentOOC', 'autopsyDate'],
    5: ['patientName', 'patientID', 'date', 'phmcEmployee', 'surgeonEmployee'],
    6: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    7: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    8: ['decedentFirstName', 'decedentLastName', 'date'],
    11: ['dateTime'],
    14: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    16: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    19: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    20: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    21: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    22: ['patientName', 'date'],
    23: ['patientName', 'date'],
    24: ['patientEmail', 'patientID'],
    25: ['patientFirstName', 'patientLastName', 'patientDateOfBirth', 'patientEmail', 'patientID', 'patientWeight', 'patientHeight'],
    26: ['patientFirstName', 'patientLastName', 'date', 'patientEmail', 'patientID'],
    27: ['internalEmailSubject', 'internalEmailRecipient'],
    28: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    29: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    35: ['patientName', 'patientID', 'phmcEmployee'],
    41: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    42: ['externalMailSubject', 'externalMailRecipient', 'externalMailBody'],
    37: ['caseNumber', 'decedentFirstName', 'decedentLastName', 'decedentOOC', 'dateOfDeath'],
    // Candidatures : socle commun à tous les envois (le reste dépend du poste et du profil, voir validateApplication).
    50: ['applicantTitleAndFullName', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone'],
    51: ['applicantTitleAndFullName', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone'],
    52: ['applicantTitleAndFullName', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone'],
    53: ['applicantTitleAndFullName', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone'],
    54: ['applicantTitleAndFullName', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone'],
    55: ['applicantTitleAndFullName', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone'],
};

// Champs qu'on ne peut pas rendre facultatifs : raison 'title' (ils composent le titre du rapport, sans eux il serait introuvable) ou 'billing'
// (ID patient et e-mail : facturation des dossiers médicaux Civils).
const TITLE = 'title';
const BILLING = 'billing';
export const LOCKED_FIELDS = {
    1: { decedentOOC: TITLE, dateTime: TITLE },
    3: { patientFirstName: TITLE, patientLastName: TITLE, patientDateOfBirth: TITLE, patientID: BILLING, patientEmail: BILLING },
    4: { decedentFirstName: TITLE, decedentLastName: TITLE, decedentOOC: TITLE, autopsyDate: TITLE },
    5: { patientName: TITLE, date: TITLE },
    6: { patientName: TITLE, date: TITLE },
    7: { patientName: TITLE, date: TITLE },
    8: { decedentFirstName: TITLE, decedentLastName: TITLE, date: TITLE },
    11: { dateTime: TITLE },
    14: { patientName: TITLE, date: TITLE },
    16: { patientName: TITLE, date: TITLE },
    19: { patientName: TITLE, date: TITLE },
    20: { patientName: TITLE, date: TITLE },
    21: { patientName: TITLE, date: TITLE },
    22: { patientName: TITLE, date: TITLE },
    23: { patientName: TITLE, date: TITLE },
    24: { patientID: BILLING, patientEmail: BILLING },
    25: { patientFirstName: TITLE, patientLastName: TITLE, patientDateOfBirth: TITLE, patientID: BILLING, patientEmail: BILLING },
    26: { patientFirstName: TITLE, patientLastName: TITLE, date: TITLE, patientID: BILLING, patientEmail: BILLING },
    27: { internalEmailSubject: TITLE },
    28: { patientName: TITLE, date: TITLE },
    29: { patientName: TITLE, date: TITLE },
    35: { patientName: TITLE },
    41: { patientName: TITLE, date: TITLE },
    42: { externalMailSubject: TITLE },
    37: { decedentFirstName: TITLE, decedentLastName: TITLE, decedentOOC: TITLE, dateOfDeath: TITLE },
    50: { applicantTitleAndFullName: TITLE },
    51: { applicantTitleAndFullName: TITLE },
    52: { applicantTitleAndFullName: TITLE },
    53: { applicantTitleAndFullName: TITLE },
    54: { applicantTitleAndFullName: TITLE },
    55: { applicantTitleAndFullName: TITLE },
};

export const LOCK_REASONS = {
    [TITLE]: 'Ce champ compose le titre du rapport : il reste obligatoire.',
    [BILLING]: 'Ce champ sert à la facturation du dossier : il reste obligatoire.',
};

// Règles propres au code, qui ne se règlent pas champ par champ (affichées en lecture seule dans la page d'administration).
export const SPECIAL_RULES = {
    2: ["Nom IC ou OOC du défunt : au moins un des deux."],
    3: ["Titre « Mineur » : seulement si la date de naissance indique moins de 18 ans."],
    11: ["Au moins un défunt, et le premier doit avoir un nom."],
    24: [
        "Prénom ou nom du patient : au moins un des deux.",
        "Au moins un élément du dossier médical à divulguer.",
        "Patient mineur non émancipé : nom et lien du représentant légal.",
    ],
    25: ["Titre « Mineur » : seulement si la date de naissance indique moins de 18 ans."],
    26: ["Au moins un élément du dossier médical à mettre à jour."],
    35: ["Date de la visite (date ou date de consultation) : au moins une des deux."],
    41: ["Classe, catégorie(s) de vol, résultat de chaque examen de la classe et conclusion cohérente avec les examens."],
};
const FOR_ALL_REPORTS = [
    "Les dates ne peuvent pas être dans le futur ni antérieures à 1900.",
    "Un compte Civil ne peut enregistrer un dossier médical que sous son propre ID patient.",
];
export const specialRulesOf = (version) => [...(SPECIAL_RULES[Number(version)] || []), ...(Number(version) < 50 ? FOR_ALL_REPORTS : [])];

// ───────────────────────────── Réglages du back-office ─────────────────────────────

let overrides = {};
const listeners = new Set();

// Ne garde que des booléens sous { version: { champ: boolean } }.
export const sanitizeOverrides = (value) => {
    const result = {};
    Object.entries(value || {}).forEach(([version, fields]) => {
        if (!fields || typeof fields !== 'object') return;
        Object.entries(fields).forEach(([field, state]) => {
            if (typeof state === 'boolean') { result[version] = result[version] || {}; result[version][field] = state; }
        });
    });
    return result;
};
export const setFormOverrides = (value) => { overrides = sanitizeOverrides(value); listeners.forEach((listener) => listener()); };
export const getFormOverrides = () => overrides;
export const subscribeFormOverrides = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

export const lockedReasonOf = (version, field) => LOCKED_FIELDS[Number(version)]?.[field] || null;
export const isDefaultRequired = (version, field) => (DEFAULT_REQUIRED[Number(version)] || []).includes(field);

// Un champ est-il obligatoire ? (verrou > réglage du back-office > valeur par défaut). `values` : réglages à utiliser (défaut : ceux en vigueur).
export const isFieldRequired = (version, field, values = overrides) => {
    if (lockedReasonOf(version, field)) return true;
    const setting = values?.[Number(version)]?.[field];
    return typeof setting === 'boolean' ? setting : isDefaultRequired(version, field);
};

// Champs d'un formulaire sans doublon : ceux de la page, puis les champs par défaut absents du catalogue (ex. date par défaut).
export const fieldKeysOf = (version) => {
    const keys = Object.keys(VERSION_FIELDS[Number(version)] || {});
    (DEFAULT_REQUIRED[Number(version)] || []).forEach((key) => { if (!keys.includes(key)) keys.push(key); });
    return keys;
};

// Champs obligatoires en vigueur (défaut + réglages − champs rendus facultatifs).
export const requiredFieldsOf = (version, values = overrides) => fieldKeysOf(version).filter((field) => isFieldRequired(version, field, values));

// Une candidature : le champ a-t-il été rendu facultatif par le back-office ? (jamais pour un champ verrouillé)
export const isRelaxed = (version, field) => !lockedReasonOf(version, field) && overrides?.[Number(version)]?.[field] === false;
