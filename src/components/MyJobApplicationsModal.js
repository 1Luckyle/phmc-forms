// src/components/MyJobApplicationsModal.js
//
// Vue Civil "Mes candidatures" (Lot 6 du plan Civil) : suivi de statut + actions (Mettre en pause / Retirer /
// Candidater) sur candidatures/{uid} (ancien nœud jobApplications lu aussi), et sur chaque candidature :
// la recharger dans son formulaire, copier le BBCode (forum PHMC, pas encore disponible), télécharger le HTML
// (forum GTA World), et déplier sous la carte l'aperçu de la candidature (images comprises), son BBCode et son
// historique de statuts.
import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Button } from 'react-bootstrap';
import { removeApplication } from '../utils/recruitmentStore';
import { useDebug } from '../contexts/DebugContext';
import { useData } from '../contexts/DataContext';
import { positionLabelFor } from '../constants/recruitment';
import { copyToClipboard } from './notificationService';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../utils/reportExport';
import ForumHint from './ForumHint';
import useForumNotice from '../hooks/useForumNotice';
import ReportExpansion, { ExpandToggle, useExpansions } from './ReportExpansion';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../utils/reportDocumentExport';

const modalStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};

const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '5px', width: '95%', maxWidth: '900px', height: '80vh',
    maxHeight: '80vh', display: 'flex', flexDirection: 'column',
    overflowY: 'hidden', position: 'relative', border: '1px solid #30363d',
};

const closeButtonStyle = {
    position: 'absolute', top: '15px', right: '15px', background: 'transparent',
    border: 'none', color: '#f85149', fontSize: '28px', fontWeight: 'bold',
    lineHeight: '1', padding: '0.25rem 0.5rem', cursor: 'pointer', zIndex: 10,
};

const cardStyle = {
    backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px',
    padding: '15px', marginBottom: '12px',
};

const metaStyle = { margin: '4px 0', fontSize: '0.88em', color: '#8b949e' };

const STATUS_LABELS = {
    brouillon: { text: 'Brouillon enregistré', color: '#8b949e' },
    soumise: { text: 'Candidature envoyée', color: '#58a6ff' },
    entretien_programme: { text: 'Entretien programmé', color: '#d29922' },
    entretien_effectue: { text: 'Entretien effectué', color: '#d29922' },
    acceptee: { text: 'Acceptée', color: '#3fb950' },
    refusee: { text: 'Refusée', color: '#f85149' },
    retiree: { text: 'Retirée', color: '#8b949e' },
    en_pause: { text: 'En pause', color: '#8b949e' },
};

const ACTIVE_STATUSES = ['soumise', 'entretien_programme', 'entretien_effectue'];

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleString('fr-FR') : 'N/A');

const applicationTitle = (application) => `Candidature - ${application.poste || 'Poste'}${application.nomCandidat ? ` - ${application.nomCandidat}` : ''}`;

const MyJobApplicationsModal = ({ show, onHide, applications: rawApplications, isLoading, onUpdateStatus, showNotification, onDeleted, onLoad }) => {
    // Interrupteur Debug (panneau admin) : permet de supprimer une candidature de l'historique.
    const { debugDeleteApplicationsEnabled } = useDebug();
    const { openForumNotice, forumNoticeModal } = useForumNotice();
    const { bbcodeEnabled } = useSiteConfig();
    const { open: openRows, toggle: toggleRow, setTab: setRowTab } = useExpansions();
    // Le poste s'affiche sous son libellé français, même pour une ancienne candidature qui n'a gardé que la clé.
    const { selectOptions } = useData();
    const applications = useMemo(() => (rawApplications || []).map((application) => ({
        ...application,
        posteCle: application.posteCle ?? application.poste,
        poste: positionLabelFor(selectOptions, application.versionBBCode, application.posteCle || application.poste),
    })), [rawApplications, selectOptions]);
    if (!show) return null;

    const handleDelete = async (application) => {
        if (!window.confirm('Supprimer définitivement cette candidature de votre historique ?')) return;
        try {
            await removeApplication(application.candidatUid, application.id);
            showNotification('Candidature supprimée.', 'trash');
            if (onDeleted) onDeleted();
        } catch (error) {
            console.error('Error deleting job application:', error);
            showNotification("Suppression refusée : l'option Debug « suppression des candidatures » est-elle activée ?", 'error');
        }
    };

    const handleAction = async (application, newStatus) => {
        const result = await onUpdateStatus(application.candidatUid, application.id, newStatus);
        if (result?.success) {
            showNotification(
                newStatus === 'soumise' ? 'Candidature (re)soumise.' : 'Statut mis à jour.',
                'check-circle'
            );
        }
    };

    const handleCopyBbCode = (application) => {
        if (!application.bbcode) { showNotification('Aucun BBCode enregistré pour cette candidature.', 'warning'); return; }
        copyToClipboard(application.bbcode, showNotification, 'BBCode copié !');
    };

    const handleDownloadHtml = (application) => {
        if (downloadBbCodeAsHtml({ bbCode: application.bbcode, title: applicationTitle(application), showNotification })) {
            openForumNotice('html');
        }
    };

    const handleExportDocument = (format, application) => exportReportDocument(format, { bbCode: application.bbcode, title: applicationTitle(application), showNotification });

    const canReload = (application) => !!application.versionBBCode && !!application.donnees && Object.keys(application.donnees).length > 0;

    return ReactDOM.createPortal(
        <div style={modalStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                {forumNoticeModal}
                <h5 style={{ marginBottom: '15px' }}>Mes candidatures</h5>

                <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                    {isLoading && <p style={{ textAlign: 'center' }}>Chargement...</p>}
                    {!isLoading && applications.length === 0 && (
                        <p style={{ textAlign: 'center', marginTop: '20px' }}>
                            Aucune candidature enregistrée pour l'instant.
                        </p>
                    )}
                    {!isLoading && applications.map((application) => {
                        const statusInfo = STATUS_LABELS[application.statut] || { text: application.statut, color: '#8b949e' };
                        const history = [...(application.historique || [])].sort((a, b) => (b.horodatage || 0) - (a.horodatage || 0));
                        const historyContent = history.length === 0 ? (
                            <p style={metaStyle}>Aucun historique enregistré.</p>
                        ) : (
                            <ul style={{ paddingLeft: '1.1rem', marginBottom: 0 }}>
                                {history.map((entry, index) => (
                                    <li key={`${entry.statut}-${entry.horodatage}-${index}`} style={metaStyle}>
                                        <span style={{ color: (STATUS_LABELS[entry.statut] || {}).color || '#c9d1d9' }}>
                                            {(STATUS_LABELS[entry.statut] || {}).text || entry.statut}
                                        </span>
                                        {' — '}{formatDate(entry.horodatage)}
                                    </li>
                                ))}
                            </ul>
                        );
                        return (
                            <div key={application.id} style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '10px' }}>
                                    <strong>{application.poste || 'Poste inconnu'}</strong>
                                    <span style={{ color: statusInfo.color, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{statusInfo.text}</span>
                                </div>
                                {application.nomCandidat && (
                                    <p style={metaStyle}><i className="fas fa-user" style={{ marginRight: '6px' }}></i>Candidat : {application.nomCandidat}</p>
                                )}
                                {application.dateEntretien && (
                                    <p style={metaStyle}>
                                        <i className="fas fa-calendar-alt" style={{ marginRight: '6px' }}></i>
                                        Entretien : {formatDate(application.dateEntretien)}
                                    </p>
                                )}
                                <p style={metaStyle}>
                                    Déposée le {formatDate(application.creeLe)} · Dernière mise à jour : {formatDate(application.modifieLe)}
                                </p>

                                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {application.statut === 'brouillon' && (
                                        <Button size="sm" variant="primary" onClick={() => handleAction(application, 'soumise')}>
                                            Candidater
                                        </Button>
                                    )}
                                    {application.statut === 'en_pause' && (
                                        <Button size="sm" variant="primary" onClick={() => handleAction(application, 'soumise')}>
                                            Reprendre ma candidature
                                        </Button>
                                    )}
                                    {ACTIVE_STATUSES.includes(application.statut) && (
                                        <Button size="sm" variant="secondary" onClick={() => handleAction(application, 'en_pause')}>
                                            Mettre en pause
                                        </Button>
                                    )}
                                    {(ACTIVE_STATUSES.includes(application.statut) || application.statut === 'brouillon' || application.statut === 'en_pause') && (
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() => {
                                                if (window.confirm('Retirer cette candidature ?')) {
                                                    handleAction(application, 'retiree');
                                                }
                                            }}
                                        >
                                            Retirer
                                        </Button>
                                    )}
                                    {debugDeleteApplicationsEnabled && (
                                        <Button size="sm" variant="outline-danger" onClick={() => handleDelete(application)}
                                            title="Debug : supprime définitivement cette candidature">
                                            <i className="fas fa-trash"></i> Supprimer
                                        </Button>
                                    )}
                                </div>

                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #30363d', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {onLoad && (
                                        <Button
                                            size="sm" variant="outline-primary" disabled={!canReload(application)}
                                            title={canReload(application)
                                                ? 'Rouvre cette candidature dans son formulaire, avec ses réponses'
                                                : 'Aucune réponse enregistrée : impossible de la recharger'}
                                            onClick={() => onLoad(application)}
                                        >
                                            <i className="fas fa-upload me-1"></i>Recharger dans le formulaire
                                        </Button>
                                    )}
                                    {bbcodeEnabled && (
<Button size="sm" variant="outline-info" disabled={!application.bbcode} title={COPY_BBCODE_HINT} onClick={() => handleCopyBbCode(application)}>
                                        <i className="fas fa-copy me-1"></i>Copier le BBCode<ForumHint kind="bbcode" />
                                    </Button>
)}
                                    <Button size="sm" variant="outline-info" disabled={!application.bbcode} title={DOWNLOAD_HTML_HINT} onClick={() => handleDownloadHtml(application)}>
                                        <i className="fas fa-download me-1"></i>Télécharger le HTML<ForumHint kind="html" />
                                    </Button>
                                    <Button size="sm" variant="outline-info" disabled={!application.bbcode} title={PDF_EXPORT_LABEL} onClick={() => handleExportDocument('pdf', application)}>
                                        <i className="fas fa-file-pdf me-1"></i>PDF (A4)
                                    </Button>
                                    <Button size="sm" variant="outline-info" disabled={!application.bbcode} title="Grande image PNG, à joindre sur Discord" onClick={() => handleExportDocument('png', application)}>
                                        <i className="fas fa-image me-1"></i>Image (PNG)
                                    </Button>
                                    <ExpandToggle
                                        open={openRows[application.id] === 'preview'} label="Aperçu"
                                        onClick={() => toggleRow(application.id, 'preview')}
                                        title="Prévisualiser la candidature telle qu'elle sera publiée, juste en dessous"
                                    />
                                    {bbcodeEnabled && (
<ExpandToggle
                                        open={openRows[application.id] === 'bbcode'} label="Voir le BBCode" icon="fa-code"
                                        onClick={() => toggleRow(application.id, 'bbcode')}
                                    />
)}
                                    <ExpandToggle
                                        open={openRows[application.id] === 'history'} label="Historique" icon="fa-clock-rotate-left"
                                        onClick={() => toggleRow(application.id, 'history')}
                                    />
                                </div>

                                {openRows[application.id] && (
                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #30363d' }}>
                                        <ReportExpansion
                                            tab={openRows[application.id]}
                                            onTabChange={(tab) => setRowTab(application.id, tab)}
                                            bbCode={application.bbcode}
                                            title={applicationTitle(application)}
                                            extraTabs={[{ key: 'history', label: 'Historique', content: historyContent }]}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default MyJobApplicationsModal;
