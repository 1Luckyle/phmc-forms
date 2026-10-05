const GENDER_LABELS = {
    Male: 'Masculin',
    Female: 'Féminin',
    Other: 'Autre / Non précisé',
};

const orNA = (value) => (value && String(value).trim() ? String(value).trim() : 'N/A');

/**
 * Âge et sexe du patient sur une ligne, ex. « 23 ans / Masculin ».
 */
export const formatAgeAndGender = (formData) => {
    const age = formData.patientAgeYears ? `${formData.patientAgeYears} ans` : 'N/A';
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
    return `[divboxcolor=black][center][color=${accentColor}]>[/color] [color=#FFFFFF][b]Contexte patient[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]${body}[/left][/list][/table]
`;
};
