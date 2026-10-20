// src/components/MyJobApplicationsModal.js
//
// Vue Civil "Mes candidatures" (Lot 6 du plan Civil) : suivi de statut +
// actions (Mettre en pause / Retirer / Candidater) sur candidatures/{uid} (ancien nœud jobApplications lu aussi).
import React from 'react';
import ReactDOM from 'react-dom';
import { Button } from 'react-bootstrap';
import { removeApplication } from '../utils/recruitmentStore';
import { useDebug } from '../contexts/DebugContext';

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

const MyJobApplicationsModal = ({ show, onHide, applications, isLoading, onUpdateStatus, showNotification, onDeleted }) => {
    // Interrupteur Debug (panneau admin) : permet de supprimer une candidature de l'historique.
    const { debugDeleteApplicationsEnabled } = useDebug();
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
                        const statusInfo = STATUS_LABELS[application.statut] || { text: application.statut, color: '#8b949e' };
                        return (
                            <div key={application.id} style={cardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <strong>{application.poste || 'Poste inconnu'}</strong>
                                    <span style={{ color: statusInfo.color, fontWeight: 'bold' }}>{statusInfo.text}</span>
                                </div>
                                {application.dateEntretien && (
                                    <p style={{ margin: '5px 0', fontSize: '0.9em', color: '#8b949e' }}>
                                        <i className="fas fa-calendar-alt" style={{ marginRight: '6px' }}></i>
                                        Entretien : {new Date(application.dateEntretien).toLocaleString('fr-FR')}
                                    </p>
                                )}
                                <p style={{ margin: '5px 0', fontSize: '0.85em', color: '#8b949e' }}>
                                    Dernière mise à jour : {application.modifieLe ? new Date(application.modifieLe).toLocaleString('fr-FR') : 'N/A'}
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
