// src/utils/dossierPatient.js
//
// Dossier patient, côté application (lectures et écritures Firebase) : voir utils/dossierCore.js pour les règles pures et la fonction serveur
// reconcileDossiers (functions/index.js) qui alimente réellement le dossier. Ce module sert à l'enregistrement des formulaires 25 / 3 / 26, à leur verrou
// (15 minutes après paiement), aux jetons gratuits, et à l'affichage du dossier.
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from './patientId';
import { findPatientNodes, comprehensiveSanitize } from './patientRecords';
import { loadPatientInvoices } from './patientInvoices';
import { staffNameParts } from './staffAdmin';
import {
    isDossierVersion, dossierKindOf, formPhase, dossierAccess, canModifyForm, hasToken, emptyTokens,
} from './dossierCore';

export { isDossierVersion, dossierKindOf, canModifyForm };

// Formulaires de dossier encore existants d'un patient, avec leur phase (brouillon / fenêtre de 15 minutes / verrouillé) ; le dossier persistant ; les jetons.
//   → { patientNode, dossier, tokens, forms: [{ key, version, createur, title, timestamp, authorName, reportPath, invoice, phase, startAt, lockAt }], access }
// `self` : { myPatientID, staffName } de la personne connectée. Un membre du personnel qui a rempli SON PROPRE dossier (son ID patient, créé sous son nom) est le patient de ce formulaire :
// il le gère comme un patient (modifier, supprimer dans le délai), même si le formulaire a été partagé ou enregistré sous son compte du personnel.
const sameName = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
export const isSelfPatient = (self, patientNode) => !!self && !!self.myPatientID && canonicalPatientId(self.myPatientID) === canonicalPatientId(patientNode);

// Identité du COMPTE (Civil, ou fiche du personnel) dont l'ID patient est celui-ci : c'est elle qui prime sur le dossier à l'affichage (les coordonnées se modifient gratuitement
// dans « Mon profil »). Sert à la vue du personnel, pour qu'elle montre le même dossier que le patient. {} si le patient n'a pas de compte.
// ID patient d'une fiche du personnel (comme staffPatientNodeOf côté serveur).
const staffPatientNode = (member) => {
    if (member && member.gtawCharacterId != null) return `PHMC-${member.gtawCharacterId}`;
    const badge = String((member && member.badge) || '');
    const digits = badge.includes('-') ? badge.split('-').slice(1).join('') : badge.replace(/\D/g, '');
    return digits ? `PHMC-${digits}` : '';
};

// Fiches du personnel indexées par ID patient : une personne du personnel a UN nom (celui de sa fiche d'employé), même si un profil Civil lui est aussi lié.
export async function loadStaffByPatientNode() {
    const found = new Map();
    for (const path of ['staff/phmc', 'staff/coroner']) {
        let members = {};
        try { members = (await get(ref(database, path))).val() || {}; } catch (error) { continue; }
        Object.values(members).forEach((member) => {
            const node = member ? canonicalPatientId(staffPatientNode(member)) : '';
            if (node && !found.has(node)) found.set(node, member);
        });
    }
    return found;
}

export async function loadAccountIdentity(patientID) {
    const patientNode = canonicalPatientId(patientID);
    if (!patientNode) return {};
    try {
        // La fiche du personnel prime : c'est elle qui porte le nom d'employé ; le profil Civil lié sert seulement quand il n'y a pas de fiche.
        const member = (await loadStaffByPatientNode()).get(patientNode);
        if (member) {
            const parts = staffNameParts(member);
            return {
                patientFirstName: parts.firstName, patientMiddleName: member.middleName, patientLastName: parts.lastName, patientPH: member.phNumber, patientDiscord: member.discord,
                patientAddress: member.address, patientZIP: member.zip, patientEmail: member.email, patientDateOfBirth: member.dateOfBirth, patientGender: member.gender,
            };
        }
        const civilians = (await get(ref(database, 'civilians'))).val() || {};
        const civil = Object.values(civilians).find((c) => c && c.patientID && canonicalPatientId(c.patientID) === patientNode);
        if (civil) {
            return {
                patientFirstName: civil.firstName, patientMiddleName: civil.middleName, patientLastName: civil.lastName, patientPH: civil.phone, patientDiscord: civil.discord,
                patientAddress: civil.address, patientZIP: civil.zip, patientEmail: civil.email, patientDateOfBirth: civil.dateOfBirth,
            };
        }
    } catch (error) { /* lecture refusée : on affiche le dossier tel quel */ }
    return {};
}

export async function loadDossierContext(patientID, now = Date.now(), self = null) {
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
        // Rempli par soi-même : même nom d'auteur, ou rapport rangé dans le nœud de rapports de la personne (plus fiable que le nom, qui peut varier d'écriture).
        const ownNode = !!self && !!self.staffName && String(entry.reportPath || '').split('/')[1] === comprehensiveSanitize(self.staffName);
        const selfMade = isSelfPatient(self, patientNode) && (sameName(entry.creatorName || entry.authorName, self.staffName) || ownNode);
        return {
            key, version: Number(entry.bbCodeVersion), createur: entry.visibility === 'owner' || selfMade ? 'patient' : 'personnel', title: entry.title || entry.originalKey || 'Dossier',
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
