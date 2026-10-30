// src/constants/salaryReference.js
//
// Les 15 ÉCHELONS de rémunération du PHMC (fixes) et leur salaire par défaut. Chaque échelon a un taux À L'HEURE et un total À LA SEMAINE (20 h). Un poste (un rôle
// du personnel) a UN seul échelon, qui fixe son salaire : modifier le salaire d'un échelon (Comptabilité → Transparence) le modifie pour tous les rôles
// qui s'y trouvent. Le rôle donné en exemple à chaque échelon (« Rangs et Salaires ») aide à choisir celui d'un nouveau poste.
export const ECHELON_COUNT = 15;

// rang = numéro de l'échelon ; `grades` : rôles du référentiel (constants/ranks.js) donnés en exemple ; `montants` : [à l'heure, à la semaine].
export const REFERENCE_GRID = [
    { rang: 15, label: 'Directrice', grades: ['Directeur(trice)'], montants: [4500, 90000] },
    { rang: 14, label: 'Assistante de Direction', grades: ['Assistant(e) de Direction'], montants: [4250, 85000] },
    { rang: 13, label: 'Chef de Service', grades: ['Chef de Service'], montants: [4000, 80000] },
    { rang: 12, label: 'Personnel Administratif', grades: ['Personnel Administratif'], montants: [3000, 60000] },
    { rang: 11, label: 'Médecin Titulaire', grades: ['Médecin Titulaire'], montants: [3750, 75000] },
    { rang: 10, label: 'Docteur Junior', grades: ['Docteur Junior'], montants: [3500, 70000] },
    { rang: 9, label: 'Interne en Médecine', grades: ['Interne en Médecine'], montants: [3000, 60000] },
    { rang: 8, label: 'Paramedic', grades: ['Paramedic'], montants: [3500, 70000] },
    { rang: 7, label: 'Infirmier en Pratique Avancée', grades: ['Infirmier(ère) en Pratique Avancée'], montants: [3500, 70000] },
    { rang: 6, label: 'Infirmier', grades: ['Infirmier(ère)'], montants: [3200, 64000] },
    { rang: 5, label: 'Technicien Ambulancier (EMT)', grades: ['Technicien(ne) Ambulancier(ère) (EMT)'], montants: [2900, 58000] },
    { rang: 4, label: 'Agent de Maîtrise', grades: ['Agent Maîtrise'], montants: [3100, 62000] },
    { rang: 3, label: 'Aide Soignant', grades: ['Aide Soignant(e)'], montants: [2700, 54000] },
    { rang: 2, label: 'Externe / Étudiant', grades: ['Externe / Étudiant(e) en Médecine', 'Externe / Étudiant(e) Infirmier(ère)', 'Externe / Étudiant(e) Paramédical(e)'], montants: [2500, 50000] },
    { rang: 1, label: 'Personnel Polyvalent', grades: ['Personnel Polyvalent'], montants: [2600, 52000] },
];

// Salaire par défaut de chaque échelon : { [numéro]: { horaire, hebdo } }.
export const DEFAULT_ECHELON_RATES = Object.fromEntries(REFERENCE_GRID.map((row) => [row.rang, { horaire: row.montants[0], hebdo: row.montants[1] }]));

// Rôle donné en exemple à un échelon (libellé), ou ''.
export const exampleLabelOf = (numero) => REFERENCE_GRID.find((row) => row.rang === numero)?.label || '';

// Échelon de référence d'un rôle du référentiel (ex. « Chef de Service » → 13), ou null pour un rôle qui n'est pas dans la grille de référence.
export const referenceEchelonOf = (role) => REFERENCE_GRID.find((row) => row.grades.includes(role))?.rang ?? null;
