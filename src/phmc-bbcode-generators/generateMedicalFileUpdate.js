const generateMedicalFileUpdate = (formData) => {
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
        date,
        patientID,
        patientTherapy,
        patientTriggers,
        patientSupport,
        patientHarm,
        patientFam,
        patientGenetic,
        patientMental,
        patientFamSocial,
        patientReligion,
        attorneyName,
        attorneyRelation,
        attorneyPH,
        patientDateOfBirth,
        patientSmoker,
        patientAlcohol,
        patientDrugs,
        patientExercise,
        patientDiet,
        patientSleep,
        patientSexLife,
        patientJobRisks,
        patientHazards,
        patientOther,
        dnrOther,
        scenePhotos,
        UpdateMedicalFile, // Add this line
        patientBloodType,
        patientTitleNew,
        patientNameNew,
        patientDateOfBirthNew,
        patientAddressNew,
        patientPHNew,
        patientDiscordNew,
        patientGenderNew,
        patientRaceNew

    } = formData;

    let bbCode = `[table][tr][td][center][br][/br][br][/br][b]Informations du patient[/b]

[size=110]PATIENT ${patientID}

${patientName}
[/size]

[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][img]https://i.ibb.co/fdGgxDH1/LkRKav2.png[/img]
[b][size=150]MISE À JOUR DES INFORMATIONS DU PATIENT[/size][/center][/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Informations du patient[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Titre: ${patientTitle}[/td][td] Nom complet: ${patientName}
[tr][td] Date de naissance: ${patientDateOfBirth} [/td][td] Adresse: ${patientAddress}
[tr][td] Numéro de téléphone: ${patientPH} [/td][td] (( Discord ID: ${patientDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Informations mises à jour[/b][/color][/size][/center][/divboxcolor]
[u]Je demande par la présente la mise à jour des informations suivantes:[/u]
[i](Cochez les champs pertinents en modifiant le préfixe [cb] en [cbc] et fournissez les nouvelles informations. Veuillez fournir les informations complètes pour les catégories demandées (cochées!), y compris les informations non mises à jour. N'ajoutez pas d'informations dans les catégories que vous n'avez pas cochées![/i]

`;

    if (UpdateMedicalFile?.includes('GeneralInformation')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Informations générales[/bold]
[altspoiler=Nouvelles informations générales]
[table][tr][td] Titre: ${patientTitleNew}[/td][td] Nom complet: ${patientNameNew}
[tr][td] Date de naissance: ${patientDateOfBirthNew} [/td][td] Adresse: ${patientAddressNew}
[tr][td] Identité de genre: ${patientGenderNew} [/td][td] Origine ethnique: ${patientRaceNew}
[tr][td] Numéro de téléphone: ${patientPHNew} [/td][td] (( Discord ID: ${patientDiscordNew}))
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('EmergencyContact')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Contact d'urgence[/bold]
[altspoiler=Nouveaux détails du contact d'urgence]
[table][tr][td] Nom complet: ${patientEmergencyContact} [/td][td] Relation: ${patientEmergencyContactRelation}
[tr][td] Numéro de téléphone: ${patientEmergencyContactNumber} [/td][td] (( Discord ID: ${patientEmergencyContactDiscord}))
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('MedicalHistory')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Antécédents médicaux[/bold]
        [altspoiler=Nouveaux antécédents médicaux]

[table][tr][td][b][size=105]Historique passé[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
[tr][td] Groupe sanguin: [/td][td] [cb${patientBloodType === 'A+' ? 'c' : ''}] A+ [cb${patientBloodType === 'A-' ? 'c' : ''}] A- [cb${patientBloodType === 'B+' ? 'c' : ''}] B+ [cb${patientBloodType === 'B-' ? 'c' : ''}] B- [cb${patientBloodType === 'O+' ? 'c' : ''}] O+ [cb${patientBloodType === 'O-' ? 'c' : ''}] O- [cb${patientBloodType === 'AB+' ? 'c' : ''}] AB+ [cb${patientBloodType === 'AB-' ? 'c' : ''}] AB-
[tr][td] Allergies connues: [/td][td] ${patientAllergies}
[tr][td] Médicaments actuels: [/td][td] ${patientCurrentMedicine}
[tr][td] Maladies chroniques: [/td][td] ${patientChronicDiseases}
[tr][td] Traumatismes et blessures: [/td][td] ${patientNotes}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('MentalHealth')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Antécédents de santé mentale[/bold]
        [altspoiler=Nouveaux antécédents de santé mentale]
[table][tr][td] Troubles de santé mentale diagnostiqués: [/td][td] ${patientMental}
[tr][td] Thérapies et conseils: [/td][td] ${patientTherapy}
[tr][td] Déclencheurs ou sensibilités: [/td][td] ${patientTriggers}
[tr][td] Systèmes de soutien et d'adaptation: [/td][td] ${patientSupport}
[tr][td] Antécédents ou tendances d'automutilation: [/td][td] ${patientHarm}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('FamilyMedicalHistory')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Antécédents médicaux familiaux[/bold]
        [altspoiler=Nouveaux antécédents médicaux familiaux]
[table][tr][td][b][size=105]Historique passé[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
[tr][td] Membres de la famille immédiate: [/td][td] ${patientFam}
[tr][td] Maladies génétiques connues: [/td][td] ${patientGenetic}
[tr][td] Antécédents sociaux familiaux: [/td][td] ${patientFamSocial}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('SocialInformation')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold]Informations sociales[/bold]
        [altspoiler=Nouvelles informations sociales]
[table][tr][td] Statut marital: [cb${formData.maritalStatus === 'Single' ? 'c' : ''}] Célibataire [cb${formData.maritalStatus === 'Married' ? 'c' : ''}] Marié(e) [cb${formData.maritalStatus === 'Divorced' ? 'c' : ''}] Divorcé(e)/Veuf(ve) [/td][td] Nombre d'enfants: [cb${formData.numberChildren === '0' ? 'c' : ''}] 0 [cb${formData.numberChildren === '1' ? 'c' : ''}] 1 ou plus
[tr][td] Considérations culturelles et/ou religieuses: ${patientReligion} [/td][td] Situation financière: [cb${formData.financialStatus === 'LowIncome' ? 'c' : ''}] Faible revenu [cb${formData.financialStatus === 'MiddleIncome' ? 'c' : ''}] Revenu moyen [cb${formData.financialStatus === 'HighIncome' ? 'c' : ''}] Revenu élevé
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('LifestyleInformation')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Informations sur le mode de vie[/bold]
        [altspoiler=Nouvelles informations sur le mode de vie]
[table][tr][td] Statut tabagique: ${patientSmoker} [/td][td] Consommation d'alcool: ${patientAlcohol}[/td][td] Autres substances: ${patientDrugs}
[tr][td] Habitudes d'exercice: ${patientExercise}[/td][td] Informations diététiques: ${patientDiet}[/td][td] Habitudes de sommeil: ${patientSleep}
[tr][td] Santé sexuelle: ${patientSexLife}[/td][td] Risques professionnels: ${patientJobRisks}[/td][td] Risques environnementaux: ${patientHazards}[/table]
[table][tr][td] Autres informations et préférences: ${patientOther}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('AdvancedDirectives')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Directives anticipées [/bold]
        [altspoiler=Nouvelles directives anticipées]
[divbox=transparent][list=none]Je soussigné(e), ${patientName}, fournis par la présente les directives anticipées suivantes concernant mes soins de santé, à suivre dans l'éventualité où je deviendrais incapable de prendre des décisions concernant mon traitement médical:

[list=1][*] [size=110]Testament de vie[/size]: Dans l'éventualité où je serais incapable de communiquer, je demande ce qui suit concernant les traitements de maintien de la vie:
[cb${formData.dnr === 'ProlongLife' ? 'c' : ''}][/cb${formData.dnr === 'ProlongLife' ? 'c' : ''}]Je veux que toutes les mesures disponibles soient prises pour prolonger ma vie.
[cb${formData.dnr === 'ComfortOfLife' ? 'c' : ''}][/cb${formData.dnr === 'ComfortOfLife' ? 'c' : ''}]Je ne veux que des traitements axés sur le confort et la qualité de vie, même si cela signifie ne pas prolonger la vie.
[cb${formData.dnr === 'other' ? 'c' : ''}][/cb${formData.dnr === 'other' ? 'c' : ''}]Autres instructions: ${dnrOther}

[*][size=110]Procuration en matière de soins de santé[/size]:
[cb${formData.attorney === 'Yes' ? 'c' : ''}][/cb${formData.attorney === 'Yes' ? 'c' : ''}]J'ai désigné la personne suivante comme mon mandataire/représentant en matière de soins de santé pour prendre des décisions médicales en mon nom:
[list=none]Nom complet: ${attorneyName}
Relation avec le patient: ${attorneyRelation}
Numéro de téléphone: ${attorneyPH}[/list]

[cb${formData.attorney === 'No' ? 'c' : ''}][/cb${formData.attorney === 'No' ? 'c' : ''}]Je n'ai pas désigné de mandataire/représentant en matière de soins de santé pour le moment.
[*] [size=110]Ordre de non-réanimation (DNR)[/size]:
[cb${formData.dnrOrder === 'Yes' ? 'c' : ''}][/cb${formData.dnrOrder === 'Yes' ? 'c' : ''}]J'ai un ordre DNR en place, demandant au personnel médical de ne pas effectuer de RCR ou d'autres mesures de sauvetage si mon cœur s'arrête.
[cb${formData.dnrOrder === 'No' ? 'c' : ''}][/cb${formData.dnrOrder === 'No' ? 'c' : ''}]Je n'ai pas d'ordre DNR en place pour le moment.

[*][size=110]Consentement au partage des directives anticipées[/size]:
J'autorise le Pillbox Hill Medical Center à conserver une copie de mes directives anticipées dans mon dossier médical et à partager cette information avec le personnel médical et les services d'urgence au besoin pour garantir le respect de mes volontés en matière de soins de santé.[/list]
Je comprends que je peux réviser ou révoquer ces directives à tout moment en fournissant un avis écrit.

Signature: [i][u]${patientName}[/u][/i]
Date: ${date}[/divbox][/altspoiler]`;
    }

    bbCode += `
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Clause de non-responsabilité[/b][/color][/size][/center][/divboxcolor]
[divbox=transparent][list=none]Je soussigné(e), ${patientName}, déclare par la présente que les informations fournies dans ce formulaire d'antécédents médicaux sont vraies, exactes et complètes selon mes meilleures connaissances. Je comprends que ces informations seront stockées en toute sécurité dans les systèmes du Pillbox Hill Medical Center et peuvent être consultées par les professionnels de la santé autorisés impliqués dans mes soins.

Je soussigné(e), ${patientName}, en soumettant ce formulaire, consens au partage de mes informations médicales entre les professionnels de la santé du Pillbox Hill Medical Center dans le but de fournir des services de soins de santé complets et coordonnés. Je reconnais que ces informations peuvent être utilisées pour le diagnostic, le traitement et d'autres activités liées aux soins de santé conformément aux lois et règlements applicables, y compris la loi sur la portabilité et la responsabilité en matière d'assurance maladie (HIPAA).

Je soussigné(e), ${patientName}, conserve le droit de révoquer ce consentement à tout moment en avisant le Pillbox Hill Medical Center par écrit. Cependant, je comprends également que la révocation du consentement peut limiter la capacité des professionnels de la santé à me fournir des soins optimaux et coordonnés.[/list][/divbox]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Paiement[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Veuillez joindre une confirmation non modifiée de votre paiement, sauf si vous êtes exempté. [size=70](voir la question 14 dans le fil FAQ sur la façon de payer)[/size][/td][td]
${scenePhotos ? `[url=${scenePhotos}]Preuve de paiement[/url]` : 'Aucune preuve de paiement fournie'}
[/table]`;

    return bbCode;
};

export default generateMedicalFileUpdate;
