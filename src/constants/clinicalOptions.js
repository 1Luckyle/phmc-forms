// Listes de résultats d'imagerie et de laboratoire.
//
// Les listes de base viennent de la base Firebase (selectOptions), en anglais.
// Ce fichier :
//  1. traduit en français l'affichage des entrées existantes (les VALEURS ne
//     changent pas, donc les rapports déjà enregistrés restent valides) ;
//  2. ajoute les résultats cliniques manquants.
//
// Le générateur BBCode imprime la VALEUR de l'option dans le rapport, pas son
// libellé : les entrées ajoutées ont donc comme valeur un texte lisible en
// français, et translateResultValue() traduit à l'impression les anciennes
// valeurs anglaises.

// Anciennes valeurs (anglais) -> libellé français.
export const LEGACY_RESULT_LABELS = {
    NothingFound: 'Aucune anomalie détectée',
    // Radiographie
    Dislocation: 'Luxation',
    'Hairline Fracture': 'Fracture fissuraire (en cheveu)',
    'Displaced Fracture': 'Fracture déplacée',
    'Complete Fracture': 'Fracture complète',
    'Pleural Effusion': 'Épanchement pleural',
    Pneumothorax: 'Pneumothorax (poumon collabé)',
    'Pulmonary Edema': 'Œdème pulmonaire',
    Hemothorax: 'Hémothorax (sang dans la cavité pleurale)',
    // Scanner
    'Aortic Dissection': 'Dissection aortique',
    'Intracranial Hemorrhage': 'Hémorragie intracrânienne',
    'Midline Shift': 'Déviation de la ligne médiane',
    'Pulmonary Embolism': 'Embolie pulmonaire',
    'Skull Fracture': 'Fracture du crâne',
    'Solid Organ Injury': "Lésion d'organe plein",
    Tumor: 'Tumeur',
    // IRM
    'Cancerous Mass': 'Masse cancéreuse',
    'Degenerative Disc Disease': 'Discopathie dégénérative',
    'Herniated Disc': 'Hernie discale',
    'Multiple Sclerosis': 'Sclérose en plaques',
    'Spinal Stenosis': 'Sténose canalaire (rachis)',
    Stroke: 'AVC',
    // Échographie
    Cyst: 'Kyste',
    'Ectopic Pregnancy': 'Grossesse extra-utérine',
    'Free Fluid Accumulation': 'Épanchement liquidien libre',
    Gallstones: 'Calculs biliaires',
    'Internal Bleeding': 'Hémorragie interne',
    'Organ Damage': "Lésion d'organe",
    'Ovarian Torsion': 'Torsion ovarienne',
    'Pregnancy Confirmation': 'Grossesse confirmée',
    // Autres examens
    NeurologicalAbnormalities: 'Anomalies neurologiques',
    CardiacAbnormalities: 'Anomalies cardiaques',
    PulmonaryAbnormalities: 'Anomalies pulmonaires',
    // Laboratoire (les sept entrées historiques, clés fixes du générateur)
    WNL: 'Dans les limites de la normale (DLN)',
    Anemia: 'Anémie',
    'Inflammation/Infection': 'Inflammation/Infection',
    Dysfunction: 'Dysfonctionnement/Trouble',
    ElectrolyteImbalance: 'Déséquilibre électrolytique',
    Infarct: 'Infarctus/Embolie',
};

// Clés historiques du laboratoire : ce sont les cases fixes du BBCode.
export const LEGACY_LAB_KEYS = [
    'WNL', 'Anemia', 'Inflammation/Infection', 'Dysfunction',
    'ElectrolyteImbalance', 'Infarct', 'Tumor',
];

// Résultats ajoutés (valeur = libellé = texte français imprimé dans le rapport).
export const IMAGING_RESULT_ADDITIONS = {
    XrayResults: [
        'Fracture de côte(s)',
        'Volet costal',
        'Fracture vertébrale (tassement)',
        'Fracture du bassin',
        'Fracture du crâne ou de la face',
        'Fracture comminutive (esquilles osseuses)',
        'Projectile balistique ou fragments métalliques',
        'Corps étranger radio-opaque',
        'Contusion pulmonaire',
        'Foyer de condensation (pneumonie)',
        'Atélectasie',
        'Emphysème sous-cutané',
        'Pneumomédiastin',
        'Pneumopéritoine (air libre sous le diaphragme)',
        'Élargissement du médiastin',
        'Cardiomégalie',
        'Épanchement articulaire',
        'Lésion lytique ou condensante osseuse suspecte',
    ],
    ctResults: [
        // Crâne et encéphale
        'Pas de lésion intracrânienne aiguë',
        'Fracture de la voûte crânienne',
        'Fracture de la base du crâne',
        'Fractures de la face (orbite, mandibule, os malaires)',
        'Hématome du cuir chevelu',
        'Contusion cérébrale',
        'Œdème cérébral',
        'Hématome extra-dural',
        'Hématome sous-dural',
        'Hémorragie sous-arachnoïdienne',
        'Hémorragie intraparenchymateuse',
        'Hémorragie intraventriculaire',
        'Engagement cérébral (hernie)',
        'AVC ischémique (hypodensité)',
        'Pneumocéphalie',
        // Thorax, abdomen, rachis
        'Fractures costales multiples',
        'Contusion pulmonaire',
        'Pneumothorax',
        'Hémothorax',
        'Hémopéricarde',
        'Rupture ou anévrisme de l\'aorte',
        'Hémopéritoine',
        'Lésion splénique',
        'Lésion hépatique',
        'Lésion rénale',
        'Lésion pancréatique',
        'Perforation d\'organe creux (pneumopéritoine)',
        'Occlusion intestinale',
        'Appendicite',
        'Fracture vertébrale',
        'Fracture du bassin avec hématome rétropéritonéal',
        'Projectile balistique ou corps étranger',
    ],
    mriResults: [
        'AVC ischémique aigu',
        'Hémorragie intracérébrale',
        'Lésion axonale diffuse',
        'Hydrocéphalie',
        'Anévrisme cérébral',
        'Thrombose veineuse cérébrale',
        'Abcès cérébral',
        'Compression médullaire',
        'Contusion ou œdème médullaire',
        'Section ou lésion médullaire traumatique',
        'Fracture occulte',
        'Rupture du ligament croisé antérieur',
        'Lésion méniscale',
        'Rupture de la coiffe des rotateurs',
        'Épanchement articulaire',
    ],
    ultrasoundResults: [
        'Hémopéritoine (FAST positif)',
        'Épanchement péricardique',
        'Tamponnade cardiaque',
        'Épanchement pleural',
        'Pneumothorax (absence de glissement pleural)',
        'Rupture splénique ou hépatique',
        'Hydronéphrose',
        'Calcul rénal',
        'Appendicite',
        'Cholécystite',
        'Anévrisme de l\'aorte abdominale',
        'Thrombose veineuse profonde',
        'Grossesse intra-utérine évolutive',
        'Fausse couche (grossesse arrêtée)',
        'Torsion testiculaire',
        'Hématome des parties molles',
        'Abcès des parties molles',
        'Stéatose hépatique',
    ],
    otherResults: [
        'Angiographie : sténose ou occlusion artérielle',
        'Angiographie : anévrisme',
        'Doppler : thrombose veineuse profonde',
        'Doppler : sténose artérielle',
        'EEG : activité épileptiforme',
        'EEG : ralentissement diffus',
        'Endoscopie : ulcère gastro-duodénal',
        'Endoscopie : saignement digestif',
        'Fluoroscopie : corps étranger',
        'Densitométrie : ostéoporose',
    ],
};

export const LAB_RESULT_ADDITIONS = [
    // Hématologie et coagulation
    'Leucocytose',
    'Leucopénie',
    'Thrombopénie',
    'Thrombocytose',
    'Polyglobulie',
    'Anémie macrocytaire',
    'Troubles de la coagulation (INR élevé)',
    'D-dimères élevés',
    // Ionogramme, métabolisme
    'Hyponatrémie',
    'Hypernatrémie',
    'Hypokaliémie',
    'Hyperkaliémie',
    'Hypocalcémie',
    'Hypercalcémie',
    'Hypoglycémie',
    'Hyperglycémie',
    'Acidose métabolique',
    'Lactates élevés',
    // Fonction rénale et hépatique, pancréas
    'Insuffisance rénale (créatinine élevée)',
    'Cytolyse hépatique (ASAT/ALAT élevées)',
    'Cholestase',
    'Lipase élevée (pancréatite)',
    'CRP élevée',
    // Cœur
    'Troponine élevée',
    'BNP élevé',
    // Gaz du sang
    'Hypoxémie',
    'Hypercapnie',
    // Toxicologie
    'Alcoolémie positive',
    'Dépistage toxicologique positif (stupéfiants)',
    'Intoxication médicamenteuse',
    'Carboxyhémoglobine élevée',
    // Urines, grossesse, infection
    'Infection urinaire (leucocyturie, nitrites)',
    'Hématurie',
    'Glycosurie ou cétonurie',
    'Protéinurie',
    'β-hCG positif (grossesse)',
    'β-hCG négatif',
    'Hémocultures positives',
];

const normalize = (text) => String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Fusionne la liste de la base avec les ajouts :
 *  - les entrées existantes gardent leur VALEUR, mais s'affichent en français
 *    quand une traduction est connue ;
 *  - les ajouts absents (comparaison sans accents ni casse, sur valeur ET
 *    libellé) sont ajoutés en fin de liste.
 * @param {Array<{value: string, label: string}>} baseOptions déjà passée dans optionize()
 * @param {string[]} additions
 */
export const mergeResultOptions = (baseOptions, additions = []) => {
    const base = (baseOptions || []).map((option) => ({
        ...option,
        label: LEGACY_RESULT_LABELS[option.value] || option.label,
    }));
    const known = new Set();
    base.forEach((option) => {
        known.add(normalize(option.value));
        known.add(normalize(option.label));
    });
    const added = additions
        .filter((text) => !known.has(normalize(text)))
        .map((text) => ({ value: text, label: text }));
    return [...base, ...added];
};

/** Texte imprimé dans le rapport : traduit les anciennes valeurs anglaises. */
export const translateResultValue = (value) => LEGACY_RESULT_LABELS[value] || value;
