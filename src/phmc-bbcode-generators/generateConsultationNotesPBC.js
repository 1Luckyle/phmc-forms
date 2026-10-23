import { buildLabBBCode } from './shared/labResults';
import { buildPatientContextBBCode } from './shared/patientContext';
import { BB_COLORS, checkbox, sectionBanner } from './shared/bbStyles';

// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';

const generateConsultationNotesPBC = (formData) => {
            const {
                lastName = NOT_FILLED,
                phmcRank = NOT_FILLED,
                patientName = NOT_FILLED,
                patientID = '',
                date = NOT_FILLED,
                patientDiagnosis = NOT_FILLED,
                patientSecondaryDiagnosis = NOT_FILLED,
                patientMedicine = NOT_FILLED,
                patientProcedure = NOT_FILLED,
                patientChiefComplaint = NOT_FILLED,
                patientNotes = NOT_FILLED,
            } = formData;
    
            let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de consultation[/b]
    
PATIENT: ${patientName}${patientID ? ` (ID: ${patientID})` : ''}

Date: ${date}

Signé: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.ibb.co/fdGgxDH1/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CLINIQUE DE PALETO BAY[/b]
PALETO BAY BLVD.
BP 685
PALETO BAY, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]
${buildPatientContextBBCode(formData, { accentColor: '#0080FF' })}${sectionBanner(`Anamnèse`, { accent: BB_COLORS.blue })}
[table][tr][td][left][list=none][u]Motif de la visite: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Département assigné: [/u][br][/br]
${checkbox(formData.paletoClinicDepartment === 'InternalMedicine')} Médecine interne 
${checkbox(formData.paletoClinicDepartment === 'SurgicalDepartment')} Département chirurgical
[/table]
${sectionBanner(`Signes vitaux`, { accent: BB_COLORS.blue })}
[table][tr][td][center]Température: ${checkbox(formData.temperature === 'patientTempNormal')} Normale ${checkbox(formData.temperature === 'patientHypothermic')} Hypothermique ${checkbox(formData.temperature === 'patientHyperthermic')} Hyperthermique[/center]
[td][center]Fréquence cardiaque: ${checkbox(formData.heartRate === 'patientHeartRateNormal')} Normale ${checkbox(formData.heartRate === 'patientHeartRateBradycardia')} Bradycardie ${checkbox(formData.heartRate === 'patientHeartRateTachycardia')} Tachycardie[/center][/table]
[table][tr][td][center]Respiration: ${checkbox(formData.breathing === 'patientBreathingNormal')} Normale ${checkbox(formData.breathing === 'patientBreathingSlow')} Lente ${checkbox(formData.breathing === 'patientBreathingFast')} Rapide ${checkbox(formData.breathing === 'patientBreathingObstructed')} Obstruée[/center]
[td][center]Tension artérielle: ${checkbox(formData.bloodPressure === 'patientBloodPressureNormal')} Normale ${checkbox(formData.bloodPressure === 'patientBloodPressureHypotension')} Hypotension ${checkbox(formData.bloodPressure === 'patientBloodPressureHypertension')} Hypertension [/center][/table]
${sectionBanner(`Constatations`, { accent: BB_COLORS.blue })}
[table][tr][td][center]État de santé général (ESG): ${checkbox(formData.findings === 'patientNormal')} Normal ${checkbox(formData.findings === 'patientImpared')} Altéré[/center]
[td][center]Poumons (Auscultation): ${checkbox(formData.lungs === 'patientNormal')} Normal ${checkbox(formData.lungs === 'patientRhonchi')} Ronchi ${checkbox(formData.lungs === 'patientCrack')} Crépitants [/center][/table]
[table][tr][td][center]Pupilles: ${checkbox(formData.pupils === 'patientPupilsNormal')} Normales ${checkbox(formData.pupils === 'patientPupilsAbnormal')} Anormales [/center]
[td][center]Blessures: ${checkbox(formData.wounds === 'patientFractures')} Fracture(s) ${checkbox(formData.wounds === 'patientBleeding')} Saignement ${checkbox(formData.wounds === 'patientHematoma')} Hématome ${checkbox(formData.wounds === 'patientNoWounds')} Aucune [/center][/table]
[table][tr][td][center]ECG: ${checkbox(formData.ecg === 'patientSinusRhythm')} Rythme sinusal ${checkbox(formData.ecg === 'patientArrhythmia')} Arythmie ${checkbox(formData.ecg === 'patientInfaction')} Infarctus [/center]
[td][center]Sono: ${checkbox(formData.sono === 'patientNormal')} Normal ${checkbox(formData.sono === 'patientFluids')} Fluides ${checkbox(formData.sono === 'patientTissue')} Changement tissulaire[/center][/table]
${buildLabBBCode(formData)}
${sectionBanner(`Diagnostic de sortie`, { accent: BB_COLORS.blue })}
[table][tr][td][left][list=none][u]Diagnostic primaire: [/u][br][/br]
${patientDiagnosis}
[br][/br][u]Diagnostic secondaire: [/u][br][/br]
${patientSecondaryDiagnosis}[/left][/list][/table]
${sectionBanner(`Thérapie`, { accent: BB_COLORS.blue })}
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
${checkbox(formData.admission === 'Yes')} Oui
${checkbox(formData.admission === 'No')} Non
[br][/br]
[u]Plan de traitement/Texte libre: [/u][br][/br]
${patientProcedure}
[br][/br]
[u]Notes supplémentaires: [/u][br][/br]
${patientNotes}
[br][/br]
[u]Médicaments/Traitements: [/u][br][/br]
${patientMedicine}
[br][/br]
[u]Suivi: [/u][br][/br]
${checkbox(formData.followup === 'AsNeeded')} Au besoin
${checkbox(formData.followup === 'Recommended')} Recommandé
${checkbox(formData.followup === 'Electiveprocedure')} Procédure élective (Non-urgent / Non-planifié)
[/left][/list][/table]`
            return bbCode;
            };
export default generateConsultationNotesPBC;