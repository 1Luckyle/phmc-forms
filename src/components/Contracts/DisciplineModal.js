// src/components/Contracts/DisciplineModal.js
//
// « Documents disciplinaires » (Boîte à outils) : convocations à un entretien préalable, notifications de sanction et de fin de contrat. Réservé aux
// admins, à la Direction, à son assistance et au personnel administratif — pas aux chargés de recrutement, qui gardent les contrats et avenants
// (Gestion du recrutement → Contrats). L'employé les reçoit dans « Mes contrats ».
import React from 'react';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import ContractsManager from './ContractsManager';

const DisciplineModal = ({ show, onHide, showNotification }) => (
    <BaseModal isOpen={show} onClose={onHide} title="Documents disciplinaires" modalSize="xl" zIndex={1100} className="dark-ui">
        <ContractsManager scope="discipline" showNotification={showNotification} />
    </BaseModal>
);

export default DisciplineModal;
