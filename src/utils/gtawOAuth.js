// src/utils/gtawOAuth.js
//
// Point d'entrée unique pour démarrer une connexion OAuth GTA World, quel que
// soit le flux (onboarding, connexion employé, connexion admin, ajout d'employé
// par un admin). Le client OAuth GTA World (ucp-fr.gta.world) n'autorise qu'UNE
// SEULE URL de callback enregistrée : on doit donc toujours rediriger vers
// cette même URL, et mémoriser le flux en cours dans sessionStorage pour que
// GtaCallback.js sache quoi en faire au retour.
export const GTAW_OAUTH_FLOW_KEY = 'gtaw-oauth-flow';

export const getGtawRedirectUri = () => window.location.origin + '/phmc-forms/#/auth/gta/callback';

/**
 * Mémorise le flux en cours puis renvoie l'URL d'autorisation GTA World vers
 * laquelle rediriger (window.location.href = buildGtawAuthUrl(...)).
 * @param {{ type: 'onboarding'|'employee-login'|'admin-login'|'admin-add', [key: string]: any }} flow
 */
export const buildGtawAuthUrl = (flow) => {
    const clientId = process.env.REACT_APP_GTAWORLD_CLIENT_ID || '';
    const baseUrl = process.env.REACT_APP_GTAWORLD_OAUTH_BASE_URL || 'https://ucp-fr.gta.world';
    sessionStorage.setItem(GTAW_OAUTH_FLOW_KEY, JSON.stringify(flow));
    const redirectUri = encodeURIComponent(getGtawRedirectUri());
    return `${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
};
