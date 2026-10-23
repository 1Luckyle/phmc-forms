import { buildPatientContextBBCode } from './shared/patientContext';
import { BB_COLORS, checkbox, sectionBanner } from './shared/bbStyles';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';

const generateMentalHealthPBC = (formData) => {
        const {
            lastName = NOT_FILLED,
            patientName = NOT_FILLED,
            patientID = '',
            phmcRank = NOT_FILLED,
            date = NOT_FILLED,
            patientChiefComplaint = NOT_FILLED,
            patientNotes = NOT_FILLED,
            patientDiagnosis = NOT_FILLED,
            patientMedicine = NOT_FILLED,
            patientProcedure = NOT_FILLED,
        } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de session[/b]

PATIENT ${patientName}${patientID ? ` (ID: ${patientID})` : ''}

Date: ${date}
Signé: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.ibb.co/fdGgxDH1/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CLINIQUE DE PALETO BAY[/b]
PALETO BAY BLVD.
BP 685
PALETO BAY, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]
${buildPatientContextBBCode(formData, { accentColor: '#0080FF', showHistory: true })}${sectionBanner(`Anamnèse`, { accent: BB_COLORS.blue })}
[table][tr][td][left][list=none][u]Plainte principale: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Département assigné: [/u][br][/br]
[cbc] Santé mentale
[br][/br][/left]
[/table]
${sectionBanner(`Constatations`, { accent: BB_COLORS.blue })}
[table][tr][td][list=none]Notes: ${patientNotes}[/list][/table]
${sectionBanner(`Diagnostic de sortie`, { accent: BB_COLORS.blue })}
[table][tr][td][left][list=none][u]Diagnostic primaire: [/u][br][/br]
${patientDiagnosis}[/list][/table]
${sectionBanner(`Thérapie`, { accent: BB_COLORS.blue })}
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
${checkbox(formData.admission === 'Yes')} Oui
${checkbox(formData.admission === 'No')} Non
[br][/br]
[u]Procédure: [/u][br][/br]
${patientProcedure}
[br][/br]
[u]Médicaments / Traitements: [/u][br][/br]
${patientMedicine}
[br][/br]
[u]Suivi: [/u][br][/br]
${checkbox(formData.followup === 'AsNeeded')} Au besoin
${checkbox(formData.followup === 'Recommended')} Recommandé
${checkbox(formData.followup === 'Electiveprocedure')} Procédure élective 
[/left][/list][/table]
`;

        return bbCode;
    };
export default generateMentalHealthPBC;