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
    const datePart = frDay(dateValue) || 'Date inconnue';
    return identifier ? `[${identifier}] ${formName} - ${datePart}` : `${formName} - ${datePart}`;
}

const pad2 = (number) => String(number).padStart(2, '0');

// Date du jour, JJ/MM/AAAA (heure locale : toISOString() donnait la date UTC, parfois la veille ou le lendemain).
export const todayFr = () => { const now = new Date(); return `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`; };

// UN SEUL format de date dans les titres : JJ/MM/AAAA (+ « HH:MM » si l'heure est connue). Lecture par les chiffres de la date saisie, sans passer par
// un objet Date (le fuseau horaire décalait parfois le jour). Une valeur qui n'est pas une date ISO est renvoyée telle quelle.
export const frDay = (value) => {
    if (!value) return '';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!match) return String(value);
    return `${match[3]}/${match[2]}/${match[1]}${match[4] ? ` ${match[4]}:${match[5]}` : ''}`;
};

// Nom du défunt pour le titre : nom IC, à défaut nom HRP.
const decedentLabel = (f) => f.decedentName || f.decedentOOC || '';

// Nom lisible du formulaire (sans le préfixe "[Civil]" du sélecteur).
export const cleanFormName = (name, fallbackVersion) =>
    (name || 'Formulaire').replace(/^\[Civil\]\s*/i, '').trim();

export function buildReportTitle(version, formData = {}, formName = '') {
    const name = cleanFormName(formName, version);
    const f = formData || {};

    switch (version) {
        // DMEC (médecine légale) : même convention que les formulaires de soin, « [identifiant] Nom du formulaire - date ». L'identifiant est l'ID patient quand
        // le défunt en avait un (champ présent dans le rapport), sinon le nom du défunt (IC, puis HRP).
        case 1: // Services de Médecine Légale
            return buildStandardReportKey(name, f.patientID, decedentLabel(f), f.dateTime);
        case 4: // Rapport d'Autopsie
            return buildStandardReportKey(name, f.patientID, decedentLabel(f), f.autopsyDate);
        case 37: // Rapport Public de Décès
            return buildStandardReportKey(name, f.patientID, decedentLabel(f), f.dateOfDeath);
        case 2: // Email DMEC (pas de champ ID patient : le défunt, ou la liste des défunts)
            return buildStandardReportKey(name, '', decedentLabel(f), todayFr());
        case 8: // Certificat de Décès
            return buildStandardReportKey(name, '', decedentLabel(f), f.date);
        case 11: { // Rapport de Tuerie/Accident de Masse : les noms de tous les défunts
            const names = (Array.isArray(f.decedents) ? f.decedents : []).map((d) => d.decedentName).filter(Boolean).join(', ');
            return buildStandardReportKey(name, '', names, frDay(f.dateTime).split(' ')[0]);
        }
        case 22:
        case 23: // Notes de Service
            return buildStandardReportKey(name, f.patientID, f.patientName, f.date);
        case 24: { // Libération médicale
            const patientName = `${f.patientFirstName || ''} ${f.patientLastName || ''}`.trim();
            return buildStandardReportKey(name, f.patientID, patientName, f.SubmitDate || todayFr());
        }
        case 3:
        case 25: // Dossiers médicaux avancé / basique
            return buildStandardReportKey(name, f.patientID, f.patientName, f.patientDateOfBirth);
        case 27: // Email interne : l'objet du message tient lieu d'identifiant
            return buildStandardReportKey(name, '', f.internalEmailSubject, todayFr());
        case 40: // Formulaire AMA (EMS)
            return buildStandardReportKey(name, f.patientID, f.patientSignature, f.date);
        case 5: case 6: case 7: case 14: case 16: case 19: case 20: case 21:
        case 26: case 28: case 29: case 35: case 41: // Formulaires cliniques : le patient d'abord
            // (formData est partagé entre formulaires : un decedentName resté d'un
            // rapport DMEC ne doit pas devenir l'identifiant d'un rapport clinique).
            return buildStandardReportKey(name, f.patientID, f.patientName, f.date || f.dateOfVisit);
        default: {
            // Candidatures (50-55) : pas d'ID patient, on identifie le candidat.
            if (version >= 50 && version <= 55) {
                return `Candidature: ${f.applicantTitleAndFullName || 'Inconnu'}`;
            }
            let identifier = f.decedentName || f.patientName || f.applicantTitleAndFullName || 'Unnamed Report';
            if (Array.isArray(identifier)) identifier = identifier.join(', ');
            const dateField = f.date || f.dateTime || f.autopsyDate || f.dateOfVisit || f.SubmitDate;
            return buildStandardReportKey(name, f.patientID, identifier, dateField);
        }
    }
}
