// src/components/PatientInvoicesPanel.js
//
// Factures d'un patient (rapports médicaux payants rédigés par le personnel ou par lui-même) :
// état de chaque facture (à payer / payé / sans paiement), paiement d'une facture ou de toutes d'un coup
// (total affiché) via un lien Fleeca. Utilisé par la fenêtre de notification à la connexion, par
// « Dossier Patient » du civil et par « Mon dossier patient » du personnel.
// Version classique du site : pas de lien Fleeca, le patient règle en jeu ; en mode personnel (staffMode : dossier d'un patient,
// Comptabilité → Factures en attente), « Marquer payé », et pour la Comptabilité « Dispenser » / « Annuler le paiement ».
import React, { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { subscribeToPatientInvoices, createInvoicePayment, settleInvoices } from '../utils/patientInvoices';
import { useSiteMode } from '../contexts/SiteConfigContext';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { useAccountingAccess } from '../utils/accountingAccess';
import { canonicalPatientId } from '../utils/patientId';
import { checkFleecaPaymentStatus } from '../utils/fleecaPayment';
import {
    INVOICE_STATUS, INVOICE_STATUS_COLORS, invoiceStatusLabel, formatMoney, totalDue,
} from '../utils/patientBilling';
import './Reports/Reports.css';


export const InvoiceStatusBadge = ({ status }) => (
    <span
        style={{
            display: 'inline-block', padding: '1px 9px', borderRadius: '10px', fontSize: '0.8em', whiteSpace: 'nowrap',
            color: INVOICE_STATUS_COLORS[status] || '#8b949e', border: `1px solid ${INVOICE_STATUS_COLORS[status] || '#30363d'}`,
        }}
    >
        {invoiceStatusLabel(status)}
    </span>
);

// staffMode : vue du PERSONNEL sur le dossier d'un patient (version classique) — « Marquer payé » (paiement reçu en jeu), et pour la Comptabilité
// « Annuler le paiement » / « Dispenser ». Le serveur (settleInvoices) revérifie les droits et refuse sa propre facture.
const PatientInvoicesPanel = ({ patientID, showNotification, onInvoices, showPaidHistory = true, staffMode = false }) => {
    const { isClassic } = useSiteMode();
    const { isAdmin, myPatientID } = useEmployeeAuth();
    const isComptable = useAccountingAccess(isAdmin);
    const [invoices, setInvoices] = useState(null);
    const [busy, setBusy] = useState(null); // id de facture, 'all' ou 'check'
    const ownFile = !!myPatientID && canonicalPatientId(myPatientID) === canonicalPatientId(patientID);
    const canSettle = isClassic && staffMode && !ownFile;

    const settle = async (ids, action, key) => {
        let note = '';
        if (action !== 'payer') {
            const answer = window.prompt(action === 'annuler' ? 'Motif de l\'annulation du paiement (facture de nouveau à payer) :' : 'Motif de la dispense (rien à payer) :', '');
            if (answer === null) return;
            note = answer.trim();
        } else if (!window.confirm(`Confirmer que le patient a réglé ${ids.length > 1 ? `ces ${ids.length} factures` : 'cette facture'} en jeu ? Le paiement sera enregistré à votre nom.`)) {
            return;
        }
        setBusy(key);
        try {
            const result = await settleInvoices({ patientID, invoiceIds: ids, action, note });
            notify({
                payer: `Paiement enregistré : ${formatMoney(result.total)}.`,
                annuler: 'Paiement annulé : facture de nouveau à payer.',
                dispenser: 'Facture dispensée : rien à payer.',
            }[action], 'success');
        } catch (error) {
            notify(error.message || 'Mise à jour impossible.', 'error');
        } finally {
            setBusy(null);
        }
    };

    useEffect(() => {
        if (!patientID) { setInvoices([]); return undefined; }
        return subscribeToPatientInvoices(patientID, (list) => {
            setInvoices(list);
            if (onInvoices) onInvoices(list);
        });
        // onInvoices volontairement hors dépendances (callback instable : ne doit pas réabonner).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientID]);

    const notify = (message, type) => { if (showNotification) showNotification(message, type); };

    const pay = async (ids, key) => {
        setBusy(key);
        try {
            const result = await createInvoicePayment({ patientID, invoiceIds: ids });
            window.open(result.payment_link, '_blank', 'noopener,noreferrer');
            notify(`Lien de paiement Fleeca ouvert (${formatMoney(result.amount)}). L'état se met à jour tout seul une fois le paiement effectué.`, 'info-circle');
        } catch (error) {
            console.error('Invoice payment failed:', error);
            notify(error.message || 'Impossible de créer le paiement.', 'error');
        } finally {
            setBusy(null);
        }
    };

    // Repli du webhook : interroge Fleeca pour chaque paiement en cours (le serveur règle alors les factures).
    const checkPayments = async () => {
        const paymentIds = [...new Set((invoices || [])
            .filter((invoice) => invoice.statutEffectif === INVOICE_STATUS.A_PAYER && invoice.paiementId)
            .map((invoice) => invoice.paiementId))];
        if (paymentIds.length === 0) { notify('Aucun paiement en cours à vérifier.', 'info-circle'); return; }
        setBusy('check');
        try {
            for (const paymentId of paymentIds) await checkFleecaPaymentStatus(paymentId);
            notify('Paiements vérifiés.', 'success');
        } catch (error) {
            notify(error.message || 'Impossible de vérifier le paiement.', 'error');
        } finally {
            setBusy(null);
        }
    };

    if (invoices === null) return <p style={{ color: '#8b949e' }}>Chargement des factures…</p>;

    const due = invoices.filter((invoice) => invoice.statutEffectif === INVOICE_STATUS.A_PAYER && !invoice.exemptionEnAttente);
    const awaitingExemption = invoices.filter((invoice) => invoice.statutEffectif === INVOICE_STATUS.A_PAYER && invoice.exemptionEnAttente);
    const shown = showPaidHistory ? invoices : [...due, ...awaitingExemption];
    if (shown.length === 0) {
        return <p style={{ color: '#8b949e', margin: 0 }}>Aucune facture{showPaidHistory ? '' : ' à payer'}.</p>;
    }

    return (
        <div>
            <div className="inv-list">
                {shown.map((invoice) => (
                    <div key={`${invoice.patientNode}-${invoice.id}`} className="inv-row" style={{ '--c': INVOICE_STATUS_COLORS[invoice.statutEffectif] || '#8b949e' }}>
                        <span className="inv-title" title={invoice.titre}>
                            {invoice.titre || invoice.id}
                            <small>{invoice.creeLe ? new Date(invoice.creeLe).toLocaleDateString('fr-FR') : '—'}</small>
                        </span>
                        <span className="inv-amount">{invoice.statutEffectif === INVOICE_STATUS.SANS_PAIEMENT ? '—' : formatMoney(invoice.montant)}</span>
                        {invoice.exemptionEnAttente
                            ? <span style={{ display: 'inline-block', padding: '1px 9px', borderRadius: '10px', fontSize: '0.8em', color: '#58a6ff', border: '1px solid #58a6ff' }} title="Votre demande d'exemption est examinée par le personnel administratif.">En attente de traitement pour l'exemption</span>
                            : <InvoiceStatusBadge status={invoice.statutEffectif} />}
                        {!isClassic && !staffMode && invoice.statutEffectif === INVOICE_STATUS.A_PAYER && !invoice.exemptionEnAttente && (
                            <Button size="sm" variant="success" disabled={!!busy} onClick={() => pay([invoice.id], invoice.id)}>
                                {busy === invoice.id ? 'Création…' : 'Payer'}
                            </Button>
                        )}
                        {canSettle && invoice.statutEffectif === INVOICE_STATUS.A_PAYER && !invoice.exemptionEnAttente && (
                            <Button size="sm" variant="success" disabled={!!busy} onClick={() => settle([invoice.id], 'payer', invoice.id)}>
                                {busy === invoice.id ? '…' : 'Marquer payé'}
                            </Button>
                        )}
                        {canSettle && isComptable && invoice.statutEffectif === INVOICE_STATUS.A_PAYER && !invoice.exemptionEnAttente && (
                            <Button size="sm" variant="outline-secondary" disabled={!!busy} onClick={() => settle([invoice.id], 'dispenser', `d-${invoice.id}`)} title="Comptabilité : rien à payer pour cette facture">Dispenser</Button>
                        )}
                        {canSettle && isComptable && invoice.statut === INVOICE_STATUS.PAYE && invoice.modePaiement === 'en_jeu' && (
                            <Button size="sm" variant="outline-danger" disabled={!!busy} onClick={() => settle([invoice.id], 'annuler', `a-${invoice.id}`)} title="Comptabilité : paiement coché par erreur, la facture redevient à payer">Annuler le paiement</Button>
                        )}
                        {invoice.statut === INVOICE_STATUS.PAYE && invoice.encaissePar?.nom && (
                            <small style={{ color: '#8b949e' }} title="Paiement reçu en jeu">encaissé par {invoice.encaissePar.nom}{invoice.payeLe ? ` le ${new Date(invoice.payeLe).toLocaleDateString('fr-FR')}` : ''}</small>
                        )}
                    </div>
                ))}
            </div>

            {due.length > 0 && (
                <div className="inv-total">
                    <strong>Total à payer : {formatMoney(totalDue(invoices))}</strong>
                    {isClassic && !staffMode && <span style={{ color: '#8b949e' }}>À régler en jeu, auprès du personnel du PHMC : il marquera vos factures comme payées.</span>}
                    {canSettle && due.length > 1 && (
                        <Button variant="success" disabled={!!busy} onClick={() => settle(due.map((invoice) => invoice.id), 'payer', 'all')}>
                            {busy === 'all' ? '…' : `Tout marquer payé (${due.length} factures)`}
                        </Button>
                    )}
                    {isClassic && staffMode && ownFile && <span style={{ color: '#8b949e' }}>Votre propre dossier : un collègue doit enregistrer votre paiement.</span>}
                    {!isClassic && !staffMode && due.length > 1 && (
                        <Button variant="success" disabled={!!busy} onClick={() => pay(due.map((invoice) => invoice.id), 'all')}>
                            {busy === 'all' ? 'Création…' : `Tout payer (${due.length} factures)`}
                        </Button>
                    )}
                    {!isClassic && !staffMode && (
                        <Button variant="outline-secondary" size="sm" disabled={!!busy} onClick={checkPayments}>
                            {busy === 'check' ? 'Vérification…' : 'J’ai payé : vérifier'}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PatientInvoicesPanel;
