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
