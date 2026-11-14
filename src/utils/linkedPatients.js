// src/utils/linkedPatients.js
//
// Un rapport du DMEC peut concerner PLUSIEURS personnes (rapport de tuerie / accident de masse : un défunt par fiche ; courriel DMEC : le défunt, puis d'autres ID ajoutés).
// Chaque personne enregistrée a son ID patient (réel, ou temporaire TMP-…) : le titre du rapport est la suite de ces ID, et le rapport est indexé dans le dossier de CHACUNE.
//
//   linkedPatientIds(version, data) → ['PHMC-2752', 'TMP-AB12C', …]   (canoniques, sans doublon, dans l'ordre de saisie ; le premier est l'ID « principal »)
//
// Les autres formulaires n'ont qu'un ID patient : la liste ne contient que lui.
import { canonicalPatientId } from './patientId';

export const MASS_FATALITY_VERSION = 11;
export const DMEC_EMAIL_VERSION = 2;

const unique = (ids) => [...new Set(ids.map((id) => canonicalPatientId(id)).filter(Boolean))];

export const linkedPatientIds = (version, data) => {
    const f = data || {};
    switch (Number(version)) {
        case MASS_FATALITY_VERSION:
            return unique((Array.isArray(f.decedents) ? f.decedents : []).map((decedent) => decedent && decedent.patientID));
        case DMEC_EMAIL_VERSION:
            return unique([f.patientID, ...(Array.isArray(f.additionalPatientIDs) ? f.additionalPatientIDs : [])]);
        default:
            return unique([f.patientID]);
    }
};

// Formulaires qui portent plusieurs ID patient (la saisie, le titre et l'indexation passent par la liste).
export const hasSeveralPatients = (version) => [MASS_FATALITY_VERSION, DMEC_EMAIL_VERSION].includes(Number(version));

// Identifiant du titre : les ID de toutes les personnes, séparés par des virgules (« PHMC-2752, TMP-AB12C »).
export const patientIdsLabel = (ids) => (Array.isArray(ids) ? ids : []).join(', ');
