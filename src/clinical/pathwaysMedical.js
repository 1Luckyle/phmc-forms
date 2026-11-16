// src/clinical/pathwaysMedical.js
//
// Parcours de prise en charge détaillés de Pilou — MOTIFS MÉDICAUX (cardio-vasculaire, respiratoire, neurologie, intoxications, métabolique et infectieux).
// Même format que pathwaysTrauma.js : now (gestes immédiats), assess (examen et bilan), treat (traitement) ; chaque étape s'écrit « Titre : comment faire ».
import { w } from './pathwaysTrauma';

export const MEDICAL_PATHWAYS = {
    // ── Cardio-vasculaire ──
    sca: w(
        [
            "Mettre au repos : patient demi-assis, aucun effort, on le rassure ; défibrillateur à portée de main.",
            "Faire l'ECG : 12 dérivations dans les 10 premières minutes, à répéter si la douleur change.",
            "Monitorer : scope, tension aux deux bras, saturation ; oxygène seulement si la saturation est sous 94 %.",
        ],
        [
            "Caractériser la douleur : serrement derrière le sternum, irradiation au bras gauche ou à la mâchoire, durée, sueurs, nausées ; heure de début.",
            "Lire l'ECG : un sus-décalage du segment ST signe un infarctus en cours et déclenche la filière d'urgence ; un ECG normal n'élimine rien.",
            "Prélever : troponine (à répéter entre 1 et 3 heures), bilan standard ; radiographie pulmonaire.",
            "Éliminer les autres urgences : dissection aortique (douleur déchirante, tensions différentes aux deux bras), embolie pulmonaire, pneumothorax.",
        ],
        [
            "Donner l'aspirine : dose de charge par la bouche, sauf allergie ou saignement.",
            "Soulager : trinitrine sous la langue si la tension systolique dépasse 100 mmHg, morphine titrée si la douleur persiste.",
            "Déboucher l'artère : sus-décalage ST = coronarographie en urgence (ou thrombolyse si le délai est trop long).",
            "Hospitaliser : soins intensifs de cardiologie, patient scopé pendant tout le transfert.",
        ],
    ),
    arret_cardiaque: w(
        [
            "Reconnaître en 10 secondes : inconscient, ne respire pas ou respire par à-coups ; appeler à l'aide, noter l'heure.",
            "Masser : talon de la main au centre du thorax, bras tendus, 5 à 6 cm de profondeur, 100 à 120 par minute, relâchement complet ; relais toutes les 2 minutes.",
            "Défibriller : électrodes posées dès l'arrivée de l'appareil, analyse, choc si le rythme est choquable, reprise immédiate du massage.",
            "Ventiler : 30 compressions pour 2 insufflations au ballon avec oxygène, canule en place.",
        ],
        [
            "Analyser le rythme toutes les 2 minutes : choquable (fibrillation, tachycardie ventriculaire) ou non (asystolie, activité électrique sans pouls).",
            "Chercher une cause réversible : manque d'oxygène, hémorragie, hypothermie, trouble du potassium ; pneumothorax compressif, tamponnade, toxiques, caillot (infarctus, embolie).",
            "Recueillir les circonstances : témoin, durée sans massage, antécédents, traitements.",
        ],
        [
            "Poser une voie : veineuse, ou intra-osseuse en cas d'échec.",
            "Injecter l'adrénaline : toutes les 3 à 5 minutes (tout de suite si le rythme n'est pas choquable, après le 3e choc sinon).",
            "Ajouter l'amiodarone : après le 3e choc si le rythme reste choquable.",
            "Sécuriser les voies aériennes : intubation par un opérateur entraîné, sans interrompre le massage plus de 5 secondes.",
            "Après la reprise d'un pouls : ECG, tension, saturation entre 94 et 98 %, température contrôlée, transfert en réanimation ; l'arrêt des manœuvres est décidé par le médecin.",
        ],
    ),
    crise_hypertensive: w(
        [
            "Mettre au calme : allongé ou demi-assis, 10 minutes de repos avant de remesurer.",
            "Mesurer correctement : brassard adapté au bras, aux deux bras, trois mesures.",
        ],
        [
            "Chercher une souffrance d'organe : douleur thoracique, essoufflement, déficit neurologique, trouble de la vue, confusion, grossesse.",
            "Compléter : ECG, bandelette urinaire, bilan sanguin (rein).",
            "Trouver le déclencheur : arrêt du traitement, douleur, stress, stimulants, anti-inflammatoires.",
        ],
        [
            "Sans souffrance d'organe : repos, traitement de la cause (douleur, anxiété), reprise du traitement habituel ; pas de baisse brutale.",
            "Avec souffrance d'organe : antihypertenseur intraveineux titré, baisse de 25 % au maximum dans la première heure, en soins intensifs.",
            "Organiser le suivi : contrôle chez le médecin traitant sous 48 à 72 heures, automesure à domicile.",
        ],
    ),
    tachyarythmie: w(
        [
            "Scoper : monitorage continu, défibrillateur prêt, voie veineuse.",
            "Juger la tolérance : tension, conscience, douleur thoracique, essoufflement ; mal toléré = choc électrique.",
        ],
        [
            "Faire l'ECG : complexes fins ou larges, rythme régulier ou irrégulier.",
            "Interroger : début brutal ou progressif, épisodes antérieurs, café, alcool, stimulants, fièvre, saignement.",
            "Prélever : ionogramme (potassium), thyroïde, troponine en cas de douleur.",
        ],
        [
            "Tenter les manœuvres vagales : tachycardie régulière à complexes fins et bien tolérée ; souffler dans une seringue pendant 15 secondes, puis allonger jambes levées.",
            "Ralentir par médicament : antiarythmique choisi selon le rythme, sur avis médical.",
            "Choquer si instable : choc électrique synchronisé sous sédation brève.",
            "Traiter la cause : fièvre, déshydratation, douleur, hémorragie ; avis cardiologique.",
        ],
    ),
    bradycardie: w(
        [
            "Scoper : monitorage, voie veineuse, électrodes de stimulation externe prêtes.",
            "Juger la tolérance : malaise, tension basse, confusion, douleur thoracique.",
        ],
        [
            "Faire l'ECG : bradycardie sinusale ou bloc auriculo-ventriculaire.",
            "Chercher la cause : bêtabloquants ou autres médicaments, infarctus, hypothermie, trouble du potassium, sportif entraîné.",
        ],
        [
            "Injecter l'atropine : si la bradycardie est mal tolérée, à renouveler selon l'effet.",
            "Stimuler : entraînement électrique externe si l'atropine échoue, sous sédation légère.",
            "Orienter : cardiologie pour surveillance et discussion d'un stimulateur cardiaque.",
        ],
    ),
    oap: w(
        [
            "Asseoir : jambes pendantes au bord du lit, jamais à plat.",
            "Oxygéner : masque à haute concentration, ventilation non invasive si elle est disponible.",
            "Scoper : tension, saturation, fréquence respiratoire en continu ; voie veineuse sans remplissage.",
        ],
        [
            "Ausculter : crépitants des deux bases qui montent, parfois sifflements ; chevilles gonflées, veines du cou gonflées.",
            "Faire l'ECG : infarctus ou trouble du rythme déclenchant.",
            "Imager et prélever : radiographie ou échographie pulmonaire, troponine, BNP, fonction rénale.",
        ],
        [
            "Donner le dérivé nitré : si la tension systolique dépasse 110 mmHg, sous surveillance de la tension.",
            "Donner le diurétique : furosémide intraveineux, urines surveillées (sonde ou bocal).",
            "Traiter le déclencheur : infarctus, arythmie, poussée de tension, écart de régime ou de traitement.",
            "Escalader : épuisement, confusion ou saturation qui ne remonte pas = intubation et soins intensifs.",
        ],
    ),
    syncope: w(
        [
            "Allonger : jambes surélevées jusqu'au retour complet de la conscience ; desserrer col et ceinture.",
            "Vérifier : respiration, pouls, glycémie capillaire.",
        ],
        [
            "Reconstituer le malaise : position, effort, signes avant-coureurs (sueurs, voile noir), durée, mouvements anormaux, morsure de langue, confusion au réveil.",
            "Faire l'ECG : trouble du rythme ou de la conduction.",
            "Mesurer la tension : couché, puis debout à 1 et 3 minutes (chute de plus de 20 mmHg).",
            "Chercher les blessures de la chute : crâne, face, poignets, hanche.",
        ],
        [
            "Malaise vagal typique : repos, hydratation, lever progressif, explications ; la sortie est possible.",
            "Hypotension ou déshydratation : remplissage, révision des traitements.",
            "Signes d'alarme : syncope à l'effort ou couché, palpitations, douleur thoracique, ECG anormal ou maladie du cœur = scope et avis cardiologique.",
        ],
    ),
    anaphylaxie: w(
        [
            "Injecter l'adrénaline : intramusculaire, face externe de la cuisse, immédiatement ; à renouveler après 5 minutes sans amélioration.",
            "Retirer l'allergène : arrêt de la perfusion ou du médicament, dard retiré, bouche rincée.",
            "Positionner : allongé jambes surélevées en cas de malaise ; assis si la gêne respiratoire domine ; jamais debout.",
            "Oxygéner : masque à haute concentration.",
        ],
        [
            "Évaluer la gravité : voix rauque ou langue gonflée, sifflements, tension, pouls, éruption, vomissements.",
            "Identifier le déclencheur : aliment, piqûre, médicament, latex ; heure du contact.",
            "Scoper : tension toutes les 5 minutes, saturation en continu.",
        ],
        [
            "Remplir : sérum physiologique rapide sur une voie veineuse de bon calibre si la tension reste basse.",
            "Lever le bronchospasme : salbutamol en nébulisation en cas de sifflements.",
            "Compléter : corticoïde et antihistaminique, qui ne remplacent jamais l'adrénaline.",
            "Surveiller au moins 6 heures : risque de rechute ; sortie avec stylo d'adrénaline, consignes et rendez-vous d'allergologie.",
        ],
    ),
    allergie_legere: w(
        [
            "Écarter l'allergène : arrêt de l'aliment ou du médicament suspect, peau rincée.",
            "Éliminer la gravité : pas de gêne respiratoire, de voix modifiée, de langue gonflée ni de malaise.",
        ],
        [
            "Examiner la peau : plaques rouges en relief qui démangent, étendue, gonflement des lèvres ou des paupières.",
            "Mesurer : tension, pouls, saturation, auscultation.",
            "Interroger : déclencheur probable, épisodes antérieurs, délai d'apparition.",
        ],
        [
            "Donner l'antihistaminique : par la bouche, effet en 30 à 60 minutes.",
            "Ajouter un corticoïde : si l'éruption est étendue ou le visage gonflé.",
            "Surveiller puis libérer : 1 à 2 heures d'observation, consignes de retour immédiat en cas de gêne respiratoire, allergène noté au dossier.",
        ],
    ),

    // ── Respiratoire ──
    asthme: w(
        [
            "Asseoir : penché en avant, bras appuyés, vêtements desserrés ; calmer et faire respirer lentement.",
            "Nébuliser : salbutamol avec de l'oxygène, sans attendre.",
            "Oxygéner : objectif de saturation entre 94 et 98 %.",
        ],
        [
            "Coter la gravité : parle par phrases, par mots ou plus du tout ; fréquence respiratoire, tirage, sueurs, agitation.",
            "Ausculter : sifflements des deux côtés ; un thorax silencieux est un signe d'extrême gravité.",
            "Mesurer le débit de pointe : avant et après le traitement (crise grave sous 50 % de la valeur habituelle).",
            "Chercher le déclencheur : infection, allergène, effort, arrêt du traitement de fond.",
        ],
        [
            "Répéter les nébulisations : toutes les 20 minutes pendant la première heure, avec ipratropium si la crise est sévère.",
            "Donner le corticoïde : par la bouche ou par voie intraveineuse, tôt.",
            "Réévaluer à 1 heure : sortie si la parole est normale et le débit de pointe au-dessus de 70 % ; sinon hospitalisation.",
            "Escalader : épuisement, confusion ou saturation basse malgré l'oxygène = soins intensifs.",
            "Préparer la sortie : technique d'inhalation vérifiée, corticoïde quelques jours, plan d'action écrit.",
        ],
    ),
    pneumopathie: w(
        [
            "Installer : demi-assis, oxygène si la saturation est sous 94 %.",
            "Mesurer : température, saturation, fréquence respiratoire, tension, conscience.",
        ],
        [
            "Ausculter : crépitants localisés, souffle, murmure diminué d'un côté.",
            "Coter la gravité : confusion, fréquence respiratoire au-dessus de 30, tension systolique sous 90, âge de plus de 65 ans.",
            "Imager et prélever : radiographie pulmonaire, bilan inflammatoire, hémocultures en cas de frissons.",
        ],
        [
            "Débuter l'antibiotique : adapté au terrain et aux allergies, première dose aux urgences.",
            "Faire baisser la fièvre : paracétamol, hydratation.",
            "Orienter : domicile avec contrôle entre 48 et 72 heures s'il n'y a aucun signe de gravité ; hospitalisation sinon.",
        ],
    ),
    detresse_respiratoire: w(
        [
            "Libérer les voies aériennes : corps étranger visible retiré, claques dans le dos puis compressions abdominales en cas d'étouffement, aspiration.",
            "Positionner : assis ou demi-assis, on ne l'allonge pas de force.",
            "Oxygéner : masque à haute concentration à 15 L/min ; ballon et masque si la respiration s'épuise.",
            "Appeler du renfort : matériel d'intubation prêt, patient scopé.",
        ],
        [
            "Compter et regarder : fréquence respiratoire, tirage, balancement entre thorax et abdomen, lèvres bleues, sueurs, parole impossible.",
            "Ausculter : sifflements (asthme), crépitants (œdème, infection), silence d'un côté (pneumothorax), bruit aigu à l'inspiration (obstacle haut).",
            "Chercher la cause : asthme, œdème pulmonaire, pneumothorax, allergie, embolie, inhalation ; radiographie et gaz du sang.",
        ],
        [
            "Traiter la cause : bronchodilatateur, adrénaline en cas d'allergie, exsufflation d'un pneumothorax compressif, diurétique en cas d'œdème.",
            "Assister la ventilation : ventilation non invasive si le patient coopère.",
            "Intuber : épuisement, pauses, troubles de la conscience ou saturation qui chute malgré l'oxygène.",
        ],
    ),
    noyade: w(
        [
            "Sortir de l'eau : à l'horizontale, en protégeant le cou en cas de plongeon.",
            "Ventiler d'abord : 5 insufflations initiales ; massage cardiaque en l'absence de pouls (30 pour 2).",
            "Oxygéner : masque à haute concentration dès que la respiration est efficace.",
            "Sécher et réchauffer : vêtements mouillés retirés, couvertures.",
        ],
        [
            "Évaluer : conscience, toux, mousse aux lèvres, saturation, auscultation (crépitants).",
            "Mesurer la température : l'hypothermie est fréquente.",
            "Chercher un traumatisme : rachis cervical, crâne ; malaise ou intoxication à l'origine de la noyade.",
            "Imager : radiographie pulmonaire, ECG.",
        ],
        [
            "Soutenir la respiration : oxygène, ventilation non invasive, intubation en cas de détresse.",
            "Lever un bronchospasme : salbutamol en nébulisation.",
            "Hospitaliser : surveillance d'au moins 6 à 24 heures même si tout semble normal, l'œdème pulmonaire peut être retardé.",
        ],
    ),

    // ── Neurologie ──
    convulsions: w(
        [
            "Protéger : écarter les objets, coussin sous la tête, ne pas retenir les mouvements, rien dans la bouche.",
            "Chronométrer : heure de début ; au-delà de 5 minutes, c'est un état de mal.",
            "Mettre en position latérale de sécurité : dès la fin des secousses, oxygène au masque.",
        ],
        [
            "Faire la glycémie capillaire : immédiate, une hypoglycémie se corrige tout de suite.",
            "Décrire la crise : début, côté, durée, perte d'urine, morsure de langue, confusion ensuite.",
            "Chercher la cause : épilepsie connue et traitement oublié, alcool ou sevrage, traumatisme crânien, fièvre, toxiques, grossesse.",
            "Examiner après la crise : Glasgow, pupilles, déficit, plaie de la langue ou du crâne.",
        ],
        [
            "Arrêter une crise prolongée : benzodiazépine intraveineuse, ou intramusculaire sans voie veineuse ; deuxième dose après 5 minutes.",
            "Traiter la cause : sucre en cas d'hypoglycémie, paracétamol en cas de fièvre.",
            "Orienter : scanner et hospitalisation si première crise, crise prolongée, déficit ou traumatisme ; sinon sortie accompagnée, sans conduite.",
        ],
    ),
    avc: w(
        [
            "Noter l'heure : dernière fois où le patient a été vu normal ; elle décide du traitement.",
            "Allonger : à plat ou tête à 30°, à jeun strict, oxygène seulement si la saturation est sous 94 %.",
            "Alerter la filière AVC : scanner prévenu avant l'arrivée du patient.",
        ],
        [
            "Faire le test FAST : visage qui tombe, bras qui chute, parole troublée ; puis examen neurologique complet.",
            "Faire la glycémie : une hypoglycémie peut imiter un AVC.",
            "Mesurer : tension aux deux bras, ECG (fibrillation), température.",
            "Passer au scanner ou à l'IRM : sans délai, pour distinguer infarctus et hémorragie.",
        ],
        [
            "Respecter la tension : ne pas la faire baisser sous 220/120 sans avis spécialisé.",
            "Déboucher l'artère : thrombolyse dans les 4 h 30, thrombectomie jusqu'à 6 heures et parfois plus, décidées par le neurologue.",
            "Prévenir les complications : test de déglutition avant toute boisson, tête surélevée, pas d'injection dans le bras paralysé.",
            "Hospitaliser : unité neuro-vasculaire, surveillance neurologique rapprochée.",
        ],
    ),
    migraine: w(
        [
            "Mettre au calme : pièce sombre et silencieuse, allongé.",
            "Éliminer l'urgence : début brutal en coup de tonnerre, fièvre avec nuque raide, déficit, traumatisme récent.",
        ],
        [
            "Interroger : douleur d'un côté, pulsatile, nausées, gêne à la lumière et au bruit, crises semblables auparavant.",
            "Examiner : tension, température, nuque, pupilles, force et sensibilité, marche.",
            "Imager seulement si alerte : scanner en urgence au moindre signe inhabituel.",
        ],
        [
            "Soulager tôt : antalgique ou anti-inflammatoire dès le début de la crise.",
            "Calmer les nausées : antiémétique, réhydratation.",
            "Préparer la sortie : repos, éviction des déclencheurs, agenda des crises, consultation si les crises sont fréquentes.",
        ],
    ),
    coma: w(
        [
            "Libérer les voies aériennes : bascule de la tête (ou mâchoire poussée en avant en cas de traumatisme), aspiration, canule.",
            "Mettre en position latérale de sécurité : si le patient respire, en respectant l'axe tête, cou, tronc.",
            "Oxygéner et scoper : masque à haute concentration, voie veineuse.",
            "Faire la glycémie : au bout du doigt, tout de suite ; une hypoglycémie se corrige en quelques minutes.",
        ],
        [
            "Coter le Glasgow et examiner les pupilles : serrées (opioïdes), dilatées, inégales (lésion du cerveau).",
            "Chercher des indices : boîtes de médicaments, seringues, odeur d'alcool, traces de chute, fièvre, raideur de nuque.",
            "Examiner de la tête aux pieds : traumatisme, déficit d'un côté, morsure de langue, éruption.",
            "Imager et prélever : scanner cérébral, bilan sanguin, toxiques, alcoolémie, ECG.",
        ],
        [
            "Donner les antidotes d'épreuve : glucose si la glycémie est basse, naloxone si les pupilles sont serrées et la respiration lente.",
            "Protéger les voies aériennes : intubation si le Glasgow est à 8 ou moins.",
            "Traiter la cause et orienter : réanimation, neurochirurgie ou médecine selon le diagnostic.",
        ],
    ),

    // ── Intoxications ──
    surdose_opioides: w(
        [
            "Stimuler et ventiler : appeler, stimuler ; ballon et masque avec oxygène si la respiration est sous 10 par minute.",
            "Injecter la naloxone : petites doses répétées jusqu'à une respiration efficace, pas jusqu'au réveil complet.",
            "Mettre en position latérale de sécurité : entre deux gestes, aspiration prête.",
        ],
        [
            "Reconnaître la triade : pupilles en tête d'épingle, respiration lente, conscience altérée.",
            "Chercher les indices : traces d'injection, patchs à retirer, matériel, produits associés.",
            "Compléter : glycémie, saturation, température, ECG ; du paracétamol est associé dans certains comprimés.",
        ],
        [
            "Entretenir l'effet : la naloxone agit 30 à 90 minutes, moins longtemps que l'opioïde ; nouvelle dose ou perfusion continue en cas de rechute.",
            "Gérer le réveil : agitation et sevrage possibles, on rassure et on garde le patient.",
            "Surveiller au moins 6 heures : fréquence respiratoire et conscience ; plus longtemps pour la méthadone ou les formes prolongées.",
            "Préparer la suite : évaluation du risque suicidaire, orientation en addictologie, kit de naloxone.",
        ],
    ),
    surdose_benzo: w(
        [
            "Protéger les voies aériennes : position latérale de sécurité, oxygène, aspiration prête.",
            "Surveiller la respiration : fréquence et saturation en continu, ballon prêt.",
        ],
        [
            "Quantifier la prise : produit, dose, heure, emballages vides.",
            "Chercher une association : alcool, opioïdes, antidépresseurs, qui aggravent tout.",
            "Examiner : Glasgow, pupilles, glycémie, température, ECG.",
        ],
        [
            "Soutenir : la plupart des patients ont seulement besoin de surveillance et d'oxygène.",
            "Réserver le flumazénil : coma avec dépression respiratoire ; jamais chez l'épileptique, le consommateur régulier ou en cas d'antidépresseur associé (convulsions).",
            "Donner le charbon activé : seulement si la prise date de moins d'une heure et que le patient est bien éveillé.",
            "Évaluer avant la sortie : avis psychiatrique si la prise est volontaire, pas de sortie seul.",
        ],
    ),
    surdose_stimulants: w(
        [
            "Calmer l'environnement : pièce tranquille, lumière douce, un seul interlocuteur, sécurité de l'équipe.",
            "Scoper : fréquence, tension, température, saturation.",
            "Refroidir : si la température dépasse 39 °C, déshabiller, asperger, ventiler.",
        ],
        [
            "Identifier le produit : cocaïne, amphétamines, ecstasy, heure et quantité.",
            "Faire l'ECG : manque d'oxygène du cœur, trouble du rythme ; toute douleur thoracique est prise au sérieux.",
            "Prélever : glycémie, ionogramme, enzymes musculaires, troponine.",
        ],
        [
            "Sédater par benzodiazépine : traitement de l'agitation, de la tension, de la tachycardie et de la douleur thoracique.",
            "Hydrater : perfusion pour protéger les reins.",
            "Éviter les bêtabloquants : ils peuvent aggraver la tension sous cocaïne ; en cas de douleur thoracique qui persiste, aspirine et avis cardiologique.",
            "Orienter : soins intensifs en cas d'hyperthermie, de convulsions ou de douleur thoracique ; sinon surveillance jusqu'au retour au calme.",
        ],
    ),
    intox_alcool: w(
        [
            "Protéger : position latérale de sécurité si le patient est somnolent, bassine, barrières du lit.",
            "Faire la glycémie : l'alcool la fait chuter, surtout chez le jeune.",
            "Réchauffer : couverture, vêtements mouillés retirés.",
        ],
        [
            "Chercher autre chose que l'alcool : traumatisme crânien, autre toxique, infection, hypoglycémie ; l'ivresse ne doit pas tout expliquer.",
            "Examiner : Glasgow, pupilles, plaies, température, haleine ; à répéter.",
            "Mesurer l'alcoolémie : par éthylomètre ou prise de sang.",
        ],
        [
            "Hydrater : perfusion en cas de vomissements ou d'impossibilité de boire.",
            "Donner la vitamine B1 : avant tout apport de sucre chez le buveur régulier.",
            "Calmer les vomissements : antiémétique, patient installé sur le côté pour éviter une fausse route.",
            "Surveiller jusqu'au dégrisement : sortie quand le patient marche, parle et s'oriente normalement, accompagné ; repérage d'une dépendance.",
        ],
    ),
    intox_paracetamol: w(
        [
            "Préciser la prise : dose totale, heure, forme, prise unique ou étalée, autres produits.",
            "Donner le charbon activé : si la prise date de moins d'une heure et que le patient est bien éveillé.",
        ],
        [
            "Calculer le risque : toxique au-delà de 150 mg/kg (moins en cas d'alcoolisme ou de dénutrition).",
            "Doser le paracétamol : à partir de la 4e heure après la prise, résultat reporté sur le nomogramme.",
            "Prélever : bilan du foie, coagulation, rein, à répéter.",
            "Ne pas se rassurer trop tôt : les premières heures sont souvent sans symptôme.",
        ],
        [
            "Débuter l'antidote : N-acétylcystéine intraveineuse sans attendre le dosage si la dose est toxique ou l'heure inconnue.",
            "Calmer les nausées : antiémétique, pour que le patient tolère la suite du traitement.",
            "Hospitaliser : surveillance du foie pendant 24 à 72 heures ; avis psychiatrique si la prise est volontaire.",
        ],
    ),
    intox_fumees: w(
        [
            "Soustraire : victime sortie de la zone enfumée par des secours équipés, vêtements imprégnés retirés.",
            "Oxygéner : masque à haute concentration à 15 L/min, immédiatement, quelle que soit la saturation affichée.",
            "Regarder les voies aériennes : suie dans le nez ou la bouche, voix rauque, sifflement à l'inspiration, visage brûlé.",
        ],
        [
            "Se méfier de l'oxymètre : le monoxyde de carbone fausse la saturation, qui paraît normale.",
            "Chercher les signes d'intoxication : maux de tête, vertiges, nausées, confusion, malaise ; plusieurs victimes dans le même lieu.",
            "Prélever et tracer : monoxyde de carbone dans le sang, lactates, ECG, troponine ; radiographie pulmonaire.",
        ],
        [
            "Poursuivre l'oxygène pur : pendant au moins 6 heures ; salbutamol en nébulisation en cas de sifflements.",
            "Donner l'antidote du cyanure : hydroxocobalamine en cas de coma, de choc ou d'arrêt cardiaque après un incendie en lieu clos.",
            "Protéger les voies aériennes : intubation précoce si les voies aériennes sont brûlées ou si la voix se modifie.",
            "Discuter le caisson hyperbare : perte de connaissance, signes neurologiques, femme enceinte.",
        ],
    ),
    agitation: w(
        [
            "Se protéger : sortie dégagée, objets dangereux écartés, renfort appelé, jamais seul.",
            "Désamorcer : voix calme, phrases courtes, distance, un seul interlocuteur ; on propose à boire ou de s'asseoir.",
        ],
        [
            "Chercher une cause du corps : glycémie, saturation, température, traumatisme crânien, toxiques, douleur, vessie pleine.",
            "Évaluer le danger : menaces, arme, idées suicidaires, délire.",
            "Recueillir l'histoire : entourage, antécédents psychiatriques, traitements, consommations.",
        ],
        [
            "Proposer un sédatif par la bouche : d'abord, si le patient l'accepte.",
            "Injecter en cas de danger : sédation intramusculaire, équipe coordonnée.",
            "Contenir en dernier recours : sur prescription, pour une durée courte, avec une surveillance toutes les 15 minutes.",
            "Surveiller après la sédation : respiration, saturation, conscience, tension.",
            "Orienter : avis psychiatrique une fois le calme revenu et la cause organique écartée.",
        ],
    ),

    // ── Métabolique et infectieux ──
    hypoglycemie: w(
        [
            "Mesurer la glycémie : au bout du doigt, immédiatement (hypoglycémie sous 0,70 g/L).",
            "Resucrer par la bouche : patient conscient qui avale, 15 g de sucre (3 morceaux, un verre de jus ou de soda).",
            "Resucrer par injection : patient inconscient ou qui n'avale pas, glucose intraveineux, ou glucagon intramusculaire sans voie veineuse.",
        ],
        [
            "Contrôler à 15 minutes : nouvelle glycémie, nouveau resucrage si elle reste basse.",
            "Chercher la cause : dose d'insuline ou de comprimés, repas sauté, effort, alcool.",
            "Examiner : conscience, déficit, traumatisme en cas de chute.",
        ],
        [
            "Consolider : collation de sucres lents (pain, biscuits) dès le réveil.",
            "Surveiller : glycémie toutes les 15 à 30 minutes jusqu'à stabilité ; plus longtemps sous comprimés hypoglycémiants.",
            "Préparer la sortie : cause comprise et corrigée, patient accompagné, sucre sur soi, contrôle chez le médecin.",
        ],
    ),
    acidocetose: w(
        [
            "Mesurer : glycémie capillaire et cétones (sang ou urines).",
            "Perfuser : voie veineuse, sérum physiologique pour réhydrater.",
            "Scoper : le potassium peut dérégler le cœur.",
        ],
        [
            "Reconnaître le tableau : soif, urines abondantes, amaigrissement, nausées, douleurs abdominales, respiration ample et rapide, haleine de pomme.",
            "Prélever : ionogramme (potassium), gaz du sang, fonction rénale ; ECG.",
            "Chercher le déclencheur : infection, oubli d'insuline, pompe en panne, diabète encore inconnu.",
        ],
        [
            "Réhydrater : sérum physiologique sur plusieurs heures, débit adapté au cœur et à l'âge ; antiémétique si les vomissements persistent.",
            "Débuter l'insuline : intraveineuse continue, seulement après avoir vérifié le potassium.",
            "Corriger le potassium : apport dès que le taux baisse, contrôle toutes les heures.",
            "Hospitaliser : soins continus, glycémie toutes les heures.",
        ],
    ),
    deshydratation: w(
        [
            "Évaluer l'état général : conscience, tension, pouls, capacité à boire.",
            "Débuter la réhydratation : soluté de réhydratation par petites gorgées fréquentes.",
        ],
        [
            "Rechercher les signes : bouche sèche, pli de peau qui persiste, yeux creux, urines rares et foncées, perte de poids.",
            "Préciser : nombre de selles et de vomissements, sang ou glaires, fièvre, voyage, entourage malade, aliments suspects.",
            "Examiner le ventre : souple ou douloureux, pour ne pas manquer une urgence chirurgicale.",
            "Prélever si sévère : ionogramme, fonction rénale.",
        ],
        [
            "Calmer les vomissements : antiémétique, puis reprise des boissons.",
            "Perfuser : en cas de vomissements incoercibles, de tension basse ou de déshydratation marquée.",
            "Soulager : antispasmodique, paracétamol en cas de fièvre.",
            "Préparer la sortie : boissons abondantes, alimentation légère, lavage des mains ; retour si sang dans les selles, fièvre élevée ou impossibilité de boire.",
        ],
    ),
    sepsis: w(
        [
            "Mesurer toutes les constantes : température, tension, pouls, fréquence respiratoire, saturation, conscience.",
            "Repérer la gravité : tension systolique à 100 ou moins, fréquence respiratoire à 22 ou plus, confusion, marbrures.",
            "Oxygéner et perfuser : oxygène si la saturation est basse, voie veineuse de bon calibre.",
        ],
        [
            "Chercher la porte d'entrée : poumons, urines, peau, ventre, méninges (nuque raide, taches violacées).",
            "Prélever avant l'antibiotique : hémocultures, bilan sanguin, lactates, bandelette urinaire.",
            "Imager selon l'orientation : radiographie pulmonaire, échographie.",
        ],
        [
            "Injecter l'antibiotique dans l'heure : à large spectre, après les prélèvements.",
            "Remplir : sérum physiologique rapide si la tension est basse ou les lactates élevés, à réévaluer.",
            "Faire baisser la fièvre : paracétamol, découvrir le patient.",
            "Orienter : réanimation si la tension ne remonte pas ; hospitalisation sinon ; des taches violacées imposent l'antibiotique immédiat.",
        ],
    ),
    douleur_abdominale: w(
        [
            "Installer : allongé, jambes fléchies, à jeun en attendant le diagnostic.",
            "Soulager : antalgique sans attendre, il ne gêne pas le diagnostic.",
        ],
        [
            "Localiser : zone douloureuse, irradiation, début brutal ou progressif, vomissements, transit, fièvre, règles.",
            "Palper : ventre souple, défense, contracture, douleur à la décompression ; orifices herniaires.",
            "Tester : bandelette urinaire, test de grossesse chez toute femme en âge de procréer.",
            "Prélever et imager : bilan inflammatoire, foie, pancréas ; échographie ou scanner selon l'orientation.",
        ],
        [
            "Traiter les symptômes : antispasmodique, antiémétique, perfusion en cas de vomissements.",
            "Demander l'avis chirurgical : défense, contracture, fièvre avec douleur localisée, occlusion.",
            "Surveiller ou libérer : examen répété en cas de doute ; sortie avec consignes si le ventre est souple et les examens rassurants.",
        ],
    ),
    colique_nephretique: w(
        [
            "Soulager vite : anti-inflammatoire intraveineux, complété si besoin par un autre antalgique.",
            "Laisser le patient bouger : aucune position ne soulage, c'est typique.",
        ],
        [
            "Reconnaître la douleur : lombaire d'un côté, brutale, irradiant vers l'aine ou les organes génitaux, avec agitation et nausées.",
            "Tester les urines : bandelette (sang), température.",
            "Chercher la complication : fièvre, absence d'urine, rein unique, grossesse, douleur qui résiste.",
            "Imager : échographie ou scanner sans injection ; fonction rénale.",
        ],
        [
            "Poursuivre l'antalgie : antispasmodique, relais par la bouche.",
            "Drainer en urgence : colique avec fièvre ou sans urine = avis urologique immédiat.",
            "Préparer la sortie : boire normalement, filtrer les urines pour récupérer le calcul, consultation d'urologie ; retour en cas de fièvre ou de douleur incontrôlée.",
        ],
    ),
    hypothermie: w(
        [
            "Mettre à l'abri : à l'horizontale, gestes doux, sans friction ni mobilisation brusque.",
            "Isoler : vêtements mouillés découpés, séchage, couvertures et couverture de survie, tête couverte.",
            "Scoper : le cœur refroidi est irritable.",
        ],
        [
            "Mesurer la température centrale : thermomètre adapté aux basses températures.",
            "Classer : légère (32 à 35 °C, frissons), modérée (28 à 32 °C, somnolence, plus de frissons), sévère (sous 28 °C, coma).",
            "Compléter : ECG, glycémie, recherche d'une cause (alcool, médicaments, chute, noyade).",
        ],
        [
            "Réchauffer passivement : couvertures, pièce chaude, boissons chaudes sucrées si le patient est conscient.",
            "Réchauffer activement : couverture chauffante, solutés tiédis, oxygène réchauffé si l'hypothermie est modérée ou sévère.",
            "Réanimer longtemps : en cas d'arrêt cardiaque, massage prolongé ; on ne déclare pas le décès tant que le patient n'est pas réchauffé.",
            "Hospitaliser : surveillance du rythme et de la température.",
        ],
    ),
    coup_chaleur: w(
        [
            "Soustraire à la chaleur : à l'ombre ou dans une pièce fraîche, déshabillé.",
            "Refroidir tout de suite : aspersion d'eau fraîche et ventilation, glace aux aisselles, à l'aine et au cou.",
            "Mesurer la température : objectif sous 39 °C en moins de 30 minutes.",
        ],
        [
            "Reconnaître la gravité : température au-dessus de 40 °C avec confusion, convulsions ou coma.",
            "Examiner : conscience, tension, pouls, peau, urines foncées.",
            "Prélever : ionogramme, rein, enzymes musculaires, foie, coagulation, glycémie.",
        ],
        [
            "Perfuser : sérum physiologique frais.",
            "Arrêter le refroidissement à 38,5 °C : pour ne pas basculer en hypothermie.",
            "Traiter les convulsions : benzodiazépine ; pas de paracétamol, inefficace ici.",
            "Hospitaliser : soins continus, surveillance des reins et du foie pendant 48 heures.",
        ],
    ),
};
