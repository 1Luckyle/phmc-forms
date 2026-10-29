// src/components/Contracts/ContractDocument.js
//
// Affichage d'un document contractuel, partagé par l'éditeur du recruteur (aperçu), la liste des recruteurs/admins et « Mes documents administratifs » de l'employé.
//   • Un document récent est du BBCode (comme l'AMA et les formulaires) : il s'affiche dans le même cadre d'aperçu que les rapports, avec l'en-tête
//     et les bandeaux du PHMC, et il s'exporte de la même façon (HTML, PDF, image).
//   • Un ANCIEN contrat (texte brut figé, sans BBCode) s'affiche comme avant, sur fond clair.
import React from 'react';
import { Button } from 'react-bootstrap';
import { ReportPreviewFrame } from '../ReportExpansion';
import { contractBbCode } from '../../utils/contractCompose';
import { contractToBbCode, contractTitle, downloadBbCodeAsHtml, DOWNLOAD_HTML_HINT, COPY_BBCODE_HINT } from '../../utils/reportExport';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../../utils/reportDocumentExport';
import { copyToClipboard } from '../notificationService';
import { useSiteConfig } from '../../contexts/SiteConfigContext';
import './Contracts.css';

const formatDateTime = (timestamp) => (timestamp ? new Date(timestamp).toLocaleString('fr-FR') : '');

const LegacyText = ({ text, signature, signedAt }) => {
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
                        Signé électroniquement par <strong>{signature.signeParNom}</strong> le {formatDateTime(signedAt || signature.signeLe)}
                    </div>
                    <img src={signature.imageData || signature.url} alt={`Signature de ${signature.signeParNom}`} />
                </div>
            )}
        </div>
    );
};

// `contract` : document normalisé (utils/contracts.js). `bbCode` : aperçu d'un brouillon (BBCode déjà complet), sans document enregistré.
const ContractDocument = ({ contract, bbCode, title, children }) => {
    const composed = bbCode || contractBbCode(contract);
    return (
        <div>
            {composed ? (
                <div className="contract-frame">
                    <ReportPreviewFrame bbCode={composed} title={title || (contract ? contractTitle(contract) : 'Contrat')} height={520} />
                </div>
            ) : (
                <LegacyText text={contract?.texteFige} signature={contract?.signature} signedAt={contract?.signeLe} />
            )}
            {children}
        </div>
    );
};

// Boutons d'export d'un document figé : texte, BBCode, HTML (forum GTA World), PDF.
export const ContractExportBar = ({ contract, showNotification, className = 'd-flex flex-wrap justify-content-end gap-2 mt-2' }) => {
    const { bbcodeEnabled } = useSiteConfig();
    const bb = contractToBbCode(contract);
    const title = contractTitle(contract);
    return (
        <div className={className}>
            <Button variant="outline-light" size="sm" onClick={() => copyToClipboard(contract.texteFige, showNotification, 'Texte du document copié.')} disabled={!contract.texteFige}>
                <i className="fas fa-copy me-1"></i>Copier le texte
            </Button>
            {bbcodeEnabled && (
                <Button variant="outline-light" size="sm" title={COPY_BBCODE_HINT} onClick={() => copyToClipboard(bb, showNotification, 'BBCode copié !')} disabled={!bb}>
                    <i className="fas fa-code me-1"></i>Copier le BBCode
                </Button>
            )}
            <Button variant="outline-light" size="sm" title={DOWNLOAD_HTML_HINT} disabled={!bb}
                onClick={() => downloadBbCodeAsHtml({ bbCode: bb, title, showNotification })}>
                <i className="fas fa-download me-1"></i>Télécharger le HTML
            </Button>
            <Button variant="outline-light" size="sm" disabled={!bb} onClick={() => exportReportDocument('pdf', { bbCode: bb, title, showNotification })}>
                <i className="fas fa-file-pdf me-1"></i>{PDF_EXPORT_LABEL}
            </Button>
        </div>
    );
};

export default ContractDocument;
