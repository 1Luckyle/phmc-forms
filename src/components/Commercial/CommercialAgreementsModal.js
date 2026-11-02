// src/components/Commercial/CommercialAgreementsModal.js
//
// « Contrats commerciaux » (Administratif) : accords avec des entreprises, fournisseurs, prestataires ou partenaires. Réservé aux admins, à la Direction,
// à son assistance et au personnel administratif.
import React from 'react';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import CommercialAgreementsManager from './CommercialAgreementsManager';

const CommercialAgreementsModal = ({ show, onHide, showNotification }) => (
    <BaseModal isOpen={show} onClose={onHide} title="Contrats commerciaux" modalSize="xl" zIndex={1100} className="dark-ui">
        <CommercialAgreementsManager showNotification={showNotification} />
    </BaseModal>
);

export default CommercialAgreementsModal;
