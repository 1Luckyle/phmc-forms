import { sectionBanner } from './bbStyles';
const GENDER_LABELS = {
    Male: 'Masculin',
    Female: 'Féminin',
    Other: 'Autre / Non précisé',
};

// Ligne « Signé : » de l'en-tête : le prénom et le nom de la personne qui signe le rapport (son créateur), suivis de son rôle. Les anciens rapports (rôle + nom de famille) restent lisibles.
export const signedLine = (formData) => {
    const name = String(formData.phmcEmployee || formData.signerName || '').trim();
    const rank = String(formData.phmcRank || formData.signerRank || '').trim();
    if (!name) return `${rank || 'N/A'} ${formData.lastName || 'N/A'}`.trim();
    return `${name}${rank ? ` — ${rank}` : ''}`;
};

const orNA = (value) => (value && String(value).trim() ? String(value).trim() : 'N/A');

/**
 * Âge et sexe du patient sur une ligne, ex. « 23 ans / Masculin ».
 */
const frDate = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

// L'âge se calcule à partir de la date de naissance : les deux figurent (« 35 ans (né(e) le 12/03/1990) »). Les anciens rapports sans date de naissance gardent l'âge seul.
export const formatAgeAndGender = (formData) => {
    const birth = frDate(formData.patientDateOfBirth);
    const age = formData.patientAgeYears ? `${formData.patientAgeYears} ans${birth ? ` (né(e) le ${birth})` : ''}` : (birth ? `né(e) le ${birth}` : 'N/A');
    const gender = GENDER_LABELS[formData.patientSex] || 'N/A';
    return `${age} / ${gender}`;
};

/**
 * Section « Contexte patient » du BBCode (même habillage que les autres
 * sections des protocoles). `accentColor` : rouge PHMC par défaut, bleu pour
 * la Clinique de Paleto Bay.
 */
export const buildPatientContextBBCode = (formData, { accentColor = '#FF0000', showHistory = true } = {}) => {
    let body = `[u]Âge / Sexe: [/u] ${formatAgeAndGender(formData)}`;
    if (showHistory) {
        body += `
[br][/br][u]Allergies: [/u][br][/br]
${formData.patientAllergies && String(formData.patientAllergies).trim() ? String(formData.patientAllergies).trim() : 'Non renseigné'}
[br][/br][u]Antécédents médicaux: [/u][br][/br]
${orNA(formData.patientChronicDiseases)}
[br][/br][u]Traitements habituels: [/u][br][/br]
${orNA(formData.patientCurrentMedicine)}`;
    }
    return `${sectionBanner('Contexte patient', { accent: accentColor })}
[table][tr][td][left][list=none]${body}[/left][/list][/table]
`;
};
