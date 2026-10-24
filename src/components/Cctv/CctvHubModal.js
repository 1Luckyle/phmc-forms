// src/components/Cctv/CctvHubModal.js
//
// Point d'entrée de la vidéosurveillance (CCTV) sur le site : envoyer une demande, suivre les siennes et — pour
// l'administration du PHMC (Directeur(trice), Assistant(e) de Direction, Personnel Administratif) et les admins —
// traiter toutes les demandes reçues.
import React, { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { useCctvManager } from '../../utils/cctvRequests';
import CctvRequestsPanel from './CctvRequestsPanel';
import './CctvRequests.css';

const CctvHubModal = ({ show, onHide, onNewRequest, onLogin, initialTab }) => {
    const { currentEmployee, isAdmin } = useEmployeeAuth();
    const manager = useCctvManager(isAdmin);
    const [tab, setTab] = useState('mine');

    useEffect(() => { if (show) setTab(initialTab === 'manage' && manager ? 'manage' : 'mine'); }, [show, initialTab, manager]);

    return (
        <Modal show={show} onHide={onHide} size="lg" centered scrollable dialogClassName="cctv-modal" contentClassName="cctv-modal-content">
            <Modal.Header closeButton closeVariant="white">
                <Modal.Title><i className="fas fa-video me-2"></i>Vidéosurveillance</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {!currentEmployee ? (
                    <div className="cctv-gate">
                        <i className="fas fa-lock"></i>
                        <p>Connectez-vous (ou créez un compte) pour envoyer une demande de vidéosurveillance et suivre les réponses de l'administration du PHMC.</p>
                        <button type="button" className="btn btn-primary" onClick={() => { onHide(); if (onLogin) onLogin(); }}>Se connecter</button>
                    </div>
                ) : (
                    <>
                        <div className="cctv-tabs" role="tablist">
                            <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
                                <i className="fas fa-folder-open me-1"></i>Mes demandes
                            </button>
                            {manager && (
                                <button type="button" role="tab" aria-selected={tab === 'manage'} className={tab === 'manage' ? 'on' : ''} onClick={() => setTab('manage')}>
                                    <i className="fas fa-inbox me-1"></i>Gestion des demandes
                                </button>
                            )}
                        </div>
                        {tab === 'mine' && <CctvRequestsPanel scope="mine" onNewRequest={() => { onHide(); onNewRequest(); }} />}
                        {tab === 'manage' && manager && <CctvRequestsPanel scope="all" />}
                    </>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default CctvHubModal;
