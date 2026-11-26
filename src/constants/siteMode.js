// src/constants/siteMode.js
//
// VERSION DU SITE, choisie par les admins (panneau admin → Version du site) et stockée dans adminSettings/siteMode ({ mode, majLe, majPar }) :
//   • 'gtaw'      : version GTA World (connexion GTA World, paiements Fleeca, mails Eyefind, ID patient tiré du personnage). C'est la version
//                   d'origine et la valeur par défaut : tant que rien n'est enregistré, le site se comporte exactement comme avant.
//   • 'classique' : version PHMC classique, sans GTA World (connexion Discord, paiements validés par le personnel, notifications internes,
//                   adresses fictives prenom.nom@phmc.health, aucune mention de GTA World).
// Les Cloud Functions lisent le même réglage (functions/index.js : readSiteMode) et refusent ce qui n'appartient pas à la version active.
export const SITE_MODE_GTAW = 'gtaw';
export const SITE_MODE_CLASSIC = 'classique';
export const DEFAULT_SITE_MODE = SITE_MODE_GTAW;

export const SITE_MODES = [
    { value: SITE_MODE_GTAW, label: 'Version GTA World', short: 'GTA World' },
    { value: SITE_MODE_CLASSIC, label: 'Version PHMC classique', short: 'Classique' },
];

// Toute valeur inconnue ou absente = version GTA World (jamais de bascule accidentelle).
export const normalizeSiteMode = (value) => (value === SITE_MODE_CLASSIC ? SITE_MODE_CLASSIC : SITE_MODE_GTAW);

export const siteModeLabel = (mode) => (SITE_MODES.find((entry) => entry.value === normalizeSiteMode(mode)) || SITE_MODES[0]).label;
