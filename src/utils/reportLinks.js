// src/utils/reportLinks.js
//
// LIENS DIRECTS vers un rapport enregistré, à partager comme le lien d'un message Discord : https://…/#/rapport/{nœud de l'auteur}/{clé du rapport}.
// Le site utilise un routeur à « # » : le lien n'est jamais envoyé au serveur, il fonctionne tel quel sur l'hébergement. Qui l'ouvre voit le rapport s'il y a droit (les règles Firebase décident :
// on lit simplement le rapport) ; sinon un message l'indique. Non connecté : on lui demande de se connecter, puis le lien se rouvre tout seul (voir rememberPendingReportLink).
const SAFE_SEGMENT = /^[^.#$/[\]\s]+$/;
const REPORT_PATH = /^savedReports\/([^/]+)\/([^/]+)$/;
const PENDING_KEY = 'pendingReportLink';

/** « savedReports/Dr_Test/-Nabc » → « /rapport/Dr_Test/-Nabc » (chemin du routeur) ; '' si ce n'est pas un chemin de rapport. */
export const reportLinkPath = (reportPath) => {
    const match = REPORT_PATH.exec(String(reportPath || ''));
    return match && SAFE_SEGMENT.test(match[1]) && SAFE_SEGMENT.test(match[2]) ? `/rapport/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}` : '';
};

const currentBase = () => (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');

/** Lien complet à copier ; '' si le rapport n'a pas de chemin exploitable. */
export const reportLinkUrl = (reportPath, base = currentBase()) => {
    const path = reportLinkPath(reportPath);
    return path ? `${base}#${path}` : '';
};

/** Chemin Firebase d'un rapport d'après les paramètres de l'adresse ; '' si l'un d'eux est invalide. */
export const reportPathFromParams = (node, key) => {
    const n = String(node || '');
    const k = String(key || '');
    return SAFE_SEGMENT.test(n) && SAFE_SEGMENT.test(k) ? `savedReports/${n}/${k}` : '';
};

/** Rapport vers lequel pointer : l'ORIGINAL pour une copie (les copies sont privées à leur médecin), sinon le rapport lui-même. */
export const linkTargetOf = (report) => {
    if (!report) return '';
    return (report.isCopy || report.copiedFrom) && report.copiedFrom && report.copiedFrom.reportPath ? report.copiedFrom.reportPath : report.reportPath || '';
};

// Lien en attente de connexion : conservé dans l'onglet jusqu'à la connexion (y compris à travers la redirection GTA World).
const PENDING_MAX_AGE_MS = 30 * 60 * 1000;
export const rememberPendingReportLink = (path, now = Date.now()) => { try { if (path) sessionStorage.setItem(PENDING_KEY, `${now}|${path}`); } catch (error) { /* stockage indisponible */ } };
export const peekPendingReportLink = (now = Date.now()) => {
    try {
        const [stamp, ...rest] = String(sessionStorage.getItem(PENDING_KEY) || '').split('|');
        const path = rest.join('|');
        return path && now - Number(stamp) < PENDING_MAX_AGE_MS && /^\/rapport\//.test(path) ? path : '';
    } catch (error) { return ''; }
};
export const clearPendingReportLink = () => { try { sessionStorage.removeItem(PENDING_KEY); } catch (error) { /* rien à faire */ } };
