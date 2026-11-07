import { placeWithCity } from '../utils/places';
import { frDeath, DEATH_TYPE_SHORT_FR } from '../utils/deathLabels';
import { frDay } from '../utils/reportTitle';
import { withTitle } from '../utils/patientIdentity';
import { sectionBanner, dmecHeader, infoTable, paragraph, photoBlock } from './shared/bbStyles';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';

const NUMBER_WORDS = ['Zéro', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix'];
const numberToWords = (num) => (num >= 0 && num <= 10 ? NUMBER_WORDS[num] : String(num));
const splitUrls = (value) => (value || '').split(',').map((url) => url.trim()).filter(Boolean);

// Rapport de catastrophe mortelle (tuerie / accident de masse, version 11) : en-tête, rapport écrit, récapitulatif des défunts, une fiche repliable par défunt,
// déclaration et confidentialité.
// ATTENTION : utils/coronerAttachments.js reconnaît ce rapport d'après ses titres et lit chaque défunt dans « [altspoiler=N - Nom - OOC Discord] ».
const generateMassFatality = (formData) => {
    const {
        coronerRank,
        placeOfDeath,
        department,
        dateTime,
        requestingOfficer = '',
        coronerEmployee,
        coronerBadge,
        synopsis,
        showRequestingOfficerInput,
        decedents: rawDecedents = [],
        agencyDataStore,
    } = formData;
    const decedents = Array.isArray(rawDecedents) ? rawDecedents : [];

    const getDepartmentFullName = (shortCode) => {
        if (agencyDataStore && agencyDataStore[shortCode]) {
            return agencyDataStore[shortCode].fullName;
        }
        return shortCode; // fallback to shortcode
    };

    const rank = coronerRank || 'Coroner';
    const place = placeWithCity(placeOfDeath, formData.placeOfDeathZip) || 'Lieu inconnu';
    const agencyName = getDepartmentFullName(department) || 'Département inconnu';
    const hasRequester = !!showRequestingOfficerInput && !!(requestingOfficer || formData.requestingAgency);
    const requesterAgency = getDepartmentFullName(formData.requestingAgency) || NOT_FILLED;

    const summaryRows = [
        [['Date et heure de l\'enquête', frDay(dateTime) || 'Inconnue'], ['Lieu de l\'incident', place]],
        [['Appel reçu de', agencyName], ['Nombre de défunts', numberToWords(decedents.length)]],
        [['Médecin légiste', `${rank} ${coronerEmployee || 'Coroner inconnu'}`], ['Numéro de badge', coronerBadge || 'N/A']],
    ];
    if (hasRequester) summaryRows.push([['Rapport demandé par', requestingOfficer || NOT_FILLED], ['Agence du demandeur', requesterAgency]]);

    const requestedParagraph = hasRequester
        ? `\n\nCe rapport a été demandé par [b]${requestingOfficer || NOT_FILLED}[/b] (${requesterAgency}). Sur sa demande, il a été transmis via l'Intranet sécurisé pour un traitement et un examen plus approfondis.`
        : '';
    const writtenReport = `Le Bureau du Coroner du Comté a été appelé concernant un incident tuerie/accident de masse survenu à l'emplacement de [b]${place}[/b]. Après avoir reçu l'appel de[b] ${agencyName}[/b], le Bureau du Coroner a dépêché un ${rank} sur la scène de crime pour mener une enquête le [b]${frDay(dateTime) || 'Date/Heure inconnue'}[/b].

Le ${rank}, [b]${coronerEmployee || 'Coroner inconnu'}[/b], Numéro de badge [b]${coronerBadge || 'N/A'}[/b], est arrivé sur les lieux et a identifié un total de [b]${numberToWords(decedents.length)} Défunts[/b]. Suite à une enquête initiale, le ${rank} est arrivé au [b]synopsis[/b] suivant: ${synopsis || 'Aucun synopsis fourni.'}${requestedParagraph}`;

    const blocks = [
        dmecHeader({
            label: 'Incident à victimes multiples',
            name: place,
            detail: `${numberToWords(decedents.length)} défunt${decedents.length > 1 ? 's' : ''}`,
            title: 'RAPPORT DE CATASTROPHE MORTELLE',
            subtitle: 'Bureau du Coroner du Comté',
        }),
        sectionBanner('A. Rapport écrit', { size: 115 }),
        infoTable(summaryRows),
        paragraph(writtenReport),
    ];

    if (decedents.length > 0) {
        blocks.push(sectionBanner('Récapitulatif des défunts', { size: 115 }));
        blocks.push(infoTable(decedents.map((dec, idx) => [
            [`Défunt n°${idx + 1}`, dec.decedentName || 'Défunt non identifié'],
            ['ID Patient', dec.patientID || 'Non applicable'],
            ['Cause probable', dec.probableCauseOfDeath || 'Cause inconnue'],
        ])));
        blocks.push(sectionBanner('B. Dossier de chaque défunt', { size: 115 }));
    }

    // --- Une fiche repliable par défunt ---
    decedents.forEach((dec, idx) => {
        const lockerId = String(dec.evidenceLockerID || '').trim();
        const evidenceLockerListItems = lockerId ? `\n[list][*] ${lockerId} - ${dec.decedentName || NOT_FILLED} (( ${dec.decedentOOC || NOT_FILLED} ))[/list]` : '';
        const morgueStatusMessage = dec.morgueStatus === 'true' || dec.morgueStatus === true
            ? '[b][color=red]La photo de l\'écran de la morgue est actuellement indisponible.[/color][/b]\n'
            : '';
        const additionalImages = splitUrls(dec.additionalImages);
        const typeLabel = DEATH_TYPE_SHORT_FR[dec.typeOfDeath] || dec.typeOfDeath || 'Type inconnu';
        const imagesBlock = additionalImages.length > 0
            ? `[center]${additionalImages.map((photo) => `[img]${photo}[/img]`).join('\n')}[/center]`
            : '[i]Aucune image supplémentaire fournie.[/i]';

        const card = [
            sectionBanner('Informations sur le défunt'),
            infoTable([
                [['Nom du défunt', dec.decedentName ? withTitle(dec.decedentTitle, dec.decedentName) : 'Défunt non identifié'], ['(( Discord du joueur (HRP)', `${dec.decedentOOC || 'Inconnu'} ))`]],
                [['ID Patient', dec.patientID || 'Non applicable'], ['Heure de décès prononcée', frDay(dec.pronouncedTimeOfDeath) || 'Heure inconnue']],
                [['Lieu du décès', placeWithCity(dec.placeOfDeath, dec.placeOfDeathZip) || 'Lieu inconnu']],
                [['Cause probable du décès', dec.probableCauseOfDeath || 'Cause inconnue'], ['Manière du décès', frDeath(dec.mannerOfDeath) || 'Manière inconnue']],
                [['Blessures du défunt / Éléments notables', dec.synopsis || 'Aucun synopsis fourni']],
            ]),
            sectionBanner('Dossier documentaire du défunt'),
            `[center][size=85][b][u]PHOTOGRAPHIE DE SCÈNE[/u][/b][/size][/center]\n${photoBlock(splitUrls(dec.scenePhotos), 'Aucune photo de scène fournie.')}`,
            sectionBanner('(( Images hors personnage ))'),
            paragraph('Cette section précise si le joueur a été tué de manière permanente (character killed) ou temporaire (player killed).'),
            infoTable([[['Le joueur a subi', typeLabel]]]),
            `[b]Écran de morgue, photos des liaisons (( /cdamages )), rapport de test ADN:[/b] ${morgueStatusMessage}[size=85][u] CES IMAGES SONT [b]HORS PERSONNAGE[/b] POUR LES DOSSIERS INTERNES, NE PAS LES UTILISER COMME PREUVE. [/u][/size]`,
            imagesBlock,
            `${rank} ${coronerEmployee || 'Coroner inconnu'} a ajouté quelque chose au casier à preuves: [b]${lockerId ? 'Oui' : 'Non'}[/b]${evidenceLockerListItems}`,
        ];
        blocks.push(`[altspoiler=${idx + 1} - ${dec.decedentName || 'Défunt non identifié'} - OOC ${dec.decedentOOC || 'Inconnu'}]\n${card.join('\n')}\n[/altspoiler]`);
    });

    blocks.push(
        sectionBanner('C. Déclaration', { size: 115 }),
        paragraph(`[size=85]En tant que ${rank}, j'ai pris des notes détaillées de mes constatations et conclusions, et ces notes sont disponibles pour examen si nécessaire. Cependant, je dois noter que ces notes ne contiennent aucune opinion personnelle et sont uniquement basées sur les preuves et les faits à ma disposition.

En conclusion, j'espère que ce rapport fournit les informations nécessaires pour que l'agence puisse procéder aux actions nécessaires. Veuillez me faire savoir si vous avez besoin d'informations supplémentaires ou si je peux vous être d'une aide supplémentaire.

Je certifie que les informations contenues dans ce rapport sont vraies et exactes selon mes meilleures connaissances et convictions. J'ai examiné le rapport et me suis assuré que toutes les informations incluses sont complètes et exactes.[/size]`),
        sectionBanner('D. Confidentialité et vie privée', { size: 115 }),
        paragraph(`[size=85]Ce document du Département de Médecine Légale et de Pathologie du Pillbox Hill Medical Center certifie l'authenticité des informations contenues dans celui-ci. Toute distribution ou utilisation non autorisée de ces informations constitue une violation de la loi sur la portabilité et la responsabilité en matière d'assurance maladie (HIPAA), ainsi que des lois étatiques et fédérales sur la protection de la vie privée, y compris, mais sans s'y limiter, la loi sur la confidentialité des informations médicales de San Andreas (CMIA) et la loi sur les pratiques d'information de San Andreas (IPA).

Il est impératif que toutes les parties manipulant ce document respectent la vie privée et la confidentialité du défunt et de sa famille. Toute violation de ces lois peut entraîner des poursuites judiciaires contre les parties responsables.

Ce document est fourni à des fins officielles uniquement et ne doit pas être interprété comme un conseil juridique ou un diagnostic médical. Si des informations supplémentaires ou des clarifications sont nécessaires, veuillez contacter le Département de Médecine Légale et de Pathologie du Pillbox Hill Medical Center.[/size]`),
    );

    return blocks.filter(Boolean).join('\n');
};

export default generateMassFatality;
