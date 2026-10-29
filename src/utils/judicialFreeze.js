// src/utils/judicialFreeze.js
//
// Gel judiciaire d'un rapport : une procédure est en cours (mandat, réquisition, enquête), le rapport ne doit plus changer. Le DMEC (ou un admin)
// le gèle depuis « Rapports enregistrés » ; tant qu'il est gelé il ne peut plus être modifié, supprimé ni (dé)publié. Seul un admin lève le gel,
// avec un justificatif ; l'entrée n'est jamais supprimée (elle garde la trace du gel et de sa levée).
// Stockage : gelsJudiciaires/{clé du rapport} (règles : database.rules.json, tests : rules-tests). Les règles bloquent les comptes du personnel ;
// un admin garde le droit d'écriture sur le nœud entier (renommages) : pour lui, le gel est appliqué ici, avant toute modification (suppression d'un
// rapport : deleteReportWithRules ; opérations sur un nœud entier : assertNoneFrozen). Un rapport n'est jamais réécrit sous la même clé à
// l'enregistrement (la clé porte l'horodatage) : il n'y a donc rien à vérifier à ce moment-là.
// Un gel levé se garde : seul un admin peut regeler, et l'ancien gel (avec sa levée) est conservé dans « precedents ».
import { ref, get, set } from 'firebase/database';
import { database, auth } from '../firebase';
import { logActivity } from './activityLog';
import { canonicalPatientId } from './patientId';
import { AUTHORITY_TYPES } from '../constants/authorities';

export const FREEZE_MESSAGE = "Ce rapport fait l'objet d'un gel judiciaire (procédure en cours) : il ne peut plus être modifié, supprimé ni publié. Seul un administrateur peut lever le gel, avec un justificatif.";

export { AUTHORITY_TYPES };

const keyOfPath = (reportPath) => String(reportPath || '').split('/').pop();
const freezeRef = (key) => ref(database, `gelsJudiciaires/${key}`);
export const isFrozen = (entry) => !!entry && entry.actif === true;

// Seul un refus des règles (un Civil ne lit pas les gels) est tolérable : toute autre erreur (réseau, délai) se propage, pour qu'un échec de lecture
// ne fasse jamais passer un rapport gelé pour libre.
const isPermissionDenied = (error) => error?.code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(String(error?.message || error));

// Gel d'un rapport (clé = dernier segment du chemin), ou null. Lecture refusée (Civil) = null ; autre erreur = exception.
export async function loadFreeze(keyOrPath) {
    const key = keyOfPath(keyOrPath);
    if (!key) return null;
    try {
        const snap = await get(freezeRef(key));
        return snap.exists() ? snap.val() : null;
    } catch (error) {
        if (isPermissionDenied(error)) return null;
        throw error;
    }
}

// { [clé du rapport]: entrée } de tous les gels. Lecture refusée = vide ; autre erreur = exception.
export async function loadFreezeMap() {
    try {
        const snap = await get(ref(database, 'gelsJudiciaires'));
        return snap.exists() ? snap.val() : {};
    } catch (error) {
        if (isPermissionDenied(error)) return {};
        throw error;
    }
}

// Garde-fou des opérations d'admin sur un nœud entier (renommage, fusion, suppression de compte) : refuse si l'un des rapports est gelé.
export async function assertNoneFrozen(reportKeys) {
    const map = await loadFreezeMap();
    const frozen = [...new Set(reportKeys)].filter((key) => isFrozen(map[key]));
    if (frozen.length > 0) {
        const shown = frozen.slice(0, 3).join(', ');
        throw new Error(`${frozen.length} rapport${frozen.length > 1 ? 's sont' : ' est'} sous gel judiciaire (${shown}${frozen.length > 3 ? '…' : ''}) : levez le gel avant cette opération.`);
    }
}

export async function freezeReport({ reportPath, title, patientID, byName, autorite, reference, motif }) {
    if (!auth.currentUser) throw new Error('Connexion requise.');
    const reason = String(motif || '').trim();
    if (reason.length < 3) throw new Error('Indiquez le motif du gel (procédure, mandat…).');
    const key = keyOfPath(reportPath);
    const current = await loadFreeze(key);
    if (isFrozen(current)) throw new Error('Ce rapport est déjà gelé.');
    // Regel après une levée : réservé aux admins (règles), et le gel précédent avec sa levée est conservé.
    let precedents = null;
    if (current) {
        const { precedents: older, ...closed } = current;
        precedents = [...(older ? Object.values(older) : []), closed];
    }
    const entry = {
        reportPath,
        uid: auth.currentUser.uid,
        par: byName || '',
        depuis: Date.now(),
        actif: true,
        autorite: AUTHORITY_TYPES[autorite] ? autorite : 'autre',
        reference: String(reference || '').trim().slice(0, 120),
        motif: reason.slice(0, 500),
        ...(title ? { titre: String(title).slice(0, 200) } : {}),
        ...(patientID ? { patientID: canonicalPatientId(patientID) } : {}),
        ...(precedents ? { precedents } : {}),
    };
    await set(freezeRef(key), entry);
    logActivity({
        category: 'rapports', action: 'report_frozen', severity: 'warning',
        summary: `Rapport gelé (gel judiciaire) : ${title || key}`,
        details: `Par : ${byName || '—'}\nAutorité : ${AUTHORITY_TYPES[entry.autorite]}${entry.reference ? ` (${entry.reference})` : ''}\nMotif : ${entry.motif}`,
        target: patientID ? canonicalPatientId(patientID) : undefined,
    });
    return entry;
}

// Levée du gel (admin) : le justificatif est obligatoire et reste sur l'entrée.
export async function liftFreeze({ reportPath, title, patientID, byName, reason }) {
    const motif = String(reason || '').trim();
    if (motif.length < 3) throw new Error('Un justificatif est obligatoire pour lever un gel judiciaire.');
    const key = keyOfPath(reportPath);
    const current = await loadFreeze(key);
    if (!isFrozen(current)) throw new Error("Ce rapport n'est pas gelé.");
    await set(freezeRef(key), { ...current, actif: false, levee: { motif: motif.slice(0, 500), par: byName || '', le: Date.now() } });
    logActivity({
        category: 'rapports', action: 'report_unfrozen', severity: 'warning',
        summary: `Gel judiciaire levé : ${title || key}`, details: `Par : ${byName || '—'}\nJustificatif : ${motif}`,
        target: patientID ? canonicalPatientId(patientID) : undefined,
    });
}
