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
    generateSicknessEmail
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
            const displayName = position.displayName || position.name || key;
            const status = position.status || 'N/A';
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
    { version: 3, name: "[Civil] Dossier Médical Avancé", group: "PHMC", icon: Civilian, generator: generateAdvancedPatientFile, FieldComponent: PatientAdvanced, titleKey: "dossierMedicalAvance", sortOrder: 3, hasCustomTitle: true, isHiddenInSelector: true, titleGenerator: (formData) => `[INFORMATIONS MÉDICALES AVANCÉES] -  ${formData.patientName || 'N/A'}`, userTypes: ['civilian', 'other'], primaryFor: ['civilian'] },
    { version: 24, name: "[Civil] Formulaire de Libération Médicale", group: "PHMC", icon: Civilian, generator: generateMedicalRecordRelease, FieldComponent: MedicalRelease, titleKey: "liberationMedicale", sortOrder: 1, hasCustomTitle: true, titleGenerator: (formData) => `[REQUÊTE DE LIBÉRATION MÉDICALE] ${formData.patientFirstName || ''} ${formData.patientLastName || ''} `.trim(), userTypes: ['civilian', 'other'], primaryFor: ['civilian'] },
    { version: 25, name: "[Civil] Dossier Médical Basique", group: "PHMC", icon: Civilian, generator: generateBasicPatientFile, FieldComponent: BasicPatientFile, titleKey: "dossierMedicalBasique", sortOrder: 2, hasCustomTitle: true, titleGenerator: (formData) => `[INFORMATIONS MÉDICALES BASIQUES] -  ${formData.patientName || 'N/A'}`, userTypes: ['civilian', 'other'], primaryFor: ['civilian'] },
    { version: 26, name: "[Civil] Mise à Jour du Dossier Médical", group: "PHMC", icon: Civilian, generator: generateMedicalFileUpdate, FieldComponent: MedicalUpdate, titleKey: "miseAJourDossierMedical", sortOrder: 2, hasCustomTitle: true, isHiddenInSelector: true, titleGenerator: (formData) => `[MISE À JOUR DES INFORMATIONS MÉDICALES] -  ${formData.patientName || 'N/A'}`, userTypes: ['civilian', 'other'], primaryFor: ['civilian'] },
    // PHMC-FR Tools (Forensic Services next, then others)
    { version: 1, name: "Services de Médecine Légale", group: "PHMC", icon: folder, generator: generateDeathReport, FieldComponent: DeathReport, titleKey: "servicesDeMedecineLegale", sortOrder: 10, hasCustomTitle: true, titleGenerator: (formData) => { const { typeOfDeath,decedentName,decedentOOC, dateTime } = formData; const date = dateTime ? new Date(dateTime).toLocaleDateString('fr-FR') : 'N/A'; return `[${typeOfDeath || 'N/A'}] ${decedentName || 'N/A'} ((${decedentOOC || 'N/A'})) - ${date}`; }, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'] },
    { version: 4, name: "Rapport d'Autopsie", group: "PHMC", icon: autopsy /* Placeholder */, generator: generateAutopsy, FieldComponent: Autopsy, titleKey: "rapportAutopsie", sortOrder: 11, isHiddenInSelector: true, hasCustomTitle: true, titleGenerator: (formData) => { const {decedentName,decedentOOC } = formData; return `DOSSIER ## ${decedentName || 'N/A'} ((${decedentOOC || 'N/A'})) | ENVOYÉ/TERMINÉ/EN_ATTENTE`; }, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'] },
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
        hasCustomTitle: true,
        titleGenerator: (formData) => {
            const {decedentName,decedentOOC, paperworkType } = formData;
            if (paperworkType && paperworkType.toLowerCase().includes('mass fatality')) {
                return `Rapport DMEC - ${decedentName || 'N/A'} | (Tuerie/Accident de Masse)`;
            }

            const names = (decedentName || '').split(', ').filter(Boolean);
            const oocNames = (decedentOOC || '').split(', ').filter(Boolean);

            let combinedNames = [];
            for (let i = 0; i < names.length; i++) {
                const name = names[i];
                const ooc = oocNames[i] ? `((${oocNames[i]}))` : '';
                combinedNames.push(`${name} ${ooc}`.trim());
            }

            if (combinedNames.length > 0) {
                return `Rapport DMEC - ${combinedNames.join(', ')}`;
            }

            return `Rapport DMEC - N/A`;
        },
        userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner']
    },
    { version: 8, name: "Certificat de Décès", group: "PHMC", icon: deathCertificate, generator: generateCertificate, FieldComponent: Certificate, titleKey: "certificateOfDeath", sortOrder: 13, isHiddenInSelector: true, hasCustomTitle: true, titleGenerator: (formData) => `[CERTIFICAT DE DÉCÈS] -  ${formData.decedentOOC || 'N/A'}`, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'] },
    { version: 5, name: "Opération Chirurgicale", group: "PHMC", icon: surgeon, generator: generateSurgicalOps, FieldComponent: Surgical, titleKey: "operationChirurgicale", sortOrder: 20, titleGenerator: (formData) => `Opération Chirurgicale: ${formData.patientName || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 6, name: "Évaluation Physique", group: "PHMC", icon: nurse, generator: generatePhysEvalInternalMed, FieldComponent: PhysEval, titleKey: "evaluationPhysique", sortOrder: 21, titleGenerator: (formData) => `Évaluation Physique: ${formData.patientName || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 11, name: "Rapport de Tuerie/Accident de Masse", group: "PHMC", icon: graveyard, generator: generateMassFatality, FieldComponent: MassFatality, titleKey: "tuerieAccidentDeMasse", sortOrder: 14, isHiddenInSelector: true, hasCustomTitle: true, titleGenerator: (formData) => { const { decedents, dateTime } = formData; let date = 'Aucune Date'; if (dateTime) { const datePart = dateTime.split('T')[0]; const [year, month, day] = datePart.split('-'); date = `${month}/${day}/${year}`; } if (decedents && decedents.length > 0) { const decedentNames = decedents.map(d => d.decedentName).filter(name => name).join(', '); return `[TUERIE/ACCIDENT DE MASSE] - ${decedentNames || 'N/A'} - ${date}`; } return `[TUERIE/ACCIDENT DE MASSE] - N/A - ${date}`; }, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'] },
    // Add isHiddenInSelector: true to the PBC version
    { version: 7, name: "Évaluation Physique (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePhysEvalInternalMedPBC, FieldComponent: PhysEval, titleKey: "evaluationPhysiquePBC", sortOrder: 22, isHiddenInSelector: true, titleGenerator: (formData) => `Évaluation Physique: ${formData.patientName || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 14, name: "Consultation psychiatrique", group: "PHMC", icon: psychology, generator: generateMentalHealthPHMC, FieldComponent: MentalHealth, titleKey: "consultationPsychiatrique", sortOrder: 23, hasCustomTitle: true, titleGenerator: (formData) => { const date = formData.dateTime ? new Date(formData.date).toLocaleDateString('fr-FR') : 'N/A'; return `Consultation Psychiatrique: ${formData.patientID || 'Inconnu'} - ${date}`; }, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    // Add isHiddenInSelector: true to the PBC version
    { version: 16, name: "Consultation psychiatrique (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateMentalHealthPBC, FieldComponent: MentalHealth, titleKey: "consultationPsychiatriquePBC", sortOrder: 24, isHiddenInSelector: true, hasCustomTitle: true, titleGenerator: (formData) => { const date = formData.patientID ? new Date(formData.date).toLocaleDateString('fr-FR') : 'N/A'; return `Consultation Psychiatrique: ${formData.patientName || 'Inconnu'} - ${date}`; }, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 19, name: "Protocole d'Urgence", group: "PHMC", icon: emergency, generator: generateEmergencyProtocol, FieldComponent: EmergencyForm, titleKey: "protocoleUrgence", sortOrder: 25, titleGenerator: (formData) => `Protocole d'Urgence: ${formData.patientName || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 20, name: "Consultation Générale", group: "PHMC", icon: empathy, generator: generateConsultationNotesPHMC, FieldComponent: GeneralConsult, titleKey: "consultationGeneralePHMC", sortOrder: 26, titleGenerator: (formData) => `Consultation Générale: ${formData.patientName || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    // Add isHiddenInSelector: true to the PBC version
    { version: 21, name: "Consultation Générale (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateConsultationNotesPBC, FieldComponent: GeneralConsult, titleKey: "consultationGeneraletPBC", sortOrder: 27, isHiddenInSelector: true, titleGenerator: (formData) => `Consultation Générale: ${formData.patientName || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 22, name: "Note de Service", group: "PHMC", icon: paperwork, generator: generateCommentaryNotePHMC, FieldComponent: CommNotePHMC, titleKey: "noteServicePHMC", sortOrder: 28, titleGenerator: (formData) => `Note de Service: ${formData.patientName || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    // Add isHiddenInSelector: true to the PBC version
    { version: 23, name: "Note de Service (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateCommentaryNotePBC, FieldComponent: CommNotePBC, titleKey: "noteServicePBC", sortOrder: 29, isHiddenInSelector: true, titleGenerator: (formData) => `Note de Service: ${formData.patientName || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 27, name: "PHMC Email Interne", group: "PHMC", icon: emailIcon, generator: generateEmailPHMCEmail, FieldComponent: EmailInternal, titleKey: "phmcEmailInterne", sortOrder: 30, titleGenerator: (formData) => `Email Interne: ${formData.subject || 'Aucun Sujet'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 28, name: "Évaluation Psychologique", group: "PHMC", icon: psychology, generator: generatePsychEvalPHMC, FieldComponent: Shrink, titleKey: "evaluationPsychologiquePHMC", sortOrder: 31, titleGenerator: (formData) => `Évaluation Psychologique: ${formData.patientName || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    // Add isHiddenInSelector: true to the PBC version
    { version: 29, name: "Évaluation Psychologique (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePsychEvalPBC, FieldComponent: Shrink, titleKey: "evaluationPsychologiquePBC", sortOrder: 32, isHiddenInSelector: true, titleGenerator: (formData) => `Évaluation Psychologique: ${formData.patientName || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] },
    { version: 35, name: "Certificat de Maladie", group: "PHMC", icon: emailIcon, generator: generateSicknessEmail, FieldComponent: SicknessEmail, titleKey: "certificatMaladie", sortOrder: 33, isHiddenInSelector: true, titleGenerator: (formData) => `Certificat de Maladie: ${formData.phmcEmployee || 'Inconnu'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'] }, // No FieldComponent for this one
    {
        version: 50,
        name: "Carrières Médicales",
        group: "PHMC Recruitment",
        icon: application,
        generator: generatePhysician,
        FieldComponent: PhysicianFields,
        titleKey: "phmcCarrieresMedicales",
        sortOrder: 200,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Candidature: ${formData.characterName || 'Inconnu'}`,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 51,
        name: "Carrières Psychologue/Psychiatre",
        group: "PHMC Recruitment",
        icon: application,
        generator: generatePsych,
        FieldComponent: PsychFields,
        titleKey: "phmcCarrieresPsychologue",
        sortOrder: 201,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Candidature: ${formData.characterName || 'Inconnu'}`,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 52,
        name: "Carrières Administration",
        group: "PHMC Recruitment",
        icon: application,
        generator: admin,
        FieldComponent: AdminFields,
        titleKey: "phmcCarrieresAdministration",
        sortOrder: 202,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Candidature: ${formData.characterName || 'Inconnu'}`,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 53,
        name: "Carrières Infirmières",
        group: "PHMC Recruitment",
        icon: application,
        generator: nursing,
        FieldComponent: NursingFields,
        titleKey: "phmcCarrieresInfirmieres",
        sortOrder: 203,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Candidature: ${formData.characterName || 'Inconnu'}`,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 54,
        name: "Carrières DMEC",
        group: "PHMC Recruitment",
        icon: application,
        generator: generateCoroner,
        FieldComponent: Coroner,
        titleKey: "phmcCarrieresDMEC",
        sortOrder: 204,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Candidature: ${formData.characterName || 'Inconnu'}`,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment']
    },
    {
        version: 55,
        name: "Carrières EMS",
        group: "PHMC Recruitment",
        icon: application,
        generator: generateEMS,
        FieldComponent: Ems,
        titleKey: "phmcCarrieresEMS",
        sortOrder: 205,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Candidature: ${formData.characterName || 'Inconnu'}`,
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
        hasCustomTitle: true,
        isHiddenInSelector: true,
        
        titleGenerator: (formData) => {
            const { caseNumber, decedentName, decedentOOC, dateOfDeath } = formData;
            const currentYear = new Date().getFullYear();

            let formattedDate = 'N/A';
            if (dateOfDeath) {
                const date = new Date(dateOfDeath + 'T00:00:00');
                const monthNames = ["JAN", "FEV", "MAR", "AVR", "MAI", "JUN", "JUI", "AUT", "SEP", "OCT", "NOV", "DEC"];
                const month = monthNames[date.getMonth()];
                const day = String(date.getDate()).padStart(2, '0');
                const year = date.getFullYear();
                formattedDate = `${month}-${day}-${year}`;
            }

            const name = decedentName || (formData.deathRecordType === 'Non identifié' ? 'JANE/JOHN DOE' : 'JOHN/JANE DOE');
            return `[DOSSIER #${currentYear}-${caseNumber || '(( RAPPORT DE DÉCÈS POST ID ))'}] ${name} ((${decedentOOC || 'NOM HORS JEU'})) | [${formattedDate}]`;
        },
        userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner']
    }
];

// Helper to get form definition by version
export const getFormDefinition = (version) => formDefinitions.find(form => form.version === version);

// Helper to filter forms by user type
export const getFormsByUserType = (userType) => {
    return formDefinitions.filter(form => 
        !form.userTypes || form.userTypes.includes(userType)
    );
};

// Helper to get primary forms for a user type
export const getPrimaryFormsForUserType = (userType) => {
    return formDefinitions.filter(form => 
        form.primaryFor && form.primaryFor.includes(userType)
    );
};

// Helper to get forms by group and user type
export const getFormsByGroupAndUserType = (group, userType) => {
    return formDefinitions.filter(form => 
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
