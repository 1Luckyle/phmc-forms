// src/utils/temporaryIds.js
//
// IDENTIFIANTS TEMPORAIRES des défunts du DMEC. Beaucoup de rapports de médecine légale n'ont pas d'ID patient (corps non identifié, joueur sans dossier) : sans ID, rien ne les relie entre eux ni à un dossier.
// Le DMEC donne alors à la personne un ID temporaire « TMP-XXXXX » : il se saisit dans le champ « ID patient » et fonctionne comme un vrai ID (index des dossiers, titres, blocage du dossier).
// Plusieurs rapports portent le même ID temporaire = la même personne. Quand l'ID réel est connu (ou que la personne ouvre son compte), un ADMINISTRATEUR attribue l'ID réel : tous les rapports sont transférés
// sur l'ID réel (assignTemporaryId) et l'ID temporaire reste dans le registre comme alias (statut « attribue »).
// Registre : identifiantsTemporaires/{TMP-XXXXX} (règles : database.rules.json).
import { ref, get, set, update, remove } from 'firebase/database';
import { database, auth } from '../firebase';
import { canonicalPatientId } from './patientId';
import { findPatientNodes } from './patientRecords';
import { loadFreeze, isFrozen } from './judicialFreeze';
import { logActivity } from './activityLog';
import { notifyGroup } from './notifications';

export const TEMP_PREFIX = 'TMP-';
// Sans les caractères ambigus (0/O, 1/I) : l'ID se dicte ou se recopie à la main.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ALPHABET = `${LETTERS}23456789`;
const TEMP_ID = /^TMP-[A-Z2-9]{5}$/;
// Au moins DEUX lettres dans le suffixe : « TMP-99999 » ne peut jamais se confondre avec « PHMC-99999 ».
export const MIN_TEMP_LETTERS = 2;

export const isTemporaryId = (value) => {
    const id = canonicalPatientId(value);
    return TEMP_ID.test(id) && (id.slice(TEMP_PREFIX.length).match(/[A-Z]/g) || []).length >= MIN_TEMP_LETTERS;
};

export const generateTemporaryId = (random = Math.random) => {
    const pick = (alphabet) => alphabet[Math.floor(random() * alphabet.length)];
    // Deux lettres garanties, le reste au hasard, puis mélange : jamais de tirage à refaire.
    const chars = [pick(LETTERS), pick(LETTERS), pick(ALPHABET), pick(ALPHABET), pick(ALPHABET)];
    for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return `${TEMP_PREFIX}${chars.join('')}`;
};

// ───────────── Noms : retrouver la même personne ─────────────
const words = (name) => String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
export const nameKey = (name) => [...new Set(words(name))].sort().join(' ');

/** ID temporaires encore ouverts dont le nom correspond : mêmes mots (dans n'importe quel ordre), ou tous les mots du nom le plus court (deux au moins) retrouvés dans l'autre. [{ id, nom, creeLe }], les plus récents d'abord. */
export const findTemporaryIdsByName = (registry = {}, name = '') => {
    const wanted = new Set(words(name));
    if (!wanted.size) return [];
    return Object.entries(registry || {})
        .filter(([, entry]) => entry && entry.statut !== 'attribue' && entry.nom)
        .filter(([, entry]) => {
            const other = new Set(words(entry.nom));
            if (!other.size) return false;
            const [small, large] = wanted.size <= other.size ? [wanted, other] : [other, wanted];
            const contained = [...small].every((word) => large.has(word));
            return contained && (small.size === large.size || small.size >= 2);
        })
        .map(([id, entry]) => ({ id, nom: entry.nom, creeLe: Number(entry.creeLe) || 0 }))
        .sort((a, b) => b.creeLe - a.creeLe);
};

// ───────────── Transfert vers l'ID réel (pur) ─────────────
const replaceAll = (text, from, to) => (typeof text === 'string' && text.includes(from) ? text.split(from).join(to) : text);

/**
 * Écritures à faire pour passer les rapports d'un ID temporaire à l'ID réel (à appliquer en une mise à jour).
 * items : [{ indexKey, entry, reportPath, report }] (entrée d'index et rapport lu). Retourne { updates, moved } ; une entrée sans rapport lisible est tout de même déplacée dans l'index.
 */
export const buildTransferUpdates = ({ tempId, realId, items = [] }) => {
    const updates = {};
    let moved = 0;
    items.forEach(({ indexKey, entry, reportPath, report }) => {
        if (!indexKey || !entry) return;
        const next = { ...entry };
        ['title', 'originalKey'].forEach((field) => { if (typeof next[field] === 'string') next[field] = replaceAll(next[field], tempId, realId); });
        Object.keys(next).forEach((field) => { if (next[field] === undefined) delete next[field]; });
        updates[`patientRecords/${realId}/${indexKey}`] = next;
        updates[`patientRecords/${tempId}/${indexKey}`] = null;
        if (reportPath && report) {
            updates[`${reportPath}/data/patientID`] = realId;
            ['title', 'originalKey', 'bbCode'].forEach((field) => { if (typeof report[field] === 'string' && report[field].includes(tempId)) updates[`${reportPath}/${field}`] = replaceAll(report[field], tempId, realId); });
        }
        moved += 1;
    });
    return { updates, moved };
};

// ───────────── Registre (Firebase) ─────────────
export async function loadTemporaryIds() {
    const snap = await get(ref(database, 'identifiantsTemporaires'));
    return snap.exists() ? snap.val() : {};
}

/** Enregistre un nouvel ID temporaire pour `nom` et le retourne. Jamais d'écrasement (la base refuse) : en cas de collision on tire un autre identifiant. */
export async function registerTemporaryId({ nom, byName = '' }) {
    const user = auth.currentUser;
    if (!user) throw new Error('Connexion requise pour créer un identifiant temporaire.');
    let lastError = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const id = generateTemporaryId();
        try {
            const existing = await get(ref(database, `identifiantsTemporaires/${id}`));
            if (existing.exists()) continue;
            await set(ref(database, `identifiantsTemporaires/${id}`), {
                nom: String(nom || '').trim().slice(0, 160) || 'Inconnu(e)', nomCle: nameKey(nom), creeLe: Date.now(), uid: user.uid, par: String(byName || '').slice(0, 120), statut: 'temporaire',
            });
            logActivity({ category: 'rapports', action: 'temp_id_created', severity: 'info', summary: `ID temporaire créé : ${id}`, details: `Nom : ${nom || 'Inconnu(e)'}\nPar : ${byName || '—'}`, target: id });
            return id;
        } catch (error) { lastError = error; }
    }
    throw lastError || new Error("Impossible de créer l'identifiant temporaire.");
}

/** Alias d'un ID temporaire déjà attribué : { statut, idReel } ou null (inconnu, ou lecture impossible). */
export async function loadTemporaryIdAlias(id) {
    if (!isTemporaryId(id)) return null;
    try {
        const snap = await get(ref(database, `identifiantsTemporaires/${canonicalPatientId(id)}`));
        return snap.exists() ? snap.val() : null;
    } catch (error) { return null; }
}

/** Un membre du DMEC connaît l'ID réel : seul un admin peut transférer les rapports, il est donc prévenu. */
export const requestRealIdAssignment = async ({ tempId, realId, byName }) => notifyGroup('admin', {
    type: 'demande', titre: `${byName || 'Le DMEC'} demande l'attribution d'un ID réel`,
    texte: `${canonicalPatientId(tempId)} → ${canonicalPatientId(realId)} : à transférer depuis le panneau admin (Utilisateurs → Décès et identifiants temporaires).`, lien: { cible: 'admin', section: 'users' },
});

const chunk = (entries, size) => { const out = []; for (let i = 0; i < entries.length; i += size) out.push(entries.slice(i, i + size)); return out; };

/**
 * Attribue l'ID réel à un ID temporaire (ADMIN) : transfère tous les rapports (index des dossiers, ID dans les rapports, titres, BBCode), le marqueur « patient décédé » et les rapports publics, puis
 * marque l'ID temporaire comme attribué. Un rapport sous gel judiciaire n'est pas touché (il est listé dans `frozen`). → { moved, frozen: [clés], publics, deathMarker }
 */
export async function assignTemporaryId({ tempId, realId, byName = '' }) {
    const temp = canonicalPatientId(tempId);
    const real = canonicalPatientId(realId);
    if (!isTemporaryId(temp)) throw new Error("Ce n'est pas un identifiant temporaire (TMP-XXXXX).");
    if (!real || isTemporaryId(real)) throw new Error("L'ID réel doit être un ID patient (ex. PHMC-2752).");
    if (temp === real) throw new Error("L'ID réel doit être différent de l'ID temporaire.");

    const items = [];
    const frozen = [];
    for (const node of await findPatientNodes(temp)) {
        const snap = await get(ref(database, `patientRecords/${node}`));
        for (const [indexKey, entry] of Object.entries(snap.val() || {})) {
            if (!entry) continue;
            if (entry.reportPath && isFrozen(await loadFreeze(entry.reportPath))) { frozen.push(indexKey); continue; }
            let report = null;
            if (entry.reportPath) { try { const reportSnap = await get(ref(database, entry.reportPath)); report = reportSnap.exists() ? reportSnap.val() : null; } catch (error) { report = null; } }
            items.push({ indexKey, entry, reportPath: report ? entry.reportPath : '', report });
        }
    }
    const { updates, moved } = buildTransferUpdates({ tempId: temp, realId: real, items });
    for (const part of chunk(Object.entries(updates), 150)) await update(ref(database), Object.fromEntries(part));

    // Patient déclaré décédé sous l'ID temporaire : le marqueur passe sur l'ID réel (le premier marqueur de l'ID réel est conservé).
    let deathMarker = false;
    const marker = await get(ref(database, `patientsDecedes/${temp}`));
    if (marker.exists()) {
        const realMarker = await get(ref(database, `patientsDecedes/${real}`));
        if (!realMarker.exists()) { await set(ref(database, `patientsDecedes/${real}`), marker.val()); deathMarker = true; }
        await remove(ref(database, `patientsDecedes/${temp}`));
    }
    // Rapports publics publiés avec cet ID.
    let publics = 0;
    const published = await get(ref(database, 'rapportsPublics'));
    const publicUpdates = {};
    Object.entries(published.val() || {}).forEach(([key, value]) => { if (value && canonicalPatientId(value.patientID) === temp) { publicUpdates[`rapportsPublics/${key}/patientID`] = real; publics += 1; } });
    if (publics) await update(ref(database), publicUpdates);

    await update(ref(database, `identifiantsTemporaires/${temp}`), { statut: 'attribue', idReel: real, attribueLe: Date.now(), attribuePar: String(byName || '').slice(0, 120) });
    logActivity({
        category: 'rapports', action: 'temp_id_assigned', severity: 'warning', summary: `ID temporaire ${temp} attribué à ${real}`,
        details: `Rapports transférés : ${moved}${frozen.length ? `\nIgnorés (gel judiciaire) : ${frozen.length}` : ''}\nPar : ${byName || 'admin'}`, target: real,
    });
    return { moved, frozen, publics, deathMarker };
}

/**
 * Recherche par ID : un ID temporaire déjà attribué renvoie à l'ID réel (ses rapports y ont été transférés), pour qu'un ancien ID, retrouvé dans un titre ou un message, mène toujours au bon dossier.
 * → { id: ID à consulter, from: l'ID temporaire d'origine ou '' }
 */
export async function resolvePatientIdAlias(input) {
    const id = canonicalPatientId(input);
    if (!isTemporaryId(id)) return { id, from: '' };
    const alias = await loadTemporaryIdAlias(id);
    if (alias && alias.statut === 'attribue' && alias.idReel) return { id: canonicalPatientId(alias.idReel), from: id };
    return { id, from: '' };
}
