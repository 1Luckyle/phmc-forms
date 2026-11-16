// src/clinical/pathwaysTrauma.js
//
// Parcours de prise en charge détaillés de Pilou — TRAUMATOLOGIE. Pour chaque motif, trois temps, dans l'ordre où on les fait :
//   now    : gestes immédiats (ce qui ne peut pas attendre) ;
//   assess : examen et bilan (ce que l'on cherche, ce que l'on demande) ;
//   treat  : traitement (gestes de soin, décisions, suites).
// Chaque étape s'écrit « Titre court à l'infinitif : comment faire, concrètement ». Le titre sert au suivi pas à pas, le détail explique le geste.
// Les médicaments (avec leurs doses), le matériel, la surveillance et l'orientation sont ajoutés par le moteur (pathways.js, protocols.js).

export const w = (now, assess, treat) => ({ now, assess, treat });

export const TRAUMA_PATHWAYS = {
    plaie_superficielle: w(
        [
            "Se protéger et installer : gants, patient assis ou allongé, zone dégagée et bien éclairée.",
            "Arrêter le saignement : compression directe avec une compresse stérile pendant 3 à 5 minutes, membre surélevé.",
        ],
        [
            "Examiner la plaie : longueur, profondeur, bords nets ou contus, souillure, corps étranger visible.",
            "Tester en aval : mobilité des doigts ou des orteils, sensibilité, pouls et coloration, à la recherche d'une atteinte d'un tendon, d'un nerf ou d'un vaisseau.",
            "Vérifier le terrain : date du dernier rappel antitétanique, anticoagulants, diabète, circonstances (morsure, objet rouillé, verre).",
        ],
        [
            "Laver : irrigation abondante au sérum physiologique à la seringue, du centre vers l'extérieur, puis antiseptique.",
            "Anesthésier : infiltration de lidocaïne par les berges de la plaie, attendre 2 à 3 minutes avant de suturer.",
            "Fermer : points séparés, colle cutanée ou strips selon la taille et la zone ; pas de fermeture pour une morsure ou une plaie de plus de 24 heures.",
            "Protéger : pansement sec stérile, antalgique simple pour les heures qui suivent, rappel antitétanique si besoin, consignes (garder au sec 48 h, retrait des fils entre J7 et J10, signes d'infection).",
        ],
    ),
    plaie_profonde: w(
        [
            "Comprimer : pression directe et ferme avec des compresses, membre surélevé.",
            "Renforcer : pansement compressif par-dessus ; garrot en amont si l'hémorragie persiste, heure notée.",
            "Conserver un fragment : tout lambeau ou segment détaché est gardé dans des compresses humides, en sac étanche, sur glace indirecte.",
        ],
        [
            "Explorer : profondeur, muscles, tendons, os ou articulation visibles, souillure, corps étranger.",
            "Tester l'aval : pouls, sensibilité, mobilité contre résistance (tendons).",
            "Radiographier : corps étranger, fracture associée ; statut antitétanique et circonstances (morsure, machine, verre).",
        ],
        [
            "Soulager et sécuriser : antalgique adapté à la douleur, morphine titrée si elle est intense ; voie veineuse et acide tranexamique si le saignement a été abondant.",
            "Anesthésier et laver : anesthésie locale ou loco-régionale, lavage abondant sous pression, parage des tissus abîmés.",
            "Réparer par plans : muscle, plan sous-cutané puis peau ; drainage si décollement ; une morsure est laissée ouverte.",
            "Prévenir l'infection : antibioprophylaxie, rappel antitétanique.",
            "Organiser la suite : bloc opératoire si tendon, nerf, vaisseau ou articulation atteints ; sinon pansement refait à 48 h.",
        ],
    ),
    fracture_fermee: w(
        [
            "Immobiliser d'emblée : ne pas mobiliser le membre, le soutenir dans la position trouvée, attelle provisoire qui prend les articulations au-dessus et en dessous.",
            "Retirer bagues et bijoux : avant que le gonflement ne les bloque ; découper le vêtement plutôt que de bouger le membre.",
            "Soulager : poche de glace enveloppée (jamais à même la peau), membre surélevé, antalgique dès que possible.",
        ],
        [
            "Contrôler l'aval du membre : pouls, chaleur, coloration, sensibilité et mobilité des doigts ou des orteils, notés avant et après chaque immobilisation.",
            "Rechercher une ouverture de la peau : la moindre plaie en regard fait basculer en fracture ouverte.",
            "Radiographier : face et profil, en prenant les articulations au-dessus et en dessous.",
        ],
        [
            "Réduire si déplacement : sous antalgie efficace ou sédation, traction douce dans l'axe, puis radiographie de contrôle.",
            "Immobiliser définitivement : attelle plâtrée ou résine, sans serrer ; plâtre circulaire fendu si un gonflement est attendu.",
            "Organiser la suite : avis orthopédique, bloc si la fracture est déplacée et instable ; sinon consignes (surélever, bouger les doigts, revenir si douleur croissante ou doigts froids, bleus ou engourdis) et contrôle à J7.",
        ],
    ),
    fracture_ouverte: w(
        [
            "Stopper l'hémorragie : compression directe autour du foyer, pansement compressif ; garrot en amont si le saignement ne cède pas, heure notée.",
            "Couvrir l'os : compresses stériles humides, sans repousser l'os ni explorer la plaie.",
            "Immobiliser sans réduire : attelle dans la position trouvée, sauf membre sans pouls (réaligner doucement dans l'axe).",
        ],
        [
            "Contrôler l'aval : pouls, chaleur, sensibilité, mobilité ; un membre froid ou sans pouls est une urgence vasculaire.",
            "Évaluer le retentissement : tension, fréquence cardiaque, pâleur, signes de choc ; décrire la plaie une fois pour ne pas rouvrir le pansement.",
            "Lancer le bilan : radiographie, bilan sanguin préopératoire et groupage, statut antitétanique.",
        ],
        [
            "Poser une voie veineuse : antalgique puissant titré ; remplissage et acide tranexamique si la tension est basse ou le saignement important.",
            "Donner l'antibiotique dans l'heure : par voie intraveineuse (alternative en cas d'allergie), avec le rappel antitétanique.",
            "Préparer le bloc : patient à jeun, lavage chirurgical, parage puis ostéosynthèse ou fixateur externe dans les 6 heures.",
        ],
    ),
    entorse_luxation: w(
        [
            "Mettre au repos : arrêt de l'appui ou de l'usage du membre, position qui soulage, soutenue par une écharpe ou un coussin.",
            "Glacer et soulager : poche de glace enveloppée pendant 15 minutes, articulation surélevée au-dessus du cœur, antalgique et anti-inflammatoire par la bouche.",
        ],
        [
            "Examiner l'articulation : gonflement, hématome, déformation, points douloureux précis sur l'os, stabilité.",
            "Contrôler l'aval : pouls, sensibilité et mobilité, surtout en cas de luxation (épaule, coude, genou).",
            "Radiographier avant toute manœuvre : pour éliminer une fracture associée.",
        ],
        [
            "Réduire une luxation : sous antalgie ou sédation, manœuvre douce et progressive, sans à-coup ; contrôle du pouls et radiographie ensuite.",
            "Immobiliser : bande de contention, orthèse ou attelle selon la gravité ; écharpe coude au corps pour l'épaule.",
            "Donner les consignes : repos, glace, contention, surélévation ; appui selon la douleur, béquilles si besoin, contrôle à J7 et rééducation.",
        ],
    ),
    trauma_cranien: w(
        [
            "Protéger le rachis cervical : tête maintenue en position neutre et collier cervical si chute, accident ou douleur du cou.",
            "Sécuriser les voies aériennes : position latérale de sécurité en bloc si vomissements ou somnolence, aspiration prête.",
        ],
        [
            "Coter le Glasgow : ouverture des yeux, réponse verbale, réponse motrice ; heure notée, à répéter toutes les 15 minutes.",
            "Examiner les pupilles : taille, symétrie, réaction à la lumière ; une pupille dilatée d'un seul côté est une urgence.",
            "Chercher les signes de gravité : perte de connaissance, amnésie, vomissements répétés, convulsion, écoulement clair ou sang par le nez ou l'oreille, hématome autour des yeux ou derrière l'oreille.",
            "Décider du scanner : perte de connaissance, Glasgow inférieur à 15, vomissements, anticoagulants, plus de 65 ans, mécanisme violent ou signe neurologique.",
        ],
        [
            "Soigner la plaie du cuir chevelu : compression (elle saigne beaucoup), exploration au doigt ganté, suture.",
            "Soulager sans masquer : paracétamol, antiémétique ; ni anti-inflammatoire ni sédatif avant le scanner.",
            "Positionner : tête surélevée à 30°, au calme, lumière douce.",
            "Organiser la suite : avis neurochirurgical si lésion au scanner ; sinon sortie accompagnée avec consignes écrites de surveillance pendant 24 heures.",
        ],
    ),
    brulure: w(
        [
            "Arrêter la brûlure : éloigner la source, retirer les vêtements non collés et les bijoux, éteindre ou rincer.",
            "Refroidir : eau tempérée (15 à 20 °C) pendant 15 à 20 minutes, jamais de glace ; couvrir le reste du corps pour éviter l'hypothermie.",
            "Protéger les voies aériennes : suie dans la bouche, voix rauque ou visage brûlé imposent de l'oxygène et un avis rapide (risque de gonflement).",
        ],
        [
            "Estimer la surface : règle des neuf chez l'adulte, la paume de la main du patient vaut 1 % ; la simple rougeur ne compte pas.",
            "Estimer la profondeur : rougeur douloureuse (1er degré), cloques (2e degré), peau blanche ou noire, cartonnée et insensible (3e degré).",
            "Repérer les zones à risque : visage, mains, pieds, plis, organes génitaux, brûlure qui fait le tour d'un membre, brûlure chimique ou électrique.",
        ],
        [
            "Soulager : antalgique adapté, morphine titrée si la brûlure est étendue ; la douleur est maximale pendant les soins.",
            "Panser : nettoyage doux, pansement gras stérile non adhérent, sans serrer ; jamais de corps gras ménager.",
            "Remplir si la brûlure est étendue : au-delà de 15 % de surface (10 % chez l'enfant), voie veineuse et remplissage, sonde urinaire pour suivre les urines.",
            "Orienter : centre de brûlés si surface étendue, 3e degré, zone à risque ou inhalation ; sinon pansement refait à 48 h et rappel antitétanique.",
        ],
    ),
    plaie_arme_feu: w(
        [
            "Sécuriser : scène sûre, arme écartée, forces de l'ordre prévenues ; aucun soin tant que le danger persiste.",
            "Arrêter l'hémorragie : compression directe, pansement hémostatique tassé dans la plaie, garrot sur un membre (heure notée) ; plaie soufflante du thorax fermée sur trois côtés.",
            "Déshabiller entièrement : découper les vêtements, retourner le patient en bloc, compter tous les orifices, dos, aisselles et périnée compris.",
            "Oxygéner et réchauffer : masque à haute concentration, couverture de survie dès le déshabillage terminé.",
        ],
        [
            "Reconstituer le trajet : orifices d'entrée et de sortie, organes possibles sur le trajet ; une balle peut dévier loin de son entrée.",
            "Chercher l'hémorragie cachée : thorax, abdomen, bassin, cuisses ; échographie eFAST au lit du patient.",
            "Contrôler l'aval d'un membre touché : pouls, sensibilité, mobilité.",
            "Lancer le bilan : groupage, bilan préopératoire, radiographie ou scanner si le patient est stable.",
        ],
        [
            "Poser deux voies veineuses de gros calibre : acide tranexamique dans les 3 premières heures, remplissage limité (tension systolique visée autour de 90 mmHg).",
            "Soulager : antalgique intraveineux titré, immobilisation du membre atteint.",
            "Prévenir l'infection : antibiotique intraveineux, rappel antitétanique.",
            "Conduire au bloc : sans attendre si le patient est instable ou si le tronc est touché ; le projectile n'est retiré que par le chirurgien.",
            "Signaler : plaie par arme à feu déclarée aux autorités, vêtements et projectile conservés comme pièces.",
        ],
    ),
    plaie_arme_blanche: w(
        [
            "Sécuriser : agresseur et arme écartés, forces de l'ordre prévenues.",
            "Laisser l'arme en place : si elle est encore dans la plaie, la caler avec des compresses et l'immobiliser ; elle sera retirée au bloc.",
            "Comprimer : pression directe autour de la plaie, pansement compressif ; garrot sur un membre en cas d'échec.",
            "Déshabiller entièrement : à la recherche d'autres plaies, dos et aisselles compris.",
        ],
        [
            "Évaluer la pénétration : localisation, largeur, direction probable de la lame ; toute plaie du tronc est pénétrante jusqu'à preuve du contraire.",
            "Chercher l'atteinte interne : essoufflement, ventre dur ou douloureux, pâleur, pouls rapide ; échographie eFAST.",
            "Contrôler l'aval d'un membre : pouls, sensibilité, mobilité des doigts (tendons).",
        ],
        [
            "Poser une voie veineuse : antalgique, remplissage prudent si la tension est basse, acide tranexamique si le saignement est important.",
            "Explorer et fermer : une plaie superficielle est explorée sous anesthésie locale, lavée et suturée ; une plaie profonde ou pénétrante est confiée au chirurgien.",
            "Prévenir l'infection : antibioprophylaxie, rappel antitétanique.",
            "Surveiller ou opérer : bloc si instabilité ou atteinte interne ; sinon observation de plusieurs heures avec examens répétés.",
        ],
    ),
    trauma_thoracique: w(
        [
            "Installer et oxygéner : position demi-assise, oxygène au masque à haute concentration.",
            "Décomprimer un pneumothorax compressif : détresse brutale, veines du cou gonflées, thorax distendu d'un côté ; exsufflation à l'aiguille au 2e espace intercostal, sur la ligne médio-claviculaire.",
            "Fermer une plaie soufflante : pansement fermé sur trois côtés, pour laisser l'air sortir sans le laisser entrer.",
        ],
        [
            "Regarder et ausculter : symétrie du thorax, volet costal, bruits respiratoires diminués d'un côté, air sous la peau (crépitation de neige).",
            "Mesurer : saturation, fréquence respiratoire, tension ; douleur à la palpation des côtes.",
            "Imager : échographie eFAST puis radiographie pulmonaire ; scanner si le traumatisme a été violent.",
        ],
        [
            "Drainer : drain thoracique au 5e espace intercostal, sur la ligne axillaire antérieure, pour un pneumothorax ou un hémothorax important ; acide tranexamique si l'hémorragie est massive.",
            "Soulager vraiment : antalgie suffisante pour respirer à fond et tousser, sinon l'infection pulmonaire guette.",
            "Hospitaliser : surveillance respiratoire continue ; bloc si le drain ramène d'emblée plus de 1,5 litre de sang.",
        ],
    ),
    trauma_abdominal: w(
        [
            "Allonger et rassurer : à plat dos, jambes fléchies, couverture ; rien par la bouche.",
            "Ne pas toucher aux viscères : des anses sorties sont couvertes de compresses humides, jamais rentrées ; un objet planté reste en place.",
        ],
        [
            "Palper doucement : douleur localisée, défense, ventre de bois, ecchymose de la ceinture de sécurité.",
            "Traquer le saignement interne : pouls rapide, pâleur, soif, tension qui baisse ; échographie eFAST à la recherche de liquide.",
            "Compléter : bandelette urinaire (sang), bilan sanguin et groupage ; scanner abdominal si le patient est stable.",
        ],
        [
            "Poser deux voies veineuses : remplissage prudent, acide tranexamique en cas de choc hémorragique.",
            "Soulager : antalgique intraveineux, sans attendre le diagnostic.",
            "Décider : bloc opératoire immédiat si le patient est instable avec une échographie positive ; sinon surveillance rapprochée et examens répétés.",
        ],
    ),
    polytraumatisme: w(
        [
            "Appeler l'équipe : annonce du polytraumatisé, rôles distribués, matériel de réanimation prêt.",
            "A – Voies aériennes : libérer en maintenant le rachis cervical, aspirer, canule ; collier cervical.",
            "B – Respiration : oxygène à haute concentration ; exsufflation si pneumothorax compressif.",
            "C – Circulation : garrot ou compression de toute hémorragie visible, ceinture pelvienne si le bassin est douloureux, deux voies veineuses.",
            "D – Conscience : Glasgow, pupilles, glycémie.",
            "E – Exposition : déshabiller entièrement, examiner le dos en bloc, puis couvrir et réchauffer.",
        ],
        [
            "Faire l'échographie eFAST : épanchement dans l'abdomen, le thorax ou autour du cœur.",
            "Examiner de la tête aux pieds : crâne, face, cou, thorax, abdomen, bassin, membres, dos.",
            "Lancer le bilan : groupage, bilan sanguin complet, radiographie du thorax et du bassin ; scanner du corps entier si le patient est stable.",
        ],
        [
            "Limiter le saignement : acide tranexamique, remplissage modéré, transfusion précoce si elle est disponible.",
            "Lutter contre la triade létale : réchauffer activement, limiter les solutés froids, corriger la coagulation.",
            "Soulager et immobiliser : antalgique titré, matelas coquille, attelles.",
            "Orienter : bloc immédiat si le patient est instable (chirurgie de sauvetage), scanner puis réanimation s'il est stabilisé.",
        ],
    ),
    hemorragie_externe: w(
        [
            "Comprimer : appui direct et ferme sur la plaie avec des compresses, sans relâcher pendant au moins 10 minutes.",
            "Renforcer : pansement compressif par-dessus le premier, sans l'enlever ; pansement hémostatique tassé dans une plaie profonde.",
            "Poser un garrot : sur un membre si le saignement persiste, 5 à 7 cm au-dessus de la plaie, serré jusqu'à l'arrêt du saignement ; heure notée et visible.",
            "Allonger : jambes surélevées en cas de pâleur ou de malaise, couverture.",
        ],
        [
            "Estimer la perte : sang au sol et dans les vêtements, pâleur, pouls rapide, tension, temps de recoloration de l'ongle.",
            "Identifier le saignement : artériel (rouge vif, en jet) ou veineux (sombre, en nappe) ; anticoagulants en cours.",
            "Prélever : hémoglobine, coagulation, groupage.",
        ],
        [
            "Poser une voie veineuse : acide tranexamique, remplissage si la tension est basse, oxygène en cas de choc.",
            "Faire l'hémostase définitive : ligature ou suture du vaisseau, au bloc s'il s'agit d'une artère.",
            "Gérer le garrot : jamais desserré sans avis médical ; durée limitée, relais chirurgical rapide.",
        ],
    ),
};
