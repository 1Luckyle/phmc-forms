// src/phmc-bbcode-generators/generateEmail.js
//
// Email DMEC (formulaire 2) : le courriel du Département de Pathologie et de Médecine Légale qui accompagne un rapport de décès. Même forme que les autres courriels du PHMC (messagerie interne,
// Mail Externe) : en-tête « Pillbox Hill Medical Center », objet centré, lignes À / De / Le, texte, signature de la personne qui l'envoie, puis le pied de page commun des courriels
// (shared/bbStyles.js). Aucune coordonnée personnelle de l'expéditeur (Discord, téléphone, e-mail) : le pied de page porte celles du centre.
import { getPrice } from '../utils/pricing';
import { formatMoney } from '../utils/patientBilling';
import { staffSignatureBlock, mailFooter, escapeBbText } from './shared/bbStyles';
import { linkedPatientIds, patientIdsLabel } from '../utils/linkedPatients';
// Placeholder utilisé pour les informations attendues mais non renseignées,
// afin que ça ressorte clairement dans le document généré (plutôt qu'un blanc
// silencieux qui pourrait passer pour un bug d'affichage).
const NOT_FILLED = 'Non renseigné';

export const DMEC_DEPARTMENT = 'Département de Pathologie et de Médecine Légale';
export const DMEC_EMAIL_DEFAULT_SUBJECT = 'Documents du rapport de décès';

const pad = (n) => String(n).padStart(2, '0');
const todayFr = () => { const now = new Date(); return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`; };

const generateEmail = (formData) => {
    const f = formData || {};
    const {
        requestingOfficer = NOT_FILLED,
        department = NOT_FILLED,
        coronerEmployee = NOT_FILLED,
        coronerRank = NOT_FILLED,
        deathReport = NOT_FILLED,
        additionalReports,
        agencyDataStore,
        autopsyPaymentLink,
    } = f;

    const requestFee = formatMoney(getPrice('fraisDemandeAutopsie')); // tarif modifiable dans le panneau admin
    // Version classique du site (f.paiementEnJeu, posé par le formulaire) : pas de lien Fleeca, les frais se règlent en jeu.
    const paymentInstructions = f.paiementEnJeu === true
        ? `Les frais de ${requestFee} sont à régler en jeu, auprès du ${DMEC_DEPARTMENT} du PHMC.`
        : autopsyPaymentLink
            ? `Cliquez sur le lien suivant pour régler les frais de ${requestFee} via Fleeca : [url=${autopsyPaymentLink}]Payer ${requestFee} via Fleeca[/url]`
            : `Veuillez contacter le ${DMEC_DEPARTMENT} du PHMC pour obtenir un lien de paiement Fleeca.`;

    const agencyName = agencyDataStore && agencyDataStore[department] ? agencyDataStore[department].fullName : department;
    const recipient = [requestingOfficer, agencyName].map((part) => String(part || '').trim()).filter(Boolean).join(' - ');
    const subject = String(f.dmecEmailSubject || '').trim() || DMEC_EMAIL_DEFAULT_SUBJECT;

    // Signataire : la personne qui envoie (son profil), sinon le coroner choisi ; le département est toujours celui de la médecine légale.
    const signerBase = f.signer && f.signer.name ? f.signer : { name: coronerEmployee === NOT_FILLED ? '' : coronerEmployee, rank: coronerRank === NOT_FILLED ? '' : coronerRank, signatureUrl: '' };
    const signer = { ...signerBase, rank: signerBase.rank || (coronerRank === NOT_FILLED ? '' : coronerRank), service: DMEC_DEPARTMENT };
    const role = [signer.rank, signer.service].map((part) => String(part || '').trim()).filter(Boolean).join(' — ');

    // Défunt(s) concerné(s) : ceux saisis dans le formulaire et ceux des rapports joints (IC, Discord, ID patient).
    const joinList = (...lists) => lists.map((list) => String(list || '').trim()).filter(Boolean).join(', ');
    const names = joinList(f.decedentName, f.reportDecedentNames);
    const discords = joinList(f.decedentOOC, f.reportDecedentOOC);
    const patientIds = linkedPatientIds(2, f);
    const decedentBlock = names || discords || patientIds.length
        ? `${names || NOT_FILLED}${discords ? ` (( Discord : ${discords} ))` : ''}${patientIds.length ? ` — ID Patient : ${patientIdsLabel(patientIds)}` : ''}`
        : '';

    const attachments = (additionalReports || []).filter((report) => String(report || '').trim());
    const attachmentBlocks = attachments.map((report, index) => `[altspoiler=Rapport du coroner - Additionnel ${index + 1}]
${report}
[code]
${report}
[/code]
[/altspoiler]`);

    const attention = [agencyName, requestingOfficer].map((part) => String(part || '').trim()).filter(Boolean).map((part) => `[b]${part}[/b]`).join(' - ');
    const heading = (title) => `[b][size=110]${title}[/size][/b]`;

    const blocks = [
        `[divbox=na][br][/br][imageleft]https://phmc-tools.com/img/phmc-curve.png[/imageleft] [b][size=110]Pillbox Hill Medical Center[/size][/b]
[size=85]${DMEC_DEPARTMENT}[/size]
[center][/center][br][/br]
[center][size=150][b]${escapeBbText(subject)}[/b][/size][/center]

[b]À :[/b] ${escapeBbText(recipient || '—')}
[b]De :[/b] ${escapeBbText(signer.name || NOT_FILLED)}${role ? ` (${escapeBbText(role)})` : ''}
[b]Le :[/b] ${todayFr()}${decedentBlock ? `\n[b]Défunt(s) concerné(s) :[/b] ${escapeBbText(decedentBlock)}` : ''}
[hr][/hr][br][/br][list=none]
À l'attention de : ${attention || NOT_FILLED}

Ce rapport de coroner a été rédigé par ${coronerRank} ${coronerEmployee}. Vous trouverez les documents ci-joints attachés à ce courriel.

${heading('Informations / demande(s) d\'autopsie')}
Si vous avez besoin d'une autopsie, veuillez suivre ce lien et suivre les instructions : [url=]Portail d'autopsie[/url].
[/list]`,
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
        `[list=none]${heading('Documents joints')}[/list]`,
        `[altspoiler=Rapport du coroner]
${deathReport}
[code]
${deathReport}

[/code]
[/altspoiler]`,
        ...attachmentBlocks,
        `[list=none]Pour toute autre question, veuillez contacter le ${DMEC_DEPARTMENT} du PHMC.[/list][br][/br]
${staffSignatureBlock(signer)}
${mailFooter()}[/divbox]`,
    ];

    return blocks.filter(Boolean).join('\n');
};

export default generateEmail;
