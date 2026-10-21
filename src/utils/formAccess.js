// src/utils/formAccess.js
//
// Accès aux FORMULAIRES selon le rôle du personnel (famille(s) de la fiche), en un seul endroit :
// sélecteurs de formulaires, fenêtres de choix rapide, garde du formulaire courant et matrice du mode
// « visualiser en tant que » s'appuient tous sur ces fonctions (module volontairement sans dépendance lourde :
// le hook React est dans hooks/useFormAccess.js).
//
//   Admin                          tout ;
//   PHMC Soignant                  tout SAUF les formulaires DMEC ;
//   DMEC                           les formulaires DMEC + Note de Service + PHMC Email Interne ;
//   PHMC Polyvalent / Administration & Direction (recruteurs compris)
//                                  Note de Service + PHMC Email Interne uniquement ;
//   cumul de rôles                 l'UNION des accès de chacune des familles de la personne ;
//   Civil / candidat               inchangé : ses dossiers médicaux et ses candidatures (voir AgencySelector) ;
//   visiteur non connecté          inchangé : pas de restriction.
import { familiesOfMember } from '../constants/ranks';

// Formulaires de médecine légale (DMEC) : Services de Médecine Légale, Rapport d'Autopsie, Email DMEC,
// Certificat de Décès, Rapport de Tuerie/Accident de Masse, Rapport Public de Décès.
export const DMEC_FORM_VERSIONS = [1, 4, 2, 8, 11, 37];

// Formulaires communs à tout le personnel : Note de Service (+ version PBC) et PHMC Email Interne.
export const SHARED_STAFF_FORM_VERSIONS = [22, 23, 27];

// Panneau de contrôle admin (connexion admin) : réservé à la famille soignante (en plus des admins).
const ADMIN_PANEL_VERSION = 999;

// Dossiers médicaux Civils et candidatures : réservés aux comptes Civils (voir AgencySelector).
export const CIVILIAN_ALLOWED_VERSIONS = [3, 24, 25, 26, 50, 51, 52, 53, 54, 55];

// Accès d'une identité : { kind: 'all' | 'civil' | 'restricted', families, canAccess(version) }.
export const getFormAccess = ({ isAdmin, isCivilian, staffProfile }) => {
    if (isAdmin) return { kind: 'all', canAccess: () => true };
    if (isCivilian) return { kind: 'civil', canAccess: (version) => CIVILIAN_ALLOWED_VERSIONS.includes(version) };
    if (!staffProfile) return { kind: 'all', canAccess: () => true }; // visiteur : pas de restriction

    const families = familiesOfMember(staffProfile, staffProfile.type);
    const isCare = families.includes('soignant');
    const isDmec = families.includes('dmec');
    const canAccess = (version) => {
        if (SHARED_STAFF_FORM_VERSIONS.includes(version)) return true;           // toute la famille du personnel
        if (DMEC_FORM_VERSIONS.includes(version)) return isDmec;                // DMEC : ses formulaires
        if (version === ADMIN_PANEL_VERSION) return isCare;
        return isCare;                                                          // reste des formulaires PHMC : soignant
    };
    return { kind: 'restricted', families, canAccess };
};

export const canAccessForm = (access, version) => access.canAccess(version);

// Résumé pour la matrice des permissions : quelles grandes familles de formulaires sont ouvertes.
export const summarizeFormAccess = (access) => ({
    formsMedical: access.kind !== 'civil' && access.canAccess(20),   // ex. Consultation Générale
    formsDmec: access.kind !== 'civil' && access.canAccess(1),       // services de médecine légale
    formsShared: access.kind !== 'civil' && access.canAccess(27),    // Note de Service + Email Interne
    formsCivilian: access.canAccess(3),
});
