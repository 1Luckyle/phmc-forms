// src/utils/reportDocumentExport.js
//
// Export d'un rapport en PDF (format A4) ou en grande image (PNG), à partir du même HTML que l'aperçu et le téléchargement
// HTML. Tout se fait dans le navigateur : aucun appel serveur, donc aucun coût Firebase.
//
//   • PDF A4 : le rapport est mis en page A4 dans une fenêtre dédiée puis envoyé à l'impression du navigateur ; il suffit de
//     choisir « Enregistrer au format PDF ». Le texte reste VECTORIEL (net à tout zoom, sélectionnable), le fond est blanc, les
//     lignes de tableau ne sont pas coupées en deux et le navigateur n'ajoute plus ni en-tête ni pied de page.
//   • IMAGE (PNG) : le rapport en grande image haute définition (1 800 px de large), que n'importe quelle visionneuse ouvre et
//     que Discord affiche directement : c'est le format à joindre à un ticket de patient. Un rapport trop long est DÉCOUPÉ en
//     plusieurs images (coupées entre deux blocs, jamais au milieu d'une ligne de tableau quand c'est possible). L'image peut
//     aussi être copiée dans le presse-papiers (rapport tenant sur une seule image) pour un Ctrl+V dans Discord.
import { bbcodeToHtmlDocument, buildHtmlFileName } from './bbcodeToHtml';

const A4_WIDTH_PX = 794;      // 210 mm à 96 dpi
const IMAGE_WIDTH_PX = 900;   // même largeur que le tableau de l'aperçu
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

// Imprime le rapport (et seulement lui) en A4 ; l'utilisateur choisit « Enregistrer au format PDF ».
// On ouvre une fenêtre dédiée tout de suite, pendant le clic (sinon le navigateur bloque la fenêtre) : elle contient
// uniquement le rapport, donc l'impression ne reprend jamais la page du site. Si les fenêtres sont bloquées, repli sur un
// cadre invisible de la page.
export async function printReportAsPdf({ bbCode, title }) {
    const baseName = buildHtmlFileName(title).replace(/\.html$/i, '');
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

// Hauteur maximale d'une image (px CSS) : à l'échelle 2 elle reste sous la limite d'un canvas de navigateur (16 384 px).
const MAX_PART_HEIGHT = 7000;
const TARGET_SCALE = 2;      // 1 800 px de large : texte net, même zoomé dans Discord

// Le rapport est mis en page dans un cadre invisible puis enveloppé dans un SVG (HTML dans un <foreignObject>, images
// intégrées) que le canvas dessine ensuite. Ce SVG n'est PAS proposé en téléchargement : il ne sert que d'intermédiaire.
// → { svg, width, height, cuts } ; cuts = ordonnées (px) où l'on peut couper sans abîmer le texte (bas des lignes de
// tableau, des tableaux, des images…).
async function buildReportSvg({ bbCode, title }) {
    const html = bbcodeToHtmlDocument(bbCode, { title });
    const frame = await createFrame(html, IMAGE_WIDTH_PX);
    try {
        const doc = frame.contentDocument;
        await waitForImages(doc);
        await inlineImages(doc);
        await waitForImages(doc);

        const height = Math.ceil(Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight)) + 2;
        const scrollY = frame.contentWindow.scrollY || 0;
        const candidates = new Set();
        doc.querySelectorAll('tr, table, hr, img').forEach((element) => {
            const bottom = Math.round(element.getBoundingClientRect().bottom + scrollY);
            if (bottom > 0 && bottom < height) candidates.add(bottom);
        });
        const cuts = Array.from(candidates).sort((a, b) => a - b);

        const serializer = new XMLSerializer();
        const inner = Array.from(doc.body.childNodes).map((node) => serializer.serializeToString(node)).join('');
        const bodyStyle = doc.body.getAttribute('style') || '';
        const background = doc.body.getAttribute('bgcolor') || '#FDFDFD';

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH_PX}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH_PX} ${height}">
<title>${escapeAttribute(title)}</title>
<rect width="100%" height="100%" fill="${escapeAttribute(background)}"/>
<foreignObject x="0" y="0" width="${IMAGE_WIDTH_PX}" height="${height}">
<div xmlns="http://www.w3.org/1999/xhtml" style="${escapeAttribute(bodyStyle)};width:${IMAGE_WIDTH_PX}px;box-sizing:border-box;">${inner}</div>
</foreignObject>
</svg>
`;
        return { svg, width: IMAGE_WIDTH_PX, height, cuts };
    } finally {
        if (frame.parentNode) frame.parentNode.removeChild(frame);
    }
}

// Découpe la hauteur en parties d'au plus MAX_PART_HEIGHT px, en coupant de préférence sur un bord de bloc (dans la moitié
// basse de la partie) ; à défaut, coupe franche. → [[début, fin], …]
export const planImageParts = (height, cuts, maxPartHeight = MAX_PART_HEIGHT) => {
    const parts = [];
    let start = 0;
    while (height - start > maxPartHeight) {
        const limit = start + maxPartHeight;
        const earliest = start + maxPartHeight / 2;
        const cut = cuts.filter((value) => value <= limit && value > earliest).pop() || limit;
        parts.push([start, cut]);
        start = cut;
    }
    parts.push([start, height]);
    return parts;
};

export const buildPngFileName = (title, index = 1, total = 1) => {
    const base = buildHtmlFileName(title).replace(/\.html$/i, '');
    return total > 1 ? `${base} (${index} sur ${total}).png` : `${base}.png`;
};

// Dessine le rapport sur des canvas et retourne la liste des Blob PNG (une seule image pour un rapport de taille normale).
async function renderReportPngParts({ bbCode, title }) {
    const { svg, width, height, cuts } = await buildReportSvg({ bbCode, title });
    const image = new Image();
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("le navigateur n'a pas pu dessiner le rapport"));
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    const blobs = [];
    for (const [start, end] of planImageParts(height, cuts)) {
        const partHeight = end - start;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * TARGET_SCALE);
        canvas.height = Math.round(partHeight * TARGET_SCALE);
        const context = canvas.getContext('2d');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, start, width, partHeight, 0, 0, canvas.width, canvas.height);
        // eslint-disable-next-line no-await-in-loop
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error("l'image est trop grande pour ce navigateur");
        blobs.push(blob);
    }
    return blobs;
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// Télécharge le rapport en image(s) PNG. Retourne le nombre d'images créées.
export async function downloadReportAsPng({ bbCode, title }) {
    const blobs = await renderReportPngParts({ bbCode, title });
    for (let index = 0; index < blobs.length; index += 1) {
        downloadBlob(buildPngFileName(title, index + 1, blobs.length), blobs[index], 'image/png');
        // Petite pause : le navigateur accepte ainsi plusieurs téléchargements d'affilée.
        // eslint-disable-next-line no-await-in-loop
        if (index < blobs.length - 1) await pause(500);
    }
    return blobs.length;
}

// Copie le rapport en image dans le presse-papiers (à coller avec Ctrl+V dans Discord). Une seule image peut être copiée :
// un rapport trop long (plusieurs images) doit être téléchargé.
export async function copyReportAsPng({ bbCode, title }) {
    if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
        throw new Error("ce navigateur ne permet pas de copier une image : utilisez « Télécharger l'image »");
    }
    // La génération (longue) est passée EN PROMESSE à ClipboardItem : l'écriture dans le presse-papiers est demandée pendant
    // le clic, sinon le navigateur la refuserait une fois l'image prête.
    const single = renderReportPngParts({ bbCode, title }).then((blobs) => {
        if (blobs.length > 1) {
            throw new Error(`ce rapport est trop long pour une seule image (${blobs.length} images) : utilisez « Télécharger l'image »`);
        }
        return blobs[0];
    });
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': single })]);
}

// Point d'entrée unique des menus : format 'pdf' | 'png' | 'png-copy'. Retourne true si l'export a abouti.
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
                const count = await downloadReportAsPng({ bbCode, title: safeTitle });
                if (showNotification) {
                    showNotification(count > 1
                        ? `Rapport long : ${count} images PNG téléchargées (${Array.from({ length: count }, (_, i) => `${i + 1}/${count}`).join(', ')}), à joindre dans l'ordre sur Discord.`
                        : 'Image PNG téléchargée : vous pouvez la joindre telle quelle sur Discord.', 'check-circle', count > 1 ? 9000 : undefined);
                }
            } else {
                await copyReportAsPng({ bbCode, title: safeTitle });
                if (showNotification) showNotification('Image copiée : collez-la dans Discord avec Ctrl+V.', 'check-circle');
            }
        } else {
            if (showNotification) showNotification("Une fenêtre s'ouvre avec le rapport seul : dans l'impression, choisissez « Enregistrer au format PDF » (format A4).", 'info-circle', 7000);
            await printReportAsPdf({ bbCode, title: safeTitle });
        }
        return true;
    } catch (error) {
        console.error(`Export ${format} impossible :`, error);
        if (/png/.test(format) && error && /taint|insecure|security/i.test(String(error.name) + String(error.message))) {
            if (showNotification) showNotification("Ce navigateur bloque l'export en image (Safari, notamment) : utilisez Chrome, Edge ou Firefox, ou le PDF.", 'error', 8000);
            return false;
        }
        if (showNotification) showNotification(`Échec de l'export ${format.toUpperCase()} : ${(error.message || '').substring(0, 160)}`, 'error', 8000);
        return false;
    }
}

export const PDF_EXPORT_LABEL = 'Télécharger le PDF (A4)';
export const PNG_EXPORT_LABEL = "Télécharger l'image (PNG, pour Discord)";
