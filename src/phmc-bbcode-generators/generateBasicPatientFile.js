// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';

const generateBasicPatientFile = (formData) => {
    const {
        patientName = NOT_FILLED,
        patientAddress = NOT_FILLED,
        patientRace = NOT_FILLED,
        patientGender = NOT_FILLED,
        patientPH = NOT_FILLED,
        patientEmail = NOT_FILLED,
        patientDiscord = NOT_FILLED,
        patientEmergencyContact = NOT_FILLED,
        patientEmergencyContactNumber = NOT_FILLED,
        patientEmergencyContactRelation = NOT_FILLED,
        patientEmergencyContactDiscord = NOT_FILLED,
        patientTitle = NOT_FILLED,
        patientAllergies = NOT_FILLED,
        patientCurrentMedicine = NOT_FILLED,
        patientChronicDiseases = NOT_FILLED,
        patientNotes = NOT_FILLED,
        paymentProofPhotos,
        patientDateOfBirth = NOT_FILLED,
        patientID = NOT_FILLED,
    } = formData;
            // Payment/Exempt logic
        let paymentSection = '';
        if (formData.filledByStaff) {
            paymentSection = 'Rempli par le personnel PHMC — le paiement est à la charge du civil et ne se fait pas via cet outil.';
        } else if (formData.isExempt === true || formData.isExempt === 'true') {
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
[table][tr][td] Titre: ${patientTitle}[/td][td] Prénom (Deuxième Prénom) & Nom: ${patientName}
[tr][td] Date de naissance: ${patientDateOfBirth}  [/td][td] Adresse: ${patientAddress}
[tr][td] Genre à l'état civil: ${patientGender} [/td][td] Origine ethnique: ${patientRace}
[tr][td] Numéro de téléphone: ${patientPH} [/td][td] Email: ${patientEmail}
[tr][td] (( Pseudo Discord: ${patientDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Contact d'urgence[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Prénom (Deuxième Prénom) & Nom: ${patientEmergencyContact} [/td][td] Relation: ${patientEmergencyContactRelation}
[tr][td] Numéro de téléphone: ${patientEmergencyContactNumber} [/td][td] (( Pseudo Discord: ${patientEmergencyContactDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Antécédents médicaux[/b][/color][/size][/center][/divboxcolor]
[table][tr][td][b][size=105]Historique passé[/size][/b][/td][td]
[tr][td] Groupe sanguin: [/td][td] [cb${formData.patientBloodType === 'A+' ? 'c' : ''}] A+ [cb${formData.patientBloodType === 'A-' ? 'c' : ''}] A- [cb${formData.patientBloodType === 'B+' ? 'c' : ''}] B+ [cb${formData.patientBloodType === 'B-' ? 'c' : ''}] B- [cb${formData.patientBloodType === 'O+' ? 'c' : ''}] O+ [cb${formData.patientBloodType === 'O-' ? 'c' : ''}] O- [cb${formData.patientBloodType === 'AB+' ? 'c' : ''}] AB+ [cb${formData.patientBloodType === 'AB-' ? 'c' : ''}] AB-
[tr][td] Allergies connues: [/td][td] ${patientAllergies}
[tr][td] Médicaments actuels: [/td][td] ${patientCurrentMedicine}
[tr][td] Maladies chroniques: [/td][td] ${patientChronicDiseases}
[tr][td] Traumatismes et blessures: [/td][td] ${patientNotes}
[/table] 

[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Paiement[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Veuillez joindre une confirmation non modifiée de votre paiement, sauf si vous êtes exempté.[/td][td]
    ${paymentSection}
[/table]

`
    return bbCode;
    };
export default generateBasicPatientFile;