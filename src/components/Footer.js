import React, { useState } from 'react';
import PrivacyPolicyModal from './PrivacyPolicyModal';

const Footer = () => {
    const [isPrivacyPolicyModalOpen, setPrivacyPolicyModalOpen] = useState(false);

    const togglePrivacyPolicyModal = () => {
        setPrivacyPolicyModalOpen(!isPrivacyPolicyModalOpen);
    };

    return (
        <div className="header-info-wrapper">
            <div className="header-info">
                <span className="contact-info">
                    FOURNI À GTA WORLD (EU). ICÔNES FOURNIES PAR FLATICON.
                </span>
                <div>
                    <button onClick={togglePrivacyPolicyModal} className="privacy-policy-button">Voir la politique de confidentialité</button>
                    <a href="#/transparence" className="privacy-policy-button" style={{ textDecoration: 'none', display: 'inline-block' }}>Transparence</a>
                    <a href="#/plan" className="privacy-policy-button" style={{ textDecoration: 'none', display: 'inline-block' }}>Plan de l'hôpital</a>
                </div>
            </div>
            <PrivacyPolicyModal isOpen={isPrivacyPolicyModalOpen} onClose={togglePrivacyPolicyModal} />
        </div>
    );
};

export default Footer;
