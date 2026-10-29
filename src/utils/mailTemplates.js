// src/utils/mailTemplates.js
//
// Mails du système : modèles modifiables par les admins (Panneau admin → E-mails). Le catalogue, le texte par défaut et le moteur de rendu sont dans
// mailTemplatesCore.js (partagé avec les Cloud Functions). Les modifications sont stockées dans adminSettings/mailTemplates/{id} = { subject, body,
// majLe, majPar } (lecture publique : un compte Civil qui s'envoie son accusé de réception doit pouvoir les lire ; écriture admin).
import { ref, get, set, remove } from 'firebase/database';
import { database } from '../firebase';
import { renderMail, validateTemplate, MAIL_TEMPLATES } from './mailTemplatesCore';
import { sendEyefindMail } from './eyefindMail';

export * from './mailTemplatesCore';
export const MAIL_TEMPLATES_PATH = 'adminSettings/mailTemplates';

const CACHE_MS = 5 * 60 * 1000;
let cache = null;
let cachedAt = 0;

// Modèles modifiés : { [id]: { subject, body, majLe, majPar } }. Ne lève jamais (lecture impossible = texte par défaut).
export const loadMailOverrides = async ({ force = false } = {}) => {
    if (!force && cache && Date.now() - cachedAt < CACHE_MS) return cache;
    try {
        const snapshot = await get(ref(database, MAIL_TEMPLATES_PATH));
        const raw = snapshot.exists() ? snapshot.val() : {};
        cache = Object.fromEntries(Object.entries(raw || {}).filter(([id, entry]) => MAIL_TEMPLATES[id] && entry && typeof entry === 'object'));
        cachedAt = Date.now();
    } catch (error) {
        console.warn('Modèles de mail illisibles, texte par défaut utilisé :', error?.message || error);
        cache = cache || {};
        cachedAt = Date.now();
    }
    return cache;
};

export const saveMailTemplate = async (id, { subject, body }, byName = '') => {
    if (!MAIL_TEMPLATES[id]) throw new Error('Modèle inconnu.');
    const errors = validateTemplate(id, { subject, body });
    if (errors.length > 0) throw new Error(errors.join(' '));
    await set(ref(database, `${MAIL_TEMPLATES_PATH}/${id}`), {
        subject: String(subject || '').trim(), body: String(body).replace(/\r\n/g, '\n').trim(), majLe: Date.now(), majPar: String(byName || '').slice(0, 120),
    });
    cache = null;
};

export const resetMailTemplate = async (id) => {
    if (!MAIL_TEMPLATES[id]) throw new Error('Modèle inconnu.');
    await remove(ref(database, `${MAIL_TEMPLATES_PATH}/${id}`));
    cache = null;
};

// Compose un mail à partir d'un modèle (texte modifié s'il existe). Retourne { subject, body, html }.
export const composeMail = async (id, vars) => renderMail(id, vars, await loadMailOverrides());

// Compose puis envoie. Ne lève jamais : un mail raté ne doit pas faire échouer l'action qui l'a déclenché. Retourne { ok, error?, message? }.
export const sendTemplatedMail = async (id, { to, vars }) => {
    try {
        if (!to) return { ok: false, error: 'invalid-argument', message: 'Aucune adresse de destination.' };
        const mail = await composeMail(id, vars);
        const result = await sendEyefindMail({ to, ...mail });
        if (!result.ok) console.warn(`Mail « ${id} » non envoyé :`, result.error, result.message);
        return result;
    } catch (error) {
        console.warn(`Mail « ${id} » non envoyé :`, error?.message || error);
        return { ok: false, error: 'compose-failed', message: error?.message || String(error) };
    }
};
