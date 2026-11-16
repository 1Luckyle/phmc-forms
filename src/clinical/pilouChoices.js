// src/clinical/pilouChoices.js
//
// Choix de l'outil Pilou : TOUS les champs sont à choix (listes), jamais de texte libre, car Pilou ne comprend que ce que son moteur connaît (clinical/medications.js : allergies,
// contre-indications liées aux antécédents, interactions avec les traitements en cours). Chaque choix d'allergie, d'antécédent et de traitement contient au moins un terme reconnu par
// le moteur : un test (pilouChoices.test.js) le vérifie, pour qu'un choix proposé ne soit jamais sans effet.

import { BODY_LIMITS } from './bodyLimits';

const range = (from, to, step = 1) => { const out = []; for (let value = from; value <= to; value += step) out.push(value); return out; };

// Âge en années (0 = moins d'un an).
export const AGE_OPTIONS = range(BODY_LIMITS.ageYears.min, BODY_LIMITS.ageYears.max).map((years) => ({ value: String(years), label: years === 0 ? 'Nourrisson (moins d\'un an)' : `${years} an${years > 1 ? 's' : ''}` }));
// Poids (1 à 400 kg, comme le reste du site) : au kilo près jusqu'à 10 kg, puis de plus en plus large.
export const WEIGHT_OPTIONS = [...range(BODY_LIMITS.weightKg.min, 10), ...range(12, 40, 2), ...range(45, 150, 5), ...range(160, BODY_LIMITS.weightKg.max, 10)].map((kg) => ({ value: String(kg), label: `${kg} kg` }));
// Taille (30 à 260 cm, comme le reste du site) : par tranches de 5 cm.
export const HEIGHT_OPTIONS = range(BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max, 5).map((cm) => ({ value: String(cm), label: `${cm} cm` }));
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
