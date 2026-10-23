import { buildLabBBCode } from './shared/labResults';
import { buildPatientContextBBCode } from './shared/patientContext';
import { checkbox, phmcHeaderEnd, sectionBanner } from './shared/bbStyles';

const generateConsultationNotesPHMC = (formData) => {
    const {
        lastName,
        phmcRank,
        patientName,
        patientID,
        date,
        patientDiagnosis,
        patientSecondaryDiagnosis,
        // patientMedicine, // This seems unused now, replaced by scenePhotos for medication?
        patientProcedure,
        patientChiefComplaint,
        // patientAdvise, // This seems unused
        scenePhotos, // Used for Medication section now
    } = formData;

    // --- Custom Handling for scenePhotos (Medication) ---
    let medicationBBCode = '[i]Aucun détail sur les médicaments fourni.[/i]'; // Default fallback
    const medicationText = formData.patientMedicine && formData.patientMedicine.trim();

    if (medicationText) {
        medicationBBCode = medicationText;
    }

    if (scenePhotos && scenePhotos.trim()) {
        const items = scenePhotos.split(',')
            .map(item => item.trim()) // Trim whitespace from each item
            .filter(item => item); // Remove any empty items resulting from split/trim

        if (items.length > 0) {
            const attachments = items.map(item => {
                const isImageUrl = item.startsWith('https://') || /\.(jpg|jpeg|png|gif)$/i.test(item);
                if (isImageUrl) {
                    return `[img]${item}[/img]`; // Wrap in img tags
                } else {
                    return item; // Output as plain text
                }
            }).join('\n'); // Join processed items with newlines
            // Le texte saisi (nom, dosage, durée) reste visible au-dessus des images d'ordonnance.
            medicationBBCode = medicationText ? `${medicationText}\n${attachments}` : attachments;
        }
    }
    // --- End Custom Handling ---


    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de consultation[/b]

PATIENT: ${patientName || 'N/A'}
ID PATIENT: ${patientID || 'N/A'}

Date: ${date || 'N/A'}

Signé: ${phmcRank || 'N/A'} ${lastName || 'N/A'}
${phmcHeaderEnd()}
${buildPatientContextBBCode(formData)}${sectionBanner(`Anamnèse`)}
[table][tr][td][left][list=none][u]Motif de la visite: [/u][br][/br]
${patientChiefComplaint || 'N/A'}
[br][/br]
[u]Département assigné: [/u][br][/br]
${checkbox(formData.assignedDepartment === 'InternalMedicine')} Service de Médecine Interne
${checkbox(formData.assignedDepartment === 'SurgicalDepartment')} Département Chirurgical
${checkbox(formData.assignedDepartment === 'Midwifery')} Service de Maternité-Obstétrique
${checkbox(formData.assignedDepartment === 'Dialysis')} Service de Néphrologie
[/list][/td][/tr][/table]
${sectionBanner(`Signes vitaux`)}
[table][tr][td][center]Température: ${checkbox(formData.temperature === 'patientTempNormal')} Normale ${checkbox(formData.temperature === 'patientHypothermic')} Hypothermique ${checkbox(formData.temperature === 'patientHyperthermic')} Hyperthermique[/center]
[td][center]Fréquence cardiaque: ${checkbox(formData.heartRate === 'patientHeartRateNormal')} Normale ${checkbox(formData.heartRate === 'patientHeartRateBradycardia')} Bradycardie ${checkbox(formData.heartRate === 'patientHeartRateTachycardia')} Tachycardie[/center][/table]
[table][tr][td][center]Respiration: ${checkbox(formData.breathing === 'patientBreathingNormal')} Normale ${checkbox(formData.breathing === 'patientBreathingSlow')} Lente ${checkbox(formData.breathing === 'patientBreathingFast')} Rapide ${checkbox(formData.breathing === 'patientBreathingObstructed')} Obstruée[/center]
[td][center]Tension artérielle: ${checkbox(formData.bloodPressure === 'patientBloodPressureNormal')} Normale ${checkbox(formData.bloodPressure === 'patientBloodPressureHypotension')} Hypotension ${checkbox(formData.bloodPressure === 'patientBloodPressureHypertension')} Hypertension [/center][/table]
${sectionBanner(`Constatations`)}
[table][tr][td][center]État de santé général (ESG): ${checkbox(formData.findings === 'patientNormal')} Normal ${checkbox(formData.findings === 'patientImpared')} Altéré[/center]
[td][center]Poumons (Auscultation): ${checkbox(formData.lungs === 'patientNormal')} Normal ${checkbox(formData.lungs === 'patientRhonchi')} Ronchi ${checkbox(formData.lungs === 'patientCrack')} Crépitants [/center][/table]
[table][tr][td][center]Pupilles: ${checkbox(formData.pupils === 'patientPupilsNormal')} Normales ${checkbox(formData.pupils === 'patientPupilsAbnormal')} Anormales [/center]
[td][center]Blessures: ${checkbox(formData.wounds === 'patientFractures')} Fracture(s) ${checkbox(formData.wounds === 'patientBleeding')} Saignement ${checkbox(formData.wounds === 'patientHematoma')} Hématome ${checkbox(formData.wounds === 'patientNoWounds')} Aucune [/center][/table]
[table][tr][td][center]ECG: ${checkbox(formData.ecg === 'patientSinusRhythm')} Rythme sinusal ${checkbox(formData.ecg === 'patientArrhythmia')} Arythmie ${checkbox(formData.ecg === 'patientInfaction')} Infarctus [/center]
[td][center]Sono: ${checkbox(formData.sono === 'patientNormal')} Normal ${checkbox(formData.sono === 'patientFluids')} Fluides ${checkbox(formData.sono === 'patientTissue')} Changement tissulaire[/center][/table]
${buildLabBBCode(formData)}
${sectionBanner(`Diagnostic préliminaire`)}
[table][tr][td][left][list=none][u]Diagnostic primaire: [/u][br][/br]
${patientDiagnosis || 'N/A'}
[br][/br][u]Diagnostic secondaire: [/u][br][/br]
${patientSecondaryDiagnosis || 'N/A'}[/left][/list][/table]
${sectionBanner(`Thérapie`)}
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
${checkbox(formData.admission === 'Yes')} Oui
${checkbox(formData.admission === 'No')} Non
[br][/br]
[u]Plan de traitement/Texte libre: [/u][br][/br]
${patientProcedure || 'N/A'}
[br][/br]
[u]Médicaments/Traitements: [/u][br][/br]
${medicationBBCode} 
[br][/br]
[u]Suivi: [/u][br][/br]
${checkbox(formData.followup === 'AsNeeded')} Au besoin
${checkbox(formData.followup === 'Recommended')} Recommandé
${checkbox(formData.followup === 'Electiveprocedure')} Procédure élective (Non-urgent / Non-planifié)
[/left][/list][/table]`;
    return bbCode;
};

export default generateConsultationNotesPHMC;
