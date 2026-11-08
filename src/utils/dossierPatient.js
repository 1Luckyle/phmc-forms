// src/utils/dossierPatient.js
//
// Dossier patient, côté application (lectures et écritures Firebase) : voir utils/dossierCore.js pour les règles pures et la fonction serveur
// reconcileDossiers (functions/index.js) qui alimente réellement le dossier. Ce module sert à l'enregistrement des formulaires 25 / 3 / 26, à leur verrou
// (15 minutes après paiement), aux jetons gratuits, et à l'affichage du dossier.
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from './patientId';
import { findPatientNodes } from './patientRecords';
import { loadPatientInvoices } from './patientInvoices';
import {
    isDossierVersion, dossierKindOf, formPhase, dossierAccess, canModifyForm, hasToken, emptyTokens,
} from './dossierCore';

export { isDossierVersion, dossierKindOf, canModifyForm };

// Formulaires de dossier encore existants d'un patient, avec leur phase (brouillon / fenêtre de 15 minutes / verrouillé) ; le dossier persistant ; les jetons.
//   → { patientNode, dossier, tokens, forms: [{ key, version, createur, title, timestamp, authorName, reportPath, invoice, phase, startAt, lockAt }], access }
export async function loadDossierContext(patientID, now = Date.now()) {
    const patientNode = canonicalPatientId(patientID);
    if (!patientNode) return { patientNode: '', dossier: null, tokens: emptyTokens(), forms: [], access: dossierAccess({}) };
    const [dossierSnap, tokensSnap, nodes, invoices] = await Promise.all([
        get(ref(database, `dossiersPatients/${patientNode}`)).catch(() => null),
        get(ref(database, `jetonsDossier/${patientNode}`)).catch(() => null),
        findPatientNodes(patientNode).catch(() => [patientNode]),
        loadPatientInvoices(patientNode).catch(() => []),
    ]);
    const invoiceById = Object.fromEntries((invoices || []).map((invoice) => [invoice.id, invoice]));
    const byKey = new Map();
    for (const node of nodes) {
        let snap;
        try { snap = await get(ref(database, `patientRecords/${node}`)); } catch (error) { continue; }
        Object.entries(snap.val() || {}).forEach(([key, entry]) => {
            if (!entry || !entry.reportPath || entry.copiedFrom || entry.ownerDeleted || !isDossierVersion(entry.bbCodeVersion) || byKey.has(key)) return;
            byKey.set(key, { key, entry });
        });
    }
    const forms = [...byKey.values()].map(({ key, entry }) => {
        const invoice = invoiceById[key] || null;
        // Payé : le délai court depuis le paiement (heure enregistrée par le serveur ; en attendant elle, depuis maintenant). Sans facture : gratuit.
        const phaseInvoice = invoice ? { statut: invoice.statutEffectif, payeLe: invoice.payeLe || (invoice.statutEffectif === 'paye' ? now : undefined) } : null;
        const phase = formPhase({ createdAt: entry.timestamp, invoice: phaseInvoice, immediate: entry.dossierImmediat === true }, now);
        return {
            key, version: Number(entry.bbCodeVersion), createur: entry.visibility === 'owner' ? 'patient' : 'personnel', title: entry.title || entry.originalKey || 'Dossier',
            timestamp: Number(entry.timestamp) || 0, authorName: entry.creatorName || entry.authorName || '', reportPath: entry.reportPath, invoice, jeton: entry.dossierJeton === true,
            sansCompte: entry.dossierSansCompte === true, ...phase,
        };
    }).sort((a, b) => b.timestamp - a.timestamp);
    const dossier = dossierSnap && dossierSnap.exists() ? dossierSnap.val() : null;
    const tokens = { ...emptyTokens(), ...((tokensSnap && tokensSnap.val()) || {}) };
    return { patientNode, dossier, tokens, forms, access: dossierAccess({ forms, dossier }) };
}

// Message clair quand un formulaire de dossier ne peut pas être créé ; '' si c'est permis.
export const dossierBlockMessage = (version, context) => {
    const { access } = context;
    if (Number(version) === 26) return access.canCreateUpdate ? '' : "Le dossier médical n'est pas encore créé : remplissez d'abord le Dossier Médical Basique ou Avancé (la mise à jour n'est possible qu'ensuite).";
    if (access.canCreateBasic) return '';
    if (access.initialForm) return "Vous avez déjà un dossier médical en cours : reprenez-le (bouton « Modifier » dans « Mon dossier patient » ou « Mon profil ») ou supprimez-le tant qu'il peut l'être. Une fois appliqué, on le complète par la « Mise à jour du dossier médical ».";
    return "Le dossier médical est déjà créé : on le complète désormais par la « Mise à jour du dossier médical » (Basique et Avancé ne sont plus disponibles).";
};

// Dépense un jeton gratuit du même formulaire (le compteur baisse de 1) ; true s'il y en avait un.
export async function spendDossierToken(patientNode, version, tokens) {
    const kind = dossierKindOf(version);
    if (!kind || !hasToken(tokens, version)) return false;
    try {
        await set(ref(database, `jetonsDossier/${patientNode}/${kind}`), Number(tokens[kind]) - 1);
        return true;
    } catch (error) {
        console.warn('Jeton gratuit non dépensé :', error?.message || error);
        return false;
    }
}

// Met le formulaire dans la file que la fonction serveur traite (dossiersEnAttente) ; refait à chaque enregistrement (même clé quand on reprend le formulaire).
export async function enqueueDossierForm({ patientNode, key, version, reportPath, createdAt, createur, jeton = false }) {
    await set(ref(database, `dossiersEnAttente/${patientNode}/${key}`), {
        version: Number(version), kind: dossierKindOf(version), reportPath, creeLe: Number(createdAt) || Date.now(), createur: createur === 'personnel' ? 'personnel' : 'patient', ...(jeton ? { jeton: true } : {}),
    });
}

// Le patient signale une erreur sur un formulaire rempli par le personnel et payé : il aura un jeton gratuit de mise à jour (accordé par le serveur).
export async function reportDossierError(patientNode, key) {
    await set(ref(database, `signalementsDossier/${canonicalPatientId(patientNode)}/${key}`), { creeLe: Date.now() });
}
