import { buildDecedentDescription } from './shared/decedentDescription';
import { requestingAuthorityText } from './shared/requestingAuthority';
import { frDeath } from '../utils/deathLabels';
import { placeWithCity } from '../utils/places';
import { sectionBanner, dmecHeader, infoTable, paragraph, labelledRows } from './shared/bbStyles';

// Liste numérotée (ou en lettres) d'éléments saisis un par un ; « N/A » quand la liste est vide.
const itemList = (items, kind) => {
    const clean = (Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean);
    if (clean.length === 0) return `[list=${kind}][*]N/A[/list]`;
    return `[list=${kind}]${clean[0]}${clean.length > 1 ? `\n${clean.slice(1).map((item) => `[*]${item}`).join('\n')}` : ''}\n[/list]`;
};

// Rapport d'autopsie (version 4) : en-tête à deux cellules, identification, causes du décès, diagramme, constatations (une ligne par rubrique), avis et signatures.
const generateAutopsy = (formData) => {
    const {
        coronerRank,
        coronerEmployee,
        chiefCoronerRank,
        chiefCoronerEmployee,
        synopsis,       // Avis du médecin légiste
        decedentName,
        externalExamination,
        decedentOOC,
        autopsyDeathCauses,
        deathType,
        causeOfDeath,
        autopsyAnatomicSummaryItems,
        autopsyAlbumUrl,             // URL d'images séparées par des virgules
        autopsyPhotosUnavailable,
        RadiologyResult,
        autopsyDate: formAutopsyDate,
        autopsyTime: formAutopsyTime,
        autopsyDiagramImgurUrl,
    } = formData;

    // --- Diagramme d'autopsie ---
    const diagramUrl = String(autopsyDiagramImgurUrl || '').trim();
    const diagramBlock = diagramUrl ? `[center][img]${diagramUrl}[/img][/center]` : '[center][i]Aucun diagramme d\'autopsie fourni (N/A).[/i][/center]';

    // --- Photographies ---
    let photographyText;
    if (autopsyPhotosUnavailable) {
        photographyText = 'Les photographies ne sont pas disponibles pour cette autopsie.';
    } else if (autopsyAlbumUrl && autopsyAlbumUrl.trim() !== '') {
        const photoUrls = autopsyAlbumUrl.split(',').map((url) => url.trim()).filter(Boolean);
        photographyText = photoUrls.length > 0
            ? `Les photos sur les lieux sont disponibles: ${photoUrls.map((url, index) => `[url=${url}]Photo ${index + 1}[/url]`).join(' | ')} Des photographies ont été prises avant et pendant le déroulement de l'autopsie.`
            : 'Aucune URL de photo valide fournie.';
    } else {
        photographyText = 'Aucune photographie fournie pour cette autopsie.';
    }

    // --- Date et heure de l'autopsie ---
    let finalAutopsyDate = 'JJ/MMM/AAAA';
    if (formAutopsyDate) {
        const dateParts = formAutopsyDate.split('-'); // YYYY-MM-DD
        if (dateParts.length === 3) {
            const dateObj = new Date(dateParts[0], parseInt(dateParts[1], 10) - 1, dateParts[2]); // mois : base 0
            finalAutopsyDate = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        }
    }
    const finalAutopsyTime = formAutopsyTime || 'HH:MM';

    const patientId = formData.patientID || 'Non applicable';
    const decedentDescription = buildDecedentDescription(formData);
    const authorityText = requestingAuthorityText(formData);
    const clothingText = (formData.autopsyClothing || '').trim()
        || "Le corps n'était pas vêtu et les vêtements n'étaient pas disponibles au moment de l'autopsie.";
    const internalExamText = (formData.autopsyInternalExamination || '').trim()
        || "Conformément à la cause du décès indiquée, rien d'inhabituel n'a été observé.";
    const performer = `${coronerRank || 'Médecin légiste'} ${coronerEmployee || 'Coroner inconnu'}`;
    const approver = `${chiefCoronerRank || 'Chef médecin légiste-Coroner'} ${chiefCoronerEmployee || 'Anne Carter'}`;

    const identification = [
        [['Défunt', `${decedentName || 'John Doe'}`], ['(( Discord du joueur (HRP)', `${decedentOOC || 'Discord HRP'} ))`]],
        [['ID Patient', patientId], ['Date et heure de l\'autopsie', `${finalAutopsyDate}, ${finalAutopsyTime}`]],
        [['Lieu du décès', placeWithCity(formData.placeOfDeath, formData.placeOfDeathZip) || 'Non renseigné'], ['Manière du décès', frDeath(deathType) || 'Indéterminée']],
        [['Comment la blessure s\'est produite', causeOfDeath || 'Inconnue']],
    ];
    if (decedentDescription) identification.push([['Identification', decedentDescription]]);
    if (authorityText) identification.push([['Autorité requérante', authorityText]]);

    const blocks = [
        dmecHeader({
            label: 'Informations du défunt',
            name: decedentName || 'John Doe',
            detail: `ID Patient : ${patientId}`,
            title: 'RAPPORT D\'AUTOPSIE',
            subtitle: 'Département de Pathologie et de Médecine Légale',
        }),
        sectionBanner('Identification', { size: 115 }),
        paragraph(`J'ai effectué une autopsie sur le corps de [b]${decedentName || 'John Doe'} ((${decedentOOC || 'Discord HRP'}))[/b] (ID Patient : ${patientId}) au Département de Pathologie et de Médecine Légale du PHMC le ${finalAutopsyDate}, ${finalAutopsyTime}.`),
        infoTable(identification),
        sectionBanner('Causes du décès', { size: 115 }),
        paragraph('D\'après les constatations anatomiques et les antécédents pertinents, j\'attribue le décès à:'),
        itemList(autopsyDeathCauses, 'a'),
        sectionBanner('Diagramme d\'autopsie', { size: 115 }),
        diagramBlock,
        sectionBanner('Résumé anatomique', { size: 115 }),
        itemList(autopsyAnatomicSummaryItems, '1'),
        sectionBanner('Constatations', { size: 115 }),
        labelledRows([
            ['Examen externe', externalExamination || 'Aucun détail d\'examen externe fourni.'],
            ['Vêtements', clothingText],
            ['Incision initiale', 'Les cavités corporelles sont ouvertes par l\'incision coronale standard et l\'incision en forme de Y standard.'],
            ['Examen interne', internalExamText],
            ['Sections histologiques', 'Des sections représentatives de divers organes sont conservées dans un bocal de stockage dans du formol à 10%.'],
            ['Toxicologie', 'Du sang thoracique, du sang fémoral, du sang EDTA, de l\'urine, du contenu gastrique et du vitré ont été soumis au laboratoire. Un dépistage complet a été demandé.'],
            ['Photographie', photographyText],
            ['Radiologie', `Le corps est fluoroscopé et deux radiographies ont été prises; ${RadiologyResult || 'Aucun résultat radiologique spécifique noté.'}`],
        ]),
        sectionBanner('Avis du médecin légiste', { size: 115 }),
        paragraph(synopsis || 'Aucun avis fourni.'),
        sectionBanner('Signatures', { size: 115 }),
        infoTable([[['Effectué par', performer], ['Approuvé par', approver]]]),
    ];

    return blocks.filter(Boolean).join('\n');
};
export default generateAutopsy;
