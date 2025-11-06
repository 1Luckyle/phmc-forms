const generatePhysEvalInternalMed = (formData) => {
    const {
        patientID,
        date,
        lastName,
        patientHeight,
        patientWeight,
        phmcRank,
        careerRisks,
        patientAllergies,
        patientMedicine,
        patientcareerNo,
        patientSummary,
        patientCareer,
        patientImpairments,
    } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]EXAMEN PHYSIQUE[/b]

PATIENT ${patientID}

Date: ${date}
Signé: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CENTRE MÉDICAL PILLBOX HILL[/b]
ELGIN AVE. / STRAWBERRY AVE.
BP 742
LOS SANTOS, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Mesures du patient[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none][br][/br]Taille: ${patientHeight}
[br][/br]
Poids: ${patientWeight}
[/list][td]
[list=none][u]Indice de masse corporelle: [/u][br][/br]
[cb${formData.BodyMassIndex === 'Underweight' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'Underweight' ? 'c' : ''}] Insuffisance pondérale
[cb${formData.BodyMassIndex === 'Normal' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'Normal' ? 'c' : ''}] Normal
[cb${formData.BodyMassIndex === 'Overweight' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'Overweight' ? 'c' : ''}] Surpoids
[cb${formData.BodyMassIndex === 'Obese' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'Obese' ? 'c' : ''}] Obèse
[cb${formData.BodyMassIndex === 'ExtremeObese' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'ExtremeObese' ? 'c' : ''}] Obésité extrême
[/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Signes vitaux[/b][/color][/center][/divboxcolor]
[table][tr][td][center]Température: [cb${formData.temperature === 'patientTempNormal' ? 'c' : ''}] Normale [cb${formData.temperature === 'patientHypothermic' ? 'c' : ''}] Hypothermique [cb${formData.temperature === 'patientHyperthermic' ? 'c' : ''}] Hyperthermique[/center]
[td][center]Fréquence cardiaque: [cb${formData.heartRate === 'patientHeartRateNormal' ? 'c' : ''}] Normale [cb${formData.heartRate === 'patientHeartRateBradycardia' ? 'c' : ''}] Bradycardie [cb${formData.heartRate === 'patientHeartRateTachycardia' ? 'c' : ''}] Tachycardie[/center][/table]
[table][tr][td][center]Respiration: [cb${formData.breathing === 'patientBreathingNormal' ? 'c' : ''}] Normale [cb${formData.breathing === 'patientBreathingSlow' ? 'c' : ''}] Lente [cb${formData.breathing === 'patientBreathingFast' ? 'c' : ''}] Rapide [cb${formData.breathing === 'patientBreathingObstructed' ? 'c' : ''}] Obstruée[/center]
[td][center]Tension artérielle: [cb${formData.bloodPressure === 'patientBloodPressureNormal' ? 'c' : ''}] Normale [cb${formData.bloodPressure === 'patientBloodPressureHypotension' ? 'c' : ''}] Hypotension [cb${formData.bloodPressure === 'patientBloodPressureHypertension' ? 'c' : ''}] Hypertension [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnèse[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none][u]Le patient a-t-il un emploi? [/u][br][/br]
[cb${formData.patientJob === 'Yes' ? 'c' : ''}][/cb${formData.patientJob === 'Yes' ? 'c' : ''}] Oui: ${patientCareer}
[cb${formData.patientJob === 'No' ? 'c' : ''}][/cb${formData.patientJob === 'No' ? 'c' : ''}] Non: ${patientcareerNo} [/list]
[td][list=none][u]Si oui, des facteurs de risque nocifs sont-ils présents? [/u][br][/br]
[cb${formData.patientJobRisks === 'Yes' ? 'c' : ''}][/cb${formData.patientJobRisks === 'Yes' ? 'c' : ''}] Oui: ${careerRisks}
[cb${formData.patientJobRisks === 'No' ? 'c' : ''}][/cb${formData.patientJobRisks === 'No' ? 'c' : ''}] Non [/list]
[/td][/tr]
[tr][td][list=none][u]Des allergies ou des risques (implants, cas d'incompatibilité, stimulateur cardiaque, etc.) sont-ils présents?[/u][br][/br]
[cb${formData.patientAllergiesRisk === 'Yes' ? 'c' : ''}][/cb${formData.patientAllergiesRisk === 'Yes' ? 'c' : ''}] Oui: ${patientAllergies}
[cb${formData.patientAllergiesRisk === 'No' ? 'c' : ''}][/cb${formData.patientAllergiesRisk === 'No' ? 'c' : ''}] Non [/list]
[td][list=none][u]Le patient prend-il des médicaments de façon régulière? [/u][br][/br]
[cb${formData.patientMedicineRegular === 'Yes' ? 'c' : ''}][/cb${formData.patientMedicineRegular === 'Yes' ? 'c' : ''}] Oui: ${patientMedicine}
[cb${formData.patientMedicineRegular === 'No' ? 'c' : ''}][/cb${formData.patientMedicineRegular === 'No' ? 'c' : ''}] Non[/list]
[/td][/tr]
[tr][td][list=none][u]Le patient a-t-il d'autres condition(s) médicale(s) ou déficiences physiques?[/u][br][/br]
[cb${formData.patientOther === 'Yes' ? 'c' : ''}][/cb${formData.patientOther === 'Yes' ? 'c' : ''}] Oui: ${patientImpairments}
[cb${formData.patientOther === 'No' ? 'c' : ''}][/cb${formData.patientOther === 'No' ? 'c' : ''}] Non [/list]
[td][list=none][u]Prédisposition génétique[/u][br][/br]
[cb${formData.predisposition === 'Existing' ? 'c' : ''}][/cb${formData.predisposition === 'Existing' ? 'c' : ''}] Existante
[cb${formData.predisposition === 'NonExisting' ? 'c' : ''}][/cb${formData.predisposition === 'NonExisting' ? 'c' : ''}] Non existante [/list]
[/td][/tr][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Résumé de l'évaluation[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Déclaration d'évaluation: [/u][br][/br]
${patientSummary}
[br][/br][/left][/list][/table]

`;

        return bbCode;
    };
export default generatePhysEvalInternalMed;