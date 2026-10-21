// src/components/PatientInvoicesPanel.js
//
// Factures d'un patient (rapports médicaux payants rédigés par le personnel ou par lui-même) :
// état de chaque facture (à payer / payé / sans paiement), paiement d'une facture ou de toutes d'un coup
// (total affiché) via un lien Fleeca. Utilisé par la fenêtre de notification à la connexion, par
// « Dossier Patient » du civil et par « Mon dossier patient » du personnel.
import React, { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { subscribeToPatientInvoices, createInvoicePayment } from '../utils/patientInvoices';
import { checkFleecaPaymentStatus } from '../utils/fleecaPayment';
import {
    INVOICE_STATUS, INVOICE_STATUS_COLORS, invoiceStatusLabel, formatMoney, totalDue,
} from '../utils/patientBilling';

const thStyle = { backgroundColor: '#161b22', border: '1px solid #30363d', padding: '8px 10px', textAlign: 'left' };
const tdStyle = { border: '1px solid #30363d', padding: '8px 10px', verticalAlign: 'middle' };

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

const PatientInvoicesPanel = ({ patientID, showNotification, onInvoices, showPaidHistory = true }) => {
    const [invoices, setInvoices] = useState(null);
    const [busy, setBusy] = useState(null); // id de facture, 'all' ou 'check'

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

    const due = invoices.filter((invoice) => invoice.statutEffectif === INVOICE_STATUS.A_PAYER);
    const shown = showPaidHistory ? invoices : due;
    if (shown.length === 0) {
        return <p style={{ color: '#8b949e', margin: 0 }}>Aucune facture{showPaidHistory ? '' : ' à payer'}.</p>;
    }

    return (
        <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={thStyle}>Rapport</th>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Montant</th>
                        <th style={thStyle}>État</th>
                        <th style={thStyle}></th>
                    </tr>
                </thead>
                <tbody>
                    {shown.map((invoice) => (
                        <tr key={`${invoice.patientNode}-${invoice.id}`}>
                            <td style={{ ...tdStyle, maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={invoice.titre}>
                                {invoice.titre || invoice.id}
                            </td>
                            <td style={tdStyle}>{invoice.creeLe ? new Date(invoice.creeLe).toLocaleDateString('fr-FR') : '—'}</td>
                            <td style={tdStyle}>{invoice.statutEffectif === INVOICE_STATUS.SANS_PAIEMENT ? '—' : formatMoney(invoice.montant)}</td>
                            <td style={tdStyle}><InvoiceStatusBadge status={invoice.statutEffectif} /></td>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                {invoice.statutEffectif === INVOICE_STATUS.A_PAYER && (
                                    <Button size="sm" variant="success" disabled={!!busy} onClick={() => pay([invoice.id], invoice.id)}>
                                        {busy === invoice.id ? 'Création…' : 'Payer'}
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {due.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
                    <strong>Total à payer : {formatMoney(totalDue(invoices))}</strong>
                    {due.length > 1 && (
                        <Button variant="success" disabled={!!busy} onClick={() => pay(due.map((invoice) => invoice.id), 'all')}>
                            {busy === 'all' ? 'Création…' : `Tout payer (${due.length} factures)`}
                        </Button>
                    )}
                    <Button variant="outline-secondary" size="sm" disabled={!!busy} onClick={checkPayments}>
                        {busy === 'check' ? 'Vérification…' : 'J’ai payé : vérifier'}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default PatientInvoicesPanel;
