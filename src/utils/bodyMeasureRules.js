// src/utils/bodyMeasureRules.js
//
// Contrôle de l'âge, du poids et de la taille dans TOUS les formulaires qui les demandent (bornes : clinical/bodyLimits.js, communes à tout le site et à Pilou).
//   • patient (dossier médical, formulaires de soins, certificats…) : valeur obligatoirement lisible et dans les bornes dès qu'elle est saisie ;
//   • défunt (fiches du DMEC : texte libre comme « 80 kg », « 1,80 m », « environ 40 ans ») : contrôlé seulement quand un nombre y figure — un « inconnu » reste permis ;
//   • un champ qui ne s'affiche pas dans le formulaire (ou dans la rubrique non cochée d'une mise à jour) n'est jamais contrôlé ;
//   • IMC très improbable (poids et taille probablement inversés) : simple avertissement.
import { VERSION_FIELDS } from '../constants/formFieldCatalog';
import { getFieldInfo } from '../constants/fieldInfo';
import { isFieldApplicable } from './fieldApplicability';
import { parseAgeYears, parseWeightKg, parseHeightCm, bmiOf, isBmiImplausible, LIMIT_HINTS } from '../clinical/bodyLimits';

// champ → [type, mode] : mode « strict » (patient) ou « lenient » (défunt, valeur libre).
const MEASURES = {
    patientWeight: ['weightKg', 'strict'], patientHeight: ['heightCm', 'strict'], patientAgeYears: ['ageYears', 'strict'], patientAge: ['ageYears', 'strict'],
    decedentWeight: ['weightKg', 'lenient'], decedentHeight: ['heightCm', 'lenient'], decedentAge: ['ageYears', 'lenient'],
    weight: ['weightKg', 'lenient'], height: ['heightCm', 'lenient'], age: ['ageYears', 'lenient'],   // rapport public de décès (37)
};
const PARSERS = { ageYears: parseAgeYears, weightKg: parseWeightKg, heightCm: parseHeightCm };
const EXAMPLES = { ageYears: 'par exemple 35', weightKg: 'par exemple 75', heightCm: 'par exemple 178' };
const UNITS = { ageYears: 'en années', weightKg: 'en kilogrammes', heightCm: 'en centimètres' };

const filled = (value) => String(value ?? '').trim() !== '';

/** → { errors: [message], warnings: [message] } */
export const bodyMeasureProblems = (version, data = {}) => {
    const errors = [];
    const warnings = [];
    const fields = VERSION_FIELDS[Number(version)] || {};
    Object.entries(MEASURES).forEach(([field, [kind, mode]]) => {
        if (!fields[field] || !filled(data[field]) || !isFieldApplicable(version, field, data)) return;
        const value = data[field];
        // Valeur libre d'une fiche de défunt (« environ 40 ans », « 80 kg ») : on lit le premier nombre ; sans nombre (« inconnu »), rien à contrôler.
        const candidate = mode === 'lenient' ? (String(value).match(/\d+(?:[.,]\d+)?/) || [''])[0] : value;
        if (mode === 'lenient' && !candidate) return;
        if (PARSERS[kind](candidate) !== null) return;
        const label = getFieldInfo(Number(version), field, fields[field]).label;
        errors.push(`${label} : valeur invalide (${UNITS[kind]}, ${LIMIT_HINTS[kind]}, ${EXAMPLES[kind]}).`);
    });
    // IMC très improbable (patient seulement).
    if (fields.patientWeight && fields.patientHeight && isFieldApplicable(version, 'patientWeight', data) && isFieldApplicable(version, 'patientHeight', data)) {
        const bmi = bmiOf(data.patientWeight, data.patientHeight);
        if (isBmiImplausible(bmi)) warnings.push(`Poids et taille : IMC de ${String(bmi).replace('.', ',')}, très improbable. Vérifiez les valeurs (poids en kg, taille en cm).`);
    }
    return { errors, warnings };
};
