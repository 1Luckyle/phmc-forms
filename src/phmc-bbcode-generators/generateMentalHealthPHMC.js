const generateMentalHealthPHMC = (formData) => {
        const {
            lastName,
            patientID,
            date,
            patientChiefComplaint,
            phmcRank,
            patientNotes, 
            patientDiagnosis,
            patientMedicine,
            patientProcedure,
        } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de session[/b]

PATIENT ${patientID}

Date: ${date}
Signé: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CENTRE MÉDICAL PILLBOX HILL[/b]
ELGIN AVE. / STRAWBERRY AVE.
BP 742
LOS SANTOS, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnèse[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Plainte principale: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Département assigné: [/u][br][/br]
[cbc] Santé mentale
[br][/br][/left]
[/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Constatations[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none]Notes: ${patientNotes}[/list][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Diagnostic de sortie[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Diagnostic primaire: [/u][br][/br]
${patientDiagnosis}[/list][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Thérapie[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Oui
[cb${formData.admission === 'No' ? 'c' : ''}] Non
[br][/br]
[u]Procédure: [/u][br][/br]
${patientProcedure}
[br][/br]
[u]Médicaments: [/u][br][/br]
${patientMedicine}
[br][/br]
[u]Suivi: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] Au besoin
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommandé
[cb${formData.followup === 'ElectiveProcedure' ? 'c' : ''}] Procédure élective 
[/left][/list][/table]
`;

        return bbCode;
    };
export default generateMentalHealthPHMC;