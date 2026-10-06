// src/utils/reportTitle.js
//
// UNE seule façon de fabriquer le titre d'un rapport. Il est utilisé :
//  - pour le « Titre du Formulaire » affiché pendant la saisie (MainApp),
//  - pour le nom du rapport enregistré (saveReport → originalKey), donc ce
//    qu'on voit dans « Rapports enregistrés » et « Dossier Patient »,
//  - pour le bouton « Copier le titre ».
// La fonction est pure et tolérante aux champs vides (le titre s'affiche
// pendant que le formulaire se remplit) ; les validations « champ requis »
// restent dans saveReport.

import { canonicalPatientId } from './patientId';

// Format standard demandé : "[ID-Patient] Nom du formulaire - Date", avec repli
// sur le nom du patient quand l'ID n'est pas renseigné.
export function buildStandardReportKey(formName, patientID, patientName, dateValue) {
    // L'ID est toujours affiché sous sa forme canonique (2752 → PHMC-2752, sans espaces parasites).
    const identifier = canonicalPatientId(patientID) || patientName || null;
    const datePart = dateValue || 'Date inconnue';
    return identifier ? `[${identifier}] ${formName} - ${datePart}` : `${formName} - ${datePart}`;
}

const parseCaseNumber = (url) => {
    if (!url) return '';
    const match = String(url).match(/\d+$/);
    return match ? match[0] : '';
};

const frDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('fr-FR');
};

// Nom lisible du formulaire (sans le préfixe "[Civil]" du sélecteur).
export const cleanFormName = (name, fallbackVersion) =>
    (name || `Formulaire v${fallbackVersion}`).replace(/^\[Civil\]\s*/i, '').trim();

export function buildReportTitle(version, formData = {}, formName = '') {
    const name = cleanFormName(formName, version);
    const f = formData || {};

    switch (version) {
        case 1: // Services de Médecine Légale
            return `[DEATH-REPORT] ${f.decedentOOC || 'N/A'} - ${f.dateTime || 'Date inconnue'}`;
        case 4: // Rapport d'Autopsie
            return `[Autopsy] ${f.decedentName || 'N/A'} (${f.decedentOOC || 'N/A'}) - ${f.autopsyDate || 'Date inconnue'}`;
        case 2: { // Email DMEC
            const who = f.decedentName || f.decedentOOC || 'N/A';
            return `[Email] ${f.requestingOfficer || 'N/A'} re: ${who} - ${new Date().toISOString().split('T')[0]}`;
        }
        case 18: // Agency Feedback
            return `[Feedback] ${f.department || 'N/A'} - ${f.dateTime || 'Date inconnue'}`;
        case 11: { // Rapport de Tuerie/Accident de Masse
            const names = (Array.isArray(f.decedents) ? f.decedents : [])
                .map((d) => d.decedentName).filter(Boolean).join(', ');
            const day = (f.dateTime && String(f.dateTime).split('T')[0]) || 'No Date';
            return `[Mass Fatality Report] - ${names || 'N/A'} - ${day}`;
        }
        case 37: { // Rapport Public de Décès
            const caseNumber = parseCaseNumber(f.deathReportPostId);
            const formattedDate = f.dateOfDeath
                ? new Date(f.dateOfDeath).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase().replace(/,/g, '')
                : 'NO_DATE';
            return `[CASE #${caseNumber}] ${f.decedentName || 'N/A'} (( ${f.decedentOOC || 'N/A'} )) | [${formattedDate}]`;
        }
        case 22:
        case 23: // Notes de Service
            return buildStandardReportKey(name, f.patientID, f.patientName, frDate(f.date));
        case 24: { // Libération médicale
            const patientName = `${f.patientFirstName || ''} ${f.patientLastName || ''}`.trim();
            return buildStandardReportKey(name, f.patientID, patientName, f.SubmitDate || new Date().toISOString().split('T')[0]);
        }
        case 3:
        case 25: // Dossiers médicaux avancé / basique
            return buildStandardReportKey(name, f.patientID, f.patientName, f.patientDateOfBirth);
        case 27: { // Email interne
            const currentDate = new Date().toLocaleDateString('fr-FR');
            return `[Email interne] ${f.internalEmailSubject || 'Sans objet'} - À: ${f.internalEmailRecipient || 'N/A'} - ${currentDate}`;
        }
        case 40: // Formulaire AMA (EMS)
            return buildStandardReportKey(name, f.patientID, f.patientSignature, f.date);
        case 5: case 6: case 7: case 14: case 16: case 19: case 20: case 21:
        case 26: case 28: case 29: case 35: // Formulaires cliniques : le patient d'abord
            // (formData est partagé entre formulaires : un decedentName resté d'un
            // rapport DMEC ne doit pas devenir l'identifiant d'un rapport clinique).
            return buildStandardReportKey(name, f.patientID, f.patientName, f.date || f.dateOfVisit || 'NO_DATE');
        default: {
            // Candidatures (50-55) : pas d'ID patient, on identifie le candidat.
            if (version >= 50 && version <= 55) {
                return `Candidature: ${f.applicantTitleAndFullName || 'Inconnu'}`;
            }
            let identifier = f.decedentName || f.patientName || f.applicantTitleAndFullName || 'Unnamed Report';
            if (Array.isArray(identifier)) identifier = identifier.join(', ');
            const dateField = f.date || f.dateTime || f.autopsyDate || f.dateOfVisit || f.SubmitDate || 'No Date';
            return buildStandardReportKey(name, f.patientID, identifier, dateField);
        }
    }
}
