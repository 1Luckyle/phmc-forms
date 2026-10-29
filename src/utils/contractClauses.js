// src/utils/contractClauses.js
//
// CONTENU JURIDIQUE des documents contractuels du PHMC / DMEC. Module pur : il transforme les champs saisis en « document structuré »
// (visas, parties, articles) que phmc-bbcode-generators/generateContract.js met en page.
//
// Cadre juridique retenu : le PHMC est un ÉTABLISSEMENT PUBLIC de santé ; ses agents sont donc des « employés publics » au sens du Code du
// Gouvernement (art. 218 : personne liée à une autorité publique par un contrat d'embauche). Les textes de San Andreas ne contiennent pas de
// code du travail : les règles de formation, d'exécution et de rupture sont celles du Code Civil (titre II, Contrats), complétées par le Code
// du Gouvernement (titre II : officiers et employés publics), la Constitution et le Code Pénal. Là où la Loi est muette (préavis, plafonds de
// sanctions, délais), le contrat fixe lui-même la règle : c'est signalé comme une stipulation du contrat, jamais comme une obligation légale.
//
// Chaque renvoi à un article a été vérifié sur les textes du forum (Constitution au 1er janvier 2026, Code Civil, Code du Gouvernement, Code
// Pénal, Code de Procédure Judiciaire, Code du Feu). À RE-VÉRIFIER si un de ces codes est modifié : voir LAW_VERSION.
import { getRoleInfo, normalizeRank } from '../constants/ranks';
import { bbSafe, SIGNATURE_MARKER, SIGNATURE_DATE_MARKER } from '../phmc-bbcode-generators/generateContract';
import {
    CONTRACT_TYPES, FIN_MOTIFS, FIN_BASES_LEGALES, SANCTIONS, MODEL_VERSION, CONVOCATION_DELAI_HEURES, DECISION_DELAI_JOURS,
    MAX_MISE_A_PIED_JOURS, formatDateFr, formatTimestampDateFr, parseIsoDate, acceptanceKind,
} from './contractConstants';

export const LAW_VERSION = 'Textes consolidés du forum au 29 octobre 2026';

const b = (text) => `[b]${text}[/b]`;
const clean = bbSafe;

const SERMENT = 'Je jure solennellement de soutenir et de défendre la Constitution des États-Unis d\'Amérique et la Constitution de l\'État de San Andreas contre tous leurs ennemis ; de leur porter foi et allégeance ; de prendre cette obligation librement, sans réserve ni intention de m\'y soustraire ; et de remplir fidèlement les devoirs de la charge que je m\'apprête à exercer.';

const EMPLOYERS = {
    phmc: {
        court: 'le Pillbox Hill Medical Center (PHMC)',
        du: 'du Pillbox Hill Medical Center (PHMC)',
        nom: 'Pillbox Hill Medical Center (PHMC)',
        defini: 'établissement public de santé de l\'État de San Andreas, dont le siège est situé à l\'angle d\'Elgin Avenue et de Strawberry Avenue, Pillbox Hill, Los Santos',
    },
    coroner: {
        court: 'le Département de Pathologie et de Médecine Légale (DMEC) du Pillbox Hill Medical Center',
        du: 'du Département de Pathologie et de Médecine Légale (DMEC) du Pillbox Hill Medical Center',
        nom: 'Département de Pathologie et de Médecine Légale (DMEC) du Pillbox Hill Medical Center',
        defini: 'service de l\'établissement public de santé Pillbox Hill Medical Center, dont le siège est situé à l\'angle d\'Elgin Avenue et de Strawberry Avenue, Pillbox Hill, Los Santos',
    },
};

// ───────────────────────────── Utilitaires ─────────────────────────────

const numbering = (articles) => Object.fromEntries(articles.map((article, index) => [article.id, index + 1]));

// Construit les articles en deux temps pour que les renvois internes (« article 13 ») suivent l'ordre réel.
const compile = (definitions) => {
    const num = numbering(definitions);
    return definitions.map((definition) => ({ titre: definition.titre, blocs: definition.blocs(num) }));
};

const lcFirst = (text) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : text);

const dayWord = (n) => `${n} jour${Number(n) > 1 ? 's' : ''}`;

const isSupervisedRole = (role) => /externe|étudiant|interne|junior|stagiaire|assistant\(e\) médecin/i.test(normalizeRank(role) || '');

const poleOf = (service, role) => getRoleInfo(role)?.pole || (service === 'coroner' ? 'dmec' : 'soignant');

const partiesBlocks = (ctx, { employeeLabel = 'l\'Employé(e)', employerLabel = 'l\'Employeur' } = {}) => {
    const employer = EMPLOYERS[ctx.service] || EMPLOYERS.phmc;
    const issuerIdentity = `${clean(ctx.issuer?.name) || 'son service de recrutement'}${ctx.issuer?.title ? `, ${clean(ctx.issuer.title)}` : ''}`;
    return [
        `${b(employer.nom)}, ${employer.defini}, représenté par ${issuerIdentity}, dûment habilité(e) à cet effet par délégation de la Direction (Code Civil, art. 113, 116 et 117), ci-après « ${b(employerLabel)} »,`,
        `${b('ET')}`,
        `${b(clean(ctx.employeeName) || '________')}${ctx.employeeBadge ? ` (ID employé ${clean(ctx.employeeBadge)})` : ''}, ci-après « ${b(employeeLabel)} »,`,
    ];
};

const signaturesBlock = (ctx, { kind, intro, employeeRole }) => {
    const issuer = ctx.issuer || {};
    const accord = kind === 'accord';
    const employerBody = issuer.signatureUrl
        ? `[img]${issuer.signatureUrl}[/img]`
        : (issuer.name ? `[size=130][i]${clean(issuer.name)}[/i][/size]` : '[br][/br][br][/br]');
    return {
        titre: accord ? 'Signatures' : 'Notification et accusé de réception',
        intro,
        employer: {
            label: 'POUR L\'EMPLOYEUR',
            name: clean(issuer.name),
            role: clean(issuer.title),
            mention: accord ? 'Bon pour offre ferme' : 'Notification établie',
            body: employerBody,
            caption: `Fait à Los Santos, le ${formatTimestampDateFr(ctx.timestamp)}`,
        },
        employee: {
            label: employeeRole || 'L\'EMPLOYÉ(E)',
            name: clean(ctx.employeeName),
            mention: accord ? 'Lu et approuvé, bon pour accord' : 'Pris connaissance — l\'accusé de réception ne vaut pas acquiescement',
            body: SIGNATURE_MARKER,
            caption: `${accord ? 'Signature électronique' : 'Accusé de réception électronique'}${SIGNATURE_DATE_MARKER}`,
        },
    };
};

const footerLines = (ctx, extra = []) => [
    `${MODEL_VERSION} · Document généré par l'outil PHMC-FR · Réf. ${ctx.reference}`,
    'Document confidentiel destiné aux seules parties. La signature électronique de l\'outil PHMC-FR est horodatée ; chaque partie en conserve une copie.',
    ...extra,
];

const offerLine = (ctx, accord = true) => {
    const days = Number(ctx.champs.validiteOffreJours);
    if (!accord || !days) return null;
    const until = new Date(ctx.timestamp + days * 86400000);
    return `Le présent document constitue une offre ferme au sens de l'article 203 du Code Civil, valable ${dayWord(days)}, soit jusqu'au ${until.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} inclus. Passé ce délai sans acceptation, l'offre est caduque. L'acceptation doit être pure et simple : toute réserve ou modification vaut contre-offre (Code Civil, art. 204).`;
};

// ───────────────────────────── Clauses communes aux contrats d'emploi ─────────────────────────────

const secretArticle = (ctx, num) => ({
    id: 'secret',
    titre: 'Secret professionnel et confidentialité',
    blocs: () => [
        `L'Employé(e) est tenu(e) au ${b('secret professionnel')} et à une stricte confidentialité sur tout ce dont il/elle a connaissance dans l'exercice de ses fonctions : identité des patients, dossiers médicaux, diagnostics, ${ctx.service === 'coroner' ? 'constatations d\'autopsie, éléments d\'enquête, ' : ''}données du personnel, organisation interne et décisions non publiques. Ces informations ne sont communiquées qu'aux personnes qui ont besoin d'en connaître pour les soins ou le service.`,
        'La violation de ce secret, même par négligence, est un crime puni de 36 heures d\'emprisonnement et de 20 000 $ d\'amende, aggravé lorsque l\'information touche à une enquête pénale (Code Pénal, art. 323). L\'obligation vaut aussi pour les informations de santé protégées par la réglementation fédérale (H.I.P.A.A.).',
        { liste: [
            'Le secret ne fait pas obstacle à la levée du secret exonérée par l\'article 123 du Code Pénal (sécurité de l\'État, innocent injustement accusé, personnes menacées d\'un grave danger), exercée sans malice.',
            'Il ne fait pas obstacle à la production d\'éléments en exécution d\'un mandat régulièrement délivré par un juge ou d\'une injonction de la Cour (Code de Procédure Judiciaire, art. 330, 341 et 422). Toute demande de ce type est transmise sans délai à la Direction, qui contrôle sa régularité avant toute remise.',
            'Il cède devant le consentement libre et éclairé du patient, dans la limite de ce consentement.',
        ] },
        'Hors ces cas, une demande d\'information formulée par un tiers, y compris par les forces de l\'ordre, est renvoyée à la Direction. L\'Employé(e) ne confirme ni n\'infirme la présence d\'un patient, ni son état, par téléphone ou par message.',
        `Les écrits professionnels de l'Employé(e) sont des documents de l'administration : ils peuvent être communiqués au public dans les conditions de l'article I, section 3(b) de la Constitution et de l'article 328 du Code du Gouvernement, sous réserve du secret médical, de la vie privée des tiers et du secret des enquêtes (art. 328(a)). L'Employé(e) y consigne des faits professionnels et s'abstient de toute considération étrangère au service.`,
        `Cette obligation ${b('survit à la fin du contrat')}, sans limitation de durée.`,
    ],
});

const deontologieArticle = (ctx) => ({
    id: 'deontologie',
    titre: 'Probité, déontologie et conduite professionnelle',
    blocs: () => [
        'L\'Employé(e) exerce ses fonctions avec loyauté, probité, impartialité et dignité, dans l\'intérêt exclusif du service public de santé et des personnes prises en charge. À ce titre :',
        { liste: [
            `${b('Intégrité.')} Il/elle ne sollicite ni n'accepte aucun avantage, cadeau ou rétribution en échange d'un acte ou d'une abstention liés à ses fonctions (corruption : Code Pénal, art. 206). Il/elle ne perçoit aucune commission pour le placement d'une assurance ou d'un produit au nom de l'Employeur (Code du Gouvernement, art. 208).`,
            `${b("Conflits d'intérêts.")} Il/elle n'a aucun intérêt personnel dans un contrat conclu par lui/elle-même ou par l'Employeur en sa qualité officielle (Code du Gouvernement, art. 207 et 209), ne détient ni intérêt ni activité entrant en conflit substantiel avec la bonne exécution de ses devoirs (art. 300), et déclare à la Direction toute activité extérieure susceptible d'y conduire. Le fait de dissimuler un intérêt personnel dans une affaire que l'on doit juger, contrôler ou surveiller est une infraction (Code Pénal, art. 209).`,
            `${b('Sincérité des écrits.')} Les dossiers, rapports, certificats et déclarations de l'Employé(e) sont exacts, datés et signés de son nom. Toute falsification est un délit (Code Pénal, art. 527), toute altération, dissimulation ou destruction d'un élément pouvant servir de preuve un crime (art. 314).`,
            `${b('Biens, fonds et substances.')} Les fonds, le matériel, les médicaments et les substances contrôlées de l'Employeur ne sont utilisés que pour les besoins du service. Le détournement est un crime (Code Pénal, art. 520(b)). L'Employé(e) ne détient ni n'administre de substance contrôlée ou sur ordonnance en dehors d'une prescription ou d'une administration légales par un professionnel de santé agréé (Code Pénal, titre VI).`,
            `${b('Sobriété et vigilance.')} Il/elle ne se présente pas en service, et n'exerce pas, sous l'emprise de l'alcool, de stupéfiants ou de toute substance altérant sa vigilance (Code du Gouvernement, art. 236, appliqué par analogie à tout employé public). Lorsqu'un motif raisonnable le justifie, il/elle accepte de se soumettre à un contrôle de sobriété organisé par la Direction ; un refus peut être apprécié comme un manquement.`,
            `${b('Respect des personnes.')} Il/elle s'interdit tout harcèlement (Code Pénal, art. 415), tout harcèlement sexuel (art. 420), toute violence ou menace (art. 408 à 412) envers un patient, un proche ou un collègue. Toute relation sexuelle, même consentie, avec une personne confinée ou placée sous sa responsabilité, notamment dans un établissement de santé ou en détention, est un crime (art. 333).`,
            `${b('Vie privée.')} Il/elle ne filme, ne photographie ni n'enregistre un patient, un dossier ou une personne bénéficiant d'une attente raisonnable de confidentialité sans son consentement (Code Pénal, art. 422 et 423 ; Code de Procédure Judiciaire, art. 124(d)).`,
            `${b('Systèmes et accès.')} Il/elle n'utilise les comptes, badges et systèmes qu'à titre personnel et pour le service, ne les partage pas, et s'interdit tout accès non autorisé à un système informatique (Code Pénal, art. 532).`,
            `${b('Armes.')} Aucune arme n'est introduite dans les locaux de l'Employeur, sauf autorisation légale et expresse de la Direction.`,
        ] },
    ],
});

const droitsArticle = () => ({
    id: 'droits',
    titre: 'Droits et garanties de l\'Employé(e)',
    blocs: (num) => [
        { liste: [
            `${b('Égalité et non-discrimination.')} Nul ne peut être écarté d'un emploi, d'une promotion ou d'une fonction, ni sanctionné, en raison de son sexe, de sa race, de ses croyances, de sa couleur ou de son origine nationale ou ethnique (Constitution, art. I, section 7), et l'État ne peut ni discriminer ni accorder de traitement préférentiel sur ces bases dans l'accès à l'emploi public (art. I, section 29). Une infraction commise pour un motif discriminatoire est aggravée (Code Pénal, art. 127).`,
            `${b('Dignité et protection.')} L'Employeur prévient le harcèlement et les violences, instruit tout signalement et ne tolère aucune représaille contre la personne qui signale ou témoigne (Code Pénal, art. 310, 415 et 420).`,
            `${b('Liberté syndicale.')} L'Employé(e) adhère librement à un syndicat ou à une association professionnelle, ou s'en abstient ; aucune décision de recrutement, de titularisation, de discipline, d'avancement ou de licenciement ne peut s'en prévaloir, et l'Employeur observe une stricte neutralité (Code du Gouvernement, art. 219 et 220). Le représentant syndical peut l'assister gratuitement lorsqu'il/elle est convoqué(e) pour un motif disciplinaire (art. 224(a)).`,
            `${b('Droit de grève.')} Le droit de grève est reconnu dans les conditions de l'article 226 du Code du Gouvernement : grève pacifique, complète et continue, déclarée à l'Employeur au plus tard à son début, sans entrave à l'accès au lieu de travail. Il s'exerce sous réserve de l'article 227 : lorsqu'une grève menace de manière substantielle et imminente la santé ou la sécurité publiques, le Gouverneur peut en ordonner la fin.`,
            `${b('Vie privée et image.')} L'Employeur respecte la vie privée de l'Employé(e) (Constitution, art. I, section 1 ; Code Civil, art. 107(b)). Son image n'est exploitée, notamment sur le site ou les pages de communication du PHMC, qu'avec son consentement exprès, révocable pour l'avenir (Code Civil, art. 107(c)).`,
            `${b('Motivation des décisions.')} Toute décision défavorable à l'Employé(e) lui est notifiée par écrit ; les motifs lui sont communiqués sur demande (Code du Gouvernement, art. 325).`,
            `${b('Obligations civiques.')} L'État peut exiger les services de toute personne comme juré, témoin ou pour la protection de la vie et des biens (Code du Gouvernement, art. 108 ; Code de Procédure Judiciaire, art. 237 et 428(a)). L'absence nécessaire à ces obligations n'est jamais une faute ; l'Employé(e) en informe l'Employeur dès qu'il/elle en a connaissance.`,
            `${b('Dossier personnel.')} L'Employé(e) a accès à son dossier personnel sur simple demande et peut y faire annexer ses observations. Aucune pièce défavorable n'y est versée sans qu'il/elle en ait pris connaissance (stipulation du présent contrat).`,
            `${b('Immunités de la fonction.')} Dans l'exercice de ses fonctions, l'Employé(e) bénéficie, lorsqu'elles s'appliquent, des protections des articles 324 à 326 du Code Civil : l'employé public n'est pas responsable à titre personnel des actes relevant de son pouvoir d'appréciation, sauf violation d'une règle de droit si clairement établie qu'une personne raisonnable ne pouvait l'ignorer, ou connexité de l'acte avec l'une des infractions visées à l'article 324(d).`,
        ] },
    ],
});

const santeFormationArticle = () => ({
    id: 'sante',
    titre: 'Formation, santé et sécurité',
    blocs: () => [
        'L\'Employeur assure à l\'Employé(e) la formation initiale nécessaire à ses fonctions et sa formation continue ; il répond pleinement des fautes causées par une formation déraisonnablement insuffisante (Code Civil, art. 318(c)). L\'Employé(e) suit les formations obligatoires qui lui sont notifiées.',
        'L\'Employé(e) respecte les consignes de sécurité et d\'évacuation, ne laisse jamais une issue de secours ni un dispositif de sécurité incendie (extincteur, alarme, gicleur) obstrué ou inaccessible (Code du Feu, art. 202(a) et 208), et se conforme aux ordres d\'évacuation et aux périmètres de sécurité établis par les secours (art. 108).',
        'Les accidents survenus par le fait ou à l\'occasion du travail sont couverts par le régime d\'indemnisation des travailleurs institué par la Loi, indépendamment de toute faute (Constitution, art. X, section 1). L\'Employé(e) déclare sans délai à l\'Employeur tout accident ou blessure.',
    ],
});

const responsabiliteArticle = () => ({
    id: 'responsabilite',
    titre: 'Responsabilité',
    blocs: () => [
        'L\'Employeur répond des dommages causés par l\'Employé(e) dans le cadre de ses fonctions et de l\'exécution de ses tâches, même lorsqu\'il/elle a excédé ses instructions ; il n\'en répond pas lorsque l\'Employé(e) a agi dans un but strictement personnel, sans lien avec sa mission (Code Civil, art. 318(a) et (b)).',
        'L\'Employé(e) exerce selon le standard de son domaine d\'expertise (Code Civil, art. 308). Lorsque l\'Employeur a indemnisé une victime d\'un dommage résultant d\'une faute lourde ou intentionnelle de l\'Employé(e), il dispose d\'un recours contre lui/elle pour la part qui lui incombe (Code Civil, art. 416). L\'immunité qualifiée de l\'article 324 du Code Civil est levée dans les cas que cet article énumère.',
        'Aucune stipulation du présent contrat ne peut être interprétée comme exonérant l\'une des parties des conséquences d\'un acte intentionnel ou d\'une faute grave causant un préjudice corporel ou moral à autrui : une telle clause serait réputée non écrite (Code Civil, art. 412).',
    ],
});

const disciplineArticle = () => ({
    id: 'discipline',
    titre: 'Discipline et procédure',
    blocs: (num) => [
        `${b('Principe.')} Aucune sanction n'est infligée sans respect de la procédure ci-dessous, et aucune mesure défavorable n'est prise à raison de l'exercice d'un droit reconnu à l'Employé(e) par la Loi ou par le présent contrat, notamment l'adhésion à un syndicat (Code du Gouvernement, art. 219 et 220).`,
        `${b('Échelle des sanctions')} (stipulation du contrat) :`,
        { liste: [
            'l\'avertissement écrit ;',
            'le blâme ;',
            `la mise à pied sans rémunération, d'une durée maximale de ${dayWord(MAX_MISE_A_PIED_JOURS)} ;`,
            'la rétrogradation au grade immédiatement inférieur ;',
            'le licenciement.',
        ] },
        `${b('Procédure.')} Toute sanction, et tout licenciement, est précédé de la procédure suivante :`,
        { numerotee: true, liste: [
            `une ${b('convocation écrite')} à un entretien préalable, exposant les faits reprochés et la nature de la mesure envisagée, remise au moins ${CONVOCATION_DELAI_HEURES} heures avant l'entretien (délai compté d'heure à heure : Code de Procédure Judiciaire, art. 114(c)) ;`,
            `le droit de se faire ${b('assister')} d'un représentant de son choix, y compris syndical, que l'Employeur ne peut refuser (Code du Gouvernement, art. 224(a)), ainsi que l'accès aux éléments sur lesquels reposent les griefs ;`,
            'un ' + b('entretien') + ' au cours duquel l\'Employeur expose les griefs et recueille les explications de l\'Employé(e), qui peut aussi les remettre par écrit ; l\'absence de l\'Employé(e) régulièrement convoqué(e) n\'empêche pas la tenue de l\'entretien ;',
            `une ${b('décision écrite et motivée')}, notifiée au plus tard ${dayWord(DECISION_DELAI_JOURS)} après l'entretien et dans le mois suivant la connaissance des faits par l'Employeur, délai suspendu en cas de poursuite pénale parallèle ou d'indisponibilité de l'Employé(e) ; passé ce délai, les faits ne peuvent plus être sanctionnés ;`,
            'seule une décision notifiée à l\'issue de cette procédure produit effet.',
        ] },
        `${b('Mesure conservatoire.')} En cas de faute grave présumée, l'Employeur peut, par décision écrite, suspendre provisoirement l'Employé(e) pour au plus ${dayWord(7)}, avec maintien de sa rémunération, dans l'attente de l'entretien et de la décision. Cette mesure n'est pas une sanction.`,
        `${b('Fautes graves.')} Sont notamment réputées fautes graves, rendant impossible le maintien du contrat, après respect de la procédure : la violation du secret professionnel (article ${num.secret} du présent contrat) ; la falsification de documents ou d'éléments de preuve ; le détournement de fonds, de biens ou de substances ; la corruption ou l'influence illicite ; les violences, menaces, harcèlements et relations interdites avec une personne placée sous sa responsabilité ; l'exercice des fonctions sous l'emprise de l'alcool ou de stupéfiants ; la mise en danger caractérisée d'un patient ; l'abandon de poste ; le refus délibéré d'exécuter une instruction légitime.`,
        `${b('Recours.')} L'Employé(e) peut former un recours gracieux écrit auprès de la Direction dans les sept (7) jours suivant la notification de la décision ; la Direction répond dans les sept (7) jours, son silence valant rejet. Il/elle peut ensuite saisir les juridictions dans les conditions de l'article ${num.differends}.`,
    ],
});

const finArticle = (ctx, cdd) => ({
    id: 'fin',
    titre: 'Fin du contrat',
    blocs: (num) => [
        cdd
            ? 'Le contrat prend fin ' + b('de plein droit à son terme') + '. Il ne peut être rompu avant terme que par accord écrit des parties, pour faute grave après la procédure de l\'article ' + num.discipline + ', ou en cas de force majeure (Code Civil, art. 212), sous réserve de la période d\'essai. À défaut, la partie qui rompt sans cause répond du préjudice causé (Code Civil, art. 213 et 214).'
            : 'Le contrat à durée indéterminée prend fin par la démission, le licenciement, la rupture d\'un commun accord ou de plein droit, dans les conditions suivantes :',
        ...(cdd ? [] : [{ liste: [
            `${b('Démission.')} Notifiée par écrit, elle est assortie d'un préavis de quatorze (14) jours, sauf dispense accordée par écrit par l'Employeur.`,
            `${b('Licenciement.')} Il repose sur un motif réel et sérieux, communiqué par écrit (Code du Gouvernement, art. 325), et suit la procédure de l'article ${num.discipline}. Il est assorti d'un préavis de trente (30) jours, sauf faute grave. L'Employeur peut dispenser l'Employé(e) d'exécuter son préavis, qui reste alors rémunéré.`,
            `${b("Rupture d'un commun accord.")} Elle résulte d'un écrit signé des deux parties, qui en fixe la date et les conditions (Code Civil, art. 201 et 206).`,
        ] }]),
        `${b('Fin de plein droit.')} Le contrat prend fin de plein droit, sans préavis ni procédure, en cas de décès, de condamnation définitive de l'Employé(e) pour un crime (Code du Gouvernement, art. 235), d'inéligibilité à l'emploi public (art. 203 à 206) ou de vacance du poste, notamment par cessation des fonctions pendant trois (3) mois consécutifs sans maladie ni absence autorisée (art. 233(e)). L'Employeur la constate par écrit.`,
        `${b("Au départ de l'Employé(e).")} L'Employeur lui remet une attestation de fin de fonctions (dates, fonction, grade) et règle la rémunération due jusqu'à la date effective de fin, dans les sept (7) jours. L'Employé(e) restitue sans délai son badge, ses clés, son matériel et ses dossiers, et ses accès sont clôturés.`,
        `Les obligations de secret professionnel (article ${num.secret}), de loyauté et de restitution ${b('survivent')} à la fin du contrat.`,
    ],
});

const donneesArticle = () => ({
    id: 'donnees',
    titre: 'Données personnelles',
    blocs: () => [
        'L\'Employeur traite les données du dossier du personnel (identité, grade, contrats, évaluations, mesures disciplinaires, historique des accès) pour la gestion des ressources humaines et de la sécurité. Ces données sont conservées pendant la durée du contrat puis archivées dans le cadre légal ; l\'Employé(e) y a accès et peut en demander la rectification. La politique de confidentialité de l\'outil PHMC-FR en détaille les modalités.',
    ],
});

const differendsArticle = (ctx) => {
    const stage = ctx.type === 'stage';
    return {
        id: 'differends',
        titre: 'Règlement des différends',
        blocs: () => [
            'Tout différend relatif à l\'exécution ou à la rupture du présent document est d\'abord soumis par écrit à la Direction, qui répond dans les sept (7) jours.',
            'À défaut de règlement, les parties tentent une conciliation avant toute action civile, à tout moment avant le jugement (Code Civil, art. 414). À défaut d\'accord, la Cour supérieure du comté est compétente en première instance, sur dépôt d\'une plainte civile (Code de Procédure Judiciaire, art. 200(a) et 400(b)).',
            `${stage ? 'L\'Établissement' : 'L\'Employeur'} consent expressément à être poursuivi pour toute violation du présent document (Code Civil, art. 326(a)). Aucun emprisonnement ne peut sanctionner une dette ou une faute civile (Constitution, art. I, section 8).`,
        ],
    };
};

const generalesArticle = (ctx, { offre = true } = {}) => {
    const stage = ctx.type === 'stage';
    const de = stage ? 'de l\'Établissement' : 'de l\'Employeur';
    const par = stage ? 'le Stagiaire' : 'l\'Employé(e)';
    const duCompte = stage ? 'du Stagiaire' : 'de l\'Employé(e)';
    return {
        id: 'generales',
        titre: 'Dispositions générales',
        blocs: () => [
            { liste: [
                `${b('Intégralité.')} Le présent document, ses avenants, le règlement intérieur et la grille de rémunération publiée ${de} expriment l'intégralité de l'accord des parties ; aucun accord antérieur, écrit ou oral, ne peut le contredire (Code Civil, art. 218(b)).`,
                `${b('Bonne foi et interprétation.')} Les parties exécutent le document de bonne foi (Code Civil, art. 5, 208 et 209). Les clauses s'interprètent les unes par les autres ; un terme ambigu s'interprète contre celui qui l'a rédigé, et l'interprétation qui rend le document licite et exécutable est préférée (art. 218 et 219).`,
                `${b('Modification.')} Toute modification des éléments essentiels (fonction, grade, rémunération, durée) suppose un avenant écrit accepté par ${par}. Le silence ne vaut pas acceptation.`,
                `${b('Nullité partielle.')} Une stipulation contraire à la Loi est réputée non écrite ; elle n'affecte pas les autres.`,
                `${b('Force majeure.')} Aucune partie n'est responsable de l'inexécution résultant d'un événement imprévisible et insurmontable, extérieur aux parties (Code Civil, art. 212).`,
                `${b('Forme et signature.')} Le document est établi par écrit (Code Civil, art. 206) et signé par voie électronique dans l'outil PHMC-FR ; la signature électronique de chaque partie, horodatée, vaut signature manuscrite. Les notifications se font par ce même outil et par l'adresse électronique du compte ${duCompte}.`,
                `${b('Langue.')} Le document est rédigé en langue française à la demande conjointe des parties, l'anglais étant la langue officielle de l'État (Constitution, art. III, section 6) ; une traduction peut être fournie sur demande.`,
            ] },
            ...(offre ? [offerLine(ctx)] : []),
        ],
    };
};

// ───────────────────────────── CDI / CDD ─────────────────────────────

const specificArticle = (ctx) => {
    const pole = poleOf(ctx.service, ctx.champs.role);
    const supervised = isSupervisedRole(ctx.champs.role);
    const lines = [];
    if (pole === 'soignant' || pole === 'dmec') {
        lines.push(`${b('Exercice dans la limite des compétences.')} L'Employé(e) n'accomplit que les actes que son grade et ses qualifications l'autorisent à accomplir${supervised ? `, et uniquement ${b('sous la supervision')} d'un praticien désigné par la hiérarchie : il/elle n'exerce aucune fonction de manière autonome` : ''}.`);
    }
    if (pole === 'soignant') {
        lines.push(
            `${b('Consentement et refus de soins.')} L'Employé(e) recueille le consentement du patient, l'informe des risques et, s'il refuse les soins ou le transport, fait établir et signer le formulaire de refus (AMA) et en conserve la trace au dossier.`,
            `${b('Dossier médical.')} Il/elle consigne sans délai, avec exactitude et lisiblement, les soins et constatations ; un dossier incomplet ou inexact engage sa responsabilité professionnelle (Code Civil, art. 308).`,
            `${b('Prescriptions et substances.')} La prescription, la délivrance et l'administration de médicaments et de substances contrôlées se font dans le cadre légal et selon les protocoles de l'établissement, avec traçabilité (Code Pénal, titre VI).`,
            `${b('Devoir de secours.')} Les fonctions de l'Employé(e) emportent l'obligation de porter secours à toute personne en danger dans son champ de compétence (Code Civil, art. 323(b)) ; il/elle poursuit son intervention avec une prudence raisonnable et ne laisse pas la victime dans une situation pire que celle où il/elle l'a trouvée.`,
        );
    }
    if (pole === 'dmec') {
        lines.push(
            `${b('Intégrité des corps et des prélèvements.')} L'Employé(e) traite les défunts avec dignité, ne pratique d'acte sur un cadavre que dans le cadre légal de sa mission (constatation, autopsie sur réquisition, mandat ou décision de l'autorité compétente) et s'interdit toute atteinte à l'intégrité d'un corps (Code Pénal, art. 334), ainsi que tout recel ou toute transaction portant sur un corps ou des éléments du corps (art. 335).`,
            `${b('Traçabilité et preuves.')} Prélèvements, scellés et pièces sont inventoriés, conservés en l'état et leur chaîne de possession est tracée ; toute altération ou dissimulation est une atteinte aux preuves (Code Pénal, art. 314).`,
            `${b('Expertise et témoignage.')} L'Employé(e) peut être cité(e) comme expert ou comme témoin (Code de Procédure Judiciaire, art. 237 et 238) ; il/elle dépose sous serment, avec indépendance et impartialité, et répond de tout faux témoignage (Code Pénal, art. 312).`,
            `${b('Secret des investigations.')} Les constatations médico-légales relatives à une enquête pénale ne sont communiquées qu'à l'autorité judiciaire compétente et au bureau du procureur ; leur divulgation à une personne susceptible d'être mêlée à l'affaire aggrave la violation du secret (Code Pénal, art. 323).`,
        );
    }
    if (pole === 'administration' || pole === 'polyvalent') {
        lines.push(
            `${b('Accès aux données.')} L'Employé(e) n'accède aux dossiers, aux registres et aux systèmes que dans la stricte mesure nécessaire à sa mission, et signale toute anomalie ou tentative d'accès non autorisé.`,
            `${b('Accueil et discrétion.')} Il/elle accueille les patients et le public avec courtoisie et neutralité, s'abstient de toute appréciation médicale et oriente vers le personnel compétent.`,
        );
    }
    if (ctx.champs.clausesParticulieres && String(ctx.champs.clausesParticulieres).trim()) {
        lines.push(`${b('Clauses particulières convenues.')} ${clean(ctx.champs.clausesParticulieres)}`);
    }
    return {
        id: 'specifiques',
        titre: 'Clauses propres aux fonctions exercées',
        blocs: () => [{ liste: lines }],
    };
};

const employmentContent = (ctx) => {
    const { champs, service } = ctx;
    const cdd = champs.typeContrat === 'cdd';
    const employer = EMPLOYERS[service] || EMPLOYERS.phmc;
    const role = normalizeRank(champs.role) || '—';
    const essai = Number(champs.essaiJours) || 0;
    const affectation = clean(champs.affectation);

    const definitions = [
        {
            id: 'objet',
            titre: 'Objet du contrat',
            blocs: () => [
                `L'Employeur engage l'Employé(e) en qualité de ${b(clean(champs.poste))}, au grade de ${b(role)}${affectation ? `, au sein du service « ${affectation} »` : ''}, qui accepte, aux conditions du présent contrat.`,
                `À compter de la prise d'effet du contrat et sous réserve des articles 2 et 3, l'Employé(e) est un ${b('employé public')} au sens de l'article 218 du Code du Gouvernement : il/elle est lié(e) à une autorité publique par un contrat d'embauche.`,
            ],
        },
        {
            id: 'conditions',
            titre: 'Conditions légales d\'engagement',
            blocs: () => [
                'Les parties constatent que l\'Employé(e) satisfait aux conditions d\'accès à l\'emploi public posées par la Loi, savoir :',
                { liste: [
                    'être âgé(e) de dix-huit (18) ans révolus (Code Civil, art. 104 ; Code du Gouvernement, art. 202) ;',
                    'résider dans l\'État de San Andreas (Code du Gouvernement, art. 202(a)) ;',
                    'n\'avoir fait l\'objet d\'aucune condamnation définitive pour un crime ni, pendant la période d\'inéligibilité applicable, pour un délit de corruption, de détournement de fonds publics, d\'extorsion, de vol de fonds publics, de parjure ou de conspiration en vue de commettre l\'un de ces actes (Code du Gouvernement, art. 203 et 204).',
                ] },
                'L\'Employeur vérifie ces conditions par les moyens prévus par la Loi. L\'Employé(e) lui remet, sur demande, une copie de son casier judiciaire, qu\'il/elle obtient gratuitement (Code de Procédure Judiciaire, art. 801(a) et 810(a)).',
                'Nul ne peut sciemment nommer une personne inéligible, ni exercer une fonction ou occuper un emploi publics en violation de ces règles (Code du Gouvernement, art. 205 et 206 ; Code Pénal, art. 322(c) et (d)) : le présent contrat est donc conclu sous la condition que ces exigences soient remplies, à défaut de quoi il est privé d\'effet de plein droit.',
                'Les titres, diplômes, autorisations et qualifications présentés par l\'Employé(e) à l\'appui de sa candidature sont réputés exacts. Toute tromperie intentionnelle déterminante du consentement de l\'Employeur ouvre droit à l\'annulation du contrat (Code Civil, art. 207(b)) et peut être poursuivie au titre de l\'escroquerie et du faux (Code Pénal, art. 519 et 527). L\'Employé(e) informe sans délai l\'Employeur de toute condamnation définitive.',
            ],
        },
        {
            id: 'serment',
            titre: 'Serment et entrée en fonction',
            blocs: () => [
                'Nul ne peut exercer une fonction publique sans avoir prêté serment (Code du Gouvernement, art. 231). Conformément à l\'article III, section 7 de la Constitution de l\'État de San Andreas, l\'Employé(e) prête, avant d\'entrer en fonction, le serment suivant :',
                { serment: SERMENT },
                'Le serment est reçu par l\'officier public habilité de l\'Employeur (Code du Gouvernement, art. 215). Sa prestation est constatée par la signature du présent contrat par l\'Employé(e), qui ne prend ses fonctions qu\'après cette formalité. Aucun autre serment, déclaration ou test n\'est exigé comme condition d\'accès à l\'emploi (Constitution, art. III, section 7).',
            ],
        },
        {
            id: 'duree',
            titre: 'Durée, prise d\'effet et période d\'essai',
            blocs: (num) => [
                cdd
                    ? `Le contrat est conclu ${b('pour une durée déterminée')}, du ${b(formatDateFr(champs.dateDebut))} au ${b(formatDateFr(champs.dateFin))}, pour le motif suivant : ${clean(champs.motifCdd) || '—'}. Il peut être renouvelé ou transformé en contrat à durée indéterminée par un avenant écrit signé avant son terme ; la poursuite de fait de la collaboration au-delà du terme, sans avenant, n'emporte pas transformation en contrat à durée indéterminée et doit être régularisée sans délai.`
                    : `Le contrat est conclu ${b('pour une durée indéterminée')} et prend effet le ${b(formatDateFr(champs.dateDebut))}.`,
                essai > 0
                    ? `Le contrat débute par une ${b('période d\'essai de ' + dayWord(essai))}. Pendant cette période, chaque partie peut y mettre fin par écrit, sans indemnité, moyennant un préavis de quarante-huit (48) heures. L'Employeur communique ses motifs sur demande (Code du Gouvernement, art. 325) et la rupture ne peut reposer ni sur un motif discriminatoire (Constitution, art. I, sections 7 et 29), ni sur l'exercice des droits syndicaux (Code du Gouvernement, art. 219).`
                    : 'Le contrat ne comporte pas de période d\'essai.',
            ],
        },
        {
            id: 'fonctions',
            titre: 'Fonctions et organisation du travail',
            blocs: () => [
                `L'Employé(e) exerce ses fonctions sous l'autorité de ${clean(champs.responsable) || 'sa hiérarchie directe'}, conformément aux protocoles et au règlement intérieur de l'Employeur, au sein ${employer.du} et en tout lieu relevant de sa mission.`,
                clean(champs.horaires)
                    ? `${b('Horaires et disponibilités :')} ${clean(champs.horaires)}.`
                    : 'Les horaires et disponibilités sont définis avec la hiérarchie selon les besoins du service.',
                'L\'Employeur peut affecter l\'Employé(e) à un autre service de même nature sans modifier son grade ni sa rémunération. Toute modification substantielle (fonction, grade, rémunération, durée) suppose son accord écrit par avenant : un contrat ne peut être modifié unilatéralement (Code Civil, art. 208).',
                'En cas de sinistre ou d\'incident grave, l\'Employé(e) peut être requis(e) dans les conditions de l\'article 314 du Code de Procédure Judiciaire et de l\'article 108(h) du Code du Gouvernement ; il/elle ne peut s\'y soustraire sans motif impérieux et légitime.',
            ],
        },
        specificArticle(ctx),
        {
            id: 'remuneration',
            titre: 'Rémunération',
            blocs: () => [
                `En contrepartie de son travail (Code Civil, art. 205), l'Employé(e) perçoit la rémunération brute suivante : ${b(clean(champs.remuneration))}${clean(champs.echelon) ? `, correspondant à l'${clean(champs.echelon)} de la grille de rémunération` : ''}. Elle est versée selon les modalités de paie de l'Employeur et soumise aux prélèvements prévus par la Loi.`,
                'L\'Employeur publie sur son site la grille des rémunérations par échelon (Code du Gouvernement, art. 326) ; elle fait foi pour le niveau d\'échelon.',
                'Aucune prime, indemnité ou avantage n\'est dû en dehors de ceux prévus par le présent contrat, ses avenants ou la grille publiée, et aucune somme ne peut être accordée après service rendu, l\'État et ses subdivisions ne pouvant faire don de fonds ou de biens publics (Constitution, art. IX, section 8). Les frais professionnels préalablement autorisés sont remboursés sur justificatifs.',
            ],
        },
        deontologieArticle(ctx),
        secretArticle(ctx),
        droitsArticle(),
        santeFormationArticle(),
        responsabiliteArticle(),
        disciplineArticle(),
        finArticle(ctx, cdd),
        donneesArticle(),
        differendsArticle(ctx),
        generalesArticle(ctx),
    ];

    return {
        title: cdd ? 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE' : 'CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE',
        subtitle: `${clean(champs.poste)} — ${role}`,
        visas: [
            'Vu la Constitution de l\'État de San Andreas, notamment son article I (sections 1, 3, 7, 8 et 29), son article III (sections 6 et 7), son article IX (section 8) et son article X (section 1) ;',
            'Vu le Code Civil de San Andreas, titre I, chapitre 3 (représentation et mandat), titre II (les contrats) et titre III (la responsabilité civile) ;',
            'Vu le Code du Gouvernement de San Andreas, titre II (officiers et employés publics) ;',
            'Vu le Code Pénal et le Code de Procédure Judiciaire de San Andreas, ainsi que le Code du Feu, en tant que de besoin ;',
            'Vu la réglementation fédérale relative à la confidentialité des informations de santé (H.I.P.A.A.).',
        ],
        parties: partiesBlocks(ctx),
        preambule: [
            'Il a été préalablement exposé que l\'Employeur assure une mission de service public de santé et recrute pour les besoins de celle-ci ; que l\'Employé(e) a pris connaissance du règlement intérieur et déclare accepter les contraintes de service qui s\'attachent à la fonction. Il a été convenu ce qui suit :',
        ],
        articles: compile(definitions),
        signatures: signaturesBlock(ctx, {
            kind: 'accord',
            intro: 'Fait à Los Santos, en deux exemplaires électroniques, un pour chaque partie. En signant, l\'Employé(e) reconnaît avoir lu l\'intégralité du contrat, avoir eu le temps de l\'examiner, prête le serment de l\'article 3 et accepte l\'offre de l\'Employeur sans réserve.',
        }),
        footer: footerLines(ctx),
    };
};

// ───────────────────────────── Convention de stage ─────────────────────────────

const stageContent = (ctx) => {
    const { champs, service } = ctx;
    const role = normalizeRank(champs.role) || '—';
    const employer = EMPLOYERS[service] || EMPLOYERS.phmc;
    const gratification = clean(champs.gratification);
    const definitions = [
        {
            id: 'objet',
            titre: 'Objet de la convention',
            blocs: () => [
                `La présente convention organise l'accueil de ${b(clean(ctx.employeeName))} en stage au sein ${employer.du}, sur le thème : ${b(clean(champs.poste))}${clean(champs.affectation) ? `, au service « ${clean(champs.affectation)} »` : ''}. Le stagiaire est accueilli avec le grade de ${b(role)}.`,
            ],
        },
        {
            id: 'statut',
            titre: 'Statut du stagiaire',
            blocs: () => [
                'Le stagiaire est majeur (dix-huit ans révolus : Code Civil, art. 104) ou, à défaut, représenté par son représentant légal (art. 105).',
                `Le stage a une finalité de formation : il ne fait pas du stagiaire un employé public au sens de l'article 218 du Code du Gouvernement. En conséquence, le stagiaire n'exerce ${b('aucune fonction publique de manière autonome')} (Code du Gouvernement, art. 231) : il accomplit uniquement les tâches décrites à l'article « Objectifs et activités », sous la supervision et la responsabilité de son tuteur.`,
                'Le stagiaire ne peut ni signer de certificat, de prescription ou de rapport en son nom propre, ni représenter l\'établissement, ni accéder seul à un dossier.',
            ],
        },
        {
            id: 'duree',
            titre: 'Durée',
            blocs: () => [
                `Le stage débute le ${b(formatDateFr(champs.dateDebut))} et prend fin le ${b(formatDateFr(champs.dateFin))}. Il ne peut être prolongé que par avenant écrit accepté du stagiaire.`,
                clean(champs.horaires) ? `${b('Horaires de présence :')} ${clean(champs.horaires)}.` : 'Les horaires de présence sont fixés avec le tuteur selon les besoins du service et les contraintes de formation.',
            ],
        },
        {
            id: 'objectifs',
            titre: 'Objectifs et activités',
            blocs: () => [
                `Les objectifs pédagogiques et les activités confiées sont les suivants : ${clean(champs.objectifs)}`,
                'Toute activité hors de ce cadre suppose l\'accord préalable du tuteur.',
            ],
        },
        {
            id: 'encadrement',
            titre: 'Encadrement et évaluation',
            blocs: () => [
                `Le stagiaire est encadré par ${b(clean(champs.tuteur))}, tuteur de stage, qui l'accueille, l'oriente, supervise ses actes et assure le lien avec la Direction. Un point d'étape a lieu à mi-parcours ; une évaluation écrite est remise au stagiaire en fin de stage, ainsi qu'une attestation de stage précisant les dates et les activités effectuées.`,
            ],
        },
        {
            id: 'gratification',
            titre: 'Gratification et frais',
            blocs: () => [
                gratification
                    ? `Le stagiaire perçoit une gratification de ${b(gratification)}, contrepartie de sa présence (Code Civil, art. 205), versée selon les modalités de paie de l'Employeur. Elle ne constitue pas un salaire et n'ouvre aucun droit à emploi.`
                    : 'Le stage n\'est pas gratifié ; la contrepartie du stagiaire est la formation reçue, et celle de l\'établissement l\'apport de son expérience au service (Code Civil, art. 205). Aucun avantage n\'est dû en dehors de ceux prévus par la présente convention (Constitution, art. IX, section 8).',
                'Les frais engagés pour le compte de l\'établissement, préalablement autorisés par le tuteur, sont remboursés sur justificatifs.',
            ],
        },
        {
            id: 'obligations',
            titre: 'Obligations du stagiaire',
            blocs: () => [
                'Le stagiaire respecte le règlement intérieur, les protocoles, les horaires et les instructions de son tuteur ; il fait preuve de probité, de discrétion et de respect envers les patients et le personnel. Il s\'interdit tout harcèlement (Code Pénal, art. 415 et 420), tout enregistrement de patient ou de dossier sans consentement (art. 422 et 423) et toute relation avec une personne placée sous la responsabilité de l\'établissement (art. 333).',
                'Il s\'abstient de tout usage d\'alcool, de stupéfiants ou de substance altérant sa vigilance durant sa présence, et n\'introduit aucune arme dans les locaux.',
            ],
        },
        {
            id: 'secret',
            titre: 'Secret professionnel',
            blocs: () => [
                `Le stagiaire est tenu au ${b('secret professionnel')} sur tout ce dont il a connaissance durant son stage. La violation du secret, même par négligence, est un crime (Code Pénal, art. 323). Cette obligation survit sans limitation de durée à la fin du stage ; elle ne fait pas obstacle à la levée du secret exonérée par l'article 123 du Code Pénal. Les demandes de tiers, y compris des forces de l'ordre, sont renvoyées au tuteur et à la Direction.`,
            ],
        },
        {
            id: 'responsabilite',
            titre: 'Responsabilité et sécurité',
            blocs: () => [
                'L\'établissement répond des dommages causés par le stagiaire dans le cadre de ses tâches et sous la supervision de son tuteur, dans les conditions de l\'article 318 du Code Civil, sauf lorsque le stagiaire a agi dans un but strictement personnel ; il demeure responsable de ses fautes intentionnelles. Aucune clause ne peut exonérer une partie d\'un acte intentionnel ou d\'une faute grave (Code Civil, art. 412).',
                'Le stagiaire respecte les consignes de sécurité et d\'évacuation et ne laisse jamais une issue ni un dispositif de sécurité incendie obstrué (Code du Feu, art. 202(a), 208 et 108).',
            ],
        },
        {
            id: 'rupture',
            titre: 'Discipline et fin anticipée',
            blocs: () => [
                `Le stage peut prendre fin avant son terme d'un commun accord, à la demande motivée du stagiaire, ou à l'initiative de l'établissement en cas de manquement grave (violation du secret, atteinte aux personnes ou aux biens, falsification, abandon du stage). La décision de l'établissement est précédée d'une convocation écrite remise au moins ${CONVOCATION_DELAI_HEURES} heures à l'avance, d'un entretien où le stagiaire peut être assisté d'un représentant de son choix, et d'une décision écrite et motivée (Code du Gouvernement, art. 325, par analogie).`,
                'Une fin anticipée donne lieu à une attestation indiquant la durée effectivement accomplie.',
            ],
        },
        differendsArticle(ctx),
        generalesArticle(ctx),
    ];
    return {
        title: 'CONVENTION DE STAGE',
        subtitle: `${clean(champs.poste)} — ${role}`,
        visas: [
            'Vu la Constitution de l\'État de San Andreas, notamment son article I (sections 1, 7 et 8), son article III (section 6) et son article IX (section 8) ;',
            'Vu le Code Civil de San Andreas, titre I (les personnes) et titre II (les contrats) ;',
            'Vu le Code du Gouvernement, titre II (officiers et employés publics), en tant que de besoin ;',
            'Vu le Code Pénal de San Andreas ;',
            'Vu la réglementation fédérale relative à la confidentialité des informations de santé (H.I.P.A.A.).',
        ],
        parties: partiesBlocks(ctx, { employeeLabel: 'le Stagiaire', employerLabel: 'l\'Établissement' }),
        preambule: ['Il a été préalablement exposé que l\'Établissement assure une mission de service public de santé et accueille des stagiaires dans un but de formation. Il a été convenu ce qui suit :'],
        articles: compile(definitions),
        signatures: signaturesBlock(ctx, {
            kind: 'accord',
            employeeRole: 'LE STAGIAIRE',
            intro: 'Fait à Los Santos, en deux exemplaires électroniques. En signant, le stagiaire reconnaît avoir lu l\'intégralité de la convention et l\'accepte sans réserve.',
        }),
        footer: footerLines(ctx),
    };
};

// ───────────────────────────── Avenant ─────────────────────────────

const avenantContent = (ctx) => {
    const { champs } = ctx;
    const ref = ctx.refContract || { champs: {}, signeLe: null, reference: '—' };
    const rc = ref.champs || {};
    const refLabel = `${lcFirst(CONTRACT_TYPES[rc.typeContrat] || 'contrat')} du ${formatTimestampDateFr(ref.signeLe || ref.envoyeLe || ref.creeLe)} (réf. ${ref.reference || '—'})`;
    const rows = [];
    const addRow = (label, before, after) => { if (after) rows.push([label, `${clean(before) || '—'}  →  ${b(clean(after))}`]); };
    addRow('Fonction', rc.poste, champs.nouveauPoste);
    addRow('Grade', normalizeRank(rc.role), champs.nouveauRole ? normalizeRank(champs.nouveauRole) : '');
    addRow('Service d\'affectation', rc.affectation, champs.nouvelleAffectation);
    addRow('Rémunération brute', rc.remuneration, champs.nouvelleRemuneration);
    addRow('Horaires', rc.horaires, champs.nouveauxHoraires);
    addRow('Responsable hiérarchique', rc.responsable, champs.nouveauResponsable);
    if (champs.nouvelleDateFin) addRow('Terme du CDD', formatDateFr(rc.dateFin), formatDateFr(champs.nouvelleDateFin));
    if (champs.transformationCdi) rows.push(['Nature du contrat', `CDD  →  ${b('CDI')} (durée indéterminée)`]);

    const definitions = [
        {
            id: 'objet',
            titre: 'Objet de l\'avenant',
            blocs: () => [
                `Le présent avenant modifie le ${refLabel} conclu entre les parties. Raison de la modification : ${clean(champs.motifAvenant)}`,
            ],
        },
        {
            id: 'modifications',
            titre: 'Modifications convenues',
            blocs: () => [
                'Les stipulations suivantes du contrat sont modifiées comme indiqué (situation actuelle → nouvelle situation) :',
                { tableau: rows },
                champs.transformationCdi ? 'Le contrat devient un contrat à durée indéterminée à la date d\'effet ; la période d\'essai, déjà accomplie, n\'est pas renouvelée. Il perd toute date de fin.' : null,
            ],
        },
        {
            id: 'effet',
            titre: 'Date d\'effet',
            blocs: () => [`Les modifications prennent effet le ${b(formatDateFr(champs.dateEffet))}, sous réserve de l'acceptation de l'Employé(e) dans le délai de validité de l'offre.`],
        },
        {
            id: 'maintien',
            titre: 'Maintien des autres stipulations',
            blocs: () => ['Toutes les autres stipulations du contrat, notamment le serment prêté, le secret professionnel et la procédure disciplinaire, demeurent inchangées et continuent de s\'appliquer. Le présent avenant en fait partie intégrante (Code Civil, art. 218).'],
        },
        {
            id: 'acceptation',
            titre: 'Acceptation',
            blocs: () => [
                'Une modification du contrat requiert l\'accord des deux parties : l\'Employé(e) est libre de la refuser, et son silence ne vaut pas acceptation. À défaut d\'acceptation dans le délai de validité de l\'offre, l\'avenant est caduc et le contrat se poursuit aux conditions antérieures (Code Civil, art. 203, 204 et 208).',
                offerLine(ctx),
                'La signature électronique de l\'outil PHMC-FR, horodatée, vaut signature manuscrite (Code Civil, art. 206).',
            ],
        },
    ];
    return {
        title: 'AVENANT AU CONTRAT',
        subtitle: refLabel,
        visas: [
            `Vu le ${refLabel} ;`,
            'Vu le Code Civil de San Andreas, titre II (les contrats), notamment ses articles 201 à 208 ;',
            'Vu le Code du Gouvernement de San Andreas, titre II (officiers et employés publics).',
        ],
        parties: partiesBlocks(ctx),
        preambule: ['Il est convenu ce qui suit :'],
        articles: compile(definitions),
        signatures: signaturesBlock(ctx, { kind: 'accord', intro: 'Fait à Los Santos, en deux exemplaires électroniques. En signant, l\'Employé(e) accepte les modifications ci-dessus.' }),
        footer: footerLines(ctx),
    };
};

// ───────────────────────────── Convocation, sanction, fin ─────────────────────────────

const notificationParties = (ctx) => {
    const employer = EMPLOYERS[ctx.service] || EMPLOYERS.phmc;
    const issuerIdentity = `${clean(ctx.issuer?.name) || 'la Direction'}${ctx.issuer?.title ? `, ${clean(ctx.issuer.title)}` : ''}`;
    return [
        `${b('De la part de :')} ${b(employer.nom)}, représenté par ${issuerIdentity}.`,
        `${b('À l\'attention de :')} ${b(clean(ctx.employeeName) || '________')}${ctx.employeeBadge ? ` (ID employé ${clean(ctx.employeeBadge)})` : ''}.`,
    ];
};

const convocationContent = (ctx) => {
    const { champs } = ctx;
    const licenciement = champs.objet === 'licenciement';
    const definitions = [
        {
            id: 'objet',
            titre: 'Objet de la convocation',
            blocs: () => [
                `Vous êtes convoqué(e) à un ${b('entretien préalable')} à ${licenciement ? 'une mesure pouvant aller jusqu\'au licenciement' : 'une sanction disciplinaire pouvant aller de l\'avertissement à la rétrogradation, voire au licenciement'}. ${b('Aucune décision n\'a été prise à ce jour')} : cet entretien a pour objet de vous exposer les faits reprochés et de recueillir vos explications.`,
            ],
        },
        {
            id: 'faits',
            titre: 'Faits reprochés',
            blocs: () => [clean(champs.faitsReproches), 'Ces faits sont ceux sur lesquels portera l\'entretien ; ils pourront seuls fonder une éventuelle décision.'],
        },
        {
            id: 'entretien',
            titre: 'Date, heure et lieu de l\'entretien',
            blocs: () => [
                { tableau: [
                    ['Date', formatDateFr(champs.dateEntretien)],
                    ['Heure', clean(champs.heureEntretien) || '—'],
                    ['Lieu', clean(champs.lieuEntretien)],
                    ['Entretien mené par', clean(champs.conduitPar)],
                ] },
                `Cette convocation vous est remise au moins ${CONVOCATION_DELAI_HEURES} heures avant l'entretien, délai compté d'heure à heure (Code de Procédure Judiciaire, art. 114(c)). En cas d'empêchement, informez la Direction sans délai afin de convenir d'une autre date.`,
            ],
        },
        {
            id: 'droits',
            titre: 'Vos droits',
            blocs: () => [
                { liste: [
                    `Vous pouvez vous faire ${b('assister')} par un représentant de votre choix, y compris un représentant syndical gratuitement ; l'Employeur ne peut refuser sa présence ni son intervention raisonnable (Code du Gouvernement, art. 224(a)).`,
                    'Vous avez accès aux éléments sur lesquels reposent les griefs et pouvez en demander communication avant l\'entretien (Code du Gouvernement, art. 325).',
                    'Vous pouvez vous expliquer oralement ou remettre vos explications par écrit, qui seront annexées à votre dossier.',
                    `Votre absence, régulièrement convoqué(e), n'empêche pas la tenue de l'entretien ; la décision éventuelle vous est notifiée par écrit et motivée, dans les ${dayWord(DECISION_DELAI_JOURS)} suivant l'entretien.`,
                    'Aucune représaille ne peut être exercée en raison de l\'exercice de ces droits ni de votre appartenance syndicale (Code du Gouvernement, art. 219 et 220).',
                ] },
            ],
        },
        champs.miseAPiedConservatoire ? {
            id: 'conservatoire',
            titre: 'Suspension à titre conservatoire',
            blocs: () => [`En raison de la gravité des faits, vous êtes suspendu(e) à titre conservatoire à compter de la réception de la présente, pour une durée de ${b(dayWord(Number(champs.dureeConservatoire) || 0))} au plus, ${b('avec maintien de votre rémunération')}, dans l'attente de l'entretien et de la décision. Cette mesure n'est pas une sanction et ne préjuge pas de la suite donnée.`],
        } : null,
    ].filter(Boolean);
    return {
        title: 'CONVOCATION À UN ENTRETIEN PRÉALABLE',
        subtitle: licenciement ? 'Licenciement envisagé' : 'Sanction disciplinaire envisagée',
        visas: [
            'Vu le contrat de travail liant les parties, notamment son article « Discipline et procédure » ;',
            'Vu le Code du Gouvernement de San Andreas, notamment ses articles 219, 220, 224 et 325.',
        ],
        partiesTitre: 'Émetteur et destinataire',
        parties: notificationParties(ctx),
        preambule: [],
        articles: compile(definitions),
        signatures: signaturesBlock(ctx, { kind: 'accuse', intro: 'La notification est réputée effectuée à la date de son envoi dans l\'outil PHMC-FR, à l\'adresse du compte de l\'employé(e) (Code de Procédure Judiciaire, art. 609, par analogie).' }),
        footer: footerLines(ctx),
    };
};

const sanctionContent = (ctx) => {
    const { champs } = ctx;
    const conv = ctx.convocation;
    const cc = conv?.champs || {};
    const sanctionLabel = SANCTIONS[champs.typeSanction] || '—';
    const effets = [];
    if (champs.typeSanction === 'mise_a_pied') effets.push(`la mise à pied est de ${b(dayWord(Number(champs.dureeJours) || 0))}, sans rémunération pour la période concernée, à compter du ${b(formatDateFr(champs.dateEffet))} ;`);
    if (champs.typeSanction === 'retrogradation') effets.push(`l'Employé(e) est rétrogradé(e) au grade de ${b(normalizeRank(champs.nouveauRole) || '—')} à compter du ${b(formatDateFr(champs.dateEffet))}, avec la rémunération attachée à ce grade ;`);
    if (champs.typeSanction === 'avertissement' || champs.typeSanction === 'blame') effets.push(`la sanction prend effet le ${b(formatDateFr(champs.dateEffet))} et est versée au dossier personnel ;`);
    const definitions = [
        {
            id: 'procedure',
            titre: 'Rappel de la procédure',
            blocs: () => [
                `Vous avez été convoqué(e), par convocation du ${b(formatTimestampDateFr(conv?.envoyeLe))}, à un entretien préalable qui s'est tenu le ${b(formatDateFr(cc.dateEntretien))} à ${clean(cc.heureEntretien) || '—'}. Vous avez pu vous y faire assister et y présenter vos explications. La présente décision est notifiée dans le délai prévu par votre contrat.`,
            ],
        },
        {
            id: 'faits',
            titre: 'Faits retenus',
            blocs: () => [clean(champs.faitsRetenus), clean(champs.motivation) || null],
        },
        {
            id: 'decision',
            titre: 'Sanction prononcée',
            blocs: () => [
                `Au vu de ces faits, l'Employeur prononce à votre encontre : ${b(sanctionLabel)}.`,
                { liste: effets },
                'Cette sanction est proportionnée à la gravité des faits et à votre situation. Elle ne fait pas obstacle à la poursuite de la relation de travail.',
            ],
        },
        {
            id: 'recours',
            titre: 'Voies de recours',
            blocs: () => [
                'Vous pouvez former un recours gracieux écrit auprès de la Direction dans les sept (7) jours suivant la notification ; la Direction répond dans les sept (7) jours, son silence valant rejet. Vous pouvez ensuite, après une tentative de conciliation (Code Civil, art. 414), saisir la Cour supérieure du comté (Code de Procédure Judiciaire, art. 200(a) et 400(b)).',
                'Vous pouvez obtenir sur demande communication des motifs de la décision (Code du Gouvernement, art. 325).',
            ],
        },
    ];
    return {
        title: 'NOTIFICATION DE SANCTION DISCIPLINAIRE',
        subtitle: sanctionLabel,
        visas: [
            'Vu le contrat de travail liant les parties, notamment son article « Discipline et procédure » ;',
            'Vu la convocation à l\'entretien préalable et le compte rendu de l\'entretien ;',
            'Vu le Code du Gouvernement de San Andreas, notamment ses articles 219, 220, 224 et 325.',
        ],
        partiesTitre: 'Émetteur et destinataire',
        parties: notificationParties(ctx),
        preambule: [],
        articles: compile(definitions),
        signatures: signaturesBlock(ctx, { kind: 'accuse', intro: 'La notification est réputée effectuée à la date de son envoi dans l\'outil PHMC-FR (Code de Procédure Judiciaire, art. 609, par analogie). La signature vaut accusé de réception, non acquiescement.' }),
        footer: footerLines(ctx),
    };
};

const finContent = (ctx) => {
    const { champs } = ctx;
    const rc = ctx.refContract?.champs || {};
    const motif = champs.motif;
    const refLabel = `${lcFirst(CONTRACT_TYPES[rc.typeContrat] || 'contrat')} signé le ${formatTimestampDateFr(ctx.refContract?.signeLe)} (réf. ${ctx.refContract?.reference || '—'})`;
    const preavis = Number(champs.preavisJours) || 0;
    const conv = ctx.convocation;

    const motifBlocs = {
        fin_essai: () => [`L'Employeur met fin à la période d'essai du ${refLabel}, moyennant le préavis de quarante-huit (48) heures prévu au contrat. ${clean(champs.motifsDetailles) ? `Motifs : ${clean(champs.motifsDetailles)}` : 'Les motifs sont communiqués sur demande (Code du Gouvernement, art. 325).'}`],
        fin_cdd: () => [`Le ${refLabel} arrive à son terme et prend fin de plein droit à la date indiquée ci-après, sans renouvellement.`],
        fin_stage: () => [`La convention de stage (${refLabel}) arrive à son terme à la date indiquée ci-après. Une attestation de stage est jointe à la présente.`],
        demission: () => [`L'Employeur prend acte de la démission que vous lui avez remise le ${b(formatDateFr(champs.dateRemiseDemission))}, dans les conditions du ${refLabel}. ${preavis ? `Un préavis de ${b(dayWord(preavis))} s'applique${champs.preavisDispense ? ', dont l\'Employeur vous dispense d\'exécution (préavis rémunéré)' : ''}.` : ''}`],
        rupture_amiable: () => [`Les parties conviennent de mettre fin d'un commun accord au ${refLabel}, à la date indiquée ci-après (Code Civil, art. 201 et 206). Chacune renonce à toute action relative à la rupture, à l'exception des droits nés de l'exécution du contrat avant cette date. ${clean(champs.motifsDetailles) ? clean(champs.motifsDetailles) : ''}`],
        licenciement: () => [
            `Au terme de la procédure d'entretien préalable (convocation du ${b(formatTimestampDateFr(conv?.envoyeLe))}, entretien du ${b(formatDateFr(conv?.champs?.dateEntretien))}), l'Employeur vous notifie votre licenciement, qui n'est pas de nature disciplinaire, pour le motif réel et sérieux suivant :`,
            clean(champs.motifsDetailles),
            `${preavis ? `Un préavis de ${b(dayWord(preavis))} s'applique${champs.preavisDispense ? ', dont l\'Employeur vous dispense d\'exécution (préavis rémunéré)' : ''}.` : ''}`,
        ],
        licenciement_disciplinaire: () => [
            `Au terme de la procédure d'entretien préalable (convocation du ${b(formatTimestampDateFr(conv?.envoyeLe))}, entretien du ${b(formatDateFr(conv?.champs?.dateEntretien))}), l'Employeur vous notifie votre licenciement pour faute${champs.fauteGrave ? ` ${b('grave')}, rendant impossible votre maintien dans l'établissement, y compris pendant un préavis` : `, assorti d'un préavis de ${b(dayWord(preavis))}`}. Faits retenus :`,
            clean(champs.motifsDetailles),
        ],
        plein_droit: () => [
            `L'Employeur constate que le ${refLabel} prend fin ${b('de plein droit')}, sans préavis ni procédure, sur le fondement suivant : ${b(FIN_BASES_LEGALES[champs.baseLegale] || '—')}.`,
            clean(champs.motifsDetailles),
        ],
    };

    const restitutions = clean(champs.restitutions) || 'badge, clés, matériel, documents et dossiers de l\'Employeur ; clôture de vos accès aux systèmes.';

    const definitions = [
        {
            id: 'objet',
            titre: 'Objet de la notification',
            blocs: () => [`La présente notifie la fin de votre contrat : ${b(FIN_MOTIFS[motif] || '—')}.`, ...(motifBlocs[motif] ? motifBlocs[motif]() : [])],
        },
        {
            id: 'date',
            titre: 'Date de fin et conditions',
            blocs: () => [
                { tableau: [
                    ['Date de fin effective', formatDateFr(champs.dateEffet)],
                    ['Contrat concerné', refLabel],
                    ['Fonction exercée', `${clean(rc.poste) || '—'} — ${normalizeRank(rc.role) || '—'}`],
                ] },
                `L'Employeur règle la rémunération due jusqu'à la date effective de fin dans les sept (7) jours. Vous restituez : ${restitutions}`,
                'Votre obligation de secret professionnel survit à la fin du contrat, sans limitation de durée.',
            ],
        },
        {
            id: 'attestation',
            titre: 'Attestation de fin de fonctions',
            blocs: () => [
                `L'Employeur atteste que ${b(clean(ctx.employeeName))} a exercé au sein ${(EMPLOYERS[ctx.service] || EMPLOYERS.phmc).du}, en qualité de ${b(clean(rc.poste) || '—')} (grade : ${b(normalizeRank(rc.role) || '—')}), du ${b(formatDateFr(rc.dateDebut))} au ${b(formatDateFr(champs.dateEffet))}. Cette attestation est délivrée pour servir et valoir ce que de droit ; elle n'emporte aucune appréciation sur la qualité du service.`,
            ],
        },
        {
            id: 'recours',
            titre: 'Voies de recours',
            blocs: () => [
                motif === 'plein_droit'
                    ? 'Vous pouvez contester cette constatation par un recours gracieux écrit auprès de la Direction dans les sept (7) jours suivant sa notification, puis, après tentative de conciliation (Code Civil, art. 414), devant la Cour supérieure du comté (Code de Procédure Judiciaire, art. 200(a) et 400(b)).'
                    : 'Vous pouvez former un recours gracieux écrit auprès de la Direction dans les sept (7) jours suivant la notification ; la Direction répond dans les sept (7) jours, son silence valant rejet. Vous pouvez ensuite, après tentative de conciliation (Code Civil, art. 414), saisir la Cour supérieure du comté (Code de Procédure Judiciaire, art. 200(a) et 400(b)).',
                'Les motifs de toute décision défavorable vous sont communiqués sur demande (Code du Gouvernement, art. 325).',
                motif === 'rupture_amiable' ? offerLine({ ...ctx, champs: { ...champs } }) : null,
            ],
        },
    ];

    const accord = acceptanceKind('fin', champs) === 'accord';
    return {
        title: 'NOTIFICATION DE FIN DE CONTRAT',
        subtitle: FIN_MOTIFS[motif] || '',
        visas: [
            `Vu le ${refLabel} ;`,
            ...(['licenciement', 'licenciement_disciplinaire'].includes(motif) ? ['Vu la convocation à l\'entretien préalable et le compte rendu de l\'entretien ;'] : []),
            'Vu le Code du Gouvernement de San Andreas, notamment ses articles 233, 235 et 325 ;',
            'Vu le Code Civil de San Andreas, titre II (les contrats).',
        ],
        partiesTitre: 'Émetteur et destinataire',
        parties: notificationParties(ctx),
        preambule: [],
        articles: compile(definitions),
        signatures: signaturesBlock(ctx, {
            kind: accord ? 'accord' : 'accuse',
            intro: accord
                ? 'Fait à Los Santos, en deux exemplaires électroniques. En signant, l\'Employé(e) accepte la rupture d\'un commun accord dans les conditions ci-dessus.'
                : 'La notification est réputée effectuée à la date de son envoi dans l\'outil PHMC-FR (Code de Procédure Judiciaire, art. 609, par analogie). La signature vaut accusé de réception, non acquiescement.',
        }),
        footer: footerLines(ctx),
    };
};

// ───────────────────────────── Point d'entrée ─────────────────────────────

export const buildDocumentContent = (ctx) => {
    switch (ctx.type) {
        case 'cdd':
        case 'cdi': return employmentContent(ctx);
        case 'stage': return stageContent(ctx);
        case 'avenant': return avenantContent(ctx);
        case 'convocation': return convocationContent(ctx);
        case 'sanction': return sanctionContent(ctx);
        case 'fin': return finContent(ctx);
        default: return employmentContent(ctx);
    }
};

export { parseIsoDate };
