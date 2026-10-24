// src/components/Admin/PendingJobApplications.js
//
// Panneau admin du pipeline de candidatures (Lot 6 du plan Civil). Calqué sur
// PendingAccountRequests.js : mêmes patterns get/set/remove, même helper
// sendMailBestEffort. Contrairement aux demandes de compte (un seul nœud
// plat), les candidatures vivent sous candidatures/{candidatUid}/{id} (ancien nœud jobApplications fusionné) —
// ce composant aplatit l'arbre pour les afficher en une seule liste.
import React, { useState, useEffect, useMemo } from 'react';
import { Button, Table } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import { useData } from '../../contexts/DataContext';
import { loadAllApplications, saveApplication, removeApplication } from '../../utils/recruitmentStore';
import { APPLICATION_STATUS, positionsFromSelectOptions, positionLabelFor } from '../../constants/recruitment';
import { useDebug } from '../../contexts/DebugContext';
import { sendEyefindMail } from '../../utils/eyefindMail';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { loadContractCandidates, setContractCandidate, clearContractCandidate } from '../../utils/contractCandidates';
import { sendAdminActionWebhook } from './adminUtils';
import ReportExpansion, { ExpandToggle, useExpansions } from '../ReportExpansion';
import useForumNotice from '../../hooks/useForumNotice';
import { copyToClipboard } from '../notificationService';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../../utils/reportExport';
import { getFormDefinition } from '../../formDefinitions';
import { useSiteConfig } from '../../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../../utils/reportDocumentExport';

const sendMailBestEffort = (params) => {
    sendEyefindMail(params).then((result) => {
        if (!result.ok) {
            console.warn('Eyefind Mail non envoyé:', result.error, result.message);
        }
    });
};

const STATUS_LABELS = Object.fromEntries(Object.entries(APPLICATION_STATUS).map(([key, value]) => [key, value.label]));

// Le personnel n'a rien à faire sur les brouillons (pas encore soumis) ni sur
// les candidatures déjà retirées/en pause par le civil lui-même — on les
// masque de la file de travail par défaut pour ne pas noyer les vraies
// candidatures actives, mais elles restent consultables via "Tout afficher".
const ACTIONABLE_STATUSES = ['soumise', 'entretien_programme', 'entretien_effectue', 'acceptee', 'refusee'];

const PendingJobApplications = ({ showNotification }) => {
    const [applications, setApplications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);
    const [interviewInputs, setInterviewInputs] = useState({});
    // Interrupteur Debug (panneau admin) : permet de supprimer une candidature de l'historique.
    const { debugDeleteApplicationsEnabled } = useDebug();
    const { currentEmployee, isAdmin, staffName, civilianProfile } = useEmployeeAuth();
    const { selectOptions } = useData();
    const { openForumNotice, forumNoticeModal } = useForumNotice();
    const { bbcodeEnabled } = useSiteConfig();
    // Poste sous son libellé français (même pour une ancienne candidature qui n'a gardé que la clé anglaise).
    const labelledApplications = useMemo(() => applications.map((application) => ({
        ...application,
        posteCle: application.posteCle ?? application.poste,
        poste: positionLabelFor(selectOptions, application.versionBBCode, application.posteCle || application.poste),
    })), [applications, selectOptions]);
    const { open: openRows, toggle: toggleRow, setTab: setRowTab } = useExpansions();

    // Rôle du personnel relié au poste de la candidature (champ `role` du poste), s'il est défini.
    const roleOfPosition = (poste) => {
        const categories = positionsFromSelectOptions(selectOptions);
        for (const positions of Object.values(categories)) {
            const match = Object.values(positions).find((position) => position.cle === poste || position.nom === poste);
            if (match) return match.role || null;
        }
        return null;
    };
    // Rôle facultatif « en attente de contrat » : uid -> infos (voir utils/contractCandidates.js).
    const [contractCandidates, setContractCandidates] = useState({});

    useEffect(() => {
        loadApplications();
        loadContractCandidates().then(setContractCandidates).catch((error) => console.warn('Rôles de contrat illisibles :', error));
    }, []);

    // Pose ou retire le rôle « en attente de signature de contrat » sur un candidat ACCEPTÉ.
    // C'est au recruteur de décider : rien n'est posé automatiquement à l'acceptation.
    const handleToggleContractRole = async (application) => {
        const hasRole = !!contractCandidates[application.candidatUid];
        const actorName = staffName
            || [civilianProfile?.firstName, civilianProfile?.lastName].filter(Boolean).join(' ')
            || currentEmployee?.email || 'Le recrutement';
        const label = isAdmin ? 'Admin' : 'Recruteur';
        try {
            if (hasRole) {
                if (!window.confirm(`Retirer le rôle « en attente de contrat » à ${application.nomCandidat} ? Il n'aura plus accès à ses contrats ni à la création de sa signature par ce biais.`)) return;
                await clearContractCandidate(application.candidatUid);
                setContractCandidates((current) => { const next = { ...current }; delete next[application.candidatUid]; return next; });
                sendAdminActionWebhook(currentEmployee?.email || 'Inconnu', 'Rôle « en attente de contrat » retiré', `Candidat : ${application.nomCandidat}`, null, label);
                showNotification('Rôle « en attente de contrat » retiré.', 'info');
                return;
            }
            if (!window.confirm(`Passer ${application.nomCandidat} en « attente de signature de contrat » ?

Il pourra consulter et signer son contrat, et créer sa signature, depuis la Boîte à outils.`)) return;
            await setContractCandidate(application.candidatUid, {
                byUid: currentEmployee?.uid, byName: actorName, applicationId: application.id, position: application.poste || null,
                role: roleOfPosition(application.poste),
            });
            setContractCandidates((current) => ({ ...current, [application.candidatUid]: { definiParNom: actorName, definiLe: Date.now() } }));
            sendAdminActionWebhook(currentEmployee?.email || 'Inconnu', 'Rôle « en attente de contrat » posé', `Candidat : ${application.nomCandidat}
Poste : ${application.poste || '—'}`, null, label);
            const email = await getApplicantEmail(application);
            if (email) {
                sendMailBestEffort({
                    to: email,
                    subject: 'Votre contrat vous attend - PHMC',
                    body: `Bonjour ${application.nomCandidat || ''},

Votre contrat au Pillbox Hill Medical Center est en préparation. Connectez-vous à l'outil PHMC-FR : dans la Boîte à outils, « Mes contrats » vous permettra de le lire et de le signer. Vous pourrez y créer votre signature si vous n'en avez pas encore.

Cordialement,
Pillbox Hill Medical Center`,
                    html: `<p>Bonjour ${application.nomCandidat || ''},</p><p>Votre contrat au Pillbox Hill Medical Center est en préparation. Connectez-vous à l'outil PHMC-FR : dans la <b>Boîte à outils</b>, <b>« Mes contrats »</b> vous permettra de le lire et de le signer. Vous pourrez y créer votre signature si vous n'en avez pas encore.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
                });
            }
            showNotification('Candidat passé en attente de contrat (notifié).', 'success');
        } catch (error) {
            console.error('Error toggling contract role:', error);
            showNotification(`Action impossible : ${error.message}`, 'error');
        }
    };

    const handleDeleteApplication = async (application) => {
        if (!window.confirm(`Supprimer définitivement la candidature de ${application.nomCandidat || 'ce candidat'} (${application.poste || 'poste inconnu'}) ?`)) return;
        try {
            await removeApplication(application.candidatUid, application.id);
            showNotification('Candidature supprimée.', 'trash');
            await loadApplications();
        } catch (error) {
            console.error('Error deleting job application:', error);
            showNotification("Suppression refusée : l'option Debug « suppression des candidatures » est-elle activée ?", 'error');
        }
    };

    const loadApplications = async () => {
        setIsLoading(true);
        try {
            // Candidatures déjà normalisées au format français (ancien et nouveau nœud fusionnés).
            const flat = await loadAllApplications();
            setApplications(flat);
        } catch (error) {
            console.error('Error loading job applications:', error);
            showNotification('Erreur lors du chargement des candidatures', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const updateStatus = async (application, newStatus, extra = {}) => {
        try {
            const historique = application.historique ? [...application.historique] : [];
            historique.push({ statut: newStatus, horodatage: Date.now() });
            await saveApplication(application.candidatUid, application.id, {
                ...application,
                ...extra,
                statut: newStatus,
                modifieLe: Date.now(),
                historique,
            });
            return true;
        } catch (error) {
            console.error('Error updating application status:', error);
            showNotification(`Erreur lors de la mise à jour : ${error.message}`, 'error');
            return false;
        }
    };

    const getApplicantEmail = async (application) => {
        try {
            const civilSnap = await get(ref(database, `civilians/${application.candidatUid}`));
            return civilSnap.exists() ? civilSnap.val().email : null;
        } catch (error) {
            console.warn('Could not fetch applicant email:', error);
            return null;
        }
    };

    const handleScheduleInterview = async (application) => {
        const rawDateTime = interviewInputs[application.id + application.candidatUid];
        if (!rawDateTime) {
            showNotification('Veuillez choisir une date et une heure pour l\'entretien.', 'warning');
            return;
        }
        const interviewDateTime = new Date(rawDateTime).toISOString();
        const ok = await updateStatus(application, 'entretien_programme', { dateEntretien: interviewDateTime });
        if (!ok) return;

        const email = await getApplicantEmail(application);
        if (email) {
            const formattedDateTime = new Date(interviewDateTime).toLocaleString('fr-FR');
            sendMailBestEffort({
                to: email,
                subject: 'Entretien de candidature - PHMC',
                body: `Bonjour ${application.nomCandidat || ''},\n\nVotre entretien pour le poste "${application.poste || ''}" au Pillbox Hill Medical Center est programmé le ${formattedDateTime}.\n\nMerci de vous présenter à l'étage de l'administration du Pillbox Hill Medical Center, situé au 76 Strawberry Ave, Los Santos.\n\nEn cas d'empêchement, contactez l'administration du PHMC au plus vite.\n\nCordialement,\nPillbox Hill Medical Center`,
                html: `<p>Bonjour ${application.nomCandidat || ''},</p><p>Votre entretien pour le poste « <b>${application.poste || ''}</b> » au Pillbox Hill Medical Center est programmé le <b>${formattedDateTime}</b>.</p><p>Merci de vous présenter à l'étage de l'administration du Pillbox Hill Medical Center, situé au 76 Strawberry Ave, Los Santos.</p><p>En cas d'empêchement, contactez l'administration du PHMC au plus vite.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
            });
        }

        showNotification('Entretien programmé et candidat notifié.', 'success');
        loadApplications();
    };

    const handleMarkInterviewCompleted = async (application) => {
        const ok = await updateStatus(application, 'entretien_effectue');
        if (ok) {
            showNotification('Entretien marqué comme effectué.', 'success');
            loadApplications();
        }
    };

    const handleAccept = async (application) => {
        if (application.statut !== 'entretien_effectue') {
            showNotification('L\'entretien doit d\'abord être marqué comme effectué avant d\'accepter cette candidature.', 'warning');
            return;
        }
        if (!window.confirm(`Confirmer l'acceptation de la candidature de ${application.nomCandidat} ?`)) return;

        const ok = await updateStatus(application, 'acceptee');
        if (!ok) return;

        const email = await getApplicantEmail(application);
        if (email) {
            sendMailBestEffort({
                to: email,
                subject: 'Votre candidature a été acceptée - PHMC',
                body: `Bonjour ${application.nomCandidat || ''},\n\nFélicitations ! Votre candidature pour le poste "${application.poste || ''}" au Pillbox Hill Medical Center a été acceptée.\n\nVous serez contacté(e) prochainement par l'administration pour la suite des formalités.\n\nCordialement,\nPillbox Hill Medical Center`,
                html: `<p>Bonjour ${application.nomCandidat || ''},</p><p>Félicitations ! Votre candidature pour le poste « <b>${application.poste || ''}</b> » au Pillbox Hill Medical Center a été <b>acceptée</b>.</p><p>Vous serez contacté(e) prochainement par l'administration pour la suite des formalités.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
            });
        }

        showNotification('Candidature acceptée et candidat notifié.', 'success');
        loadApplications();
    };

    const handleRefuse = async (application) => {
        if (!window.confirm(`Confirmer le refus de la candidature de ${application.nomCandidat} ?`)) return;

        const ok = await updateStatus(application, 'refusee');
        if (!ok) return;

        const email = await getApplicantEmail(application);
        if (email) {
            sendMailBestEffort({
                to: email,
                subject: 'Votre candidature - PHMC',
                body: `Bonjour ${application.nomCandidat || ''},\n\nNous vous remercions pour votre candidature au poste "${application.poste || ''}" au Pillbox Hill Medical Center. Après examen, celle-ci n'a malheureusement pas été retenue.\n\nVous pouvez candidater à nouveau ultérieurement.\n\nCordialement,\nPillbox Hill Medical Center`,
                html: `<p>Bonjour ${application.nomCandidat || ''},</p><p>Nous vous remercions pour votre candidature au poste « <b>${application.poste || ''}</b> » au Pillbox Hill Medical Center. Après examen, celle-ci n'a malheureusement pas été retenue.</p><p>Vous pouvez candidater à nouveau ultérieurement.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
            });
        }

        showNotification('Candidature refusée et candidat notifié.', 'info');
        loadApplications();
    };

    const applicationTitle = (application) => `Candidature - ${application.poste || 'Poste'}${application.nomCandidat ? ` - ${application.nomCandidat}` : ''}`;

    const handleCopyBbCode = (application) => {
        if (!application.bbcode) { showNotification('Aucun BBCode enregistré pour cette candidature.', 'warning'); return; }
        copyToClipboard(application.bbcode, showNotification, 'BBCode copié !');
    };

    const handleDownloadHtml = (application) => {
        if (downloadBbCodeAsHtml({ bbCode: application.bbcode, title: applicationTitle(application), showNotification })) openForumNotice('html');
    };

    const handleExportDocument = (format, application) => exportReportDocument(format, { bbCode: application.bbcode, title: applicationTitle(application), showNotification });

    const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleString('fr-FR') : '—');

    // Onglet « Détails » : tout ce qu'on sait de la candidature et de son parcours.
    const renderDetails = (application) => {
        const history = [...(application.historique || [])].sort((a, b) => (b.horodatage || 0) - (a.horodatage || 0));
        return (
            <div style={{ fontSize: '0.9em' }}>
                <table style={{ borderCollapse: 'collapse', marginBottom: '10px' }}>
                    <tbody>
                        {[
                            ['Candidat', application.nomCandidat || 'N/A'],
                            ['ID patient', application.idPatient || '—'],
                            ['Poste', application.poste || 'N/A'],
                            ['Formulaire', getFormDefinition(application.versionBBCode)?.name || application.versionBBCode || '—'],
                            ['Statut', STATUS_LABELS[application.statut] || application.statut],
                            ['Déposée le', formatDate(application.creeLe)],
                            ['Dernière mise à jour', formatDate(application.modifieLe)],
                            ['Entretien', application.dateEntretien ? formatDate(application.dateEntretien) : '—'],
                        ].map(([label, value]) => (
                            <tr key={label}>
                                <td style={{ padding: '2px 14px 2px 0', color: '#8b949e' }}>{label}</td>
                                <td style={{ padding: '2px 0' }}>{value}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Historique</div>
                {history.length === 0 ? <span style={{ color: '#8b949e' }}>Aucun historique enregistré.</span> : (
                    <ul style={{ paddingLeft: '1.1rem', marginBottom: 0 }}>
                        {history.map((entry, index) => (
                            <li key={`${entry.statut}-${entry.horodatage}-${index}`}>
                                {STATUS_LABELS[entry.statut] || entry.statut} — {formatDate(entry.horodatage)}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    };

    const visibleApplications = showAll
        ? labelledApplications
        : labelledApplications.filter((app) => ACTIONABLE_STATUSES.includes(app.statut));

    if (isLoading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Chargement des candidatures...</div>;
    }

    return (
        <div style={{ padding: '20px' }}>
            {forumNoticeModal}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#c9d1d9', margin: 0 }}>
                    <i className="fas fa-user-plus" style={{ marginRight: '10px' }}></i>
                    Candidatures ({visibleApplications.length})
                </h3>
                <Button size="sm" variant="outline-secondary" onClick={() => setShowAll((prev) => !prev)}>
                    {showAll ? 'Masquer brouillons/retirées' : 'Tout afficher'}
                </Button>
            </div>

            {visibleApplications.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#c9d1d9' }}>
                    <i className="fas fa-inbox" style={{ fontSize: '3em', marginBottom: '15px', opacity: 0.5 }}></i>
                    <p>Aucune candidature à traiter</p>
                </div>
            ) : (
                <Table striped bordered hover variant="dark" style={{ backgroundColor: '#0d1117' }}>
                    <thead>
                        <tr>
                            <th>Candidat</th>
                            <th>Poste</th>
                            <th>Statut</th>
                            <th>Entretien</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleApplications.map((application) => {
                            const inputKey = application.id + application.candidatUid;
                            return (
                                <React.Fragment key={inputKey}>
                                <tr>
                                    <td>{application.nomCandidat || 'N/A'} {application.idPatient ? `(${application.idPatient})` : ''}</td>
                                    <td>{application.poste || 'N/A'}</td>
                                    <td>{STATUS_LABELS[application.statut] || application.statut}</td>
                                    <td>
                                        {application.dateEntretien
                                            ? new Date(application.dateEntretien).toLocaleString('fr-FR')
                                            : (application.statut === 'soumise' && (
                                                <input
                                                    type="datetime-local"
                                                    className="form-control form-control-sm"
                                                    style={{ backgroundColor: '#161b22', color: '#c9d1d9', borderColor: '#30363d' }}
                                                    value={interviewInputs[inputKey] || ''}
                                                    onChange={(e) => setInterviewInputs((prev) => ({ ...prev, [inputKey]: e.target.value }))}
                                                />
                                            ))
                                        }
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                            <ExpandToggle open={!!openRows[inputKey]} onClick={() => toggleRow(inputKey, 'preview')} label="Aperçu" title="Déplier / replier l'aperçu de la candidature" />
                                            <ExpandToggle open={openRows[inputKey] === 'details'} onClick={() => toggleRow(inputKey, 'details')} label="Détails" icon="fa-circle-info" title="Informations et historique de la candidature" />
                                            {bbcodeEnabled && (
<Button size="sm" variant="outline-secondary" disabled={!application.bbcode} title={COPY_BBCODE_HINT} onClick={() => handleCopyBbCode(application)}>
                                                <i className="fas fa-copy"></i> BBCode
                                            </Button>
)}
                                            <Button size="sm" variant="outline-secondary" disabled={!application.bbcode} title={DOWNLOAD_HTML_HINT} onClick={() => handleDownloadHtml(application)}>
                                                <i className="fas fa-download"></i> HTML
                                            </Button>
                                            <Button size="sm" variant="outline-secondary" disabled={!application.bbcode} title={PDF_EXPORT_LABEL} onClick={() => handleExportDocument('pdf', application)}>
                                                <i className="fas fa-file-pdf"></i> PDF
                                            </Button>
                                            <Button size="sm" variant="outline-secondary" disabled={!application.bbcode} title="Grande image PNG, à joindre sur Discord" onClick={() => handleExportDocument('png', application)}>
                                                <i className="fas fa-image"></i> Image
                                            </Button>
                                            {application.statut === 'soumise' && (
                                                <Button size="sm" variant="primary" onClick={() => handleScheduleInterview(application)}>
                                                    Planifier un entretien
                                                </Button>
                                            )}
                                            {application.statut === 'entretien_programme' && (
                                                <Button size="sm" variant="info" onClick={() => handleMarkInterviewCompleted(application)}>
                                                    Marquer l'entretien effectué
                                                </Button>
                                            )}
                                            {application.statut === 'entretien_effectue' && (
                                                <Button size="sm" variant="success" onClick={() => handleAccept(application)}>
                                                    Accepter
                                                </Button>
                                            )}
                                            {application.statut === 'acceptee' && (
                                                <Button size="sm" variant={contractCandidates[application.candidatUid] ? 'outline-warning' : 'info'}
                                                    onClick={() => handleToggleContractRole(application)}
                                                    title="Rôle facultatif : donne au candidat accès à son contrat et à la création de sa signature">
                                                    <i className="fas fa-file-signature"></i>{' '}
                                                    {contractCandidates[application.candidatUid] ? 'Retirer « attente de contrat »' : 'Passer en attente de contrat'}
                                                </Button>
                                            )}
                                            {['soumise', 'entretien_programme', 'entretien_effectue'].includes(application.statut) && (
                                                <Button size="sm" variant="danger" onClick={() => handleRefuse(application)}>
                                                    Refuser
                                                </Button>
                                            )}
                                            {debugDeleteApplicationsEnabled && (
                                                <Button size="sm" variant="outline-danger" onClick={() => handleDeleteApplication(application)}
                                                    title="Debug : supprime définitivement cette candidature">
                                                    <i className="fas fa-trash"></i> Supprimer
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {openRows[inputKey] && (
                                    <tr>
                                        <td colSpan={5} style={{ backgroundColor: '#0d1117' }}>
                                            <ReportExpansion
                                                tab={openRows[inputKey]}
                                                onTabChange={(tab) => setRowTab(inputKey, tab)}
                                                bbCode={application.bbcode}
                                                title={applicationTitle(application)}
                                                extraTabs={[{ key: 'details', label: 'Détails', content: renderDetails(application) }]}
                                            />
                                        </td>
                                    </tr>
                                )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </Table>
            )}
        </div>
    );
};

export default PendingJobApplications;
