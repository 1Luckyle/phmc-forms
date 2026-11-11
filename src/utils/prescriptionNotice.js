// src/utils/prescriptionNotice.js
//
// Notification « Une ordonnance vous a été remise » : le patient la reçoit d'office dans son dossier (voir patientRecords.sharedPrescriptionEntries), même quand le rapport qui la porte ne lui est pas partagé.
// Envoyée à l'enregistrement d'un rapport de soins qui comporte une ordonnance, et jamais quand c'est le patient lui-même qui l'enregistre.
import { prescriptionOfReport } from '../phmc-bbcode-generators/generatePrescription';

/**
 * Contenu de la notification pour un rapport qu'on vient d'enregistrer ({ data, bbCodeVersion }) ; null quand il n'y a rien à notifier
 * (pas d'ordonnance, patient décédé, ou rapport enregistré par le patient lui-même).
 */
export const prescriptionNoticeFor = (report, { byPatient = false } = {}) => {
    if (byPatient) return null;
    const prescription = prescriptionOfReport(report);
    if (!prescription) return null;
    return {
        type: 'partage',
        titre: 'Une ordonnance vous a été remise',
        texte: prescription.title,
        lien: { cible: 'dossierPatient' },
    };
};
