// src/clinical/protocols.js
//
// Outil « Pilou » de la Boîte à outils : on saisit un cas (âge, sexe, poids, taille, symptômes) et Pilou propose la prise en charge COMPLÈTE : constantes attendues, étapes de la procédure, matériel à
// préparer, gestes à réaliser, médicaments avec leurs doses calculées, examens, surveillance et orientation. Il s'appuie sur le même moteur que l'assistant des formulaires (engine.js, conditions.js) ;
// ce fichier ajoute, pour chaque motif, le MATÉRIEL, les GESTES, la SURVEILLANCE et des mots de symptômes pour retrouver le motif d'après un texte libre. Pur (ni React ni Firebase).
//
// À TENIR À JOUR : tout nouveau motif de conditions.js doit avoir son entrée dans PROTOCOLS (un test le vérifie).
import { CONDITIONS, CONDITION_BY_ID } from './conditions';
import { MEDICATION_BY_ID } from './medications';
import { buildSuggestions, patientFromForm, checkPrescription, entryText, prescriptionText, isPediatric, formatNumber } from './engine';
import { vitalsFromForm, vitalsFormFields } from './vitals';

// equipment : matériel à préparer · gestures : gestes à réaliser, dans l'ordre · monitoring : surveillance et signes d'alerte · symptoms : mots du langage courant
const p = (equipment, gestures, monitoring, symptoms = '') => ({ equipment, gestures, monitoring, symptoms });

export const PROTOCOLS = {
    // ── Traumatologie ──
    plaie_superficielle: p(
        ['Gants stériles', 'Sérum physiologique et seringue de lavage', 'Compresses stériles', 'Anesthésique local et aiguilles', 'Kit de suture, colle cutanée ou strips', 'Pansement', 'Vaccin antitétanique'],
        ['Lavage abondant au sérum physiologique, du centre vers l\'extérieur', 'Exploration de la plaie sous bon éclairage', 'Infiltration d\'anesthésique local si suture', 'Suture, colle ou strips', 'Pansement propre'],
        ['Contrôle de la plaie à 48 h', 'Signes d\'infection : rougeur qui s\'étend, chaleur, pus, fièvre'], 'coupure saignement égratignure entaille'),
    plaie_profonde: p(
        ['Gants stériles et champ stérile', 'Compresses hémostatiques et bandes compressives', 'Garrot tactique', 'Sérum physiologique en grande quantité', 'Kit de suture par plans, anesthésique local', 'Radiographie', 'Voie veineuse et antibiotique'],
        ['Compression directe avec les doigts sur la plaie', 'Surélévation du membre', 'Pose d\'un garrot si l\'hémorragie persiste (heure notée)', 'Lavage abondant et parage', 'Suture par plans', 'Pansement compressif'],
        ['Saignement à travers le pansement', 'Pouls, sensibilité et mobilité en aval', 'Tension et fréquence cardiaque toutes les 15 min'], 'plaie profonde déchirure morsure délabrement saigne beaucoup'),
    fracture_fermee: p(
        ['Attelle rigide ou écharpe', 'Bande de contention et coton de protection', 'Poche de glace', 'Antalgiques', 'Radiographie face et profil', 'Plâtre ou résine selon le cas'],
        ['Retrait des bagues et bijoux avant le gonflement', 'Immobilisation dans la position trouvée, articulations sus et sous-jacentes comprises', 'Contrôle pouls, sensibilité et mobilité avant et après l\'immobilisation', 'Glaçage (jamais direct sur la peau)', 'Réduction ou attelle selon le déplacement'],
        ['Pouls et chaleur en aval', 'Douleur disproportionnée ou membre froid, pâle ou engourdi : urgence (syndrome des loges)'], 'os cassé fracture douleur membre impossible bouger gonflement déformation'),
    fracture_ouverte: p(
        ['Compresses stériles humides et pansement stérile', 'Garrot tactique', 'Attelle', 'Voie veineuse, perfusion', 'Antibiotique intraveineux et vaccin antitétanique', 'Antalgiques puissants', 'Radiographie, bloc opératoire'],
        ['Contrôle de l\'hémorragie par compression', 'Pansement stérile humide sur l\'os exposé, sans le repousser', 'Immobilisation sans réduction', 'Antalgie et antibiothérapie sans délai', 'Bilan vasculo-nerveux, départ au bloc'],
        ['Hémorragie et tension toutes les 10 min', 'Pouls et sensibilité en aval', 'Douleur incontrôlée ou membre froid : urgence chirurgicale'], 'os visible fracture ouverte exposé'),
    entorse_luxation: p(
        ['Poche de glace', 'Bande de contention ou orthèse', 'Attelle', 'Antalgiques et anti-inflammatoires', 'Radiographie', 'Sédation si réduction de luxation'],
        ['Glaçage 15 minutes toutes les 2 heures', 'Immobilisation de l\'articulation', 'Radiographie avant toute manœuvre', 'Réduction de la luxation sous antalgie, puis contrôle', 'Mise en décharge'],
        ['Pouls et sensibilité après réduction', 'Gonflement qui augmente ou perte de sensibilité : contrôle immédiat'], 'cheville foulure épaule déboîtée genou tordu articulation'),
    trauma_cranien: p(
        ['Collier cervical si mécanisme à risque', 'Lampe stylo pour les pupilles', 'Échelle de Glasgow', 'Scanner cérébral', 'Bassine (vomissements)', 'Glucomètre'],
        ['Immobilisation du rachis cervical si chute, accident ou doute', 'Glasgow et pupilles, à répéter toutes les 15 min', 'Recherche de plaie, d\'otorrhée ou de saignement de nez', 'Scanner si perte de connaissance, vomissements, anticoagulants ou Glasgow < 15', 'Consignes écrites au retour à domicile'],
        ['Somnolence, vomissements répétés, pupilles inégales, convulsions : urgence neurochirurgicale', 'Glasgow toutes les 15 min les premières heures'], 'coup à la tête commotion perte de connaissance vertige céphalée choc crâne'),
    brulure: p(
        ['Eau tempérée (15 à 20 °C)', 'Pansement gras stérile et compresses', 'Film alimentaire stérile ou pansement hydrocellulaire', 'Antalgiques', 'Perfusion et soluté de remplissage', 'Vaccin antitétanique', 'Table de calcul de la surface brûlée'],
        ['Refroidissement à l\'eau tempérée 15 à 20 minutes', 'Retrait des vêtements non adhérents, bagues et bijoux', 'Évaluation de la surface (règle des neuf) et de la profondeur', 'Pansement stérile, jamais de corps gras', 'Remplissage au-delà de 15 % de surface'],
        ['Température du patient (risque d\'hypothermie)', 'Diurèse et tension si grande surface', 'Brûlure du visage, des mains, des organes génitaux ou circulaire : centre spécialisé'], 'brûlure ébouillantement flamme feu cloque'),
    plaie_arme_feu: p(
        ['Garrot tactique et pansement hémostatique', 'Deux voies veineuses de gros calibre', 'Acide tranexamique, solutés de remplissage', 'Oxygène au masque', 'Ciseaux à vêtements, couverture de survie', 'Radiographie / scanner', 'Kit de bloc opératoire, antibiotique'],
        ['Sécurisation de la scène avant tout soin', 'Déshabillage complet : orifices d\'entrée et de sortie, dos compris', 'Compression directe ou garrot, pansement hémostatique dans la plaie', 'Deux voies veineuses, acide tranexamique, remplissage prudent', 'Prévention de l\'hypothermie', 'Départ au bloc'],
        ['Tension et fréquence toutes les 5 à 10 min', 'Hémorragie occulte (thorax, abdomen, bassin)', 'Déclaration réglementaire de la plaie par arme à feu'], 'balle tir coup de feu projectile fusillade'),
    plaie_arme_blanche: p(
        ['Pansements compressifs, compresses stériles', 'Garrot si membre', 'Voie veineuse, solutés, antalgiques', 'Échographe (eFAST)', 'Kit de suture / bloc opératoire', 'Antibiotique, vaccin antitétanique'],
        ['Compression autour de l\'arme, sans la retirer si elle est en place', 'Déshabillage complet à la recherche d\'autres plaies', 'Échographie de débrouillage thoracique et abdominale', 'Voie veineuse, antalgie, antibioprophylaxie', 'Exploration chirurgicale si plaie pénétrante'],
        ['Tension et fréquence toutes les 10 min', 'Essoufflement ou ventre dur : atteinte interne', 'Plaie qui saigne à nouveau'], 'couteau coup de couteau lame poignardé arme blanche'),
    trauma_thoracique: p(
        ['Oxygène au masque haute concentration', 'Aiguille d\'exsufflation ou kit de drainage thoracique', 'Échographe', 'Radiographie pulmonaire / scanner', 'Antalgiques', 'Oxymètre de pouls'],
        ['Position demi-assise', 'Exsufflation à l\'aiguille si pneumothorax compressif (2e espace intercostal, ligne médio-claviculaire)', 'Échographie thoracique (eFAST) puis radiographie', 'Drainage thoracique si pneumothorax ou hémothorax important', 'Antalgie suffisante pour respirer et tousser'],
        ['Saturation et fréquence respiratoire en continu', 'Aggravation brutale de la dyspnée, jugulaires gonflées : pneumothorax compressif'], 'côtes poumon thorax douleur respirer essoufflé pneumothorax'),
    trauma_abdominal: p(
        ['Deux voies veineuses', 'Solutés de remplissage', 'Échographe (eFAST)', 'Scanner abdominal', 'Antalgiques', 'Bilan sanguin et groupage', 'Sonde gastrique si besoin'],
        ['Voie veineuse et remplissage prudent', 'Échographie à la recherche d\'un épanchement', 'Patient à jeun strict', 'Scanner si stable, bloc opératoire si instable', 'Palpation douce, abdomen rigide à rechercher'],
        ['Tension et fréquence toutes les 10 à 15 min', 'Ventre qui se durcit, pâleur, malaise : hémorragie interne'], 'ventre coup ventre rate foie douleur abdominale choc'),
    polytraumatisme: p(
        ['Collier cervical et matelas coquille', 'Oxygène, matériel d\'intubation et d\'aspiration', 'Deux voies veineuses, acide tranexamique, solutés', 'Garrots tactiques', 'Couverture de survie', 'Échographe (eFAST), scanner corps entier', 'Monitorage multiparamétrique'],
        ['Bilan méthodique A B C D E : voies aériennes (rachis cervical), respiration, circulation, conscience, exposition', 'Contrôle immédiat de toute hémorragie', 'Oxygène, deux voies veineuses, acide tranexamique', 'Immobilisation sur matelas coquille', 'Scanner corps entier ou bloc selon la stabilité'],
        ['Monitorage continu', 'Triade létale : hypothermie, acidose, trouble de la coagulation (réchauffer)', 'Glasgow et pupilles répétés'], 'accident de la route grave choc multiples traumatismes chute de haut'),
    hemorragie_externe: p(
        ['Compresses et bandes compressives', 'Garrot tactique', 'Pansement hémostatique', 'Voie veineuse, solutés, acide tranexamique', 'Bilan sanguin et groupage'],
        ['Compression directe et continue, au moins 10 minutes', 'Pansement compressif sans enlever le premier', 'Garrot en cas d\'hémorragie de membre non contrôlée (heure notée)', 'Voie veineuse et remplissage si hypotension'],
        ['Tension et fréquence toutes les 10 min', 'Garrot : ne pas le desserrer sans avis médical'], 'saignement hémorragie sang garrot saigne abondamment'),

    // ── Cardiologie ──
    sca: p(
        ['Électrocardiogramme 12 dérivations', 'Monitorage cardiaque, défibrillateur à proximité', 'Voie veineuse', 'Oxygène (si saturation basse)', 'Aspirine, dérivé nitré, antalgique', 'Bilan sanguin (troponine)'],
        ['ECG 12 dérivations dans les 10 minutes', 'Patient au repos, demi-assis, monitoré', 'Voie veineuse, antiagrégant et traitement antalgique selon protocole', 'Recherche d\'un sus-décalage du segment ST', 'Transfert en cardiologie / coronarographie si infarctus'],
        ['Rythme et tension en continu', 'Douleur persistante, malaise, troubles du rythme : défibrillateur prêt'], 'douleur thoracique oppression poitrine bras gauche mâchoire sueurs infarctus'),
    arret_cardiaque: p(
        ['Défibrillateur', 'Planche à masser, ballon et masque, canule', 'Matériel d\'intubation, aspiration', 'Adrénaline', 'Voie veineuse ou intra-osseuse', 'Monitorage'],
        ['Appel de renfort, début immédiat du massage cardiaque (100 à 120/min, 5 à 6 cm)', 'Défibrillation dès que possible si rythme choquable', 'Ventilation au ballon (30 compressions pour 2 insufflations)', 'Voie veineuse, adrénaline toutes les 3 à 5 minutes', 'Recherche de la cause réversible (4H 4T)'],
        ['Rythme toutes les 2 minutes', 'Reprise d\'activité circulatoire : surveillance post-arrêt, température'], 'plus de pouls ne respire plus inconscient arrêt cardiaque'),
    crise_hypertensive: p(
        ['Tensiomètre, brassard adapté', 'ECG', 'Voie veineuse', 'Antihypertenseur', 'Bilan sanguin et urinaire'],
        ['Repos allongé, mesure aux deux bras', 'Recherche de signes de gravité : douleur thoracique, déficit neurologique, essoufflement', 'Baisse progressive de la tension, jamais brutale', 'ECG et bilan'],
        ['Tension toutes les 15 min', 'Céphalée intense, trouble de la vue, faiblesse d\'un côté : orientation AVC'], 'tension élevée hypertension céphalée bourdonnements'),
    tachyarythmie: p(
        ['ECG 12 dérivations', 'Monitorage, défibrillateur', 'Voie veineuse', 'Antiarythmique', 'Bilan sanguin (ionogramme, thyroïde)'],
        ['ECG pour caractériser le rythme', 'Manœuvres vagales si tachycardie régulière stable', 'Traitement médicamenteux selon le rythme', 'Choc électrique synchronisé si instabilité'],
        ['Rythme en continu', 'Hypotension, douleur thoracique, malaise : instabilité, choc électrique'], 'palpitations cœur qui bat vite tachycardie'),
    bradycardie: p(
        ['ECG 12 dérivations', 'Monitorage, défibrillateur / stimulation externe', 'Voie veineuse', 'Atropine', 'Bilan sanguin'],
        ['ECG et recherche d\'un bloc', 'Atropine si symptomatique', 'Stimulation électrique externe si inefficace', 'Recherche de la cause (médicaments, ischémie)'],
        ['Fréquence et tension en continu', 'Syncope ou hypotension : stimulation'], 'pouls lent bradycardie malaise fatigue'),
    oap: p(
        ['Oxygène, ventilation non invasive si disponible', 'Voie veineuse', 'Diurétique, dérivé nitré', 'ECG, radiographie ou échographie pulmonaire', 'Sonde urinaire'],
        ['Position assise, jambes pendantes', 'Oxygène à haut débit, ventilation non invasive', 'Dérivé nitré et diurétique', 'Recherche du facteur déclenchant (infarctus, arythmie, hypertension)'],
        ['Saturation, fréquence respiratoire et tension en continu', 'Fatigue respiratoire, confusion : intubation'], 'essoufflé crépitants mousse rose oedème du poumon noyé orthopnée'),
    syncope: p(
        ['ECG, monitorage', 'Glucomètre', 'Tensiomètre (couché / debout)', 'Voie veineuse', 'Bilan sanguin'],
        ['Allongé, jambes surélevées', 'Glycémie capillaire, ECG, tension couché puis debout', 'Recherche de traumatisme à la chute', 'Interrogatoire : circonstances, prodromes, palpitations'],
        ['Rythme sur monitor pendant l\'observation', 'Syncope à l\'effort, douleur thoracique ou ECG anormal : cardiologie'], 'malaise évanouissement perte de connaissance tombé vertige'),
    anaphylaxie: p(
        ['Adrénaline en ampoule ou stylo auto-injecteur', 'Oxygène, voie veineuse, solutés de remplissage', 'Antihistaminique et corticoïde', 'Bronchodilatateur', 'Monitorage', 'Matériel d\'intubation'],
        ['Adrénaline intramusculaire à la cuisse, sans attendre', 'Allongé jambes surélevées (assis si détresse respiratoire)', 'Oxygène, voie veineuse, remplissage', 'Répétition de l\'adrénaline à 5 à 15 min si besoin', 'Éviction de l\'allergène'],
        ['Surveillance prolongée au moins 6 heures (rechute possible)', 'Tension, saturation, gonflement du visage et de la gorge'], 'allergie gonflement visage gorge urticaire choc piqûre arachide difficulté respirer'),
    allergie_legere: p(
        ['Antihistaminique', 'Corticoïde si besoin', 'Crème apaisante', 'Oxymètre de pouls'],
        ['Éviction de l\'allergène', 'Antihistaminique par voie orale', 'Recherche de signes de gravité (gorge, respiration, tension)', 'Consignes de retour'],
        ['Surveillance 1 à 2 heures', 'Gonflement de la langue ou du visage, gêne respiratoire : traiter comme une anaphylaxie'], 'urticaire démangeaisons plaques rougeurs allergie'),

    // ── Respiratoire ──
    asthme: p(
        ['Bronchodilatateur en nébulisation ou chambre d\'inhalation', 'Oxygène', 'Corticoïde', 'Débitmètre de pointe', 'Oxymètre', 'Voie veineuse si grave'],
        ['Position assise', 'Bronchodilatateur répété (3 nébulisations dans l\'heure)', 'Oxygène pour saturation ≥ 94 %', 'Corticoïde par voie orale ou veineuse', 'Réévaluation du débit de pointe'],
        ['Saturation et fréquence respiratoire', 'Silence auscultatoire, épuisement, difficulté à parler : détresse vitale'], 'sifflement asthme essoufflement toux sifflante crise d\'asthme'),
    pneumopathie: p(
        ['Radiographie pulmonaire', 'Oxymètre, thermomètre', 'Prélèvements (bilan sanguin)', 'Oxygène si besoin', 'Antibiotique', 'Antalgiques et antipyrétiques'],
        ['Auscultation, saturation, fréquence respiratoire', 'Radiographie pulmonaire', 'Antibiothérapie adaptée', 'Hydratation, antipyrétique', 'Évaluation de la gravité (confusion, tension, fréquence respiratoire)'],
        ['Saturation et température', 'Aggravation de l\'essoufflement ou confusion : hospitalisation'], 'toux fièvre crachats pneumonie bronchite poitrine encombrée'),
    detresse_respiratoire: p(
        ['Oxygène haut débit', 'Ballon et masque, aspiration', 'Matériel d\'intubation', 'Bronchodilatateur', 'Voie veineuse', 'Oxymètre, monitorage'],
        ['Position assise, libération des voies aériennes', 'Oxygène haut débit', 'Traitement de la cause (bronchospasme, œdème, corps étranger)', 'Aide ventilatoire ou intubation si épuisement'],
        ['Saturation, fréquence respiratoire et conscience en continu', 'Cyanose, tirage, pauses respiratoires : urgence vitale'], 'étouffe ne peut plus respirer détresse respiratoire bleu tirage'),
    noyade: p(
        ['Oxygène, ballon et masque', 'Défibrillateur', 'Couvertures chauffantes', 'Aspiration', 'Voie veineuse', 'Radiographie pulmonaire'],
        ['Sortie de l\'eau en position horizontale', 'Ventilation d\'emblée (5 insufflations initiales), massage si absence de pouls', 'Oxygène, réchauffement progressif', 'Pas de manœuvre pour « vider l\'eau »', 'Hospitalisation, même si le patient paraît bien'],
        ['Surveillance minimale de 6 à 24 h (détresse respiratoire retardée)', 'Température, saturation'], 'noyé noyade eau inhalé piscine mer'),

    // ── Neurologie ──
    convulsions: p(
        ['Benzodiazépine injectable ou rectale', 'Glucomètre', 'Oxygène, aspiration', 'Voie veineuse', 'Coussin de protection'],
        ['Protection du patient (écarter les objets, tête protégée), ne rien mettre dans la bouche', 'Position latérale de sécurité après la crise', 'Glycémie capillaire', 'Benzodiazépine si crise > 5 minutes ou répétée', 'Recherche de la cause (traumatisme, fièvre, glycémie, toxique)'],
        ['Conscience et respiration après la crise', 'Crise prolongée ou répétée : état de mal convulsif'], 'crise épilepsie convulsions tremblements secousses mousse'),
    avc: p(
        ['Scanner cérébral (ou IRM)', 'Échelle de déficit (FAST / NIHSS)', 'Glucomètre', 'Voie veineuse, ECG', 'Bilan sanguin et coagulation', 'Monitorage'],
        ['Mesure de l\'heure de début des symptômes (capital)', 'Test FAST : visage, bras, parole', 'Glycémie capillaire pour éliminer une hypoglycémie', 'Scanner cérébral sans délai', 'Filière AVC : thrombolyse / thrombectomie selon l\'heure'],
        ['Déficit neurologique et conscience toutes les 15 min', 'Tension : ne pas l\'abaisser brutalement'], 'visage paralysé bras faible parole difficile bouche de travers AVC'),
    migraine: p(
        ['Antalgiques, antiémétique', 'Chambre au calme et sombre', 'Glucomètre, tensiomètre'],
        ['Repos au calme, à l\'obscurité', 'Antalgique et antiémétique', 'Recherche de signes d\'alerte : début brutal, fièvre, raideur de nuque, déficit', 'Hydratation'],
        ['Céphalée « en coup de tonnerre », fièvre avec nuque raide ou déficit : scanner en urgence'], 'mal de tête céphalée migraine nausée lumière'),
    coma: p(
        ['Glucomètre', 'Oxygène, aspiration, canule', 'Matériel d\'intubation', 'Voie veineuse, ECG', 'Antidotes (naloxone, glucose)', 'Scanner'],
        ['Libération des voies aériennes, position latérale de sécurité', 'Glycémie capillaire, saturation, pupilles', 'Glasgow', 'Antidotes d\'épreuve selon le tableau (naloxone, glucose)', 'Recherche d\'un traumatisme, d\'un toxique, d\'une infection'],
        ['Glasgow et pupilles toutes les 15 min', 'Aggravation de la conscience : intubation'], 'inconscient ne répond plus coma somnolent confus'),

    // ── Intoxications ──
    surdose_opioides: p(
        ['Naloxone (ampoules / spray)', 'Ballon et masque, oxygène', 'Voie veineuse', 'Monitorage', 'Glucomètre'],
        ['Ventilation au ballon si respiration insuffisante', 'Naloxone par paliers jusqu\'à une respiration efficace', 'Oxygène, surveillance de la conscience', 'Recherche d\'un traumatisme ou d\'une autre substance'],
        ['Surveillance prolongée : la naloxone dure moins longtemps que l\'opioïde (rechute)', 'Fréquence respiratoire en continu'], 'overdose opioïde héroïne fentanyl respire lentement pupilles minuscules'),
    surdose_benzo: p(
        ['Oxygène, ballon et masque', 'Monitorage', 'Voie veineuse', 'Charbon actif selon le délai', 'Glucomètre'],
        ['Surveillance de la respiration et de la conscience', 'Oxygène, position latérale de sécurité', 'Flumazénil réservé aux cas précis (risque de convulsions)', 'Recherche d\'une association (alcool, autres toxiques)'],
        ['Fréquence respiratoire et Glasgow en continu', 'Prise volontaire : évaluation psychiatrique'], 'somnolent sédatifs somnifères benzodiazépines trop pris'),
    surdose_stimulants: p(
        ['Monitorage, ECG', 'Benzodiazépine', 'Voie veineuse, solutés', 'Thermomètre', 'Glucomètre'],
        ['Environnement calme, réduction des stimulations', 'Benzodiazépine pour l\'agitation et la tachycardie', 'Refroidissement si hyperthermie', 'ECG et recherche d\'ischémie'],
        ['Température, fréquence et tension en continu', 'Douleur thoracique, convulsions, hyperthermie : réanimation'], 'cocaïne amphétamine ecstasy agité tachycardie transpire stimulant'),
    intox_alcool: p(
        ['Glucomètre, éthylomètre', 'Voie veineuse, solutés (glucose, vitamine B1)', 'Oxygène', 'Couverture', 'Bassine'],
        ['Position latérale de sécurité', 'Glycémie capillaire', 'Recherche de traumatisme crânien', 'Hydratation et vitamine B1', 'Surveillance jusqu\'à dégrisement'],
        ['Glasgow et respiration', 'Vomissements, somnolence profonde : risque d\'inhalation'], 'ivre alcool saoul éthylique vomit'),
    intox_paracetamol: p(
        ['Voie veineuse', 'Bilan sanguin (paracétamolémie, foie)', 'Antidote (N-acétylcystéine)', 'Charbon actif selon le délai'],
        ['Heure de prise et dose estimée à préciser', 'Dosage du paracétamol à H4', 'Antidote (N-acétylcystéine) selon le nomogramme', 'Évaluation psychiatrique si prise volontaire'],
        ['Surveillance hépatique sur 24 à 72 h', 'Nausées tardives, douleur à droite : atteinte du foie'], 'paracétamol doliprane trop pris comprimés intoxication médicament'),
    intox_fumees: p(
        ['Oxygène 100 % au masque haute concentration', 'Oxymètre (attention : faussé par le CO)', 'ECG, bilan sanguin (carboxyhémoglobine)', 'Chambre hyperbare si disponible'],
        ['Sortie de la zone, aération', 'Oxygène à 100 % sans attendre', 'Recherche de brûlures des voies aériennes (suie, voix rauque)', 'ECG et dosage du monoxyde de carbone'],
        ['Maux de tête, vertiges, confusion : signes de CO', 'Stridor, voix éraillée : risque d\'œdème des voies aériennes, intubation précoce'], 'fumées incendie monoxyde de carbone CO suie intoxication gaz'),
    agitation: p(
        ['Pièce calme et sécurisée', 'Benzodiazépine', 'Glucomètre', 'Matériel de contention (dernier recours)', 'Monitorage'],
        ['Approche calme, désescalade verbale', 'Recherche d\'une cause organique (glycémie, hypoxie, toxique, traumatisme)', 'Sédation médicamenteuse si danger', 'Contention de courte durée seulement si nécessaire'],
        ['Surveillance rapprochée de la conscience et de la respiration après sédation', 'Sécurité du soignant'], 'agité violent hurle crise de nerfs délire agressif'),

    // ── Métabolique et divers ──
    hypoglycemie: p(
        ['Glucomètre', 'Sucre (resucrage per os) ou glucose à 30 %', 'Glucagon', 'Voie veineuse'],
        ['Glycémie capillaire', 'Resucrage par voie orale si conscient (15 g de sucre)', 'Glucose intraveineux ou glucagon si inconscient', 'Nouvelle glycémie à 15 minutes, puis repas'],
        ['Glycémie toutes les 15 min jusqu\'à stabilité', 'Cause : insuline, alcool, jeûne, sulfamides'], 'hypoglycémie sueurs tremblements faim diabète insuline malaise sucre'),
    acidocetose: p(
        ['Glucomètre, bandelettes urinaires (cétones)', 'Voie veineuse, solutés', 'Insuline', 'Potassium, ionogramme', 'ECG, monitorage'],
        ['Glycémie et cétonémie', 'Réhydratation intraveineuse prudente', 'Insuline intraveineuse après contrôle de la kaliémie', 'Recherche du facteur déclenchant (infection, oubli d\'insuline)'],
        ['Glycémie horaire, kaliémie', 'Respiration profonde et haleine d\'acétone : acidose'], 'diabète glycémie élevée soif urines nombreuses haleine acétone'),
    deshydratation: p(
        ['Soluté de réhydratation orale', 'Perfusion de sérum', 'Antiémétique', 'Bilan sanguin', 'Thermomètre, balance'],
        ['Évaluation de l\'hydratation (pli cutané, tension, diurèse)', 'Réhydratation orale par petites quantités, ou intraveineuse', 'Antiémétique', 'Consignes de reprise alimentaire progressive'],
        ['Diurèse et poids (surtout chez l\'enfant)', 'Sang dans les selles, fièvre élevée, vomissements incoercibles : réévaluation'], 'diarrhée vomissements gastro déshydraté ventre qui coule nausées'),
    sepsis: p(
        ['Thermomètre, monitorage', 'Deux voies veineuses, solutés', 'Hémocultures et bilan sanguin (lactates)', 'Antibiotique à large spectre', 'Oxygène', 'Sonde urinaire'],
        ['Prélèvements (hémocultures) puis antibiotique dans l\'heure', 'Remplissage vasculaire', 'Recherche du foyer (poumon, urine, peau, abdomen)', 'Mesure de la tension et du lactate'],
        ['Tension, saturation, diurèse horaires', 'Hypotension, marbrures, confusion : choc septique, réanimation'], 'fièvre frissons infection fièvre élevée confus sepsis'),
    douleur_abdominale: p(
        ['Antalgiques, antispasmodique', 'Échographe, bilan sanguin', 'Voie veineuse', 'Bandelette urinaire (test de grossesse)', 'Scanner'],
        ['Localisation de la douleur, recherche de défense ou de contracture', 'Bilan biologique et bandelette urinaire (test de grossesse chez la femme)', 'Échographie, scanner si doute', 'Antalgie sans retarder le diagnostic', 'À jeun'],
        ['Défense, fièvre, vomissements persistants : avis chirurgical', 'Réévaluation clinique répétée'], 'mal au ventre douleur abdominale appendicite vomissements ventre dur'),
    colique_nephretique: p(
        ['Anti-inflammatoire et antalgiques', 'Bandelette urinaire', 'Échographie / scanner', 'Voie veineuse', 'Passoire à urine'],
        ['Antalgie rapide', 'Bandelette urinaire et bilan (créatinine)', 'Imagerie (scanner ou échographie)', 'Recherche d\'une fièvre : urgence urologique (obstacle infecté)'],
        ['Fièvre ou douleur résistante : drainage en urgence', 'Hydratation modérée, tamisage des urines'], 'douleur flanc dos lombaire calcul rein urines sang colique'),
    hypothermie: p(
        ['Couvertures chauffantes, couverture de survie', 'Solutés réchauffés', 'Thermomètre basse température', 'Monitorage ECG', 'Défibrillateur'],
        ['Retrait des vêtements mouillés, isolement du sol', 'Réchauffement externe passif puis actif', 'Manipulation douce (risque de fibrillation)', 'Solutés intraveineux tièdes'],
        ['Température centrale et rythme cardiaque en continu', 'Pas de réanimation abandonnée tant que le patient n\'est pas réchauffé'], 'froid hypothermie gelé grelotte température basse'),
    coup_chaleur: p(
        ['Eau froide, ventilateur, packs de glace', 'Thermomètre', 'Voie veineuse, solutés', 'Glucomètre', 'Monitorage'],
        ['Mise à l\'ombre, retrait des vêtements', 'Refroidissement actif (aspersion, ventilation, glace aux plis)', 'Réhydratation intraveineuse', 'Recherche d\'une cause associée'],
        ['Température toutes les 5 min jusqu\'à 38,5 °C', 'Confusion, convulsions, température > 40 °C : urgence vitale'], 'chaleur insolation coup de chaleur fièvre soleil confus température élevée'),
};

const ROUTINE_LABELS = {
    Tetanus: 'Mise à jour de la vaccination antitétanique', Dressing: 'Pansement', Analgesia: 'Antalgie', Immobilisation: 'Immobilisation', Antibiotic: 'Antibiothérapie',
    Infusion: 'Perfusion / remplissage', Oxygen: 'Oxygénothérapie',
};
const IMAGING_LABELS = { XRay: 'Radiographie', CTScan: 'Scanner', MRI: 'IRM', Ultrasound: 'Échographie', Other: 'Autre examen' };
const DESTINATION_LABELS = { Home: 'Retour à domicile avec consignes', Ward: 'Hospitalisation en service', OperatingRoom: 'Bloc opératoire', Icu: 'Réanimation / soins intensifs' };
const SEX_LABELS = { Male: 'Homme', Female: 'Femme' };

// ───────────── Retrouver les motifs d'après des symptômes écrits ─────────────
const normalize = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['avec', 'dans', 'pour', 'depuis', 'sans', 'tres', 'plus', 'cette', 'chez', 'mais', 'elle', 'ils', 'une', 'des', 'les', 'qui', 'que', 'sur', 'par', 'aux', 'son', 'ses', 'est', 'pas', 'fait', 'avoir', 'patient', 'patiente', 'douleur']);
const SEARCH_INDEX = CONDITIONS.map((condition) => {
    const strong = normalize([condition.label, ...(condition.aliases || []), PROTOCOLS[condition.id]?.symptoms].join(' '));
    const weak = normalize([condition.complaint, condition.diagnosis, condition.mechanism].join(' '));
    return { id: condition.id, strong: ` ${strong} `, weak: ` ${weak} ` };
});
const stemOf = (token) => (token.length > 7 ? token.slice(0, token.length - 2) : token.length > 5 ? token.slice(0, token.length - 1) : token);

/** Motifs probables d'après un texte libre : [{ id, label, score }] du plus probable au moins probable (vide si rien ne correspond). */
export const matchConditions = (text, limit = 6) => {
    const raw = normalize(text);
    const tokens = [...new Set(raw.split(' ').filter((token) => token.length >= 4 && !STOP.has(token)))];
    // Expressions entières (« mal de tête », « douleur thoracique ») : un point de plus quand elles figurent dans les mots-clés.
    const phrases = raw.split(' ').length > 1 ? [raw] : [];
    if (!tokens.length) return [];
    return SEARCH_INDEX.map((entry) => {
        let score = 0;
        tokens.forEach((token) => {
            const stem = stemOf(token);
            if (entry.strong.includes(` ${stem}`) || entry.strong.includes(stem)) score += 3;
            else if (entry.weak.includes(stem)) score += 1;
        });
        phrases.forEach((phrase) => { if (entry.strong.includes(phrase)) score += 4; });
        return { id: entry.id, label: CONDITION_BY_ID[entry.id].label, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'fr')).slice(0, limit);
};

// ───────────── Le cas complet ─────────────
const age = (patient) => (Number.isFinite(patient.ageYears) ? patient.ageYears : null);

/** Adaptations selon le patient : enfant, nourrisson, personne âgée, poids estimé, genre. */
export const patientAdaptations = (patient) => {
    const notes = [];
    const years = age(patient);
    if (years !== null && years < 1) notes.push('Nourrisson : matériel de taille nourrisson (masque, canule, brassard), doses strictement au poids, hypoglycémie et hypothermie rapides, appel du pédiatre.');
    else if (isPediatric(patient)) notes.push('Enfant de moins de 15 ans : matériel pédiatrique (masque, canule, brassard, aiguilles), doses calculées au poids, constantes selon l\'âge, présence rassurante d\'un parent.');
    if (years !== null && years >= 75) notes.push('Patient âgé : risque de confusion, de chute et d\'insuffisance rénale ; doses prudentes, vérifier les traitements habituels (anticoagulants notamment).');
    if (patient.sex === 'Female' && years !== null && years >= 12 && years <= 50) notes.push('Femme en âge de procréer : penser à la grossesse (test) avant imagerie, antalgiques et médicaments à risque.');
    if (patient.weightKg === null || patient.weightKg === undefined) notes.push('Poids non renseigné : doses calculées sur un poids estimé d\'après l\'âge, à confirmer.');
    return notes;
};

/**
 * Prise en charge complète d'un cas.
 * input : { ageYears, sex, weightKg, heightCm, allergies, chronic, currentMeds, severity, conditionIds, seed }
 * → null si aucun motif ; sinon { patient, severity, conditions: [{ id, label, steps, equipment, gestures, monitoring }], vitals, meds: [{ text, forLabel, level, alerts }], skipped, prescription, exams,
 *   imaging, routineCare, destination, advice, notices, adaptations, bmi }
 */
export const buildCase = (input = {}) => {
    const ids = (input.conditionIds || []).filter((id) => CONDITION_BY_ID[id]);
    if (!ids.length) return null;
    const patient = patientFromForm({
        patientAgeYears: input.ageYears, patientSex: input.sex, patientWeight: input.weightKg, patientHeight: input.heightCm,
        patientAllergies: input.allergies, patientChronicDiseases: input.chronic, patientCurrentMedicine: input.currentMeds,
    });
    const suggestions = buildSuggestions({ conditionIds: ids, severity: input.severity || 'Moderate', patient, seed: input.seed || 'pilou', formData: {} });
    if (!suggestions) return null;
    const checkCtx = { patient, vitals: vitalsFromForm(vitalsFormFields(suggestions.vitals.values)), tags: new Set(suggestions.conditions.flatMap((c) => c.tags || [])) };
    const labelOf = (id) => CONDITION_BY_ID[id]?.label || '';
    const medLine = (entry, text) => {
        const result = checkPrescription(entry, checkCtx);
        return { medId: entry.medId, name: MEDICATION_BY_ID[entry.medId]?.name || entry.medId, text, forLabel: labelOf(entry.forCondition), level: result.level, alerts: result.messages.filter((m) => m.level !== 'ok').map((m) => m.text) };
    };
    const bmi = patient.weightKg && patient.heightCm ? Number((patient.weightKg / ((patient.heightCm / 100) ** 2)).toFixed(1)) : null;
    return {
        patient: { ...patient, bmi },
        severity: suggestions.severity,
        conditions: suggestions.conditions.map((condition) => ({
            id: condition.id, label: condition.label, group: condition.group, steps: condition.steps || [],
            equipment: PROTOCOLS[condition.id]?.equipment || [], gestures: PROTOCOLS[condition.id]?.gestures || [], monitoring: PROTOCOLS[condition.id]?.monitoring || [],
        })),
        vitals: suggestions.vitals.values,
        meds: suggestions.meds.map((entry) => medLine(entry, entryText(entry))),
        prescription: suggestions.prescription.map((entry) => medLine(entry, prescriptionText(entry))),
        skipped: suggestions.skipped.map((item) => ({ name: MEDICATION_BY_ID[item.medId]?.name || item.medId, reasons: item.reasons || [] })),
        exams: [...suggestions.imaging.map((key) => IMAGING_LABELS[key] || key)],
        routineCare: suggestions.routineCare.map((key) => ROUTINE_LABELS[key] || key),
        destination: DESTINATION_LABELS[suggestions.destination] || suggestions.destination,
        destinationKey: suggestions.destination,
        advice: suggestions.text.advice,
        notices: suggestions.notices,
        adaptations: patientAdaptations(patient),
        sexLabel: SEX_LABELS[patient.sex] || '',
        admission: suggestions.admission === 'Yes',
    };
};

const bullet = (items) => items.map((item) => `• ${item}`).join('\n');
/** Texte brut de la prise en charge (à coller dans un message ou un rapport). */
export const caseToText = (caseData) => {
    if (!caseData) return '';
    const p0 = caseData.patient;
    const head = [
        `PILOU — ${caseData.conditions.map((c) => c.label).join(' + ')}`,
        `Patient : ${[p0.ageYears !== null && p0.ageYears !== undefined ? `${p0.ageYears} an${p0.ageYears > 1 ? 's' : ''}` : 'âge non renseigné', caseData.sexLabel, p0.weightKg ? `${formatNumber(p0.weightKg)} kg` : '', p0.heightCm ? `${p0.heightCm} cm` : ''].filter(Boolean).join(', ')} — gravité ${caseData.severity.label.toLowerCase()}`,
        `Constantes attendues : FC ${caseData.vitals.hr}/min, PA ${caseData.vitals.sbp}/${caseData.vitals.dbp}, FR ${caseData.vitals.rr}/min, SpO2 ${caseData.vitals.spo2} %, T° ${String(caseData.vitals.temp).replace('.', ',')} °C, glycémie ${String(caseData.vitals.glu).replace('.', ',')} g/L, Glasgow ${caseData.vitals.gcs}`,
    ].join('\n');
    const blocks = caseData.conditions.map((c) => [
        `${c.label.toUpperCase()}`,
        c.steps.length ? `Étapes :\n${c.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}` : '',
        c.equipment.length ? `Matériel :\n${bullet(c.equipment)}` : '',
        c.gestures.length ? `Gestes :\n${bullet(c.gestures)}` : '',
        c.monitoring.length ? `Surveillance :\n${bullet(c.monitoring)}` : '',
    ].filter(Boolean).join('\n'));
    const meds = caseData.meds.length ? `MÉDICAMENTS\n${bullet(caseData.meds.map((m) => `${m.text}${m.alerts.length ? ` [${m.alerts.join(' ; ')}]` : ''}`))}` : '';
    const rx = caseData.prescription.length ? `ORDONNANCE DE SORTIE\n${bullet(caseData.prescription.map((m) => m.text))}` : '';
    const exams = caseData.exams.length ? `EXAMENS : ${caseData.exams.join(', ')}` : '';
    const end = [`ORIENTATION : ${caseData.destination}`, caseData.advice ? `Conseils : ${caseData.advice}` : '', caseData.adaptations.length ? `À noter :\n${bullet(caseData.adaptations)}` : '',
        'Aide à la décision pour le jeu de rôle : le soignant reste responsable de ses choix.'].filter(Boolean).join('\n');
    return [head, ...blocks, meds, rx, exams, end].filter(Boolean).join('\n\n');
};
