// src/utils/reportAccess.js
//
// Qui peut CONSULTER le rapport d'un autre auteur (via le dossier patient). Même logique que les règles Firebase
// (savedReports/$userKey/$reportKey, voir database.rules.json) : le client s'en sert pour ne pas demander ce que la
// base refuserait, la base reste la vraie protection.
//
//   Soignants        : leurs rapports entre eux (tout sauf les formulaires DMEC) ;
//   DMEC             : leurs rapports entre eux (les formulaires DMEC) ;
//   Rapport public de décès : lisible par TOUT le personnel une fois PUBLIÉ par le DMEC ;
//   Admins           : tout.
// Un rapport dont on est l'auteur se lit toujours (liste « Rapports enregistrés », nœud à son nom).
import { DMEC_FORM_VERSIONS } from './formAccess';
import { familiesOfMember } from '../constants/ranks';

// Rapport Public de Décès : seul formulaire DMEC qui peut devenir lisible par le reste du personnel.
export const PUBLIC_DEATH_VERSION = 37;

// Formulaire dont l'enregistrement, avec un ID patient, déclare le patient décédé et bloque le personnel soignant
// (« Services de Médecine Légale » = le rapport de décès). Une seule constante à modifier pour changer de déclencheur ;
// les règles Firebase, elles, ne regardent que l'existence de patientsDecedes/{ID}.
export const DEATH_LOCK_VERSIONS = [1];

export const isDmecReportVersion = (version) => DMEC_FORM_VERSIONS.includes(Number(version));
export const isPublicDeathVersion = (version) => Number(version) === PUBLIC_DEATH_VERSION;
export const locksPatient = (version) => DEATH_LOCK_VERSIONS.includes(Number(version));

// Familles de lecture d'un membre du personnel : { soignant, dmec } (cumul de rôles = union).
export const readFamiliesOf = (staffProfile) => {
    if (!staffProfile) return { soignant: false, dmec: false };
    const families = familiesOfMember(staffProfile, staffProfile.type);
    return { soignant: families.includes('soignant'), dmec: families.includes('dmec') };
};

// `entry` : { bbCodeVersion, indexKey } (entrée d'index) ; `viewer` : { isAdmin, soignant, dmec } ; `publishedKeys` : Set des clés de
// rapports publics publiés (voir loadPublishedKeys).
export const canViewOthersReport = (entry, viewer, publishedKeys) => {
    if (viewer?.isAdmin) return true;
    const version = entry?.bbCodeVersion;
    if (version === undefined || version === null) return true; // ancien index sans version : la base tranche
    if (isPublicDeathVersion(version) && publishedKeys?.has(entry.indexKey)) return true;
    return isDmecReportVersion(version) ? !!viewer?.dmec : !!viewer?.soignant;
};
