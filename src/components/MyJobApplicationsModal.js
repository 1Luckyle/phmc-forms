// src/components/MyJobApplicationsModal.js
//
// « Mon dossier candidat » : le suivi du candidat sur candidatures/{uid} (ancien nœud jobApplications lu aussi). Même
// présentation que le suivi du recrutement et que les demandes CCTV : une carte par candidature (statut en couleur,
// pastille « Nouvelle réponse »), et dans la carte : le déroulé, le motif d'un éventuel refus, les actions (Candidater /
// Mettre en pause / Retirer), les échanges avec le recrutement dès que la candidature est « en cours d'examen », puis le
// rechargement dans le formulaire, l'export (BBCode, HTML, PDF, image) et l'aperçu / BBCode / historique.
import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Button, Dropdown } from 'react-bootstrap';
import { removeApplication } from '../utils/recruitmentStore';
import { useDebug } from '../contexts/DebugContext';
import { useData } from '../contexts/DataContext';
import {
    APPLICATION_STATUS, APPLICATION_STATUS_COLORS, APPLICATION_EDITABLE_STATUSES, THREAD_OPEN_STATUSES, positionLabelFor,
} from '../constants/recruitment';
import { subscribeMyThreadMeta } from '../utils/applicationThreads';
import { logActivity } from '../utils/activityLog';
import { presentsLabel } from '../utils/interviews';
import { copyToClipboard } from './notificationService';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../utils/reportExport';
import ForumHint from './ForumHint';
import useForumNotice from '../hooks/useForumNotice';
import ReportExpansion, { ExpandToggle, useExpansions } from './ReportExpansion';
import ApplicationThread from './Recruitment/ApplicationThread';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../utils/reportDocumentExport';
import './Cctv/CctvRequests.css';
import './Recruitment/Applications.css';
import useWriteLock from '../hooks/useWriteLock';

const modalStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};

const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '5px', width: '95%', maxWidth: '900px', height: '85vh',
    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    overflowY: 'hidden', position: 'relative', border: '1px solid #30363d',
};

const closeButtonStyle = {
    position: 'absolute', top: '15px', right: '15px', background: 'transparent',
    border: 'none', color: '#f85149', fontSize: '28px', fontWeight: 'bold',
    lineHeight: '1', padding: '0.25rem 0.5rem', cursor: 'pointer', zIndex: 10,
};

const STATUS_LABELS = Object.fromEntries(Object.entries(APPLICATION_STATUS).map(([key, value]) => [key, value.label]));
const STATUS_HELP = {
    brouillon: "Brouillon : le recrutement ne le voit pas. Cliquez sur « Candidater » (ou rouvrez le formulaire) pour l'envoyer.",
    soumise: "Votre candidature est envoyée. Le recrutement va la prendre en charge ; vous pourrez alors échanger avec lui ici.",
    en_examen: "Votre candidature est en cours d'examen : vous pouvez échanger avec le recrutement ci-dessous.",
    entretien_programme: "Un entretien est programmé. Vous pouvez encore écrire au recrutement ci-dessous.",
    entretien_effectue: "Votre entretien est effectué : le recrutement rend sa décision.",
    en_pause: "Candidature en pause : reprenez-la quand vous le souhaitez.",
    retiree: "Vous avez retiré cette candidature.",
};

const EVENT_LABELS = {
    entretien_planifie: 'Entretien programmé', entretien_modifie: 'Entretien modifié', entretien_annule: 'Entretien annulé',
    candidature_modifiee: 'Vous avez modifié votre candidature',
};

const ACTIVE_STATUSES = ['soumise', 'en_examen', 'entretien_programme', 'entretien_effectue'];

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    const d = new Date(timestamp);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const applicationTitle = (application) => `Candidature - ${application.poste || 'Poste'}${application.nomCandidat ? ` - ${application.nomCandidat}` : ''}`;

const MyJobApplicationsModal = ({ show, onHide, applications: rawApplications, isLoading, onUpdateStatus, showNotification, onDeleted, onLoad, onEdit }) => {
    // Interrupteur Debug (panneau admin) : permet de supprimer une candidature de l'historique.
    const { debugDeleteApplicationsEnabled } = useDebug();
    const { locked, lockTitle } = useWriteLock();
    const { openForumNotice, forumNoticeModal } = useForumNotice();
    const { bbcodeEnabled } = useSiteConfig();
    const { open: openRows, toggle: toggleRow, setTab: setRowTab } = useExpansions();
    const [openId, setOpenId] = useState(undefined); // undefined = choix par défaut (ouverte s'il n'y en a qu'une) ; null = tout replié
    const [meta, setMeta] = useState({});
    // Le poste s'affiche sous son libellé français, même pour une ancienne candidature qui n'a gardé que la clé.
    const { selectOptions } = useData();
    const applications = useMemo(() => (rawApplications || []).map((application) => ({
        ...application,
        posteCle: application.posteCle ?? application.poste,
        poste: positionLabelFor(selectOptions, application.versionBBCode, application.posteCle || application.poste),
    })), [rawApplications, selectOptions]);

    const candidatUid = applications[0]?.candidatUid || null;
    useEffect(() => {
        if (!show || !candidatUid) return undefined;
        const unsubscribe = subscribeMyThreadMeta(candidatUid, setMeta, () => setMeta({}));
        return () => unsubscribe();
    }, [show, candidatUid]);

    if (!show) return null;

    const handleDelete = async (application) => {
        if (!window.confirm('Supprimer définitivement cette candidature de votre historique ?')) return;
        try {
            await removeApplication(application.candidatUid, application.id);
            logActivity({
                category: 'recrutement', action: 'application_deleted', severity: 'warning',
                summary: `Candidature supprimée par le candidat : ${application.poste || 'poste inconnu'}`, details: `Statut : ${STATUS_LABELS[application.statut] || application.statut}`,
                target: application.nomCandidat || undefined,
            });
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
            showNotification(newStatus === 'soumise' ? 'Candidature (re)soumise.' : 'Statut mis à jour.', 'check-circle');
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

    const renderHistory = (application) => {
        const history = [...(application.historique || [])].sort((a, b) => (b.horodatage || 0) - (a.horodatage || 0));
        if (history.length === 0) return <span className="cctv-muted">Aucun historique enregistré.</span>;
        return (
            <ul style={{ paddingLeft: '1.1rem', marginBottom: 0 }}>
                {history.map((entry, index) => (
                    <li key={`${entry.statut}-${entry.horodatage}-${index}`}>
                        <span style={{ color: APPLICATION_STATUS_COLORS[entry.statut] || '#c9d1d9' }}>
                            {entry.evenement ? (EVENT_LABELS[entry.evenement] || entry.evenement) : (STATUS_LABELS[entry.statut] || entry.statut)}
                        </span>
                        {' — '}{formatDate(entry.horodatage)}
                        {entry.details && <div className="cctv-muted">{entry.details}</div>}
                    </li>
                ))}
            </ul>
        );
    };

    return ReactDOM.createPortal(
        <div style={modalStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                {forumNoticeModal}
                <h5 style={{ marginBottom: '4px' }}><i className="fas fa-folder-open me-2"></i>Mon dossier candidat</h5>
                <p className="cctv-muted" style={{ marginBottom: '12px' }}>Suivez vos candidatures et échangez avec le recrutement dès qu'une candidature est en cours d'examen.</p>

                <div className="cctv-panel" style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '4px' }}>
                    {isLoading && <p className="cctv-muted">Chargement...</p>}
                    {!isLoading && applications.length === 0 && (
                        <p className="cctv-empty">Aucune candidature enregistrée pour l'instant.</p>
                    )}
                    <div className="cctv-list">
                        {!isLoading && applications.map((application) => {
                            const color = APPLICATION_STATUS_COLORS[application.statut] || '#8b949e';
                            const isOpen = openId === undefined ? applications.length === 1 : openId === application.id;
                            const info = meta[application.id];
                            const newReply = !!info && info.staff && THREAD_OPEN_STATUSES.includes(application.statut);
                            const showThread = THREAD_OPEN_STATUSES.includes(application.statut) || application.statut === 'refusee' || info;
                            return (
                                <div key={application.id} className={`cctv-card ${isOpen ? 'open' : ''}`} style={{ '--c': color }}>
                                    <button type="button" className="cctv-card-head" onClick={() => setOpenId(isOpen ? null : application.id)}>
                                        <span className="cctv-card-main">
                                            <strong>{application.poste || 'Poste inconnu'}</strong>
                                            <small>Candidat : {application.nomCandidat || '—'} · Déposée le {formatDate(application.creeLe)} · mise à jour {formatDate(application.modifieLe)}</small>
                                        </span>
                                        {newReply && <span className="cctv-flag">Nouvelle réponse</span>}
                                        <span className="cctv-chip" style={{ '--c': color }}><span className="cctv-dot"></span>{STATUS_LABELS[application.statut] || application.statut}</span>
                                        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} cctv-caret`}></i>
                                    </button>

                                    {isOpen && (
                                        <div className="cctv-card-body">
                                            {application.statut === 'refusee' ? (
                                                <div className="rec-banner refused">
                                                    <strong>Candidature refusée.</strong>{' '}
                                                    {application.refus?.motif ? <>Motif : {application.refus.motif}{application.refus.detail ? ` — ${application.refus.detail}` : ''}.</> : 'Aucun motif n’a été enregistré.'}
                                                    {' '}Vous pouvez candidater à nouveau ultérieurement.
                                                </div>
                                            ) : application.statut === 'acceptee' ? (
                                                <div className="rec-banner accepted">
                                                    <strong>Félicitations, votre candidature est acceptée.</strong> Le recrutement vous contactera pour la suite ; vous pouvez échanger avec lui ci-dessous jusqu'à la signature de votre contrat.
                                                </div>
                                            ) : STATUS_HELP[application.statut] ? (
                                                <div className="rec-banner info">{STATUS_HELP[application.statut]}</div>
                                            ) : null}

                                            {application.dateEntretien && application.statut === 'entretien_programme' && (
                                                <dl className="cctv-fields">
                                                    <dt>Entretien</dt><dd>{formatDate(application.dateEntretien)}</dd>
                                                    {application.entretien?.recruteur?.nom && (<><dt>Mené par</dt><dd>{application.entretien.recruteur.nom}</dd></>)}
                                                    {application.entretien?.presents?.length > 0 && (<><dt>Présents</dt><dd>{presentsLabel(application.entretien)}</dd></>)}
                                                </dl>
                                            )}

                                            <div className="rec-actions">
                                                {application.statut === 'brouillon' && (
                                                    <Button size="sm" variant="primary" disabled={locked} title={locked ? lockTitle : undefined} onClick={() => handleAction(application, 'soumise')}>Candidater</Button>
                                                )}
                                                {application.statut === 'en_pause' && (
                                                    <Button size="sm" variant="primary" disabled={locked} title={locked ? lockTitle : undefined} onClick={() => handleAction(application, 'soumise')}>Reprendre ma candidature</Button>
                                                )}
                                                {ACTIVE_STATUSES.includes(application.statut) && (
                                                    <Button size="sm" variant="secondary" disabled={locked} title={locked ? lockTitle : undefined} onClick={() => handleAction(application, 'en_pause')}>Mettre en pause</Button>
                                                )}
                                                {(ACTIVE_STATUSES.includes(application.statut) || application.statut === 'brouillon' || application.statut === 'en_pause') && (
                                                    <Button size="sm" variant="outline-danger" disabled={locked} title={locked ? lockTitle : undefined} onClick={() => { if (window.confirm('Retirer cette candidature ?')) handleAction(application, 'retiree'); }}>
                                                        Retirer
                                                    </Button>
                                                )}
                                                {debugDeleteApplicationsEnabled && (
                                                    <Button size="sm" variant="outline-danger" onClick={() => handleDelete(application)} title="Debug : supprime définitivement cette candidature">
                                                        <i className="fas fa-trash"></i> Supprimer
                                                    </Button>
                                                )}
                                            </div>

                                            {showThread && (
                                                <ApplicationThread application={application} staff={false} authorName={application.nomCandidat} authorRole="Candidat" />
                                            )}

                                            <div className="rec-tools">
                                                {onEdit && APPLICATION_EDITABLE_STATUSES.includes(application.statut) && canReload(application) && (
                                                    <Button
                                                        size="sm" variant="primary" disabled={locked}
                                                        title={locked ? lockTitle : 'Rouvre votre candidature dans son formulaire pour la modifier : elle est mise à jour (jamais dupliquée) et le recrutement voit ce qui a changé'}
                                                        onClick={() => onEdit(application)}
                                                    >
                                                        <i className="fas fa-pen me-1"></i>Modifier ma candidature
                                                    </Button>
                                                )}
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
                                                <Dropdown className="d-inline-block">
                                                    <Dropdown.Toggle size="sm" variant="secondary">Copier</Dropdown.Toggle>
                                                    <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                                        {bbcodeEnabled && (
                                                            <Dropdown.Item onClick={() => handleCopyBbCode(application)} disabled={!application.bbcode} title={COPY_BBCODE_HINT}>
                                                                Copier le BBCode<ForumHint kind="bbcode" />
                                                            </Dropdown.Item>
                                                        )}
                                                        <Dropdown.Item onClick={() => handleDownloadHtml(application)} disabled={!application.bbcode} title={DOWNLOAD_HTML_HINT}>
                                                            Télécharger le HTML<ForumHint kind="html" />
                                                        </Dropdown.Item>
                                                        <Dropdown.Item onClick={() => handleExportDocument('pdf', application)} disabled={!application.bbcode}>{PDF_EXPORT_LABEL}</Dropdown.Item>
                                                        <Dropdown.Item onClick={() => handleExportDocument('png', application)} disabled={!application.bbcode}>Télécharger l'image (PNG, pour Discord)</Dropdown.Item>
                                                        <Dropdown.Item onClick={() => handleExportDocument('png-copy', application)} disabled={!application.bbcode}>Copier l'image (à coller dans Discord)</Dropdown.Item>
                                                        <Dropdown.Item onClick={() => copyToClipboard(applicationTitle(application), showNotification, 'Titre copié !')}>Copier le titre</Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
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
                                                <div className="rec-expansion">
                                                    <ReportExpansion
                                                        tab={openRows[application.id]}
                                                        onTabChange={(tab) => setRowTab(application.id, tab)}
                                                        bbCode={application.bbcode}
                                                        title={applicationTitle(application)}
                                                        extraTabs={[{ key: 'history', label: 'Historique', content: renderHistory(application) }]}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default MyJobApplicationsModal;
