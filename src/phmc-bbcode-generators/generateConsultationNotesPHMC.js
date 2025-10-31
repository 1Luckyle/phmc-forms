const generateConsultationNotesPHMC = (formData) => {
    const {
        lastName,
        phmcRank,
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

    if (scenePhotos && scenePhotos.trim()) {
        const items = scenePhotos.split(',')
            .map(item => item.trim()) // Trim whitespace from each item
            .filter(item => item); // Remove any empty items resulting from split/trim

        if (items.length > 0) {
            medicationBBCode = items.map(item => {
                const isImageUrl = item.startsWith('https://') || /\.(jpg|jpeg|png|gif)$/i.test(item);
                if (isImageUrl) {
                    return `[img]${item}[/img]`; // Wrap in img tags
                } else {
                    return item; // Output as plain text
                }
            }).join('\n'); // Join processed items with newlines
        }
    }
    // --- End Custom Handling ---


    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de consultation[/b]

ID PATIENT: ${patientID || 'N/A'}

Date: ${date || 'N/A'}

Signé: ${phmcRank || 'N/A'} ${lastName || 'N/A'}
[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CENTRE MÉDICAL PILLBOX HILL[/b]
ELGIN AVE. / STRAWBERRY AVE.
BP 742
LOS SANTOS, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnèse[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Motif de la visite: [/u][br][/br]
${patientChiefComplaint || 'N/A'}
[br][/br]
[u]Département assigné: [/u][br][/br]
[cb${formData.assignedDepartment === 'InternalMedicine' ? 'c' : ''}] Médecine interne
[cb${formData.assignedDepartment === 'SurgicalDepartment' ? 'c' : ''}] Département chirurgical
[cb${formData.assignedDepartment === 'Midwifery' ? 'c' : ''}] Maïeutique
[cb${formData.assignedDepartment === 'Dialysis' ? 'c' : ''}] Dialyse
[/list][/td][/tr][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Signes vitaux[/b][/color][/center][/divboxcolor]
[table][tr][td][center]Température: [cb${formData.temperature === 'patientTempNormal' ? 'c' : ''}] Normale [cb${formData.temperature === 'patientHypothermic' ? 'c' : ''}] Hypothermique [cb${formData.temperature === 'patientHyperthermic' ? 'c' : ''}] Hyperthermique[/center]
[td][center]Fréquence cardiaque: [cb${formData.heartRate === 'patientHeartRateNormal' ? 'c' : ''}] Normale [cb${formData.heartRate === 'patientHeartRateBradycardia' ? 'c' : ''}] Bradycardie [cb${formData.heartRate === 'patientHeartRateTachycardia' ? 'c' : ''}] Tachycardie[/center][/table]
[table][tr][td][center]Respiration: [cb${formData.breathing === 'patientBreathingNormal' ? 'c' : ''}] Normale [cb${formData.breathing === 'patientBreathingSlow' ? 'c' : ''}] Lente [cb${formData.breathing === 'patientBreathingFast' ? 'c' : ''}] Rapide [cb${formData.breathing === 'patientBreathingObstructed' ? 'c' : ''}] Obstruée[/center]
[td][center]Tension artérielle: [cb${formData.bloodPressure === 'patientBloodPressureNormal' ? 'c' : ''}] Normale [cb${formData.bloodPressure === 'patientBloodPressureHypotension' ? 'c' : ''}] Hypotension [cb${formData.bloodPressure === 'patientBloodPressureHypertension' ? 'c' : ''}] Hypertension [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Constatations[/b][/color][/center][/divboxcolor]
[table][tr][td][center]État de santé général (ESG): [cb${formData.findings === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientImpared' ? 'c' : ''}] Altéré[/center]
[td][center]Poumons (Auscultation): [cb${formData.lungs === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientRhonchi' ? 'c' : ''}] Ronchi [cb${formData.findings === 'patientCrack' ? 'c' : ''}] Crépitants [/center][/table]
[table][tr][td][center]Pupilles: [cb${formData.pupils === 'patientPupilsNormal' ? 'c' : ''}] Normales [cb${formData.pupils === 'patientPupilsAbnormal' ? 'c' : ''}] Anormales [/center]
[td][center]Blessures: [cb${formData.wounds === 'patientFractures' ? 'c' : ''}] Fracture(s) [cb${formData.wounds === 'patientBleeding' ? 'c' : ''}] Saignement [cb${formData.wounds === 'patientHematoma' ? 'c' : ''}] Hématome [cb${formData.wounds === 'patientNoWounds' ? 'c' : ''}] Aucune [/center][/table]
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
[u]Plan de traitement/Texte libre: [/u][br][/br]
${patientProcedure || 'N/A'}
[br][/br]
[u]Médicaments: [/u][br][/br]
${medicationBBCode} 
[br][/br]
[u]Suivi: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] Au besoin
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommandé
[cb${formData.followup === 'ElectiveProcedure' ? 'c' : ''}] Procédure élective
[/left][/list][/table]`;
    return bbCode;
};

export default generateConsultationNotesPHMC;
