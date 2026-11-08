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

// Fond médical qu'un formulaire de soins peut reprendre du dossier (jamais le motif, l'examen ni le diagnostic).
export const CARE_BACKGROUND_FIELDS = ['patientAllergies', 'patientChronicDiseases', 'patientCurrentMedicine'];
// Formulaires de soins concernés (ni dossier, ni libération, ni DMEC, ni courriels, ni candidatures).
export const CARE_PREFILL_VERSIONS = [5, 6, 7, 14, 16, 19, 20, 21, 28, 29];

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
        CARE_BACKGROUND_FIELDS.forEach((field) => take(field));
    }
    const patch = {};
    Object.entries(wanted).forEach(([target, value]) => { if (empty(formData[target])) patch[target] = value; });
    return patch;
};
