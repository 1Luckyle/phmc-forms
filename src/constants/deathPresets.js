// src/constants/deathPresets.js
//
// Choix par défaut des champs de texte des rapports de médecine légale (voir phmc-field-data/shared/PresetTextField.js) : on coche autant de choix que
// nécessaire et on peut toujours ajouter du texte libre.

// Cause probable du décès (rapport de médecine légale, tuerie de masse, rapport public de décès).
export const DEATH_CAUSE_PRESETS = [
    'Blessure par arme à feu', 'Blessure par arme blanche', 'Traumatisme contondant', 'Traumatisme crânien', 'Hémorragie', 'Asphyxie', 'Noyade', 'Brûlures', 'Explosion',
    'Accident de la route', 'Chute de hauteur', 'Électrocution', 'Intoxication / overdose', 'Arrêt cardiaque', 'Maladie / cause naturelle', 'Cause indéterminée',
];

export const DEATH_PRESET_KEYS = { probableCauseOfDeath: DEATH_CAUSE_PRESETS, causeOfDeath: DEATH_CAUSE_PRESETS, causesOfDeath: DEATH_CAUSE_PRESETS };
