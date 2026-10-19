// src/components/Contracts/ContractDocument.js
//
// Affichage d'un contrat (texte figé + bloc de signature), partagé par l'éditeur du recruteur
// (aperçu), la liste des recruteurs/admins et « Mes contrats » de l'employé.
import React from 'react';
import './Contracts.css';

const formatDateTime = (timestamp) => (timestamp ? new Date(timestamp).toLocaleString('fr-FR') : '');

const ContractDocument = ({ text, signature, signedAt, children }) => {
    const lines = String(text || '').split('\n');
    return (
        <div className="contract-doc">
            {lines.map((line, index) => {
                if (!line.trim()) return <div key={index} className="contract-doc-gap" />;
                if (index === 0) return <h5 key={index} className="contract-doc-title">{line}</h5>;
                if (/^Article \d+/.test(line)) return <h6 key={index} className="contract-doc-heading">{line}</h6>;
                return <p key={index} className="contract-doc-paragraph">{line}</p>;
            })}

            {signature && (
                <div className="contract-doc-signature">
                    <div className="contract-doc-signature-label">
                        Signé électroniquement par <strong>{signature.signedByName}</strong> le {formatDateTime(signedAt || signature.signedAt)}
                    </div>
                    <img src={signature.dataUrl || signature.url} alt={`Signature de ${signature.signedByName}`} />
                </div>
            )}
            {children}
        </div>
    );
};

export default ContractDocument;
