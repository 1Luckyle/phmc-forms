import { staffPaymentLine } from '../utils/patientBilling';
import withoutBlanks from './shared/withoutBlanks';
import { checkbox, sectionBanner } from './shared/bbStyles';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage). Les champs qui ne
// sont pertinents que si une autre case (mandataire, testament de vie "Autre")
// est cochée gardent une chaîne vide.
const NOT_FILLED = 'Non renseigné';

const generateMedicalFileUpdate = (formData) => {
    const {
        patientName = NOT_FILLED,
        patientAddress = NOT_FILLED,
        patientRace,
        patientGender,
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
        date = NOT_FILLED,
        patientID = NOT_FILLED,
        patientTherapy = NOT_FILLED,
        patientTriggers = NOT_FILLED,
        patientSupport = NOT_FILLED,
        patientHarm = NOT_FILLED,
        patientFam = NOT_FILLED,
        patientGenetic = NOT_FILLED,
        patientMental = NOT_FILLED,
        patientFamSocial = NOT_FILLED,
        patientReligion = NOT_FILLED,
        attorneyName = '',
        attorneyRelation = '',
        attorneyPH = '',
        patientDateOfBirth = NOT_FILLED,
        patientSmoker = NOT_FILLED,
        patientAlcohol = NOT_FILLED,
        patientDrugs = NOT_FILLED,
        patientExercise = NOT_FILLED,
        patientDiet = NOT_FILLED,
        patientSleep = NOT_FILLED,
        patientSexLife = NOT_FILLED,
        patientJobRisks = NOT_FILLED,
        patientHazards = NOT_FILLED,
        patientOther = NOT_FILLED,
        dnrOther = '',
        scenePhotos,
        UpdateMedicalFile, // Add this line
        patientBloodType,
        patientTitleNew = NOT_FILLED,
        patientNameNew = NOT_FILLED,
        patientDateOfBirthNew = NOT_FILLED,
        patientAddressNew = NOT_FILLED,
        patientPHNew = NOT_FILLED,
        patientDiscordNew = NOT_FILLED,
        patientGenderNew = NOT_FILLED,
        patientRaceNew = NOT_FILLED,
        paymentProofPhotos

    } = withoutBlanks(formData);

    // Payment/Exempt logic
    let paymentSection = '';
    if (formData.filledByStaff) {
        paymentSection = staffPaymentLine(26, formData);
    } else if (paymentProofPhotos) {
        paymentSection = `[url=${paymentProofPhotos}]Preuve de paiement[/url]`;
    }

    let bbCode = `[table][tr][td][center][br][/br][br][/br][b]Informations du patient[/b]

[size=110]PATIENT ${patientID}

${patientName}
[/size]

[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][img]https://i.ibb.co/fdGgxDH1/LkRKav2.png[/img]
[b][size=150]MISE À JOUR DES INFORMATIONS DU PATIENT[/size][/b][/center][/table]
${sectionBanner(`Informations du patient`, { size: 115 })}
[table][tr][td] Titre: ${patientTitle}[/td][td] Prénom (Deuxième Prénom) & Nom: ${patientName}
[tr][td] Date de naissance: ${patientDateOfBirth} [/td][td] Adresse: ${patientAddress}
[tr][td] Numéro de téléphone: ${patientPH} [/td][td] Email: ${patientEmail}
[tr][td] (( Pseudo Discord: ${patientDiscord}))
[/table]
${sectionBanner(`Informations mises à jour`, { size: 115 })}
[u]Je demande par la présente la mise à jour des informations suivantes:[/u]
[i](Cochez les champs pertinents en modifiant le préfixe [cb] en [cbc] et fournissez les nouvelles informations. Veuillez fournir les informations complètes pour les catégories demandées (cochées!), y compris les informations non mises à jour. N'ajoutez pas d'informations dans les catégories que vous n'avez pas cochées![/i]

`;

    if (UpdateMedicalFile?.includes('GeneralInformation')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [b] Informations générales[/b]
[altspoiler=Nouvelles informations générales]
[table][tr][td] Titre: ${patientTitleNew}[/td][td] Prénom (Deuxième Prénom) & Nom: ${patientNameNew}
[tr][td] Date de naissance: ${patientDateOfBirthNew} [/td][td] Adresse: ${patientAddressNew}
[tr][td] Genre à l'état civil: ${patientGenderNew} [/td][td] Origine ethnique: ${patientRaceNew}
[tr][td] Numéro de téléphone: ${patientPHNew} [/td][td] (( Pseudo Discord: ${patientDiscordNew}))
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('EmergencyContact')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [b] Contact d'urgence[/b]
[altspoiler=Nouveaux détails du contact d'urgence]
[table][tr][td] Prénom (Deuxième Prénom) & Nom: ${patientEmergencyContact} [/td][td] Relation: ${patientEmergencyContactRelation}
[tr][td] Numéro de téléphone: ${patientEmergencyContactNumber} [/td][td] (( Pseudo Discord: ${patientEmergencyContactDiscord}))
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('MedicalHistory')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [b] Antécédents médicaux[/b]
        [altspoiler=Nouveaux antécédents médicaux]

[table][tr][td][b][size=105]Historique passé[/size][/b][/td][td]
[tr][td] Groupe sanguin: [/td][td] ${checkbox(patientBloodType === 'A+')} A+ ${checkbox(patientBloodType === 'A-')} A- ${checkbox(patientBloodType === 'B+')} B+ ${checkbox(patientBloodType === 'B-')} B- ${checkbox(patientBloodType === 'O+')} O+ ${checkbox(patientBloodType === 'O-')} O- ${checkbox(patientBloodType === 'AB+')} AB+ ${checkbox(patientBloodType === 'AB-')} AB-
[tr][td] Allergies connues: [/td][td] ${patientAllergies}
[tr][td] Médicaments actuels: [/td][td] ${patientCurrentMedicine}
[tr][td] Maladies chroniques: [/td][td] ${patientChronicDiseases}
[tr][td] Traumatismes et blessures: [/td][td] ${patientNotes}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('MentalHealth')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [b] Antécédents de santé mentale[/b]
        [altspoiler=Nouveaux antécédents de santé mentale]
[table][tr][td] Troubles de santé mentale diagnostiqués: [/td][td] ${patientMental}
[tr][td] Thérapies et séances de conseil: [/td][td] ${patientTherapy}
[tr][td] Déclencheurs ou phobies sensoriels: [/td][td] ${patientTriggers}
[tr][td] Systèmes de soutien et mécanismes d'adaptation personnels: [/td][td] ${patientSupport}
[tr][td] Antécédents d'automutilation / tentatives ou danger pour autrui: [/td][td] ${patientHarm}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('FamilyMedicalHistory')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [b] Antécédents médicaux familiaux[/b]
        [altspoiler=Nouveaux antécédents médicaux familiaux]
[table][tr][td][b][size=105]Historique passé[/size][/b][/td][td]
[tr][td] Membres de la famille immédiate: [/td][td] ${patientFam}
[tr][td] Maladies génétiques connues: [/td][td] ${patientGenetic}
[tr][td] Antécédents sociaux familiaux: [/td][td] ${patientFamSocial}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('SocialInformation')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [b]Informations sociales[/b]
        [altspoiler=Nouvelles informations sociales]
[table][tr][td] État civil: ${checkbox(formData.maritalStatus === 'Single')} Célibataire ${checkbox(formData.maritalStatus === 'DomesticPartnership')} En couple / Union civile ${checkbox(formData.maritalStatus === 'Married')} Marié(e) ${checkbox(formData.maritalStatus === 'Divorced')} Divorcé(e) ${checkbox(formData.maritalStatus === 'Widowed')} Veuf(ve) [/td][td] Nombre d'enfants: ${checkbox(formData.numberChildren === '0')} 0 ${checkbox(formData.numberChildren === '1')} 1 ${checkbox(formData.numberChildren === '2')} 2 ${checkbox(formData.numberChildren === '3+')} 3 ou plus
[tr][td] Considérations culturelles et/ou religieuses: ${patientReligion} [/td][td] Situation financière: ${checkbox(formData.financialStatus === 'LowIncome')} Faible revenu ${checkbox(formData.financialStatus === 'MiddleIncome')} Revenu moyen ${checkbox(formData.financialStatus === 'HighIncome')} Revenu élevé
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('LifestyleInformation')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [b] Informations sur le mode de vie[/b]
        [altspoiler=Nouvelles informations sur le mode de vie]
[table][tr][td] Statut tabagique: ${patientSmoker} [/td][td] Consommation d'alcool: ${patientAlcohol}[/td][td] Autres substances: ${patientDrugs}
[tr][td] Habitudes d'exercice: ${patientExercise}[/td][td] Informations diététiques: ${patientDiet}[/td][td] Habitudes de sommeil: ${patientSleep}
[tr][td] Santé sexuelle: ${patientSexLife}[/td][td] Risques professionnels: ${patientJobRisks}[/td][td] Risques environnementaux: ${patientHazards}[/table]
[table][tr][td] Autres informations et préférences: ${patientOther}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('AdvancedDirectives')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [b] Directives anticipées [/b]
        [altspoiler=Nouvelles directives anticipées]
[divbox=transparent][list=none]Je soussigné(e), ${patientName}, fournis par la présente les directives anticipées suivantes concernant mes soins de santé, à suivre dans l'éventualité où je deviendrais incapable de prendre des décisions concernant mon traitement médical:

[list=1][*] [size=110]Testament de vie[/size]: Dans l'éventualité où je serais incapable de communiquer, je demande ce qui suit concernant les traitements de maintien de la vie:
${checkbox(formData.dnr === 'ProlongLife')}[/cb${formData.dnr === 'ProlongLife' ? 'c' : ''}]Je veux que toutes les mesures disponibles soient prises pour prolonger ma vie.
${checkbox(formData.dnr === 'ComfortOfLife')}[/cb${formData.dnr === 'ComfortOfLife' ? 'c' : ''}]Je ne veux que des traitements axés sur le confort et la qualité de vie, même si cela signifie ne pas prolonger la vie.
${checkbox(formData.dnr === 'other')}[/cb${formData.dnr === 'other' ? 'c' : ''}]Autres instructions: ${dnrOther}

[*][size=110]Procuration en matière de soins de santé[/size]:
${checkbox(formData.attorney === 'Yes')}[/cb${formData.attorney === 'Yes' ? 'c' : ''}]J'ai désigné la personne suivante comme mon mandataire/représentant en matière de soins de santé pour prendre des décisions médicales en mon nom:
[list=none]Prénom (Deuxième Prénom) & Nom: ${attorneyName}
Relation avec le patient: ${attorneyRelation}
Numéro de téléphone: ${attorneyPH}[/list]

${checkbox(formData.attorney === 'No')}[/cb${formData.attorney === 'No' ? 'c' : ''}]Je n'ai pas désigné de mandataire/représentant en matière de soins de santé pour le moment.
[*] [size=110]Ordre de non-réanimation (DNR)[/size]:
${checkbox(formData.dnrOrder === 'Yes')}[/cb${formData.dnrOrder === 'Yes' ? 'c' : ''}]J'ai un ordre DNR en place, demandant au personnel médical de ne pas effectuer de RCR ou d'autres mesures de sauvetage si mon cœur s'arrête.
${checkbox(formData.dnrOrder === 'No')}[/cb${formData.dnrOrder === 'No' ? 'c' : ''}]Je n'ai pas d'ordre DNR en place pour le moment.

[*][size=110]Consentement au partage des directives anticipées[/size]:
J'autorise le Pillbox Hill Medical Center à conserver une copie de mes directives anticipées dans mon dossier médical et à partager cette information avec le personnel médical et les services d'urgence au besoin pour garantir le respect de mes volontés en matière de soins de santé.[/list]
Je comprends que je peux réviser ou révoquer ces directives à tout moment en fournissant un avis écrit.

Signature: [i][u]${patientName}[/u][/i]
Date: ${date}[/divbox][/altspoiler]`;
    }

    bbCode += `
${sectionBanner(`Clause de non-responsabilité`, { size: 115 })}
[divbox=transparent][list=none]Je soussigné(e), ${patientName}, déclare par la présente que les informations fournies dans ce formulaire d'antécédents médicaux sont vraies, exactes et complètes selon mes meilleures connaissances. Je comprends que ces informations seront stockées en toute sécurité dans les systèmes du Pillbox Hill Medical Center et peuvent être consultées par les professionnels de la santé autorisés impliqués dans mes soins.

Je soussigné(e), ${patientName}, en soumettant ce formulaire, consens au partage de mes informations médicales entre les professionnels de la santé du Pillbox Hill Medical Center dans le but de fournir des services de soins de santé complets et coordonnés. Je reconnais que ces informations peuvent être utilisées pour le diagnostic, le traitement et d'autres activités liées aux soins de santé conformément aux lois et règlements applicables, y compris la loi sur la portabilité et la responsabilité en matière d'assurance maladie (HIPAA).

Je soussigné(e), ${patientName}, conserve le droit de révoquer ce consentement à tout moment en avisant le Pillbox Hill Medical Center par écrit. Cependant, je comprends également que la révocation du consentement peut limiter la capacité des professionnels de la santé à me fournir des soins optimaux et coordonnés.[/list][/divbox]
${sectionBanner(`Paiement`, { size: 115 })}
[table][tr][td] ${formData.filledByStaff ? 'Paiement à régler par le patient :' : 'Veuillez joindre une confirmation non modifiée de votre paiement, sauf si vous êtes exempté.'}[/td][td]
    ${paymentSection || 'Aucune preuve de paiement fournie'}
[/table]`;

    return bbCode;
};

export default generateMedicalFileUpdate;
