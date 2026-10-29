// src/utils/reportExport.js
//
// Export d'un rapport (ou d'une sélection) en HTML depuis les menus qui proposent déjà de copier du BBCode
// (Rapports enregistrés, Dossier Patient, Mon dossier patient, Gestion du recrutement, Contrats).
//   • le BBCode est destiné au forum PHMC (pas encore disponible actuellement) ;
//   • le HTML est destiné au forum GTA World (copier-coller du fichier ouvert dans le navigateur).
// La conversion se fait dans le navigateur (aucun appel serveur, donc aucun coût Firebase).
import { bbcodeToHtmlDocument, buildHtmlFileName, downloadHtmlFile } from './bbcodeToHtml';
import { contractBbCode } from './contractCompose';

export const BBCODE_FORUM_HINT = 'forum PHMC, pas encore disponible';
export const HTML_FORUM_HINT = 'forum GTA World';

// Libellés communs des entrées de menu, pour que tous les menus disent la même chose.
export const COPY_BBCODE_LABEL = 'Copier le BBCode';
export const DOWNLOAD_HTML_LABEL = 'Télécharger le HTML';
export const COPY_BBCODE_HINT = `Le BBCode est destiné au ${BBCODE_FORUM_HINT}`;
export const DOWNLOAD_HTML_HINT = `Le HTML est destiné au ${HTML_FORUM_HINT}`;

// Assemble les BBCode de plusieurs rapports (même séparation que « Copier le BBCode sélectionné »).
// Même assemblage pour les EXPORTS (HTML, PDF, images) : un séparateur invisible entre les rapports permet à l'export en images de
// couper entre deux rapports. Ne pas l'utiliser pour copier du BBCode vers un forum.
export const combineBbCodesForExport = (reports) => (reports || []).map((report) => report?.bbCode).filter(Boolean).join('\n\n[pagebreak]\n\n');

export const combineBbCodes = (reports) => (reports || []).map((report) => report?.bbCode).filter(Boolean).join('\n\n');

// Télécharge `bbCode` converti en HTML. Retourne true si le fichier a été généré.
export const downloadBbCodeAsHtml = ({ bbCode, title, showNotification }) => {
    if (!bbCode || !String(bbCode).trim()) {
        if (showNotification) showNotification('Rien à exporter : aucun BBCode pour ce rapport.', 'warning');
        return false;
    }
    try {
        const safeTitle = title || 'Rapport';
        downloadHtmlFile(buildHtmlFileName(safeTitle), bbcodeToHtmlDocument(bbCode, { title: safeTitle }));
        if (showNotification) showNotification(`Fichier HTML téléchargé (${DOWNLOAD_HTML_HINT.toLowerCase()}).`, 'check-circle');
        return true;
    } catch (error) {
        console.error('Export HTML impossible :', error);
        if (showNotification) showNotification(`Échec de la génération du HTML : ${(error.message || '').substring(0, 120)}`, 'error');
        return false;
    }
};

// Document contractuel (BBCode figé + signature) → BBCode, pour passer par la même conversion HTML que les rapports. Un ANCIEN contrat n'a que son texte brut
// figé : première ligne = titre, lignes « Article N… » = intertitres, le reste = paragraphes.
export const contractToBbCode = (contract) => {
    const modern = contractBbCode(contract);
    if (modern) return modern;
    const lines = String(contract?.texteFige || '').split('\n');
    const out = lines.map((line, index) => {
        if (!line.trim()) return '';
        if (index === 0) return `[center][size=150][b]${line}[/b][/size][/center]`;
        if (/^Article \d+/.test(line)) return `[b]${line}[/b]`;
        return line;
    });
    const signature = contract?.signature;
    if (signature) {
        const when = (contract.signeLe || signature.signeLe)
            ? new Date(contract.signeLe || signature.signeLe).toLocaleString('fr-FR')
            : '';
        out.push('', `Signé électroniquement par [b]${signature.signeParNom || ''}[/b]${when ? ` le ${when}` : ''}`);
        const imageUrl = signature.url || signature.imageData;
        if (imageUrl) out.push(`[img]${imageUrl}[/img]`);
    }
    return out.join('\n');
};

const CONTRACT_TITLES = {
    cdi: 'Contrat de travail (CDI)', cdd: 'Contrat de travail (CDD)', stage: 'Convention de stage', avenant: 'Avenant',
    convocation: 'Convocation à un entretien préalable', sanction: 'Notification de sanction', fin: 'Notification de fin de contrat',
};
export const contractTitle = (contract) => `${CONTRACT_TITLES[contract?.champs?.typeContrat] || 'Contrat'} - ${contract?.employeNom || contract?.champs?.poste || 'PHMC'}`;
