// src/utils/commercialClauses.js
//
// CONTENU JURIDIQUE des accords commerciaux du PHMC (fournisseurs, prestataires, partenaires, bailleurs / locataires, sponsors). Module pur : il
// transforme les champs saisis en « document structuré » (visas, parties, articles, signatures) que phmc-bbcode-generators/generateContract.js met en
// page, exactement comme les contrats du personnel (utils/contractClauses.js).
//
// Cadre juridique : les textes de San Andreas ne contiennent pas de code du commerce. Les règles sont celles du CODE CIVIL — titre I, chapitre 2 (les
// personnes morales, art. 111 à 115) et chapitre 3 (représentation et mandat, art. 116 à 119) ; titre II (les contrats, art. 201 à 220) — complétées par
// le CODE PÉNAL pour la probité et le secret (art. 206 corruption, 323 violation du secret, 520 détournement, 523 fraude à la concurrence). Là où la
// Loi est muette (préavis, délais de livraison, pénalités…), l'accord fixe lui-même la règle : c'est présenté comme une stipulation de l'accord, jamais
// comme une obligation légale.
//
// Chaque renvoi à un article a été vérifié sur les textes du forum (dossier src/data/law, version du 29 octobre 2026). À RE-VÉRIFIER si ces codes
// changent : voir COMMERCIAL_LAW_VERSION.
import { bbSafe, SIGNATURE_MARKER, SIGNATURE_DATE_MARKER } from '../phmc-bbcode-generators/generateContract';
import { formatDateFr, formatTimestampDateFr } from './contractConstants';

export const COMMERCIAL_LAW_VERSION = 'Textes consolidés du forum au 29 octobre 2026';
export const COMMERCIAL_MODEL_VERSION = 'AC-2026.1';
// Seuil au-delà duquel l'écrit est obligatoire (Code Civil, art. 206).
export const WRITTEN_FORM_THRESHOLD = 100000;

const b = (text) => `[b]${text}[/b]`;
const clean = bbSafe;
const money = (value) => (value === '' || value == null || Number.isNaN(Number(value)) ? null : `${Number(value).toLocaleString('fr-FR')} $`);
const dayWord = (n) => `${n} jour${Number(n) > 1 ? 's' : ''}`;

const PHMC = {
    nom: 'Pillbox Hill Medical Center (PHMC)',
    defini: 'établissement public de santé de l\'État de San Andreas, dont le siège est situé à l\'angle d\'Elgin Avenue et de Strawberry Avenue, Pillbox Hill, Los Santos',
};

const PERIODICITE = {
    unique: 'en une seule fois', hebdomadaire: 'chaque semaine', mensuel: 'chaque mois', trimestriel: 'chaque trimestre', annuel: 'chaque année', a_la_commande: 'à chaque commande ou prestation',
};

// ───────────────────────────── Parties ─────────────────────────────

const partyBlocks = (ctx) => {
    const c = ctx.champs;
    const issuerIdentity = `${clean(ctx.issuer?.name) || 'la Direction'}${ctx.issuer?.title ? `, ${clean(ctx.issuer.title)}` : ''}`;
    const isPerson = c.partieForme === 'particulier';
    const quality = c.representantQualite === 'mandataire'
        ? `mandataire, muni(e) d'un mandat écrit${c.mandatReference ? ` (${clean(c.mandatReference)})` : ''}`
        : `${clean(c.representantFonction) || 'dirigeant(e)'}, dirigeant(e)`;
    const partner = isPerson
        ? `${b(clean(c.partieNom))}, personne physique, domicilié(e) ou établi(e) à ${clean(c.partieSiege)}, ci-après « ${b('la Partie')} »,`
        : `${b(clean(c.partieNom))}, ${clean(c.partieFormeLabel) || 'personne morale'}, dont le siège est situé à ${clean(c.partieSiege)}, représenté(e) par ${b(clean(c.representantNom))}, agissant en qualité de ${quality}, ci-après « ${b('la Partie')} »,`;
    return [
        `${b(PHMC.nom)}, ${PHMC.defini}, représenté par ${issuerIdentity}, dûment habilité(e) à cet effet par délégation de la Direction (Code Civil, art. 113, 116 et 117), ci-après « ${b('le PHMC')} »,`,
        b('ET'),
        partner,
        '[i]Ci-après désignés ensemble « les Parties ».[/i]',
    ];
};

// ───────────────────────────── Articles propres à chaque type ─────────────────────────────

const typeSpecificArticle = (ctx) => {
    const c = ctx.champs;
    switch (ctx.type) {
        case 'fournisseur':
            return {
                id: 'specifique',
                titre: 'Fourniture, livraison et conformité',
                blocs: () => [
                    `La Partie fournit au PHMC les biens suivants : ${clean(c.produits)}.`,
                    c.delaiLivraisonJours ? `Sauf stipulation contraire d'un bon de commande, la livraison intervient dans un délai de ${b(dayWord(c.delaiLivraisonJours))} à compter de chaque commande.` : null,
                    c.conformite ? `Exigences de qualité et de conformité : ${clean(c.conformite)}. Les produits destinés aux soins sont fournis en bon état, conformes à leur destination et accompagnés de toute information utile à leur usage en sécurité.` : 'Les produits destinés aux soins sont fournis en bon état, conformes à leur destination et accompagnés de toute information utile à leur usage en sécurité.',
                    c.retours ? `Produits non conformes ou défectueux : ${clean(c.retours)}.` : 'Un produit non conforme ou défectueux est repris ou remplacé par la Partie, sans frais pour le PHMC.',
                    'Le PHMC vérifie les produits à la livraison et signale sans délai toute non-conformité.',
                ].filter(Boolean),
            };
        case 'prestation':
            return {
                id: 'specifique',
                titre: 'Exécution des prestations',
                blocs: () => [
                    `La Partie réalise les prestations suivantes : ${clean(c.prestation)}.`,
                    c.livrables ? `Résultats attendus et livrables : ${clean(c.livrables)}.` : null,
                    c.lieuExecution ? `Lieu d'exécution : ${clean(c.lieuExecution)}.` : null,
                    `La Partie exécute les prestations avec diligence et de façon indépendante, sans lien de subordination avec le PHMC ; ses salariés éventuels restent placés sous sa seule autorité.${c.assurance ? ' Elle déclare être couverte, pour les dommages causés dans l\'exécution des prestations, par une assurance de responsabilité.' : ''}`,
                    'Le personnel de la Partie qui intervient dans les locaux du PHMC respecte les consignes de sécurité, d\'hygiène et d\'accès propres à chaque zone.',
                ].filter(Boolean),
            };
        case 'partenariat':
            return {
                id: 'specifique',
                titre: 'Objectifs et contributions du partenariat',
                blocs: () => [
                    `Les Parties conviennent de collaborer dans la finalité suivante : ${clean(c.finalite)}.`,
                    { tableau: [['Contribution du PHMC', clean(c.contributionPhmc)], ['Contribution de la Partie', clean(c.contributionPartie)]] },
                    c.communication ? `Communication et usage des noms et logos : ${clean(c.communication)}. Chaque Partie n'utilise le nom, le logo ou l'image de l'autre que dans la mesure ainsi prévue et pour la durée de l'accord.` : 'Aucune Partie n\'utilise le nom, le logo ou l\'image de l\'autre sans son accord écrit préalable.',
                    c.exclusivite ? 'Le partenariat est conclu en exclusivité : pendant sa durée, aucune des Parties ne conclut d\'accord de même nature, dans le même champ, avec un tiers.' : 'Le partenariat n\'est pas exclusif : chaque Partie reste libre de collaborer avec des tiers.',
                    'Le partenariat ne crée ni société, ni mandat entre les Parties : chacune agit en son nom et pour son compte, et demeure responsable de ses propres engagements.',
                ],
            };
        case 'location': {
            const phmcLocataire = c.sens !== 'phmc_bailleur';
            return {
                id: 'specifique',
                titre: phmcLocataire ? 'Mise à disposition au PHMC' : 'Mise à disposition par le PHMC',
                blocs: () => [
                    `${phmcLocataire ? 'La Partie met à la disposition du PHMC' : 'Le PHMC met à la disposition de la Partie'} le bien suivant : ${clean(c.bien)}${c.adresseBien ? `, situé à ${clean(c.adresseBien)}` : ''}.`,
                    c.usageAutorise ? `Usage autorisé : ${clean(c.usageAutorise)}. Le bien n'est pas utilisé à un autre usage, ni sous-loué ou prêté à un tiers sans l'accord écrit du propriétaire.` : 'Le bien n\'est utilisé que conformément à sa destination, et n\'est ni sous-loué ni prêté à un tiers sans l\'accord écrit du propriétaire.',
                    c.depotGarantie ? `Un dépôt de garantie de ${b(money(c.depotGarantie))} est versé à la prise d'effet ; il est restitué à la fin de l'accord, déduction faite des sommes dues et des dégradations constatées.` : null,
                    c.etatDesLieux ? 'Un état des lieux contradictoire est dressé à la remise et à la restitution du bien ; à défaut, le bien est présumé remis en bon état.' : null,
                    'L\'occupant entretient le bien en bon père de famille et répond des dégradations survenues pendant la durée de l\'accord, hors usure normale.',
                    'Un accord portant sur la location d\'un bien immobilier doit être établi par écrit (Code Civil, art. 206) : le présent document y satisfait.',
                ].filter(Boolean),
            };
        }
        case 'sponsoring': {
            const phmcBeneficiaire = c.sens !== 'phmc_sponsor';
            return {
                id: 'specifique',
                titre: 'Soutien et contreparties',
                blocs: () => [
                    `Le présent accord soutient l'événement ou l'action suivant : ${b(clean(c.evenement))}.`,
                    phmcBeneficiaire
                        ? 'La Partie apporte son soutien au PHMC, qui en est le bénéficiaire.'
                        : 'Le PHMC apporte son soutien à la Partie, qui en est la bénéficiaire.',
                    `Contreparties : ${clean(c.contreparties)}.`,
                    c.visibilite ? `Visibilité accordée : ${clean(c.visibilite)}.` : null,
                    'Le soutien est affecté à l\'événement ou à l\'action désigné ; le bénéficiaire en rend compte à l\'autre Partie à sa demande. Le soutien ne confère aucun droit sur le contenu médical, la prise en charge des patients ni les décisions de soins du PHMC.',
                ].filter(Boolean),
            };
        }
        default:
            return null;
    }
};

const typeObjectIntro = {
    fournisseur: 'Le présent accord organise la fourniture de biens au PHMC par la Partie.',
    prestation: 'Le présent accord organise l\'exécution de prestations de services au profit du PHMC.',
    partenariat: 'Le présent accord organise une collaboration entre le PHMC et la Partie.',
    location: 'Le présent accord organise la mise à disposition d\'un bien entre le PHMC et la Partie.',
    sponsoring: 'Le présent accord organise un soutien (sponsoring ou mécénat) entre le PHMC et la Partie.',
};

// ───────────────────────────── Document structuré ─────────────────────────────

export const buildAgreementDocument = (ctx) => {
    const { type, issuer = {}, reference, timestamp } = ctx;
    const c = ctx.champs;
    const amount = money(c.montant);
    const determinate = c.dureeMode === 'determinee';
    const lawCap = Number(c.montant) >= WRITTEN_FORM_THRESHOLD;

    const definitions = [
        {
            id: 'objet',
            titre: 'Objet de l\'accord',
            blocs: () => [typeObjectIntro[type] || 'Le présent accord fixe les droits et obligations des Parties.', clean(c.objet)],
        },
        {
            id: 'duree',
            titre: 'Prise d\'effet et durée',
            blocs: () => [
                `L'accord prend effet le ${b(formatDateFr(c.dateEffet))}.`,
                determinate
                    ? `Il est conclu pour une durée déterminée et prend fin le ${b(formatDateFr(c.dateFin))}${c.reconduction === 'tacite' ? ', sauf reconduction tacite pour une même durée à défaut de dénonciation dans le délai de préavis' : ', sans reconduction tacite : toute poursuite de la relation suppose un nouvel accord écrit'}.`
                    : 'Il est conclu pour une durée indéterminée et peut être résilié par l\'une ou l\'autre des Parties dans les conditions de l\'article « Résiliation ».',
            ],
        },
        {
            id: 'obligations',
            titre: 'Obligations des Parties',
            blocs: () => [
                { tableau: [['Obligations du PHMC', clean(c.obligationsPhmc) || 'Régler le prix convenu dans les conditions de l\'accord et collaborer de bonne foi.'], ['Obligations de la Partie', clean(c.obligationsPartie) || 'Exécuter l\'accord dans les conditions et délais convenus, et collaborer de bonne foi.']] },
            ],
        },
        ...(typeSpecificArticle(ctx) ? [typeSpecificArticle(ctx)] : []),
        {
            id: 'prix',
            titre: 'Contrepartie et paiement',
            blocs: () => [
                'Chaque Partie s\'engage à fournir à l\'autre la contrepartie convenue (Code Civil, art. 205).',
                amount
                    ? `Le montant convenu est de ${b(amount)}, payable ${PERIODICITE[c.periodicite] || 'selon les modalités ci-dessous'}.`
                    : 'Aucun paiement en argent n\'est prévu : les contreparties sont celles décrites dans les articles ci-dessus.',
                c.modalitesPaiement ? `Modalités de paiement : ${clean(c.modalitesPaiement)}.` : null,
                lawCap ? `Le montant atteignant ou dépassant ${Number(WRITTEN_FORM_THRESHOLD).toLocaleString('fr-FR')} $, l'écrit est obligatoire (Code Civil, art. 206) : le présent document, signé par les deux Parties, y satisfait.` : null,
            ].filter(Boolean),
        },
        ...(c.confidentialite ? [{
            id: 'confidentialite',
            titre: 'Confidentialité et secret',
            blocs: () => [
                'Chaque Partie garde confidentielles les informations non publiques de l\'autre dont elle a connaissance du fait de l\'accord, et ne les utilise que pour son exécution.',
                'La Partie s\'interdit tout accès aux dossiers, rapports et données des patients du PHMC, sauf autorisation écrite expresse de la Direction. Le secret professionnel et le secret des affaires sont protégés par la Loi : leur violation est punie par le Code Pénal, art. 323.',
                'Cette obligation survit à la fin de l\'accord, sans limitation de durée.',
            ],
        }] : []),
        {
            id: 'integrite',
            titre: 'Intégrité et libre concurrence',
            blocs: () => [
                'Chaque Partie déclare n\'avoir proposé, accordé ni sollicité aucun avantage indu à un officier public ou à un agent du PHMC en vue de conclure ou d\'exécuter le présent accord (Code Pénal, art. 206, corruption).',
                'Les Parties s\'interdisent tout détournement des biens ou fonds remis pour un usage précis (Code Pénal, art. 520) et toute manœuvre faussant la libre concurrence (Code Pénal, art. 523).',
            ],
        },
        {
            id: 'execution',
            titre: 'Bonne foi et force majeure',
            blocs: () => [
                'L\'accord régulièrement formé lie les Parties : chacune exécute ses obligations de bonne foi et de loyauté, et ne peut priver l\'autre des bénéfices légitimement attendus (Code Civil, art. 208 et 209).',
                'Une Partie est libérée de son obligation lorsque son exécution est devenue impossible par un événement imprévisible et insurmontable, extérieur aux Parties ; l\'impossibilité temporaire ne fait que suspendre l\'exécution (Code Civil, art. 212).',
            ],
        },
        {
            id: 'manquement',
            titre: 'Manquement',
            blocs: () => [
                'En cas de manquement d\'une Partie à ses obligations, l\'autre Partie la met en demeure par écrit d\'y remédier dans un délai raisonnable. À défaut, elle peut demander des dommages et intérêts, l\'exécution forcée ou la résolution de l\'accord (Code Civil, art. 213 à 217).',
                c.penaliteForfaitaire
                    ? `Les Parties fixent à ${b(money(c.penaliteForfaitaire))} l'indemnité forfaitaire due par la Partie défaillante en cas de manquement. Cette somme constitue une estimation raisonnable du préjudice prévisible, et non une pénalité destinée à contraindre l'exécution ; la Cour peut réputer non écrite une clause manifestement excessive (Code Civil, art. 215).`
                    : null,
            ].filter(Boolean),
        },
        {
            id: 'resiliation',
            titre: 'Résiliation',
            blocs: () => [
                `${determinate ? 'Pendant sa durée déterminée, l\'accord ne peut être rompu avant son terme que d\'un commun accord ou par résolution pour manquement grave (Code Civil, art. 217).' : 'L\'une ou l\'autre des Parties peut résilier l\'accord à tout moment, sous réserve du préavis ci-dessous.'}`,
                c.preavisJours ? `Le préavis de résiliation ou de non-reconduction est de ${b(dayWord(c.preavisJours))}, notifié par écrit à l'autre Partie. Cette durée est une stipulation du présent accord.` : 'Toute résiliation est notifiée par écrit à l\'autre Partie.',
                'La résiliation ne remet pas en cause les prestations déjà valablement exécutées, ni les obligations de confidentialité.',
            ],
        },
        {
            id: 'interpretation',
            titre: 'Interprétation, modification et effet',
            blocs: () => [
                'Le présent document exprime l\'accord complet et définitif des Parties ; il s\'interprète selon leur intention commune, et tout terme ambigu s\'interprète contre la Partie qui l\'a rédigé (Code Civil, art. 218 et 219).',
                'Toute modification de l\'accord fait l\'objet d\'un avenant écrit, signé par les deux Parties. L\'accord ne produit d\'effets qu\'entre les Parties (Code Civil, art. 210).',
            ],
        },
        {
            id: 'capacite',
            titre: 'Capacité et pouvoirs des signataires',
            blocs: () => [
                'Chaque Partie déclare avoir la capacité de contracter (Code Civil, art. 202) et, s\'agissant d\'une personne morale, être régulièrement constituée et enregistrée auprès de l\'autorité compétente, avec indication de sa dénomination, de son objet, de son siège et de l\'identité de ses dirigeants (Code Civil, art. 112).',
                'Le signataire déclare agir dans le cadre de ses pouvoirs de dirigeant ou en vertu d\'un mandat établi par écrit : à défaut, l\'acte n\'engage que lui personnellement, sauf ratification (Code Civil, art. 113, 116 et 117).',
            ],
        },
        ...(c.clausesParticulieres ? [{
            id: 'particulieres',
            titre: 'Clauses particulières',
            blocs: () => [clean(c.clausesParticulieres)],
        }] : []),
    ];

    const num = Object.fromEntries(definitions.map((definition, index) => [definition.id, index + 1]));
    const articles = definitions.map((definition) => ({ titre: definition.titre, blocs: definition.blocs(num) }));

    const signatureBodyPhmc = issuer.signatureUrl
        ? `[img]${issuer.signatureUrl}[/img]`
        : (issuer.name ? `[size=130][i]${clean(issuer.name)}[/i][/size]` : '[br][/br][br][/br]');

    return {
        title: 'ACCORD COMMERCIAL',
        subtitle: `${ctx.typeLabel || ''}${c.titre ? ` — ${clean(c.titre)}` : ''}`,
        reference,
        dateText: `Fait à Los Santos, le ${formatTimestampDateFr(timestamp)}`,
        service: 'phmc',
        visas: [
            'Vu le Code Civil de San Andreas, titre I, chapitre 2 (les personnes morales) et chapitre 3 (représentation et mandat) ;',
            'Vu le Code Civil de San Andreas, titre II (les contrats), notamment ses articles 201 à 220 ;',
            'Vu le Code Pénal de San Andreas, notamment ses articles 206, 323, 520 et 523.',
        ],
        partiesTitre: 'Entre les soussignés',
        parties: partyBlocks(ctx),
        preambule: ['Il a été convenu et arrêté ce qui suit.'],
        articles,
        signatures: {
            titre: 'Signatures',
            intro: 'Fait à Los Santos, en deux exemplaires électroniques. L\'offre (art. 203) est formée par la signature du PHMC ; le contrat est conclu par l\'acceptation sans réserve de la Partie (art. 204), constatée par sa signature ci-dessous.',
            employer: {
                label: 'POUR LE PHMC',
                name: clean(issuer.name),
                role: clean(issuer.title),
                mention: 'Bon pour offre ferme',
                body: signatureBodyPhmc,
                caption: `Fait à Los Santos, le ${formatTimestampDateFr(timestamp)}`,
            },
            employee: {
                label: 'POUR LA PARTIE',
                name: clean(c.representantNom) || clean(c.partieNom),
                role: c.partieForme === 'particulier' ? '' : clean(c.partieNom),
                mention: 'Lu et approuvé, bon pour accord',
                body: SIGNATURE_MARKER,
                caption: `Signature électronique${SIGNATURE_DATE_MARKER}`,
            },
        },
        footer: [
            `${COMMERCIAL_MODEL_VERSION} · Document généré par l'outil PHMC-FR · Réf. ${reference} · ${COMMERCIAL_LAW_VERSION}`,
            'Accord confidentiel destiné aux seules Parties. Document de jeu de rôle (IC), sans valeur juridique réelle. Les signatures électroniques sont horodatées ; chaque Partie en conserve une copie.',
        ],
    };
};

