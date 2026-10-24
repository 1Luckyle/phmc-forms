// src/components/Recruitment/RecruitmentManager.js
//
// Gestion du recrutement, accessible depuis la boîte à outils aux ADMINS et aux
// RECRUTEURS (compte Civil + drapeau recruiterUIDs, voir EmployeeAuthContext). Elle
// regroupe ce qui se trouvait dans les onglets « Recrutement » et « Candidatures » du
// panneau admin :
//   • Postes : ouvrir/fermer, ajouter, modifier, copier le BBCode des statuts ; renommer la clé
//     (sensible) est réservé aux ADMINS, y compris côté règles Firebase ;
//   • Candidatures : suivi du pipeline (entretiens, acceptation/refus, historique).
//   • Contrats : rédiger un contrat (modèle verrouillé) et l'envoyer à un membre du personnel qui le
//     signe depuis « Mes contrats » (voir components/Contracts).
// Les actions sont journalisées sur Discord comme avant (sendAdminActionWebhook).
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Button, Spinner, Nav } from 'react-bootstrap';
import * as Sentry from '@sentry/react';
import { RECRUITMENT_CATEGORIES, CATEGORY_BY_KEY, STATUT_OUVERT, isPositionOpen } from '../../constants/recruitment';
import { loadPositions as loadCategoryPositions, setPositionOpen } from '../../utils/recruitmentStore';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { copyToClipboard } from '../notificationService';
import { generateAdminView } from '../../formDefinitions';
import { sendAdminActionWebhook } from '../Admin/adminUtils';
import RoleModal from '../Admin/RoleModal';
import RenameRoleKeyModal from '../Admin/RenameRoleKeyModal';
import PendingJobApplications from '../Admin/PendingJobApplications';
import ContractsManager from '../Contracts/ContractsManager';
import useForumNotice from '../../hooks/useForumNotice';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../../utils/reportExport';
import ReportExpansion, { ExpandToggle, useExpansions } from '../ReportExpansion';
import { useSiteConfig } from '../../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../../utils/reportDocumentExport';
import InternalRecruitmentManager from './InternalRecruitmentManager';

const overlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};
const contentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px', borderRadius: '6px',
    width: '96%', maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column',
    position: 'relative', border: '1px solid #30363d', overflow: 'hidden',
};
const closeStyle = {
    position: 'absolute', top: '12px', right: '16px', background: 'transparent', border: 'none',
    color: '#f85149', fontSize: '28px', lineHeight: 1, cursor: 'pointer', zIndex: 5,
};

const RecruitmentManager = ({ show, onHide, showNotification }) => {
    const { currentEmployee, isAdmin, isRecruiter, canManageRecruitment } = useEmployeeAuth();
    const actorLabel = isAdmin ? 'Admin' : 'Recruteur';
    const actorEmail = currentEmployee?.email || 'Inconnu';

    const [tab, setTab] = useState('positions');
    const [pendingInternal, setPendingInternal] = useState(0);
    const [category, setCategory] = useState('');
    const [positions, setPositions] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [roleToEdit, setRoleToEdit] = useState(null);
    const [roleToRename, setRoleToRename] = useState(null);
    const { openForumNotice, forumNoticeModal } = useForumNotice();
    const { bbcodeEnabled } = useSiteConfig();
    const { open: openRows, toggle: toggleRow, setTab: setRowTab } = useExpansions();

    const config = category ? CATEGORY_BY_KEY[category] : null;

    const loadPositions = useCallback(async () => {
        if (!config) { setPositions({}); return; }
        setIsLoading(true);
        try {
            // Postes au format français, qu'ils soient encore dans l'ancien nœud ou déjà dans le nouveau.
            const loaded = await loadCategoryPositions(config);
            setPositions(loaded.positions);
        } catch (error) {
            console.error(`Error loading ${config.label}:`, error);
            showNotification(`Échec du chargement des postes (${config.label}).`, 'error');
            setPositions({});
        } finally {
            setIsLoading(false);
        }
    }, [config, showNotification]);

    useEffect(() => {
        if (show) loadPositions();
    }, [show, loadPositions]);

    useEffect(() => {
        if (!show) { setCategory(''); setTab('positions'); setShowRoleModal(false); setRoleToEdit(null); setRoleToRename(null); }
    }, [show]);

    const handleToggleStatus = async (positionKey) => {
        const position = positions[positionKey];
        if (!config || !position) return;
        const willOpen = !isPositionOpen(position);
        const newStatus = willOpen ? STATUT_OUVERT : 'FERMÉ';
        const name = position.nom || positionKey;
        setIsUpdating(true);
        try {
            await setPositionOpen(config, positionKey, willOpen);
            showNotification(`${name} est maintenant ${newStatus} pour ${config.label}.`, 'check-circle');
            sendAdminActionWebhook(actorEmail, 'Statut de recrutement modifié', `Poste : ${name}\nNouveau statut : ${newStatus}`, config.label, actorLabel);
            await loadPositions();
        } catch (error) {
            console.error(`Error updating status for ${positionKey}:`, error);
            Sentry.captureException(error, { extra: { context: 'RecruitmentManager toggle status', positionKey } });
            showNotification(`Échec de la mise à jour du statut pour ${name}.`, 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRoleSaved = (savedRole, actionType) => {
        loadPositions();
        if (!savedRole) return;
        sendAdminActionWebhook(
            actorEmail,
            actionType === 'edited' ? 'Poste modifié' : 'Nouveau poste ajouté',
            `Nom du poste : ${savedRole.nom || savedRole.cle}\nCode court : ${savedRole.codeCourt || 'N/A'}\nStatut : ${savedRole.statut || 'N/A'}\nRôle du personnel : ${savedRole.role || 'non défini'}\nClé : ${savedRole.cle}`,
            config?.label, actorLabel
        );
    };

    const buildStatusesBBCode = () => generateAdminView({
        isAdminAuthenticated: true,
        adminDisplayData: Object.keys(positions).length ? positions : null,
        adminSelectedCategoryName: config.label,
    });

    const handleCopyStatusesBBCode = async () => {
        if (!config) return;
        await copyToClipboard(buildStatusesBBCode(), showNotification, 'BBCode des statuts de recrutement copié !');
    };

    const handleExportStatuses = (format) => {
        if (!config) return;
        exportReportDocument(format, { bbCode: buildStatusesBBCode(), title: `Statuts de recrutement - ${config.label}`, showNotification });
    };

    const handleDownloadStatusesHtml = () => {
        if (!config) return;
        if (downloadBbCodeAsHtml({ bbCode: buildStatusesBBCode(), title: `Statuts de recrutement - ${config.label}`, showNotification })) {
            openForumNotice('html');
        }
    };

    if (!show) return null;

    if (!canManageRecruitment) {
        return ReactDOM.createPortal(
            <div style={overlayStyle} onClick={onHide}>
                <div style={{ ...contentStyle, height: 'auto', maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={onHide} style={closeStyle} aria-label="Fermer">&times;</button>
                    <p style={{ margin: '30px 0', textAlign: 'center' }}>
                        La gestion du recrutement est réservée aux administrateurs et aux recruteurs.
                    </p>
                </div>
            </div>,
            document.getElementById('modal-root')
        );
    }

    return ReactDOM.createPortal(
        <div style={overlayStyle} onClick={onHide}>
            <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onHide} style={closeStyle} aria-label="Fermer">&times;</button>
                <h5 style={{ marginBottom: '4px' }}>
                    <i className="fas fa-user-plus" style={{ marginRight: '8px' }}></i>Gestion du recrutement
                </h5>
                {forumNoticeModal}
                <p style={{ color: '#8b949e', fontSize: '0.85em', marginBottom: '10px' }}>
                    Connecté en tant que <strong>{isAdmin ? 'administrateur' : 'recruteur'}</strong>
                    {isRecruiter && !isAdmin ? ' (compte Civil + gestion du recrutement)' : ''}.
                </p>

                <Nav variant="tabs" activeKey={tab} onSelect={(key) => setTab(key)} style={{ marginBottom: '12px' }}>
                    <Nav.Item><Nav.Link eventKey="positions"><i className="fas fa-briefcase me-2"></i>Postes</Nav.Link></Nav.Item>
                    <Nav.Item><Nav.Link eventKey="applications"><i className="fas fa-file-signature me-2"></i>Candidatures</Nav.Link></Nav.Item>
                    <Nav.Item><Nav.Link eventKey="contracts"><i className="fas fa-file-contract me-2"></i>Contrats</Nav.Link></Nav.Item>
                    <Nav.Item>
                        <Nav.Link eventKey="internal">
                            <i className="fas fa-user-clock me-2"></i>Évolutions internes
                            {pendingInternal > 0 && <span className="badge bg-warning text-dark ms-2">{pendingInternal}</span>}
                        </Nav.Link>
                    </Nav.Item>
                </Nav>

                <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                    {tab === 'positions' && (
                        <>
                            <div className="form-group mb-3">
                                <label htmlFor="recruitmentCategory">Catégorie de recrutement</label>
                                <select id="recruitmentCategory" className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                                    <option value="">-- Sélectionnez une catégorie --</option>
                                    {RECRUITMENT_CATEGORIES.map((cat) => (
                                        <option key={cat.key} value={cat.key}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>

                            {config ? (
                                <>
                                    <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                                        <h6 className="mb-0">Postes — {config.label}</h6>
                                        <div className="d-flex gap-2">
                                            <ExpandToggle
                                                open={!!openRows.statuses} onClick={() => toggleRow('statuses')} label="Aperçu des statuts"
                                                title="Déplier / replier l'aperçu du message « Statuts de recrutement » de cette catégorie"
                                            />
                                            {bbcodeEnabled && (
<Button variant="outline-info" size="sm" onClick={handleCopyStatusesBBCode} disabled={isLoading}
                                                title={`Copie le BBCode « Statuts de recrutement » de cette catégorie. ${COPY_BBCODE_HINT}.`}>
                                                <i className="fas fa-copy"></i> Copier le BBCode des statuts
                                            </Button>
)}
                                            <Button variant="outline-info" size="sm" onClick={handleDownloadStatusesHtml} disabled={isLoading}
                                                title={`Télécharge les « Statuts de recrutement » de cette catégorie en HTML. ${DOWNLOAD_HTML_HINT}.`}>
                                                <i className="fas fa-download"></i> Télécharger le HTML des statuts
                                            </Button>
                                            <Button variant="outline-info" size="sm" onClick={() => handleExportStatuses('pdf')} disabled={isLoading} title={PDF_EXPORT_LABEL}>
                                                <i className="fas fa-file-pdf"></i> PDF
                                            </Button>
                                            <Button variant="outline-info" size="sm" onClick={() => handleExportStatuses('png')} disabled={isLoading} title="Grande image PNG, à joindre sur Discord">
                                                <i className="fas fa-image"></i> Image
                                            </Button>
                                            <Button variant="success" size="sm" onClick={() => { setRoleToEdit(null); setShowRoleModal(true); }}>
                                                <i className="fas fa-plus-circle"></i> Ajouter un rôle
                                            </Button>
                                        </div>
                                    </div>
                                    {openRows.statuses && !isLoading && (
                                        <div style={{ border: '1px solid #30363d', borderRadius: '4px', padding: '10px', marginBottom: '12px', backgroundColor: '#0d1117' }}>
                                            <ReportExpansion
                                                tab={openRows.statuses}
                                                onTabChange={(tab) => setRowTab('statuses', tab)}
                                                bbCode={buildStatusesBBCode()}
                                                title={`Statuts de recrutement - ${config.label}`}
                                            />
                                        </div>
                                    )}
                                    {isLoading ? <Spinner animation="border" /> : Object.keys(positions).length > 0 ? (
                                        <div className="list-group mb-3">
                                            {Object.entries(positions).map(([key, position]) => (
                                                <div key={key} className="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-2"
                                                    style={{ backgroundColor: '#161b22', color: '#c9d1d9', borderColor: '#30363d' }}>
                                                    <div>
                                                        {position.nom || key} :{' '}
                                                        <strong style={{ color: isPositionOpen(position) ? '#3fb950' : '#f85149' }}>{position.statut || 'N/A'}</strong>
                                                        <br />
                                                        <small style={{ color: '#8b949e' }}>
                                                            Rôle du personnel : {position.role || <em>non défini</em>} · Clé BD : {key}
                                                        </small>
                                                    </div>
                                                    <div className="d-flex gap-2">
                                                        {/* Sensible (change l'identifiant du poste) : réservé aux admins. */}
                                                        {isAdmin && (
                                                            <Button variant="outline-warning" size="sm" disabled={isUpdating}
                                                                onClick={() => setRoleToRename({ key, data: position })}
                                                                title="Renommer la clé de la base de données (sensible : change l'identifiant du poste)">
                                                                <i className="fas fa-key"></i> Renommer la clé
                                                            </Button>
                                                        )}
                                                        <Button variant="outline-secondary" size="sm" disabled={isUpdating}
                                                            onClick={() => { setRoleToEdit({ ...position, cle: key }); setShowRoleModal(true); }}>
                                                            <i className="fas fa-edit"></i> Modifier
                                                        </Button>
                                                        <Button variant={isPositionOpen(position) ? 'outline-danger' : 'outline-success'} size="sm" disabled={isUpdating}
                                                            onClick={() => handleToggleStatus(key)}>
                                                            {isPositionOpen(position) ? 'Fermer (FERMÉ)' : 'Ouvrir (OUVERT)'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p>Aucun poste pour {config.label}.</p>}
                                </>
                            ) : <p style={{ color: '#8b949e' }}>Sélectionnez une catégorie pour gérer ses postes.</p>}
                        </>
                    )}

                    {tab === 'applications' && <PendingJobApplications showNotification={showNotification} />}
                    {tab === 'contracts' && <ContractsManager showNotification={showNotification} />}
                    {tab === 'internal' && <InternalRecruitmentManager showNotification={showNotification} onCountChange={setPendingInternal} />}
                </div>

                {config && (
                    <RoleModal
                        show={showRoleModal}
                        onHide={() => { setShowRoleModal(false); setRoleToEdit(null); }}
                        category={config}
                        showNotification={showNotification}
                        onRoleSaved={handleRoleSaved}
                        roleToEdit={roleToEdit}
                    />
                )}
                {isAdmin && config && roleToRename && (
                    <RenameRoleKeyModal
                        show={!!roleToRename}
                        onHide={() => setRoleToRename(null)}
                        category={config}
                        currentRoleKey={roleToRename.key}
                        currentRoleData={roleToRename.data}
                        showInAppNotification={showNotification}
                        onKeyRenamed={() => { setRoleToRename(null); loadPositions(); }}
                        sendAdminActionWebhook={(email, action, details, categoryName) => sendAdminActionWebhook(email, action, details, categoryName, actorLabel)}
                        adminUserEmail={actorEmail}
                    />
                )}
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default RecruitmentManager;
