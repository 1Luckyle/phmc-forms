import { placeWithCity } from '../utils/places';
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
        causesOfDeath,
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
    } = formData;


    const legacyCauses = [causeA, causeB, causeC, causeD].filter((cause) => String(cause || '').trim());
    const causesText = String(causesOfDeath || '').trim() || legacyCauses.join(' ; ');
    const causesRow = `[tr]
[td bgcolor=#E6E6E6][b]Causes du décès[/b]: ${causesText || 'Non renseignées'}[/td]
[/tr]
`;

    let detailsBlock;
    if (deathRecordType === 'Unidentified') {
        detailsBlock = `[table]
${causesRow}[tr]
[td bgcolor=#E6E6E6][b]Couleur des cheveux[/b]: ${hairColor || 'N/A'}[/td]
[td bgcolor=#E6E6E6][b]Couleur des yeux[/b]: ${eyeColor || 'N/A'}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][b]Poids[/b]: ${weight || 'N/A'}[/td]
[td bgcolor=#E6E6E6][b]Taille[/b]: ${height || 'N/A'}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][b]Tatouages[/b]: ${tattoos || 'Aucun'}[/td]
[td bgcolor=#E6E6E6][b]Bijoux[/b]: ${jewelry || 'Aucun'}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][b]Commentaires[/b]: ${comments || 'Aucun'}[/td]
[/tr]
[/table]`;
    } else {
        detailsBlock = `[table]
${causesRow}[tr]
[td bgcolor=#E6E6E6][b]Autres informations significatives[/b]: ${otherSignificantConditions || 'Aucune'}[/td]
[/tr]
[/table]`;
    }

    const caseNumberDisplay = caseNumber || '';

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
[center][img]https://phmc-tools.com/img/death-record-header.png[/img][/center]
[/divbox]

[divbox=#4D4D4D][center][b][size=150]DOSSIER PUBLIC DU DÉFUNT[/size][/b][/center][/divbox]

[divbox=#000000][center][size=130]${decedentName || 'PRÉNOM (DEUXIÈME) & NOM ICI'}[/size][/center]
[center]Date du décès: ${formattedDateOfDeath}[/center]
[center]${deathRecordType === 'Unidentified' ? 'Âge approximatif' : 'Âge'}: ${age || '[ÂGE ICI]'}[/center][/divbox]

[table]
[tr]
[td bgcolor=#E6E6E6][b]Numéro de dossier[/b]: ${caseNumberDisplay}[/td]
[td bgcolor=#E6E6E6][b]Statut du dossier[/b]: ${caseStatus || ''}[/td]
[td bgcolor=#E6E6E6][b]Statut du corps[/b]: ${bodyStatus || ''}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][b]Genre à l'état civil[/b]: ${sex || ''}[/td]
[td bgcolor=#E6E6E6][b]Origine ethnique[/b]: ${ethnicity || ''}[/td]
[/tr]
[/table]

[table]
[tr]
[td bgcolor=#E6E6E6][b]Lieu du décès[/b]: ${placeWithCity(placeOfDeath, formData.placeOfDeathZip) || ''}[/td]
[td bgcolor=#E6E6E6][b]Mode de décès[/b]: ${manner || ''}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][b]Examinateur médical[/b]: ${coronerEmployee || ''}[/td]
[td bgcolor=#E6E6E6][b]Chef médecin légiste[/b]: ${chiefMedicalExaminerRank || 'Chef médecin légiste-Coroner'} ${chiefMedicalExaminer || ''}[/td]
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
