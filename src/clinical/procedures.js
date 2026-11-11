// src/clinical/procedures.js
//
// Catalogue d'interventions de l'assistant chirurgical (rapport d'opération). Chaque intervention donne ce que le chirurgien renseigne en général :
// indication, nom, anesthésie, durée et pertes types, caractère, plancher ASA, surveillance, déroulé, examens et consignes post-opératoires, médicaments post-opératoires.
//
//  anesthesia   : 'General' | 'Regional' | 'Sedation' | 'Local'
//  block        : en anesthésie locorégionale, 'spinale' (membres inférieurs, bassin, abdomen bas) ou 'bloc' (bloc nerveux d'un membre)
//  urgent       : intervention en urgence (sinon programmée)
//  asaFloor     : classe ASA minimale quelle que soit le terrain (choc, hémorragie…)
//  monitoring   : lieu de surveillance habituel (RecoveryRoom, Icu, Ward, ObservationBox, Home)
//  prophylaxis  : antibioprophylaxie avant l'incision (céfazoline)
//  postOpMeds   : [identifiant médicament, identifiant du schéma] prescrits en suites

const proc = (group, item) => ({ group, aliases: [], urgent: true, asaFloor: 1, prophylaxis: false, block: 'spinale', postOpMeds: [['paracetamol', 'iv']], steps: [], ...item });

const ORTHO = [
    proc('Orthopédie et traumatologie', {
        id: 'osteosynthese_membre', label: 'Ostéosynthèse d\'une fracture de membre', aliases: ['fracture', 'plaque', 'vis', 'os cassé'],
        indication: 'Fracture déplacée ou instable d\'un membre.', name: 'Ostéosynthèse par plaque et vis', anesthesia: 'General', duration: 90, bloodLoss: 250, monitoring: 'RecoveryRoom', prophylaxis: true,
        steps: ['Installation sur table orthopédique, badigeonnage et champs stériles.', 'Abord du foyer de fracture, réduction à ciel ouvert.', 'Fixation par plaque et vis, contrôle scopique de la réduction.', 'Lavage, hémostase, fermeture plan par plan et pansement.'],
        postOpExams: 'Radiographie de contrôle à J1, vérification des pouls et de la sensibilité en aval.', instructions: 'Décharge du membre selon prescription, surélévation, surveillance du pansement, rééducation précoce encadrée.',
        postOpMeds: [['paracetamol', 'iv'], ['ketoprofene', 'iv'], ['morphine', 'sc']],
    }),
    proc('Orthopédie et traumatologie', {
        id: 'enclouage_femur', label: 'Enclouage centro-médullaire du fémur', aliases: ['fémur', 'clou', 'cuisse'],
        indication: 'Fracture diaphysaire du fémur.', name: 'Enclouage centro-médullaire verrouillé du fémur', anesthesia: 'General', duration: 120, bloodLoss: 500, monitoring: 'Icu', prophylaxis: true, asaFloor: 2,
        steps: ['Installation sur table à traction, contrôle scopique.', 'Réduction fermée de la fracture et alésage du canal.', 'Mise en place du clou et verrouillage proximal et distal.', 'Fermeture des abords et pansement.'],
        postOpExams: 'Radiographie de contrôle, hémoglobine à H6 et J1.', instructions: 'Mise en charge selon consigne du chirurgien, anticoagulation préventive, rééducation précoce.',
        postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc']],
    }),
    proc('Orthopédie et traumatologie', {
        id: 'fixateur_externe', label: 'Fixateur externe / parage de fracture ouverte', aliases: ['fracture ouverte', 'parage', 'fixateur'],
        indication: 'Fracture ouverte avec souillure des parties molles.', name: 'Parage chirurgical et fixation externe', anesthesia: 'General', duration: 75, bloodLoss: 300, monitoring: 'RecoveryRoom', prophylaxis: true, asaFloor: 2,
        steps: ['Lavage abondant et parage des tissus dévitalisés.', 'Réduction et pose de broches et d\'un fixateur externe.', 'Laissé ouvert ou fermé selon la contamination, pansement stérile.'],
        postOpExams: 'Radiographie de contrôle, reprise chirurgicale programmée à 48 heures.', instructions: 'Soins de broches quotidiens, antibiothérapie prolongée, surveillance de la peau et des pouls.',
        postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc'], ['cefazoline', 'iv']],
    }),
    proc('Orthopédie et traumatologie', {
        id: 'reduction_luxation', label: 'Réduction d\'une luxation sous sédation', aliases: ['épaule', 'luxation', 'réduction'],
        indication: 'Luxation articulaire irréductible aux manœuvres simples.', name: 'Réduction orthopédique sous sédation', anesthesia: 'Sedation', duration: 20, bloodLoss: 0, monitoring: 'ObservationBox',
        steps: ['Monitorage, sédation et relâchement musculaire.', 'Manœuvre de réduction douce, perception du ressaut.', 'Contrôle de la stabilité et des pouls, immobilisation.'],
        postOpExams: 'Radiographie de contrôle après réduction.', instructions: 'Immobilisation selon la consigne, repos, contrôle orthopédique à une semaine.', postOpMeds: [['paracetamol', 'po']],
    }),
    proc('Orthopédie et traumatologie', {
        id: 'reparation_tendon', label: 'Réparation tendineuse ou nerveuse de la main', aliases: ['main', 'tendon', 'doigt', 'nerf'],
        indication: 'Section tendineuse ou nerveuse de la main ou de l\'avant-bras.', name: 'Exploration et suture tendineuse', anesthesia: 'Regional', block: 'bloc', duration: 90, bloodLoss: 30, monitoring: 'ObservationBox', urgent: false, prophylaxis: true,
        steps: ['Garrot pneumatique à la racine du membre.', 'Exploration, parage, repérage des extrémités sectionnées.', 'Suture tendineuse ou nerveuse sous grossissement.', 'Fermeture cutanée, attelle de protection.'],
        postOpExams: 'Contrôle de la vascularisation des doigts.', instructions: 'Attelle 3 à 4 semaines, rééducation de la main, pas de mobilisation active précoce.', postOpMeds: [['paracetamol', 'po']],
    }),
    proc('Orthopédie et traumatologie', {
        id: 'amputation', label: 'Amputation de membre', aliases: ['amputation', 'écrasement', 'membre irrécupérable'],
        indication: 'Membre non viable ou écrasement irréparable.', name: 'Amputation de membre avec régularisation du moignon', anesthesia: 'General', duration: 90, bloodLoss: 400, monitoring: 'Icu', prophylaxis: true, asaFloor: 3,
        steps: ['Garrot, taille des lambeaux cutanés et musculaires.', 'Section osseuse, ligature des vaisseaux, section nerveuse à distance.', 'Régularisation du moignon, drainage, fermeture.'],
        postOpExams: 'Bilan sanguin à H6, surveillance des douleurs fantômes.', instructions: 'Soins du moignon, antalgie renforcée, soutien psychologique, rééducation et appareillage.',
        postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc'], ['cefazoline', 'iv']],
    }),
    proc('Chirurgie des parties molles', {
        id: 'suture_complexe', label: 'Exploration et suture d\'une plaie complexe', aliases: ['plaie', 'suture', 'lacération', 'parage de plaie'],
        indication: 'Plaie profonde ou souillée nécessitant une exploration.', name: 'Exploration, parage et suture de plaie', anesthesia: 'Local', duration: 40, bloodLoss: 30, monitoring: 'Home', prophylaxis: false,
        steps: ['Lavage abondant, anesthésie locale, exploration à la recherche d\'un corps étranger ou d\'une lésion profonde.', 'Parage des berges, hémostase.', 'Suture par plans, pansement.'],
        postOpExams: 'Contrôle de la plaie à 48 heures.', instructions: 'Pansement propre et sec, ablation des fils à 10 à 14 jours, rappel antitétanique à jour.', postOpMeds: [['paracetamol', 'po']],
    }),
    proc('Chirurgie des parties molles', {
        id: 'abces', label: 'Incision et drainage d\'un abcès', aliases: ['abcès', 'furoncle', 'collection'],
        indication: 'Abcès des parties molles collecté.', name: 'Incision, drainage et lavage d\'abcès', anesthesia: 'Local', duration: 20, bloodLoss: 20, monitoring: 'Home', urgent: false,
        steps: ['Désinfection, anesthésie locale en périphérie.', 'Incision large, évacuation du pus, prélèvement.', 'Lavage, méchage ou lame de drainage, pansement.'],
        postOpExams: 'Contrôle clinique à 48 heures.', instructions: 'Pansement quotidien, retrait de la mèche selon consigne, consigner la fièvre.', postOpMeds: [['paracetamol', 'po'], ['amoxicilline_clav', 'po']],
    }),
    proc('Chirurgie des parties molles', {
        id: 'extraction_projectile', label: 'Extraction de projectile et parage', aliases: ['balle', 'projectile', 'plomb', 'corps étranger'],
        indication: 'Projectile de plaie par arme à feu logé dans les tissus.', name: 'Extraction de projectile, parage et hémostase', anesthesia: 'General', duration: 90, bloodLoss: 300, monitoring: 'RecoveryRoom', prophylaxis: true, asaFloor: 2,
        steps: ['Localisation du projectile par imagerie et par scopie.', 'Voie d\'abord sur le trajet, hémostase des vaisseaux touchés.', 'Extraction du projectile et des fragments accessibles, parage du trajet.', 'Lavage, drainage éventuel, fermeture différée si contamination.'],
        postOpExams: 'Hémoglobine à H6, imagerie de contrôle des fragments résiduels.', instructions: 'Antibiothérapie, pansements réguliers, rappel antitétanique, déclaration réglementaire de la plaie par arme à feu.',
        postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc'], ['cefazoline', 'iv']],
    }),
];

const VISCERALE = [
    proc('Chirurgie digestive', {
        id: 'appendicectomie', label: 'Appendicectomie', aliases: ['appendicite', 'appendice'],
        indication: 'Appendicite aiguë.', name: 'Appendicectomie par cœlioscopie', anesthesia: 'General', duration: 45, bloodLoss: 30, monitoring: 'RecoveryRoom', prophylaxis: true,
        steps: ['Cœlioscopie : insufflation et trois trocarts.', 'Exploration de la cavité, repérage de l\'appendice.', 'Section du méso, ligature et section de la base appendiculaire.', 'Extraction dans un sac, lavage, fermeture des orifices.'],
        postOpExams: 'Examen anatomo-pathologique de la pièce, surveillance de la température.', instructions: 'Reprise alimentaire progressive, pas d\'effort violent pendant 2 semaines, consulter si fièvre ou douleur.',
        postOpMeds: [['paracetamol', 'iv'], ['ketoprofene', 'iv'], ['ondansetron', 'iv']],
    }),
    proc('Chirurgie digestive', {
        id: 'cholecystectomie', label: 'Cholécystectomie', aliases: ['vésicule', 'calculs biliaires', 'lithiase biliaire'],
        indication: 'Lithiase vésiculaire symptomatique ou cholécystite.', name: 'Cholécystectomie par cœlioscopie', anesthesia: 'General', duration: 60, bloodLoss: 40, monitoring: 'RecoveryRoom', prophylaxis: true, urgent: false,
        steps: ['Cœlioscopie, repérage du triangle de Calot.', 'Clip et section du canal cystique et de l\'artère cystique.', 'Dissection de la vésicule du lit hépatique, extraction dans un sac.', 'Contrôle de l\'hémostase, fermeture.'],
        postOpExams: 'Bilan hépatique à J1.', instructions: 'Alimentation légère les premiers jours, reprise d\'activité progressive.', postOpMeds: [['paracetamol', 'iv'], ['ondansetron', 'iv']],
    }),
    proc('Chirurgie digestive', {
        id: 'hernie', label: 'Cure de hernie', aliases: ['hernie inguinale', 'éventration'],
        indication: 'Hernie de la paroi abdominale symptomatique ou étranglée.', name: 'Cure de hernie avec renfort prothétique', anesthesia: 'Regional', duration: 45, bloodLoss: 20, monitoring: 'ObservationBox', urgent: false,
        steps: ['Incision, repérage du sac herniaire.', 'Réduction du contenu, résection ou refoulement du sac.', 'Mise en place d\'un renfort prothétique et fermeture.'],
        postOpExams: 'Vérification de la reprise du transit.', instructions: 'Pas de port de charge pendant 4 semaines, reprise de la marche immédiate.', postOpMeds: [['paracetamol', 'po'], ['ibuprofene', 'po']],
    }),
    proc('Chirurgie digestive', {
        id: 'laparotomie', label: 'Laparotomie exploratrice / hémostase abdominale', aliases: ['laparotomie', 'ventre', 'plaie abdominale', 'hémopéritoine'],
        indication: 'Hémopéritoine ou plaie abdominale pénétrante instable.', name: 'Laparotomie exploratrice avec hémostase', anesthesia: 'General', duration: 150, bloodLoss: 800, monitoring: 'Icu', prophylaxis: true, asaFloor: 3,
        steps: ['Laparotomie médiane xypho-pubienne, aspiration du sang.', 'Packing des quatre quadrants et recherche de la source du saignement.', 'Hémostase et réparation des lésions (rate, foie, mésentère, grêle).', 'Lavage, drainage, fermeture ou laparostomie selon l\'état.'],
        postOpExams: 'Hémoglobine, coagulation et lactates répétés, imagerie de contrôle.', instructions: 'À jeun, surveillance en réanimation, reprise chirurgicale possible à 24 à 48 heures.',
        postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc'], ['cefazoline', 'iv']],
    }),
    proc('Chirurgie digestive', {
        id: 'splenectomie', label: 'Splénectomie', aliases: ['rate', 'rupture de rate'],
        indication: 'Rupture splénique avec hémorragie non contrôlée.', name: 'Splénectomie', anesthesia: 'General', duration: 100, bloodLoss: 800, monitoring: 'Icu', prophylaxis: true, asaFloor: 3,
        steps: ['Laparotomie, mobilisation de la rate.', 'Ligature du pédicule splénique et des vaisseaux courts.', 'Exérèse de la rate, hémostase du lit, drainage.', 'Fermeture plan par plan.'],
        postOpExams: 'Numération plaquettaire quotidienne, hémoglobine de contrôle.', instructions: 'Vaccinations contre les germes encapsulés, antibioprophylaxie au long cours, consulter en urgence si fièvre.',
        postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc'], ['cefazoline', 'iv']],
    }),
    proc('Chirurgie digestive', {
        id: 'resection_intestinale', label: 'Résection ou suture intestinale', aliases: ['grêle', 'intestin', 'colon', 'perforation digestive'],
        indication: 'Perforation ou plaie de l\'intestin, occlusion compliquée.', name: 'Résection intestinale avec anastomose ou stomie', anesthesia: 'General', duration: 150, bloodLoss: 300, monitoring: 'Icu', prophylaxis: true, asaFloor: 3,
        steps: ['Laparotomie, évaluation de la viabilité du segment atteint.', 'Résection du segment lésé, exclusion de la contamination.', 'Anastomose ou stomie selon l\'état du patient.', 'Lavage péritonéal abondant, drainage, fermeture.'],
        postOpExams: 'Bilan inflammatoire, surveillance du transit et des drains.', instructions: 'À jeun puis réalimentation progressive, soins de stomie si besoin.',
        postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc'], ['cefazoline', 'iv'], ['metronidazole', 'po']],
    }),
];

const THORAX_NEURO_VASC = [
    proc('Thorax', {
        id: 'drainage_thoracique', label: 'Drainage thoracique', aliases: ['pneumothorax', 'hémothorax', 'drain'],
        indication: 'Pneumothorax ou hémothorax.', name: 'Drainage thoracique', anesthesia: 'Local', duration: 20, bloodLoss: 50, monitoring: 'Ward', asaFloor: 2,
        steps: ['Repérage au 4e–5e espace intercostal, anesthésie locale.', 'Incision, dissection au bord supérieur de la côte, pénétration pleurale.', 'Mise en place du drain, connexion au système d\'aspiration, fixation.'],
        postOpExams: 'Radiographie pulmonaire de contrôle, surveillance du débit du drain.', instructions: 'Drain à surveiller, kinésithérapie respiratoire, ablation selon le débit et la radiographie.', postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc']],
    }),
    proc('Thorax', {
        id: 'thoracotomie', label: 'Thoracotomie d\'hémostase', aliases: ['thoracotomie', 'cœur', 'plaie thoracique', 'ACR traumatique'],
        indication: 'Hémothorax massif ou plaie thoracique avec instabilité.', name: 'Thoracotomie d\'hémostase', anesthesia: 'General', duration: 150, bloodLoss: 1000, monitoring: 'Icu', prophylaxis: true, asaFloor: 4,
        steps: ['Intubation sélective, thoracotomie antéro-latérale.', 'Évacuation de l\'hémothorax, contrôle du saignement (pulmonaire, pariétal, péricardique).', 'Réparation des lésions, drainage thoracique.', 'Fermeture plan par plan.'],
        postOpExams: 'Radiographie pulmonaire, hémoglobine et gazométrie répétées.', instructions: 'Réanimation, ventilation protectrice, kinésithérapie, analgésie péridurale ou multimodale.', postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc'], ['cefazoline', 'iv']],
    }),
    proc('Neurochirurgie', {
        id: 'trepanation', label: 'Évacuation d\'un hématome intracrânien', aliases: ['trépanation', 'hématome extra-dural', 'hématome sous-dural', 'crâne'],
        indication: 'Hématome intracrânien compressif.', name: 'Craniotomie et évacuation de l\'hématome', anesthesia: 'General', duration: 150, bloodLoss: 400, monitoring: 'Icu', prophylaxis: true, asaFloor: 3,
        steps: ['Installation en fixation céphalique, rasage et champs.', 'Volet osseux en regard de l\'hématome.', 'Évacuation de l\'hématome, hémostase de la brèche méningée ou vasculaire.', 'Remise en place du volet, drainage, fermeture.'],
        postOpExams: 'Scanner cérébral de contrôle à H6, surveillance neurologique horaire.', instructions: 'Surveillance en réanimation, tête surélevée, prévention des convulsions, rééducation neurologique.', postOpMeds: [['paracetamol', 'iv']],
    }),
    proc('Chirurgie vasculaire', {
        id: 'controle_vasculaire', label: 'Réparation ou ligature vasculaire', aliases: ['artère', 'vaisseau', 'hémorragie artérielle'],
        indication: 'Plaie artérielle avec hémorragie ou ischémie.', name: 'Réparation vasculaire (suture, pontage ou ligature)', anesthesia: 'General', duration: 120, bloodLoss: 800, monitoring: 'Icu', prophylaxis: true, asaFloor: 3,
        steps: ['Contrôle proximal et distal du vaisseau lésé.', 'Parage des berges et réparation (suture directe ou interposition).', 'Test de perméabilité, contrôle du pouls en aval.', 'Drainage et fermeture.'],
        postOpExams: 'Pouls et température cutanée toutes les heures, écho-doppler de contrôle.', instructions: 'Surveillance de la perfusion du membre, anticoagulation selon prescription.', postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc'], ['cefazoline', 'iv']],
    }),
    proc('Chirurgie vasculaire', {
        id: 'fasciotomie', label: 'Fasciotomie', aliases: ['syndrome des loges', 'loges'],
        indication: 'Syndrome de loges après traumatisme ou ischémie.', name: 'Fasciotomie de décompression', anesthesia: 'General', duration: 60, bloodLoss: 100, monitoring: 'RecoveryRoom', prophylaxis: true, asaFloor: 2,
        steps: ['Incisions cutanées longitudinales en regard des loges.', 'Ouverture large des aponévroses de chaque loge.', 'Hémostase, pansement non fermé.'],
        postOpExams: 'Contrôle de la perfusion et de la créatine kinase, reprise pour fermeture différée.', instructions: 'Pansements quotidiens, hydratation, fermeture ou greffe à distance.', postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc']],
    }),
];

const URO_GYNECO = [
    proc('Obstétrique et gynécologie', {
        id: 'cesarienne', label: 'Césarienne', aliases: ['accouchement', 'naissance', 'grossesse'],
        indication: 'Accouchement par voie haute (souffrance fœtale, dystocie ou présentation anormale).', name: 'Césarienne segmentaire', anesthesia: 'Regional', duration: 45, bloodLoss: 600, monitoring: 'RecoveryRoom', asaFloor: 2, prophylaxis: true,
        steps: ['Rachianesthésie, installation en décubitus avec déviation utérine gauche.', 'Incision de Pfannenstiel, ouverture de l\'utérus.', 'Extraction du nouveau-né, clampage du cordon, délivrance.', 'Hystérorraphie, hémostase, fermeture plan par plan.'],
        postOpExams: 'Surveillance du saignement, de la contraction utérine et de la tension.', instructions: 'Allaitement possible, lever précoce, surveillance de la cicatrice, repos relatif 6 semaines.', postOpMeds: [['paracetamol', 'iv'], ['ketoprofene', 'iv'], ['morphine', 'sc']],
    }),
    proc('Obstétrique et gynécologie', {
        id: 'geu', label: 'Grossesse extra-utérine (cœlioscopie)', aliases: ['GEU', 'salpingectomie', 'grossesse extra-utérine'],
        indication: 'Grossesse extra-utérine rompue ou non rompue.', name: 'Salpingectomie par cœlioscopie', anesthesia: 'General', duration: 60, bloodLoss: 200, monitoring: 'RecoveryRoom', asaFloor: 2, prophylaxis: true,
        steps: ['Cœlioscopie, aspiration de l\'hémopéritoine.', 'Repérage de la trompe, coagulation et section du méso.', 'Extraction de la trompe et lavage pelvien.'],
        postOpExams: 'Dosage des bêta-hCG de contrôle, groupe sanguin et rhésus.', instructions: 'Contraception, information sur les risques de récidive, consultation de contrôle.', postOpMeds: [['paracetamol', 'iv'], ['ketoprofene', 'iv']],
    }),
    proc('Urologie', {
        id: 'torsion_testiculaire', label: 'Torsion testiculaire', aliases: ['testicule', 'orchidopexie'],
        indication: 'Torsion du cordon spermatique.', name: 'Détorsion et orchidopexie bilatérale', anesthesia: 'General', duration: 40, bloodLoss: 10, monitoring: 'ObservationBox', prophylaxis: false,
        steps: ['Incision scrotale, extériorisation du testicule.', 'Détorsion et évaluation de la viabilité après réchauffement.', 'Fixation du testicule, fixation du côté opposé.'],
        postOpExams: 'Écho-doppler de contrôle si doute sur la viabilité.', instructions: 'Repos 1 semaine, suspensoir, pas de sport 3 semaines.', postOpMeds: [['paracetamol', 'po'], ['ibuprofene', 'po']],
    }),
    proc('Urologie', {
        id: 'sonde_jj', label: 'Montée de sonde JJ / urétéroscopie', aliases: ['calcul urinaire', 'colique néphrétique', 'sonde double J'],
        indication: 'Calcul urétéral obstructif ou infecté.', name: 'Urétéroscopie avec pose de sonde double J', anesthesia: 'General', duration: 40, bloodLoss: 20, monitoring: 'ObservationBox', prophylaxis: true, urgent: false,
        steps: ['Cystoscopie, repérage du méat urétéral.', 'Montée du guide, urétéroscopie, fragmentation éventuelle.', 'Pose de la sonde double J, vérification radiologique.'],
        postOpExams: 'Examen cytobactériologique des urines, radiographie de contrôle.', instructions: 'Hématurie modérée possible, hydratation, ablation de la sonde à programmer.', postOpMeds: [['paracetamol', 'po'], ['phloroglucinol', 'po']],
    }),
];

const TETE_PEAU = [
    proc('ORL et maxillo-facial', {
        id: 'fractures_faciales', label: 'Fractures de la face', aliases: ['mandibule', 'orbite', 'pommette', 'nez', 'maxillo-facial'],
        indication: 'Fractures des os de la face avec déplacement.', name: 'Réduction et ostéosynthèse des fractures de la face', anesthesia: 'General', duration: 120, bloodLoss: 200, monitoring: 'RecoveryRoom', prophylaxis: true, asaFloor: 2, urgent: false,
        steps: ['Intubation nasotrachéale, abords endobuccaux et cutanés.', 'Réduction des fragments et contrôle de l\'occlusion dentaire.', 'Fixation par mini-plaques et vis.', 'Fermeture et pansement.'],
        postOpExams: 'Scanner facial de contrôle, vérification de l\'occlusion.', instructions: 'Alimentation mixée 4 semaines, hygiène buccale, pas de mouchage en cas de fracture du nez ou du sinus.', postOpMeds: [['paracetamol', 'iv'], ['ketoprofene', 'iv'], ['amoxicilline_clav', 'po']],
    }),
    proc('ORL et maxillo-facial', {
        id: 'tracheotomie', label: 'Trachéotomie', aliases: ['trachéo', 'voie aérienne chirurgicale', 'cricothyroïdotomie'],
        indication: 'Obstruction ou impossibilité d\'intuber, ventilation prolongée.', name: 'Trachéotomie chirurgicale', anesthesia: 'Local', duration: 30, bloodLoss: 50, monitoring: 'Icu', asaFloor: 3,
        steps: ['Position en extension, repérage du cartilage cricoïde.', 'Incision cutanée, dissection jusqu\'à la trachée.', 'Ouverture trachéale et mise en place de la canule.', 'Fixation, contrôle de la ventilation et de l\'étanchéité.'],
        postOpExams: 'Radiographie pulmonaire, contrôle de la canule.', instructions: 'Soins de canule, aspirations, humidification, sevrage progressif.', postOpMeds: [['paracetamol', 'iv']],
    }),
    proc('Chirurgie plastique et brûlures', {
        id: 'greffe_peau', label: 'Greffe de peau', aliases: ['greffe', 'brûlure profonde', 'lambeau'],
        indication: 'Perte de substance cutanée après brûlure ou traumatisme.', name: 'Excision, greffe de peau mince', anesthesia: 'General', duration: 90, bloodLoss: 250, monitoring: 'RecoveryRoom', prophylaxis: true, urgent: false, asaFloor: 2,
        steps: ['Excision tangentielle des tissus brûlés ou nécrosés jusqu\'au tissu sain saignant.', 'Prélèvement du greffon au dermatome.', 'Mise en place du greffon, fixation et pansement.'],
        postOpExams: 'Contrôle de la prise de greffe à J5.', instructions: 'Immobilisation de la zone greffée, pansement gras, crème solaire et massages à distance.', postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc']],
    }),
    proc('Chirurgie plastique et brûlures', {
        id: 'debridement_brulure', label: 'Débridement / escarrotomie de brûlure', aliases: ['escarrotomie', 'brûlure circulaire', 'détersion'],
        indication: 'Brûlure profonde ou circulaire compressive.', name: 'Détersion et escarrotomie de décharge', anesthesia: 'General', duration: 60, bloodLoss: 200, monitoring: 'Icu', prophylaxis: true, asaFloor: 3,
        steps: ['Évaluation de la surface et de la profondeur.', 'Incisions de décharge sur l\'escarre circulaire.', 'Détersion des tissus dévitalisés, pansement antiseptique.'],
        postOpExams: 'Bilan hydro-électrolytique, diurèse horaire, contrôle de la perfusion distale.', instructions: 'Réhydratation guidée par la diurèse, pansements quotidiens, nutrition renforcée.', postOpMeds: [['paracetamol', 'iv'], ['morphine', 'sc']],
    }),
];

export const PROCEDURES = [...ORTHO, ...VISCERALE, ...THORAX_NEURO_VASC, ...URO_GYNECO, ...TETE_PEAU];
export const PROCEDURE_BY_ID = Object.fromEntries(PROCEDURES.map((p) => [p.id, p]));
export const PROCEDURE_GROUPS = [...new Set(PROCEDURES.map((p) => p.group))].map((name) => ({ label: name, options: PROCEDURES.filter((p) => p.group === name) }));
