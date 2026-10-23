import { translateResultValue } from '../constants/clinicalOptions';
import { buildLabBBCode } from './shared/labResults';
import { buildPatientContextBBCode } from './shared/patientContext';
import { buildVitalValuesBBCode, ARRIVAL_MODE_LABELS } from './shared/vitalValues';
import { checkbox, phmcHeaderEnd, sectionBanner } from './shared/bbStyles';

const generateEmergencyProtocol = (formData) => {
    const {
        lastName,
        phmcRank,
        patientName,
        patientID,
        date,
        patientDiagnosis,
        patientSecondaryDiagnosis,
        patientMedicine,
        patientProcedure,
        patientChiefComplaint,
        Imaging, // This is expected to be an array of selected imaging types
        XrayResults,
        ctResults,
        mriResults,
        ultrasoundResults,
        otherImagingResults,
        patientInjuryMechanism,
        prescriptionImage
    } = formData;

    // --- Imaging Section Logic ---
    let imagingSectionBBCode = '';
    if (Imaging && Array.isArray(Imaging) && Imaging.length > 0) {
        const imagingLabels = {
            XRay: 'Radiographie',
            CTScan: 'Scanner',
            MRI: 'IRM',
            Ultrasound: 'Échographie',
            Other: 'Autre',
            NoneRequired: 'Aucune requise',
        };
        const imagingPerformedString = Imaging.map((type) => imagingLabels[type] || type).join(', ');

        // Build the results string conditionally based on what's filled
        let imagingResultsString = '';
        const results = [];
        if (XrayResults && XrayResults.length > 0) results.push(`Radiographie: ${XrayResults.map(translateResultValue).join(', ')}`);
        if (ctResults && ctResults.length > 0) results.push(`Scanner: ${ctResults.map(translateResultValue).join(', ')}`);
        if (mriResults && mriResults.length > 0) results.push(`IRM: ${mriResults.map(translateResultValue).join(', ')}`);
        if (ultrasoundResults && ultrasoundResults.length > 0) results.push(`Échographie: ${ultrasoundResults.map(translateResultValue).join(', ')}`);
        if (otherImagingResults && otherImagingResults.length > 0) results.push(`Autres: ${otherImagingResults.map(translateResultValue).join(', ')}`);

        imagingResultsString = results.length > 0 ? results.join('; ') : 'Résultats en attente ou N/A';

        imagingSectionBBCode = `
[table][tr][td][center]Imagerie effectuée: ${imagingPerformedString}[/center]
[td][center]Résultats d'imagerie: ${imagingResultsString}[/center][/tr][/table]`;
    }
    // --- End Imaging Section Logic ---
    // --- Prescription Image Logic ---
    let prescriptionImageBBCode = '';
    if (prescriptionImage && prescriptionImage.trim() !== '') {
        if (prescriptionImage.trim().toLowerCase().startsWith('http://') || prescriptionImage.trim().toLowerCase().startsWith('https://')) {
            prescriptionImageBBCode = `[img]${prescriptionImage.trim()}[/img]`;
        } else {
            prescriptionImageBBCode = prescriptionImage.trim();
        }
    } else {
        prescriptionImageBBCode = 'N/A';
    }

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]PROTOCOLE D'URGENCE[/b]

PATIENT: ${patientName || 'N/A'}
ID PATIENT: ${patientID || 'N/A'}

Date: ${date || 'N/A'}

Signé: ${phmcRank || 'N/A'} ${lastName || 'N/A'}
${phmcHeaderEnd()}
${buildPatientContextBBCode(formData)}${sectionBanner(`Anamnèse`)}
[table][tr][td][left][list=none][u]Arrivée: [/u] ${ARRIVAL_MODE_LABELS[formData.arrivalMode] || 'N/A'}${formData.arrivalTime ? ` à ${formData.arrivalTime}` : ''}
[br][/br]
[u]Plainte principale: [/u][br][/br]
${patientChiefComplaint || 'N/A'}

[u] Mécanisme de blessure du patient: [/u][br][/br]
${formData.patientInjuryMechanism || 'N/A'}
[br][/br]
[u]Niveau de douleur/Indice de gravité d'urgence (IGU): [/u][br][/br]
${checkbox(formData.painLevel === 'patientNoPain')} [color=#0040FF]Niveau 5: pas de douleur/non urgent[/color] ${checkbox(formData.painLevel === 'patientNormalPain')} [color=#00BF00]Niveau 4: douleur normale/moins urgent[/color] ${checkbox(formData.painLevel === 'patientMildPain')} [color=#E6B800]Niveau 3: douleur légère/urgent[/color] ${checkbox(formData.painLevel === 'patientSeverePain')} [color=#FF8040]Niveau 2: douleur sévère/très urgent [/color]${checkbox(formData.painLevel === 'patientCritical')} [color=#FF0000]Niveau 1: critique/émergence [/color][/left]
[/table]
${sectionBanner(`Signes vitaux`)}
[table][tr][td][center]Température: ${checkbox(formData.temperature === 'patientTempNormal')} Normale ${checkbox(formData.temperature === 'patientHypothermic')} Hypothermique ${checkbox(formData.temperature === 'patientHyperthermic')} Hyperthermique[/center]
[td][center]Fréquence cardiaque: ${checkbox(formData.heartRate === 'patientHeartRateNormal')} Normale ${checkbox(formData.heartRate === 'patientHeartRateBradycardia')} Bradycardie ${checkbox(formData.heartRate === 'patientHeartRateTachycardia')} Tachycardie[/center][/table]
[table][tr][td][center]Respiration: ${checkbox(formData.breathing === 'patientBreathingNormal')} Normale ${checkbox(formData.breathing === 'patientBreathingSlow')} Lente ${checkbox(formData.breathing === 'patientBreathingFast')} Rapide ${checkbox(formData.breathing === 'patientBreathingObstructed')} Obstruée[/center]
[td][center]Tension artérielle: ${checkbox(formData.bloodPressure === 'patientBloodPressureNormal')} Normale ${checkbox(formData.bloodPressure === 'patientBloodPressureHypotension')} Hypotension ${checkbox(formData.bloodPressure === 'patientBloodPressureHypertension')} Hypertension [/center][/table]${buildVitalValuesBBCode(formData)}
${sectionBanner(`Constatations`)}
[table][tr][td][center]État de santé général (ESG): ${checkbox(formData.findings === 'patientNormal')} Normal ${checkbox(formData.findings === 'patientImpared')} Altéré[/center]
[td][center]Poumons (Auscultation): ${checkbox(formData.lungs === 'patientNormal')} Normal ${checkbox(formData.lungs === 'patientRhonchi')} Ronchi ${checkbox(formData.lungs === 'patientCrack')} Crépitants [/center][/table]
[table][tr][td][center]Pupilles: ${checkbox(formData.pupils === 'patientPupilsNormal')} Normales ${checkbox(formData.pupils === 'patientPupilsAbnormal')} Anormales [/center]
[td][center]Blessures: ${checkbox(formData.wounds === 'patientFractures')} Fracture(s) ${checkbox(formData.wounds === 'patientBleeding')} Saignement ${checkbox(formData.wounds === 'patientHematoma')} Hématome ${checkbox(formData.wounds === 'patientNoWounds')} Aucune [/center][/table]${imagingSectionBBCode}
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
[u]Procédure/Texte libre: [/u][br][/br]
${patientProcedure || 'N/A'}
[br][/br]
[u]Médicaments/Traitements: [/u][br][/br]
${patientMedicine || 'N/A'}
[br][/br]
${prescriptionImageBBCode}
[br][/br]
[u]Suivi: [/u][br][/br]
${checkbox(formData.followup === 'AsNeeded')} Au besoin
${checkbox(formData.followup === 'Recommended')} Recommandé
${checkbox(formData.followup === 'Electiveprocedure')} Procédure élective (Non-urgent / Non-planifié)

[/left][/list][/table]`;
    return bbCode;
};

export default generateEmergencyProtocol;
