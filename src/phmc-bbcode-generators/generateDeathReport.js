import { buildDecedentDescription } from './shared/decedentDescription';
import { requestingAuthorityText } from './shared/requestingAuthority';
import { placeWithCity } from '../utils/places';
import { frDeath, DEATH_TYPE_SHORT_FR } from '../utils/deathLabels';
import { frDay } from '../utils/reportTitle';
import { withTitle } from '../utils/patientIdentity';
import { sectionBanner, dmecHeader, infoTable, paragraph, photoBlock } from './shared/bbStyles';

// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';

const splitUrls = (value) => (value || '').split(',').map((url) => url.trim()).filter(Boolean);

// Rapport d'enquête sur le décès (formulaire « Services de Médecine Légale »). Mise en page : en-tête à deux cellules, fiche du défunt,
// rapport écrit, dossier photographique, déclaration, confidentialité, puis les éléments hors personnage.
// ATTENTION : utils/coronerAttachments.js reconnaît ce rapport d'après ses titres (« Rapport d'enquête sur le décès », « A. Rapport écrit »…)
// et en tire le nom du défunt (« a identifié l'individu comme étant … ») et son Discord (« Discord du joueur (HRP): … »).
const generateDeathReport = (formData) => {
    const {
        coronerRank,
        placeOfDeath,
        department,
        dateTime,
        coronerEmployee,
        coronerBadge,
        decedentName,
        decedentOOC,
        pronouncedTimeOfDeath,
        synopsis,
        probableCauseOfDeath,
        mannerOfDeath,
        typeOfDeath,
        scenePhotos,
        agencyDataStore,
        additionalImages,
        evidenceLockerID,
        morgueStatus,
        decedentAttributes,
    } = formData;

    const getDepartmentFullName = (shortCode) => {
        if (agencyDataStore && agencyDataStore[shortCode]) {
            return agencyDataStore[shortCode].fullName;
        }
        return shortCode; // fallback to shortcode
    };

    const rank = coronerRank || 'Coroner';
    const place = placeWithCity(placeOfDeath, formData.placeOfDeathZip) || 'Lieu inconnu';
    const agencyName = getDepartmentFullName(department) || 'Département inconnu';
    const patientId = formData.patientID || 'Non applicable';

    // --- Images ---
    const scenePhotosBBCode = photoBlock(splitUrls(scenePhotos), 'Aucune photo de scène fournie.');
    const additionalImagesArray = splitUrls(additionalImages);
    const additionalImagesBBCode = additionalImagesArray.length > 0
        ? `[center]${additionalImagesArray.map((photo) => `[img]${photo}[/img]`).join('\n')}[/center]`
        : '[i]Aucune image supplémentaire fournie.[/i]';
    const decedentAttributesArray = splitUrls(decedentAttributes);
    const decedentAttributesBBCode = decedentAttributesArray.length > 0
        ? `[b]Apparence du défunt (( /attributes )):[/b]\n[center]${decedentAttributesArray.map((photo) => `[img]${photo}[/img]`).join('\n')}[/center]`
        : '';

    // --- Casier à preuves ---
    const lockerId = String(evidenceLockerID || '').trim();
    const evidenceLockerText = lockerId ? 'Oui' : 'Non';
    const evidenceLockerListItems = lockerId ? `[list][*] ${lockerId} - ${decedentName || NOT_FILLED} (( ${decedentOOC || NOT_FILLED} ))[/list]` : '';
    const morgueStatusMessage = morgueStatus === 'true' || morgueStatus === true
        ? '[b][color=red]La photo de l\'écran de la morgue est actuellement indisponible.[/color][/b]'
        : '';

    // Qui a demandé le rapport (si la case « Rapport demandé ? » est cochée) : son nom et son agence, distincts de l'agence qui a appelé le Bureau du Coroner.
    const requesterName = String(formData.requestingOfficer || '').trim();
    const requesterAgency = formData.requestingAgency ? getDepartmentFullName(formData.requestingAgency) : '';
    const hasRequester = !!formData.showRequestingOfficerInput && !!(requesterName || requesterAgency);
    const requestedBy = hasRequester
        ? ` Ce rapport a été demandé par [b]${requesterName || NOT_FILLED}[/b] (${requesterAgency || NOT_FILLED}).`
        : '';

    const decedentDescription = buildDecedentDescription(formData);
    const authorityText = requestingAuthorityText(formData);

    // Fiche du défunt et de l'intervention.
    const rows = [
        [['Date et heure de l\'enquête', frDay(dateTime) || 'Inconnue'], ['Lieu du décès', place]],
        [['Appel reçu de', agencyName], ['Heure du décès prononcée', pronouncedTimeOfDeath || 'Heure inconnue']],
        [['Médecin légiste', `${rank} ${coronerEmployee || 'Coroner inconnu'}`], ['Numéro de badge', coronerBadge || 'N/A']],
        [['Cause probable du décès', probableCauseOfDeath || 'Indéterminée'], ['Manière du décès', frDeath(mannerOfDeath) || 'Indéterminée']],
    ];
    if (hasRequester) rows.push([['Rapport demandé par', requesterName || NOT_FILLED], ['Agence du demandeur', requesterAgency || NOT_FILLED]]);
    if (authorityText) rows.push([['Autorité requérante', authorityText]]);
    if (decedentDescription) rows.push([['Description du défunt', decedentDescription]]);

    const blocks = [
        dmecHeader({
            label: 'Informations du défunt',
            name: decedentName ? withTitle(formData.decedentTitle, decedentName) : 'Défunt non identifié',
            detail: `ID Patient : ${patientId}`,
            title: 'RAPPORT D\'ENQUÊTE SUR LE DÉCÈS',
            subtitle: 'Bureau du Coroner du Comté',
        }),
        sectionBanner('A. Rapport écrit', { size: 115 }),
        infoTable(rows),
        paragraph(`Le Bureau du Coroner du Comté a été appelé concernant le décès survenu à l'emplacement de [b]${place}[/b]. Après avoir reçu l'appel de[b] ${agencyName}[/b], le Bureau du Coroner a dépêché un ${rank} sur la scène de crime pour mener une enquête le [b]${frDay(dateTime) || 'Date/Heure inconnue'}[/b].${requestedBy}

Le ${rank}, [b]${coronerEmployee || 'Coroner inconnu'}[/b], Numéro de badge [b]${coronerBadge || 'N/A'}[/b], est arrivé sur les lieux et a identifié l'individu comme étant [b]${decedentName || 'Défunt non identifié'}[/b] (ID Patient : ${patientId}), qui est estimé être décédé à [b]${pronouncedTimeOfDeath || 'Heure inconnue'}[/b]. Suite à une enquête initiale, le ${rank} est arrivé au [b]synopsis[/b] suivant: ${synopsis || 'Aucun synopsis fourni.'}

D'après les informations recueillies lors de l'enquête sur les lieux et les antécédents médicaux du défunt (si disponibles), la cause probable du décès a été déterminée comme étant [b]${probableCauseOfDeath || 'Indéterminée'}[/b]. La manière du décès a été classée comme [b]${frDeath(mannerOfDeath) || 'Indéterminée'}[/b].`),
        sectionBanner('B. Dossier photographique documentaire', { size: 115 }),
        `[center][size=85][b][u]PHOTOGRAPHIE DE SCÈNE[/u][/b][/size][/center]\n${scenePhotosBBCode}`,
        sectionBanner('C. Déclaration', { size: 115 }),
        paragraph(`[size=85]En tant que ${rank}, j'ai pris des notes détaillées de mes constatations et conclusions, et ces notes sont disponibles pour examen si nécessaire. Cependant, je dois noter que ces notes ne contiennent aucune opinion personnelle et sont uniquement basées sur les preuves et les faits à ma disposition.

En conclusion, j'espère que ce rapport fournit les informations nécessaires pour que l'agence puisse procéder aux actions nécessaires. Veuillez me faire savoir si vous avez besoin d'informations supplémentaires ou si je peux vous être d'une aide supplémentaire.

Je certifie que les informations contenues dans ce rapport sont vraies et exactes selon mes meilleures connaissances et convictions. J'ai examiné le rapport et me suis assuré que toutes les informations incluses sont complètes et exactes.[/size]`),
        sectionBanner('D. Confidentialité et vie privée', { size: 115 }),
        paragraph(`[size=85]Ce document du Département de Médecine Légale et de Pathologie du Pillbox Hill Medical Center certifie l'authenticité des informations contenues dans celui-ci. Toute distribution ou utilisation non autorisée de ces informations constitue une violation de la loi sur la portabilité et la responsabilité en matière d'assurance maladie (HIPAA), ainsi que des lois étatiques et fédérales sur la protection de la vie privée, y compris, mais sans s'y limiter, la loi sur la confidentialité des informations médicales de San Andreas (CMIA) et la loi sur les pratiques d'information de San Andreas (IPA).

Il est impératif que toutes les parties manipulant ce document respectent la vie privée et la confidentialité du défunt et de sa famille. Toute violation de ces lois peut entraîner des poursuites judiciaires contre les parties responsables.

Ce document est fourni à des fins officielles uniquement et ne doit pas être interprété comme un conseil juridique ou un diagnostic médical. Si des informations supplémentaires ou des clarifications sont nécessaires, veuillez contacter le Département de Médecine Légale et de Pathologie du Pillbox Hill Medical Center.[/size]`),
        sectionBanner('(( Images hors personnage ))', { size: 115 }),
        paragraph('Cette section précise si le joueur a été tué de manière permanente (character killed) ou temporaire (player killed).'),
        infoTable([
            [['Le joueur a subi', DEATH_TYPE_SHORT_FR[typeOfDeath] || typeOfDeath || 'Inconnu'], ['Discord du joueur (HRP)', decedentOOC || 'Inconnu']],
        ]),
        `[b]Écran de morgue, photos des liaisons (( /cdamages )), rapport de test ADN:[/b]${morgueStatusMessage ? ` ${morgueStatusMessage}` : ''}\n[size=85][u] CES IMAGES SONT [b]HORS PERSONNAGE[/b] POUR LES DOSSIERS INTERNES, NE PAS LES UTILISER COMME PREUVE. [/u][/size]\n${additionalImagesBBCode}`,
        decedentAttributesBBCode,
        `${rank} ${coronerEmployee || 'Coroner inconnu'} a ajouté quelque chose au casier à preuves: [b]${evidenceLockerText}[/b]${evidenceLockerListItems ? `\n${evidenceLockerListItems}` : ''}`,
    ];

    return blocks.filter(Boolean).join('\n');
};

// Export the function so it can be imported elsewhere
export default generateDeathReport;
