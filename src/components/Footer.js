import React, { useState } from 'react';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import LegalNoticeModal from './LegalNoticeModal';
import { useSiteMode } from '../contexts/SiteConfigContext';

const Footer = () => {
    const { isClassic } = useSiteMode();
    const [isPrivacyPolicyModalOpen, setPrivacyPolicyModalOpen] = useState(false);
    const [isLegalNoticeOpen, setLegalNoticeOpen] = useState(false);

    const togglePrivacyPolicyModal = () => {
        setPrivacyPolicyModalOpen(!isPrivacyPolicyModalOpen);
    };

    return (
        <div className="header-info-wrapper">
            <div className="header-info">
                <span className="contact-info">
                    {/* Version classique du site : aucune mention de GTA World. */}
                    {isClassic ? 'PILLBOX HILL MEDICAL CENTER. ICÔNES FOURNIES PAR FLATICON.' : 'FOURNI À GTA WORLD (EU). ICÔNES FOURNIES PAR FLATICON.'}
                </span>
                <div className="footer-links">
                    <button onClick={togglePrivacyPolicyModal} className="privacy-policy-button">Voir la politique de confidentialité</button>
                    <button onClick={() => setLegalNoticeOpen(true)} className="privacy-policy-button">Mentions légales</button>
                    <a href="#/transparence" className="privacy-policy-button">Transparence</a>
                    <a href="#/hommage" className="privacy-policy-button">Hommage</a>
                </div>
            </div>
            <PrivacyPolicyModal isOpen={isPrivacyPolicyModalOpen} onClose={togglePrivacyPolicyModal} />
            <LegalNoticeModal isOpen={isLegalNoticeOpen} onClose={() => setLegalNoticeOpen(false)} />
        </div>
    );
};

export default Footer;
