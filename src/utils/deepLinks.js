// src/utils/deepLinks.js
//
// LIENS DIRECTS « façon Discord » (copier le lien, l'envoyer, et il ouvre directement la bonne chose), en plus des liens de rapports
// (utils/reportLinks.js : #/rapport/{nœud}/{clé}). Le site utilise un routeur à « # » : le lien n'est jamais envoyé au serveur.
//
//   #/message/{id du message}              → la messagerie interne, sur ce message (réservé à ses participants : les règles Firebase décident)
//   #/poste/{catégorie}/{clé du poste}     → le formulaire de candidature de la catégorie, déjà réglé sur ce poste
//   #/candidature/{uid candidat}/{id}      → cette candidature : « Mon dossier candidat » pour son auteur, la gestion du recrutement pour le recrutement
//
// Pas connecté : on demande de se connecter, puis le lien se rouvre tout seul (voir rememberPendingReportLink, partagé avec les rapports).
import { CATEGORY_BY_KEY } from '../constants/recruitment';

// Ce que Firebase interdit dans une clé : . # $ / [ ]. Les espaces et accents sont permis (la clé d'un poste est son nom).
const FIREBASE_SEGMENT = /^[^.#$/[\]]+$/;
const hasControlChar = (text) => Array.from(text).some((char) => char.charCodeAt(0) < 32);
const MAX_SEGMENT = 200;

const safe = (value) => {
    const text = String(value ?? '');
    return text.length > 0 && text.length <= MAX_SEGMENT && FIREBASE_SEGMENT.test(text) && !hasControlChar(text) ? text : '';
};

const currentBase = () => (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');

/** Chemin du routeur d'un lien ; '' si l'un des morceaux est invalide. */
export const messageLinkPath = (id) => { const s = safe(id); return s ? `/message/${encodeURIComponent(s)}` : ''; };
export const posteLinkPath = (categoryKey, posteKey) => {
    const c = safe(categoryKey);
    const p = safe(posteKey);
    return c && p && CATEGORY_BY_KEY[c] ? `/poste/${encodeURIComponent(c)}/${encodeURIComponent(p)}` : '';
};
export const candidatureLinkPath = (uid, id) => { const u = safe(uid); const i = safe(id); return u && i ? `/candidature/${encodeURIComponent(u)}/${encodeURIComponent(i)}` : ''; };

/** Adresse complète à copier ; '' si le chemin est vide. */
export const linkUrlOf = (path, base = currentBase()) => (path ? `${base}#${path}` : '');
export const messageLinkUrl = (id, base) => linkUrlOf(messageLinkPath(id), base);
export const posteLinkUrl = (categoryKey, posteKey, base) => linkUrlOf(posteLinkPath(categoryKey, posteKey), base);
export const candidatureLinkUrl = (uid, id, base) => linkUrlOf(candidatureLinkPath(uid, id), base);

/**
 * Cible d'un lien d'après les paramètres de l'adresse (ou null si invalides) :
 *   { cible: 'message', id } | { cible: 'poste', categorie, cle } | { cible: 'candidature', uid, id }
 */
export const parseDeepLink = (kind, params = {}) => {
    if (kind === 'message') { const id = safe(params.id); return id ? { cible: 'message', id } : null; }
    if (kind === 'poste') {
        const categorie = safe(params.category);
        const cle = safe(params.key);
        return categorie && cle && CATEGORY_BY_KEY[categorie] ? { cible: 'poste', categorie, cle } : null;
    }
    if (kind === 'candidature') { const uid = safe(params.uid); const id = safe(params.id); return uid && id ? { cible: 'candidature', uid, id } : null; }
    return null;
};

/** Chemin du routeur d'une cible (l'inverse de parseDeepLink) : sert à mémoriser le lien en attente de connexion. */
export const deepLinkPathOf = (target) => {
    if (!target) return '';
    if (target.cible === 'message') return messageLinkPath(target.id);
    if (target.cible === 'poste') return posteLinkPath(target.categorie, target.cle);
    if (target.cible === 'candidature') return candidatureLinkPath(target.uid, target.id);
    return '';
};

export const DEEP_LINK_LABELS = { message: 'ce message', poste: 'ce poste', candidature: 'cette candidature' };
