// src/utils/reportDocumentExport.js
//
// Export d'un rapport en PDF (format A4) ou en SVG (image vectorielle), à partir du même HTML que l'aperçu et le
// téléchargement HTML. Tout se fait dans le navigateur : aucun appel serveur, donc aucun coût Firebase.
//
//   • PDF A4 : le rapport est mis en page A4 dans un cadre invisible puis envoyé à l'impression du navigateur ; il
//     suffit de choisir « Enregistrer au format PDF ». Le texte reste VECTORIEL (net à tout zoom, sélectionnable), les
//     couleurs de fond sont conservées, les lignes de tableau ne sont pas coupées en deux.
//   • SVG : une image vectorielle autonome (le rapport mis en page est embarqué dans un <foreignObject>), zoomable sans
//     perte dans un navigateur. Les images (imgBB…) sont intégrées au fichier quand le serveur d'images l'autorise
//     (sinon elles restent des liens). Les logiciels de dessin comme Inkscape / Illustrator n'affichent pas le
//     <foreignObject> : pour ça, préférer le PDF.
import { bbcodeToHtmlDocument, buildHtmlFileName } from './bbcodeToHtml';

const A4_WIDTH_PX = 794;      // 210 mm à 96 dpi
const SVG_WIDTH_PX = 900;     // même largeur que le tableau de l'aperçu
const IMAGE_TIMEOUT_MS = 12000;
const MAX_INLINE_IMAGE_BYTES = 6 * 1024 * 1024;

const PRINT_CSS = `<style>
@page { size: A4 portrait; margin: 12mm; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { padding: 0 !important; }
tr, img { break-inside: avoid; page-break-inside: avoid; }
img { max-width: 100%; height: auto; }
</style>`;

const escapeAttribute = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Cadre invisible (hors écran) dans lequel le rapport est mis en page avant impression / mesure.
const createFrame = (html, width) => new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, {
        position: 'fixed', left: '-10000px', top: '0', width: `${width}px`, height: '1200px', border: '0',
    });
    frame.onload = () => resolve(frame);
    document.body.appendChild(frame);
    frame.srcdoc = html;
});

// Attend que toutes les images du document soient chargées (ou en erreur), sans bloquer plus de IMAGE_TIMEOUT_MS.
const waitForImages = (doc) => {
    const pending = Array.from(doc.images).filter((image) => !image.complete).map((image) => new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
    }));
    if (pending.length === 0) return Promise.resolve();
    return Promise.race([Promise.all(pending), new Promise((resolve) => setTimeout(resolve, IMAGE_TIMEOUT_MS))]);
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

// Remplace les images distantes par des images intégrées (data:) pour que le SVG soit autonome. Échec silencieux :
// une image que le serveur refuse de partager (CORS) reste un lien.
const inlineImages = async (doc) => {
    await Promise.all(Array.from(doc.images).map(async (image) => {
        const source = image.getAttribute('src') || '';
        if (!/^https?:/i.test(source)) return;
        try {
            const response = await fetch(source, { mode: 'cors', referrerPolicy: 'no-referrer' });
            if (!response.ok) return;
            const blob = await response.blob();
            if (blob.size > MAX_INLINE_IMAGE_BYTES) return;
            image.setAttribute('src', await blobToDataUrl(blob));
        } catch (error) {
            // lien conservé
        }
    }));
};

const downloadBlob = (fileName, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const buildSvgFileName = (title) => buildHtmlFileName(title).replace(/\.html$/i, '.svg');

// Ouvre la fenêtre d'impression sur le rapport en A4 ; l'utilisateur choisit « Enregistrer au format PDF ».
export async function printReportAsPdf({ bbCode, title }) {
    const baseName = buildHtmlFileName(title).replace(/\.html$/i, '');
    const html = bbcodeToHtmlDocument(bbCode, { title: baseName }).replace('</head>', `${PRINT_CSS}</head>`);
    const frame = await createFrame(html, A4_WIDTH_PX);
    const cleanup = () => { if (frame.parentNode) frame.parentNode.removeChild(frame); };
    try {
        await waitForImages(frame.contentDocument);
        frame.contentWindow.addEventListener('afterprint', () => setTimeout(cleanup, 300), { once: true });
        frame.contentWindow.focus();
        frame.contentWindow.print();
        // Filet de sécurité : certains navigateurs ne signalent pas la fin de l'impression.
        setTimeout(cleanup, 5 * 60 * 1000);
    } catch (error) {
        cleanup();
        throw error;
    }
}

// Génère et télécharge le rapport en SVG.
export async function downloadReportAsSvg({ bbCode, title }) {
    const html = bbcodeToHtmlDocument(bbCode, { title });
    const frame = await createFrame(html, SVG_WIDTH_PX);
    try {
        const doc = frame.contentDocument;
        await waitForImages(doc);
        await inlineImages(doc);
        await waitForImages(doc);

        const height = Math.ceil(Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight)) + 2;
        const serializer = new XMLSerializer();
        const inner = Array.from(doc.body.childNodes).map((node) => serializer.serializeToString(node)).join('');
        const bodyStyle = doc.body.getAttribute('style') || '';
        const background = doc.body.getAttribute('bgcolor') || '#FDFDFD';

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH_PX}" height="${height}" viewBox="0 0 ${SVG_WIDTH_PX} ${height}">
<title>${escapeAttribute(title)}</title>
<rect width="100%" height="100%" fill="${escapeAttribute(background)}"/>
<foreignObject x="0" y="0" width="${SVG_WIDTH_PX}" height="${height}">
<div xmlns="http://www.w3.org/1999/xhtml" style="${escapeAttribute(bodyStyle)};width:${SVG_WIDTH_PX}px;box-sizing:border-box;">${inner}</div>
</foreignObject>
</svg>
`;
        downloadBlob(buildSvgFileName(title), svg, 'image/svg+xml;charset=utf-8');
    } finally {
        if (frame.parentNode) frame.parentNode.removeChild(frame);
    }
}

// Point d'entrée unique des menus : format 'pdf' | 'svg'. Retourne true si l'export a démarré.
export async function exportReportDocument(format, { bbCode, title, showNotification }) {
    if (!bbCode || !String(bbCode).trim()) {
        if (showNotification) showNotification('Rien à exporter : ce rapport est vide.', 'warning');
        return false;
    }
    const safeTitle = title || 'Rapport';
    try {
        if (format === 'pdf') {
            if (showNotification) showNotification("Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF » (format A4).", 'info-circle', 7000);
            await printReportAsPdf({ bbCode, title: safeTitle });
        } else {
            if (showNotification) showNotification('Génération du SVG…', 'info-circle', 3000);
            await downloadReportAsSvg({ bbCode, title: safeTitle });
            if (showNotification) showNotification('Fichier SVG téléchargé (image vectorielle, zoomable sans perte).', 'check-circle');
        }
        return true;
    } catch (error) {
        console.error(`Export ${format} impossible :`, error);
        if (showNotification) showNotification(`Échec de l'export ${format.toUpperCase()} : ${(error.message || '').substring(0, 120)}`, 'error');
        return false;
    }
}

export const PDF_EXPORT_LABEL = 'Télécharger le PDF (A4)';
export const SVG_EXPORT_LABEL = "Télécharger l'image vectorielle (SVG)";
