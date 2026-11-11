// src/constants/careFormOptions.js
//
// Listes de choix (valeur enregistrée → libellé) des champs ajoutés aux formulaires du personnel soignant : adressage, opération, évaluation d'aptitude, risque psychiatrique, urgences,
// consultation générale. Un seul endroit : les formulaires (listes déroulantes) et les générateurs BBCode (libellés imprimés) lisent les mêmes listes.
// Une valeur absente d'une liste (ancien rapport) s'imprime telle quelle.

const list = (items) => items.map(([value, label]) => ({ value, label }));
export const labelOf = (options, value) => {
    if (value === undefined || value === null || value === '') return '';
    const found = options.find((option) => option.value === value);
    return found ? found.label : String(value);
};

// ── Commun à tous les formulaires de soins ──
export const REFERRAL_REASONS = list([
    ['Spontaneous', 'Consultation spontanée (sans adressage)'],
    ['PhmcDoctor', 'Adressé par un médecin du PHMC'],
    ['ExternalDoctor', 'Adressé par un médecin extérieur'],
    ['Emergency', 'Adressé par les secours (EMS / 911)'],
    ['Police', "Adressé par les forces de l'ordre"],
    ['FollowUp', "Suite d'une consultation précédente"],
    ['Scheduled', 'Suivi programmé'],
    ['Other', 'Autre'],
]);

// ── Opération chirurgicale ──
export const SURGERY_CHARACTERS = list([['Scheduled', 'Programmée'], ['Urgent', 'Urgente'], ['Deferred', 'Différée']]);
export const ASA_CLASSES = list([
    ['ASA1', 'ASA 1 : patient en bonne santé'],
    ['ASA2', 'ASA 2 : maladie systémique légère'],
    ['ASA3', 'ASA 3 : maladie systémique sévère'],
    ['ASA4', 'ASA 4 : maladie sévère, menace vitale constante'],
    ['ASA5', "ASA 5 : patient moribond, survie improbable sans l'opération"],
]);
export const POST_OP_MONITORING = list([
    ['RecoveryRoom', 'Salle de réveil (SSPI)'],
    ['Icu', 'Soins intensifs / réanimation'],
    ['Ward', 'Chambre (hospitalisation)'],
    ['ObservationBox', 'Box de surveillance'],
    ['Home', 'Retour à domicile (chirurgie ambulatoire)'],
    ['Transfer', 'Transfert vers un autre établissement'],
]);

// ── Évaluation physique (aptitude) ──
export const EVAL_REASONS = list([['Hiring', 'Embauche'], ['Renewal', 'Renouvellement'], ['Return', 'Reprise (après une absence)']]);
export const APTITUDE_CONCLUSIONS = ['Apte', 'Apte avec restrictions', 'Inapte'];
export const APTITUDE_VALIDITY_MONTHS = [3, 6, 12, 24, 36];
export const DEFAULT_APTITUDE_MONTHS = 12;
export const VACCINATION_STATES = list([['Yes', 'Oui, à jour'], ['No', 'Non, incomplètes'], ['Unknown', 'Non vérifié']]);

// ── Consultation psychiatrique et évaluation psychologique ──
export const RISK_LEVELS = list([
    ['None', 'Aucun risque identifié'], ['Low', 'Risque faible'], ['Moderate', 'Risque modéré'], ['High', 'Risque élevé'], ['Imminent', 'Risque imminent'],
]);
export const RISK_NEEDING_ACTION = ['Moderate', 'High', 'Imminent'];
export const RISK_ACTIONS = list([
    ['Monitoring', 'Surveillance simple'],
    ['CloseFollowUp', 'Suivi rapproché'],
    ['SafetyPlan', "Plan de sécurité / de non-passage à l'acte"],
    ['VoluntaryAdmission', 'Hospitalisation volontaire'],
    ['InvoluntaryAdmission', 'Hospitalisation sous contrainte'],
    ['EmergencyServices', "Appel des secours / des forces de l'ordre"],
]);
export const INVOLUNTARY_HOLDS = list([
    ['No', 'Non'], ['ThirdParty', "Oui : à la demande d'un tiers"], ['Imminent', 'Oui : péril imminent'], ['Authority', "Oui : sur décision de l'autorité"],
]);
// Formulaires de santé mentale (psychiatrie PHMC / PBC, évaluation psychologique PHMC / PBC) : ils portent aussi le contact d'urgence du dossier.
export const MENTAL_HEALTH_VERSIONS = [14, 16, 28, 29];

// ── Protocole d'urgence ──
export const ARRIVAL_MODES = list([
    ['Walk-in', 'À pied / par ses propres moyens'],
    ['PersonalVehicle', 'Véhicule personnel'],
    ['EMS', 'Ambulance / EMS'],
    ['Helicopter', 'Hélicoptère'],
    ['Police', "Amené par les forces de l'ordre"],
    ['Transfer', 'Transfert depuis un autre établissement'],
    ['Other', 'Autre'],
]);
export const DISCHARGE_DESTINATIONS = list([
    ['Home', 'Retour à domicile'],
    ['ObservationBox', 'Box de surveillance'],
    ['RecoveryRoom', 'Salle de réveil'],
    ['OperatingRoom', 'Bloc opératoire'],
    ['Ward', 'Hospitalisation'],
    ['Transfer', 'Transfert vers un autre établissement'],
    ['Death', 'Décès'],
]);
export const ROUTINE_CARE = list([
    ['Tetanus', 'Antitétanique (rappel)'],
    ['TetanusIg', 'Sérum et immunoglobuline antitétaniques'],
    ['Analgesia', 'Antalgie'],
    ['Dressing', 'Pansement / suture'],
    ['Immobilisation', 'Immobilisation'],
    ['Infusion', 'Perfusion'],
    ['Oxygen', 'Oxygénothérapie'],
    ['Antibiotic', 'Antibioprophylaxie'],
    ['None', 'Aucun soin systématique'],
]);

// ── Consultation générale ──
export const ORIENTED_SERVICES = list([
    ['None', 'Aucune orientation (retour à domicile)'],
    ['Emergency', 'Urgences'], ['InternalMedicine', 'Médecine interne'], ['Surgery', 'Chirurgie'], ['IntensiveCare', 'Soins intensifs / réanimation'],
    ['Pediatrics', 'Pédiatrie'], ['Maternity', 'Maternité / gynécologie'], ['Psychiatry', 'Psychiatrie'], ['Cardiology', 'Cardiologie'], ['Geriatrics', 'Gériatrie'],
    ['Imaging', 'Radiologie / imagerie'], ['Physiotherapy', 'Kinésithérapie'], ['Other', 'Autre service'],
]);
export const EXAMS_ORDERED = list([
    ['Xray', 'Radiographie'], ['Ct', 'Scanner'], ['Mri', 'IRM'], ['Ultrasound', 'Échographie'], ['Blood', 'Bilan sanguin'],
    ['Urine', "Analyse d'urine"], ['Ecg', 'ECG'], ['Toxicology', 'Dépistage toxicologique'], ['Other', 'Autre examen'],
]);
