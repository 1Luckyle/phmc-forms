// src/constants/agencyLogos.js
//
// Logos des institutions : les fichiers déjà présents dans le dépôt (src/assets) remplacent les liens imgBB enregistrés dans la base
// (adminSettings/agencies/{clé}/logo). Avantages : plus de dépendance à un hébergeur externe (plusieurs liens imgBB ne répondent plus :
// LSFD et SAN FIRE renvoient une image d'erreur, LSSD et SADCR sont introuvables) et affichage immédiat.
// Une agence absente de cette liste garde son logo de la base.
import lsdao from '../assets/lsdao.png';
import lsfd from '../assets/lsfd.png';
import lspd from '../assets/lspd.png';
import lssd from '../assets/lssd.png';
import lsgov from '../assets/lsgov.png';
import sadcr from '../assets/sadcr.png';
import sanfire from '../assets/sanfire.png';
import phmc from '../assets/phmc.png';
import phmcpaletobay from '../assets/phmcpaletobaylogo.png';

// Adresse publique des mêmes logos (copies dans public/img/agencies/{clé en minuscules}.png) : c'est celle que le BBCode doit contenir, car le fichier
// du dépôt (/static/media/…) n'a pas d'adresse utilisable sur un forum. Un logo ajouté ici doit aussi être copié dans public/img/agencies.
export const SITE_ORIGIN = 'https://phmc-tools.com';
export const publicAgencyLogoUrl = (key) => (LOCAL_AGENCY_LOGOS[key] ? `${SITE_ORIGIN}/img/agencies/${String(key).toLowerCase()}.png` : '');

export const LOCAL_AGENCY_LOGOS = {
    LSDAO: lsdao,
    LSFD: lsfd,
    LSPD: lspd,
    LSSD: lssd,
    LSGOV: lsgov,
    SADCR: sadcr,
    SANFIRE: sanfire,
    PHMC: phmc,
    PBC: phmcpaletobay,
};

// Agences de la base, avec le logo local quand il existe (le reste de chaque agence est inchangé).
export const withLocalAgencyLogos = (agencies) => {
    if (!agencies || typeof agencies !== 'object') return agencies;
    const result = {};
    Object.entries(agencies).forEach(([key, agency]) => {
        // `logo` = fichier du dépôt (affichage à l'écran) ; `forumLogo` = son adresse publique, utilisée dans le BBCode.
        result[key] = agency && LOCAL_AGENCY_LOGOS[key] ? { ...agency, logo: LOCAL_AGENCY_LOGOS[key], forumLogo: publicAgencyLogoUrl(key) } : agency;
    });
    return result;
};
