// src/utils/patientInvoices.js
//
// Factures patient (Firebase) : facturesPatients/{ID patient}/{clé du rapport}.
//   reportPath, bbCodeVersion, titre, montant, statut ('a_payer' | 'paye' | 'sans_paiement'),
//   creePar, creeLe, patientNom, patientEmail, paiementId, lienPaiement, payeLe,
//   mailEnvoyeLe / dernierRappelLe (écrits par les fonctions planifiées).
// facturesEnAttente/{ID patient}/{clé} = file des factures à payer, lue uniquement par le serveur
// (mails groupés + rappel quotidien) pour ne pas parcourir tout l'historique à chaque passage.
//
// Le statut « paye » n'est écrit que par le serveur (webhook Fleeca / contrôle de statut) : voir
// functions/index.js et database.rules.json.
import { ref, get, update, onValue } from 'firebase/database';
import { database, auth } from '../firebase';
import { canonicalPatientId } from './patientId';
import {
    computeBilling, isBillableVersion, effectiveInvoiceStatus, INVOICE_STATUS, totalDue,
} from './patientBilling';

const CREATE_INVOICE_PAYMENT_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/createInvoicePayment';

// Écrit la facture d'un rapport qui vient d'être sauvegardé (best-effort côté appelant).
// Retourne la facture écrite, ou null si le formulaire n'est pas facturé / sans patient.
export async function recordInvoiceForReport({
    patientID, indexKey, reportPath, bbCodeVersion, title, formData, createdBy,
}) {
    if (!isBillableVersion(bbCodeVersion)) return null;
    const node = canonicalPatientId(patientID);
    if (!node || !indexKey) return null;

    const { baseAmount, amount } = computeBilling(bbCodeVersion, formData);
    if (baseAmount <= 0) return null;

    const now = Date.now();
    const patientName = formData.patientName
        || [formData.patientFirstName, formData.patientLastName].filter(Boolean).join(' ')
        || null;
    const invoice = {
        reportPath,
        bbCodeVersion: Number(bbCodeVersion),
        titre: title || '',
        montant: amount > 0 ? amount : baseAmount,
        statut: amount > 0 ? INVOICE_STATUS.A_PAYER : INVOICE_STATUS.SANS_PAIEMENT,
        creePar: createdBy || null,
        creeLe: now,
        patientNom: patientName,
        patientEmail: formData.patientEmail || null,
        paiementId: formData.fleecaPaymentId || null,
    };
    const updates = { [`facturesPatients/${node}/${indexKey}`]: invoice };
    if (amount > 0) updates[`facturesEnAttente/${node}/${indexKey}`] = now;
    await update(ref(database), updates);
    return invoice;
}

// Lit les factures d'un patient (toutes les variantes de son ID) et leur paiement Fleeca éventuel.
// → [{ id, patientNode, ...facture, statutEffectif, payment }] triées de la plus récente à la plus ancienne.
export async function loadPatientInvoices(inputId) {
    // Les factures sont toujours rangées sous l'ID canonique (PHMC-2752).
    const node = canonicalPatientId(inputId);
    if (!node) return [];
    const snap = await get(ref(database, `facturesPatients/${node}`));
    const invoices = Object.entries(snap.val() || {})
        .filter(([, invoice]) => invoice)
        .map(([id, invoice]) => ({ id, patientNode: node, ...invoice }));
    return resolveInvoices(invoices);
}

// Abonnement en direct aux factures d'un patient (nœud canonique) — utilisé par l'écran de notification
// pour que « payé » apparaisse tout seul au retour de Fleeca. Retourne la fonction de désabonnement.
export function subscribeToPatientInvoices(inputId, callback) {
    const node = canonicalPatientId(inputId);
    if (!node) { callback([]); return () => {}; }
    let version = 0;
    const unsubscribe = onValue(ref(database, `facturesPatients/${node}`), async (snap) => {
        const current = ++version;
        const invoices = Object.entries(snap.val() || {})
            .filter(([, invoice]) => invoice)
            .map(([id, invoice]) => ({ id, patientNode: node, ...invoice }));
        const resolved = await resolveInvoices(invoices);
        if (current === version) callback(resolved);
    }, (error) => {
        console.warn('Invoices subscription failed:', error);
        callback([]);
    });
    return () => { version++; unsubscribe(); };
}

async function resolveInvoices(invoices) {
    const paymentIds = [...new Set(invoices
        .filter((invoice) => invoice.statut === INVOICE_STATUS.A_PAYER)
        .map((invoice) => invoice.paiementId)
        .filter(Boolean))];
    const payments = {};
    await Promise.all(paymentIds.map(async (paymentId) => {
        try {
            const snap = await get(ref(database, `fleecaPayments/${paymentId}`));
            if (snap.exists()) payments[paymentId] = snap.val();
        } catch (error) {
            console.warn('Could not read payment', paymentId, error);
        }
    }));
    return invoices
        .map((invoice) => {
            const payment = invoice.paiementId ? payments[invoice.paiementId] || null : null;
            return { ...invoice, payment, statutEffectif: effectiveInvoiceStatus(invoice, payment) };
        })
        .sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));
}

// Index { clé du rapport → facture résolue } pour afficher l'état de paiement dans les listes de rapports.
export async function loadInvoiceIndex(inputId) {
    const invoices = await loadPatientInvoices(inputId);
    return Object.fromEntries(invoices.map((invoice) => [invoice.id, invoice]));
}

export { totalDue };

// Crée UN lien Fleeca couvrant les factures demandées (une ou toutes). Le montant est recalculé côté
// serveur d'après les factures — jamais d'après ce que le navigateur envoie.
// Retourne { payment_id, payment_link, amount }.
export async function createInvoicePayment({ patientID, invoiceIds }) {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    if (!token) throw new Error('Connexion requise pour payer.');
    const response = await fetch(CREATE_INVOICE_PAYMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientID: canonicalPatientId(patientID), invoiceIds }),
    });
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        throw new Error(`Réponse invalide du serveur de paiement. Reçue : ${text.substring(0, 200)}`);
    }
    if (!response.ok) throw new Error(data.message || data.error || 'Impossible de créer le paiement.');
    return data;
}
