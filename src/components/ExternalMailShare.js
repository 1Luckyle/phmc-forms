// src/components/ExternalMailShare.js
//
// Partage des Mails Externes (formulaire 42) entre membres du personnel (voir utils/externalMails.js) :
//   • ExternalMailShareDialog : le CRÉATEUR choisit avec qui partager son mail et retire un partage quand il le souhaite. Il reste seul propriétaire (seul lui peut le modifier ou le supprimer) ;
//   • SharedExternalMails     : la section « Mails externes partagés avec moi » de « Rapports enregistrés » : lecture seule (aperçu, copie, export), pas de suppression ni de copie dans ses rapports.
import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Button, Dropdown } from 'react-bootstrap';
import Select from 'react-select';
import { ReportPreviewFrame, ExpandToggle } from './ReportExpansion';
import { copyToClipboard } from './notificationService';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../utils/reportDocumentExport';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../utils/reportExport';
import { darkSelectStyles } from '../phmc-field-data/shared/selectStyles';
import { loadShareTargets, loadMailShares, shareMail, unshareMail, loadMailsSharedWithMe, dropSharedMail } from '../utils/externalMails';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const dialog = { background: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 8, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: '16px 18px' };

// report : { reportPath, key, originalKey, title } ; ownerNode : nœud du créateur ; fromName : son nom.
export const ExternalMailShareDialog = ({ show, onHide, report, ownerNode, fromName, showNotification }) => {
    const [targets, setTargets] = useState([]);
    const [shares, setShares] = useState({});
    const [chosen, setChosen] = useState([]);
    const [busy, setBusy] = useState(false);
    const reportKey = report ? report.key : '';
    const title = report ? (report.title || report.originalKey || 'Mail externe') : '';

    useEffect(() => {
        if (!show || !reportKey) return undefined;
        let cancelled = false;
        setChosen([]);
        Promise.all([loadShareTargets(ownerNode), loadMailShares(ownerNode, reportKey)])
            .then(([list, current]) => { if (!cancelled) { setTargets(list); setShares(current); } })
            .catch(() => { if (!cancelled) showNotification('Impossible de charger la liste du personnel.', 'exclamation-circle'); });
        return () => { cancelled = true; };
    }, [show, reportKey, ownerNode, showNotification]);

    const options = useMemo(() => targets.filter((target) => !shares[target.node]).map((target) => ({ value: target.node, label: `${target.label}${target.rank ? ` (${target.rank})` : ''}`, target })), [targets, shares]);
    const sharedList = useMemo(() => Object.entries(shares).map(([node, name]) => ({ node, name })), [shares]);

    if (!show || !report) return null;

    const doShare = async () => {
        if (chosen.length === 0) return;
        setBusy(true);
        try {
            const count = await shareMail({ ownerNode, reportKey, title, fromName, recipients: chosen.map((option) => option.target) });
            setShares(await loadMailShares(ownerNode, reportKey));
            setChosen([]);
            showNotification(`Mail partagé avec ${count} personne${count > 1 ? 's' : ''}.`, 'check-circle');
        } catch (error) {
            showNotification(`Partage impossible : ${error.message || 'erreur'} (règles Firebase à déployer ?)`, 'exclamation-circle', 8000);
        } finally { setBusy(false); }
    };

    const doUnshare = async (node, name) => {
        setBusy(true);
        try {
            await unshareMail({ ownerNode, reportKey, node });
            setShares((previous) => { const next = { ...previous }; delete next[node]; return next; });
            showNotification(`Partage retiré pour ${name}.`, 'check-circle');
        } catch (error) {
            showNotification(`Impossible de retirer le partage : ${error.message || 'erreur'}`, 'exclamation-circle');
        } finally { setBusy(false); }
    };

    return ReactDOM.createPortal(
        <div style={overlay} onClick={onHide}>
            <div style={dialog} onClick={(event) => event.stopPropagation()} data-no-tip="1">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <h6 className="mb-0"><i className="fas fa-share-nodes me-2"></i>Partager ce mail externe</h6>
                    <button type="button" onClick={onHide} aria-label="Fermer" style={{ background: 'none', border: 0, color: '#8b949e', fontSize: '1.4rem', lineHeight: 1 }}>&times;</button>
                </div>
                <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 10 }}>{title}</div>
                <p style={{ fontSize: '0.85rem' }}>
                    Les personnes choisies peuvent <strong>lire</strong> ce mail dans leurs rapports enregistrés (section « partagés avec moi »). Vous en restez le <strong>seul propriétaire</strong> :
                    vous seul pouvez le modifier ou le supprimer, et vous retirez un partage quand vous le souhaitez.
                </p>
                <Select
                    isMulti options={options} value={chosen} onChange={(selected) => setChosen(selected || [])} styles={darkSelectStyles}
                    placeholder="Choisir des membres du personnel… (vous pouvez taper pour rechercher)" noOptionsMessage={() => 'Personne d’autre à ajouter'}
                />
                <div className="d-flex justify-content-end mt-2 mb-3">
                    <Button size="sm" variant="primary" onClick={doShare} disabled={busy || chosen.length === 0}>Partager</Button>
                </div>
                <strong style={{ fontSize: '0.9rem' }}>Déjà partagé avec</strong>
                {sharedList.length === 0
                    ? <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>Personne pour l'instant.</div>
                    : sharedList.map(({ node, name }) => (
                        <div key={node} className="d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid #30363d', padding: '6px 0' }}>
                            <span>{name}</span>
                            <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => doUnshare(node, name)}>Retirer le partage</Button>
                        </div>
                    ))}
            </div>
        </div>,
        document.body,
    );
};

const fmt = (ms) => (ms ? new Date(ms).toLocaleString() : '');

// myNode : mon nœud de rapports. Rien n'est affiché s'il n'y a aucun mail partagé avec moi.
export const SharedExternalMails = ({ myNode, showNotification, refreshKey = 0 }) => {
    const { bbcodeEnabled } = useSiteConfig();
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState({});
    const [listOpen, setListOpen] = useState(true);

    useEffect(() => {
        if (!myNode) return undefined;
        let cancelled = false;
        loadMailsSharedWithMe(myNode).then((list) => { if (!cancelled) setItems(list); }).catch(() => {});
        return () => { cancelled = true; };
    }, [myNode, refreshKey]);

    if (!myNode || items.length === 0) return null;
    const drop = async (item) => {
        if (!window.confirm('Retirer ce mail de votre liste ? Il reste chez son créateur.')) return;
        try { await dropSharedMail(myNode, item.id); setItems((previous) => previous.filter((entry) => entry.id !== item.id)); } catch (error) { showNotification('Impossible de retirer ce mail de votre liste.', 'exclamation-circle'); }
    };

    return (
        <section className="rpt-section" data-no-tip="1">
            <div className="d-flex align-items-center justify-content-between mb-2">
                <strong><i className="fas fa-envelope-open-text me-2"></i>Mails externes partagés avec moi ({items.length})</strong>
                <Button size="sm" variant="outline-secondary" onClick={() => setListOpen((value) => !value)}>{listOpen ? 'Replier' : 'Déplier'}</Button>
            </div>
            {listOpen && items.map((item) => (
                <div key={item.id} style={{ border: '1px solid #30363d', borderLeft: '4px solid #a371f7', borderRadius: 6, padding: '8px 12px', marginBottom: 8, background: '#0d1117' }}>
                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                    <div style={{ color: '#8b949e', fontSize: '0.8rem' }}>Partagé par {item.de || 'un collègue'} · {fmt(item.le)} · lecture seule</div>
                    <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                        <ExpandToggle open={!!open[item.id]} onClick={() => setOpen((previous) => ({ ...previous, [item.id]: !previous[item.id] }))} title="Montrer ou cacher l'aperçu du mail" />
                        <Dropdown className="d-inline-block">
                            <Dropdown.Toggle size="sm" variant="secondary">Copier</Dropdown.Toggle>
                            <Dropdown.Menu className="dossier-menu" popperConfig={{ strategy: 'fixed' }}>
                                {bbcodeEnabled && <Dropdown.Item onClick={() => copyToClipboard(item.bbCode, showNotification, 'BBCode copié !')} title={COPY_BBCODE_HINT}>Copier le BBCode</Dropdown.Item>}
                                <Dropdown.Item onClick={() => downloadBbCodeAsHtml({ bbCode: item.bbCode, title: item.title, showNotification })} title={DOWNLOAD_HTML_HINT}>Télécharger le HTML</Dropdown.Item>
                                <Dropdown.Item onClick={() => exportReportDocument('pdf', { bbCode: item.bbCode, title: item.title, showNotification })}>{PDF_EXPORT_LABEL}</Dropdown.Item>
                                <Dropdown.Item onClick={() => exportReportDocument('png', { bbCode: item.bbCode, title: item.title, showNotification })}>Télécharger l'image (PNG)</Dropdown.Item>
                                <Dropdown.Item onClick={() => exportReportDocument('png-copy', { bbCode: item.bbCode, title: item.title, showNotification })}>Copier l'image</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                        <Button size="sm" variant="outline-secondary" className="ms-auto" onClick={() => drop(item)} title="Retire ce mail de votre liste (il reste chez son créateur)">Retirer de ma liste</Button>
                    </div>
                    {open[item.id] && <div className="mt-2"><ReportPreviewFrame bbCode={item.bbCode} title={item.title} height={380} /></div>}
                </div>
            ))}
        </section>
    );
};
