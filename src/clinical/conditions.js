// src/clinical/conditions.js
//
// Motifs de prise en charge de l'assistant clinique (premier lot : urgences). Chaque motif décrit ce que le soignant retrouve en général : écarts de constantes (pour une gravité « modérée », ajustés ensuite par la gravité),
// plainte, diagnostic, constatations, imagerie, procédure, médicaments proposés et orientation.
//
//  vitals        : écarts par rapport aux valeurs de repos { hr, sbp, dbp, rr, spo2, temp, glu, gcs }
//  vitalsOverride: valeurs imposées (ex. arrêt cardiaque)
//  tags          : contexte lu par les contrôles des médicaments (ex. 'hemorragie' interdit un AINS)
//  findings      : valeurs des listes « Constatations » du protocole (esg, lungs, pupils, wounds, ecg, sono)
//  meds          : [identifiant médicament, identifiant du schéma, gravité minimale 0-3 (légère → critique)]
//  admitAt       : gravité (0-3) à partir de laquelle on propose l'admission (null : jamais)
//  surgical      : à partir de « sévère », orientation vers le bloc opératoire

const ALT = 'patientImpared';
const NORMAL = 'patientNormal';
const group = (name, items) => items.map((item) => ({ group: name, followup: 'AsNeeded', admitAt: null, tags: [], aliases: [], imaging: [], routineCare: [], steps: [], meds: [], findings: {}, ...item }));

const TRAUMA = group('Traumatologie', [
    {
        id: 'plaie_superficielle', label: 'Plaie superficielle / coupure', aliases: ['coupure', 'égratignure', 'lacération'],
        vitals: { hr: 6 }, complaint: 'Plaie saignante, douloureuse au toucher.', diagnosis: 'Plaie superficielle des parties molles, sans atteinte profonde.',
        findings: { wounds: 'patientBleeding', esg: NORMAL }, routineCare: ['Tetanus', 'Dressing'],
        steps: ['Lavage au sérum physiologique, détersion et exploration de la plaie.', 'Recherche d\'un corps étranger, d\'une atteinte tendineuse ou nerveuse.', 'Anesthésie locale puis suture, colle ou strips selon la plaie.', 'Pansement et mise à jour de la vaccination antitétanique.'],
        meds: [['lidocaine', 'infiltration', 0], ['paracetamol', 'po', 0], ['vaccin_tetanique', 'im', 0]],
    },
    {
        id: 'plaie_profonde', label: 'Plaie profonde / délabrement', aliases: ['lacération profonde', 'morsure', 'amputation partielle'],
        vitals: { hr: 14, sbp: -4, rr: 2 }, tags: ['hemorragie'], complaint: 'Plaie profonde avec saignement important.', diagnosis: 'Plaie profonde des parties molles avec saignement.',
        findings: { wounds: 'patientBleeding', esg: NORMAL }, imaging: ['XRay'], routineCare: ['Tetanus', 'Dressing', 'Antibiotic'], admitAt: 3, surgical: true,
        steps: ['Compression directe, surélévation, garrot si hémorragie non contrôlée.', 'Exploration chirurgicale sous anesthésie locale, lavage abondant.', 'Radiographie à la recherche d\'un corps étranger ou d\'une fracture.', 'Suture par plans, pansement compressif, antibioprophylaxie et rappel antitétanique.'],
        meds: [['lidocaine', 'infiltration', 0], ['paracetamol', 'po', 0], ['morphine', 'iv', 2], ['cefazoline', 'iv', 1], ['vaccin_tetanique', 'im', 0], ['acide_tranexamique', 'iv', 2]],
    },
    {
        id: 'fracture_fermee', label: 'Fracture fermée d\'un membre', aliases: ['fracture', 'os cassé'],
        vitals: { hr: 12, sbp: 8, dbp: 4, rr: 2 }, complaint: 'Douleur vive, gonflement et impotence fonctionnelle du membre.', mechanism: 'Chute ou choc direct sur le membre.',
        diagnosis: 'Fracture fermée d\'un membre.', findings: { wounds: 'patientFractures', esg: NORMAL }, imaging: ['XRay'], routineCare: ['Analgesia', 'Immobilisation'], admitAt: 3, surgical: true, followup: 'Recommended',
        steps: ['Immobilisation du membre dans la position trouvée, retrait des bagues et bijoux.', 'Contrôle du pouls, de la sensibilité et de la motricité en aval.', 'Antalgie puis radiographie de face et de profil.', 'Réduction ou attelle selon le déplacement, avis orthopédique.'],
        meds: [['paracetamol', 'po', 0], ['ketoprofene', 'po', 0], ['morphine', 'iv', 2]],
    },
    {
        id: 'fracture_ouverte', label: 'Fracture ouverte', aliases: ['fracture exposée', 'os apparent'],
        vitals: { hr: 26, sbp: -10, dbp: -5, rr: 4 }, tags: ['hemorragie'], complaint: 'Douleur intense, os visible à travers la plaie.', mechanism: 'Traumatisme à haute énergie.',
        diagnosis: 'Fracture ouverte d\'un membre.', findings: { wounds: 'patientFractures', esg: ALT }, imaging: ['XRay'], routineCare: ['Analgesia', 'Immobilisation', 'Antibiotic', 'Tetanus', 'Infusion'], admitAt: 0, surgical: true, followup: 'Recommended',
        steps: ['Contrôle de l\'hémorragie, pansement stérile humide, immobilisation.', 'Antalgie puissante et antibiothérapie sans délai.', 'Rappel antitétanique, radiographie, bilan vasculo-nerveux.', 'Lavage et ostéosynthèse au bloc opératoire.'],
        meds: [['morphine', 'iv', 0], ['cefazoline', 'iv', 0], ['vaccin_tetanique', 'im', 0], ['nacl09', 'iv', 2], ['acide_tranexamique', 'iv', 2]],
    },
    {
        id: 'entorse_luxation', label: 'Entorse / luxation', aliases: ['foulure', 'épaule déboîtée', 'cheville'],
        vitals: { hr: 7, sbp: 5 }, complaint: 'Douleur articulaire, gonflement, déformation ou instabilité après un faux mouvement.', mechanism: 'Torsion ou chute sur l\'articulation.',
        diagnosis: 'Entorse ou luxation articulaire.', findings: { wounds: 'patientHematoma', esg: NORMAL }, imaging: ['XRay'], routineCare: ['Analgesia', 'Immobilisation'], followup: 'Recommended',
        steps: ['Glaçage, immobilisation et repos de l\'articulation.', 'Bilan clinique de la stabilité ; radiographie pour éliminer une fracture.', 'Réduction d\'une luxation sous analgésie, puis contrôle radiographique.', 'Attelle ou orthèse, consignes de décharge.'],
        meds: [['paracetamol', 'po', 0], ['ibuprofene', 'po', 0], ['morphine', 'iv', 3]],
    },
    {
        id: 'trauma_cranien', label: 'Traumatisme crânien', aliases: ['coup à la tête', 'commotion', 'tête'],
        vitals: { hr: 4, sbp: 6, rr: 1, gcs: -1 }, tags: ['traumatisme_cranien'], complaint: 'Céphalées, vertiges, éventuelle perte de connaissance après un choc à la tête.', mechanism: 'Choc direct sur la tête.',
        diagnosis: 'Traumatisme crânien.', findings: { pupils: 'patientPupilsNormal', wounds: 'patientHematoma', esg: NORMAL }, imaging: ['CTScan'], routineCare: [], admitAt: 1, followup: 'Recommended',
        steps: ['Score de Glasgow et examen des pupilles, à répéter toutes les 15 minutes.', 'Immobilisation du rachis cervical en cas de mécanisme à risque.', 'Scanner cérébral si perte de connaissance, vomissements, anticoagulants ou Glasgow < 15.', 'Surveillance neurologique ; consignes écrites de retour en cas de somnolence ou de vomissements.'],
        meds: [['paracetamol', 'po', 0], ['ondansetron', 'po', 1]],
    },
    {
        id: 'brulure', label: 'Brûlure', aliases: ['brûlure thermique', 'feu', 'ébouillantement'],
        vitals: { hr: 18, sbp: -4, rr: 3 }, complaint: 'Douleur intense et cloques sur la zone brûlée.', mechanism: 'Contact avec une flamme, un liquide chaud ou une surface brûlante.',
        diagnosis: 'Brûlure cutanée.', findings: { wounds: 'patientNoWounds', esg: NORMAL }, routineCare: ['Analgesia', 'Dressing', 'Tetanus'], admitAt: 2, followup: 'Recommended',
        steps: ['Refroidissement à l\'eau tempérée pendant 15 à 20 minutes, retrait des vêtements et bijoux.', 'Évaluation de la surface brûlée et de la profondeur.', 'Pansement gras stérile, jamais de corps gras non stérile.', 'Perfusion de remplissage et surveillance en centre de brûlés au-delà de 15 % de surface.'],
        meds: [['paracetamol', 'po', 0], ['morphine', 'iv', 2], ['nacl09', 'iv', 2], ['vaccin_tetanique', 'im', 0], ['oxygene', 'masque', 2]],
    },
    {
        id: 'plaie_arme_feu', label: 'Plaie par arme à feu', aliases: ['balle', 'tir', 'projectile', 'gunshot'],
        vitals: { hr: 30, sbp: -26, dbp: -15, rr: 6, spo2: -2 }, tags: ['hemorragie', 'choc'], complaint: 'Douleur intense et saignement après un tir.', mechanism: 'Projectile d\'arme à feu.',
        diagnosis: 'Plaie par projectile d\'arme à feu.', findings: { wounds: 'patientBleeding', esg: ALT }, imaging: ['XRay', 'CTScan'], routineCare: ['Analgesia', 'Infusion', 'Oxygen', 'Antibiotic', 'Tetanus'], admitAt: 0, surgical: true, admitTo: 'Ward', followup: 'Recommended',
        steps: ['Sécurisation, déshabillage complet et recherche des orifices d\'entrée et de sortie.', 'Contrôle de l\'hémorragie : compression, pansement hémostatique, garrot sur un membre.', 'Deux voies veineuses, acide tranexamique, remplissage prudent, oxygène.', 'Radiographie ou scanner pour localiser le projectile, bilan préopératoire.', 'Exploration chirurgicale, antibioprophylaxie, rappel antitétanique.'],
        meds: [['oxygene', 'masque', 0], ['acide_tranexamique', 'iv', 0], ['nacl09', 'iv', 1], ['fentanyl', 'iv', 0], ['cefazoline', 'iv', 0], ['vaccin_tetanique', 'im', 0]],
    },
    {
        id: 'plaie_arme_blanche', label: 'Plaie par arme blanche', aliases: ['couteau', 'coup de couteau', 'lame', 'poignardé'],
        vitals: { hr: 20, sbp: -14, dbp: -8, rr: 4, spo2: -1 }, tags: ['hemorragie'], complaint: 'Douleur et saignement après un coup de couteau.', mechanism: 'Plaie par arme blanche.',
        diagnosis: 'Plaie par arme blanche.', findings: { wounds: 'patientBleeding', esg: ALT }, imaging: ['XRay', 'Ultrasound'], routineCare: ['Analgesia', 'Dressing', 'Antibiotic', 'Tetanus'], admitAt: 1, surgical: true, followup: 'Recommended',
        steps: ['Compression directe, ne pas retirer l\'arme si elle est encore en place.', 'Recherche d\'une atteinte thoracique, abdominale ou vasculaire ; échographie de débrouillage.', 'Voie veineuse, antalgie, antibioprophylaxie, rappel antitétanique.', 'Exploration et suture au bloc si la plaie est profonde ou pénétrante.'],
        meds: [['fentanyl', 'iv', 1], ['paracetamol', 'po', 0], ['acide_tranexamique', 'iv', 2], ['nacl09', 'iv', 2], ['cefazoline', 'iv', 1], ['vaccin_tetanique', 'im', 0], ['lidocaine', 'infiltration', 0]],
    },
    {
        id: 'trauma_thoracique', label: 'Traumatisme thoracique / pneumothorax', aliases: ['côtes', 'poumon', 'thorax', 'pneumothorax', 'hémothorax'],
        vitals: { hr: 24, sbp: -10, rr: 10, spo2: -8 }, tags: ['hemorragie'], complaint: 'Douleur thoracique à l\'inspiration, essoufflement.', mechanism: 'Choc ou plaie du thorax.',
        diagnosis: 'Traumatisme thoracique avec atteinte pleuro-pulmonaire.', findings: { lungs: 'patientRhonchi', esg: ALT }, imaging: ['XRay', 'Ultrasound', 'CTScan'], routineCare: ['Oxygen', 'Analgesia'], admitAt: 0, surgical: false, admitTo: 'Ward', followup: 'Recommended',
        steps: ['Oxygène, position demi-assise, exsufflation à l\'aiguille si pneumothorax compressif.', 'Échographie thoracique (eFAST) et radiographie pulmonaire.', 'Drainage thoracique si pneumothorax ou hémothorax important.', 'Antalgie suffisante pour permettre la toux et la ventilation.'],
        meds: [['oxygene', 'masque', 0], ['paracetamol', 'po', 0], ['morphine', 'iv', 1], ['acide_tranexamique', 'iv', 3]],
    },
    {
        id: 'trauma_abdominal', label: 'Traumatisme abdominal', aliases: ['ventre', 'rate', 'foie', 'abdomen'],
        vitals: { hr: 24, sbp: -15, dbp: -8, rr: 5 }, tags: ['hemorragie'], complaint: 'Douleur abdominale intense, ventre tendu.', mechanism: 'Choc violent sur l\'abdomen.',
        diagnosis: 'Traumatisme abdominal avec suspicion d\'hémorragie interne.', findings: { sono: 'patientFluids', esg: ALT }, imaging: ['Ultrasound', 'CTScan'], routineCare: ['Infusion', 'Analgesia'], admitAt: 1, surgical: true, followup: 'Recommended',
        steps: ['Voie veineuse, remplissage prudent, surveillance rapprochée.', 'Échographie (eFAST) à la recherche d\'un épanchement libre.', 'Scanner abdominal si le patient est stable, bloc opératoire si instable.', 'À jeun strict, antalgie, groupage et bilan sanguin.'],
        meds: [['paracetamol', 'iv', 0], ['fentanyl', 'iv', 1], ['nacl09', 'iv', 1], ['acide_tranexamique', 'iv', 2]],
    },
    {
        id: 'polytraumatisme', label: 'Polytraumatisme / état de choc', aliases: ['accident de la route', 'choc hémorragique', 'grave'],
        vitals: { hr: 42, sbp: -38, dbp: -24, rr: 10, spo2: -6, gcs: -2 }, tags: ['hemorragie', 'choc'], complaint: 'Douleurs multiples après un traumatisme à haute cinétique.', mechanism: 'Accident à haute cinétique.',
        diagnosis: 'Polytraumatisme avec état de choc hémorragique.', findings: { esg: ALT, wounds: 'patientBleeding', pupils: 'patientPupilsNormal', sono: 'patientFluids' }, imaging: ['CTScan', 'XRay', 'Ultrasound'], routineCare: ['Oxygen', 'Infusion', 'Analgesia', 'Immobilisation'], admitAt: 0, surgical: true, followup: 'Recommended',
        steps: ['Évaluation méthodique : voies aériennes avec contrôle du rachis cervical, respiration, circulation, conscience, exposition.', 'Oxygène, deux voies veineuses, acide tranexamique, remplissage limité.', 'Contrôle immédiat des hémorragies ; immobilisation sur matelas coquille.', 'Scanner corps entier dès que l\'état le permet, bloc opératoire en urgence si instable.'],
        meds: [['oxygene', 'masque', 0], ['acide_tranexamique', 'iv', 0], ['nacl09', 'iv', 0], ['fentanyl', 'iv', 0], ['ketamine', 'iv_analgesie', 2]],
    },
    {
        id: 'hemorragie_externe', label: 'Hémorragie externe', aliases: ['saignement', 'hémorragie', 'garrot'],
        vitals: { hr: 28, sbp: -20, dbp: -10, rr: 4 }, tags: ['hemorragie'], complaint: 'Saignement abondant.', diagnosis: 'Hémorragie externe.', findings: { wounds: 'patientBleeding', esg: ALT }, routineCare: ['Dressing', 'Infusion'], admitAt: 1, surgical: true, followup: 'Recommended',
        steps: ['Compression directe et prolongée, pansement compressif.', 'Garrot en cas d\'hémorragie de membre non contrôlée, noter l\'heure de pose.', 'Voie veineuse, acide tranexamique, remplissage si hypotension.', 'Bilan sanguin (hémoglobine, coagulation) et groupage.'],
        meds: [['acide_tranexamique', 'iv', 0], ['nacl09', 'iv', 1], ['oxygene', 'masque', 2]],
    },
]);

const CARDIO = group('Cardio-vasculaire', [
    {
        id: 'sca', label: 'Douleur thoracique / syndrome coronarien', aliases: ['infarctus', 'crise cardiaque', 'angine de poitrine'],
        vitals: { hr: 10, sbp: 8, dbp: 4, rr: 3, spo2: -2 }, tags: ['sca'], complaint: 'Douleur thoracique serrante irradiant vers le bras ou la mâchoire, sueurs.', diagnosis: 'Syndrome coronarien aigu à éliminer.',
        findings: { ecg: 'patientInfaction', esg: ALT }, routineCare: ['Oxygen', 'Infusion'], admitAt: 0, surgical: false, followup: 'Recommended',
        steps: ['Repos strict, ECG 12 dérivations en moins de 10 minutes, à répéter.', 'Voie veineuse, aspirine, trinitrine si la tension le permet.', 'Dosage de troponine, radiographie pulmonaire.', 'Transfert en coronarographie en cas de sus-décalage du segment ST.'],
        meds: [['aspirine', 'po', 0], ['nitroglycerine', 'sl', 0], ['morphine', 'iv', 2], ['oxygene', 'masque', 2]],
    },
    {
        id: 'arret_cardiaque', label: 'Arrêt cardio-respiratoire', aliases: ['arrêt cardiaque', 'ACR', 'réanimation', 'RCP'],
        vitalsOverride: { hr: 0, sbp: 0, dbp: 0, rr: 0, spo2: 0, gcs: 3 }, complaint: 'Patient inconscient, sans pouls ni respiration.', diagnosis: 'Arrêt cardio-respiratoire.',
        findings: { esg: ALT, pupils: 'patientPupilsAbnormal', ecg: 'patientArrhythmia' }, routineCare: ['Oxygen', 'Infusion'], admitAt: 0, followup: 'Recommended',
        steps: ['Massage cardiaque externe immédiat (100 à 120/min) et ventilation au ballon.', 'Défibrillateur dès que possible ; choc si rythme choquable.', 'Voie veineuse, adrénaline toutes les 3 à 5 minutes, amiodarone après le 3e choc.', 'Recherche d\'une cause réversible (hypoxie, hypovolémie, pneumothorax, toxiques…).'],
        meds: [['adrenaline', 'iv_acr', 0], ['amiodarone', 'iv_acr', 1], ['oxygene', 'masque', 0]],
    },
    {
        id: 'crise_hypertensive', label: 'Crise hypertensive', aliases: ['tension élevée', 'hypertension'],
        vitals: { hr: 8, sbp: 55, dbp: 30 }, tags: ['crise_hypertensive'], complaint: 'Maux de tête, bourdonnements d\'oreilles, vertiges.', diagnosis: 'Poussée hypertensive.', findings: { esg: NORMAL }, admitAt: 2, followup: 'Recommended',
        steps: ['Repos au calme, mesure de la tension aux deux bras après 10 minutes.', 'Recherche de signes de gravité : douleur thoracique, déficit neurologique, troubles visuels.', 'ECG et bilan sanguin ; ajuster le traitement antihypertenseur habituel.', 'Abaisser la tension progressivement, jamais brutalement.'],
        meds: [],
    },
    {
        id: 'tachyarythmie', label: 'Palpitations / tachycardie', aliases: ['arythmie', 'fibrillation', 'cœur qui s\'emballe'],
        vitals: { hr: 55, sbp: -6, rr: 3 }, complaint: 'Palpitations, cœur qui s\'emballe, gêne thoracique.', diagnosis: 'Tachyarythmie.', findings: { ecg: 'patientArrhythmia', esg: NORMAL }, admitAt: 2, followup: 'Recommended',
        steps: ['ECG 12 dérivations pour caractériser le rythme.', 'Manœuvres vagales si tachycardie régulière à complexes fins.', 'Bilan sanguin (ionogramme, thyroïde), recherche de la cause.', 'Choc électrique externe si instabilité (hypotension, douleur, altération de la conscience).'],
        meds: [],
    },
    {
        id: 'bradycardie', label: 'Bradycardie symptomatique', aliases: ['pouls lent', 'malaise cardiaque'],
        vitals: { hr: -32, sbp: -26, dbp: -12, rr: -1 }, complaint: 'Malaise, vertiges, fatigue brutale.', diagnosis: 'Bradycardie symptomatique.', findings: { ecg: 'patientArrhythmia', esg: ALT }, admitAt: 1, followup: 'Recommended',
        steps: ['ECG 12 dérivations et monitorage continu.', 'Voie veineuse, atropine en cas de mauvaise tolérance.', 'Recherche d\'une cause médicamenteuse, d\'un trouble ionique ou d\'un infarctus.', 'Stimulation externe si l\'atropine est inefficace.'],
        meds: [['atropine', 'iv', 1]],
    },
    {
        id: 'oap', label: 'Œdème aigu du poumon', aliases: ['OAP', 'insuffisance cardiaque aiguë', 'noyade interne'],
        vitals: { hr: 26, sbp: 14, dbp: 6, rr: 14, spo2: -10 }, tags: ['oap'], complaint: 'Essoufflement brutal, impossibilité de s\'allonger, toux avec expectorations mousseuses.', diagnosis: 'Œdème aigu du poumon cardiogénique.',
        findings: { lungs: 'patientCrack', esg: ALT, ecg: 'patientArrhythmia' }, imaging: ['XRay'], routineCare: ['Oxygen', 'Infusion'], admitAt: 0, followup: 'Recommended',
        steps: ['Position assise jambes pendantes, oxygène à haut débit.', 'Voie veineuse, diurétique et dérivés nitrés si la tension le permet.', 'ECG, radiographie pulmonaire, troponine et BNP.', 'Pas de remplissage vasculaire.'],
        meds: [['oxygene', 'masque', 0], ['furosemide', 'iv', 0], ['nitroglycerine', 'sl', 1]],
    },
    {
        id: 'syncope', label: 'Syncope / malaise', aliases: ['évanouissement', 'perte de connaissance', 'malaise vagal'],
        vitals: { hr: -4, sbp: -22, dbp: -10, spo2: -1 }, complaint: 'Perte de connaissance brève avec chute, étourdissement avant le malaise.', diagnosis: 'Syncope, étiologie à préciser.',
        findings: { esg: NORMAL, ecg: 'patientSinusRhythm' }, routineCare: ['Infusion'], admitAt: 2, followup: 'Recommended',
        steps: ['Allongement jambes surélevées, recherche d\'un traumatisme associé à la chute.', 'ECG 12 dérivations, glycémie capillaire, tension couchée puis debout.', 'Recherche d\'une cause cardiaque, d\'une déshydratation ou d\'un saignement.', 'Surveillance au monitoring si cardiopathie connue ou ECG anormal.'],
        meds: [['nacl09', 'iv', 1]],
    },
    {
        id: 'anaphylaxie', label: 'Choc anaphylactique', aliases: ['allergie grave', 'œdème de Quincke', 'piqûre', 'réaction allergique sévère'],
        vitals: { hr: 40, sbp: -35, dbp: -22, rr: 8, spo2: -8 }, tags: ['choc', 'anaphylaxie'], airway: true, complaint: 'Gêne respiratoire, gonflement du visage, urticaire généralisé après un contact allergène.', diagnosis: 'Choc anaphylactique.',
        findings: { lungs: 'patientRhonchi', esg: ALT }, routineCare: ['Oxygen', 'Infusion'], admitAt: 0, followup: 'Recommended',
        steps: ['Adrénaline intramusculaire immédiate, à renouveler si besoin.', 'Allonger jambes surélevées, oxygène à haut débit, voie veineuse.', 'Remplissage par sérum physiologique, corticoïde et antihistaminique en relais.', 'Surveillance d\'au moins 6 heures, trousse d\'adrénaline et consignes à la sortie.'],
        meds: [['adrenaline', 'im_anaphylaxie', 0], ['oxygene', 'masque', 0], ['nacl09', 'iv', 1], ['methylprednisolone', 'iv', 1], ['cetirizine', 'po', 1]],
    },
    {
        id: 'allergie_legere', label: 'Réaction allergique légère', aliases: ['urticaire', 'démangeaisons', 'rash'],
        vitals: { hr: 8, sbp: 2 }, complaint: 'Démangeaisons et plaques rouges sur la peau.', diagnosis: 'Réaction allergique cutanée sans signe de gravité.', findings: { esg: NORMAL }, admitAt: null, followup: 'AsNeeded',
        steps: ['Identifier et écarter l\'allergène.', 'Vérifier l\'absence de gêne respiratoire, de gonflement du visage ou de malaise.', 'Surveillance de 30 minutes à 1 heure.', 'Consignes de retour si la réaction s\'aggrave.'],
        meds: [['cetirizine', 'po', 0], ['prednisolone', 'po', 1]],
    },
]);

const RESPI = group('Respiratoire', [
    {
        id: 'asthme', label: 'Crise d\'asthme', aliases: ['bronchospasme', 'sifflements', 'asthmatique'],
        vitals: { hr: 24, sbp: 5, rr: 10, spo2: -7 }, tags: ['asthme'], complaint: 'Essoufflement, sifflements, oppression thoracique.', diagnosis: 'Crise d\'asthme.',
        findings: { lungs: 'patientRhonchi', esg: ALT }, routineCare: ['Oxygen'], admitAt: 2, followup: 'Recommended',
        steps: ['Position assise, oxygène pour une SpO2 ≥ 94 %.', 'Bronchodilatateurs en nébulisation, renouvelables toutes les 20 minutes.', 'Corticoïde par voie orale ou veineuse.', 'Débit expiratoire de pointe avant et après le traitement ; hospitalisation si la réponse est insuffisante.'],
        meds: [['salbutamol', 'neb', 0], ['ipratropium', 'neb', 2], ['prednisolone', 'po', 0], ['methylprednisolone', 'iv', 2], ['oxygene', 'masque', 1]],
    },
    {
        id: 'pneumopathie', label: 'Infection respiratoire / pneumonie', aliases: ['pneumonie', 'bronchite', 'toux', 'grippe'],
        vitals: { temp: 1.5, hr: 18, rr: 7, spo2: -5 }, complaint: 'Fièvre, toux productive, essoufflement et douleur thoracique.', diagnosis: 'Pneumopathie infectieuse.',
        findings: { lungs: 'patientCrack', esg: ALT }, imaging: ['XRay'], routineCare: ['Antibiotic'], admitAt: 2, followup: 'Recommended',
        steps: ['Mesure de la SpO2 et de la fréquence respiratoire, oxygène si nécessaire.', 'Radiographie pulmonaire et bilan sanguin inflammatoire.', 'Antibiothérapie adaptée au terrain et à la gravité.', 'Antipyrétique, hydratation et consignes de retour.'],
        meds: [['paracetamol', 'po', 0], ['amoxicilline_clav', 'po', 0], ['azithromycine', 'po', 0], ['oxygene', 'masque', 2], ['ceftriaxone', 'iv', 2]],
    },
    {
        id: 'detresse_respiratoire', label: 'Détresse respiratoire', aliases: ['étouffement', 'suffocation', 'obstruction', 'asphyxie'],
        vitals: { hr: 30, sbp: 6, rr: 14, spo2: -12, gcs: -1 }, airway: true, complaint: 'Difficulté majeure à respirer, sensation d\'étouffement.', diagnosis: 'Détresse respiratoire aiguë.',
        findings: { lungs: 'patientRhonchi', esg: ALT }, imaging: ['XRay'], routineCare: ['Oxygen'], admitAt: 0, followup: 'Recommended',
        steps: ['Libération des voies aériennes, recherche d\'un corps étranger.', 'Oxygène à haut débit, position adaptée, monitorage continu.', 'Recherche de la cause : asthme, œdème pulmonaire, pneumothorax, allergie, embolie.', 'Intubation en cas d\'épuisement ou d\'altération de la conscience.'],
        meds: [['oxygene', 'masque', 0], ['salbutamol', 'neb', 1]],
    },
    {
        id: 'noyade', label: 'Noyade', aliases: ['submersion', 'eau', 'presque noyé'],
        vitals: { hr: 22, sbp: -8, rr: 10, spo2: -12, temp: -2.2, gcs: -2 }, complaint: 'Toux, essoufflement et frissons après une submersion.', mechanism: 'Submersion prolongée.',
        diagnosis: 'Noyade avec atteinte respiratoire et hypothermie.', findings: { lungs: 'patientCrack', esg: ALT }, imaging: ['XRay'], routineCare: ['Oxygen'], admitAt: 0, followup: 'Recommended',
        steps: ['Ventilation d\'abord (cinq insufflations), puis massage cardiaque si besoin.', 'Déshabillage, séchage, réchauffement progressif.', 'Oxygène, radiographie pulmonaire, surveillance de 24 heures même si le patient paraît bien.', 'Recherche d\'un traumatisme du rachis en cas de plongeon.'],
        meds: [['oxygene', 'masque', 0], ['salbutamol', 'neb', 2]],
    },
]);

const NEURO = group('Neurologie', [
    {
        id: 'convulsions', label: 'Convulsions / crise d\'épilepsie', aliases: ['épilepsie', 'crise tonico-clonique', 'convulsif'],
        vitals: { hr: 34, sbp: 20, rr: 6, spo2: -6, temp: 0.5, gcs: -4 }, tags: ['convulsions'], complaint: 'Crise convulsive généralisée ou mouvements anormaux avec perte de contact.', diagnosis: 'Crise convulsive.',
        findings: { esg: ALT, pupils: 'patientPupilsAbnormal' }, routineCare: ['Oxygen'], admitAt: 1, followup: 'Recommended',
        steps: ['Protéger de la chute, libérer les voies aériennes, position latérale de sécurité après la crise.', 'Oxygène, glycémie capillaire immédiate.', 'Benzodiazépine si la crise dure plus de 5 minutes ou se répète.', 'Recherche de la cause : traumatisme, fièvre, intoxication, hypoglycémie, épilepsie connue.'],
        meds: [['oxygene', 'masque', 0], ['diazepam', 'iv', 1], ['clonazepam', 'iv', 2], ['midazolam', 'im', 1]],
    },
    {
        id: 'avc', label: 'Accident vasculaire cérébral (AVC)', aliases: ['AVC', 'paralysie', 'bouche déviée', 'trouble de la parole'],
        vitals: { hr: 5, sbp: 40, dbp: 20, gcs: -2 }, complaint: 'Faiblesse d\'un côté du corps, bouche déviée, difficulté à parler.', diagnosis: 'Accident vasculaire cérébral.',
        findings: { esg: ALT, pupils: 'patientPupilsNormal' }, imaging: ['CTScan', 'MRI'], routineCare: ['Oxygen', 'Infusion'], admitAt: 0, followup: 'Recommended',
        steps: ['Noter l\'heure de début des symptômes : elle commande le traitement.', 'Score FAST, Glasgow, glycémie capillaire.', 'Scanner cérébral sans injection en urgence, puis imagerie vasculaire.', 'Pas d\'abaissement brutal de la tension ; transfert en unité neuro-vasculaire.'],
        meds: [['oxygene', 'masque', 2]],
    },
    {
        id: 'migraine', label: 'Migraine / céphalée', aliases: ['mal de tête', 'céphalées'],
        vitals: { hr: 5, sbp: 6 }, complaint: 'Mal de tête pulsatile, gêne à la lumière et au bruit, nausées.', diagnosis: 'Migraine.', findings: { esg: NORMAL, pupils: 'patientPupilsNormal' }, admitAt: null,
        steps: ['Examen neurologique complet pour éliminer un signe de gravité.', 'Repos au calme, à l\'obscurité.', 'Antalgique et antiémétique.', 'Consignes de retour en cas de céphalée brutale, de fièvre ou de déficit.'],
        meds: [['paracetamol', 'po', 0], ['ketoprofene', 'po', 0], ['metoclopramide', 'po', 1]],
    },
    {
        id: 'coma', label: 'Altération de la conscience / coma', aliases: ['inconscient', 'inconscience', 'somnolent'],
        vitals: { hr: 6, sbp: -6, rr: -3, spo2: -4, gcs: -7 }, tags: ['coma'], complaint: 'Patient inconscient ou très somnolent, répond mal aux stimulations.', diagnosis: 'Altération de la conscience, cause à rechercher.',
        findings: { esg: ALT, pupils: 'patientPupilsAbnormal' }, imaging: ['CTScan'], routineCare: ['Oxygen', 'Infusion'], admitAt: 0, followup: 'Recommended',
        steps: ['Libération des voies aériennes, position latérale de sécurité, oxygène.', 'Glycémie capillaire, Glasgow, pupilles.', 'Recherche d\'une intoxication, d\'un traumatisme ou d\'une cause métabolique.', 'Scanner cérébral et bilan toxicologique.'],
        meds: [['oxygene', 'masque', 0], ['glucose30', 'iv', 3]],
    },
]);

const INTOX = group('Intoxications', [
    {
        id: 'surdose_opioides', label: 'Surdose d\'opioïdes', aliases: ['héroïne', 'fentanyl', 'morphine', 'overdose', 'OD'],
        vitals: { hr: -18, sbp: -20, dbp: -10, rr: -10, spo2: -15, temp: -0.5, gcs: -6 }, tags: ['intox_opioide', 'coma'], complaint: 'Patient retrouvé somnolent ou inconscient, respiration très ralentie.', mechanism: 'Consommation d\'opioïdes.',
        diagnosis: 'Intoxication aux opioïdes avec dépression respiratoire.', findings: { pupils: 'patientPupilsAbnormal', esg: ALT }, routineCare: ['Oxygen'], admitAt: 0, followup: 'Recommended',
        steps: ['Ventilation au ballon et oxygène si la respiration est inefficace.', 'Naloxone à doses croissantes jusqu\'à une ventilation efficace.', 'Surveillance d\'au moins 6 heures : la naloxone agit moins longtemps que l\'opioïde.', 'Recherche d\'une intoxication associée, glycémie, ECG ; lien avec une prise en charge de l\'addiction.'],
        meds: [['oxygene', 'masque', 0], ['naloxone', 'iv', 0]],
    },
    {
        id: 'surdose_benzo', label: 'Intoxication aux benzodiazépines / sédatifs', aliases: ['Xanax', 'Valium', 'somnifères', 'tranquillisants'],
        vitals: { hr: -10, sbp: -14, rr: -6, spo2: -8, gcs: -5 }, tags: ['coma'], complaint: 'Somnolence profonde, paroles confuses, démarche instable.', mechanism: 'Prise excessive de sédatifs.',
        diagnosis: 'Intoxication aux benzodiazépines.', findings: { esg: ALT, pupils: 'patientPupilsNormal' }, routineCare: ['Oxygen'], admitAt: 1, followup: 'Recommended',
        steps: ['Surveillance de la conscience et de la ventilation, oxygène.', 'Recherche d\'une prise associée (alcool, opioïdes, antidépresseurs).', 'Flumazénil réservé aux cas graves, avec prudence (risque de convulsions).', 'Surveillance prolongée et évaluation du risque suicidaire en cas de prise volontaire.'],
        meds: [['oxygene', 'masque', 1], ['flumazenil', 'iv', 3]],
    },
    {
        id: 'surdose_stimulants', label: 'Intoxication aux stimulants (cocaïne, amphétamines)', aliases: ['cocaïne', 'meth', 'amphétamine', 'ecstasy', 'crack'],
        vitals: { hr: 48, sbp: 42, dbp: 24, rr: 6, temp: 1.4 }, tags: ['stimulant'], complaint: 'Agitation, palpitations, sueurs, douleur thoracique possible.', mechanism: 'Consommation de stimulants.',
        diagnosis: 'Intoxication aiguë aux stimulants.', findings: { pupils: 'patientPupilsAbnormal', esg: ALT, ecg: 'patientArrhythmia' }, routineCare: ['Oxygen', 'Infusion'], admitAt: 1, followup: 'Recommended',
        steps: ['Environnement calme, surveillance continue des constantes.', 'ECG, température, glycémie ; hydratation.', 'Benzodiazépine pour l\'agitation, l\'hypertension et la douleur thoracique.', 'Recherche d\'un syndrome coronarien, d\'une hyperthermie ou d\'une rhabdomyolyse.'],
        meds: [['diazepam', 'iv', 0], ['midazolam', 'im', 2], ['nacl09', 'iv', 2], ['aspirine', 'po', 3]],
    },
    {
        id: 'intox_alcool', label: 'Intoxication alcoolique aiguë', aliases: ['ivresse', 'éthylique', 'alcool', 'coma éthylique'],
        vitals: { hr: 10, sbp: -10, rr: -3, temp: -0.7, glu: -0.2, gcs: -3 }, tags: ['intox_alcool'], complaint: 'Confusion, propos incohérents, démarche instable, vomissements.', mechanism: 'Consommation excessive d\'alcool.',
        diagnosis: 'Intoxication alcoolique aiguë.', findings: { esg: ALT, pupils: 'patientPupilsNormal' }, routineCare: ['Infusion'], admitAt: 2, followup: 'AsNeeded',
        steps: ['Position latérale de sécurité si somnolence, surveillance de la conscience.', 'Glycémie capillaire, réchauffement, recherche d\'un traumatisme crânien associé.', 'Hydratation, vitamine B1 avant tout apport de glucose.', 'Surveillance jusqu\'à la sobriété ; dépistage de la dépendance.'],
        meds: [['thiamine', 'iv', 1], ['nacl09', 'iv', 1], ['ondansetron', 'iv', 1]],
    },
    {
        id: 'intox_paracetamol', label: 'Intoxication au paracétamol', aliases: ['doliprane', 'surdosage paracétamol'],
        vitals: { hr: 6 }, complaint: 'Nausées et douleurs abdominales après ingestion de nombreux comprimés.', mechanism: 'Ingestion volontaire ou accidentelle de paracétamol.',
        diagnosis: 'Intoxication au paracétamol.', findings: { esg: NORMAL }, routineCare: ['Infusion'], admitAt: 0, followup: 'Recommended',
        steps: ['Heure et dose ingérées, recherche d\'autres médicaments.', 'Dosage du paracétamol à la 4e heure et bilan hépatique.', 'Charbon activé si prise datant de moins d\'une heure et patient vigil.', 'N-acétylcystéine selon le risque ; évaluation psychiatrique en cas de prise volontaire.'],
        meds: [['charbon', 'po', 0], ['acetylcysteine', 'iv', 1], ['ondansetron', 'iv', 0]],
    },
    {
        id: 'intox_fumees', label: 'Inhalation de fumées / monoxyde de carbone', aliases: ['incendie', 'fumée', 'CO', 'gaz'],
        vitals: { hr: 20, rr: 8, spo2: -4, gcs: -2 }, airway: false, complaint: 'Maux de tête, vertiges, toux et suie dans les voies aériennes après un incendie.', mechanism: 'Exposition aux fumées d\'un incendie.',
        diagnosis: 'Inhalation de fumées, intoxication au monoxyde de carbone possible.', findings: { lungs: 'patientRhonchi', esg: ALT }, imaging: ['XRay'], routineCare: ['Oxygen'], admitAt: 1, followup: 'Recommended',
        steps: ['Extraction du patient, oxygène à haut débit au masque.', 'Évaluation des brûlures du visage et des voies aériennes.', 'Dosage de la carboxyhémoglobine et des lactates, ECG.', 'Antidote si choc ou coma ; oxygénothérapie hyperbare selon la gravité.'],
        meds: [['oxygene', 'masque', 0], ['hydroxocobalamine', 'iv', 2], ['salbutamol', 'neb', 1]],
    },
    {
        id: 'agitation', label: 'Agitation aiguë', aliases: ['violent', 'énervé', 'crise d\'angoisse', 'délire'],
        vitals: { hr: 24, sbp: 22, dbp: 12, rr: 5, temp: 0.3 }, tags: ['agitation'], complaint: 'Patient très agité, parfois agressif, difficile à examiner.', diagnosis: 'Agitation aiguë, cause à rechercher.',
        findings: { esg: ALT }, admitAt: 2, followup: 'Recommended',
        steps: ['Sécurité du soignant d\'abord, désescalade verbale, environnement calme.', 'Recherche d\'une cause organique : hypoglycémie, intoxication, traumatisme, infection.', 'Sédation médicamenteuse seulement si le danger persiste, contention en dernier recours.', 'Évaluation psychiatrique une fois le calme obtenu.'],
        meds: [['midazolam', 'im', 1], ['haloperidol', 'im', 2]],
    },
]);

const METABO = group('Métabolique et infectieux', [
    {
        id: 'hypoglycemie', label: 'Hypoglycémie', aliases: ['malaise diabétique', 'sucre bas'],
        vitals: { hr: 20, sbp: 5, temp: -0.2, glu: -0.58, gcs: -2 }, complaint: 'Sueurs, tremblements, faim intense, confusion.', diagnosis: 'Hypoglycémie.', findings: { esg: ALT }, routineCare: ['Infusion'], admitAt: 2, followup: 'Recommended',
        steps: ['Glycémie capillaire immédiate.', 'Resucrage par voie orale si le patient est conscient (15 g de glucides).', 'Glucose par voie veineuse, ou glucagon, si le patient ne peut pas avaler.', 'Contrôle de la glycémie à 15 minutes, recherche de la cause (traitement, repas sauté, alcool).'],
        meds: [['glucose30', 'iv', 1], ['glucagon', 'im', 2]],
    },
    {
        id: 'acidocetose', label: 'Hyperglycémie / acidocétose', aliases: ['diabète décompensé', 'sucre élevé', 'cétose'],
        vitals: { hr: 28, sbp: -14, dbp: -8, rr: 10, temp: 0.3, glu: 3.4, gcs: -1 }, complaint: 'Soif intense, urines abondantes, nausées, haleine fruitée.', diagnosis: 'Décompensation hyperglycémique avec acidocétose.',
        findings: { esg: ALT }, routineCare: ['Infusion'], admitAt: 0, followup: 'Recommended',
        steps: ['Glycémie, cétonémie, bilan sanguin avec ionogramme.', 'Réhydratation intraveineuse prudente.', 'Insuline et correction du potassium selon les résultats.', 'Recherche d\'un facteur déclenchant (infection, arrêt du traitement).'],
        meds: [['nacl09', 'iv', 0], ['ondansetron', 'iv', 1]],
    },
    {
        id: 'deshydratation', label: 'Gastro-entérite / déshydratation', aliases: ['vomissements', 'diarrhée', 'gastro'],
        vitals: { hr: 24, sbp: -14, dbp: -8, temp: 0.7, rr: 3 }, complaint: 'Vomissements, diarrhées, soif intense, fatigue.', diagnosis: 'Gastro-entérite avec déshydratation.', findings: { esg: NORMAL }, routineCare: ['Infusion'], admitAt: 2, followup: 'AsNeeded',
        steps: ['Évaluation de l\'hydratation : pli cutané, muqueuses, tension.', 'Réhydratation orale, ou intraveineuse si les vomissements l\'empêchent.', 'Antiémétique et antispasmodique.', 'Consignes de retour : sang dans les selles, fièvre élevée, incapacité à boire.'],
        meds: [['ondansetron', 'po', 0], ['phloroglucinol', 'po', 0], ['paracetamol', 'po', 0], ['nacl09', 'iv', 2]],
    },
    {
        id: 'sepsis', label: 'Fièvre / sepsis', aliases: ['infection', 'septicémie', 'état infectieux'],
        vitals: { temp: 2.0, hr: 34, rr: 8, sbp: -18, dbp: -10, spo2: -3 }, complaint: 'Fièvre élevée, frissons, grande fatigue.', diagnosis: 'Syndrome infectieux avec retentissement général.',
        findings: { esg: ALT }, routineCare: ['Infusion', 'Antibiotic'], admitAt: 1, followup: 'Recommended',
        steps: ['Constantes complètes et recherche du foyer infectieux.', 'Bilan sanguin avec hémocultures et lactates, bandelette urinaire.', 'Antibiothérapie large dans l\'heure en cas de signes de gravité.', 'Remplissage vasculaire si hypotension ; antipyrétique.'],
        meds: [['paracetamol', 'po', 0], ['ceftriaxone', 'iv', 1], ['nacl09', 'iv', 1]],
    },
    {
        id: 'douleur_abdominale', label: 'Douleur abdominale', aliases: ['mal au ventre', 'appendicite', 'abdomen aigu'],
        vitals: { hr: 14, sbp: 4, temp: 0.4 }, complaint: 'Douleur abdominale, nausées, parfois fièvre.', diagnosis: 'Douleur abdominale aiguë, cause à préciser.', findings: { esg: NORMAL }, imaging: ['Ultrasound'], routineCare: ['Analgesia'], admitAt: 2, surgical: true, followup: 'Recommended',
        steps: ['Examen de l\'abdomen : défense, contracture, signes péritonéaux.', 'Bandelette urinaire, test de grossesse chez la femme en âge de procréer, bilan sanguin.', 'Échographie ou scanner selon la localisation.', 'Avis chirurgical si abdomen aigu ; à jeun.'],
        meds: [['paracetamol', 'po', 0], ['phloroglucinol', 'po', 0], ['ondansetron', 'po', 1], ['fentanyl', 'iv', 3]],
    },
    {
        id: 'colique_nephretique', label: 'Colique néphrétique', aliases: ['calcul rénal', 'rein', 'lithiase'],
        vitals: { hr: 10, sbp: 20, dbp: 10 }, complaint: 'Douleur très intense du flanc irradiant vers les organes génitaux, agitation.', diagnosis: 'Colique néphrétique.', findings: { esg: NORMAL }, imaging: ['Ultrasound', 'CTScan'], routineCare: ['Analgesia'], admitAt: 3, followup: 'Recommended',
        steps: ['Antalgie rapide, bandelette urinaire à la recherche de sang.', 'Imagerie : échographie ou scanner sans injection.', 'Recherche de fièvre ou d\'un rein unique (urgence urologique).', 'Hydratation normale, tamisage des urines.'],
        meds: [['ketoprofene', 'iv', 0], ['paracetamol', 'iv', 0], ['phloroglucinol', 'iv', 0]],
    },
    {
        id: 'hypothermie', label: 'Hypothermie', aliases: ['gelure', 'froid', 'grelottement'],
        vitals: { temp: -4, hr: -20, rr: -4, sbp: -10, gcs: -2 }, complaint: 'Frissons intenses, engourdissement, confusion.', mechanism: 'Exposition prolongée au froid.', diagnosis: 'Hypothermie accidentelle.',
        findings: { esg: ALT, ecg: 'patientArrhythmia' }, routineCare: ['Oxygen'], admitAt: 1, followup: 'Recommended',
        steps: ['Mise à l\'abri, retrait des vêtements mouillés, isolation du sol.', 'Réchauffement passif puis actif (couvertures chauffantes, solutés tièdes).', 'Manipuler avec douceur : risque de trouble du rythme.', 'ECG et surveillance rapprochée.'],
        meds: [['oxygene', 'masque', 1]],
    },
    {
        id: 'coup_chaleur', label: 'Coup de chaleur', aliases: ['insolation', 'hyperthermie', 'chaleur'],
        vitals: { temp: 3, hr: 38, rr: 9, sbp: -14, gcs: -3 }, complaint: 'Température très élevée, peau chaude et sèche ou moite, confusion.', mechanism: 'Exposition à la chaleur ou effort prolongé en ambiance chaude.',
        diagnosis: 'Coup de chaleur.', findings: { esg: ALT }, routineCare: ['Infusion'], admitAt: 0, followup: 'Recommended',
        steps: ['Refroidissement immédiat : déshabiller, aspersion d\'eau fraîche, ventilation.', 'Température rectale, glycémie, ionogramme, bilan musculaire.', 'Réhydratation intraveineuse.', 'Surveillance de la fonction rénale et de la conscience.'],
        meds: [['nacl09', 'iv', 0]],
    },
]);

// Antécédents que le motif évoque (à proposer d'ajouter au patient s'ils lui manquent) et motifs qui appellent de noter l'allergène.
//  chronic : antécédent évoqué ; allergen : l'allergène identifié est à ajouter aux allergies.
export const HISTORY_HINTS = {
    asthme: { chronic: 'Asthme' },
    hypoglycemie: { chronic: 'Diabète' },
    acidocetose: { chronic: 'Diabète' },
    crise_hypertensive: { chronic: 'Hypertension' },
    oap: { chronic: 'Maladie cardiaque' },
    convulsions: { chronic: 'Épilepsie' },
    anaphylaxie: { allergen: true },
    allergie_legere: { allergen: true },
};

export const CONDITIONS = [...TRAUMA, ...CARDIO, ...RESPI, ...NEURO, ...INTOX, ...METABO];
export const CONDITION_BY_ID = Object.fromEntries(CONDITIONS.map((c) => [c.id, c]));
export const CONDITION_GROUPS = [...new Set(CONDITIONS.map((c) => c.group))].map((name) => ({ label: name, options: CONDITIONS.filter((c) => c.group === name) }));
