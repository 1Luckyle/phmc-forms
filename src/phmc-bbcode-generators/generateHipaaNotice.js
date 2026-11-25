// src/phmc-bbcode-generators/generateHipaaNotice.js
//
// « Avis relatif aux pratiques de confidentialité (H.I.P.A.A.) » : le document que le formulaire AMA (refus de soins) déclare avoir été remis au patient
// (« Je reconnais également avoir reçu, à ce jour, une copie de l'Avis relatif aux pratiques de confidentialité (H.I.P.A.A.) »). Il se consulte, se copie et
// s'exporte (HTML, PDF, image) depuis l'onglet « Avis H.I.P.A.A. » de la fenêtre AMA, pour être remis au patient.
// Mis en page comme les autres documents : en-tête à deux cellules, bandeaux noirs, pied de page de l'établissement (PHMC ou clinique de Paleto Bay).
// Texte de jeu de rôle : il décrit les pratiques de l'établissement, sans citer d'article de loi de San Andreas.
import { careHeader, sectionBanner, phmcFooter, pbcFooter } from './shared/bbStyles';

export const HIPAA_TITLE = 'Avis relatif aux pratiques de confidentialité (H.I.P.A.A.)';

const SECTION_SIZE = 105;

const section = (title, ...blocks) => `${sectionBanner(title, { size: SECTION_SIZE })}\n${blocks.join('\n[br][/br]\n')}`;
const text = (value) => `[justify]${value}[/justify]`;
const list = (items) => `[list]\n${items.map((item) => `[*] ${item}`).join('\n')}\n[/list]`;

const generateHipaaNotice = ({ etablissement = 'phmc', date = '' } = {}) => {
    const pbc = etablissement === 'pbc';
    const place = pbc ? 'la clinique de Paleto Bay (PBC), établissement du Pillbox Hill Medical Center' : 'le Pillbox Hill Medical Center (PHMC)';
    const placeShort = pbc ? 'La clinique' : 'Le PHMC';
    const footer = pbc ? pbcFooter() : phmcFooter();

    const header = careHeader({
        title: 'Avis de confidentialité', pbc, withPhmcLogo: true, compactLogos: pbc, label: 'Informations du document',
        lines: `${HIPAA_TITLE}${date ? `\nRemis le ${date}` : ''}`,
    });

    return [
        header,
        '[divbox=white]',
        text(`[b]Cet avis décrit la manière dont les informations médicales vous concernant peuvent être utilisées et communiquées, et la façon dont vous pouvez y accéder. Veuillez le lire attentivement.[/b]`),
        '[br][/br]',
        section('Notre engagement',
            text(`${placeShort} s'engage à protéger la confidentialité des informations relatives à votre santé : votre identité, votre état, les soins reçus, les examens réalisés et tout ce qui figure à votre dossier médical. Nous sommes tenus de maintenir cette confidentialité, de vous remettre le présent avis, de respecter les pratiques qu'il décrit et de vous informer en cas d'atteinte à la confidentialité de vos informations.`)),
        section('Comment nous utilisons et communiquons vos informations',
            text(`Sans autre autorisation de votre part, ${place} peut utiliser et communiquer vos informations médicales dans les cas suivants :`),
            list([
                '[b]Pour vos soins :[/b] les soignants qui vous prennent en charge (urgences, médecins, infirmiers, paramédicaux, spécialistes) échangent les informations nécessaires à votre traitement et à la continuité de vos soins.',
                '[b]Pour le fonctionnement de l\'établissement :[/b] évaluation de la qualité des soins, formation et supervision du personnel, gestion administrative et facturation.',
                '[b]En cas d\'urgence vitale :[/b] lorsque vous ne pouvez pas vous exprimer, les informations utiles à votre survie peuvent être communiquées aux équipes de secours.',
                '[b]Sur réquisition légale :[/b] à une autorité judiciaire ou à une force de l\'ordre habilitée, dans les limites strictes de la demande et de ce que la Loi exige.',
                '[b]Pour la sécurité des personnes :[/b] pour prévenir une menace grave et imminente pour la santé ou la sécurité d\'une personne ou du public.',
            ]),
            text('Toute autre utilisation ou communication, notamment à votre famille, à votre employeur, à un tiers ou à la presse, exige votre autorisation écrite. Vous pouvez retirer cette autorisation à tout moment, pour l\'avenir.')),
        section('Dossier partagé et forces de l\'ordre',
            text('Votre dossier médical est unique : il est partagé entre les soignants du Pillbox Hill Medical Center et les ambulanciers du Los Santos Fire Department (LSFD) en service, pour assurer la continuité de vos soins. Chaque consultation de votre dossier est enregistrée.'),
            text('Les forces de l\'ordre ne reçoivent jamais votre dossier médical : seul le rapport d\'intervention peut leur être transmis, dans les limites prévues ci-dessus.')),
        section('Vos droits',
            text('Vous avez le droit de :'),
            list([
                'consulter votre dossier médical et en obtenir une copie ;',
                'demander la rectification d\'une information inexacte ou incomplète ;',
                'demander une restriction de l\'usage ou de la communication de vos informations (nous ne sommes pas tenus de l\'accepter, sauf cas prévus par la Loi) ;',
                'demander que nous vous contactions par un moyen ou à un endroit de votre choix ;',
                'obtenir la liste des communications de vos informations faites sans votre autorisation ;',
                'recevoir une copie de cet avis, à tout moment, sur simple demande.',
            ])),
        section('Refus de soins (AMA)',
            text('Le refus de soins ou de transport, et le formulaire « Contre Avis Médical » qui le constate, sont versés à votre dossier. Ils sont couverts par le même secret médical que le reste de vos informations : refuser des soins ne change rien à la confidentialité qui vous est due.')),
        section('Questions et réclamations',
            text(`Pour exercer vos droits, poser une question ou déposer une réclamation, adressez-vous à la Direction de ${pbc ? 'la clinique' : 'l\'établissement'} aux coordonnées indiquées en bas de ce document. Vous ne ferez l'objet d'aucune sanction, ni d'aucune différence de traitement, pour avoir déposé une réclamation.`),
            text('[size=90][i]Nous nous réservons le droit de modifier cet avis ; la version en vigueur est celle qui vous est remise ou affichée dans l\'établissement.[/i][/size]')),
        '[/divbox]',
        footer,
    ].join('\n');
};

export default generateHipaaNotice;
