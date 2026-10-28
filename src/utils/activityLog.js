// src/utils/activityLog.js
//
// Journal d'activité du site (RTDB : activityLogs/{id}), lu dans le panneau admin → « Journal d'activité ».
// Il remplace les anciennes notifications Discord : chaque action notable (rapport enregistré, candidature,
// paiement, action d'admin, demande, erreur…) y laisse UNE ligne, avec qui, quand, quoi et quelle gravité.
//
//   logActivity({ category: 'rapports', action: 'report_saved', summary: '…', details: '…', target: '…' })
//
// Écrire dans le journal ne doit JAMAIS gêner l'action de l'utilisateur : tout est « tire et oublie » et les
// échecs sont avalés. Un visiteur non connecté ne peut pas écrire (règles Firebase) : l'appel est alors ignoré.
import { ref, push, set } from 'firebase/database';
import { database, auth } from '../firebase';
import { ACTIVITY_CATEGORIES } from '../constants/activityCategories';

const clip = (value, max) => {
    const text = String(value ?? '').trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

// Identité de la personne qui agit, tenue à jour par EmployeeAuthProvider (voir setActivityActor).
let currentActor = null;
export const setActivityActor = (actor) => { currentActor = actor; };
export const getActivityActorName = () => currentActor?.name || '';

const hostLabel = () => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.')) return 'local';
    if (host.endsWith('github.io')) return 'github-pages';
    return host.slice(0, 40);
};

export const logActivity = ({ category = 'divers', action, summary, details, severity = 'info', target, actor } = {}) => {
    try {
        const user = auth.currentUser;
        if (!user || !summary) return Promise.resolve(false);
        const by = {
            uid: user.uid,
            name: clip(actor?.name || currentActor?.name || user.email || 'Inconnu', 120),
            role: clip(actor?.role || currentActor?.role || '', 80),
            admin: !!(actor?.admin ?? currentActor?.admin),
        };
        const email = actor?.email || currentActor?.email || user.email;
        if (email) by.email = clip(email, 120);
        const entry = {
            ts: Date.now(),
            cat: ACTIVITY_CATEGORIES[category] ? category : 'divers',
            act: clip(action || summary, 80),
            msg: clip(summary, 400),
            sev: ['info', 'success', 'warning', 'error'].includes(severity) ? severity : 'info',
            by,
            src: 'web',
            env: hostLabel(),
        };
        if (details) entry.det = clip(details, 3000);
        if (target) entry.tgt = clip(target, 160);
        return set(push(ref(database, 'activityLogs')), entry).then(() => true).catch((error) => {
            console.warn('Journal d\'activité : écriture impossible.', error?.message || error);
            return false;
        });
    } catch (error) {
        console.warn('Journal d\'activité : écriture impossible.', error?.message || error);
        return Promise.resolve(false);
    }
};

// ── Actions d'administration / de recrutement ───────────────────────────────────────────────────────────────
// Les écrans appellent sendAdminActionWebhook(email, action, details, categoryName, …) : on y branche le journal.
// La catégorie est déduite du libellé de l'action ; l'ouverture/fermeture de fenêtres n'est pas journalisée (bruit).
const NOISE = /^(ouverture|fermeture) /i;
const categorizeAdminAction = (action, actorLabel) => {
    const text = String(action || '').toLowerCase();
    if (/connexion|déconnexion/.test(text)) return 'auth';
    if (/contrat/.test(text)) return 'contrats';
    if (/candidat|recrut|poste|en attente de contrat/.test(text) || /recruteur/i.test(actorLabel || '')) return 'recrutement';
    if (/bingo|phrase/.test(text)) return 'bingo';
    if (/personnel|civil|fiche|membre|rôle|role|compte|utilisateur|migration|badge/.test(text)) return 'comptes';
    return 'admin';
};

export const logAdminAction = ({ email, action, details, categoryName, actorLabel = 'Admin' }) => {
    if (!action || NOISE.test(action)) return Promise.resolve(false);
    const failed = /échec|refusée|erreur/i.test(action);
    return logActivity({
        category: categorizeAdminAction(action, actorLabel),
        action,
        summary: `${action}${categoryName ? ` — ${categoryName}` : ''}`,
        details,
        severity: failed ? 'warning' : 'info',
        target: categoryName || undefined,
        actor: { email: email || undefined, name: undefined, role: actorLabel },
    });
};

// ── Erreurs non gérées ─────────────────────────────────────────────────────────────────────────────────────
// Limité à quelques lignes par minute et dédupliqué : une boucle d'erreurs ne doit pas remplir la base.
const recentErrors = new Map();
let errorBudget = 20;
export const logClientError = ({ message, source, lineno, stack, isButtonClickError }) => {
    if (/ResizeObserver loop (limit exceeded|completed with undelivered notifications)/.test(String(message || ''))) return Promise.resolve(false); // avertissement inoffensif du navigateur
    const key = String(message || '').slice(0, 120);
    const now = Date.now();
    if (errorBudget <= 0 || (recentErrors.get(key) || 0) > now - 60000) return Promise.resolve(false);
    recentErrors.set(key, now);
    errorBudget -= 1;
    const page = `${window.location.pathname}${window.location.hash || ''}`;
    return logActivity({
        category: 'erreurs',
        action: isButtonClickError ? 'button_click_error' : 'unhandled_error',
        summary: clip(message || 'Erreur inconnue', 300),
        details: [`Page : ${page}`, source ? `Fichier : ${source}${lineno ? `:${lineno}` : ''}` : '', `Navigateur : ${navigator.userAgent}`, stack ? `Pile :\n${clip(stack, 1500)}` : '']
            .filter(Boolean).join('\n'),
        severity: 'error',
    });
};
