// src/utils/patientRecords.js
//
// Index « dossier patient » : patientRecords/{patientID}/{indexKey} pointe vers le
// vrai rapport (savedReports/{auteur}/{clé}). Tout ce qui lit/écrit cet index passe
// par ici pour que les ID soient traités partout de la même façon (forme canonique
// PHMC-2752, voir patientId.js), que les règles de suppression soient appliquées en
// un seul endroit et que les copies de médecin restent rattachées à l'original.
//
// Un patient n'a PAS besoin d'un compte : un médecin peut créer des rapports sur un ID
// qui n'a jamais ouvert de compte, ils sont retrouvés par l'ID.
//
// Champs d'une entrée d'index :
//   reportPath, visibility ('owner' | 'shared' | 'staff-only'), bbCodeVersion,
//   originalKey (titre affiché), title (titre pur, sans suffixe " (2)"),
//   authorName (propriétaire du nœud savedReports), creatorName (créateur réel :
//   diffère de authorName pour une copie), patientName, timestamp,
//   kind ('ama' pour un formulaire AMA),
//   copiedBy: { [médecin assaini]: indexKey de sa copie } — UNE copie par médecin,
//   copiedFrom: { reportPath, patientNode, indexKey } — sur une copie,
//   ownerDeleted: true — le créateur a « supprimé » un rapport qui a encore des
//   copies : il disparaît pour lui (et pour le patient) mais reste dans le dossier
//   tant qu'au moins une copie existe.
import { ref, get, set, update, remove } from 'firebase/database';
import { database, auth } from '../firebase';
import {
    canonicalPatientId, normalizePatientId, patientIdCandidates, samePatientId,
} from './patientId';

export { canonicalPatientId, normalizePatientId, patientIdCandidates, samePatientId };

// Même assainissement que les clés savedReports/{auteur} ailleurs dans l'app.
export const comprehensiveSanitize = (str) => {
    if (!str) return '';
    let sanitized = String(str).trim().replace(/[.#$[\]/ ]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
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

// ───────────────────────── Lecture « shallow » (noms de nœuds) ─────────────────────────

// Liste les clés d'un chemin sans télécharger les données (API REST shallow). Retourne
// null si c'est impossible (compte sans droit de lecture, réseau…).
async function shallowKeys(path) {
    try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
        const baseUrl = database.app.options.databaseURL;
        if (!token || !baseUrl) return null;
        const response = await fetch(`${baseUrl}/${path}.json?shallow=true&auth=${token}`);
        if (!response.ok) return null;
        const keys = await response.json();
        return keys && typeof keys === 'object' ? Object.keys(keys) : [];
    } catch (error) {
        console.warn(`Shallow listing of ${path} failed:`, error);
        return null;
    }
}

// Noms de tous les comptes qui ont des rapports (savedReports/{compte}).
export async function listSavedReportNodes() {
    const keys = await shallowKeys('savedReports');
    if (keys) return keys;
    const snap = await get(ref(database, 'savedReports'));
    return snap.exists() ? Object.keys(snap.val()) : [];
}

// Tous les nœuds de l'index qui désignent le MÊME patient que `input` : « 2704 »,
// « PHMC-2704 », ou un ancien nœud mal formé comme « 2704 » avec un espace en trop.
// Le personnel peut lire la liste des nœuds ; un civil retombe sur les variantes connues.
export async function findPatientNodes(input) {
    const canonical = canonicalPatientId(input);
    if (!canonical) return [];
    const nodes = new Set(patientIdCandidates(input));
    const allNodes = await shallowKeys('patientRecords');
    if (allNodes) {
        allNodes.forEach((node) => {
            if (canonicalPatientId(node) === canonical) nodes.add(node);
        });
        // On ne garde que les nœuds qui existent vraiment.
        return [...nodes].filter((node) => allNodes.includes(node));
    }
    return [...nodes];
}

// ───────────────────────────── Écriture de l'index ─────────────────────────────

// Écrit (ou remplace) l'entrée d'index d'un rapport. Best-effort côté appelant.
export async function writeIndexEntry({ patientID, indexKey, entry }) {
    const node = canonicalPatientId(patientID);
    if (!node || !indexKey) return null;
    const payload = {};
    Object.entries(entry).forEach(([k, v]) => { if (v !== undefined) payload[k] = v; });
    await set(ref(database, `patientRecords/${node}/${indexKey}`), payload);
    return `patientRecords/${node}/${indexKey}`;
}

// ───────────────────────────── Lecture d'un dossier ─────────────────────────────

// Lit toutes les entrées du dossier d'un patient, quelle que soit la façon dont l'ID a
// été saisi ou indexé, et les résout vers le rapport réel. Chaque résultat garde
// `patientNode` (le nœud d'index où l'entrée vit réellement) pour pouvoir la modifier.
export async function loadPatientDossier(inputId) {
    const nodes = await findPatientNodes(inputId);
    const entries = [];
    const seen = new Set();

    for (const node of nodes) {
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
                    ownerDeleted: !!(entry.ownerDeleted || report.ownerDeleted),
                    copiedBy: entry.copiedBy || null,
                    copiedFrom: entry.copiedFrom || report.copiedFrom || null,
                    kind: entry.kind || report.kind || null,
                    originalKey: report.originalKey,
                    title: report.title || entry.title || null,
                    bbCodeVersion: report.bbCodeVersion,
                    timestamp: report.timestamp,
                    authorName: report.authorName,
                    creatorName: report.creatorName || report.originalAuthorName || entry.creatorName || report.authorName,
                    bbCode: report.bbCode,
                    imageUrl: report.imageUrl || report.data?.imageUrl || null,
                    patientID: canonicalPatientId(report.data?.patientID || node),
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

// Regroupe un rapport et ses copies : UNE ligne par rapport d'origine, avec la liste des
// médecins qui en ont une copie. Évite d'afficher le même contenu plusieurs fois.
//   → [{ root, copies: [entry…], copiers: [{ name, nodeKey, entry|null }…] }]
// Si l'original n'existe plus (cas anormal), la copie devient elle-même la ligne.
export function groupDossierEntries(entries) {
    const families = new Map();
    entries.filter((e) => !e.copiedFrom).forEach((e) => {
        families.set(e.reportPath, { root: e, copies: [] });
    });
    entries.filter((e) => e.copiedFrom).forEach((copy) => {
        const family = families.get(copy.copiedFrom.reportPath);
        if (family) family.copies.push(copy);
        else families.set(copy.reportPath, { root: copy, copies: [] });
    });

    return [...families.values()]
        .map((family) => {
            // Médecins ayant une copie : d'après les copies trouvées, complété par les
            // marqueurs « copiedBy » de l'original (au cas où une copie n'est plus lisible).
            const copiers = family.copies.map((copy) => ({
                name: copy.authorName || '',
                nodeKey: comprehensiveSanitize(copy.authorName),
                entry: copy,
            }));
            Object.keys(family.root.copiedBy || {}).forEach((nodeKey) => {
                if (!copiers.some((c) => c.nodeKey === nodeKey)) {
                    copiers.push({ name: nodeKey.replace(/_/g, ' '), nodeKey, entry: null });
                }
            });
            copiers.sort((a, b) => a.name.localeCompare(b.name));
            return { ...family, copiers };
        })
        .sort((a, b) => (b.root.timestamp || 0) - (a.root.timestamp || 0));
}

// Patients connus uniquement par un index (patients sans compte : rapports créés par un
// médecin sur un ID qui n'a jamais ouvert de compte). Les nœuds qui désignent le même
// patient (« 2704 » / « PHMC-2704 ») sont fusionnés.
export async function listIndexedPatientIds() {
    const snap = await get(ref(database, 'patientRecords'));
    if (!snap.exists()) return [];
    const byCanonical = new Map();
    Object.entries(snap.val() || {}).forEach(([patientNode, entries]) => {
        const canonical = canonicalPatientId(patientNode);
        if (!canonical) return;
        const list = Object.values(entries || {}).filter((e) => e && !e.deleted);
        const named = list.find((e) => e && e.patientName);
        const current = byCanonical.get(canonical) || { patientNode: canonical, reportCount: 0, patientName: '' };
        current.reportCount += list.length;
        current.patientName = current.patientName || named?.patientName || '';
        byCanonical.set(canonical, current);
    });
    return [...byCanonical.values()].filter((p) => p.reportCount > 0);
}

// ───────────────────────────── Suppression avec règles ─────────────────────────────

// Retire le marqueur « copié par » d'un médecin sur l'original, et nettoie l'original si
// son créateur l'avait déjà « supprimé » et qu'il n'y a plus aucune copie.
async function releaseCopyMarker(copiedFrom, copierName, patientID) {
    if (!copiedFrom?.indexKey) return;
    const originalNodes = copiedFrom.patientNode
        ? [copiedFrom.patientNode]
        : await findPatientNodes(patientID);
    for (const node of originalNodes) {
        const originalIndexRef = ref(database, `patientRecords/${node}/${copiedFrom.indexKey}`);
        const snap = await get(originalIndexRef);
        if (!snap.exists()) continue;
        const entry = snap.val();
        const remaining = { ...(entry.copiedBy || {}) };
        delete remaining[comprehensiveSanitize(copierName)];
        if (Object.keys(remaining).length === 0) {
            await update(originalIndexRef, { copiedBy: null });
            if (entry.ownerDeleted && entry.reportPath) {
                await remove(ref(database, entry.reportPath));
                await removeIndexEntry(originalIndexRef);
            }
        } else {
            await update(originalIndexRef, { copiedBy: remaining });
        }
        return;
    }
}

// Supprime une entrée d'index ; si les règles refusent la suppression (règles pas encore
// déployées), on la marque « deleted » : le dossier ignore les entrées sans rapport.
async function removeIndexEntry(indexRef) {
    try {
        await remove(indexRef);
    } catch (error) {
        console.warn('Index entry could not be removed, tombstoning it instead:', error);
        try { await update(indexRef, { deleted: true }); } catch (e) { /* rien de plus à faire */ }
    }
}

// Applique les règles de suppression pour UN rapport. `viewer` :
//   { role: 'civil' | 'staff', isAdmin, staffName }
// `report` : { reportPath, key, patientID, patientNode?, sharedByStaff?, isCopy? }.
// Retourne { ok, action: 'deleted' | 'hidden' | 'refused', message }.
//
// Règles :
//  • Un rapport avec des COPIES n'est jamais supprimé pour de bon : son créateur le
//    « retire » (il disparaît pour lui et pour le patient) mais il reste dans le dossier
//    tant qu'au moins un médecin en a une copie.
//  • Supprimer SA copie ne supprime que sa copie (ni l'original, ni les autres copies).
//  • Un patient ne peut pas supprimer un rapport créé par le personnel.
//  • Un médecin ne supprime que ses rapports ; un rapport créé par le patient n'est
//    supprimable que par le patient (ou un admin).
export async function deleteReportWithRules(report, viewer) {
    const { reportPath } = report;
    const indexKey = report.indexKey || report.key || (reportPath ? reportPath.split('/').pop() : null);

    // Retrouve l'entrée d'index (si le rapport est lié à un patient).
    let indexRef = null;
    let indexEntry = null;
    const nodes = report.patientNode ? [report.patientNode] : await findPatientNodes(report.patientID);
    for (const node of nodes) {
        const r = ref(database, `patientRecords/${node}/${indexKey}`);
        const snap = await get(r);
        if (snap.exists()) { indexRef = r; indexEntry = snap.val(); break; }
    }

    const hasCopies = !!indexEntry?.copiedBy && Object.keys(indexEntry.copiedBy).length > 0;
    const isCopy = !!indexEntry?.copiedFrom || !!report.isCopy;

    const hardDelete = async () => {
        if (reportPath) await remove(ref(database, reportPath));
        if (indexRef) await removeIndexEntry(indexRef);
    };
    // « Retiré » : le rapport reste en base pour les médecins qui en ont une copie.
    const hide = async () => {
        if (reportPath) await update(ref(database, reportPath), { ownerDeleted: true });
        if (indexRef) await update(indexRef, { ownerDeleted: true });
    };

    if (viewer.role === 'civil') {
        const createdByStaff = report.sharedByStaff || (indexEntry && indexEntry.visibility !== 'owner');
        if (createdByStaff) {
            return { ok: false, action: 'refused', message: 'Ce rapport a été créé par un membre du personnel : vous ne pouvez pas le supprimer de votre dossier.' };
        }
        if (hasCopies) {
            await hide();
            return { ok: true, action: 'hidden', message: 'Rapport retiré de votre dossier (le personnel en conserve une copie).' };
        }
        await hardDelete();
        return { ok: true, action: 'deleted', message: 'Rapport supprimé.' };
    }

    // Personnel
    const isOwnerOfNode = !!(reportPath && viewer.staffName
        && reportPath.split('/')[1] === comprehensiveSanitize(viewer.staffName));

    if (isCopy) {
        // Sa propre copie : supprimée de son côté uniquement.
        if (!isOwnerOfNode && !viewer.isAdmin) {
            return { ok: false, action: 'refused', message: "Cette copie appartient à un autre médecin : vous ne pouvez pas la supprimer." };
        }
        await hardDelete();
        try { await releaseCopyMarker(indexEntry?.copiedFrom || report.copiedFrom, indexEntry?.authorName || viewer.staffName, report.patientID); }
        catch (err) { console.warn('Could not release copy marker:', err); }
        return { ok: true, action: 'deleted', message: 'Copie supprimée.' };
    }

    const isPatientOriginal = indexEntry?.visibility === 'owner';
    if (isPatientOriginal && !viewer.isAdmin) {
        return { ok: false, action: 'refused', message: "Ce rapport a été créé par le patient : seul lui (ou un administrateur) peut le supprimer. Votre copie, elle, peut l'être." };
    }
    if (!isPatientOriginal && !isOwnerOfNode && !viewer.isAdmin) {
        return { ok: false, action: 'refused', message: "Ce rapport a été créé par un autre membre du personnel : vous ne pouvez pas le supprimer." };
    }
    if (hasCopies) {
        await hide();
        return { ok: true, action: 'hidden', message: 'Rapport retiré (conservé dans le dossier tant que des copies existent).' };
    }
    await hardDelete();
    return { ok: true, action: 'deleted', message: 'Rapport supprimé.' };
}

// ───────────────────────────── Réindexation (admin) ─────────────────────────────

// Reconstruit l'index à partir de savedReports :
//  1. fusionne les nœuds d'index mal formés (« 2704 », « phmc-2704 »…) dans le nœud canonique ;
//  2. retrouve les rapports qui ont un ID patient mais n'ont jamais été indexés ;
//  3. corrige les chemins devenus obsolètes (migrations de comptes) ;
//  4. remet l'ID et le début du titre à la forme canonique (« [2704 ] » → « [PHMC-2704] »).
export async function reindexPatientRecords({ onProgress } = {}) {
    const snap = await get(ref(database, 'savedReports'));
    const all = snap.exists() ? (snap.val() || {}) : {};
    const existingSnap = await get(ref(database, 'patientRecords'));
    const existingRaw = existingSnap.exists() ? existingSnap.val() : {};

    const updates = {};
    const stats = { scanned: 0, created: 0, repaired: 0, merged: 0, retitled: 0 };

    // 1) Fusion des nœuds non canoniques. Les entrées sont déplacées une par une (les
    // règles n'autorisent pas la suppression d'un nœud entier, seulement d'une entrée).
    const existing = {};
    Object.entries(existingRaw).forEach(([node, entries]) => {
        const canonical = canonicalPatientId(node);
        if (!canonical) return;
        existing[canonical] = existing[canonical] || {};
        Object.entries(entries || {}).forEach(([indexKey, entry]) => {
            if (!entry || entry.deleted) return;
            if (!existing[canonical][indexKey]) existing[canonical][indexKey] = entry;
            if (node !== canonical) {
                if (!existingRaw[canonical]?.[indexKey]) updates[`patientRecords/${canonical}/${indexKey}`] = entry;
                updates[`patientRecords/${node}/${indexKey}`] = null;
                stats.merged++;
            }
        });
    });

    // 2-4) Parcours des rapports.
    for (const [authorNode, reports] of Object.entries(all)) {
        for (const [reportKey, report] of Object.entries(reports || {})) {
            stats.scanned++;
            const rawId = report?.data?.patientID;
            if (!rawId) continue;
            const patientNode = canonicalPatientId(rawId);
            if (!patientNode) continue;
            const reportPath = `savedReports/${authorNode}/${reportKey}`;

            // ID et titre à la forme canonique.
            if (rawId !== patientNode) {
                updates[`${reportPath}/data/patientID`] = patientNode;
                ['originalKey', 'title'].forEach((field) => {
                    const value = report[field];
                    if (typeof value === 'string' && value.startsWith(`[${rawId}]`)) {
                        updates[`${reportPath}/${field}`] = `[${patientNode}]${value.slice(rawId.length + 2)}`;
                        stats.retitled++;
                    }
                });
            }

            const entry = existing[patientNode]?.[reportKey];
            if (!entry) {
                // Un civil sauvegarde sous « Prénom Nom [ID] » (assaini en Prénom_Nom_ID).
                const isCivilOwn = authorNode.toUpperCase().endsWith(`_${patientNode}`);
                updates[`patientRecords/${patientNode}/${reportKey}`] = {
                    reportPath,
                    visibility: isCivilOwn ? 'owner' : 'staff-only',
                    bbCodeVersion: report.bbCodeVersion ?? null,
                    originalKey: report.originalKey ?? '',
                    title: report.title ?? null,
                    kind: report.kind ?? null,
                    authorName: report.authorName ?? '',
                    creatorName: report.creatorName ?? report.authorName ?? '',
                    patientName: report.data?.patientName ?? null,
                    copiedFrom: report.copiedFrom ?? null,
                    timestamp: report.timestamp ?? Date.now(),
                };
                stats.created++;
            } else if (entry.reportPath !== reportPath) {
                updates[`patientRecords/${patientNode}/${reportKey}/reportPath`] = reportPath;
                updates[`patientRecords/${patientNode}/${reportKey}/authorName`] = report.authorName ?? entry.authorName ?? '';
                stats.repaired++;
            }
        }
        if (onProgress) onProgress(stats.scanned);
    }
    if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
    }
    return stats;
}
