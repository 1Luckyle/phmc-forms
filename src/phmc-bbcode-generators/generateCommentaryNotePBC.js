const generateCommentaryNotePBC = (formData) => {
    const {
        phmcEmployee,
        date,
        patientID,
        patientNotes
    } = formData;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de session[/b]

ID PATIENT: ${patientID}

Date: ${date}

[/center][td][center][img]https://i.ibb.co/fdGgxDH1/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CLINIQUE DE PALETO BAY[/b]
PALETO BAY BLVD.
BP 685
PALETO BAY, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Note de commentaire[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Prénom Nom: [/u][br][/br]
${phmcEmployee}
[br][/br]
[u]Notes du patient: [/u]
${patientNotes}
[br][/br]
[u]Département: [/u][br][/br]
[cb${formData.departmentLarge === 'EmergencyMedicine' ? 'c' : ''}] Médecine d'urgence
[cb${formData.departmentLarge === 'InternalMedicine' ? 'c' : ''}] Médecine interne
[cb${formData.departmentLarge === 'Surgical' ? 'c' : ''}] Département chirurgical
[cb${formData.departmentLarge === 'Midwifery' ? 'c' : ''}] Maïeutique
[cb${formData.departmentLarge === 'PhysicalTherapy' ? 'c' : ''}] Thérapie physique
[cb${formData.departmentLarge === 'Dentistry' ? 'c' : ''}] Dentisterie
[cb${formData.departmentLarge === 'MentalHealth' ? 'c' : ''}] Santé mentale
[cb${formData.departmentLarge === 'Administration' ? 'c' : ''}] Administration
[br][/br][/left]
[/table]
    `
                    return bbCode;
                    };

export default generateCommentaryNotePBC;