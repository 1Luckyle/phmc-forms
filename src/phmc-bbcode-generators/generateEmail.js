import { getPrice } from '../utils/pricing';
import { formatMoney } from '../utils/patientBilling';
import { sectionBanner, infoTable, paragraph, DMEC_LOGO } from './shared/bbStyles';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';
const CORONER_LOGO = DMEC_LOGO;

const generateEmail = (formData) => {
    const {
        requestingOfficer = NOT_FILLED,
        department = NOT_FILLED,
        coronerEmployee = NOT_FILLED,
        coronerRank = NOT_FILLED,
        coronerDiscord = NOT_FILLED,
        coronerPHNumber = NOT_FILLED,
        coronerEmail = NOT_FILLED,
        deathReport = NOT_FILLED,
        additionalReports,
        agencyDataStore, // Added agencyDataStore
        autopsyPaymentLink,
    } = formData;

    const requestFee = formatMoney(getPrice('fraisDemandeAutopsie')); // tarif modifiable dans le panneau admin
    const paymentInstructions = autopsyPaymentLink
        ? `Cliquez sur le lien suivant pour régler les frais de ${requestFee} via Fleeca : [url=${autopsyPaymentLink}]Payer ${requestFee} via Fleeca[/url]`
        : `Veuillez contacter le Département de Pathologie et de Médecine Légale du PHMC pour obtenir un lien de paiement Fleeca.`;

    const getDepartmentFullName = (shortCode) => {
        if (agencyDataStore && agencyDataStore[shortCode]) {
            return agencyDataStore[shortCode].fullName;
        }
        return shortCode; // fallback to shortcode
    };

    // En-tête : le logo de l'agence destinataire à gauche, celui du Bureau du Coroner (DMEC) à droite.
    // Dans le BBCode, seule une ADRESSE WEB fonctionne (lien imgBB de l'agence) : jamais le fichier local du dépôt, utilisé seulement à l'écran.
    const agencyLogo = [agencyDataStore?.[department]?.forumLogo, agencyDataStore?.[department]?.logo]
        .map((url) => String(url || '').trim()).find((url) => /^https?:\/\//i.test(url)) || '';
    const header = agencyLogo
        ? `[table][tr][td][center][img]${agencyLogo}[/img][/center][td][center][img]${CORONER_LOGO}[/img][/center][/table]`
        : `[center][img]${CORONER_LOGO}[/img][/center]`;

    // Défunt(s) concerné(s) : ceux saisis dans le formulaire et ceux des rapports joints (IC, Discord, ID patient).
    const joinList = (...lists) => lists.map((list) => String(list || '').trim()).filter(Boolean).join(', ');
    const names = joinList(formData.decedentName, formData.reportDecedentNames);
    const discords = joinList(formData.decedentOOC, formData.reportDecedentOOC);
    const patientId = String(formData.patientID || '').trim();
    const decedentBlock = names || discords || patientId
        ? `${names || NOT_FILLED}${discords ? ` (( Discord : ${discords} ))` : ''}${patientId ? ` — ID Patient : ${patientId}` : ''}`
        : '';

    const attachments = (additionalReports || []).filter((report) => String(report || '').trim());
    const attachmentBlocks = attachments.map((report, index) => `[altspoiler=Rapport du coroner - Additionnel ${index + 1}]
${report}
[code]
${report}
[/code]
[/altspoiler]`);

    const agencyName = getDepartmentFullName(department);
    const recipient = [requestingOfficer, agencyName].map((part) => String(part || '').trim()).filter(Boolean).join(' - ');
    const blocks = [
        header,
        sectionBanner('Courriel du Bureau du Coroner', { size: 115 }),
        infoTable([
            [['Destinataire', recipient], ['Expéditeur', `${coronerEmployee} (${coronerEmail})`]],
            [['Objet', 'Documents du rapport de décès']],
            ...(decedentBlock ? [[['Défunt(s) concerné(s)', decedentBlock]]] : []),
        ]),
        paragraph(`À l'attention de: ${[agencyName, requestingOfficer].map((part) => String(part || '').trim()).filter(Boolean).map((part) => `[b]${part}[/b]`).join(' - ')}

Ce rapport de coroner a été rédigé par ${coronerRank} ${coronerEmployee}. Vous trouverez les documents ci-joints attachés à ce courriel.`),
        sectionBanner('Informations / demande(s) d\'autopsie', { size: 115 }),
        paragraph('Si vous avez besoin d\'une autopsie, veuillez suivre ce lien et suivre les instructions: [url=]Portail d\'autopsie[/url].'),
        `[altspoiler=FAQ sur la demande d'autopsie]
1) Comment puis-je demander un rapport d'autopsie et/ou un certificat de décès?
Les autopsies et les certificats de décès peuvent être utiles dans diverses situations, en particulier lorsque la cause du décès joue un rôle essentiel. Nos professionnels s'efforcent de traiter chaque demande dans les délais les plus brefs. Cependant, étant donné que l'effort de documentation est immense, des frais de demande sont associés. Dès réception du paiement, le rapport ou le certificat vous sera envoyé directement.


2) Y a-t-il des frais associés au processus de demande?
Oui, il y a des frais de ${requestFee} associés à la demande. Ces frais couvrent les coûts administratifs liés au traitement et au maintien sécurisé de votre rapport/certificat demandé dans nos systèmes. Ils garantissent l'amélioration continue de nos services, en maintenant les normes les plus élevées en matière de gestion des données de santé.


3) Comment payer les frais de demande de ${requestFee}?
${paymentInstructions}

(( Les autopsies pour les Player Kills (PK) et Character Kills (CK) ne seront acceptées que si elles sont jugées strictement nécessaires et pertinentes pour un cas ou une enquête importante. Avant de faire une demande pour une telle autopsie, un membre des médecins légistes doit être notifié et consulté. De plus, il est obligatoire de fournir des informations sur /cdamages et /cexamine. Dans le cas où ces informations ne seraient pas disponibles, n'hésitez pas à contacter un administrateur en jeu, qui pourra les fournir. Si ces étapes ne sont pas suivies, un refus automatique entraînera l'archivage de votre demande.

De plus, s'il s'agit d'un PK, veuillez utiliser John/Jane Doe avec le nom de leur personnage entre parenthèses OOC. Ex: John Doe (( James Smith ))

[url=]Cliquez ici pour contacter un médecin légiste afin d'obtenir le feu vert![/url] ))
[/altspoiler]`,
        sectionBanner('Pour toute autre question', { size: 115 }),
        infoTable([
            [['Médecin légiste', `${coronerRank} ${coronerEmployee}`], ['Numéro de téléphone', coronerPHNumber]],
            [['Adresse e-mail', coronerEmail], ['(( Discord', `${coronerDiscord} ))`]],
        ]),
        sectionBanner('Documents joints', { size: 115 }),
        `[altspoiler=Rapport du coroner]
${deathReport}
[code]
${deathReport}

[/code]
[/altspoiler]`,
        ...attachmentBlocks,
        paragraph(`Cordialement
${coronerRank} ${coronerEmployee}
Pillbox Hill Medical Center - Pathologie et Médecine Légale`),
        `[size=75]Le contenu de ce courriel est destiné uniquement à la personne ou à l'entité à laquelle il est adressé. Ce courriel peut contenir des informations confidentielles. Si vous n'êtes pas la personne à qui ce message est adressé, sachez que toute utilisation, reproduction ou distribution de ce message est strictement interdite. Si vous avez reçu ceci par erreur, veuillez contacter l'expéditeur et supprimer immédiatement ce courriel et toutes les pièces jointes.[/size]`,
    ];

    return blocks.filter(Boolean).join('\n');
};

export default generateEmail;