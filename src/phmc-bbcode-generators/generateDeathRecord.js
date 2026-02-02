const generateDeathRecord = (formData) => {
    const {
        caseNumber,
        caseStatus,
        bodyStatus,
        sex,
        ethnicity,
        placeOfDeath,
        manner,
        coronerEmployee,
        chiefMedicalExaminer,
        chiefMedicalExaminerRank,
        causeA,
        causeB,
        causeC,
        causeD,
        otherSignificantConditions,
        deathRecordType,
        hairColor,
        eyeColor,
        weight,
        height,
        tattoos,
        jewelry,
        comments,
        decedentName,
        dateOfDeath,
        age,
        deathReportPostId,
    } = formData;


    let detailsBlock;
    if (deathRecordType === 'Unidentified') {
        detailsBlock = `[table]
[tr]
[td bgcolor=#E6E6E6][bold]Couleur des cheveux[/bold]: ${hairColor || 'N/A'}[/td]
[td bgcolor=#E6E6E6][bold]Couleur des yeux[/bold]: ${eyeColor || 'N/A'}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Poids[/bold]: ${weight || 'N/A'}[/td]
[td bgcolor=#E6E6E6][bold]Taille[/bold]: ${height || 'N/A'}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Tatouages[/bold]: ${tattoos || 'Aucun'}[/td]
[td bgcolor=#E6E6E6][bold]Bijoux[/bold]: ${jewelry || 'Aucun'}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Commentaires[/bold]: ${comments || 'Aucun'}[/td]
[/tr]
[/table]`;
    } else {
        detailsBlock = `[table]
[tr]
[td bgcolor=#E6E6E6][bold]Cause A[/bold]: ${causeA || ''}[/td]
[td bgcolor=#E6E6E6][bold]Cause B[/bold]: ${causeB || ''}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Cause C[/bold]: ${causeC || ''}[/td]
[td bgcolor=#E6E6E6][bold]Cause D[/bold]: ${causeD || ''}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Autres informations significatives[/bold]: ${otherSignificantConditions || 'Aucune'}[/td]
[/tr]
[/table]`;
    }

    const caseNumberDisplay = deathReportPostId 
        ? `[url=${deathReportPostId}]${caseNumber}[/url]` 
        : caseNumber || '';

    let formattedDateOfDeath = '[DATE ICI]';
    if (dateOfDeath) {
        const date = new Date(dateOfDeath + 'T00:00:00');
        formattedDateOfDeath = date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    const bbCode = `[divbox=#FFFFFF]
[center][img]https://i.ibb.co/Rk5bRDxX/image.png[/img][/center]
[/divbox]

[divbox=#4D4D4D][center][bold][size=150]DOSSIER PUBLIC DU DÉFUNT[/size][/bold][/center][/divbox]

[divbox=#000000][center][size=130]${decedentName || 'PRÉNOM (DEUXIÈME) & NOM ICI'}[/size][/center]
[center]Date du décès: ${formattedDateOfDeath}[/center]
[center]${deathRecordType === 'Unidentified' ? 'Âge approximatif' : 'Âge'}: ${age || '[ÂGE ICI]'}[/center][/divbox]

[table]
[tr]
[td bgcolor=#E6E6E6][bold]Numéro de dossier[/bold]: ${caseNumberDisplay}[/td]
[td bgcolor=#E6E6E6][bold]Statut du dossier[/bold]: ${caseStatus || ''}[/td]
[td bgcolor=#E6E6E6][bold]Statut du corps[/bold]: ${bodyStatus || ''}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Genre à l'état civil[/bold]: ${sex || ''}[/td]
[td bgcolor=#E6E6E6][bold]Origine ethnique[/bold]: ${ethnicity || ''}[/td]
[/tr]
[/table]

[table]
[tr]
[td bgcolor=#E6E6E6][bold]Lieu du décès[/bold]: ${placeOfDeath || ''}[/td]
[td bgcolor=#E6E6E6][bold]Mode de décès[/bold]: ${manner || ''}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Examinateur médical[/bold]: ${coronerEmployee || ''}[/td]
[td bgcolor=#E6E6E6][bold]Chef médecin légiste[/bold]: ${chiefMedicalExaminerRank || 'Chef médecin légiste-Coroner'} ${chiefMedicalExaminer || ''}[/td]
[/tr]
[/table]

${detailsBlock}

[divbox=#4D4D4D][center][b]Ces dossiers publics concernent uniquement les cas divulgués impliquant un médecin légiste du Département de Pathologie et de Médecine Légale. 
Il ne s'agit pas des dossiers de tous les décès survenus dans le comté de Los Santos.

Pour toute demande d'information sur les dossiers ou pour obtenir de la documentation supplémentaire:
Le Chef/Chef adjoint médecin légiste-Coroner peut être contacté par courriel via le portail en ligne du PHMC [url=]ICI[/url].
La ligne fixe du PHMC peut être jointe au numéro 50056 pour tout dossier physique ou pour le processus des proches parents.[/b][/center][/divbox]`;

    return bbCode;
};

export default generateDeathRecord;
