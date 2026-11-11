// src/utils/deathSignals.js
//
// DÉCÈS SIGNALÉS : quand un rapport de soins (protocole d'urgence, opération) indique que le patient est décédé, une petite fiche est posée pour le DMEC (decesSignales/{clé du rapport de soins}).
// Le DMEC ne peut pas lire les rapports de soins (cloisonnement soignants / DMEC) : la fiche lui donne l'essentiel (identité, ID, date et heure, cause, nature, réanimation, destination du corps), jamais le
// rapport médical. Il en tire son « Services de Médecine Légale » prérempli ; l'enregistrer marque la fiche « traitée » (le lien repose sur la clé de la fiche, pas sur l'ID).
// La fiche suit le rapport de soins : corrigée quand on le corrige, retirée quand on le supprime ou qu'on décoche le décès (tant qu'elle n'est pas traitée).
import { ref, get, set, update, remove, query, orderByChild, equalTo } from 'firebase/database';
import { database, auth } from '../firebase';
import { canonicalPatientId } from './patientId';
import { DEATH_VERSIONS, DEATH_MANNERS, DEATH_RESUSCITATION, DEATH_FAMILY, DEATH_BODY, labelOf } from '../constants/careFormOptions';
import { notifyUser } from './notifications';

const clip = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const KIND_OF_VERSION = { 5: 'chirurgie', 19: 'urgence' };
export const DEATH_SIGNAL_KINDS = { urgence: "Protocole d'urgence", chirurgie: 'Opération chirurgicale' };

/** Fiche à poser pour ce rapport de soins ; null si le patient n'est pas décédé, si le formulaire n'est pas concerné ou si l'ID patient manque. */
export const buildDeathSignal = ({ version, formData = {}, authorName = '', uid = '', now = Date.now() }) => {
    const number = Number(version);
    const patientID = canonicalPatientId(formData.patientID);
    if (!DEATH_VERSIONS.includes(number) || formData.careDeceased !== 'Yes' || !patientID) return null;
    const date = /^\d{4}-\d{2}-\d{2}/.test(String(formData.date || '')) ? String(formData.date).slice(0, 10) : '';
    const time = /^\d{1,2}:\d{2}$/.test(String(formData.careDeathTime || '')) ? String(formData.careDeathTime) : '';
    const fields = {
        patientID,
        patientName: clip(formData.patientName, 160),
        prenom: clip(formData.patientFirstName, 80), deuxiemePrenom: clip(formData.patientMiddleName, 80), nom: clip(formData.patientLastName, 80),
        dateNaissance: clip(formData.patientDateOfBirth, 10),
        kind: KIND_OF_VERSION[number],
        date, heure: time,
        cause: clip(formData.careDeathCause, 500), nature: clip(formData.careDeathManner, 30), reanimation: clip(formData.careDeathResuscitation, 30),
        famille: clip(formData.careDeathFamily, 30), destination: clip(formData.careDeathBody, 30),
        par: clip(authorName || formData.phmcEmployee, 120) || 'Un soignant', uid: String(uid || ''), creeLe: now, statut: 'a_traiter',
    };
    return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== '' && value !== undefined));
};

/** Valeurs à poser dans « Services de Médecine Légale » (v1) d'après une fiche. */
export const deathSignalToDmecForm = (signal = {}) => {
    const details = [
        signal.cause ? `Cause signalée : ${signal.cause}` : '',
        signal.reanimation ? `Réanimation : ${labelOf(DEATH_RESUSCITATION, signal.reanimation)}.` : '',
        signal.destination ? `Destination du corps : ${labelOf(DEATH_BODY, signal.destination)}.` : '',
    ].filter(Boolean).join('\n');
    const values = {
        patientID: signal.patientID || '',
        decedentFirstName: signal.prenom || '', decedentMiddleName: signal.deuxiemePrenom || '', decedentLastName: signal.nom || '',
        dateTime: signal.date ? `${signal.date}T${/^\d{1,2}:\d{2}$/.test(signal.heure || '') ? String(signal.heure).padStart(5, '0') : '00:00'}` : '',
        pronouncedTimeOfDeath: signal.heure ? String(signal.heure).padStart(5, '0') : '',
        probableCauseOfDeath: signal.cause || '',
        mannerOfDeath: signal.nature ? labelOf(DEATH_MANNERS, signal.nature) : '',
        synopsis: `Décès constaté lors d'un ${(DEATH_SIGNAL_KINDS[signal.kind] || 'rapport de soins').toLowerCase()} (déclaré par ${signal.par || 'un soignant'}).${details ? `\n${details}` : ''}`,
    };
    return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''));
};

/** Ligne de résumé d'une fiche, pour une liste ou un bandeau. */
export const deathSignalSummary = (signal = {}) => {
    const when = [String(signal.date || '').split('-').reverse().join('/'), signal.heure].filter(Boolean).join(' à ');
    return `${signal.patientName || signal.patientID || 'Patient'}${signal.patientID ? ` (${signal.patientID})` : ''} — ${DEATH_SIGNAL_KINDS[signal.kind] || 'Rapport de soins'}${when ? `, ${when}` : ''}`;
};
export const deathSignalFamilyLabel = (value) => labelOf(DEATH_FAMILY, value);

// ───────────── Firebase ─────────────
const signalRef = (key) => ref(database, `decesSignales/${key}`);

export const publishDeathSignal = async (key, signal) => { if (key && signal) await set(signalRef(key), signal); return !!(key && signal); };

/** Retire la fiche d'un rapport de soins tant qu'elle est à traiter ; true si elle a été retirée. Silencieux en cas de refus (déjà traitée, pas la sienne). */
export async function retractDeathSignal(key) {
    if (!key) return false;
    try {
        const snap = await get(signalRef(key));
        if (!snap.exists() || (snap.val() || {}).statut !== 'a_traiter') return false;
        await remove(signalRef(key));
        return true;
    } catch (error) { return false; }
}

export async function loadDeathSignals() {
    const snap = await get(ref(database, 'decesSignales'));
    return Object.entries(snap.val() || {}).map(([key, value]) => ({ key, ...value })).sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));
}

export async function loadDeathSignalsFor(patientID) {
    const id = canonicalPatientId(patientID);
    if (!id) return [];
    try {
        const snap = await get(query(ref(database, 'decesSignales'), orderByChild('patientID'), equalTo(id)));
        return Object.entries(snap.val() || {}).map(([key, value]) => ({ key, ...value })).sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));
    } catch (error) { return []; }
}

export const markDeathSignalTreated = (key, { reportPath = '', byName = '' } = {}) => update(signalRef(key), {
    statut: 'traite', traiteLe: Date.now(), traitePar: clip(byName, 120), ...(reportPath ? { rapportDmec: reportPath } : {}),
});

/** Prévient chaque membre du DMEC (liste du personnel DMEC : staff/coroner). Au mieux : une lecture refusée ne fait rien échouer. */
export async function notifyDmecOfDeathSignal(key, signal) {
    try {
        const snap = await get(ref(database, 'staff/coroner'));
        const uids = [...new Set(Object.values(snap.val() || {}).map((member) => member && member.uid).filter((uid) => uid && uid !== auth.currentUser?.uid))];
        await Promise.all(uids.map((uid) => notifyUser(uid, {
            type: 'deces', titre: `Décès signalé : ${signal.patientName || signal.patientID}`, texte: `${deathSignalSummary(signal)}. Signalé par ${signal.par}.`, lien: { cible: 'decesSignales', id: key },
        })));
        return uids.length;
    } catch (error) { return 0; }
}

/**
 * Met la fiche en phase avec le rapport de soins qui vient d'être enregistré : posée ou corrigée si le patient est décédé, retirée sinon. `notify` : prévenir le DMEC (à la première pose seulement).
 * → 'publiee' | 'retiree' | 'rien'
 */
export async function syncDeathSignal({ key, version, formData, authorName }) {
    if (!key || !DEATH_VERSIONS.includes(Number(version))) return 'rien';
    const signal = buildDeathSignal({ version, formData, authorName, uid: auth.currentUser?.uid || '' });
    if (!signal) return (await retractDeathSignal(key)) ? 'retiree' : 'rien';
    const existing = await get(signalRef(key));
    if (existing.exists() && (existing.val() || {}).statut === 'traite') return 'rien'; // déjà traitée par le DMEC : on n'y touche plus
    await publishDeathSignal(key, existing.exists() ? { ...signal, creeLe: (existing.val() || {}).creeLe || signal.creeLe } : signal);
    if (!existing.exists()) await notifyDmecOfDeathSignal(key, signal);
    return 'publiee';
}
