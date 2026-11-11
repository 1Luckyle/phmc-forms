// src/constants/careFormPresets.js
//
// Choix par défaut des champs libres des formulaires de consultation (évaluation physique, consultation psychiatrique, évaluation psychologique) : voir phmc-field-data/shared/PresetTextField.js.
// On coche autant de choix qu'on veut et on peut toujours ajouter du texte libre ; le texte regroupé reste enregistré dans le champ lui-même, le rapport BBCode ne change donc pas.
// Les listes d'historique communes (allergies, traitements, maladies chroniques…) viennent de constants/historyPresets.js.
import { HISTORY_PRESETS } from './historyPresets';

const NONE = (label) => label;
// Psychotropes courants (noms seulement : les doses se précisent dans le texte libre).
const PSYCHOTROPES = [
    'Sertraline', 'Escitalopram', 'Fluoxétine', 'Venlafaxine', 'Mirtazapine', 'Amitriptyline', 'Alprazolam', 'Lorazépam', 'Diazépam', 'Hydroxyzine', 'Zolpidem',
    'Quétiapine', 'Olanzapine', 'Halopéridol', 'Lithium', 'Méthylphénidate', NONE('Aucun traitement médicamenteux'),
];
const PSY_DIAGNOSES = [
    'Épisode dépressif caractérisé', 'Trouble anxieux généralisé', 'Trouble panique', 'Stress post-traumatique (TSPT)', 'Trouble de l\'adaptation', 'Trouble bipolaire',
    'Trouble psychotique', 'Trouble obsessionnel compulsif', 'Trouble de la personnalité', 'Trouble lié à l\'usage de substances', 'Trouble du sommeil', 'Burn-out',
    'Deuil compliqué', 'Phobie', 'Aucun trouble avéré',
];
const COMPLAINTS = [
    'Anxiété', 'Humeur dépressive', 'Troubles du sommeil', 'Crises de panique', 'Stress lié au travail', 'Deuil', 'Irritabilité / colère', 'Idées noires',
    'Choc après un événement traumatisant', 'Addiction', 'Difficultés relationnelles', 'Suivi de traitement',
];

export const PHYS_EVAL_PRESETS = {
    patientCareer: [
        'Employé(e) du PHMC', 'Forces de l\'ordre', 'Pompier / secours', 'Chauffeur / livreur', 'Ouvrier du bâtiment', 'Mécanicien(ne)', 'Commerçant(e)',
        'Employé(e) de bureau', 'Restauration', 'Agent de sécurité', 'Chef d\'entreprise', 'Étudiant(e)', 'Retraité(e)', 'Sans emploi',
    ],
    patientcareerNo: ['Étudiant(e)', 'Retraité(e)', 'Au foyer', 'Demandeur d\'emploi', 'En arrêt maladie', 'Bénévole', 'Rentier'],
    careerRisks: HISTORY_PRESETS.patientJobRisks,
    patientAllergies: HISTORY_PRESETS.patientAllergies,
    patientMedicine: HISTORY_PRESETS.patientCurrentMedicine,
    patientImpairments: [
        'Déficience visuelle (verres correcteurs)', 'Déficience auditive', 'Mobilité réduite', 'Douleurs chroniques du dos', 'Handicap moteur', 'Trouble de l\'équilibre',
        'Daltonisme', 'Trouble de la parole', 'Aucune déficience',
    ],
};

export const MENTAL_HEALTH_PRESETS = {
    patientChiefComplaint: COMPLAINTS,
    patientNotes: [
        'Patient coopératif', 'Bon contact', 'Discours cohérent', 'Humeur abaissée', 'Anxiété au premier plan', 'Sommeil perturbé', 'Pas d\'idées suicidaires exprimées',
        'Observance du traitement correcte', 'Amélioration depuis la dernière séance', 'Aggravation depuis la dernière séance', 'Réticence à parler',
    ],
    patientDiagnosis: PSY_DIAGNOSES,
    patientProcedure: [
        'Entretien clinique', 'Évaluation du risque suicidaire', 'Psychoéducation', 'Technique de relaxation', 'Thérapie cognitivo-comportementale', 'Plan de sécurité établi',
        'Orientation vers un psychiatre', 'Prescription d\'un traitement', 'Information de l\'entourage',
    ],
    patientMedicine: PSYCHOTROPES,
};

export const PSYCH_EVAL_PRESETS = {
    patientChiefComplaint: COMPLAINTS,
    patientVisitReason: ['Anxiété', 'Dépression', 'Stress', 'Troubles du sommeil', 'Deuil', 'Colère', 'Traumatisme', 'Addiction', 'Difficultés relationnelles', 'Demande d\'évaluation'],
    patientSymptoms: [
        'Apparition brutale', 'Apparition progressive', 'Depuis quelques jours', 'Depuis plusieurs semaines', 'Depuis plusieurs mois', 'Depuis plus d\'un an',
        'Épisodes intermittents', 'Symptômes quotidiens', 'Aggravation récente',
    ],
    patientTriggers: [...HISTORY_PRESETS.patientTriggers.filter((item) => !/^aucun/i.test(item)), 'Conflit familial', 'Perte d\'emploi', 'Deuil', 'Problèmes d\'argent', 'Aucun déclencheur connu'],
    patientStress: [
        'Troubles du sommeil', 'Perte d\'appétit', 'Isolement social', 'Difficultés au travail', 'Baisse de concentration', 'Irritabilité', 'Fatigue', 'Absentéisme',
    ],
    patientTreatment: [...HISTORY_PRESETS.patientMental.filter((item) => !/^aucun/i.test(item)), 'Suivi psychiatrique antérieur', 'Suivi psychologique antérieur', 'Aucun antécédent psychiatrique'],
    patientMedicalRecord: ['Aucune hospitalisation', 'Hospitalisation psychiatrique', 'Hospitalisation sous contrainte', 'Passage aux urgences pour une crise', 'Hospitalisation médicale'],
    patientFamily: ['Dépression', 'Trouble bipolaire', 'Schizophrénie', 'Suicide dans la famille', 'Addiction', 'Aucun antécédent psychiatrique familial'],
    patientJobRisks: HISTORY_PRESETS.patientHarm,
    patientCondition: HISTORY_PRESETS.patientChronicDiseases,
    patientChronicDiseases: [...HISTORY_PRESETS.patientCurrentMedicine.filter((item) => !/^aucun/i.test(item)), ...PSYCHOTROPES],
    patientAllergies: HISTORY_PRESETS.patientAllergies,
    patientDrugs: [...HISTORY_PRESETS.patientDrugs.filter((item) => !/^aucune/i.test(item)), 'Alcool', 'Tabac', 'Aucune consommation'],
    patientDrugsUsage: ['Occasionnelle', 'Quotidienne', 'Plusieurs fois par jour', 'Depuis moins d\'un an', 'Depuis plus de 5 ans', 'Sevrage en cours', 'Rechute récente'],
    patientMental: ['Aggravation des symptômes', 'Prise de risques', 'Isolement', 'Automédication', 'Troubles du sommeil', 'Perte de motivation'],
    patientFam: ['Enfance stable', 'Parents séparés', 'Violences familiales', 'Placement en famille d\'accueil', 'Deuil précoce', 'Négligence', 'Harcèlement scolaire'],
    patientJob: ['Études supérieures', 'Études secondaires', 'Décrochage scolaire', 'Emploi stable', 'Chômage', 'Changements d\'emploi fréquents', 'Arrêt maladie en cours', 'Retraité(e)'],
    patientRelationship: ['Entourage soutenant', 'Conjoint(e) soutenant(e)', 'Relations conflictuelles', 'Isolement social', 'Peu d\'amis proches', 'Soutien familial limité'],
    patientLegal: ['Aucun problème juridique', 'Antécédents judiciaires', 'Procédure en cours', 'Mesure de protection', 'Détention passée'],
    patientRiskAssessment: [
        'Pas d\'idées suicidaires actuelles', 'Idées suicidaires passives', 'Idées suicidaires actives sans scénario', 'Scénario suicidaire élaboré', 'Pas de danger pour autrui',
        'Facteurs protecteurs présents', 'Accès à des moyens létaux',
    ],
    patientFindings: ['Contact facile', 'Discours cohérent', 'Anxiété manifeste', 'Humeur triste', 'Critique conservée', 'Bonne collaboration', 'Réticence à parler'],
    patientDiagnosis: PSY_DIAGNOSES,
    patientTreatmentPlan: [
        'Suivi psychologique hebdomadaire', 'Suivi psychiatrique', 'Thérapie cognitivo-comportementale', 'Psychoéducation', 'Techniques de relaxation', 'Traitement médicamenteux à débuter',
        'Hospitalisation à envisager', 'Réévaluation dans un mois',
    ],
    patientTherapyMedicine: PSYCHOTROPES,
    patientTreatmentMedicine: PSYCHOTROPES,
    patientTherapy: HISTORY_PRESETS.patientTherapy,
    patientFollowUp: ['Rendez-vous à une semaine', 'Rendez-vous à deux semaines', 'Rendez-vous à un mois', 'Contrôle à trois mois', 'Suivi en cas de besoin', 'Consultation en urgence si aggravation'],
    patientSafety: [
        'Plan de sécurité rédigé', 'Numéros d\'urgence communiqués', 'Contact de crise remis', 'Retrait des moyens létaux convenu', 'Entourage informé', 'Surveillance rapprochée',
        'Aucun plan nécessaire',
    ],
};

// Champs à choix par défaut de chaque version (pour conserver `…Presets` et `…Free` à l'enregistrement).
export const CARE_PRESETS_BY_VERSION = {
    6: PHYS_EVAL_PRESETS, 7: PHYS_EVAL_PRESETS, 14: MENTAL_HEALTH_PRESETS, 16: MENTAL_HEALTH_PRESETS, 28: PSYCH_EVAL_PRESETS, 29: PSYCH_EVAL_PRESETS,
};
export const carePresetFieldsOf = (version) => Object.keys(CARE_PRESETS_BY_VERSION[version] || {}).flatMap((key) => [`${key}Presets`, `${key}Free`]);
