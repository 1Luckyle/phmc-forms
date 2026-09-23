// src/constants/ranks.js
// Grades PHMC et Coroner - Ces données correspondent à celles dans Firebase

export const PHMC_RANKS = [
  { label: "Étudiant(e) infirmier(ère)", value: "Student Nurse", badgePrefix: "SN" },
  { label: "Interne Infirmier(ère)", value: "Nurse", badgePrefix: "NI" },
  { label: "Infirmier(ère) Diplômé(e) d'État (RN)", value: "Registered Nurse", badgePrefix: "RN" },
  { label: "Infirmier(ère) en Pratique Avancée (NP)", value: "NP", badgePrefix: "NP" },
  { label: "Externe (Sub-Interne)", value: "SubIntern", badgePrefix: "SI" },
  { label: "Interne", value: "Intern", badgePrefix: "IN" },
  { label: "Médecin", value: "Physician", badgePrefix: "MD" },
  { label: "Chirurgien", value: "Surgeon", badgePrefix: "SG" },
  { label: "Pharmacien", value: "Pharmacist", badgePrefix: "PH" },
  { label: "Physiothérapeute", value: "Physical Therapist", badgePrefix: "PT" },
  { label: "Psychologue", value: "Psych", badgePrefix: "PS" },
];

export const CORONER_RANKS = [
  { label: "Stagiaire Médico-Légal", value: "Trainee Forensic Attendant", badgePrefix: "TF" },
  { label: "Interne Médico-Légal", value: "Coroner Internship", badgePrefix: "IN" },
  { label: "Enquêteur Médico-Légal", value: "Coroner Investigator", badgePrefix: "IV" },
  { label: "Médecin Légiste", value: "Medical Examiner", badgePrefix: "ME" },
];

// Grades pour lesquels un titre (Dr./Pr.) peut être ajouté devant le prénom.
export const DOCTOR_RANKS = ["Physician", "Surgeon", "Medical Examiner"];

export const TITLE_PREFIXES = ["Dr.", "Pr."];

// Ajoute/retire le titre directement dans le champ prénom lui-même (pas de
// champ séparé à gérer côté BBCode/affichage) : on retire d'abord tout titre
// déjà présent avant d'appliquer le nouveau, pour éviter "Dr. Pr. Nom".
export const applyTitlePrefix = (firstName, title) => {
  const stripped = (firstName || '').replace(/^(Dr\.|Pr\.)\s+/, '');
  return title ? `${title} ${stripped}`.trim() : stripped;
};

// Retourne le titre actuellement présent dans le prénom ("Dr.", "Pr." ou null).
export const getTitlePrefix = (firstName) => {
  const match = /^(Dr\.|Pr\.)\s+/.exec(firstName || '');
  return match ? match[1] : null;
};
