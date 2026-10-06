// src/utils/patientRecords.js
//
// Index « dossier patient » : patientRecords/{patientID}/{indexKey} pointe vers
// le vrai rapport (savedReports/{auteur}/{clé}). Tout ce qui lit/écrit cet
// index passe par ici pour que les ID soient normalisés partout de la même
// façon, que les règles de suppression soient appliquées en un seul endroit et
// que les copies de médecin restent rattachées au rapport d'origine.
//
// Champs d'une entrée d'index :
//   reportPath, visibility ('owner' | 'shared' | 'staff-only'), bbCodeVersion,
//   originalKey (titre affiché), title (titre pur, sans suffixe " (2)"),
//   authorName (propriétaire du nœud savedReports), creatorName (créateur
//   réel : diffère de authorName pour une copie), patientName, timestamp,
//   kind ('ama' pour un formulaire AMA),
//   copiedBy: { [médecin]: indexKey } — médecins ayant récupéré une copie,
//   copiedFrom: { reportPath, patientNode, indexKey } — sur une copie,
//   ownerDeleted: true — le patient a « supprimé » un rapport qu'un médecin a
//   copié : il disparaît de son dossier mais reste accessible au personnel.
import { ref, get, set, update, remove } from 'firebase/database';
import { database, auth } from '../firebase';

// Même assainissement que les clés savedReports/{auteur} ailleurs dans l'app.
export const comprehensiveSanitize = (str) => {
    if (!str) return '';
    let sanitized = String(str).trim().replace(/[.#$[\]/ ]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
};

// ID patient → clé Firebase stable : espaces retirés, majuscules, caractères
// interdits remplacés. Les ID font 4 ou 5 chiffres après « PHMC- » : on ne
// suppose aucune longueur.
export const normalizePatientId = (id) =>
    String(id || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[.#$[\]/]+/g, '_');

// Toutes les clés sous lesquelles un ID saisi à la main peut avoir été indexé
// (anciennes entrées non normalisées, ID donné sans le préfixe « PHMC- »…).
export const patientIdCandidates = (input) => {
    const raw = String(input || '').trim();
    if (!raw) return [];
    const candidates = new Set([
        normalizePatientId(raw),
        raw.replace(/[.#$[\]/]+/g, '_'),
    ]);
    const digits = normalizePatientId(raw);
    if (/^\d{3,6}$/.test(digits)) candidates.add(`PHMC-${digits}`);
    return [...candidates].filter(Boolean);
};

// Titre à copier / afficher pour un rapport (ancien rapport sans champ title :
// on retombe sur originalKey, en retirant un éventuel préfixe "[Copie] ").
export const reportTitleOf = (report) => {
    if (!report) return '';
    if (report.title) return report.title;
    return String(report.originalKey || '').replace(/^\[Copie\]\s*/, '').trim();
};

// Qui a créé le rapport (et pas seulement dans quel compte il est rangé).
export const reportCreatorOf = (report) => report?.creatorName || report?.originalAuthorName || report?.authorName || '';

export const indexPathFor = (patientID, indexKey) => `patientRecords/${normalizePatientId(patientID)}/${indexKey}`;

// Écrit (ou remplace) l'entrée d'index d'un rapport. Best-effort côté appelant.
export async function writeIndexEntry({ patientID, indexKey, entry }) {
    const normalized = normalizePatientId(patientID);
    if (!normalized || !indexKey) return null;
    const payload = {};
    Object.entries(entry).forEach(([k, v]) => { if (v !== undefined) payload[k] = v; });
    await set(ref(database, `patientRecords/${normalized}/${indexKey}`), payload);
    return `patientRecords/${normalized}/${indexKey}`;
}

// Lit toutes les entrées d'un dossier, quelle que soit la façon dont l'ID a été
// saisi, et les résout vers le rapport réel. Chaque résultat garde `patientNode`
// (le nœud d'index où l'entrée vit réellement) pour pouvoir la modifier ensuite.
export async function loadPatientDossier(inputId) {
    const candidates = patientIdCandidates(inputId);
    const entries = [];
    const seen = new Set();

    for (const node of candidates) {
        const indexSnap = await get(ref(database, `patientRecords/${node}`));
        if (!indexSnap.exists()) continue;
        const rawEntries = Object.entries(indexSnap.val() || {});
        const resolved = await Promise.all(rawEntries.map(async ([indexKey, entry]) => {
            if (!entry?.reportPath || seen.has(entry.reportPath)) return null;
            try {
                const reportSnap = await get(ref(database, entry.reportPath));
                if (!reportSnap.exists()) return null;
                const report = reportSnap.val();
                seen.add(entry.reportPath);
                return {
                    indexKey,
                    patientNode: node,
                    reportPath: entry.reportPath,
                    visibility: entry.visibility,
                    ownerDeleted: !!entry.ownerDeleted,
                    copiedBy: entry.copiedBy || null,
                    copiedFrom: entry.copiedFrom || null,
                    kind: entry.kind || report.kind || null,
                    originalKey: report.originalKey,
                    title: report.title || entry.title || null,
                    bbCodeVersion: report.bbCodeVersion,
                    timestamp: report.timestamp,
                    authorName: report.authorName,
                    creatorName: report.creatorName || report.originalAuthorName || entry.creatorName || report.authorName,
                    bbCode: report.bbCode,
                    imageUrl: report.imageUrl || report.data?.imageUrl || null,
                    patientID: report.data?.patientID || node,
                };
            } catch (err) {
                console.warn('Could not fetch report for patient dossier:', entry.reportPath, err);
                return null;
            }
        }));
        resolved.filter(Boolean).forEach((r) => entries.push(r));
    }
    return entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

// Liste des ID patients connus uniquement par un index (patients sans compte :
// rapports créés par un médecin sur un patient qui n'est pas sur le logiciel).
export async function listIndexedPatientIds() {
    const snap = await get(ref(database, 'patientRecords'));
    if (!snap.exists()) return [];
    return Object.entries(snap.val() || {}).map(([patientNode, entries]) => {
        const list = Object.values(entries || {});
        const named = list.find((e) => e && e.patientName);
        return { patientNode, reportCount: list.length, patientName: named?.patientName || '' };
    });
}

// Retire les marqueurs/index d'une copie et nettoie l'original si le patient
// l'avait déjà « supprimé » et qu'il n'y a plus aucune copie.
async function releaseCopyMarker(copiedFrom, copierName) {
    if (!copiedFrom?.patientNode || !copiedFrom?.indexKey) return;
    const originalIndexRef = ref(database, `patientRecords/${copiedFrom.patientNode}/${copiedFrom.indexKey}`);
    const snap = await get(originalIndexRef);
    if (!snap.exists()) return;
    const entry = snap.val();
    const remaining = { ...(entry.copiedBy || {}) };
    delete remaining[comprehensiveSanitize(copierName)];
    if (Object.keys(remaining).length === 0) {
        await update(originalIndexRef, { copiedBy: null });
        if (entry.ownerDeleted && entry.reportPath) {
            await remove(ref(database, entry.reportPath));
            await remove(originalIndexRef);
        }
    } else {
        await update(originalIndexRef, { copiedBy: remaining });
    }
}

// Applique les règles de suppression pour UN rapport. `viewer` :
//   { role: 'civil' | 'staff', isAdmin, staffName }
// `report` : { reportPath, key, patientID, authorName, sharedByStaff? } — le
// patientID sert à retrouver l'entrée d'index.
// Retourne { ok, action: 'deleted' | 'hidden' | 'refused', message }.
export async function deleteReportWithRules(report, viewer) {
    const { reportPath } = report;
    const indexKey = report.indexKey || report.key || (reportPath ? reportPath.split('/').pop() : null);

    // Retrouve l'entrée d'index (si le rapport est lié à un patient).
    let indexRef = null;
    let indexEntry = null;
    const nodes = report.patientNode ? [report.patientNode] : patientIdCandidates(report.patientID);
    for (const node of nodes) {
        const r = ref(database, `patientRecords/${node}/${indexKey}`);
        const snap = await get(r);
        if (snap.exists()) { indexRef = r; indexEntry = snap.val(); break; }
    }

    const hardDelete = async () => {
        if (reportPath) await remove(ref(database, reportPath));
        if (indexRef) await remove(indexRef);
    };

    if (viewer.role === 'civil') {
        // Rapport créé par le personnel puis partagé : le patient ne peut pas le supprimer.
        const createdByStaff = report.sharedByStaff || (indexEntry && indexEntry.visibility !== 'owner');
        if (createdByStaff) {
            return { ok: false, action: 'refused', message: 'Ce rapport a été créé par un membre du personnel : vous ne pouvez pas le supprimer de votre dossier.' };
        }
        // Rapport créé par le patient : supprimé, sauf si un médecin en a gardé une copie
        // (il disparaît alors du dossier du patient mais reste accessible au personnel).
        if (indexEntry?.copiedBy && Object.keys(indexEntry.copiedBy).length > 0) {
            await update(indexRef, { ownerDeleted: true });
            return { ok: true, action: 'hidden', message: 'Rapport retiré de votre dossier (le personnel en conserve une copie).' };
        }
        await hardDelete();
        return { ok: true, action: 'deleted', message: 'Rapport supprimé.' };
    }

    // Personnel
    const isOwnerOfNode = reportPath && viewer.staffName
        && reportPath.split('/')[1] === comprehensiveSanitize(viewer.staffName);
    const isPatientOriginal = indexEntry?.visibility === 'owner' && !indexEntry?.copiedFrom;
    if (isPatientOriginal && !viewer.isAdmin) {
        return { ok: false, action: 'refused', message: "Ce rapport a été créé par le patient : seul lui (ou un administrateur) peut le supprimer. Votre copie, elle, peut l'être." };
    }
    if (!viewer.isAdmin && !isOwnerOfNode && indexEntry && indexEntry.authorName && indexEntry.authorName !== viewer.staffName) {
        return { ok: false, action: 'refused', message: "Ce rapport a été créé par un autre membre du personnel : vous ne pouvez pas le supprimer." };
    }
    await hardDelete();
    if (indexEntry?.copiedFrom) {
        try { await releaseCopyMarker(indexEntry.copiedFrom, indexEntry.authorName); }
        catch (err) { console.warn('Could not release copy marker:', err); }
    }
    return { ok: true, action: 'deleted', message: 'Rapport supprimé.' };
}

// Reconstruit l'index à partir de savedReports (admin) : retrouve les rapports
// dont data.patientID existe mais qui n'ont jamais été indexés (enregistrés
// avant l'index, patientID alors différent, rapports migrés d'un compte à
// l'autre…) et corrige les chemins devenus obsolètes.
export async function reindexPatientRecords({ onProgress } = {}) {
    const snap = await get(ref(database, 'savedReports'));
    if (!snap.exists()) return { scanned: 0, created: 0, repaired: 0 };
    const all = snap.val() || {};
    const existingSnap = await get(ref(database, 'patientRecords'));
    const existing = existingSnap.exists() ? existingSnap.val() : {};

    const updates = {};
    let scanned = 0;
    let created = 0;
    let repaired = 0;

    for (const [authorNode, reports] of Object.entries(all)) {
        for (const [reportKey, report] of Object.entries(reports || {})) {
            scanned++;
            const patientID = report?.data?.patientID;
            if (!patientID) continue;
            const patientNode = normalizePatientId(patientID);
            if (!patientNode) continue;
            const reportPath = `savedReports/${authorNode}/${reportKey}`;
            const entry = existing[patientNode]?.[reportKey];
            if (!entry) {
                // Un civil sauvegarde sous « Prénom Nom [ID] » (assaini en Prénom_Nom_ID) :
                // le nœud finit donc par son propre ID patient.
                const isCivilOwn = authorNode.toUpperCase().endsWith(`_${patientNode}`);
                updates[`patientRecords/${patientNode}/${reportKey}`] = {
                    reportPath,
                    visibility: isCivilOwn ? 'owner' : 'staff-only',
                    bbCodeVersion: report.bbCodeVersion ?? null,
                    originalKey: report.originalKey ?? '',
                    title: report.title ?? null,
                    authorName: report.authorName ?? '',
                    patientName: report.data?.patientName ?? null,
                    timestamp: report.timestamp ?? Date.now(),
                };
                created++;
            } else if (entry.reportPath !== reportPath) {
                updates[`patientRecords/${patientNode}/${reportKey}/reportPath`] = reportPath;
                updates[`patientRecords/${patientNode}/${reportKey}/authorName`] = report.authorName ?? entry.authorName ?? '';
                repaired++;
            }
        }
        if (onProgress) onProgress(scanned);
    }
    if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
    }
    return { scanned, created, repaired };
}

// Noms de tous les comptes qui ont des rapports (savedReports/{compte}). Lecture
// « shallow » via l'API REST : on ne télécharge pas tous les rapports juste pour
// avoir la liste des noms. Repli sur une lecture complète si le REST échoue.
export async function listSavedReportNodes() {
    try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
        const baseUrl = database.app.options.databaseURL;
        if (token && baseUrl) {
            const response = await fetch(`${baseUrl}/savedReports.json?shallow=true&auth=${token}`);
            if (response.ok) {
                const keys = await response.json();
                if (keys && typeof keys === 'object') return Object.keys(keys);
            }
        }
    } catch (error) {
        console.warn('Shallow savedReports listing failed, falling back to full read:', error);
    }
    const snap = await get(ref(database, 'savedReports'));
    return snap.exists() ? Object.keys(snap.val()) : [];
}
