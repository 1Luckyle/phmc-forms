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
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Anamnèse[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Plainte principale: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Département assigné: [/u][br][/br]
[cbc] Santé mentale
[br][/br][/left]
[/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Constatations[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none]Notes: ${patientNotes}[/list][/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Diagnostic de sortie[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Diagnostic primaire: [/u][br][/br]
${patientDiagnosis}[/list][/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Thérapie[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Oui
[cb${formData.admission === 'No' ? 'c' : ''}] Non
[br][/br]
[u]Procédure: [/u][br][/br]
${patientProcedure}
[br][/br]
[u]Médicaments / Traitements: [/u][br][/br]
${patientMedicine}
[br][/br]
[u]Suivi: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] Au besoin
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommandé
[cb${formData.followup === 'Electiveprocedure' ? 'c' : ''}] Procédure élective 
[/left][/list][/table]
`;

        return bbCode;
    };
export default generateMentalHealthPBC;