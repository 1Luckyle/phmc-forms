import React from 'react';
import './PrivacyPolicyModal.css';
import { PolicyView } from './PrivacyPolicyContent';
import { LEGAL_NOTICE_TEXT, LEGAL_NOTICE_UPDATE } from '../utils/legalNotice';

// Fenêtre « Mentions légales » du pied de page (éditeur, hébergeurs, nature du site). Le texte vit dans utils/legalNotice.js ;
// il est aussi repris dans la politique de confidentialité (section « Mentions légales »).
const LegalNoticeModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay privacy-policy-modal">
            <div className="modal-content">
                <h2>Mentions légales</h2>
                <PolicyView text={LEGAL_NOTICE_TEXT} miseAJour={LEGAL_NOTICE_UPDATE} />
                <button onClick={onClose} className="close-button">Fermer</button>
            </div>
        </div>
    );
};

export default LegalNoticeModal;
