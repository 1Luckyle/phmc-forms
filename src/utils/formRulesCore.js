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
    // DMEC : l'ID patient (réel ou temporaire TMP-…) identifie le défunt et compose le titre du rapport ; le Discord du défunt reste demandé mais ne compose plus le titre.
    1: ['patientID', 'decedentOOC', 'dateTime'],
    2: ['coronerEmployee', 'requestingOfficer', 'patientID'],
    3: ['patientFirstName', 'patientLastName', 'patientDateOfBirth', 'patientEmail', 'patientID', 'patientWeight', 'patientHeight'],
    4: ['patientID', 'decedentFirstName', 'decedentLastName', 'decedentOOC', 'autopsyDate'],
    5: ['patientName', 'patientID', 'date', 'phmcEmployee', 'surgeonEmployee'],
    6: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    7: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    8: ['patientID', 'decedentFirstName', 'decedentLastName', 'date'],
    11: ['decedentPatientIDs', 'dateTime'],
    14: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    16: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    19: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    20: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    21: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    22: ['patientName', 'date'],
    23: ['patientName', 'date'],
    // Représentant légal : obligatoire seulement quand il est demandé (patient de moins de 18 ans non émancipé, voir utils/fieldApplicability.js).
    24: ['patientEmail', 'patientID', 'guardianName', 'guardianRelation'],
    25: ['patientFirstName', 'patientLastName', 'patientDateOfBirth', 'patientEmail', 'patientID', 'patientWeight', 'patientHeight'],
    26: ['patientFirstName', 'patientLastName', 'date', 'patientEmail', 'patientID'],
    27: ['internalEmailSubject', 'internalEmailRecipient'],
    28: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    29: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    35: ['patientName', 'patientID', 'phmcEmployee'],
    41: ['patientName', 'patientID', 'date', 'phmcEmployee'],
    42: ['externalMailSubject', 'externalMailRecipient', 'externalMailBody'],
    37: ['deathRecordType', 'caseNumber', 'patientID', 'decedentFirstName', 'decedentLastName', 'decedentOOC', 'dateOfDeath'],
    // Candidatures : socle commun à tous les envois (le reste dépend du poste et du profil, voir validateApplication).
    50: ['patientID', 'applicantTitle', 'applicantFirstName', 'applicantLastName', 'applicantDOB', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocDiscord', 'oocTimezone'],
    51: ['patientID', 'applicantTitle', 'applicantFirstName', 'applicantLastName', 'applicantDOB', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocDiscord', 'oocTimezone'],
    52: ['patientID', 'applicantTitle', 'applicantFirstName', 'applicantLastName', 'applicantDOB', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocDiscord', 'oocTimezone'],
    53: ['patientID', 'applicantTitle', 'applicantFirstName', 'applicantLastName', 'applicantDOB', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocDiscord', 'oocTimezone'],
    54: ['patientID', 'applicantTitle', 'applicantFirstName', 'applicantLastName', 'applicantDOB', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocDiscord', 'oocTimezone'],
    55: ['patientID', 'applicantTitle', 'applicantFirstName', 'applicantLastName', 'applicantDOB', 'applicantAddress', 'applicantPhone', 'applicantEmail', 'oocDiscord', 'oocTimezone'],
};

// Champs qu'on ne peut pas rendre facultatifs : raison 'title' (ils composent le titre du rapport, sans eux il serait introuvable) ou 'billing'
// (ID patient et e-mail : facturation des dossiers médicaux Civils).
const TITLE = 'title';
const BILLING = 'billing';
// Raison 'rule' : règle propre au formulaire (le champ reste obligatoire dès qu'il s'affiche, mais pas quand il n'apparaît pas : voir utils/fieldApplicability.js).
const RULE = 'rule';
export const LOCKED_FIELDS = {
    1: { patientID: TITLE, dateTime: TITLE },
    2: { patientID: TITLE },
    3: { patientFirstName: TITLE, patientLastName: TITLE, patientDateOfBirth: TITLE, patientID: BILLING, patientEmail: BILLING },
    4: { patientID: TITLE, autopsyDate: TITLE },
    5: { patientName: TITLE, date: TITLE },
    6: { patientName: TITLE, date: TITLE },
    7: { patientName: TITLE, date: TITLE },
    8: { patientID: TITLE, date: TITLE },
    11: { decedentPatientIDs: TITLE, dateTime: TITLE },
    14: { patientName: TITLE, date: TITLE },
    16: { patientName: TITLE, date: TITLE },
    19: { patientName: TITLE, date: TITLE },
    20: { patientName: TITLE, date: TITLE },
    21: { patientName: TITLE, date: TITLE },
    22: { patientName: TITLE, date: TITLE },
    23: { patientName: TITLE, date: TITLE },
    24: { patientID: BILLING, patientEmail: BILLING, guardianName: RULE, guardianRelation: RULE },
    25: { patientFirstName: TITLE, patientLastName: TITLE, patientDateOfBirth: TITLE, patientID: BILLING, patientEmail: BILLING },
    26: { patientFirstName: TITLE, patientLastName: TITLE, date: TITLE, patientID: BILLING, patientEmail: BILLING },
    27: { internalEmailSubject: TITLE },
    28: { patientName: TITLE, date: TITLE },
    29: { patientName: TITLE, date: TITLE },
    35: { patientName: TITLE },
    41: { patientName: TITLE, date: TITLE },
    42: { externalMailSubject: TITLE },
    37: { patientID: TITLE, dateOfDeath: TITLE },
    50: { applicantFirstName: TITLE, applicantLastName: TITLE },
    51: { applicantFirstName: TITLE, applicantLastName: TITLE },
    52: { applicantFirstName: TITLE, applicantLastName: TITLE },
    53: { applicantFirstName: TITLE, applicantLastName: TITLE },
    54: { applicantFirstName: TITLE, applicantLastName: TITLE },
    55: { applicantFirstName: TITLE, applicantLastName: TITLE },
};

export const LOCK_REASONS = {
    [TITLE]: 'Ce champ compose le titre du rapport : il reste obligatoire.',
    [BILLING]: 'Ce champ sert à la facturation du dossier : il reste obligatoire.',
    [RULE]: 'Règle du formulaire : obligatoire dès que le champ s\'affiche (patient mineur non émancipé), sans jamais bloquer quand il n\'apparaît pas.',
};

// Règles propres au code, qui ne se règlent pas champ par champ (affichées en lecture seule dans la page d'administration).
export const SPECIAL_RULES = {
    2: ["ID patient du défunt (réel, ou temporaire TMP-… généré dans le formulaire) : il identifie le courriel. Le courriel peut concerner plusieurs défunts : on ajoute leurs ID, le titre est la suite de ces ID et le rapport est lié à chacun d'eux."],
    1: ["ID patient du défunt : réel, ou temporaire (TMP-…) pour un défunt sans ID. Le titre du rapport ne comporte que la date, jamais l'heure."],
    37: ["Discord du défunt : pas exigé pour un défunt non identifié."],
    3: ["Titre « Mineur » : seulement si la date de naissance indique moins de 18 ans."],
    11: [
        "Au moins un défunt, et le premier doit avoir un nom.",
        "Chaque défunt a son ID patient (réel, ou temporaire TMP-…) : le titre du rapport est la suite de ces ID, et le rapport est lié au dossier de chacun.",
    ],
    24: [
        "Prénom ou nom du patient : au moins un des deux.",
        "Au moins un élément du dossier médical à divulguer.",
        "Patient mineur non émancipé : nom et lien du représentant légal (ces deux champs n'apparaissent, et ne sont exigés, que dans ce cas).",
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
