const generateCommentaryNotePBC = (formData) => {
    const {
        phmcEmployee,
        date,
        patientID,
        patientNotes
    } = formData;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Notes de service[/b]

ID PATIENT: ${patientID}

Date: ${date}

[/center][td][center][img]https://i.ibb.co/fdGgxDH1/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CLINIQUE DE PALETO BAY[/b]
PALETO BAY BLVD.
BP 685
PALETO BAY, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Note de commentaire[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Identifiants de l'employé: [/u][br][/br]
${phmcEmployee}
[br][/br]
[u]Notes du patient: [/u]
${patientNotes}
[br][/br]
[u]Département: [/u][br][/br]
[cb${formData.departmentLarge === 'EmergencyMedicine' ? 'c' : ''}] Service de Médecine d'Urgence
[cb${formData.departmentLarge === 'InternalMedicine' ? 'c' : ''}] Service de Médecine Interne
[cb${formData.departmentLarge === 'Surgical' ? 'c' : ''}] Département Chirurgical
[cb${formData.departmentLarge === 'Midwifery' ? 'c' : ''}] Service de Maternité-Obstétrique
[cb${formData.departmentLarge === 'PhysicalTherapy' ? 'c' : ''}] Service de Thérapie Physique
[cb${formData.departmentLarge === 'Dentistry' ? 'c' : ''}] Service de Dentisterie
[cb${formData.departmentLarge === 'MentalHealth' ? 'c' : ''}] Service de Psychiatrie / Psychologie
[cb${formData.departmentLarge === 'Administration' ? 'c' : ''}] Administration / Direction
[br][/br][/left]
[/table]
    `
                    return bbCode;
                    };

export default generateCommentaryNotePBC;