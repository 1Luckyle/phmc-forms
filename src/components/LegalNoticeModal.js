import React, { useEffect, useState } from 'react';
import './PrivacyPolicyModal.css';
import { PolicyView } from './PrivacyPolicyContent';
import { loadPolicy } from '../utils/privacyPolicy';

// Fenêtre « Mentions légales » du pied de page (éditeur, hébergeurs, nature du site). Affiche la version publiée depuis le panneau admin
// (Confidentialité & mentions légales) ou, à défaut, le texte d'origine de utils/legalNotice.js.
const LegalNoticeModal = ({ isOpen, onClose }) => {
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        if (!isOpen) return undefined;
        let cancelled = false;
        loadPolicy('mentions').then((loaded) => { if (!cancelled) setNotice(loaded); });
        return () => { cancelled = true; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        // Un clic à côté de la fenêtre (sur le fond) la ferme.
        <div className="modal-overlay privacy-policy-modal" onClick={onClose}>
            <div className="modal-content" onClick={(event) => event.stopPropagation()}>
                <h2>Mentions légales</h2>
                {notice
                    ? <PolicyView text={notice.texte} miseAJour={notice.miseAJour} />
                    : <div className="privacy-policy-content"><p>Chargement…</p></div>}
                <button onClick={onClose} className="close-button">Fermer</button>
            </div>
        </div>
    );
};

export default LegalNoticeModal;
