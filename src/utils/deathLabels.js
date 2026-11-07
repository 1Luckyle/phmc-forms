// src/utils/deathLabels.js
//
// Libellés FRANÇAIS des choix des rapports de médecine légale. Les listes déroulantes viennent de la base (selectOptions) avec des valeurs anglaises
// (PK, Natural, Open…) : le formulaire les affiche avec ces libellés (`localizeOptions`) et les rapports les impriment en français (`frDeath`).
// Une valeur inconnue (liste modifiée dans la base) reste telle quelle.

export const DEATH_TYPE_FR = {
    PK: 'PK — mort du joueur (Player Kill : le personnage survit)',
    CK: 'CK — mort définitive du personnage (Character Kill)',
    'Player Kill': 'PK — mort du joueur (Player Kill : le personnage survit)',
    'Character Kill': 'CK — mort définitive du personnage (Character Kill)',
};
// Version courte, pour les phrases des rapports.
export const DEATH_TYPE_SHORT_FR = { PK: 'PK (mort du joueur)', CK: 'CK (mort définitive du personnage)', 'Player Kill': 'PK (mort du joueur)', 'Character Kill': 'CK (mort définitive du personnage)' };

export const MANNER_FR = {
    Natural: 'Naturelle — le décès résulte de causes naturelles',
    Accident: 'Accidentelle — le décès résulte d\'un événement non intentionnel',
    Suicide: 'Suicide — le décès résulte d\'un acte que la personne s\'est infligé',
    Homicide: 'Homicide — le décès résulte d\'un acte intentionnel d\'une autre personne',
    Undetermined: 'Indéterminée — les éléments sont insuffisants pour conclure',
};
export const MANNER_SHORT_FR = { Natural: 'Naturelle', Accident: 'Accidentelle', Suicide: 'Suicide', Homicide: 'Homicide', Undetermined: 'Indéterminée' };

export const BODY_STATUS_FR = { Released: 'Remis', 'Ready for Release': 'Prêt à être remis', 'Not Brought In': 'Non amené à la morgue' };
export const CASE_STATUS_FR = { Open: 'Ouvert', Closed: 'Clos' };
export const IDENTIFICATION_FR = { Identified: 'Identifié', Unidentified: 'Non identifié' };
export const SEX_FR = { Male: 'Masculin', Female: 'Féminin', Undetermined: 'Indéterminé', Other: 'Autre' };

const ALL = { ...DEATH_TYPE_SHORT_FR, ...MANNER_SHORT_FR, ...BODY_STATUS_FR, ...CASE_STATUS_FR, ...IDENTIFICATION_FR, ...SEX_FR };

// Valeur enregistrée → texte français court pour un rapport (« Natural » → « Naturelle »).
export const frDeath = (value) => ALL[value] || String(value ?? '');

// Options { value, label } d'une liste de la base → mêmes options avec le libellé français de `labels` quand il existe.
export const localizeOptions = (options, labels) => (options || []).map((option) => ({ ...option, label: labels[option.value] || option.label }));
