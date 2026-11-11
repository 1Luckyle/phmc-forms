// src/components/PrescriptionMenu.js
//
// Actions sur l'ORDONNANCE comme document à part (phmc-bbcode-generators/generatePrescription.js) : mêmes options que pour n'importe quel rapport (copier le BBCode, télécharger le HTML, le PDF ou
// l'image, copier l'image pour Discord, copier le titre). Deux présentations :
//   • <PrescriptionMenu />        : bouton « Copier l'ordonnance » à menu déroulant (dans le formulaire) ;
//   • <PrescriptionMenuSection /> : un bloc « Ordonnance » à ajouter au menu « Copier » d'un rapport enregistré (Rapports sauvegardés, Dossier Patient…).
import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { copyToClipboard } from './notificationService';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { useNotification } from '../contexts/NotificationContext';
import { exportReportDocument, PDF_EXPORT_LABEL, PNG_EXPORT_LABEL } from '../utils/reportDocumentExport';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../utils/reportExport';

// Pas de fournisseur de notifications (test, page isolée) : les messages sont simplement ignorés.
const useNotifier = (provided) => {
    const context = useNotification();
    return provided || (context && context.showNotification) || (() => {});
};

export const PrescriptionItems = ({ bbCode, title, showNotification, plainText = '' }) => {
    const { bbcodeEnabled } = useSiteConfig();
    const notify = useNotifier(showNotification);
    return (
        <>
            {bbcodeEnabled && <Dropdown.Item onClick={() => copyToClipboard(bbCode, notify, "BBCode de l'ordonnance copié !")} title={COPY_BBCODE_HINT}>Copier le BBCode</Dropdown.Item>}
            <Dropdown.Item onClick={() => downloadBbCodeAsHtml({ bbCode, title, showNotification: notify })} title={DOWNLOAD_HTML_HINT}>Télécharger le HTML</Dropdown.Item>
            <Dropdown.Item onClick={() => exportReportDocument('pdf', { bbCode, title, showNotification: notify })}>{PDF_EXPORT_LABEL}</Dropdown.Item>
            <Dropdown.Item onClick={() => exportReportDocument('png', { bbCode, title, showNotification: notify })}>{PNG_EXPORT_LABEL}</Dropdown.Item>
            <Dropdown.Item onClick={() => exportReportDocument('png-copy', { bbCode, title, showNotification: notify })}>Copier l'image (à coller dans Discord)</Dropdown.Item>
            {plainText && <Dropdown.Item onClick={() => copyToClipboard(plainText, notify, 'Ordonnance copiée (texte) !')}>Copier le texte brut</Dropdown.Item>}
            <Dropdown.Item onClick={() => copyToClipboard(title, notify, 'Titre copié !')}>Copier le titre</Dropdown.Item>
        </>
    );
};

// Bouton à menu : « Copier l'ordonnance ».
export const PrescriptionMenu = ({ bbCode, title, plainText = '', showNotification }) => (
    <Dropdown className="d-inline-block">
        <Dropdown.Toggle size="sm" variant="outline-secondary"><i className="fas fa-copy me-1"></i>Copier l'ordonnance</Dropdown.Toggle>
        <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
            <PrescriptionItems bbCode={bbCode} title={title} plainText={plainText} showNotification={showNotification} />
        </Dropdown.Menu>
    </Dropdown>
);

// Bloc « Ordonnance » à ranger dans le menu « Copier » d'une ligne de rapport ; rien si le rapport n'a pas d'ordonnance (`prescription` : { bbCode, title } ou null).
export const PrescriptionMenuSection = ({ prescription, showNotification }) => {
    if (!prescription || !prescription.bbCode) return null;
    return (
        <>
            <Dropdown.Divider />
            <Dropdown.Header><i className="fas fa-file-prescription me-1"></i>Ordonnance de ce rapport</Dropdown.Header>
            <PrescriptionItems bbCode={prescription.bbCode} title={prescription.title} plainText={prescription.plainText} showNotification={showNotification} />
        </>
    );
};

export default PrescriptionMenu;
