const generateEmergencyProtocol = (formData) => {
    const {
        lastName,
        phmcRank,
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
        patientInjuryMechanism,
        prescriptionImage
    } = formData;

    // --- Imaging Section Logic ---
    let imagingSectionBBCode = '';
    if (Imaging && Array.isArray(Imaging) && Imaging.length > 0) {
        const imagingPerformedString = Imaging.join(', '); // e.g., "X-Ray, CT Scan"

        // Build the results string conditionally based on what's filled
        let imagingResultsString = '';
        const results = [];
        if (XrayResults && XrayResults.length > 0) results.push(`Radiographie: ${XrayResults.join(', ')}`);
        if (ctResults && ctResults.length > 0) results.push(`Scanner: ${ctResults.join(', ')}`);
        if (mriResults && mriResults.length > 0) results.push(`IRM: ${mriResults.join(', ')}`);
        if (ultrasoundResults && ultrasoundResults.length > 0) results.push(`Échographie: ${ultrasoundResults.join(', ')}`);

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

ID PATIENT: ${patientID || 'N/A'}

Date: ${date || 'N/A'}

Signé: ${phmcRank || 'N/A'} ${lastName || 'N/A'}
[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CENTRE MÉDICAL PILLBOX HILL[/b]
ELGIN AVE. / STRAWBERRY AVE.
BP 742
LOS SANTOS, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnèse[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Plainte principale: [/u][br][/br]
${patientChiefComplaint || 'N/A'}

[u] Mécanisme de blessure du patient: [/u][br][/br]
${formData.patientInjuryMechanism || 'N/A'}
[br][/br]
[u]Niveau de douleur/Indice de gravité d'urgence (IGU): [/u][br][/br]
[cb${formData.painLevel === 'patientNoPain' ? 'c' : ''}] [color=#0040FF]Niveau 5: pas de douleur/non urgent[/color] [cb${formData.painLevel === 'patientNormalPain' ? 'c' : ''}] [color=#00BF00]Niveau 4: douleur normale/moins urgent[/color] [cb${formData.painLevel === 'patientMildPain' ? 'c' : ''}] [color=#FFFF00]Niveau 3: douleur légère/urgent[/color] [cb${formData.painLevel === 'patientSeverePain' ? 'c' : ''}] [color=#FF8040]Niveau 2: douleur sévère/très urgent [/color][cb${formData.painLevel === 'patientCritical' ? 'c' : ''}] [color=#FF0000]Niveau 1: critique/émergence [/color][/left]
[/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Signes vitaux[/b][/color][/center][/divboxcolor]
[table][tr][td][center]Température: [cb${formData.temperature === 'patientTempNormal' ? 'c' : ''}] Normale [cb${formData.temperature === 'patientHypothermic' ? 'c' : ''}] Hypothermique [cb${formData.temperature === 'patientHyperthermic' ? 'c' : ''}] Hyperthermique[/center]
[td][center]Fréquence cardiaque: [cb${formData.heartRate === 'patientHeartRateNormal' ? 'c' : ''}] Normale [cb${formData.heartRate === 'patientHeartRateBradycardia' ? 'c' : ''}] Bradycardie [cb${formData.heartRate === 'patientHeartRateTachycardia' ? 'c' : ''}] Tachycardie[/center][/table]
[table][tr][td][center]Respiration: [cb${formData.breathing === 'patientBreathingNormal' ? 'c' : ''}] Normale [cb${formData.breathing === 'patientBreathingSlow' ? 'c' : ''}] Lente [cb${formData.breathing === 'patientBreathingFast' ? 'c' : ''}] Rapide [cb${formData.breathing === 'patientBreathingObstructed' ? 'c' : ''}] Obstruée[/center]
[td][center]Tension artérielle: [cb${formData.bloodPressure === 'patientBloodPressureNormal' ? 'c' : ''}] Normale [cb${formData.bloodPressure === 'patientBloodPressureHypotension' ? 'c' : ''}] Hypotension [cb${formData.bloodPressure === 'patientBloodPressureHypertension' ? 'c' : ''}] Hypertension [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Constatations[/b][/color][/center][/divboxcolor]
[table][tr][td][center]État de santé général (ESG): [cb${formData.findings === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientImpared' ? 'c' : ''}] Altéré[/center]
[td][center]Poumons (Auscultation): [cb${formData.lungs === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientRhonchi' ? 'c' : ''}] Ronchi [cb${formData.findings === 'patientCrack' ? 'c' : ''}] Crépitants [/center][/table]
[table][tr][td][center]Pupilles: [cb${formData.pupils === 'patientPupilsNormal' ? 'c' : ''}] Normales [cb${formData.pupils === 'patientPupilsAbnormal' ? 'c' : ''}] Anormales [/center]
[td][center]Blessures: [cb${formData.wounds === 'patientFractures' ? 'c' : ''}] Fracture(s) [cb${formData.wounds === 'patientBleeding' ? 'c' : ''}] Saignement [cb${formData.wounds === 'patientHematoma' ? 'c' : ''}] Hématome [cb${formData.wounds === 'patientNoWounds' ? 'c' : ''}] Aucune [/center][/table]${imagingSectionBBCode}
[table][tr][td][center]ECG: [cb${formData.ecg === 'patientSinusRhythm' ? 'c' : ''}] Rythme sinusal [cb${formData.ecg === 'patientArrhythmia' ? 'c' : ''}] Arythmie [cb${formData.ecg === 'patientInfaction' ? 'c' : ''}] Infarctus [/center]
[td][center]Sono: [cb${formData.sono === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.sono === 'patientFluids' ? 'c' : ''}] Fluides [cb${formData.sono === 'patientTissue' ? 'c' : ''}] Changement tissulaire[/center][/table]
[table][tr][td][center]Labo: [cb${formData.lab?.includes('WNL') ? 'c' : ''}] DLN  [cb${formData.lab?.includes('Anemia') ? 'c' : ''}] Anémie [cb${formData.lab?.includes('Inflammation/Infection') ? 'c' : ''}] Inflammation/Infection [cb${formData.lab?.includes('Dysfunction') ? 'c' : ''}] Dysfonctionnement/Trouble [cb${formData.lab?.includes('ElectrolyteImbalance') ? 'c' : ''}] Déséquilibre électrolytique [cb${formData.lab?.includes('Infarct') ? 'c' : ''}] Infarctus/Embolie [cb${formData.lab?.includes('Tumor') ? 'c' : ''}] Tumeur [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Diagnostic préliminaire[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Diagnostic primaire: [/u][br][/br]
${patientDiagnosis || 'N/A'}
[br][/br][u]Diagnostic secondaire: [/u][br][/br]
${patientSecondaryDiagnosis || 'N/A'}[/left][/list][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Thérapie[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Oui
[cb${formData.admission === 'No' ? 'c' : ''}] Non
[br][/br]
[u]Procédure/Texte libre: [/u][br][/br]
${patientProcedure || 'N/A'}
[br][/br]
[u]Médicaments: [/u][br][/br]
${patientMedicine || 'N/A'}
${prescriptionImageBBCode}
[u]Suivi: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] Au besoin
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommandé
    
[/left][/list][/table]`;
    return bbCode;
};

export default generateEmergencyProtocol;
