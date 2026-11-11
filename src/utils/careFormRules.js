// src/utils/careFormRules.js
//
// Règles pures des champs ajoutés aux formulaires de soins (voir constants/careFormOptions.js) : durée de prise en charge, validité d'une aptitude, changement du contact d'urgence,
// contrôles avant enregistrement. Testé dans careFormRules.test.js.
import { validUntil } from './flightCertificate';
import { RISK_NEEDING_ACTION, MENTAL_HEALTH_VERSIONS, DEFAULT_APTITUDE_MONTHS, EVAL_REASONS, labelOf } from '../constants/careFormOptions';

const TIME = /^(\d{1,2}):(\d{2})$/;
export const minutesOfTime = (value) => {
    const match = TIME.exec(String(value || ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

// Minutes entre deux heures (HH:MM) ; si la fin est avant le début, la prise en charge a passé minuit. null si une heure manque.
export const minutesBetween = (start, end) => {
    const from = minutesOfTime(start);
    const to = minutesOfTime(end);
    if (from === null || to === null) return null;
    return to >= from ? to - from : to + 24 * 60 - from;
};
export const durationLabel = (minutes) => {
    if (minutes === null || minutes === undefined) return '';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? `${hours} h ${String(rest).padStart(2, '0')} min` : `${rest} min`;
};

// Date de fin de validité d'une aptitude (AAAA-MM-JJ) ; '' si inconnue ou si le patient est inapte.
export const aptitudeValidUntil = (data = {}) => {
    if (data.aptitudeConclusion === 'Inapte') return '';
    return validUntil(data.date, Number(data.aptitudeValidityMonths) || DEFAULT_APTITUDE_MONTHS);
};

const frDateOf = (iso) => String(iso || '').split('-').reverse().join('/');
/**
 * Déclaration d'évaluation proposée d'après la conclusion d'aptitude (motif, conclusion, restrictions, validité, vaccinations). '' tant qu'aucune conclusion n'est choisie.
 * Le soignant la relit et la complète : elle ne remplace jamais un texte déjà écrit sans son accord.
 */
export const aptitudeStatement = (data = {}) => {
    const conclusion = data.aptitudeConclusion;
    if (!conclusion) return '';
    const reason = labelOf(EVAL_REASONS, data.evalReason).toLowerCase();
    const until = aptitudeValidUntil(data);
    const restrictions = String(data.aptitudeRestrictions || '').trim();
    const months = Number(data.aptitudeValidityMonths) || DEFAULT_APTITUDE_MONTHS;
    const lines = [reason ? `Évaluation réalisée dans le cadre d'une visite d'aptitude (${reason}).` : "Évaluation réalisée dans le cadre d'une visite d'aptitude."];
    lines.push('Examen clinique complet et recueil des antécédents effectués ce jour.');
    if (conclusion === 'Apte') lines.push("L'examen ne met en évidence aucune contre-indication : le patient est déclaré APTE.");
    else if (conclusion === 'Apte avec restrictions') lines.push(`Le patient est déclaré APTE sous réserve des restrictions suivantes : ${restrictions || 'à préciser'}.`);
    else lines.push("Le patient est déclaré INAPTE à ce stade. Une nouvelle évaluation pourra être programmée après prise en charge adaptée.");
    if (conclusion !== 'Inapte' && until) lines.push(`Cette aptitude est valable ${months} mois, jusqu'au ${frDateOf(until)}.`);
    if (data.vaccinationState === 'No') lines.push(`Vaccinations à compléter${String(data.vaccinationNote || '').trim() ? ` : ${String(data.vaccinationNote).trim()}` : ''}.`);
    return lines.join('\n');
};

// Champs du contact d'urgence du dossier (voir utils/dossierCore.js : EMERGENCY_FIELDS).
export const EMERGENCY_CONTACT_FIELDS = [
    'patientEmergencyContact', 'patientEmergencyContactTitle', 'patientEmergencyContactFirstName', 'patientEmergencyContactMiddleName',
    'patientEmergencyContactLastName', 'patientEmergencyContactRelation', 'patientEmergencyContactNumber', 'patientEmergencyContactDiscord',
];
const norm = (value) => String(value ?? '').trim();

// Valeurs du contact d'urgence saisies dans le formulaire qui DIFFÈRENT de celles du dossier. Rien si le dossier n'a pas de contact (pas de dossier : rien à mettre à jour) ou si le formulaire
// n'en porte aucun. → { champ: valeur } (valeur '' = champ vidé).
export const emergencyContactChanges = (donnees, formData) => {
    if (!donnees) return {};
    const changes = {};
    const filledInForm = EMERGENCY_CONTACT_FIELDS.some((field) => norm(formData[field]) !== '');
    if (!filledInForm) return {};
    EMERGENCY_CONTACT_FIELDS.forEach((field) => { if (norm(formData[field]) !== norm(donnees[field])) changes[field] = norm(formData[field]); });
    return changes;
};

// Allergies, antécédents et traitements modifiés par le soignant par rapport au dossier : leurs libellés (pour la mention « mis à jour lors de cette consultation »).
export const BACKGROUND_FIELD_LABELS = { patientAllergies: 'allergies', patientChronicDiseases: 'antécédents', patientCurrentMedicine: 'traitements' };
export const changedBackgroundFields = (donnees, formData) => {
    if (!donnees) return [];
    return Object.keys(BACKGROUND_FIELD_LABELS).filter((field) => norm(donnees[field]) !== '' && norm(formData[field]) !== norm(donnees[field]));
};

// Problèmes propres aux champs ajoutés (en plus des champs obligatoires communs) → liste de messages.
export const validateCareExtras = (version, data = {}) => {
    const number = Number(version);
    const f = data || {};
    const problems = [];
    if (number === 5) {
        if (f.surgeryDuration && !/^\d+$/.test(String(f.surgeryDuration).trim())) problems.push("Durée de l'intervention : indiquez un nombre de minutes.");
    }
    if (number === 6 || number === 7) {
        if (f.aptitudeConclusion === 'Apte avec restrictions' && !norm(f.aptitudeRestrictions)) problems.push("Précisez les restrictions d'aptitude.");
        if (f.vaccinationState === 'No' && !norm(f.vaccinationNote)) problems.push('Précisez les vaccinations manquantes.');
    }
    if (MENTAL_HEALTH_VERSIONS.includes(number)) {
        const needsAction = RISK_NEEDING_ACTION.includes(f.riskSuicide) || RISK_NEEDING_ACTION.includes(f.riskDanger);
        if (needsAction && !f.riskAction) problems.push('Un risque modéré ou plus demande une conduite à tenir.');
        if (f.involuntaryHold && f.involuntaryHold !== 'No' && f.admission === 'No') problems.push("Une hospitalisation sous contrainte suppose « Patient admis » : corrigez l'un des deux.");
    }
    if (number === 19) {
        if (f.dischargeDestination === 'Transfer' && !norm(f.transferTo)) problems.push("Indiquez l'établissement de transfert.");
        if (f.careStartTime && f.careEndTime && minutesBetween(f.careStartTime, f.careEndTime) > 12 * 60) problems.push('La prise en charge dépasse 12 heures : vérifiez les heures de début et de fin.');
    }
    if ((number === 20 || number === 21) && f.workStoppage === 'Yes' && !(Number(f.workStoppageDays) >= 1)) problems.push("Arrêt de travail : indiquez sa durée en jours.");
    if (f.referralReason === 'Other' && !norm(f.referralOther)) problems.push("Motif d'adressage « Autre » : précisez-le.");
    return problems;
};
