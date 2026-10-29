// src/components/FireSafety/FireSafetyModal.js
//
// Gestion de la sécurité incendie hors du panneau admin : registre des contrôles, non-conformités (signalements du personnel compris), exercices
// d'évacuation. Accessible aux admins, à la Direction et au personnel administratif (Boîte à outils → « Gestion de la sécurité incendie »).
import React from 'react';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import '../Admin/AdminDashboard.css';
import FireSafetyManager from '../Admin/FireSafetyManager';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';

const FireSafetyModal = ({ show, onHide, showNotification }) => {
    const { staffName, currentEmployee } = useEmployeeAuth();
    return (
        <BaseModal isOpen={show} onClose={onHide} title="Gestion de la sécurité incendie" modalSize="xl" zIndex={1100} className="dark-ui">
            <FireSafetyManager showNotification={showNotification} adminName={staffName || currentEmployee?.email || ''} />
        </BaseModal>
    );
};

export default FireSafetyModal;
