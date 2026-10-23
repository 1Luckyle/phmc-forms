import { buildPatientContextBBCode } from './shared/patientContext';
import { checkbox, phmcHeaderEnd, sectionBanner } from './shared/bbStyles';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage). Les champs qui ne
// sont pertinents que si une autre réponse Oui/Non associée a été sélectionnée
// (ex: emploi, risques professionnels, allergies, médicaments, déficiences)
// gardent une chaîne vide.
const NOT_FILLED = 'Non renseigné';

const generatePhysEvalInternalMed = (formData) => {
    const {
        patientName = NOT_FILLED,
        patientID = '',
        date = NOT_FILLED,
        lastName = NOT_FILLED,
        patientHeight = NOT_FILLED,
        patientWeight = NOT_FILLED,
        phmcRank = NOT_FILLED,
        careerRisks = '',
        patientAllergies = '',
        patientMedicine = '',
        patientcareerNo = '',
        patientSummary = NOT_FILLED,
        patientCareer = '',
        patientImpairments = '',
    } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]EXAMEN PHYSIQUE[/b]

PATIENT ${patientName}${patientID ? ` (ID: ${patientID})` : ''}

Date: ${date}
Signé: ${phmcRank} ${lastName}
${phmcHeaderEnd()}
${buildPatientContextBBCode(formData, { accentColor: '#FF0000', showHistory: false })}${sectionBanner(`Mesures du patient`)}
[table][tr][td][list=none][br][/br]Taille: ${patientHeight}
[br][/br]
Poids: ${patientWeight}
[/list][td]
[list=none][u]Indice de masse corporelle: [/u][br][/br]
${checkbox(formData.BodyMassIndex === 'Underweight')}[/cb${formData.BodyMassIndex === 'Underweight' ? 'c' : ''}] Insuffisance pondérale
${checkbox(formData.BodyMassIndex === 'Normal')}[/cb${formData.BodyMassIndex === 'Normal' ? 'c' : ''}] Normal
${checkbox(formData.BodyMassIndex === 'Overweight')}[/cb${formData.BodyMassIndex === 'Overweight' ? 'c' : ''}] Surpoids
${checkbox(formData.BodyMassIndex === 'Obese')}[/cb${formData.BodyMassIndex === 'Obese' ? 'c' : ''}] Obèse
${checkbox(formData.BodyMassIndex === 'ExtremeObese')}[/cb${formData.BodyMassIndex === 'ExtremeObese' ? 'c' : ''}] Obésité extrême
[/table]
${sectionBanner(`Signes vitaux`)}
[table][tr][td][center]Température: ${checkbox(formData.temperature === 'patientTempNormal')} Normale ${checkbox(formData.temperature === 'patientHypothermic')} Hypothermique ${checkbox(formData.temperature === 'patientHyperthermic')} Hyperthermique[/center]
[td][center]Fréquence cardiaque: ${checkbox(formData.heartRate === 'patientHeartRateNormal')} Normale ${checkbox(formData.heartRate === 'patientHeartRateBradycardia')} Bradycardie ${checkbox(formData.heartRate === 'patientHeartRateTachycardia')} Tachycardie[/center][/table]
[table][tr][td][center]Respiration: ${checkbox(formData.breathing === 'patientBreathingNormal')} Normale ${checkbox(formData.breathing === 'patientBreathingSlow')} Lente ${checkbox(formData.breathing === 'patientBreathingFast')} Rapide ${checkbox(formData.breathing === 'patientBreathingObstructed')} Obstruée[/center]
[td][center]Tension artérielle: ${checkbox(formData.bloodPressure === 'patientBloodPressureNormal')} Normale ${checkbox(formData.bloodPressure === 'patientBloodPressureHypotension')} Hypotension ${checkbox(formData.bloodPressure === 'patientBloodPressureHypertension')} Hypertension [/center][/table]
${sectionBanner(`Anamnèse`)}
[table][tr][td][list=none][u]Le patient a-t-il un emploi? [/u][br][/br]
${checkbox(formData.patientJob === 'Yes')}[/cb${formData.patientJob === 'Yes' ? 'c' : ''}] Oui: ${formData.patientJob === 'Yes' ? patientCareer : ''}
${checkbox(formData.patientJob === 'No')}[/cb${formData.patientJob === 'No' ? 'c' : ''}] Non: ${formData.patientJob === 'No' ? patientcareerNo : ''} [/list]
[td][list=none][u]Si oui, des facteurs de risque nocifs sont-ils présents? [/u][br][/br]
${checkbox(formData.patientJobRisks === 'Yes')}[/cb${formData.patientJobRisks === 'Yes' ? 'c' : ''}] Oui: ${formData.patientJobRisks === 'Yes' ? careerRisks : ''}
${checkbox(formData.patientJobRisks === 'No')}[/cb${formData.patientJobRisks === 'No' ? 'c' : ''}] Non [/list]
[/td][/tr]
[tr][td][list=none][u]Des allergies ou des risques (implants, cas d'incompatibilité, stimulateur cardiaque, etc.) sont-ils présents?[/u][br][/br]
${checkbox(formData.patientAllergiesRisk === 'Yes')}[/cb${formData.patientAllergiesRisk === 'Yes' ? 'c' : ''}] Oui: ${formData.patientAllergiesRisk === 'Yes' ? patientAllergies : ''}
${checkbox(formData.patientAllergiesRisk === 'No')}[/cb${formData.patientAllergiesRisk === 'No' ? 'c' : ''}] Non [/list]
[td][list=none][u]Le patient prend-il des médicaments de façon régulière? [/u][br][/br]
${checkbox(formData.patientMedicineRegular === 'Yes')}[/cb${formData.patientMedicineRegular === 'Yes' ? 'c' : ''}] Oui: ${formData.patientMedicineRegular === 'Yes' ? patientMedicine : ''}
${checkbox(formData.patientMedicineRegular === 'No')}[/cb${formData.patientMedicineRegular === 'No' ? 'c' : ''}] Non[/list]
[/td][/tr]
[tr][td][list=none][u]Le patient a-t-il d'autres condition(s) médicale(s) ou déficiences physiques?[/u][br][/br]
${checkbox(formData.patientOther === 'Yes')}[/cb${formData.patientOther === 'Yes' ? 'c' : ''}] Oui: ${formData.patientOther === 'Yes' ? patientImpairments : ''}
${checkbox(formData.patientOther === 'No')}[/cb${formData.patientOther === 'No' ? 'c' : ''}] Non [/list]
[td][list=none][u]Prédisposition génétique[/u][br][/br]
${checkbox(formData.predisposition === 'Existing')}[/cb${formData.predisposition === 'Existing' ? 'c' : ''}] Existante
${checkbox(formData.predisposition === 'NonExisting')}[/cb${formData.predisposition === 'NonExisting' ? 'c' : ''}] Non existante [/list]
[/td][/tr][/table]
${sectionBanner(`Résumé de l'évaluation`)}
[table][tr][td][left][list=none][u]Déclaration d'évaluation: [/u][br][/br]
${patientSummary}
[br][/br][/left][/list][/table]

`;

        return bbCode;
    };
export default generatePhysEvalInternalMed;