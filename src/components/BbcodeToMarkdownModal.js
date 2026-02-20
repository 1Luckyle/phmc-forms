import React, { useState, useCallback, useRef } from 'react';
import { Button, Form } from 'react-bootstrap';

// ─────────────────────────────────────────────────────────────────
// CONVERTISSEUR BBCODE → MARKDOWN DISCORD
// ─────────────────────────────────────────────────────────────────

/**
 * Convertit du BBcode (tel que produit par les générateurs PHMC) en
 * Markdown Discord.
 */
function bbcodeToMarkdown(input) {
  let text = input;

  // ── PROTECTION des blocs [code] (avant tout traitement) ─────────
  // Le contenu BBcode à l'intérieur d'un [code] ne doit PAS être converti.
  const codeBlocks = [];
  text = text.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (_, content) => {
    codeBlocks.push(content);
    return `__CODE_${codeBlocks.length - 1}__`;
  });

  // ── Tableaux ─────────────────────────────────────────────────────
  text = convertTables(text);

  // ── Blocs d'images isolées → BLOC ATOMIQUE (message seul) ────────
  // Doit être fait AVANT la conversion générale des divbox.
  const toImgBlock = (imgs) => {
    const urls = [];
    imgs.replace(/\[img\]([^\[]+)\[\/img\]/gi, (__, url) => urls.push(url.trim()));
    return '\n__ATOMIC_START__\n▌  ' + urls.map(u => `![](${u})`).join('  ') + '  ▌\n__ATOMIC_END__\n';
  };
  // Avec [divbox]
  text = text.replace(
    /\[divbox(?:color)?(?:=[^\]]*)?\]\s*(?:\[center\]\s*)?((?:\s*\[img\][^\[]+\[\/img\]\s*)+)(?:\s*\[\/center\])?\s*\[\/divbox(?:color)?\]/gi,
    (_, imgs) => toImgBlock(imgs)
  );
  // Sans [divbox], juste [center][img]...[/center] standalone
  text = text.replace(
    /\[center\]\s*((?:\s*\[img\][^\[]+\[\/img\]\s*)+)\s*\[\/center\]/gi,
    (_, imgs) => toImgBlock(imgs)
  );

  // ── En-têtes de section [divboxcolor=X]...[/divboxcolor] ──────────
  text = text.replace(
    /\[divboxcolor=[^\]]*\]\s*(\[center\])?\s*((?:\[size=[^\]]*\])?\s*(?:\[color=[^\]]*\]>[^\[]*\[\/color\]\s*)?(?:\[color=[^\]]*\])?\s*(?:\[b\])?([^\[]+)(?:\[\/b\])?(?:\[\/color\])?\s*(?:\[\/size\])?)\s*(\[\/center\])?\s*\[\/divboxcolor\]/gi,
    (match, _c1, _inner, title) => {
      if (title && title.trim()) return `\n> **${title.trim()}**\n`;
      const stripped = match
        .replace(/\[\/?(?:divboxcolor|center|size|color|b)[^\]]*\]/gi, '')
        .replace(/^\s*>\s*/gm, '').trim();
      return `\n> **${stripped}**\n`;
    }
  );

  // ── Spoilers → BLOC ATOMIQUE (jamais découpé, spoiler intact) ─────
  text = text.replace(/\[altspoiler=([^\]]+)\]([\s\S]*?)\[\/altspoiler\]/gi,
    (_, title, content) => {
      // Supprimer les marqueurs atomiques imbriqués (ex: image dans un spoiler)
      let trimmed = content.trim()
        .replace(/__ATOMIC_START__\n?/g, '')
        .replace(/__ATOMIC_END__\n?/g, '');
      const closingSep = trimmed.endsWith('|') ? '\n' : '';
      return `\n__ATOMIC_START__\n**${title.trim()}**\n||${trimmed}${closingSep}||\n__ATOMIC_END__\n\n`;
    });

  // ── Listes (avec cases à cocher) ──────────────────────────────────
  text = text.replace(/\[list(?:=[^\]]*)?\]/gi, '');
  text = text.replace(/\[\/list\]/gi, '\n');
  text = text.replace(/\[\*\]\[(?:x|X)\]\s?/g, '\n- ☑ ');
  text = text.replace(/\[\*\]\[\]\s?/g, '\n- ☐ ');
  text = text.replace(/\[\*\]\s?/g, '\n- ');
  text = text.replace(/^\[(?:x|X)\]\s?/gm, '☑ ');
  text = text.replace(/^\[\]\s?/gm, '☐ ');

  // ── Mise en forme basique ─────────────────────────────────────────
  text = text.replace(/\[bold\]([\s\S]*?)\[\/bold\]/gi, '**$1**');
  text = text.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '**$1**');
  text = text.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '*$1*');
  text = text.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '__$1__');
  text = text.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '~~$1~~');

  // ── OOC ───────────────────────────────────────────────────────────
  text = text.replace(/\[ooc\]([\s\S]*?)\[\/ooc\]/gi, '(( $1 ))');

  // ── Titres ────────────────────────────────────────────────────────
  text = text.replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, '\n# $1\n');
  text = text.replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, '\n## $1\n');
  text = text.replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, '\n### $1\n');

  // ── Séparateur horizontal ─────────────────────────────────────────
  text = text.replace(/\[hr\]\[\/hr\]/gi, '\n────────────────────────────────\n');
  text = text.replace(/\[hr\]/gi, '\n────────────────────────────────\n');

  // ── Saut de ligne explicite ───────────────────────────────────────
  text = text.replace(/\[br\]\[\/br\]/gi, '\n');
  text = text.replace(/\[br\]/gi, '\n');

  // ── Cases à cocher (avec ou sans balise fermante) ─────────────────
  text = text.replace(/\[cbc\]\[\/cbc\]/gi, '☑ ');
  text = text.replace(/\[cb\]\[\/cb\]/gi, '☐ ');
  text = text.replace(/\[cbc\]/gi, '☑');
  text = text.replace(/\[cb\]/gi, '☐');

  // ── Restore blocs [code] avec leur contenu BBcode brut préservé ───
  codeBlocks.forEach((content, idx) => {
    text = text.replace(`__CODE_${idx}__`, `\n\`\`\`\n${content}\n\`\`\`\n`);
  });

  // ── Extraction des blocs ```code``` hors des blocs atomiques (spoilers) ──
  // Un [code] à l'intérieur d'un [altspoiler] génère des ``` dans les || ||
  // Discord ne les rend pas à l'intérieur d'un spoiler → les extraire en blocs séparés.
  text = text.replace(/__ATOMIC_START__\n([\s\S]*?)__ATOMIC_END__/g, (fullMatch, atomicContent) => {
    if (!atomicContent.includes('```')) return fullMatch;
    const codeRe = /```[\s\S]*?```/g;
    const segments = [];
    let lastIndex = 0;
    let m;
    while ((m = codeRe.exec(atomicContent)) !== null) {
      const before = atomicContent.slice(lastIndex, m.index);
      if (before.trim()) {
        let seg = before.trimEnd();
        // Ferme le spoiler || si ouvert mais pas encore fermé
        const pipes = (seg.match(/\|\|/g) || []).length;
        if (pipes % 2 === 1) seg += '||';
        segments.push(`__ATOMIC_START__\n${seg}\n__ATOMIC_END__`);
      }
      // Le [code] à l'intérieur d'un spoiler → devient un spoiler Discord || || séparé
      const codeContent = m[0].replace(/^```\n?/, '').replace(/\n?```$/, '').trim();
      segments.push(`__ATOMIC_START__\n||${codeContent}||\n__ATOMIC_END__`);
      lastIndex = m.index + m[0].length;
    }
    // Ce qui reste après le dernier ``` (souvent juste || de fermeture, déjà géré)
    const after = atomicContent.slice(lastIndex).trim();
    if (after && after !== '||') {
      segments.push(`__ATOMIC_START__\n${after}\n__ATOMIC_END__`);
    }
    return segments.length ? segments.join('\n') : fullMatch;
  });

  text = text.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, (_, q) =>
    q.split('\n').map(l => '> ' + l).join('\n'));

  // ── URLs & images ────────────────────────────────────────────────
  text = text.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '[$2]($1)');
  text = text.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '$1');
  text = text.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, '![]($1)');
  text = text.replace(/\[imageleft\]([\s\S]*?)\[\/imageleft\]/gi, '![]($1)');
  text = text.replace(/\)!\[\]\(/g, ') ![](' );

  // ── Alignement ───────────────────────────────────────────────────
  text = text.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '$1');
  text = text.replace(/\[right\]([\s\S]*?)\[\/right\]/gi, '$1');
  text = text.replace(/\[left\]([\s\S]*?)\[\/left\]/gi, '$1');
  text = text.replace(/\[justify\]([\s\S]*?)\[\/justify\]/gi, '$1');

  // ── Indentation ──────────────────────────────────────────────────
  text = text.replace(/\[indent=(\d+)\]([\s\S]*?)\[\/indent\]/gi,
    (_, n, content) => ' '.repeat(Math.min(Math.round(Number(n) / 10), 8)) + content);

  // ── Couleur & taille ─────────────────────────────────────────────
  text = text.replace(/\[color=[^\]]+\]([\s\S]*?)\[\/color\]/gi, '$1');
  text = text.replace(/\[size=[^\]]*\]([\s\S]*?)\[\/size\]/gi, '$1');

  // ── Divbox générique ─────────────────────────────────────────────
  text = text.replace(/\[divbox(?:color)?(?:=[^\]]*)?\]([\s\S]*?)\[\/divbox(?:color)?\]/gi,
    (_, content) => content.trim());

  // ── Balises résiduelles (ne pas manger [texte](url)) ────────────
  text = text.replace(/\[[^\]]*\](?!\()/g, '');

  // ── Saut de ligne après fin de liste ─────────────────────────────
  text = text.replace(/(\n- [^\n]+)(\n)([^-\n_])/g, '$1\n\n$3');

  // ── Compactage des items de liste ────────────────────────────────
  text = text.replace(/\n{2,}(- )/g, '\n$1');

  // ── Max 2 lignes vides ───────────────────────────────────────────
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Nettoie le contenu d'une cellule de tableau.
 */
function cleanCellContent(raw) {
  return raw
    .replace(/\[bold\]([\s\S]*?)\[\/bold\]/gi, '**$1**')
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '**$1**')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '*$1*')
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '__$1__')
    .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '[$2]($1)')
    .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '$1')
    .replace(/\[img\]([^\[]+)\[\/img\]/gi, '![]($1)')
    .replace(/\)!\[\]\(/g, ') ![](')
    .replace(/\[cbc\](?:\[\/cbc\])?/gi, '\u2611 ')
    .replace(/\[cb\](?:\[\/cb\])?/gi, '\u2610 ')
    // [br] → saut de ligne réel (avant le nettoyage des balises résiduelles)
    .replace(/\[br\](?:\[\/br\])?/gi, '\n')
    .replace(/\[color=[^\]]+\]([\s\S]*?)\[\/color\]/gi, '$1')
    .replace(/\[size=[^\]]*\]([\s\S]*?)\[\/size\]/gi, '$1')
    .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '$1')
    .replace(/\[[^\]]*\](?!\()/g, '')
    // N'efface PAS les \n — uniquement les espaces horizontaux en trop
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Convertit les tableaux BBcode en tableaux Markdown.
 * Gère la syntaxe phpBB « lazy » (sans [/tr] ni [/td] de fermeture).
 */
function convertTables(text) {
  return text.replace(
    /\[table\]([\s\S]*?)\[\/table\]/gi,
    (_, tableContent) => {
      const rows = [];

      // Stratégie : scinder par [tr] pour obtenir les lignes,
      // puis scinder chaque ligne par [td...] pour obtenir les cellules.
      // Cela gère la syntaxe lazy où [/tr] et [/td] sont optionnels.
      const hasRows = /\[tr\]/i.test(tableContent);

      const rowChunks = hasRows
        ? tableContent.split(/\[tr\]/gi).slice(1)
        : [tableContent]; // pas de [tr] → une seule ligne

      for (const chunk of rowChunks) {
        const rowContent = chunk.replace(/\[\/tr\]/gi, '');
        // Scinder par [td] ou [td=...]
        const tdParts = rowContent.split(/\[td[^\]]*\]/gi);
        // tdParts[0] = avant le premier [td], ignoré
        const cells = [];
        for (let i = 1; i < tdParts.length; i++) {
          const cellRaw = tdParts[i].replace(/\[\/td\]/gi, '');
          const cell = cleanCellContent(cellRaw);
          cells.push(cell || ' ');
        }
        if (cells.length > 0) rows.push(cells);
      }

      if (rows.length === 0) return '';

      // Si l'une des cellules contient des sauts de ligne (plusieurs sous-sections),
      // on rend le tableau comme un bloc de texte plutôt qu'un tableau Markdown.
      const hasComplexCells = rows.some(r => r.some(c => c.includes('\n')));
      if (hasComplexCells) {
        // Chaque rangée = cellules concaténées avec \n\n entre elles
        return '\n' + rows
          .map(r => r.filter(c => c.trim()).join('\n\n'))
          .filter(r => r.trim())
          .join('\n\n') + '\n';
      }

      // Normalise le nombre de colonnes
      const colCount = Math.max(...rows.map(r => r.length));
      const normalized = rows.map(r => {
        const row = [...r];
        while (row.length < colCount) row.push(' ');
        return row;
      });

      // Largeur max de chaque colonne
      const widths = Array.from({ length: colCount }, (_, ci) =>
        Math.max(3, ...normalized.map(r => (r[ci] || '').length))
      );

      const formatRow = (cells) =>
        '| ' + cells.map((c, i) => (c || '').padEnd(widths[i])).join(' | ') + ' |';
      const separator =
        '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';

      const [header, ...body] = normalized;
      return '\n' + [formatRow(header), separator, ...body.map(formatRow)].join('\n') + '\n';
    }
  );
}

// ─────────────────────────────────────────────────────────────────
// DÉCOUPAGE INTELLIGENT EN MESSAGES
// ─────────────────────────────────────────────────────────────────

/**
 * Découpe le texte markdown en blocs qui ne dépassent pas `limit` caractères.
 * Respecte :
 *   - Les tableaux Markdown (groupes de lignes commençant par |)
 *   - Les blocs de code (``` ... ```)
 *   - Les spoilers Discord (|| ... ||)
 *   - Les paragraphes (blocs séparés par des lignes vides)
 *   - Les lignes simples en dernier recours
 */
function splitIntoMessages(text, limit) {
  // Nettoie les marqueurs __ATOMIC__ pour les messages courts (pas de découpage)
  const stripMarkers = (t) => t
    .replace(/__ATOMIC_START__\n?/g, '')
    .replace(/__ATOMIC_END__\n?/g, '');

  if (text.length <= limit) return [stripMarkers(text)];

  const logicalBlocks = extractLogicalBlocks(text);

  const messages = [];
  let current = '';

  for (const block of logicalBlocks) {
    // Blocs atomiques (spoilers, images)
    if (block.startsWith('__ATOMIC__')) {
      const content = block.slice('__ATOMIC__'.length);

      // Si le bloc atomique est lui-même trop grand (ex: FAQ), le forcer à se découper
      if (content.length > limit) {
        if (current.trim()) { messages.push(current.trim()); current = ''; }
        const sub = splitLongBlock(content, limit);
        for (const part of sub) {
          if ((current + '\n' + part).trim().length <= limit) {
            current = current ? current + '\n' + part : part;
          } else {
            if (current.trim()) messages.push(current.trim());
            current = part;
          }
        }
        continue;
      }

      // Si le contenu courant (ex: en-tête de section) rentre avec le bloc atomique → même message
      const withHeader = current.trim() ? current.trim() + '\n\n' + content.trim() : null;
      if (withHeader && withHeader.length <= limit) {
        messages.push(withHeader);
        current = '';
      } else {
        if (current.trim()) { messages.push(current.trim()); }
        messages.push(content.trim());
        current = '';
      }
      continue;
    }

    // Si le bloc seul dépasse la limite, on le force-découpe
    if (block.length > limit) {
      if (current.trim()) { messages.push(current.trim()); current = ''; }
      const sub = splitLongBlock(block, limit);
      for (const part of sub) {
        if ((current + '\n' + part).trim().length <= limit) {
          current = current ? current + '\n' + part : part;
        } else {
          if (current.trim()) messages.push(current.trim());
          current = part;
        }
      }
      continue;
    }

    const candidate = current ? current + '\n\n' + block : block;
    if (candidate.length <= limit) {
      current = candidate;
    } else {
      if (current.trim()) messages.push(current.trim());
      current = block;
    }
  }

  if (current.trim()) messages.push(current.trim());
  return messages;
}

/**
 * Identifie les blocs logiques dans un texte Markdown :
 * tables, code blocks, spoilers, paragraphes.
 */
function extractLogicalBlocks(text) {
  const blocks = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloc atomique (__ATOMIC_START__ ... __ATOMIC_END__) → jamais découpé
    if (line.trim() === '__ATOMIC_START__') {
      const blockLines = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '__ATOMIC_END__') {
        blockLines.push(lines[i]);
        i++;
      }
      i++; // saute __ATOMIC_END__
      blocks.push('__ATOMIC__' + blockLines.join('\n'));
      continue;
    }

    // Bloc de code
    if (line.trim().startsWith('```')) {
      let blockLines = [line];
      i++;
      while (i < lines.length) {
        blockLines.push(lines[i]);
        if (lines[i].trim().startsWith('```') && blockLines.length > 1) { i++; break; }
        i++;
      }
      blocks.push(blockLines.join('\n'));
      continue;
    }

    // Tableau Markdown (lignes commençant par |)
    if (line.trim().startsWith('|')) {
      let blockLines = [line];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        blockLines.push(lines[i]);
        i++;
      }
      blocks.push(blockLines.join('\n'));
      continue;
    }

    // Ligne vide → séparateur de paragraphes (ignorée comme bloc propre)
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraphe : on accumule les lignes non vides
    let paraLines = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' &&
           !lines[i].trim().startsWith('|') &&
           !lines[i].trim().startsWith('```') &&
           lines[i].trim() !== '__ATOMIC_START__') {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(paraLines.join('\n'));
  }

  return blocks.filter(b => b.trim().length > 0);
}

/**
 * Force-découpe un bloc trop grand, en coupant aux limites de phrases/lignes.
 */
function splitLongBlock(block, limit) {
  const parts = [];
  let remaining = block;

  while (remaining.length > limit) {
    // Cherche le dernier '.' ou '!' ou '?' ou '\n' avant la limite
    const slice = remaining.slice(0, limit);
    let cutAt = Math.max(
      slice.lastIndexOf('\n'),
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? ')
    );
    if (cutAt < limit * 0.5) cutAt = -1; // trop loin en arrière, on coupe brutalement
    const end = cutAt > 0 ? cutAt + 1 : limit;
    parts.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }

  if (remaining.trim()) parts.push(remaining.trim());
  return parts;
}

// ─────────────────────────────────────────────────────────────────
// COMPOSANT MODAL
// ─────────────────────────────────────────────────────────────────

const overlayStyle = {
  position: 'fixed', inset: 0,
  backgroundColor: 'rgba(0,0,0,0.75)',
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  zIndex: 1060,
};

const modalStyle = {
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '8px',
  width: '95vw',
  maxWidth: '1400px',
  height: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  color: '#c9d1d9',
};

const headerStyle = {
  padding: '14px 20px',
  borderBottom: '1px solid #30363d',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
};

const bodyStyle = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  gap: 0,
};

const panelStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: '14px',
  gap: '10px',
};

const textareaStyle = {
  flex: 1,
  backgroundColor: '#161b22',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: '6px',
  padding: '10px',
  fontFamily: 'monospace',
  fontSize: '13px',
  resize: 'none',
  outline: 'none',
  lineHeight: '1.5',
};

const outputBlockStyle = {
  backgroundColor: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '6px',
  padding: '10px',
  fontFamily: 'monospace',
  fontSize: '13px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  lineHeight: '1.5',
  position: 'relative',
};

const charCountStyle = (count, limit) => ({
  fontSize: '11px',
  color: count > limit ? '#f85149' : count > limit * 0.9 ? '#e3b341' : '#6c757d',
  textAlign: 'right',
  marginTop: '2px',
});

const BbcodeToMarkdownModal = ({ show, onHide, showNotification }) => {
  const [bbcode, setBbcode] = useState('');
  const [hasNitro, setHasNitro] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const limit = hasNitro ? 5000 : 2000;

  const markdown = bbcode.trim() ? bbcodeToMarkdown(bbcode) : '';
  const messages = markdown ? splitIntoMessages(markdown, limit) : [];

  const handleCopy = useCallback(async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      showNotification?.('Message copié !', 'success');
    } catch {
      showNotification?.('Erreur lors de la copie.', 'error');
    }
  }, [showNotification]);

  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      showNotification?.('Markdown complet copié !', 'success');
    } catch {
      showNotification?.('Erreur lors de la copie.', 'error');
    }
  }, [markdown, showNotification]);

  const handleClear = () => setBbcode('');

  if (!show) return null;

  return (
    <div style={overlayStyle} onClick={onHide}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>

        {/* ── En-tête ── */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '1.1em', fontWeight: 600 }}>
              <i className="fas fa-discord" style={{ marginRight: '8px', color: '#5865F2' }}></i>
              BBcode → Markdown Discord
            </span>
            {/* Bouton Nitro */}
            <button
              onClick={() => setHasNitro(v => !v)}
              style={{
                background: hasNitro
                  ? 'linear-gradient(135deg, #5865F2, #a855f7)'
                  : '#21262d',
                border: '1px solid',
                borderColor: hasNitro ? '#5865F2' : '#30363d',
                borderRadius: '20px',
                color: hasNitro ? '#fff' : '#8b949e',
                padding: '4px 14px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600,
                letterSpacing: '0.3px',
                transition: 'all 0.2s',
              }}
              title={hasNitro
                ? 'Nitro actif — limite 5000 caractères par message'
                : 'Nitro inactif — limite 2000 caractères par message'}
            >
              <i className="fas fa-gem" style={{ marginRight: '5px' }}></i>
              {hasNitro ? 'Nitro (5000 car.)' : 'J\'ai le Nitro'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {messages.length > 1 && (
              <span style={{ fontSize: '12px', color: '#8b949e' }}>
                {messages.length} message{messages.length > 1 ? 's' : ''}
              </span>
            )}
            {markdown && (
              <Button size="sm" variant="outline-secondary"
                onClick={handleCopyAll}
                title="Copier tout le markdown">
                <i className="fas fa-copy"></i> Tout copier
              </Button>
            )}
            <button onClick={onHide} style={{
              background: 'none', border: 'none', color: '#8b949e',
              fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '0 4px',
            }}>×</button>
          </div>
        </div>

        {/* ── Corps à deux colonnes ── */}
        <div style={bodyStyle}>

          {/* ── Colonne gauche : saisie BBcode ── */}
          <div style={{ ...panelStyle, borderRight: '1px solid #30363d' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#8b949e' }}>
                <i className="fas fa-code" style={{ marginRight: '6px' }}></i>BBcode
              </span>
              {bbcode && (
                <button onClick={handleClear} style={{
                  background: 'none', border: 'none', color: '#8b949e',
                  fontSize: '12px', cursor: 'pointer',
                }}>
                  <i className="fas fa-times" style={{ marginRight: '4px' }}></i>Vider
                </button>
              )}
            </div>
            <textarea
              style={textareaStyle}
              value={bbcode}
              onChange={e => setBbcode(e.target.value)}
              placeholder="Collez votre BBcode ici…"
              spellCheck={false}
            />
            <div style={{ fontSize: '11px', color: '#6c757d', textAlign: 'right' }}>
              {bbcode.length.toLocaleString()} caractères
            </div>
          </div>

          {/* ── Colonne droite : résultat Markdown ── */}
          <div style={{ ...panelStyle, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#8b949e' }}>
                <i className="fab fa-discord" style={{ marginRight: '6px', color: '#5865F2' }}></i>
                Markdown Discord
                {messages.length > 1 && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', color: '#e3b341' }}>
                    ⚠ Divisé en {messages.length} messages
                  </span>
                )}
              </span>
              <span style={{ fontSize: '11px', color: '#6c757d' }}>
                Limite : {limit.toLocaleString()} car. / message
              </span>
            </div>

            {/* Lien md2file */}
            <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '4px' }}>
              <i className="fas fa-file-pdf" style={{ marginRight: '5px', color: '#e05252' }}></i>
              Convertir en PDF :{' '}
              <a
                href="https://md2file.com/editor/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#58a6ff', textDecoration: 'none' }}
              >
                md2file.com/editor
              </a>
              {' '}— résultat à adapter pour une meilleure mise en forme
            </div>

            {/* Pas de contenu */}
            {!markdown && (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6c757d', fontSize: '13px', fontStyle: 'italic',
              }}>
                Le markdown apparaîtra ici…
              </div>
            )}

            {/* Blocs de messages */}
            {messages.map((msg, idx) => (
              <div key={idx} style={{ flexShrink: 0 }}>
                {messages.length > 1 && (
                  <div style={{
                    fontSize: '11px', color: '#8b949e', marginBottom: '4px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <span style={{
                      backgroundColor: '#21262d', border: '1px solid #30363d',
                      borderRadius: '4px', padding: '1px 7px', fontWeight: 600,
                    }}>
                      Message {idx + 1} / {messages.length}
                    </span>
                  </div>
                )}
                <div style={{ position: 'relative' }}>
                  <div style={outputBlockStyle}>{msg}</div>
                  <button
                    onClick={() => handleCopy(msg, idx)}
                    title="Copier ce message"
                    style={{
                      position: 'absolute', top: '8px', right: '8px',
                      background: copiedIndex === idx ? '#238636' : '#21262d',
                      border: '1px solid',
                      borderColor: copiedIndex === idx ? '#238636' : '#30363d',
                      color: copiedIndex === idx ? '#fff' : '#8b949e',
                      borderRadius: '5px',
                      padding: '3px 10px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <i className={`fas ${copiedIndex === idx ? 'fa-check' : 'fa-copy'}`}
                       style={{ marginRight: '4px' }}></i>
                    {copiedIndex === idx ? 'Copié !' : 'Copier'}
                  </button>
                </div>
                <div style={charCountStyle(msg.length, limit)}>
                  {msg.length.toLocaleString()} / {limit.toLocaleString()} car.
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BbcodeToMarkdownModal;
