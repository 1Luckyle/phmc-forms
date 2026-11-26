// src/components/Accounting/DueInvoicesManager.js
//
// Comptabilité → « Factures en attente » (VERSION CLASSIQUE du site, paiement en jeu) : toutes les factures encore dues, tous patients confondus,
// regroupées par patient, avec le total. Pour chaque patient : la liste de ses factures avec « Marquer payé », « Dispenser » et l'historique
// (PatientInvoicesPanel en mode personnel ; le serveur settleInvoices revérifie les droits et refuse sa propre facture).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { loadAllDueInvoices } from '../../utils/patientInvoices';
import { formatMoney } from '../../utils/patientBilling';
import PatientInvoicesPanel from '../PatientInvoicesPanel';

const DueInvoicesManager = ({ showNotification }) => {
    const [invoices, setInvoices] = useState(null);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState('');

    const reload = useCallback(async () => {
        setInvoices(null);
        try { setInvoices(await loadAllDueInvoices()); } catch (error) {
            setInvoices([]);
            if (showNotification) showNotification(`Factures illisibles : ${error.message || error}`, 'error');
        }
    }, [showNotification]);
    useEffect(() => { reload(); }, [reload]);

    // Un groupe par patient : { patientNode, nom, factures, total, plusAncienne }.
    const groups = useMemo(() => {
        const byPatient = new Map();
        (invoices || []).filter((invoice) => !invoice.exemptionEnAttente).forEach((invoice) => {
            const group = byPatient.get(invoice.patientNode) || { patientNode: invoice.patientNode, nom: invoice.patientNom || '', factures: [], total: 0, plusAncienne: invoice.creeLe || 0 };
            group.factures.push(invoice);
            group.total += Number(invoice.montant || 0);
            if (!group.nom && invoice.patientNom) group.nom = invoice.patientNom;
            byPatient.set(invoice.patientNode, group);
        });
        const needle = query.trim().toLowerCase();
        return [...byPatient.values()]
            .filter((group) => !needle || group.patientNode.toLowerCase().includes(needle) || group.nom.toLowerCase().includes(needle))
            .sort((a, b) => a.plusAncienne - b.plusAncienne);
    }, [invoices, query]);
    const grandTotal = groups.reduce((sum, group) => sum + group.total, 0);

    return (
        <div>
            <p className="text-muted">
                Les patients règlent en jeu. Le personnel coche le paiement depuis le dossier du patient (ou ici) ; la Comptabilité peut aussi annuler un
                paiement coché par erreur ou dispenser une facture. Les factures en attente d'une décision d'exemption n'apparaissent pas.
            </p>
            <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
                <input type="search" className="form-control" style={{ maxWidth: 320 }} placeholder="Rechercher un patient (nom ou ID)…" value={query} onChange={(event) => setQuery(event.target.value)} />
                <Button size="sm" variant="outline-secondary" onClick={reload} disabled={invoices === null}><i className="fas fa-rotate me-1"></i>Actualiser</Button>
                {invoices !== null && <strong className="ms-auto">{groups.length} patient{groups.length > 1 ? 's' : ''} · {formatMoney(grandTotal)} à encaisser</strong>}
            </div>
            {invoices === null && <Spinner size="sm" animation="border" />}
            {invoices !== null && groups.length === 0 && <p className="text-muted mb-0">Aucune facture en attente.</p>}
            {groups.map((group) => (
                <div key={group.patientNode} style={{ border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px', marginBottom: 8, background: '#0d1117' }}>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                        <strong>{group.nom || 'Patient'}</strong>
                        <span className="text-muted">{group.patientNode}</span>
                        <span className="text-muted">· {group.factures.length} facture{group.factures.length > 1 ? 's' : ''} depuis le {new Date(group.plusAncienne).toLocaleDateString('fr-FR')}</span>
                        <strong className="ms-auto">{formatMoney(group.total)}</strong>
                        <Button size="sm" variant="outline-primary" onClick={() => setOpen((current) => (current === group.patientNode ? '' : group.patientNode))}>
                            {open === group.patientNode ? 'Fermer' : 'Ouvrir'}
                        </Button>
                    </div>
                    {open === group.patientNode && (
                        <div style={{ marginTop: 8 }}>
                            <PatientInvoicesPanel staffMode showPaidHistory={false} patientID={group.patientNode} showNotification={showNotification} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default DueInvoicesManager;
