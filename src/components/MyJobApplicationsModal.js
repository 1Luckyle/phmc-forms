// src/components/MyJobApplicationsModal.js
//
// Vue Civil "Mes candidatures" (Lot 6 du plan Civil) : suivi de statut +
// actions (Mettre en pause / Retirer / Candidater) sur jobApplications/{uid}.
import React from 'react';
import ReactDOM from 'react-dom';
import { Button } from 'react-bootstrap';

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

const STATUS_LABELS = {
    saved: { text: 'Brouillon enregistré', color: '#8b949e' },
    submitted: { text: 'Candidature envoyée', color: '#58a6ff' },
    interview_scheduled: { text: 'Entretien programmé', color: '#d29922' },
    interview_completed: { text: 'Entretien effectué', color: '#d29922' },
    accepted: { text: 'Acceptée', color: '#3fb950' },
    refused: { text: 'Refusée', color: '#f85149' },
    withdrawn: { text: 'Retirée', color: '#8b949e' },
    paused: { text: 'En pause', color: '#8b949e' },
};

const ACTIVE_STATUSES = ['submitted', 'interview_scheduled', 'interview_completed'];

const MyJobApplicationsModal = ({ show, onHide, applications, isLoading, onUpdateStatus, showNotification }) => {
    if (!show) return null;

    const handleAction = async (application, newStatus) => {
        const result = await onUpdateStatus(application.applicantUid, application.id, newStatus);
        if (result?.success) {
            showNotification(
                newStatus === 'submitted' ? 'Candidature (re)soumise.' : 'Statut mis à jour.',
                'check-circle'
            );
        }
    };

    return ReactDOM.createPortal(
        <div style={modalStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                <h5 style={{ marginBottom: '15px' }}>Mes candidatures</h5>

                <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                    {isLoading && <p style={{ textAlign: 'center' }}>Chargement...</p>}
                    {!isLoading && applications.length === 0 && (
                        <p style={{ textAlign: 'center', marginTop: '20px' }}>
                            Aucune candidature enregistrée pour l'instant.
                        </p>
                    )}
                    {!isLoading && applications.map((application) => {
                        const statusInfo = STATUS_LABELS[application.status] || { text: application.status, color: '#8b949e' };
                        return (
                            <div key={application.id} style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <strong>{application.position || 'Poste inconnu'}</strong>
                                    <span style={{ color: statusInfo.color, fontWeight: 'bold' }}>{statusInfo.text}</span>
                                </div>
                                {application.interviewDateTime && (
                                    <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#8b949e' }}>
                                        <i className="fas fa-calendar-alt" style={{ marginRight: '6px' }}></i>
                                        Entretien : {new Date(application.interviewDateTime).toLocaleString()}
                                    </p>
                                )}
                                <p style={{ margin: '5px 0', fontSize: '0.85em', color: '#8b949e' }}>
                                    Dernière mise à jour : {application.updatedAt ? new Date(application.updatedAt).toLocaleString() : 'N/A'}
                                </p>
                                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {application.status === 'saved' && (
                                        <Button size="sm" variant="primary" onClick={() => handleAction(application, 'submitted')}>
                                            Candidater
                                        </Button>
                                    )}
                                    {application.status === 'paused' && (
                                        <Button size="sm" variant="primary" onClick={() => handleAction(application, 'submitted')}>
                                            Reprendre ma candidature
                                        </Button>
                                    )}
                                    {ACTIVE_STATUSES.includes(application.status) && (
                                        <Button size="sm" variant="secondary" onClick={() => handleAction(application, 'paused')}>
                                            Mettre en pause
                                        </Button>
                                    )}
                                    {(ACTIVE_STATUSES.includes(application.status) || application.status === 'saved' || application.status === 'paused') && (
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() => {
                                                if (window.confirm('Retirer cette candidature ?')) {
                                                    handleAction(application, 'withdrawn');
                                                }
                                            }}
                                        >
                                            Retirer
                                        </Button>
                                    )}
                                </div>
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
