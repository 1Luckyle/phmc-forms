import React from 'react';
import './PrivacyPolicyModal.css';
import PrivacyPolicyContent from './PrivacyPolicyContent';

// Le texte vit dans PrivacyPolicyContent (partagé avec le guide de configuration) : c'est là qu'il faut le mettre à jour.
const PrivacyPolicyModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay privacy-policy-modal">
            <div className="modal-content">
                <h2>(( Politique de confidentialité ))</h2>
                <PrivacyPolicyContent />
                <button onClick={onClose} className="close-button">Fermer</button>
            </div>
        </div>
    );
};

export default PrivacyPolicyModal;
