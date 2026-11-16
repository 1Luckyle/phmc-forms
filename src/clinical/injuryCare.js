// src/clinical/injuryCare.js
//
// Ce que les « Précisions sur les blessures » changent à la prise en charge dans l'outil Pilou : la ZONE du corps, les PRÉCISIONS choisies, le TRAJET d'un projectile et le NOMBRE de lésions
// ajoutent chacun une conduite à tenir au parcours (pathways.js). Les mutilations ont déjà la leur (injuries.js : MUTILATIONS[].care).
// RÈGLE : tout choix proposé dans le formulaire a un effet — un test (injuryCare.test.js) vérifie que chaque zone et chaque précision de injuries.js a son entrée ici.
// Fonctions pures.
import { CONDITION_BY_ID } from './conditions';
import { INJURY_CONDITIONS, REGION_LABEL, injuryRowsOf, selectedInjuryIds, mutilationCareSteps } from './injuries';

// Nature de la blessure, pour choisir la bonne consigne d'une zone : plaie, os / articulation, brûlure, choc.
export const INJURY_KIND = {
    plaie_superficielle: 'wound', plaie_profonde: 'wound', plaie_arme_feu: 'wound', plaie_arme_blanche: 'wound', hemorragie_externe: 'wound',
    fracture_fermee: 'bone', fracture_ouverte: 'bone', entorse_luxation: 'bone',
    brulure: 'burn',
    trauma_cranien: 'blunt', trauma_thoracique: 'blunt', trauma_abdominal: 'blunt', polytraumatisme: 'blunt',
};

// Par zone : `all` (toujours présent), et au besoin une consigne propre à une nature de blessure (wound, bone, burn, blunt) qui la remplace.
export const REGION_CARE = {
    cuir_chevelu: {
        all: "Le cuir chevelu saigne beaucoup : compression prolongée, exploration au doigt ganté à la recherche d'un enfoncement de l'os, puis suture ou agrafes.",
        burn: "Brûlure du cuir chevelu : tonte prudente autour, pansement gras, surveillance du gonflement du visage.",
    },
    front: { all: "Front : rechercher un traumatisme crânien associé (Glasgow, pupilles) ; suture fine, la cicatrice sera visible." },
    visage: {
        all: "Visage : contrôler les voies aériennes (sang, dents, gonflement) ; suture au fil fin, avis maxillo-facial si la plaie est large ou si les os de la face sont douloureux.",
        burn: "Brûlure du visage : risque de gonflement des voies aériennes ; oxygène, position demi-assise, centre de brûlés.",
    },
    oeil: { all: "Œil : ne pas appuyer sur le globe, coque rigide de protection, pas de collyre avant l'avis ; une brûlure chimique se rince 15 à 30 minutes ; avis ophtalmologique urgent." },
    oreille: { all: "Oreille : suture en respectant le cartilage, pansement modelant pour éviter l'hématome ; du sang ou un liquide clair par le conduit fait suspecter une fracture du crâne." },
    nez: { all: "Nez : saignement contrôlé en pinçant 10 minutes, tête penchée en avant ; rechercher un hématome de la cloison ; pas de radiographie en urgence." },
    bouche: { all: "Bouche et dents : aspiration, dent tombée conservée dans du lait ou du sérum et réimplantée vite ; les lèvres se suturent en alignant bien le bord rouge." },
    machoire: { all: "Mâchoire : vérifier l'ouverture de la bouche et l'emboîtement des dents ; fracture = fronde de soutien, alimentation liquide, avis maxillo-facial ; voies aériennes surveillées." },
    cou: { all: "Cou : zone à très haut risque (voies aériennes, gros vaisseaux) ; compression douce d'un seul côté, jamais circulaire ; pas d'exploration au doigt, bloc si la plaie est profonde ; collier cervical en cas de choc." },
    thorax: {
        all: "Thorax : toute plaie est pénétrante jusqu'à preuve du contraire ; pansement fermé sur trois côtés si la plaie souffle, auscultation des deux côtés, eFAST, guetter le pneumothorax compressif.",
        bone: "Côtes : antalgie efficace, pas de bandage serré, exercices de respiration ; rechercher un pneumothorax et un volet costal.",
        burn: "Brûlure qui fait le tour du thorax : elle gêne la respiration, incisions de décharge à discuter.",
    },
    abdomen: { all: "Abdomen : à jeun, palpation douce, eFAST ; plaie pénétrante ou ventre dur = chirurgien ; des viscères sortis sont couverts de compresses humides, jamais rentrés." },
    dos: { all: "Dos : retournement en bloc à plusieurs, examen de toute la colonne ; une plaie du dos fait rechercher une atteinte du thorax, du rein ou de la moelle." },
    rachis: { all: "Rachis : immobilisation stricte (collier, matelas coquille), retournement en bloc ; tester la force et la sensibilité des quatre membres ; scanner avant toute mobilisation." },
    bassin: { all: "Bassin / hanche : ne pas tester la stabilité à répétition ; ceinture pelvienne serrée au niveau des hanches en cas de douleur ou de choc (hémorragie interne majeure possible) ; pas de sonde urinaire sans avis s'il y a du sang au méat." },
    epaule: { all: "Épaule : écharpe coude au corps ; contrôler le pouls au poignet et la sensibilité du moignon de l'épaule avant et après toute réduction." },
    bras: { all: "Bras : attelle ou écharpe ; tester l'extension du poignet et des doigts (nerf radial) ; garrot possible en amont en cas d'hémorragie." },
    coude: { all: "Coude : immobilisation à 90° en écharpe ; pouls au poignet et sensibilité des doigts à contrôler, le risque pour les vaisseaux et les nerfs est élevé." },
    avant_bras: { all: "Avant-bras : attelle prenant le coude et le poignet ; une douleur qui augmente à l'étirement des doigts fait craindre un syndrome des loges." },
    poignet: { all: "Poignet : attelle en position neutre, bagues retirées ; une plaie de la face avant impose de tester tendons, nerf médian et artères avant de suturer." },
    main: {
        all: "Main : toute plaie est explorée (tendons, nerfs, articulation) ; tester chaque doigt en flexion et en extension, la sensibilité des deux bords ; main surélevée, avis de chirurgie de la main au moindre doute.",
        burn: "Brûlure de la main : doigts pansés séparément, main surélevée en position de fonction, centre de brûlés.",
    },
    doigts: { all: "Doigt(s) : bagues retirées en urgence, anesthésie à la base du doigt, test des tendons ; attelle ou solidarisation avec le doigt voisin ; un hématome sous l'ongle s'évacue." },
    cuisse: { all: "Cuisse : gros vaisseaux et fémur ; une fracture du fémur peut faire perdre plus d'un litre de sang, attelle en traction et deux voies veineuses ; garrot haut placé en cas d'hémorragie." },
    genou: { all: "Genou : attelle en extension, glace ; gros épanchement, blocage ou instabilité = radiographie et avis ; une luxation du genou impose de contrôler le pouls du pied en urgence." },
    jambe: { all: "Jambe : attelle prenant le genou et la cheville, surélévation ; douleur croissante, mollet tendu, orteils engourdis = syndrome des loges, urgence chirurgicale." },
    cheville: { all: "Cheville : glace, contention, surélévation ; radiographie si l'os des malléoles est douloureux ou si l'appui est impossible ; béquilles." },
    pied: { all: "Pied : chaussure retirée avant le gonflement, surélévation ; une plaie de la plante (clou, verre) est explorée et lavée, rappel antitétanique ; appui protégé." },
    orteils: { all: "Orteil(s) : solidarisation avec l'orteil voisin, chaussure à semelle rigide ; un hématome sous l'ongle s'évacue." },
};

// Par précision : [temps du parcours, consigne]. Temps : 'now' (geste immédiat), 'assess' (examen et bilan), 'treat' (traitement).
export const PRECISION_CARE = {
    'Plaie nette': ['treat', "Plaie nette : fermeture directe possible après lavage (suture, colle ou strips), bon résultat esthétique attendu."],
    'Bords irréguliers / contuse': ['treat', "Bords contus : parage des tissus abîmés avant la suture, points espacés, risque d'infection plus élevé."],
    Superficielle: ['assess', "Plaie superficielle : vérifier tout de même le fond de la plaie avant de fermer."],
    'Profonde (plan musculaire)': ['treat', "Muscle atteint : suture par plans (muscle, sous-peau, peau), antibioprophylaxie, contrôle à 48 heures."],
    'Saignement actif': ['now', "Saignement actif : compression directe immédiate et continue, pansement compressif ; garrot si c'est un membre et que la compression échoue."],
    'Saignement contrôlé': ['assess', "Saignement contrôlé : ne pas retirer le pansement qui tient, surveiller toute reprise du saignement."],
    'Plaie souillée': ['treat', "Plaie souillée : lavage abondant et prolongé, brossage si besoin, antibioprophylaxie, rappel antitétanique ; fermeture différée si la plaie est très sale."],
    'Corps étranger': ['assess', "Corps étranger : radiographie avant l'exploration ; retiré s'il est accessible, laissé en place et calé s'il est profond ou planté."],
    'Atteinte tendineuse suspectée': ['assess', "Tendon suspect : tester chaque mouvement contre résistance ; attelle en position de repos et avis chirurgical, une simple suture de la peau ne suffit pas."],
    'Atteinte nerveuse suspectée': ['assess', "Nerf suspect : noter la sensibilité et la force en aval avant toute anesthésie ; avis chirurgical."],
    'Atteinte vasculaire suspectée': ['now', "Vaisseau suspect : compression, pouls et coloration en aval toutes les 5 minutes, voie veineuse, avis de chirurgie vasculaire immédiat."],
    'Plaie pénétrante': ['now', "Plaie pénétrante : ne rien retirer ni explorer au doigt, pansement adapté, eFAST, chirurgien prévenu."],
    "Orifice d'entrée seul": ['assess', "Orifice d'entrée seul : le projectile est encore dans le corps, radiographie de face et de profil pour le localiser."],
    "Orifices d'entrée et de sortie": ['assess', "Entrée et sortie : panser les deux orifices, imaginer le trajet entre les deux pour lister les organes menacés."],
    'Balle logée palpable': ['treat', "Balle palpable sous la peau : ne pas l'extraire aux urgences, repérage et retrait au bloc ; projectile remis aux autorités."],
    'Tir à bout portant': ['assess', "Tir à bout portant : dégâts profonds plus étendus que l'orifice (brûlure, poudre), parage chirurgical large ; constatations notées pour l'enquête."],
    'Éclats de projectile': ['assess', "Éclats : radiographie élargie, tous les éclats ne sont pas retirés ; surveillance des vaisseaux et des nerfs."],
    'Atteinte osseuse suspectée': ['treat', "Os touché par le projectile : immobilisation et antibiotique, prise en charge comme une fracture ouverte."],
    'Non déplacée': ['treat', "Fracture non déplacée : immobilisation simple, radiographie de contrôle à J7 pour dépister un déplacement secondaire."],
    'Déplacée': ['treat', "Fracture déplacée : réduction sous antalgie ou sédation puis radiographie de contrôle, chirurgie fréquente."],
    'Déformation visible': ['now', "Déformation visible : ne pas forcer ; réaligner doucement dans l'axe seulement si le membre est froid ou sans pouls."],
    Comminutive: ['treat', "Fracture comminutive (plusieurs fragments) : instable, ostéosynthèse au bloc."],
    'Gonflement important': ['assess', "Gonflement important : surélever, glacer, pas de plâtre circulaire fermé ; guetter le syndrome des loges."],
    'Hématome': ['assess', "Hématome : glace et compression douce ; s'il grossit vite ou devient tendu, rechercher un saignement actif."],
    'Pouls distal présent': ['assess', "Pouls en aval présent : le noter avec l'heure, à recontrôler après chaque mobilisation ou immobilisation."],
    'Pouls distal absent': ['now', "Pouls en aval absent : urgence vasculaire ; réaligner doucement le membre, recontrôler, chirurgien immédiatement."],
    'Sensibilité conservée': ['assess', "Sensibilité conservée : la noter comme référence, à recontrôler après la réduction."],
    'Os visible': ['now', "Os visible : compresses stériles humides, ne pas le repousser, antibiotique dans l'heure."],
    'Garrot posé': ['now', "Garrot en place : vérifier l'arrêt du saignement, écrire l'heure de pose sur le garrot ou sur le front, ne pas le desserrer, bloc rapide."],
    Gonflement: ['assess', "Gonflement : glace 15 minutes, surélévation, contention ; comparer à l'autre côté."],
    'Instabilité': ['assess', "Articulation instable : entorse grave probable, immobilisation rigide et avis orthopédique."],
    'Déformation': ['now', "Déformation de l'articulation : luxation probable, contrôle du pouls en aval, radiographie puis réduction rapide."],
    'Luxation réduite': ['treat', "Luxation réduite : contrôle du pouls et de la sensibilité, radiographie de contrôle, immobilisation environ 3 semaines."],
    'Appui impossible': ['assess', "Appui impossible : radiographie systématique, béquilles et décharge."],
    'Plaie du cuir chevelu': ['treat', "Plaie du cuir chevelu : compression, exploration à la recherche d'un enfoncement de l'os, suture ou agrafes."],
    'Perte de connaissance': ['assess', "Perte de connaissance : scanner cérébral et surveillance neurologique d'au moins 6 heures."],
    Vomissements: ['assess', "Vomissements : position latérale de sécurité si le patient est somnolent, antiémétique ; répétés, ils imposent le scanner."],
    "Saignement du nez ou de l'oreille": ['assess', "Sang par le nez ou l'oreille : fracture de la base du crâne à suspecter, scanner, pas de sonde par le nez ni de méchage serré."],
    'Embarrure suspectée': ['now', "Enfoncement du crâne suspecté : ne pas appuyer sur la zone, pansement léger, scanner et neurochirurgien."],
    "Amnésie de l'événement": ['assess', "Amnésie : signe de commotion, scanner à discuter, surveillance par un proche pendant 24 heures, repos."],
    '1er degré': ['treat', "1er degré : refroidissement, crème hydratante, antalgique simple ; guérison en quelques jours."],
    '2e degré superficiel': ['treat', "2e degré superficiel : pansement gras refait toutes les 48 heures, guérison en 10 à 14 jours."],
    '2e degré profond': ['treat', "2e degré profond : avis spécialisé, greffe de peau souvent nécessaire."],
    '3e degré': ['treat', "3e degré : peau cartonnée et insensible, pas de guérison spontanée ; centre de brûlés, excision et greffe."],
    'Phlyctènes': ['treat', "Cloques : les petites sont laissées intactes, les grandes ou gênantes sont mises à plat stérilement en gardant la peau comme pansement."],
    'Circonférentielle': ['now', "Brûlure qui fait le tour : effet garrot ; surélever, contrôler pouls et coloration chaque heure, incisions de décharge en urgence si le membre se refroidit."],
    'Brûlure chimique': ['now', "Brûlure chimique : poudre brossée, vêtements retirés, rinçage à grande eau 20 à 30 minutes ; produit identifié."],
    'Brûlure électrique': ['now', "Brûlure électrique : ECG et scope, lésions profondes invisibles entre l'entrée et la sortie du courant, bilan des muscles et des reins."],
    'Vêtements retirés': ['assess', "Vêtements retirés : vérifier qu'aucun tissu n'adhère encore, couvrir pour éviter l'hypothermie."],
    Contusion: ['assess', "Contusion : glace, antalgique, examen répété ; une douleur qui s'aggrave fait rechercher une lésion profonde."],
    Ecchymose: ['assess', "Ecchymose : en dessiner le contour pour suivre son extension ; une marque de ceinture fait rechercher une lésion interne."],
    'Douleur à la palpation': ['assess', "Douleur à la palpation : localiser le point précis, imagerie ciblée."],
    'Emphysème sous-cutané': ['now', "Air sous la peau : pneumothorax jusqu'à preuve du contraire ; oxygène, radiographie, drainage à préparer."],
    'Volet costal': ['now', "Volet costal : oxygène, antalgie puissante, soutien de la paroi ; ventilation assistée en cas d'épuisement."],
    'Défense abdominale': ['now', "Défense abdominale : à jeun strict, voie veineuse, chirurgien prévenu, scanner ou bloc."],
    'Fracture associée': ['treat', "Fracture associée : attelle après le contrôle de l'hémorragie ; elle compte dans la perte de sang estimée."],
    'Pansement compressif': ['assess', "Pansement compressif en place : vérifier que le sang ne le traverse pas, contrôler le pouls en aval."],
    'Saignement contrôlé par compression': ['assess', "Saignement contrôlé par la compression : relais par un pansement compressif, sans regarder dessous."],
    'Artériel (pulsatile)': ['now', "Saignement artériel : compression forte en amont, garrot sans tarder, bloc en urgence."],
    'Veineux (en nappe)': ['now', "Saignement veineux : compression directe et surélévation suffisent le plus souvent."],
};

export const TRAJECTORY_CARE = {
    Through: ['assess', "Balle transfixiante : deux orifices à panser, trajet complet à explorer."],
    Lodged: ['assess', "Balle logée : localisation par l'imagerie, extraction chirurgicale seulement si elle est accessible ou dangereuse."],
    Graze: ['treat', "Tir tangentiel : plaie en sillon, traitée comme une plaie contuse et brûlée (lavage, parage, pansement)."],
};

const asList = (value) => (Array.isArray(value) ? value : []);
const isMultiple = (count) => count === '5+' || Number(count) >= 2;

/**
 * Conduites à tenir tirées des précisions sur les blessures : [{ phase: 'now' | 'assess' | 'treat', text, conditionId, source: 'region' | 'precision' | 'trajectory' | 'count' | 'mutilation' }].
 * Une même consigne n'est donnée qu'une fois (deux plaies « saignement actif » = une seule ligne).
 */
export const injuryCareNotes = (formData = {}) => {
    const notes = [];
    const seen = new Set();
    const add = (phase, text, conditionId, source) => {
        if (!text || seen.has(text)) return;
        seen.add(text);
        notes.push({ phase, text, conditionId, source });
    };
    selectedInjuryIds(formData).forEach((conditionId) => {
        const kind = INJURY_KIND[conditionId] || 'wound';
        injuryRowsOf(formData, conditionId).forEach((row) => {
            const regions = row.region ? [row.region] : asList(row.regions);
            regions.forEach((region) => {
                const care = REGION_CARE[region];
                if (care) add('assess', care[kind] || care.all, conditionId, 'region');
            });
            asList(row.precisions).forEach((precision) => {
                const care = PRECISION_CARE[precision];
                if (care) add(care[0], care[1], conditionId, 'precision');
            });
            if (INJURY_CONDITIONS[conditionId].trajectory && TRAJECTORY_CARE[row.trajectory]) add(TRAJECTORY_CARE[row.trajectory][0], TRAJECTORY_CARE[row.trajectory][1], conditionId, 'trajectory');
            if (isMultiple(row.count)) {
                const [, many] = INJURY_CONDITIONS[conditionId].unit;
                const where = regions.map((region) => (REGION_LABEL[region] || region).toLowerCase()).join(', ');
                add('assess', `Lésions multiples (${row.count === '5+' ? '5 ou plus' : row.count} ${many}${where ? ` — ${where}` : ''}) : les numéroter et les décrire une par une, sans s'arrêter à la plus visible.`, conditionId, 'count');
            }
        });
    });
    mutilationCareSteps(formData).forEach((text) => add('now', text, '', 'mutilation'));
    return notes;
};

/** Lignes de blessures nettoyées pour Pilou : seulement celles des motifs choisis qui se localisent, avec une zone ou une précision ; les textes libres sont écartés (Pilou ne lit que ses listes). */
export const sanitizeInjuryDetails = (rows, conditionIds = []) => asList(rows)
    .filter((row) => row && conditionIds.includes(row.conditionId) && INJURY_CONDITIONS[row.conditionId] && CONDITION_BY_ID[row.conditionId])
    .map((row) => ({
        conditionId: row.conditionId,
        region: REGION_CARE[row.region] ? row.region : '',
        side: ['Right', 'Left', 'Both'].includes(row.side) ? row.side : '',
        count: ['1', '2', '3', '4', '5+'].includes(row.count) ? row.count : '',
        trajectory: INJURY_CONDITIONS[row.conditionId].trajectory && TRAJECTORY_CARE[row.trajectory] ? row.trajectory : '',
        precisions: asList(row.precisions).filter((precision) => PRECISION_CARE[precision]),
        note: '',
    }))
    .filter((row) => row.region || row.side || row.count || row.trajectory || row.precisions.length);
