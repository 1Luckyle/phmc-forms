// src/components/Cctv/CctvHubModal.js
//
// Point d'entrée de la vidéosurveillance (CCTV) sur le site : envoyer une demande, suivre les siennes et — pour
// l'administration du PHMC (Directeur(trice), Assistant(e) de Direction, Personnel Administratif) et les admins —
// traiter toutes les demandes reçues (entrée « Gestion de la vidéosurveillance » de la boîte à outils).
// Même présentation que « Gestion du recrutement » : grande fenêtre centrée, fond sombre, onglets.
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Nav } from 'react-bootstrap';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { useCctvManager } from '../../utils/cctvRequests';
import CctvRequestsPanel from './CctvRequestsPanel';
import './CctvRequests.css';

const overlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};
const contentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px', borderRadius: '6px',
    width: '96%', maxWidth: '1100px', height: '90vh', display: 'flex', flexDirection: 'column',
    position: 'relative', border: '1px solid #30363d', overflow: 'hidden',
};
const closeStyle = {
    position: 'absolute', top: '12px', right: '16px', background: 'transparent', border: 'none',
    color: '#f85149', fontSize: '28px', lineHeight: 1, cursor: 'pointer', zIndex: 5,
};

const CctvHubModal = ({ show, onHide, onNewRequest, onLogin, initialTab }) => {
    const { currentEmployee, isAdmin } = useEmployeeAuth();
    const manager = useCctvManager(isAdmin);
    const [tab, setTab] = useState('mine');

    useEffect(() => { if (show) setTab(initialTab === 'manage' && manager ? 'manage' : 'mine'); }, [show, initialTab, manager]);

    useEffect(() => {
        if (!show) return undefined;
        const onKeyDown = (event) => { if (event.key === 'Escape') onHide(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [show, onHide]);

    if (!show) return null;

    return ReactDOM.createPortal(
        <div style={overlayStyle} onClick={onHide}>
            <div style={contentStyle} onClick={(event) => event.stopPropagation()}>
                <button onClick={onHide} style={closeStyle} aria-label="Fermer">&times;</button>
                <h5 style={{ marginBottom: '4px', color: '#f0f6fc' }}>
                    <i className="fas fa-video" style={{ marginRight: '8px' }}></i>Vidéosurveillance
                </h5>
                <p style={{ color: '#8b949e', fontSize: '0.85em', marginBottom: '10px' }}>
                    {manager
                        ? "Demandes d'images de caméras : envoyez les vôtres et traitez celles reçues."
                        : "Demandez des images de caméras de surveillance et suivez les réponses de l'administration du PHMC."}
                </p>

                {!currentEmployee ? (
                    <div className="cctv-gate">
                        <i className="fas fa-lock"></i>
                        <p>Connectez-vous (ou créez un compte) pour envoyer une demande de vidéosurveillance et suivre les réponses de l'administration du PHMC.</p>
                        <button type="button" className="btn btn-primary" onClick={() => { onHide(); if (onLogin) onLogin(); }}>Se connecter</button>
                    </div>
                ) : (
                    <>
                        <Nav variant="tabs" activeKey={tab} onSelect={(key) => setTab(key)} style={{ marginBottom: '12px' }}>
                            <Nav.Item><Nav.Link eventKey="mine"><i className="fas fa-folder-open me-2"></i>Mes demandes</Nav.Link></Nav.Item>
                            {manager && <Nav.Item><Nav.Link eventKey="manage"><i className="fas fa-inbox me-2"></i>Gestion des demandes</Nav.Link></Nav.Item>}
                        </Nav>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                            {tab === 'mine' && <CctvRequestsPanel scope="mine" onNewRequest={() => { onHide(); onNewRequest(); }} />}
                            {tab === 'manage' && manager && <CctvRequestsPanel scope="all" />}
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default CctvHubModal;
