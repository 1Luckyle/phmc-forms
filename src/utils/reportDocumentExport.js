// src/utils/reportDocumentExport.js
//
// Export d'un rapport en PDF (format A4) ou en SVG (image vectorielle), à partir du même HTML que l'aperçu et le
// téléchargement HTML. Tout se fait dans le navigateur : aucun appel serveur, donc aucun coût Firebase.
//
//   • PDF A4 : le rapport est mis en page A4 dans un cadre invisible puis envoyé à l'impression du navigateur ; il
//     suffit de choisir « Enregistrer au format PDF ». Le texte reste VECTORIEL (net à tout zoom, sélectionnable), les
//     couleurs de fond sont conservées, les lignes de tableau ne sont pas coupées en deux.
//   • IMAGE (PNG) : le rapport entier en UNE grande image (haute définition), que n'importe quelle visionneuse ouvre et que
//     Discord affiche directement : c'est le format à utiliser pour joindre un rapport à un ticket de patient. Elle peut aussi
//     être copiée dans le presse-papiers puis collée (Ctrl+V) dans Discord.
//   • SVG : une image vectorielle autonome (le rapport mis en page est embarqué dans un <foreignObject>), zoomable sans
//     perte dans un navigateur. Les images (imgBB…) sont intégrées au fichier quand le serveur d'images l'autorise
//     (sinon elles restent des liens). Les logiciels de dessin comme Inkscape / Illustrator n'affichent pas le
//     <foreignObject> : pour ça, préférer le PDF.
import { bbcodeToHtmlDocument, buildHtmlFileName } from './bbcodeToHtml';

const A4_WIDTH_PX = 794;      // 210 mm à 96 dpi
const SVG_WIDTH_PX = 900;     // même largeur que le tableau de l'aperçu
const IMAGE_TIMEOUT_MS = 12000;
const MAX_INLINE_IMAGE_BYTES = 6 * 1024 * 1024;

// Marge d'impression NULLE : le navigateur n'ajoute alors plus son en-tête (date, titre) ni son pied de page (adresse de la
// page, « about:blank »). Les marges sont recréées par nos soins : 12 mm sur les côtés et, en haut et en bas de CHAQUE page,
// un espace répété grâce à l'en-tête / au pied du tableau qui enveloppe le rapport.
const PAGE_MARGIN_MM = 12;
const PRINT_CSS_TEXT = `
@page { size: A4 portrait; margin: 0; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #FFFFFF !important; }
body { margin: 0 !important; padding: 0 ${PAGE_MARGIN_MM}mm !important; }
.print-wrap { width: 100%; border-collapse: collapse; border: 0; }
.print-wrap > thead > tr > td, .print-wrap > tfoot > tr > td { height: ${PAGE_MARGIN_MM}mm; padding: 0; border: 0; }
.print-wrap > tbody > tr > td { padding: 0; border: 0; background: transparent; }
.print-wrap table tr, img { break-inside: avoid; page-break-inside: avoid; }
img { max-width: 100%; height: auto; }
/* Logos d'en-tête : ils occupaient près de la moitié de la première page. */
img[src*="0pgw9hHm"] { max-height: 42mm; width: auto; }
img[src*="phmc-curve"] { max-height: 32mm; width: auto; }
img[src*="LkRKav2"] { max-height: 26mm; width: auto; }
/* Un titre de section reste avec ce qui le suit (pas de titre seul en bas de page). */
table[bgcolor="#141414"] { break-after: avoid; page-break-after: avoid; }
`;

// Document HTML prêt à imprimer en A4 : fond blanc pur (inutile de le grisonner ici, c'est réservé au collage sur le forum),
// contenu enveloppé dans un tableau dont l'en-tête et le pied créent les marges haute et basse de chaque page.
const buildPrintHtml = (bbCode, title) => {
    const raw = bbcodeToHtmlDocument(bbCode, { title }).replace(/#FDFDFD/gi, '#FFFFFF');
    const doc = new DOMParser().parseFromString(raw, 'text/html');

    const makeSpacerSection = (tag) => {
        const section = doc.createElement(tag);
        const row = doc.createElement('tr');
        const cell = doc.createElement('td');
        row.appendChild(cell);
        section.appendChild(row);
        return section;
    };

    const wrap = doc.createElement('table');
    wrap.className = 'print-wrap';
    wrap.setAttribute('width', '100%');
    wrap.setAttribute('cellpadding', '0');
    wrap.setAttribute('cellspacing', '0');
    wrap.setAttribute('border', '0');
    const body = doc.createElement('tbody');
    const row = doc.createElement('tr');
    const cell = doc.createElement('td');
    Array.from(doc.body.childNodes).forEach((node) => cell.appendChild(node));
    row.appendChild(cell);
    body.appendChild(row);
    wrap.appendChild(makeSpacerSection('thead'));
    wrap.appendChild(body);
    wrap.appendChild(makeSpacerSection('tfoot'));
    doc.body.appendChild(wrap);

    const style = doc.createElement('style');
    style.textContent = PRINT_CSS_TEXT;
    doc.head.appendChild(style);
    return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
};

const escapeAttribute = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Cadre invisible (hors écran) dans lequel le rapport est mis en page avant impression / mesure.
const createFrame = (html, width) => new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, {
        position: 'fixed', left: '-10000px', top: '0', width: `${width}px`, height: '1200px', border: '0',
    });
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(frame); } };
    // On n'accepte qu'un chargement qui a réellement un contenu (pas le « about:blank » initial).
    frame.addEventListener('load', () => {
        const body = frame.contentDocument && frame.contentDocument.body;
        if (body && body.childNodes.length > 0) finish();
    });
    frame.srcdoc = html;            // avant l'insertion : le premier chargement est celui du rapport
    document.body.appendChild(frame);
    setTimeout(finish, 8000);       // filet de sécurité
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

// Imprime le rapport (et seulement lui) en A4 ; l'utilisateur choisit « Enregistrer au format PDF ».
// On ouvre une fenêtre dédiée tout de suite, pendant le clic (sinon le navigateur bloque la fenêtre) : elle contient
// uniquement le rapport, donc l'impression ne reprend jamais la page du site. Si les fenêtres sont bloquées, repli sur un
// cadre invisible de la page.
export async function printReportAsPdf({ bbCode, title }) {
    const baseName = buildHtmlFileName(title).replace(/.html$/i, '');
    const html = buildPrintHtml(bbCode, baseName);

    const popup = window.open('', '_blank', 'width=900,height=800');
    if (popup && popup.document) {
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        await waitForImages(popup.document);
        popup.focus();
        popup.addEventListener('afterprint', () => popup.close());
        popup.print();
        return;
    }

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

// Construit le SVG autonome du rapport (HTML mis en page dans un <foreignObject>, images intégrées).
// → { svg, width, height }
async function buildReportSvg({ bbCode, title }) {
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
        return { svg, width: SVG_WIDTH_PX, height };
    } finally {
        if (frame.parentNode) frame.parentNode.removeChild(frame);
    }
}

// Génère et télécharge le rapport en SVG.
export async function downloadReportAsSvg({ bbCode, title }) {
    const { svg } = await buildReportSvg({ bbCode, title });
    downloadBlob(buildSvgFileName(title), svg, 'image/svg+xml;charset=utf-8');
}

// Limite d'un côté de canvas supportée par les navigateurs (Chrome : 16 384 px).
const MAX_CANVAS_SIDE = 16000;
const TARGET_SCALE = 2;      // 1 800 px de large : texte net, même zoomé dans Discord

export const buildPngFileName = (title) => buildHtmlFileName(title).replace(/\.html$/i, '.png');

// Dessine le rapport sur un canvas (via le SVG ci-dessus) et retourne un Blob PNG.
async function renderReportPng({ bbCode, title }) {
    const { svg, width, height } = await buildReportSvg({ bbCode, title });
    const scale = Math.min(TARGET_SCALE, MAX_CANVAS_SIDE / height);
    const image = new Image();
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("le navigateur n'a pas pu dessiner le rapport"));
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error("l'image est trop grande pour ce navigateur");
    return blob;
}

// Télécharge le rapport en une grande image PNG.
export async function downloadReportAsPng({ bbCode, title }) {
    const blob = await renderReportPng({ bbCode, title });
    downloadBlob(buildPngFileName(title), blob, 'image/png');
}

// Copie le rapport en image dans le presse-papiers (à coller avec Ctrl+V dans Discord).
export async function copyReportAsPng({ bbCode, title }) {
    if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
        throw new Error("ce navigateur ne permet pas de copier une image : utilisez « Télécharger l'image »");
    }
    // La génération (longue) est passée EN PROMESSE à ClipboardItem : l'écriture dans le presse-papiers est demandée pendant
    // le clic, sinon le navigateur la refuserait une fois l'image prête.
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': renderReportPng({ bbCode, title }) })]);
}

// Point d'entrée unique des menus : format 'pdf' | 'svg'. Retourne true si l'export a démarré.
export async function exportReportDocument(format, { bbCode, title, showNotification }) {
    if (!bbCode || !String(bbCode).trim()) {
        if (showNotification) showNotification('Rien à exporter : ce rapport est vide.', 'warning');
        return false;
    }
    const safeTitle = title || 'Rapport';
    try {
        if (format === 'png' || format === 'png-copy') {
            if (showNotification) showNotification("Génération de l'image…", 'info-circle', 4000);
            if (format === 'png') {
                await downloadReportAsPng({ bbCode, title: safeTitle });
                if (showNotification) showNotification('Image PNG téléchargée : vous pouvez la joindre telle quelle sur Discord.', 'check-circle');
            } else {
                await copyReportAsPng({ bbCode, title: safeTitle });
                if (showNotification) showNotification('Image copiée : collez-la dans Discord avec Ctrl+V.', 'check-circle');
            }
        } else if (format === 'pdf') {
            if (showNotification) showNotification("Une fenêtre s'ouvre avec le rapport seul : dans l'impression, choisissez « Enregistrer au format PDF » (format A4).", 'info-circle', 7000);
            await printReportAsPdf({ bbCode, title: safeTitle });
        } else {
            if (showNotification) showNotification('Génération du SVG…', 'info-circle', 3000);
            await downloadReportAsSvg({ bbCode, title: safeTitle });
            if (showNotification) showNotification('Fichier SVG téléchargé (image vectorielle, zoomable sans perte).', 'check-circle');
        }
        return true;
    } catch (error) {
        console.error(`Export ${format} impossible :`, error);
        if (/png/.test(format) && error && /taint|insecure|security/i.test(String(error.name) + String(error.message))) {
            if (showNotification) showNotification("Ce navigateur bloque l'export en image (Safari, notamment) : utilisez Chrome, Edge ou Firefox, ou le PDF.", 'error', 8000);
            return false;
        }
        if (showNotification) showNotification(`Échec de l'export ${format.toUpperCase()} : ${(error.message || '').substring(0, 120)}`, 'error');
        return false;
    }
}

export const PDF_EXPORT_LABEL = 'Télécharger le PDF (A4)';
export const SVG_EXPORT_LABEL = "Télécharger l'image vectorielle (SVG)";
export const PNG_EXPORT_LABEL = "Télécharger l'image (PNG, pour Discord)";
