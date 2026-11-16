// src/clinical/pilouChoices.js
//
// Choix de l'outil Pilou : les champs de texte sont à choix (listes), jamais de texte libre, car Pilou ne comprend que ce que son moteur connaît (clinical/medications.js : allergies,
// contre-indications liées aux antécédents, interactions avec les traitements en cours). Chaque choix d'allergie, d'antécédent et de traitement contient au moins un terme reconnu par
// le moteur : un test (pilouChoices.test.js) le vérifie, pour qu'un choix proposé ne soit jamais sans effet.
// L'âge, le poids et la taille sont des nombres saisis librement, bornés par clinical/bodyLimits.js : c'est le moteur qui en déduit ses tranches (âge : vitals.js, doses : engine.js).

export const SEX_OPTIONS = [{ value: 'Male', label: 'Homme' }, { value: 'Female', label: 'Femme' }];

const choices = (labels) => labels.map((label) => ({ value: label, label }));

export const ALLERGY_CHOICES = choices([
    'Pénicilline / amoxicilline', 'Céphalosporines', 'Sulfamides', 'Macrolides (azithromycine, érythromycine)', 'Quinolones (ciprofloxacine)', 'Clindamycine', 'Métronidazole',
    'Aspirine / anti-inflammatoires (AINS)', 'Paracétamol', 'Opioïdes (morphine, codéine, tramadol)', 'Benzodiazépines', 'Anesthésiques locaux (lidocaïne)', 'Iode / produit de contraste',
    'Corticoïdes', 'Vaccins / tétanos', 'Curares / myorelaxants', 'Arachide', 'Œuf', 'Soja',
]);

export const HISTORY_CHOICES = choices([
    'Asthme', 'Diabète', 'Hypertension artérielle', 'Maladie cardiaque (insuffisance cardiaque)', 'Insuffisance rénale', 'Insuffisance hépatique / cirrhose', 'Insuffisance respiratoire / BPCO',
    'Épilepsie', 'Ulcère gastrique', 'Trouble de la coagulation (hémophilie)', 'Thrombose / phlébite / embolie', 'Glaucome', 'Hyperthyroïdie', 'Parkinson', 'Myasthénie',
    'Apnée du sommeil', 'Schizophrénie / psychose', 'Alcoolisme', 'Dialyse',
]);

export const MEDICATION_CHOICES = choices([
    'Anticoagulant (warfarine, Xarelto, Eliquis, héparine)', 'Antiagrégant (clopidogrel, Plavix)', 'Antidépresseur (sertraline, fluoxétine, ISRS)', 'Antidépresseur tricyclique (amitriptyline)',
    'Benzodiazépine (Xanax, Valium, Temesta)', 'Opioïde (morphine, tramadol, méthadone)', 'Amiodarone (Cordarone)', 'Halopéridol (Haldol)', 'Sildénafil / tadalafil (Viagra, Cialis)',
    'Aminoside (gentamicine)', 'Furosémide (Lasilix)', 'Théophylline', 'Ondansétron', 'Azithromycine', 'Ciprofloxacine',
]);

/** Liste de choix → texte lu par le moteur (« ; » entre les éléments). */
export const joinChoices = (values) => (Array.isArray(values) ? values.join(' ; ') : '');
