// src/utils/bbcodeToHtml.js
//
// Convertit le BBCode produit par les générateurs (format phpBB avec balises personnalisées :
// [divbox], [divboxcolor], [table], [tr], [td], [cb], [cbc], [br]…) en un document HTML autonome,
// téléchargeable, que l'utilisateur ouvre dans son navigateur puis copie-colle (texte enrichi)
// dans l'éditeur du forum GTA World (Invision Community) — ou du forum PHMC.
//
// Tout se fait dans le navigateur : aucun appel serveur, donc aucun impact Firebase.
//
// Règles issues de tests réels sur le forum (voir « Spec — Export HTML des rapports ») :
//   • JAMAIS de blanc pur ni de noir pur : le forum les remplace par les couleurs du thème et le
//     rapport devient illisible en thème sombre. #FFFFFF/#FFF/white → #FDFDFD, #000000/#000/black → #141414 ;
//   • uniquement des attributs et des styles EN LIGNE (l'éditeur riche supprime <style> et les classes) ;
//   • mise en page par TABLEAUX uniquement (pas de flex/grid/position) ;
//   • fond déclaré deux fois (attribut bgcolor + background-color) sur chaque table et chaque cellule ;
//   • tout texte venant du formulaire est ÉCHAPPÉ : <script> ou <b> saisis s'affichent tels quels.

export const HTML_COLORS = {
    BG: '#FDFDFD',        // fond de toutes les cellules et tables
    FG: '#141414',        // texte par défaut
    BAR: '#141414',       // fond des bandeaux de section
    BAR_TEXT: '#FDFDFD',  // texte des bandeaux
    BORDER: '#9A9A9A',    // bordures des cellules
};
const { BG, FG, BAR, BAR_TEXT, BORDER } = HTML_COLORS;

const FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const CHECKED_BOX = '☑';   // ☑
const EMPTY_BOX = '☐';     // ☐

// Balises reconnues. Toute autre balise est conservée en texte brut et journalisée.
const KNOWN_TAGS = new Set([
    'b', 'u', 'i', 's', 'color', 'size', 'img', 'br', 'cb', 'cbc',
    'center', 'left', 'right', 'justify', 'list', '*', 'hr', 'url', 'quote', 'altspoiler',
    'imageleft', 'code', 'divbox', 'divboxcolor', 'table', 'tr', 'td', 'pagebreak',
]);
// Balises sans contenu : leur éventuelle balise fermante ([/br], [/hr]) est ignorée.
const LEAF_TAGS = new Set(['br', 'cb', 'cbc', 'hr', '*', 'pagebreak']);
// Balises dont le contenu est du texte brut (jusqu'à la balise fermante).
const RAW_TAGS = new Set(['img', 'code']);
// Éléments qu'une balise fermante « en ligne » ([/b], [/center]…) ne doit jamais traverser.
const BOUNDARY_TAGS = new Set(['table', 'tr', 'td', 'divbox', 'divboxcolor', 'altspoiler', 'quote']);

// ─── Utilitaires ──────────────────────────────────────────────────────────────

export const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isHttpUrl = (value) => /^https?:\/\/[^\s"'<>]+$/i.test(String(value || '').trim());

// Normalise une couleur du BBCode. Retourne null si elle est inutilisable (ignorée, jamais injectée).
export const normalizeColor = (raw) => {
    if (raw == null) return null;
    const value = String(raw).trim().replace(/^["']|["']$/g, '').toLowerCase();
    if (!value) return null;
    if (value === 'white' || value === '#fff' || value === '#ffffff') return BG;
    if (value === 'black' || value === '#000' || value === '#000000') return FG;
    const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
    if (rgb) {
        const [r, g, b] = rgb.slice(1).map((n) => Math.min(255, Number(n)));
        if (r === 255 && g === 255 && b === 255) return BG;
        if (r === 0 && g === 0 && b === 0) return FG;
        return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    }
    if (/^#[0-9a-f]{3}$/.test(value)) {
        return `#${value.slice(1).split('').map((c) => c + c).join('').toUpperCase()}`;
    }
    if (/^#[0-9a-f]{6}$/.test(value)) return value.toUpperCase();
    if (/^[a-z]{3,20}$/.test(value)) return value;   // couleur nommée (red, orange…)
    return null;
};

// ─── 1. Découpage en jetons ───────────────────────────────────────────────────

// « [td bgcolor=#E6E6E6] » (séparateur espace) n'existe que pour les cellules ; ailleurs seul « = » compte.
const TAG_RE = /\[(\/?)([a-zA-Z*]+)(?:([= ])([^\]]*))?\]/g;
const SPACE_PARAM_TAGS = new Set(['td', 'tr', 'table']);
// [bold] est utilisé par plusieurs générateurs (rapports de décès) : même rendu que [b].
const TAG_ALIASES = { bold: 'b' };

const tokenize = (input, warn) => {
    const tokens = [];
    const text = String(input || '').replace(/\r\n?/g, '\n');
    let lastIndex = 0;
    let match;
    TAG_RE.lastIndex = 0;

    const pushText = (value) => { if (value) tokens.push({ type: 'text', text: value }); };

    while ((match = TAG_RE.exec(text)) !== null) {
        const [full, slash, rawName, separator, rawParam] = match;
        const lowered = rawName.toLowerCase();
        const name = TAG_ALIASES[lowered] || lowered;
        // Séparateur espace : valable seulement pour td/tr/table, dont le paramètre est ignoré.
        const param = separator === ' ' ? undefined : rawParam;
        if (separator === ' ' && !SPACE_PARAM_TAGS.has(name)) continue;
        if (!KNOWN_TAGS.has(name)) {
            warn(`Balise inconnue conservée en texte brut : ${full}`);
            continue;   // reste dans le texte (le segment n'est pas coupé)
        }
        pushText(text.slice(lastIndex, match.index));
        lastIndex = TAG_RE.lastIndex;

        const isRaw = !slash && (RAW_TAGS.has(name) || (name === 'url' && param === undefined));
        if (isRaw) {
            const closeRe = new RegExp(`\\[/${name === '*' ? '\\*' : name}\\]`, 'i');
            const rest = text.slice(lastIndex);
            const closeMatch = closeRe.exec(rest);
            if (closeMatch) {
                tokens.push({ type: 'raw', name, text: rest.slice(0, closeMatch.index) });
                lastIndex += closeMatch.index + closeMatch[0].length;
                TAG_RE.lastIndex = lastIndex;
                continue;
            }
            warn(`Balise sans fermeture conservée en texte brut : ${full}`);
            pushText(full);
            continue;
        }
        tokens.push(slash
            ? { type: 'close', name }
            : { type: 'open', name, param: param === undefined ? null : param });
    }
    pushText(text.slice(lastIndex));
    return tokens;
};

// ─── 2. Construction de l'arbre ───────────────────────────────────────────────

// Fermeture d'une balise : on cherche l'élément ouvert correspondant SANS franchir de frontière
// (une balise [/center] perdue dans une cellule ne ferme pas un [center] extérieur au tableau).
// Les balises de structure peuvent traverser leurs sous-éléments : [/table] ferme tr/td ouverts, etc.
const CROSSABLE = {
    table: new Set(['tr', 'td']),
    tr: new Set(['td']),
    td: new Set(),
    divbox: new Set(['table', 'tr', 'td', 'divboxcolor', 'altspoiler', 'quote']),
    divboxcolor: new Set(['table', 'tr', 'td']),
    altspoiler: new Set(['table', 'tr', 'td', 'divboxcolor']),
    quote: new Set(['table', 'tr', 'td', 'divboxcolor']),
};

const parse = (tokens, warn) => {
    const root = { name: 'root', children: [] };
    const stack = [root];
    const top = () => stack[stack.length - 1];

    const add = (node) => { top().children.push(node); return node; };
    const push = (node) => { add(node); stack.push(node); return node; };

    const inStack = (name) => stack.some((el) => el.name === name);

    // Contenu directement dans un [table] ou un [tr] : on ouvre la ligne / la cellule manquantes.
    const ensureCell = () => {
        if (top().name === 'table') push({ name: 'tr', children: [] });
        if (top().name === 'tr') push({ name: 'td', param: null, children: [] });
    };
    const addContent = (node) => {
        if (top().name === 'table' || top().name === 'tr') ensureCell();
        return add(node);
    };

    const popTo = (name) => {
        while (stack.length > 1 && top().name !== name) stack.pop();
    };

    for (const token of tokens) {
        if (token.type === 'text') {
            if ((top().name === 'table' || top().name === 'tr') && !token.text.trim()) continue;
            addContent({ name: '#text', text: token.text });
            continue;
        }
        if (token.type === 'raw') {
            addContent({ name: token.name === 'url' ? 'urlraw' : token.name, text: token.text, children: [] });
            continue;
        }

        const { name } = token;
        if (token.type === 'open') {
            if (name === 'table') {
                addContent({ name, children: [] });
                stack.push(top().children[top().children.length - 1]);
            } else if (name === 'tr') {
                if (!inStack('table')) { warn('[tr] hors d\'un [table] : ignoré'); continue; }
                popTo('table');
                push({ name, children: [] });
            } else if (name === 'td') {
                if (!inStack('table')) { warn('[td] hors d\'un [table] : ignoré'); continue; }
                // Un [td] ferme la cellule précédente (les générateurs n'écrivent presque jamais [/td]).
                while (stack.length > 1 && top().name !== 'tr' && top().name !== 'table') stack.pop();
                if (top().name === 'table') push({ name: 'tr', children: [] });
                push({ name, param: null, children: [] });
            } else if (LEAF_TAGS.has(name)) {
                addContent({ name, children: [] });
            } else {
                if (top().name === 'table' || top().name === 'tr') ensureCell();
                push({ name, param: token.param, children: [] });
            }
            continue;
        }

        // Balise fermante
        if (LEAF_TAGS.has(name)) continue;   // [/br], [/hr]
        let index = -1;
        for (let i = stack.length - 1; i > 0; i -= 1) {
            if (stack[i].name === name) { index = i; break; }
            const crossable = CROSSABLE[name];
            if (BOUNDARY_TAGS.has(stack[i].name) && !(crossable && crossable.has(stack[i].name))) break;
        }
        if (index === -1) {
            warn(`Balise fermante sans ouverture ignorée : [/${name}]`);
            continue;
        }
        stack.length = index;
    }
    return root;
};

// Les [divbox] n'ont pas de boîte propre : leur contenu est rendu tel quel.
const flatten = (node) => {
    if (!node.children) return node;
    const children = [];
    node.children.forEach((child) => {
        flatten(child);
        if (child.name === 'divbox' || child.name === 'imageleft') children.push(...child.children);
        else children.push(child);
    });
    node.children = children;
    return node;
};

// ─── 3. Rendu HTML ────────────────────────────────────────────────────────────

const BLOCK_NAMES = new Set(['table', 'divboxcolor', 'hr', 'pagebreak', 'quote', 'altspoiler', 'center', 'left', 'right', 'justify', 'list']);
const isBlock = (node) => !!node && BLOCK_NAMES.has(node.name);
const isBlankText = (node) => node.name === '#text' && !node.text.trim();

const tableOpen = (cellpadding, extraStyle = '') =>
    `<table width="100%" cellpadding="${cellpadding}" cellspacing="0" border="1" bgcolor="${BG}" style="border-collapse:collapse;background-color:${BG};color:${FG};border:1px solid ${BORDER};${extraStyle}">`;

const cellStyle = (align) =>
    `background-color:${BG};color:${FG};border:1px solid ${BORDER};${align ? `text-align:${align};` : ''}`;

// Une adresse nue qui pointe vers une image (imgBB, Imgur, Discord, ou extension d'image) est affichée comme
// image, pas comme une URL : c'est ce que fait le forum à la publication.
const URL_IN_TEXT_RE = /(https?:\/\/[^\s<>"'[\]]+)/gi;
const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|webp|bmp|avif)(\?[^\s]*)?$/i;
const IMAGE_HOST_RE = /^https?:\/\/(i\.ibb\.co|i\.imgur\.com|(cdn|media)\.discordapp\.(com|net)\/attachments)\//i;
export const isImageUrl = (url) => IMAGE_EXTENSION_RE.test(url) || IMAGE_HOST_RE.test(url);

const escapeWithBreaks = (value) => escapeHtml(value).replace(/\n/g, '<br>');
const renderText = (value) => String(value == null ? '' : value).split(URL_IN_TEXT_RE).map((part, index) => {
    if (index % 2 === 0) return escapeWithBreaks(part);
    // La ponctuation qui suit une adresse dans une phrase n'en fait pas partie.
    const [, url, trailing] = part.match(/^(.*?)([.,;:!?)]*)$/);
    return isImageUrl(url)
        ? `<img src="${escapeHtml(url)}" alt="" style="max-width:100%;height:auto;">${escapeWithBreaks(trailing)}`
        : escapeWithBreaks(part);
}).join('');

// Enfants d'un conteneur « bloc » (racine, cellule, bandeau) : on retire les sauts de ligne
// qui ne font que séparer deux blocs (ex. « [/table]\n[divboxcolor] »).
const renderChildren = (children, ctx) => {
    const out = [];
    children.forEach((child, index) => {
        if (child.name === '#text') {
            const prev = children[index - 1];
            const next = children[index + 1];
            let value = child.text;
            if (!value.trim() && (index === 0 || index === children.length - 1 || isBlock(prev) || isBlock(next))) return;
            if (!prev || isBlock(prev)) value = value.replace(/^[ \t]*\n/, '');
            if (!next || isBlock(next)) value = value.replace(/\n[ \t]*$/, '');
            if (!value) return;
            out.push(renderText(value));
            return;
        }
        out.push(renderNode(child, ctx));
    });
    return out.join('');
};

// Une cellule dont l'unique contenu est un [center] est alignée au centre (sans <div> supplémentaire).
const unwrapCenter = (children) => {
    const meaningful = children.filter((child) => !isBlankText(child));
    if (meaningful.length === 1 && meaningful[0].name === 'center') {
        return { align: 'center', children: meaningful[0].children };
    }
    return { align: null, children };
};

const renderNode = (node, ctx) => {
    switch (node.name) {
        case '#text':
            return renderText(node.text);
        case 'br':
            return '<br>';
        case 'cb':
            return EMPTY_BOX;
        case 'cbc':
            return CHECKED_BOX;
        case '*':
            return '<br>•&nbsp;';
        // Séparateur entre deux rapports exportés ensemble : un simple espace, que l'export en images utilise pour couper
        // entre deux rapports plutôt qu'au milieu de l'un d'eux.
        case 'pagebreak':
            return '<div data-report-break="1" style="height:18px;margin:0;padding:0;overflow:hidden;"></div>';
        case 'hr':
            return `<hr style="border:0;border-top:1px solid ${BORDER};height:0;margin:8px 0;">`;
        case 'b': case 'u': case 'i': case 's':
            return `<${node.name}>${renderChildren(node.children, ctx)}</${node.name}>`;
        case 'color': {
            const color = normalizeColor(node.param);
            const inner = renderChildren(node.children, color ? { ...ctx, fg: color } : ctx);
            return color ? `<span style="color:${color};">${inner}</span>` : inner;
        }
        case 'size': {
            const size = parseInt(node.param, 10);
            const inner = renderChildren(node.children, ctx);
            return size >= 20 && size <= 400 ? `<span style="font-size:${size}%;">${inner}</span>` : inner;
        }
        case 'img': {
            const url = String(node.text || '').trim();
            return isHttpUrl(url)
                ? `<img src="${escapeHtml(url)}" alt="" style="max-width:100%;height:auto;">`
                : escapeHtml(node.text);
        }
        case 'urlraw': {
            const url = String(node.text || '').trim();
            return isHttpUrl(url)
                ? `<a href="${escapeHtml(url)}" style="color:#0066CC;">${escapeHtml(url)}</a>`
                : escapeHtml(node.text);
        }
        case 'url': {
            const inner = renderChildren(node.children, ctx);
            const url = String(node.param || '').trim();
            return isHttpUrl(url) ? `<a href="${escapeHtml(url)}" style="color:#0066CC;">${inner}</a>` : inner;
        }
        case 'code':
            return `<span style="font-family:Consolas,'Courier New',monospace;">${renderText(node.text)}</span>`;
        case 'center':
            return `<div style="text-align:center;">${renderChildren(node.children, ctx)}</div>`;
        case 'left':
        case 'right':
        case 'justify':
            return `<div style="text-align:${node.name};">${renderChildren(node.children, ctx)}</div>`;
        case 'list': {
            const kind = String(node.param || '').trim().toLowerCase();
            // Sans puce, mais c'est un BLOC (comme sur le forum) : retour à la ligne avant et après, par ex. les coordonnées
            // du mandataire sous « …en mon nom: » dans les directives anticipées.
            if (kind === 'none') return `<div>${renderChildren(node.children, ctx)}</div>`;
            const items = [];
            let current = null;
            node.children.forEach((child) => {
                if (child.name === '*') { current = []; items.push(current); return; }
                if (!current) { if (isBlankText(child)) return; current = []; items.push(current); }
                current.push(child);
            });
            const tag = kind === '1' || kind === 'a' ? 'ol' : 'ul';
            const typeAttr = tag === 'ol' ? ` type="${kind}"` : '';
            return `<${tag}${typeAttr}>${items.map((item) => `<li>${renderChildren(item, ctx)}</li>`).join('')}</${tag}>`;
        }
        case 'divboxcolor': {
            // Bandeau de section : tableau d'une cellule centrée, fond BAR, texte BAR_TEXT.
            const { children } = unwrapCenter(node.children);
            const inner = renderChildren(children, { ...ctx, fg: BAR_TEXT });
            return `<table width="100%" cellpadding="6" cellspacing="0" border="0" bgcolor="${BAR}" style="border-collapse:collapse;background-color:${BAR};margin-top:10px;"><tr><td align="center" bgcolor="${BAR}" style="background-color:${BAR};color:${BAR_TEXT};text-align:center;"><span style="color:${BAR_TEXT};">${inner}</span></td></tr></table>`;
        }
        case 'table': {
            const rows = node.children.filter((child) => child.name === 'tr');
            return `${tableOpen(8)}${rows.map((row) => renderNode(row, ctx)).join('')}</table>`;
        }
        case 'tr': {
            const cells = node.children.filter((child) => child.name === 'td');
            const count = cells.length;
            const base = Math.floor(100 / count);
            const remainder = 100 - base * count;
            const middle = Math.floor(count / 2);
            return `<tr>${cells.map((cell, index) => {
                const width = count > 1 ? base + (index === middle ? remainder : 0) : null;
                return renderCell(cell, ctx, width);
            }).join('')}</tr>`;
        }
        case 'quote':
            return `<table width="100%" cellpadding="8" cellspacing="0" border="1" bgcolor="${BG}" style="border-collapse:collapse;background-color:${BG};color:${FG};border:1px solid ${BORDER};margin:6px 0;"><tr><td bgcolor="${BG}" style="${cellStyle()}"><span style="color:${FG};">${renderChildren(node.children, { ...ctx, fg: FG })}</span></td></tr></table>`;
        case 'altspoiler': {
            const title = node.param ? `<b>${escapeHtml(node.param)}</b>` : '';
            return `${tableOpen(8, 'margin:6px 0;')}<tr><td bgcolor="${BG}" style="${cellStyle()}"><span style="color:${FG};">${title}</span></td></tr><tr><td bgcolor="${BG}" style="${cellStyle()}"><span style="color:${FG};">${renderChildren(node.children, { ...ctx, fg: FG })}</span></td></tr></table>`;
        }
        case 'td':
            return renderCell(node, ctx, null);
        default:
            return renderChildren(node.children || [], ctx);
    }
};

const renderCell = (cell, ctx, width) => {
    const { align, children } = unwrapCenter(cell.children);
    const cellCtx = { ...ctx, fg: FG };
    const attrs = `${width ? ` width="${width}%"` : ''}${align ? ` align="${align}"` : ''} valign="middle" bgcolor="${BG}"`;
    return `<td${attrs} style="${cellStyle(align)}"><span style="color:${FG};">${renderChildren(children, cellCtx)}</span></td>`;
};

// ─── API ──────────────────────────────────────────────────────────────────────

// Racine : les suites de texte « libre » (hors tableau) sont enveloppées dans un <span> de couleur
// FG ; les blocs (tableaux, bandeaux…) sont rendus tels quels, comme dans le gabarit de référence.
const renderRoot = (root) => {
    const ctx = { fg: FG };
    const out = [];
    let run = [];
    const flush = () => {
        if (!run.length) return;
        const html = renderChildren(run, ctx);
        if (html) out.push(`<span style="color:${FG};">${html}</span>`);
        run = [];
    };
    root.children.forEach((child, index) => {
        if (isBlock(child) && child.name !== 'center' && child.name !== 'left' && child.name !== 'right' && child.name !== 'justify') {
            flush();
            out.push(renderNode(child, ctx));
        } else {
            run.push(child);
            const next = root.children[index + 1];
            if (isBlock(next) && ['table', 'divboxcolor', 'hr', 'quote', 'altspoiler', 'list'].includes(next.name)) flush();
        }
    });
    flush();
    return out.join('');
};

// Convertit un BBCode en fragment HTML (sans <html>/<body>).
export const bbcodeToHtmlFragment = (bbcode, { onWarning } = {}) => {
    const seen = new Set();
    const warn = (message) => {
        if (seen.has(message)) return;
        seen.add(message);
        // eslint-disable-next-line no-console
        console.warn(`[bbcodeToHtml] ${message}`);
        if (onWarning) onWarning(message);
    };
    const tree = flatten(parse(tokenize(bbcode, warn), warn));
    return renderRoot(tree);
};

// Document HTML complet et autonome (aucune ressource locale, aucune feuille de style).
export const bbcodeToHtmlDocument = (bbcode, { title = 'Rapport', onWarning } = {}) => {
    const body = bbcodeToHtmlFragment(bbcode, { onWarning });
    const safeTitle = escapeHtml(title || 'Rapport');
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${safeTitle}</title></head>
<body bgcolor="${BG}" style="background-color:${BG}; margin:0; padding:16px; font-family:${FONT_FAMILY}; color:${FG};">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="${BG}" style="max-width:900px; margin:0 auto; background-color:${BG}; color:${FG}; border-collapse:collapse; font-family:${FONT_FAMILY}; font-size:14px;">
<tr><td bgcolor="${BG}" style="background-color:${BG}; color:${FG}; padding:10px;">
${body}
</td></tr></table>
</body></html>
`;
};

// « Report [2704] Emergency Room Protocols - 2026-09-27.html » : caractères interdits remplacés.
export const buildHtmlFileName = (title) => {
    const cleaned = String(title || '')
        .replace(/[\\/]/g, '-')
        // eslint-disable-next-line no-control-regex
        .replace(/[:*?"<>|\u0000-\u001f]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s.-]+|[\s.]+$/g, '')
        .slice(0, 150)
        .trim();
    return `${cleaned || 'rapport'}.html`;
};

// Déclenche le téléchargement côté navigateur (Blob + <a download>) : aucun appel serveur.
export const downloadHtmlFile = (fileName, html) => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Révoquer tout de suite peut annuler le téléchargement sur certains navigateurs.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
