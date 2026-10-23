import { staffPaymentLine } from '../utils/patientBilling';
import withoutBlanks from './shared/withoutBlanks';
import { checkbox, sectionBanner } from './shared/bbStyles';
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
    } = withoutBlanks(formData);
            // Payment/Exempt logic
        let paymentSection = '';
        if (formData.filledByStaff) {
            paymentSection = staffPaymentLine(25, formData);
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
[b][size=150]INFORMATIONS DE BASE DU PATIENT[/size][/b][/center][/table]
${sectionBanner(`Informations générales`, { size: 115 })}
[table][tr][td] Titre: ${patientTitle}[/td][td] Prénom (Deuxième Prénom) & Nom: ${patientName}
[tr][td] Date de naissance: ${patientDateOfBirth}  [/td][td] Adresse: ${patientAddress}
[tr][td] Genre à l'état civil: ${patientGender} [/td][td] Origine ethnique: ${patientRace}
[tr][td] Numéro de téléphone: ${patientPH} [/td][td] Email: ${patientEmail}
[tr][td] (( Pseudo Discord: ${patientDiscord}))
[/table]
${sectionBanner(`Contact d'urgence`, { size: 115 })}
[table][tr][td] Prénom (Deuxième Prénom) & Nom: ${patientEmergencyContact} [/td][td] Relation: ${patientEmergencyContactRelation}
[tr][td] Numéro de téléphone: ${patientEmergencyContactNumber} [/td][td] (( Pseudo Discord: ${patientEmergencyContactDiscord}))
[/table]
${sectionBanner(`Antécédents médicaux`, { size: 115 })}
[table][tr][td][b][size=105]Historique passé[/size][/b][/td][td]
[tr][td] Groupe sanguin: [/td][td] ${checkbox(formData.patientBloodType === 'A+')} A+ ${checkbox(formData.patientBloodType === 'A-')} A- ${checkbox(formData.patientBloodType === 'B+')} B+ ${checkbox(formData.patientBloodType === 'B-')} B- ${checkbox(formData.patientBloodType === 'O+')} O+ ${checkbox(formData.patientBloodType === 'O-')} O- ${checkbox(formData.patientBloodType === 'AB+')} AB+ ${checkbox(formData.patientBloodType === 'AB-')} AB-
[tr][td] Allergies connues: [/td][td] ${patientAllergies}
[tr][td] Médicaments actuels: [/td][td] ${patientCurrentMedicine}
[tr][td] Maladies chroniques: [/td][td] ${patientChronicDiseases}
[tr][td] Traumatismes et blessures: [/td][td] ${patientNotes}
[/table] 

${sectionBanner(`Paiement`, { size: 115 })}
[table][tr][td] Veuillez joindre une confirmation non modifiée de votre paiement, sauf si vous êtes exempté.[/td][td]
    ${paymentSection}
[/table]

`
    return bbCode;
    };
export default generateBasicPatientFile;