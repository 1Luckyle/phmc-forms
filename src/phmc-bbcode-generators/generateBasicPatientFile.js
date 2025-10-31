const generateBasicPatientFile = (formData) => {
    const {
        patientName,
        patientAddress,
        patientRace,
        patientGender,
        patientPH,
        patientDiscord,
        patientEmergencyContact,
        patientEmergencyContactNumber,
        patientEmergencyContactRelation,
        patientEmergencyContactDiscord,
        patientTitle,
        patientAllergies,
        patientCurrentMedicine,
        patientChronicDiseases,
        patientNotes,
        paymentProofPhotos,
        patientDateOfBirth  ,
        patientID,
    } = formData;
            // Payment/Exempt logic
        let paymentSection = '';
        if (formData.isExempt === true || formData.isExempt === 'true') {
            paymentSection = 'Je suis exempté de payer ce service conformément aux politiques du PHMC.';
        } else if (paymentProofPhotos) {
            paymentSection = `[url=${paymentProofPhotos}]Preuve de paiement[/url]`;
        }

    let bbCode = `[table][tr][td][center][br][/br][br][/br][b]Informations du patient[/b]

[size=110]PATIENT ${patientID}

${patientName}
[/size]

[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][img]https://i.ibb.co/fdGgxDH1/LkRKav2.png[/img]
[b][size=150]INFORMATIONS DE BASE DU PATIENT[/size][/center][/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Informations générales[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Titre: ${patientTitle}[/td][td] Nom complet: ${patientName}
[tr][td] Date de naissance: ${patientDateOfBirth}  [/td][td] Adresse: ${patientAddress}
[tr][td] Identité de genre: ${patientGender} [/td][td] Origine ethnique: ${patientRace}
[tr][td] Numéro de téléphone: ${patientPH} [/td][td] (( Discord ID: ${patientDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Contact d'urgence[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Nom complet: ${patientEmergencyContact} [/td][td] Relation: ${patientEmergencyContactRelation}
[tr][td] Numéro de téléphone: ${patientEmergencyContactNumber} [/td][td] (( Discord ID: ${patientEmergencyContactDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Antécédents médicaux[/b][/color][/size][/center][/divboxcolor]
[table][tr][td][b][size=105]Historique passé[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
[tr][td] Groupe sanguin: [/td][td] [cb${formData.patientBloodType === 'A+' ? 'c' : ''}] A+ [cb${formData.patientBloodType === 'A-' ? 'c' : ''}] A- [cb${formData.patientBloodType === 'B+' ? 'c' : ''}] B+ [cb${formData.patientBloodType === 'B-' ? 'c' : ''}] B- [cb${formData.patientBloodType === 'O+' ? 'c' : ''}] O+ [cb${formData.patientBloodType === 'O-' ? 'c' : ''}] O- [cb${formData.patientBloodType === 'AB+' ? 'c' : ''}] AB+ [cb${formData.patientBloodType === 'AB-' ? 'c' : ''}] AB-
[tr][td] Allergies connues: [/td][td] ${patientAllergies}
[tr][td] Médicaments actuels: [/td][td] ${patientCurrentMedicine}
[tr][td] Maladies chroniques: [/td][td] ${patientChronicDiseases}
[tr][td] Traumatismes et blessures: [/td][td] ${patientNotes}
[/table] 

[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Paiement[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Veuillez joindre une confirmation non modifiée de votre paiement, sauf si vous êtes exempté. [size=70](voir la question 14 dans le fil FAQ sur la façon de payer)[/size][/td][td]
    ${paymentSection}
[/table]

`
    return bbCode;
    };
export default generateBasicPatientFile;