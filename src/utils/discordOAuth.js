// src/utils/discordOAuth.js
//
// Connexion DISCORD de la version classique du site (voir constants/siteMode.js et functions/discordCore.js).
//   1. buildDiscordAuthUrl(flow) mémorise le parcours en cours ({ type: 'onboarding' | 'login', userType? }) avec un « state » aléatoire, puis
//      renvoie l'adresse d'autorisation Discord (portée « identify » seulement : ni adresse mail, ni serveurs).
//   2. Discord renvoie sur la RACINE du site (https://phmc-tools.com/?code=…&state=…), seule forme d'adresse acceptée par Discord (pas de « # »).
//      captureDiscordRedirect(), appelée au tout début du chargement (src/index.js), transforme cette adresse en route #/auth/discord/callback.
//   3. DiscordCallback vérifie le state, échange le code (Cloud Function discordExchange) et range le résultat pour le guide ou la connexion.
// L'identifiant client Discord est public (REACT_APP_DISCORD_CLIENT_ID) ; le secret reste côté serveur (Secret Manager).
import { getAppBase } from './siteUrl';

export const DISCORD_FLOW_KEY = 'discord-oauth-flow';
// Résultat de l'échange, lu par le guide de configuration (DiscordAccountPanel) : { flow, ticket, expiresAt, discordUsername, characters }.
export const DISCORD_RESULT_KEY = 'discord-auth-result';
// Guide à rouvrir après le retour de Discord ({ userType }) : lu par MainApp et OnboardingModal.
export const DISCORD_ONBOARDING_KEY = 'discord-onboarding-pending';
// Connexion depuis « Se connecter » : { choices } (plusieurs comptes), { notLinked } ou { error }, lu par MainApp.
export const DISCORD_LOGIN_RESULT_KEY = 'discord-login-result';

const STATE_PREFIX = 'dc_';
const FUNCTIONS_BASE = 'https://europe-west1-phmcfr-forms.cloudfunctions.net';
export const DISCORD_URLS = {
    exchange: `${FUNCTIONS_BASE}/discordExchange`,
    createCivil: `${FUNCTIONS_BASE}/discordCreateCivil`,
    requestStaff: `${FUNCTIONS_BASE}/discordRequestStaff`,
    approveStaff: `${FUNCTIONS_BASE}/discordApproveStaff`,
};

// Doit être EXACTEMENT une des adresses de retour enregistrées dans l'application Discord : https://phmc-tools.com/ et http://localhost:3000/.
export const getDiscordRedirectUri = () => getAppBase();

const randomState = () => {
    const bytes = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return STATE_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const buildDiscordAuthUrl = (flow) => {
    const clientId = process.env.REACT_APP_DISCORD_CLIENT_ID || '';
    if (!clientId) throw new Error('La connexion Discord n\'est pas configurée (identifiant client manquant).');
    const state = randomState();
    sessionStorage.setItem(DISCORD_FLOW_KEY, JSON.stringify({ ...flow, state }));
    const params = new URLSearchParams({ response_type: 'code', client_id: clientId, scope: 'identify', redirect_uri: getDiscordRedirectUri(), state });
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
};

// Retour de Discord sur la racine du site : passe les paramètres à la route du callback (HashRouter), sans recharger la page.
export const captureDiscordRedirect = (location = window.location, history = window.history) => {
    try {
        const params = new URLSearchParams(location.search || '');
        const state = params.get('state') || '';
        if (!state.startsWith(STATE_PREFIX) || (!params.has('code') && !params.has('error'))) return false;
        history.replaceState(null, '', `${location.pathname}#/auth/discord/callback?${params.toString()}`);
        return true;
    } catch (error) {
        return false;
    }
};

// Parcours mémorisé, vérifié contre le state reçu (protection contre un retour forgé). Consommé une seule fois.
export const takeDiscordFlow = (receivedState) => {
    let flow = null;
    try {
        flow = JSON.parse(sessionStorage.getItem(DISCORD_FLOW_KEY) || 'null');
        sessionStorage.removeItem(DISCORD_FLOW_KEY);
    } catch (error) { flow = null; }
    if (!flow || !flow.state || flow.state !== receivedState) return null;
    return flow;
};

export const postJson = async (url, body, idToken = null) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify(body),
    });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch (error) { data = { message: `Réponse invalide du serveur (${response.status}).` }; }
    if (!response.ok) {
        const error = new Error(data.message || data.error || 'Erreur du serveur.');
        error.code = data.error;
        error.status = response.status;
        throw error;
    }
    return data;
};

export const readDiscordResult = () => {
    try { return JSON.parse(sessionStorage.getItem(DISCORD_RESULT_KEY) || 'null'); } catch (error) { return null; }
};
export const clearDiscordResult = () => { try { sessionStorage.removeItem(DISCORD_RESULT_KEY); } catch (error) { /* */ } };
// Le ticket expire au bout de 30 minutes : passé ce délai, il faut repasser par Discord.
export const isDiscordResultFresh = (result) => !!(result && result.ticket && Number(result.expiresAt) > Date.now() + 30 * 1000);
