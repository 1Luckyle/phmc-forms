import React from 'react';
import './PrivacyPolicyModal.css';

const PrivacyPolicyModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay privacy-policy-modal">
            <div className="modal-content">
        <h2>(( Politique de confidentialité )) </h2>
        <p>Cette politique couvre l'utilisation des outils PHMC-FR et est conforme aux <a href="https://gta.world/terms/" target="_blank" rel="noopener noreferrer">GTA World Privacy Policy</a>.</p>
        <p> Ce site Web traite des informations <strong>IN CHARACTER</strong> relatives à l'utilisation du centre médical de Pillbox Hill (une faction de GTA World) </p>
        <p>Nous sommes en pleine conformité avec les <a href="https://forum.gta.world/en/topic/141256-gta-world-website-regulations-last-update-march-1st-2025/" target="_blank" rel="noopener noreferrer">Règlements de GTA World</a> en hébergeant ce site Web sur un nom de domaine autorisé par GTA World.</p>
        <p>
          Nous utilisons des outils de fournisseurs tiers : 
          <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer">Sentry</a> (Suivi des erreurs) et  
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"> Google Firebase</a> (Sauvegarde des rapports).
        </p>
        <p>Nous collectons les données suivantes :</p>
            <li>Firebase ne stocke que les rapports sauvegardés, les champs déroulants et les noms des employés</li>
            <li>Journaux d'erreurs Informations sur l'appareil (Mobile / Bureau / Tablette), fichier d'erreur lié et bouton pressé.</li>
            <li>Seul moi-même peut voir les journaux d'erreurs et la base de données Firebase.</li>
        <p>Nous ne partageons pas vos données avec des tiers, sauf les fournisseurs tiers mentionnés ci-dessus.</p>
        <p>Questions : Posez-les sur le serveur Discord de PHMC.</p>
                <button onClick={onClose} className="close-button">Fermer</button>
            </div>
        </div>
    );
};

export default PrivacyPolicyModal;