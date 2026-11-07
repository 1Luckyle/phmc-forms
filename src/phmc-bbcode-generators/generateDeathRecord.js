import { placeWithCity } from '../utils/places';
import { frDay } from '../utils/reportTitle';
import { sectionBanner, infoTable, paragraph } from './shared/bbStyles';

// Dossier public de décès (version 37) : bandeau d'en-tête public, fiche du défunt, dossier, circonstances, médecins légistes et mention de divulgation.
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

    const unidentified = deathRecordType === 'Unidentified';
    const legacyCauses = [causeA, causeB, causeC, causeD].filter((cause) => String(cause || '').trim());
    const causesText = String(causesOfDeath || '').trim() || legacyCauses.join(' ; ');

    const details = unidentified
        ? [
            [['Couleur des cheveux', hairColor || 'N/A'], ['Couleur des yeux', eyeColor || 'N/A']],
            [['Poids', weight || 'N/A'], ['Taille', height || 'N/A']],
            [['Tatouages', tattoos || 'Aucun'], ['Bijoux', jewelry || 'Aucun']],
            [['Commentaires', comments || 'Aucun']],
        ]
        : [[['Autres informations significatives', otherSignificantConditions || 'Aucune']]];

    const blocks = [
        `[divbox=#FFFFFF]\n[center][img]https://phmc-tools.com/img/death-record-header.png[/img][/center]\n[/divbox]`,
        sectionBanner('DOSSIER PUBLIC DU DÉFUNT', { size: 130 }),
        `[center][size=130][b]${decedentName || 'PRÉNOM (DEUXIÈME) & NOM ICI'}[/b][/size]\n${unidentified ? 'Âge approximatif' : 'Âge'}: ${age || '[ÂGE ICI]'} — Date du décès: ${frDay(dateOfDeath) || '[DATE ICI]'}[/center]`,
        sectionBanner('Dossier', { size: 115 }),
        infoTable([
            [['Numéro de dossier', caseNumber || ''], ['Statut du dossier', caseStatus || ''], ['Statut du corps', bodyStatus || '']],
            [['Genre à l\'état civil', sex || ''], ['Origine ethnique', ethnicity || '']],
        ]),
        sectionBanner('Circonstances du décès', { size: 115 }),
        infoTable([
            [['Lieu du décès', placeWithCity(placeOfDeath, formData.placeOfDeathZip) || ''], ['Mode de décès', manner || '']],
            [['Causes du décès', causesText || 'Non renseignées']],
        ]),
        sectionBanner(unidentified ? 'Description du défunt' : 'Informations complémentaires', { size: 115 }),
        infoTable(details),
        sectionBanner('Médecins légistes', { size: 115 }),
        infoTable([[['Examinateur médical', coronerEmployee || ''], ['Chef médecin légiste', `${chiefMedicalExaminerRank || 'Chef médecin légiste-Coroner'} ${chiefMedicalExaminer || ''}`.trim()]]]),
        sectionBanner('Divulgation', { size: 115 }),
        paragraph(`[size=85]Ces dossiers publics concernent uniquement les cas divulgués impliquant un médecin légiste du Département de Pathologie et de Médecine Légale. Il ne s'agit pas des dossiers de tous les décès survenus dans le comté de Los Santos.

Pour toute demande d'information sur les dossiers ou pour obtenir de la documentation supplémentaire:
Le Chef/Chef adjoint médecin légiste-Coroner peut être contacté par courriel via le portail en ligne du PHMC [url=]ICI[/url].
La ligne fixe du PHMC peut être jointe au numéro 50056 pour tout dossier physique ou pour le processus des proches parents.[/size]`),
    ];

    return blocks.filter(Boolean).join('\n');
};

export default generateDeathRecord;
