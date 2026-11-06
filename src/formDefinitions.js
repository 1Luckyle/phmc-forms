// src/formDefinitions.js
import React, { lazy } from 'react';

// Lazy load form field components
// Admin component can be loaded normally as it's a distinct route/view
import AdminAuthAndActions from './components/Admin/AdminAuthAndActions';

// Import generators normally as they are not components
import {
    generateDeathReport, generateEmail, generateSurgicalOps, generateAdvancedPatientFile,
    generatePhysEvalInternalMed, generatePhysEvalInternalMedPBC, generateMentalHealthPHMC,
    generateMentalHealthPBC, generateConsultationNotesPHMC,
    generateEmergencyProtocol, generateCommentaryNotePHMC, generateCommentaryNotePBC,
    generateMedicalRecordRelease, generateBasicPatientFile, generateEmailPHMCEmail,
    generateConsultationNotesPBC, generatePsychEvalPHMC, generatePsychEvalPBC,
    generateAutopsy, generateCertificate, generateMedicalFileUpdate, generateMassFatality, generateDeathRecord,
    generateSicknessEmail, generateFlightCertificate
} from './phmc-bbcode-generators';
import generatePhysician from './phmc-recruitment-generators/generatePhysician';
import generatePsych from './phmc-recruitment-generators/generatePsych';
import admin from './phmc-recruitment-generators/generateAdmin';
import nursing from './phmc-recruitment-generators/generateNursing';
import generateCoroner from './phmc-recruitment-generators/generateCoroner';
import generateEMS from './phmc-recruitment-generators/generateEMS';

// Import your icons
import corpse from './assets/corpse.png';
import folder from './assets/folder.png';
import autopsy from './assets/autopsy.png';
import deathCertificate from './assets/death-certificate.png';
import graveyard from './assets/graveyard.png';
import conference from './assets/conference.png';
import emailIcon from './assets/email.png';
import Civilian from './assets/Civilian.png';
import phmcpaletobay from './assets/phmcpaletobaylogo.png';
import surgeon from './assets/surgeon.png';
import nurse from './assets/nurse.png';
import emergency from './assets/emergency.png';
import empathy from './assets/empathy.png';
import paperwork from './assets/paperwork.png';
import psychology from './assets/psychology.png';
import application from './assets/application.png'; // Assuming this is for SAAA or generic
const CommNotePHMC = lazy(() => import('./phmc-field-data/CommNotePHMC'));
const CommNotePBC = lazy(() => import('./phmc-field-data/CommNotePBC'));
const DeathReport = lazy(() => import('./phmc-field-data/deathReport'));
const CoronerEmail = lazy(() => import('./phmc-field-data/CoronerEmail'));
const PatientAdvanced = lazy(() => import('./phmc-field-data/PatientAdvanced'));
const MentalHealth = lazy(() => import('./phmc-field-data/MentalHealth'));
const EmailInternal = lazy(() => import('./phmc-field-data/EmailInternal'));
const Surgical = lazy(() => import('./phmc-field-data/Surgical'));
const PhysEval = lazy(() => import('./phmc-field-data/PhysEvalPHMC'));
const EmergencyForm = lazy(() => import('./phmc-field-data/EmergencyForm'));
const GeneralConsult = lazy(() => import('./phmc-field-data/GeneralConsult'));
const MedicalRelease = lazy(() => import('./phmc-field-data/MedicalRelease'));
const BasicPatientFile = lazy(() => import('./phmc-field-data/BasicPatientFile'));
const Shrink = lazy(() => import('./phmc-field-data/Shrink'));
const Autopsy = lazy(() => import('./phmc-field-data/Autopsy'));
const Certificate = lazy(() => import('./phmc-field-data/Certificate'));
const MedicalUpdate = lazy(() => import('./phmc-field-data/MedicalUpdate'));
const MassFatality = lazy(() => import('./phmc-field-data/MassFatality'));
const DeathRecord = lazy(() => import('./phmc-field-data/DeathRecord'));
const SicknessEmail = lazy(() => import('./phmc-field-data/SicknessEmail'));
const FlightCertificate = lazy(() => import('./phmc-field-data/FlightCertificate'));

// Lazy load recruitment field components
const PhysicianFields = lazy(() => import('./phmc-civilian-fields/Physician'));
const PsychFields = lazy(() => import('./phmc-civilian-fields/Psych'));
const AdminFields = lazy(() => import('./phmc-civilian-fields/Admin'));
const NursingFields = lazy(() => import('./phmc-civilian-fields/Nursing'));
const Coroner = lazy(() => import('./phmc-civilian-fields/Coroner'));
const Ems = lazy(() => import('./phmc-civilian-fields/Ems'));


export const generateAdminView = (viewData) => {
    if (!viewData.isAdminAuthenticated) {
        return "Veuillez vous connecter à l'aide des champs du formulaire pour accéder aux commandes d'administration..";
    }

    const categoryName = viewData.adminSelectedCategoryName || 'Catégorie sélectionnée';
    // Simplified title, and we'll add a newline before the statuses if they exist.
    let adminContent = `[b]Statuts de recrutement pour ${categoryName} :[/b]\n`;

    if (viewData.adminDisplayData && typeof viewData.adminDisplayData === 'object' && Object.keys(viewData.adminDisplayData).length > 0) {
        const statusEntries = Object.entries(viewData.adminDisplayData).map(([key, position]) => {
            const displayName = position.nom || position.displayName || position.name || key;
            // adminDisplayData est normalisé en français (statut OUVERT / FERMÉ) ; ancien format toléré.
            const status = position.statut || (position.status === 'OPEN' ? 'OUVERT' : position.status === 'CLOSED' ? 'FERMÉ' : 'N/A');
            const statusColor = status === "OUVERT" ? "green" : "red";
            // Format each position and its status, using color for visual cue
            return `${displayName}: [color=${statusColor}]${status}[/color]`;
        });

        // Join the statuses with a separator for a more compact, single-line display if possible.
        // If you prefer a list for many items, we can revert to `[list]` and `[*] `.
        adminContent += statusEntries.join(' | ');

    } else if (viewData.adminDisplayData === null && viewData.adminSelectedCategoryName) {
        adminContent += `Données pour ${categoryName} non trouvées ou échec du chargement.`;
    }
    else if (viewData.adminSelectedCategoryName) {
        // This case might occur briefly while data is loading after category selection
        adminContent += `Chargement des données pour ${categoryName}...`;
    }
    else if (viewData.isAdminAuthenticated && !viewData.adminSelectedCategoryName) {
        adminContent += "Veuillez sélectionner une catégorie de recrutement dans le panneau pour afficher les statuts.";
    }
    else {
        adminContent += "Aucune donnée de recrutement à afficher. Veuillez sélectionner une catégorie ou vérifier les journaux si les problèmes persistent.";
    }
    // No need for an extra newline if join is used, as it doesn't end with one.
    // If using a list, ensure [list]...[/list] structure.
    return adminContent;
};

export const formDefinitions = [
    // Civilian Forms First
    { version: 3, name: "[Civil] Dossier Médical Avancé", group: "PHMC", icon: Civilian, generator: generateAdvancedPatientFile, FieldComponent: PatientAdvanced, titleKey: "dossierMedicalAvance", sortOrder: 3, isHiddenInSelector: true, userTypes: ['civilian', 'phmcStaff', 'adminStaff', 'coroner', 'recruitment', 'other'], primaryFor: ['civilian'] },
    { version: 24, name: "[Civil] Formulaire de Libération Médicale", group: "PHMC", icon: Civilian, generator: generateMedicalRecordRelease, FieldComponent: MedicalRelease, titleKey: "liberationMedicale", sortOrder: 1, userTypes: ['civilian', 'phmcStaff', 'adminStaff', 'coroner', 'recruitment', 'other'], primaryFor: ['civilian'] },
    { version: 25, name: "[Civil] Dossier Médical Basique", group: "PHMC", icon: Civilian, generator: generateBasicPatientFile, FieldComponent: BasicPatientFile, titleKey: "dossierMedicalBasique", sortOrder: 2, userTypes: ['civilian', 'phmcStaff', 'adminStaff', 'coroner', 'recruitment', 'other'], primaryFor: ['civilian'] },
    { version: 26, name: "[Civil] Mise à Jour du Dossier Médical", group: "PHMC", icon: Civilian, generator: generateMedicalFileUpdate, FieldComponent: MedicalUpdate, titleKey: "miseAJourDossierMedical", sortOrder: 2, isHiddenInSelector: true, userTypes: ['civilian', 'phmcStaff', 'adminStaff', 'coroner', 'recruitment', 'other'], primaryFor: ['civilian'] },
    // PHMC-FR Tools (Forensic Services next, then others)
    { version: 1, name: "Services de Médecine Légale", group: "PHMC", icon: folder, generator: generateDeathReport, FieldComponent: DeathReport, titleKey: "servicesDeMedecineLegale", sortOrder: 10, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'] },
    { version: 4, name: "Rapport d'Autopsie", group: "PHMC", icon: autopsy /* Placeholder */, generator: generateAutopsy, FieldComponent: Autopsy, titleKey: "rapportAutopsie", sortOrder: 11, isHiddenInSelector: true, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'] },
    {
        version: 2,
        name: "Email DMEC",
        group: "PHMC",
        icon: emailIcon,
        generator: generateEmail,
        FieldComponent: CoronerEmail,
        titleKey: "DMECEmail",
        sortOrder: 12,
        isHiddenInSelector: true,
userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner']
    },
    { version: 8, name: "Certificat de Décès", group: "PHMC", icon: deathCertificate, generator: generateCertificate, FieldComponent: Certificate, titleKey: "certificateOfDeath", sortOrder: 13, isHiddenInSelector: true, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'] },
    { version: 5, name: "Opération Chirurgicale", group: "PHMC", icon: surgeon, generator: generateSurgicalOps, FieldComponent: Surgical, titleKey: "operationChirurgicale", sortOrder: 20, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },    { version: 6, name: "Évaluation Physique", group: "PHMC", icon: nurse, generator: generatePhysEvalInternalMed, FieldComponent: PhysEval, titleKey: "evaluationPhysique", sortOrder: 21, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 11, name: "Rapport de Tuerie/Accident de Masse", group: "PHMC", icon: graveyard, generator: generateMassFatality, FieldComponent: MassFatality, titleKey: "tuerieAccidentDeMasse", sortOrder: 14, isHiddenInSelector: true, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'] },
    // Add isHiddenInSelector: true to the PBC version
    { version: 7, name: "Évaluation Physique (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePhysEvalInternalMedPBC, FieldComponent: PhysEval, titleKey: "evaluationPhysiquePBC", sortOrder: 22, isHiddenInSelector: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 14, name: "Consultation psychiatrique", group: "PHMC", icon: psychology, generator: generateMentalHealthPHMC, FieldComponent: MentalHealth, titleKey: "consultationPsychiatrique", sortOrder: 23, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    // Add isHiddenInSelector: true to the PBC version
    { version: 16, name: "Consultation psychiatrique (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateMentalHealthPBC, FieldComponent: MentalHealth, titleKey: "consultationPsychiatriquePBC", sortOrder: 24, isHiddenInSelector: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 19, name: "Protocole d'Urgence", group: "PHMC", icon: emergency, generator: generateEmergencyProtocol, FieldComponent: EmergencyForm, titleKey: "protocoleUrgence", sortOrder: 25, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 20, name: "Consultation Générale", group: "PHMC", icon: empathy, generator: generateConsultationNotesPHMC, FieldComponent: GeneralConsult, titleKey: "consultationGeneralePHMC", sortOrder: 26, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    // Add isHiddenInSelector: true to the PBC version
    { version: 21, name: "Consultation Générale (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateConsultationNotesPBC, FieldComponent: GeneralConsult, titleKey: "consultationGeneraletPBC", sortOrder: 27, isHiddenInSelector: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 22, name: "Note de Service", group: "PHMC", icon: paperwork, generator: generateCommentaryNotePHMC, FieldComponent: CommNotePHMC, titleKey: "noteServicePHMC", sortOrder: 28, userTypes: ['phmcStaff', 'adminStaff', 'coroner', 'other'], primaryFor: ['phmcStaff'] },
    // Add isHiddenInSelector: true to the PBC version
    { version: 23, name: "Note de Service (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateCommentaryNotePBC, FieldComponent: CommNotePBC, titleKey: "noteServicePBC", sortOrder: 29, isHiddenInSelector: true, userTypes: ['phmcStaff', 'adminStaff', 'coroner', 'other'], primaryFor: ['phmcStaff'] },
    { version: 27, name: "PHMC Email Interne", group: "PHMC", icon: emailIcon, generator: generateEmailPHMCEmail, FieldComponent: EmailInternal, titleKey: "phmcEmailInterne", sortOrder: 30, userTypes: ['phmcStaff', 'adminStaff', 'coroner', 'other'], primaryFor: ['phmcStaff'],
        // RETIRÉ : fusionné dans la Messagerie interne (boîte à outils). La définition reste pour ouvrir, copier et exporter les anciens rapports de ce formulaire,
        // mais il n'est plus proposé dans les sélecteurs de formulaires (voir les filtres « retired »).
        retired: true },
    { version: 28, name: "Évaluation Psychologique", group: "PHMC", icon: psychology, generator: generatePsychEvalPHMC, FieldComponent: Shrink, titleKey: "evaluationPsychologiquePHMC", sortOrder: 31, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    // Add isHiddenInSelector: true to the PBC version
    { version: 29, name: "Évaluation Psychologique (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePsychEvalPBC, FieldComponent: Shrink, titleKey: "evaluationPsychologiquePBC", sortOrder: 32, isHiddenInSelector: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 35, name: "Certificat de Maladie", group: "PHMC", icon: emailIcon, generator: generateSicknessEmail, FieldComponent: SicknessEmail, titleKey: "certificatMaladie", sortOrder: 33, isHiddenInSelector: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] }, // No FieldComponent for this one
    // Certificat d'aptitude médicale au vol : réservé au personnel soignant (utils/formAccess.js : tout formulaire non listé = famille soignante + admins).
    { version: 41, name: "Certificat de Vol", group: "PHMC", icon: paperwork, generator: generateFlightCertificate, FieldComponent: FlightCertificate, titleKey: "certificatVol", sortOrder: 34, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    {
        version: 50,
        name: "Postes Médicaux",
        group: "PHMC Recruitment",
        icon: application,
        generator: generatePhysician,
        FieldComponent: PhysicianFields,
        titleKey: "phmcCarrieresMedicales",
        sortOrder: 200,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 51,
        name: "Postes Psychologue/Psychiatre",
        group: "PHMC Recruitment",
        icon: application,
        generator: generatePsych,
        FieldComponent: PsychFields,
        titleKey: "phmcCarrieresPsychologue",
        sortOrder: 201,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 52,
        name: "Postes Administratifs",
        group: "PHMC Recruitment",
        icon: application,
        generator: admin,
        FieldComponent: AdminFields,
        titleKey: "phmcCarrieresAdministration",
        sortOrder: 202,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 53,
        name: "Postes Infirmiers",
        group: "PHMC Recruitment",
        icon: application,
        generator: nursing,
        FieldComponent: NursingFields,
        titleKey: "phmcCarrieresInfirmieres",
        sortOrder: 203,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 54,
        name: "Postes DMEC",
        group: "PHMC Recruitment",
        icon: application,
        generator: generateCoroner,
        FieldComponent: Coroner,
        titleKey: "phmcCarrieresDMEC",
        sortOrder: 204,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 55,
        name: "Postes EMS",
        group: "PHMC Recruitment",
        icon: application,
        generator: generateEMS,
        FieldComponent: Ems,
        titleKey: "phmcCarrieresEMS",
        sortOrder: 205,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 999,
        name: "Panneau de Contrôle Admin",
        group: "Admin",
        icon: application,
        FieldComponent: AdminAuthAndActions,
        generator: generateAdminView,
        titleKey: "adminPanneauDeControle",
        sortOrder: 999,
        titleGenerator: () => 'Panneau de Contrôle Admin',
        userTypes: ['other'], primaryFor: ['other']
    },
    {
        version: 37, 
        name: "Rapport Public de Décès",
        group: "PHMC",
        icon: conference,
        generator: generateDeathRecord,
        FieldComponent: DeathRecord,
        titleKey: "rapportPublicDeDeces",
        sortOrder: 15,
        isHiddenInSelector: true,
        
userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner']
    }
];

// Helper to get form definition by version
export const getFormDefinition = (version) => formDefinitions.find(form => form.version === version);

// Formulaires enregistrés qui ne figurent pas dans le sélecteur (ils ont leur propre fenêtre) : sans cette table ils s'afficheraient « Formulaire 40 ».
const SPECIAL_FORM_NAMES = { 40: 'EMS Contre Avis Médical (AMA)' };
// Nom à afficher pour une version enregistrée : le formulaire du catalogue, sinon un nom spécial, sinon un libellé d'ancien formulaire.
export const getFormLabel = (version) => getFormDefinition(version)?.name || SPECIAL_FORM_NAMES[version] || (version != null ? `Ancien formulaire (n° ${version})` : 'Autre');

// Helper to filter forms by user type
export const getFormsByUserType = (userType) => {
    return formDefinitions.filter(form => 
        !form.userTypes || form.userTypes.includes(userType)
    );
};

// Helper to get primary forms for a user type
export const getPrimaryFormsForUserType = (userType) => {
    return formDefinitions.filter(form =>
        !form.retired && form.primaryFor && form.primaryFor.includes(userType)
    );
};

// Helper to get forms by group and user type
export const getFormsByGroupAndUserType = (group, userType) => {
    return formDefinitions.filter(form =>
        !form.retired &&
        form.group === group &&
        (!form.userTypes || form.userTypes.includes(userType))
    );
};

// Helper to generate versionNames map for display (if still needed elsewhere, or can be derived from formDefinitions)
export const generateVersionNames = () => {
    const names = {};
    formDefinitions.forEach(form => {
        names[form.version] = form.name;
    });
    return names;
};
