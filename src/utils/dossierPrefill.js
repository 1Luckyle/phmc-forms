// src/utils/dossierPrefill.js
//
// Pré-remplissage des formulaires à partir du DOSSIER du patient (voir utils/dossierCore.js) : on ne retape jamais ce que le dossier sait déjà.
//   • Dossier Basique / Avancé : tous les champs du dossier que le formulaire porte ;
//   • Mise à jour : les valeurs ACTUELLES de chaque section (le patient corrige au lieu de tout retaper), y compris dans les champs « nouveau » des informations générales ;
//   • formulaires de soins : seulement le fond médical connu (allergies, maladies chroniques, traitements en cours) : jamais ce qui se détermine pendant la consultation.
// Un champ déjà rempli n'est JAMAIS écrasé. Module pur : retourne le correctif à appliquer.
import {
    ADVANCED_FIELDS, IDENTITY_FIELDS, EMERGENCY_FIELDS, MEDICAL_FIELDS, MENTAL_FIELDS, FAMILY_FIELDS, SOCIAL_FIELDS, LIFESTYLE_FIELDS, DIRECTIVE_FIELDS,
    NEW_KEY, isDossierVersion, BASIC_VERSION, ADVANCED_VERSION, UPDATE_VERSION,
} from './dossierCore';
import { ageOn, isMinorTitle, MAJORITY_AGE } from './minors';
import { MENTAL_HEALTH_VERSIONS } from '../constants/careFormOptions';

// Fond médical qu'un formulaire de soins peut reprendre du dossier (jamais le motif, l'examen ni le diagnostic).
export const CARE_BACKGROUND_FIELDS = ['patientAllergies', 'patientChronicDiseases', 'patientCurrentMedicine'];
// Poids et taille du dossier : reprises par les formulaires de soins (l'assistant clinique en tire les doses). L'évaluation physique (6, 7) les affiche telles quelles : elles y portent leur unité.
export const CARE_BODY_FIELDS = ['patientWeight', 'patientHeight'];
const BODY_UNIT = { patientWeight: 'kg', patientHeight: 'cm' };
// Identité du patient reprise du dossier par les formulaires de soins : nom en trois champs, date de naissance (l'âge s'en déduit) et sexe.
export const CARE_IDENTITY_FIELDS = ['patientFirstName', 'patientMiddleName', 'patientLastName', 'patientDateOfBirth'];
// Formulaires de soins concernés (ni dossier, ni libération, ni DMEC, ni courriels, ni candidatures). 35 et 41 : certificats (identité seulement).
export const CARE_PREFILL_VERSIONS = [5, 6, 7, 14, 16, 19, 20, 21, 28, 29];
export const CARE_IDENTITY_ONLY_VERSIONS = [35, 41];

// Sexe du dossier (« Homme », « Femme », « Autre ») → valeur de la liste « Sexe du patient » des formulaires de soins.
export const careSexOf = (gender) => {
    const value = String(gender || '').trim().toLowerCase();
    if (!value) return '';
    if (['homme', 'male', 'masculin'].includes(value)) return 'Male';
    if (['femme', 'female', 'féminin', 'feminin'].includes(value)) return 'Female';
    return 'Other';
};

const empty = (value) => (Array.isArray(value) ? value.length === 0 : String(value ?? '').trim() === '');

// donnees : dossier.donnees ; formData : le formulaire actuel ; knownFields : champs du formulaire (catalogue). Retourne { champ: valeur } pour les champs vides seulement.
export const dossierPrefillPatch = (version, donnees = {}, formData = {}, knownFields = []) => {
    const known = new Set(knownFields);
    const number = Number(version);
    const wanted = {};
    const take = (field, target = field) => { if (known.has(target) && !empty(donnees[field])) wanted[target] = donnees[field]; };

    if (number === BASIC_VERSION || number === ADVANCED_VERSION) {
        ADVANCED_FIELDS.forEach((field) => take(field));
    } else if (number === UPDATE_VERSION) {
        IDENTITY_FIELDS.forEach((field) => { take(field); take(field, NEW_KEY[field]); });
        [EMERGENCY_FIELDS, MEDICAL_FIELDS, MENTAL_FIELDS, FAMILY_FIELDS, SOCIAL_FIELDS, LIFESTYLE_FIELDS, DIRECTIVE_FIELDS].forEach((group) => group.forEach((field) => take(field)));
    } else if (CARE_PREFILL_VERSIONS.includes(number) && !isDossierVersion(number)) {
        CARE_IDENTITY_FIELDS.forEach((field) => take(field));
        // Santé mentale : le contact d'urgence du dossier (modifié ici, il met le dossier à jour à l'enregistrement).
        if (MENTAL_HEALTH_VERSIONS.includes(number)) EMERGENCY_FIELDS.forEach((field) => take(field));
        if (known.has('patientSex') && !empty(donnees.patientGender)) wanted.patientSex = careSexOf(donnees.patientGender);
        CARE_BACKGROUND_FIELDS.forEach((field) => take(field));
        CARE_BODY_FIELDS.forEach((field) => {
            if (!known.has(field) || empty(donnees[field])) return;
            const value = String(donnees[field]).trim();
            wanted[field] = [6, 7].includes(number) && /^[\d.,]+$/.test(value) ? `${value} ${BODY_UNIT[field]}` : value;
        });
    } else if (CARE_IDENTITY_ONLY_VERSIONS.includes(number)) {
        CARE_IDENTITY_FIELDS.forEach((field) => take(field));
    }
    const patch = {};
    Object.entries(wanted).forEach(([target, value]) => { if (empty(formData[target])) patch[target] = value; });
    return patch;
};

// ───────────── Candidatures ─────────────
// Les candidatures reprennent l'identité du compte (profil) et le dossier : titre, prénom, deuxième prénom, nom, date de naissance, adresse et ville, téléphone, e-mail et Discord.
// identity : { firstName, middleName, lastName, dateOfBirth, address, zip, phone, email, discord }. Un champ déjà rempli (ou restauré du brouillon) n'est jamais écrasé.
// Le titre « Mineur » suit l'âge (formulaire : useMinorTitleGuard) : il n'est jamais repris d'un dossier ancien s'il contredit la date de naissance.
export const candidaturePrefillPatch = (identity = {}, donnees = {}, formData = {}) => {
    const person = { ...identity };
    const dob = donnees.patientDateOfBirth || person.dateOfBirth || '';
    const age = ageOn(dob);
    let title = donnees.patientTitle || '';
    if (isMinorTitle(title) && (age === null || age >= MAJORITY_AGE)) title = '';
    const wanted = {
        patientID: person.patientID || '',
        applicantTitle: title,
        applicantFirstName: donnees.patientFirstName || person.firstName || '',
        applicantMiddleName: donnees.patientMiddleName || person.middleName || '',
        applicantLastName: donnees.patientLastName || person.lastName || '',
        applicantDOB: dob,
        applicantAddress: donnees.patientAddress || person.address || '',
        applicantZIP: donnees.patientZIP || person.zip || '',
        applicantZIPCity: donnees.patientZIPCity || '',
        applicantPhone: donnees.patientPH || person.phone || '',
        applicantEmail: person.email || '',
        oocDiscord: donnees.patientDiscord || person.discord || '',
    };
    const patch = {};
    Object.entries(wanted).forEach(([key, value]) => { if (value && empty(formData[key])) patch[key] = value; });
    return patch;
};
