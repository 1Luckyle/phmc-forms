// src/components/Reports/ReportParts.js
//
// Briques communes de « Rapports enregistrés » et « Dossier Patient » (même présentation que les demandes CCTV et le suivi du
// recrutement) : filtres à pastilles avec compteurs, carte d'un rapport (titre, méta, pastilles, barre d'actions, aperçu),
// pastille d'état de paiement et barre d'actions de la sélection.
import React from 'react';
import { Form } from 'react-bootstrap';
import { INVOICE_STATUS_COLORS, invoiceStatusLabel, formatMoney } from '../../utils/patientBilling';
import '../Cctv/CctvRequests.css';
import './Reports.css';

// Pastille colorée (statut, visibilité, copies…).
export const Pill = ({ color = '#8b949e', title, children }) => (
    <span className="rpt-pill" style={{ '--c': color }} title={title}><span className="cctv-dot"></span>{children}</span>
);

// État de paiement d'un rapport payant (facture résolue) ; rien si le rapport n'est pas facturé.
export const PaymentPill = ({ invoice }) => {
    if (!invoice) return null;
    const status = invoice.statutEffectif;
    return (
        <Pill color={INVOICE_STATUS_COLORS[status] || '#8b949e'} title="État de paiement du rapport">
            {invoiceStatusLabel(status)}
            {status !== 'sans_paiement' && <span className="rpt-pill-sub">{formatMoney(invoice.montant)}</span>}
        </Pill>
    );
};

// Filtres à pastilles : items = [{ key, label, count, color }] ; les pastilles à 0 sont masquées (sauf « all » et celle active).
export const FilterChips = ({ items, value, onChange, label = 'Filtrer' }) => (
    <div className="cctv-filters" role="group" aria-label={label}>
        {items.filter((item) => item.key === 'all' || item.count > 0 || item.key === value).map((item) => (
            <button key={item.key} type="button" className={value === item.key ? 'on' : ''} style={{ '--c': item.color || '#58a6ff' }} onClick={() => onChange(item.key)}>
                {item.label} <span>{item.count}</span>
            </button>
        ))}
    </div>
);

// Carte d'un rapport. `actions` : boutons (toujours visibles) ; `expansion` : aperçu déplié sous la carte.
export const ReportCard = ({ color = '#58a6ff', selected, onSelect, selectId, title, titleHint, meta, chips, actions, expansion, dimmed }) => (
    <div className={`rpt-card${selected ? ' selected' : ''}${dimmed ? ' dim' : ''}`} style={{ '--c': color }}>
        <div className="rpt-head">
            {onSelect && (
                <Form.Check
                    type="checkbox" id={selectId} className="rpt-check" checked={!!selected}
                    onChange={(event) => onSelect(event.target.checked)} aria-label="Sélectionner ce rapport"
                />
            )}
            <span className="rpt-main" title={titleHint || undefined}>
                <strong>{title}</strong>
                {meta && <small>{meta}</small>}
            </span>
            {chips && <span className="rpt-chips">{chips}</span>}
        </div>
        {actions && <div className="rpt-actions">{actions}</div>}
        {expansion && <div className="rpt-expansion">{expansion}</div>}
    </div>
);

// Barre du bas : actions sur la sélection. Toujours présente quand il y a des rapports (compteur + boutons).
export const BulkBar = ({ count, onClear, children }) => (
    <div className="rpt-bulk">
        <span className="rpt-bulk-count">
            {count > 0 ? <><strong>{count}</strong> sélectionné{count > 1 ? 's' : ''}{onClear && <button type="button" className="rpt-link" onClick={onClear}>Tout désélectionner</button>}</> : 'Cochez des rapports pour agir sur plusieurs à la fois.'}
        </span>
        <span className="rpt-bulk-actions">{children}</span>
    </div>
);

export const Pager = ({ page, pages, onPrev, onNext }) => (pages > 1 ? (
    <div className="rpt-pager">
        <button type="button" onClick={onPrev} disabled={page === 1}><i className="fas fa-chevron-left"></i> Précédent</button>
        <span>Page {page} sur {pages}</span>
        <button type="button" onClick={onNext} disabled={page === pages}>Suivant <i className="fas fa-chevron-right"></i></button>
    </div>
) : null);
