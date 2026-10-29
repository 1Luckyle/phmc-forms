// src/utils/deathReports.js
//
// Rapports de décès : (1) patient déclaré DÉCÉDÉ → le personnel non DMEC ne peut plus rien enregistrer sur son ID
// (patientsDecedes/{ID}) ; (2) Rapport Public de Décès PUBLIÉ par le DMEC → lisible par tout le personnel
// (rapportsPublics/{clé du rapport}). Les règles Firebase (database.rules.json) sont la vraie protection ; ces fonctions
// posent / retirent les marqueurs et affichent un message clair avant que la base ne refuse.
//
// Ce module n'importe PAS patientRecords (qui l'importe pour libérer les marqueurs à la suppression d'un rapport).
import { ref, get, set, update, remove } from 'firebase/database';
import { database, auth } from '../firebase';
import { canonicalPatientId } from './patientId';
import { logActivity } from './activityLog';

export const DEATH_LOCK_MESSAGE = "Ce patient a été déclaré décédé par le DMEC : plus aucun rapport ne peut être enregistré sur son dossier (la consultation reste possible). Si c'est une erreur, demandez à un administrateur de débloquer l'enregistrement.";

const lockRef = (patientID) => ref(database, `patientsDecedes/${canonicalPatientId(patientID)}`);
const keyOfPath = (reportPath) => String(reportPath || '').split('/').pop();

// ───────────────────────────── Patient décédé ─────────────────────────────

// Marqueur de décès d'un patient, ou null (pas décédé, ou lecture impossible : un Civil n'a pas le droit de le lire).
export async function loadDeathLock(patientID) {
    if (!canonicalPatientId(patientID)) return null;
    try {
        const snap = await get(lockRef(patientID));
        return snap.exists() ? snap.val() : null;
    } catch (error) {
        return null;
    }
}

// Déclare le patient décédé (rapport de décès enregistré avec son ID). Le premier marqueur est conservé : un second rapport
// de décès sur le même ID ne le remplace pas. `rapport` sert à libérer la fiche si ce rapport est supprimé.
export async function declareDeath({ patientID, reportPath, authorName, title }) {
    const id = canonicalPatientId(patientID);
    if (!id || !auth.currentUser) return false;
    const existing = await loadDeathLock(id);
    if (existing) return false;
    await set(lockRef(id), {
        depuis: Date.now(), uid: auth.currentUser.uid, par: authorName || '', rapport: reportPath || '', titre: title || '',
    });
    logActivity({
        category: 'rapports', action: 'patient_declared_dead', severity: 'warning',
        summary: `Patient déclaré décédé : ${id}`, details: `Rapport : ${reportPath || '—'}\nPar : ${authorName || '—'}`, target: id,
    });
    return true;
}

// Déblocage par un admin (patient déclaré mort par erreur, ou ramené à la vie).
export async function unlockPatient(patientID, byName) {
    const id = canonicalPatientId(patientID);
    await remove(lockRef(id));
    logActivity({
        category: 'rapports', action: 'patient_unlocked', severity: 'warning',
        summary: `Enregistrement débloqué pour ${id} (patient déclaré décédé)`, details: `Par : ${byName || 'admin'}`, target: id,
    });
}

// ───────────────────────────── Publication ─────────────────────────────

// Clés des rapports publics PUBLIÉS (Set), pour savoir quels rapports DMEC un soignant peut ouvrir. Vide si illisible.
export async function loadPublishedKeys() {
    try {
        const snap = await get(ref(database, 'rapportsPublics'));
        return new Set(snap.exists() ? Object.keys(snap.val() || {}) : []);
    } catch (error) {
        return new Set();
    }
}

export async function loadPublishedList() {
    const snap = await get(ref(database, 'rapportsPublics'));
    if (!snap.exists()) return [];
    return Object.entries(snap.val() || {})
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => (b.publieLe || 0) - (a.publieLe || 0));
}

// Publie un Rapport Public de Décès : le rapport garde un marqueur (affichage), l'index rapportsPublics l'ouvre à tout le personnel.
export async function publishReport({ reportPath, title, patientID, byName }) {
    if (!auth.currentUser) throw new Error('Connexion requise.');
    const key = keyOfPath(reportPath);
    const now = Date.now();
    await set(ref(database, `rapportsPublics/${key}`), {
        reportPath, uid: auth.currentUser.uid, par: byName || '', titre: title || '',
        ...(patientID ? { patientID: canonicalPatientId(patientID) } : {}),
        publieLe: now,
    });
    await update(ref(database, reportPath), { publie: true, publieLe: now, publiePar: byName || null, depublication: null });
    logActivity({
        category: 'rapports', action: 'death_report_published', severity: 'info',
        summary: `Rapport public de décès publié : ${title || key}`, details: `Par : ${byName || '—'}${patientID ? `\nPatient : ${canonicalPatientId(patientID)}` : ''}`,
        target: patientID ? canonicalPatientId(patientID) : undefined,
    });
}

// Dépublie, avec un justificatif obligatoire (consigné dans le journal et sur le rapport).
export async function unpublishReport({ reportPath, title, patientID, byName, reason }) {
    const motif = String(reason || '').trim();
    if (!motif) throw new Error('Un justificatif est obligatoire pour dépublier un rapport.');
    const key = keyOfPath(reportPath);
    await remove(ref(database, `rapportsPublics/${key}`));
    await update(ref(database, reportPath), {
        publie: false, publieLe: null, publiePar: null, depublication: { motif, par: byName || '', le: Date.now() },
    });
    logActivity({
        category: 'rapports', action: 'death_report_unpublished', severity: 'warning',
        summary: `Rapport public de décès dépublié : ${title || key}`, details: `Par : ${byName || '—'}\nJustificatif : ${motif}`,
        target: patientID ? canonicalPatientId(patientID) : undefined,
    });
}

// ───────────────────────────── Suppression d'un rapport ─────────────────────────────

// À appeler quand un rapport est supprimé (ou retiré) : s'il était publié il est dépublié, et s'il avait déclaré le patient
// décédé la fiche est libérée. Au mieux : un refus des règles (rapport d'un autre, par exemple) n'empêche pas la suppression.
export async function releaseDeathArtifacts({ reportPath, patientID }) {
    if (!reportPath) return;
    const key = keyOfPath(reportPath);
    try {
        const publication = await get(ref(database, `rapportsPublics/${key}`));
        if (publication.exists()) {
            await remove(ref(database, `rapportsPublics/${key}`));
            logActivity({
                category: 'rapports', action: 'death_report_unpublished', severity: 'info',
                summary: `Rapport public de décès dépublié (rapport supprimé) : ${publication.val().titre || key}`, target: publication.val().patientID,
            });
        }
    } catch (error) {
        console.warn('Dépublication automatique impossible :', error?.message || error);
    }
    if (!patientID) return;
    try {
        const lock = await loadDeathLock(patientID);
        if (lock && lock.rapport === reportPath) {
            await remove(lockRef(patientID));
            logActivity({
                category: 'rapports', action: 'patient_unlocked', severity: 'info',
                summary: `Fiche libérée (rapport de décès supprimé) : ${canonicalPatientId(patientID)}`, target: canonicalPatientId(patientID),
            });
        }
    } catch (error) {
        console.warn('Libération automatique de la fiche impossible :', error?.message || error);
    }
}
