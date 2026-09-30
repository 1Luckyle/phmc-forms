// src/components/Admin/PendingJobApplications.js
//
// Panneau admin du pipeline de candidatures (Lot 6 du plan Civil). Calqué sur
// PendingAccountRequests.js : mêmes patterns get/set/remove, même helper
// sendMailBestEffort. Contrairement aux demandes de compte (un seul nœud
// plat), les candidatures vivent sous jobApplications/{applicantUid}/{id} —
// ce composant aplatit l'arbre pour les afficher en une seule liste.
import React, { useState, useEffect } from 'react';
import { Button, Table } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, set } from 'firebase/database';
import { sendEyefindMail } from '../../utils/eyefindMail';

const sendMailBestEffort = (params) => {
    sendEyefindMail(params).then((result) => {
        if (!result.ok) {
            console.warn('Eyefind Mail non envoyé:', result.error, result.message);
        }
    });
};

const STATUS_LABELS = {
    saved: 'Brouillon (non soumise)',
    submitted: 'Candidature soumise',
    interview_scheduled: 'Entretien programmé',
    interview_completed: 'Entretien effectué',
    accepted: 'Acceptée',
    refused: 'Refusée',
    withdrawn: 'Retirée par le candidat',
    paused: 'En pause',
};

// Le personnel n'a rien à faire sur les brouillons (pas encore soumis) ni sur
// les candidatures déjà retirées/en pause par le civil lui-même — on les
// masque de la file de travail par défaut pour ne pas noyer les vraies
// candidatures actives, mais elles restent consultables via "Tout afficher".
const ACTIONABLE_STATUSES = ['submitted', 'interview_scheduled', 'interview_completed', 'accepted', 'refused'];

const PendingJobApplications = ({ showNotification }) => {
    const [applications, setApplications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAll, setShowAll] = useState(false);
    const [interviewInputs, setInterviewInputs] = useState({});

    useEffect(() => {
        loadApplications();
    }, []);

    const loadApplications = async () => {
        setIsLoading(true);
        try {
            const snapshot = await get(ref(database, 'jobApplications'));
            if (!snapshot.exists()) {
                setApplications([]);
                return;
            }
            const byApplicant = snapshot.val();
            const flat = [];
            Object.entries(byApplicant).forEach(([applicantUid, apps]) => {
                Object.entries(apps || {}).forEach(([applicationId, app]) => {
                    flat.push({ ...app, applicantUid, applicationId });
                });
            });
            flat.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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
            const appPath = `jobApplications/${application.applicantUid}/${application.applicationId}`;
            const history = application.history ? [...application.history] : [];
            history.push({ status: newStatus, timestamp: Date.now() });
            await set(ref(database, appPath), {
                ...application,
                ...extra,
                status: newStatus,
                updatedAt: Date.now(),
                history,
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
            const civilSnap = await get(ref(database, `civilians/${application.applicantUid}`));
            return civilSnap.exists() ? civilSnap.val().email : null;
        } catch (error) {
            console.warn('Could not fetch applicant email:', error);
            return null;
        }
    };

    const handleScheduleInterview = async (application) => {
        const rawDateTime = interviewInputs[application.applicationId + application.applicantUid];
        if (!rawDateTime) {
            showNotification('Veuillez choisir une date et une heure pour l\'entretien.', 'warning');
            return;
        }
        const interviewDateTime = new Date(rawDateTime).toISOString();
        const ok = await updateStatus(application, 'interview_scheduled', { interviewDateTime });
        if (!ok) return;

        const email = await getApplicantEmail(application);
        if (email) {
            const formattedDateTime = new Date(interviewDateTime).toLocaleString('fr-FR');
            sendMailBestEffort({
                to: email,
                subject: 'Entretien de candidature - PHMC',
                body: `Bonjour ${application.applicantName || ''},\n\nVotre entretien pour le poste "${application.position || ''}" au Pillbox Hill Medical Center est programmé le ${formattedDateTime}.\n\nMerci de vous présenter à l'étage de l'administration du Pillbox Hill Medical Center, situé au 76 Strawberry Ave, Los Santos.\n\nEn cas d'empêchement, contactez l'administration du PHMC au plus vite.\n\nCordialement,\nPillbox Hill Medical Center`,
                html: `<p>Bonjour ${application.applicantName || ''},</p><p>Votre entretien pour le poste « <b>${application.position || ''}</b> » au Pillbox Hill Medical Center est programmé le <b>${formattedDateTime}</b>.</p><p>Merci de vous présenter à l'étage de l'administration du Pillbox Hill Medical Center, situé au 76 Strawberry Ave, Los Santos.</p><p>En cas d'empêchement, contactez l'administration du PHMC au plus vite.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
            });
        }

        showNotification('Entretien programmé et candidat notifié.', 'success');
        loadApplications();
    };

    const handleMarkInterviewCompleted = async (application) => {
        const ok = await updateStatus(application, 'interview_completed');
        if (ok) {
            showNotification('Entretien marqué comme effectué.', 'success');
            loadApplications();
        }
    };

    const handleAccept = async (application) => {
        if (application.status !== 'interview_completed') {
            showNotification('L\'entretien doit d\'abord être marqué comme effectué avant d\'accepter cette candidature.', 'warning');
            return;
        }
        if (!window.confirm(`Confirmer l'acceptation de la candidature de ${application.applicantName} ?`)) return;

        const ok = await updateStatus(application, 'accepted');
        if (!ok) return;

        const email = await getApplicantEmail(application);
        if (email) {
            sendMailBestEffort({
                to: email,
                subject: 'Votre candidature a été acceptée - PHMC',
                body: `Bonjour ${application.applicantName || ''},\n\nFélicitations ! Votre candidature pour le poste "${application.position || ''}" au Pillbox Hill Medical Center a été acceptée.\n\nVous serez contacté(e) prochainement par l'administration pour la suite des formalités.\n\nCordialement,\nPillbox Hill Medical Center`,
                html: `<p>Bonjour ${application.applicantName || ''},</p><p>Félicitations ! Votre candidature pour le poste « <b>${application.position || ''}</b> » au Pillbox Hill Medical Center a été <b>acceptée</b>.</p><p>Vous serez contacté(e) prochainement par l'administration pour la suite des formalités.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
            });
        }

        showNotification('Candidature acceptée et candidat notifié.', 'success');
        loadApplications();
    };

    const handleRefuse = async (application) => {
        if (!window.confirm(`Confirmer le refus de la candidature de ${application.applicantName} ?`)) return;

        const ok = await updateStatus(application, 'refused');
        if (!ok) return;

        const email = await getApplicantEmail(application);
        if (email) {
            sendMailBestEffort({
                to: email,
                subject: 'Votre candidature - PHMC',
                body: `Bonjour ${application.applicantName || ''},\n\nNous vous remercions pour votre candidature au poste "${application.position || ''}" au Pillbox Hill Medical Center. Après examen, celle-ci n'a malheureusement pas été retenue.\n\nVous pouvez candidater à nouveau ultérieurement.\n\nCordialement,\nPillbox Hill Medical Center`,
                html: `<p>Bonjour ${application.applicantName || ''},</p><p>Nous vous remercions pour votre candidature au poste « <b>${application.position || ''}</b> » au Pillbox Hill Medical Center. Après examen, celle-ci n'a malheureusement pas été retenue.</p><p>Vous pouvez candidater à nouveau ultérieurement.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
            });
        }

        showNotification('Candidature refusée et candidat notifié.', 'info');
        loadApplications();
    };

    const visibleApplications = showAll
        ? applications
        : applications.filter((app) => ACTIONABLE_STATUSES.includes(app.status));

    if (isLoading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Chargement des candidatures...</div>;
    }

    return (
        <div style={{ padding: '20px' }}>
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
                            const inputKey = application.applicationId + application.applicantUid;
                            return (
                                <tr key={inputKey}>
                                    <td>{application.applicantName || 'N/A'} {application.patientID ? `(${application.patientID})` : ''}</td>
                                    <td>{application.position || 'N/A'}</td>
                                    <td>{STATUS_LABELS[application.status] || application.status}</td>
                                    <td>
                                        {application.interviewDateTime
                                            ? new Date(application.interviewDateTime).toLocaleString('fr-FR')
                                            : (application.status === 'submitted' && (
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
                                            {application.status === 'submitted' && (
                                                <Button size="sm" variant="primary" onClick={() => handleScheduleInterview(application)}>
                                                    Planifier un entretien
                                                </Button>
                                            )}
                                            {application.status === 'interview_scheduled' && (
                                                <Button size="sm" variant="info" onClick={() => handleMarkInterviewCompleted(application)}>
                                                    Marquer l'entretien effectué
                                                </Button>
                                            )}
                                            {application.status === 'interview_completed' && (
                                                <Button size="sm" variant="success" onClick={() => handleAccept(application)}>
                                                    Accepter
                                                </Button>
                                            )}
                                            {['submitted', 'interview_scheduled', 'interview_completed'].includes(application.status) && (
                                                <Button size="sm" variant="danger" onClick={() => handleRefuse(application)}>
                                                    Refuser
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            )}
        </div>
    );
};

export default PendingJobApplications;
