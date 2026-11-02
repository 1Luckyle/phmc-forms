// src/utils/siteUrl.js
//
// ADRESSE du site. Il est publié sur le domaine personnalisé https://phmc-tools.com (GitHub Pages, fichier public/CNAME) ; l'ancienne adresse
// https://1luckyle.github.io/phmc-forms/ redirige vers lui. Tout ce qui dépend de l'adresse (lien de réinitialisation de mot de passe, retour de la
// connexion GTA World, liens dans les messages) passe par ici : un seul endroit à changer si l'adresse change encore.
//
// ⚠ Changer l'adresse impose aussi : le domaine autorisé dans Firebase (Authentication → Paramètres → Domaines autorisés), l'URL de rappel
// (callback) enregistrée dans l'application OAuth de GTA World, les domaines de la clé reCAPTCHA (App Check) et les origines autorisées des
// fonctions (functions/index.js).
export const SITE_ORIGIN = 'https://phmc-tools.com';
export const SITE_URL = `${SITE_ORIGIN}/`;
// Ancienne adresse GitHub Pages (redirige vers SITE_URL) : encore reconnue pour les liens déjà diffusés.
export const LEGACY_SITE_URL = 'https://1luckyle.github.io/phmc-forms/';

export const isLocalHostname = (hostname = window.location.hostname) => (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')
);

// Racine de l'application : le site en ligne, ou le serveur local en développement (même chemin à la racine dans les deux cas).
export const getAppBase = () => (isLocalHostname() ? `${window.location.origin}/` : SITE_URL);
