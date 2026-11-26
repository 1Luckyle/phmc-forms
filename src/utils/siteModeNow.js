// src/utils/siteModeNow.js
//
// VERSION DU SITE lisible hors de React (modules purs : aide des champs, validation, générateurs BBCode, textes par défaut). Tenue à jour par
// SiteConfigProvider (contexts/SiteConfigContext.js) ; au chargement, la dernière version connue du navigateur. Les composants React utilisent
// plutôt useSiteMode(). Après une bascule de version, un rechargement de la page applique partout les nouveaux textes.
//
// En version classique, AUCUNE mention de GTA World, d'Eyefind ni de Fleeca : siteText() remplace les exemples et noms propres de la version
// GTA World par leur équivalent (adresses fictives @phmc.health, « forum »).
import { DEFAULT_SITE_MODE, SITE_MODE_CLASSIC, normalizeSiteMode } from '../constants/siteMode';

const readCache = () => {
    try { return normalizeSiteMode(localStorage.getItem('siteConfig_siteMode')); } catch (error) { return DEFAULT_SITE_MODE; }
};
let current = readCache();

export const setSiteModeNow = (mode) => { current = normalizeSiteMode(mode); };
export const siteModeNow = () => current;
export const isClassicNow = () => current === SITE_MODE_CLASSIC;

// Exemple d'adresse dans l'aide et les champs : l'adresse Eyefind du personnage, ou l'adresse fictive du PHMC créée avec le compte.
export const exampleEmail = () => (isClassicNow() ? 'prenom.nom@phmc.health' : 'prenomnom@mail.eyefind.fr');
// Adresse des données de test (remplissage debug, « visualiser en tant que ») : prenom.nom@phmc.health, ou prenomnom@mail.eyefind.fr en version GTA World.
export const testEmail = (first, last) => (isClassicNow() ? `${first}.${last}@phmc.health` : `${first}${last}@mail.eyefind.fr`);
// Adresse de contact du PHMC dans les pieds de page des documents.
export const phmcContactEmail = () => (isClassicNow() ? 'contact@phmc.health' : 'info.phmc@mail.eyefind.fr');
// Le forum où se publient les rapports en HTML.
export const forumLabel = () => (isClassicNow() ? 'forum du serveur' : 'forum GTA World');

const CLASSIC_REPLACEMENTS = [
    ['prenomnom@mail.eyefind.fr', 'prenom.nom@phmc.health'],
    ['info.phmc@mail.eyefind.fr', 'contact@phmc.health'],
    ['forum GTA World', 'forum du serveur'],
];
// Texte de la version GTA World → texte de la version active (inchangé en version GTA World).
export const siteText = (text) => {
    if (!isClassicNow() || typeof text !== 'string') return text;
    return CLASSIC_REPLACEMENTS.reduce((out, [from, to]) => out.split(from).join(to), text);
};
