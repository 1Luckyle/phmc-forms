// src/phmc-bbcode-generators/generateContract.js
//
// Mise en page BBCode des documents contractuels (contrats, avenants, conventions, convocations, notifications), dans la charte des autres
// formulaires : en-tête PHMC (logo + adresse du centre), titre, bandeaux noirs à chevron rouge, tableaux gris, bloc de signatures.
// Comme l'AMA, le résultat se prévisualise, se copie, se télécharge en HTML / PDF / image : seul le CONTENU (articles) vient de
// utils/contractClauses.js ; ici on ne s'occupe que de la forme.
//
// Entrée : le « document structuré » produit par buildContractDocument :
//   { title, subtitle, reference, dateText, service, visas[], parties[], preambule[], articles[{ titre, blocs[] }], signatures{…}, footer[] }
// Un bloc d'article est une chaîne (paragraphe) ou { liste: [...], numerotee?: true } | { tableau: [[libellé, valeur], …] } | { serment: texte }
//   | { encart: texte }. Les textes peuvent contenir du BBCode inline généré par les gabarits ([b]…[/b]) ; les saisies des utilisateurs sont
//   nettoyées AVANT (voir bbSafe).
import { phmcHeaderEnd, sectionBanner } from './shared/bbStyles';

// Repères remplacés au moment de l'AFFICHAGE par le bloc de signature de l'employé (le texte, lui, est figé à l'envoi). Pas de crochets : le
// convertisseur BBCode les prendrait pour des balises.
export const SIGNATURE_MARKER = '{{SIGNATURE_SALARIE}}';
export const SIGNATURE_DATE_MARKER = '{{DATE_SIGNATURE}}';

// Retire les crochets d'une saisie libre : un utilisateur ne doit pas pouvoir injecter de BBCode (images, liens) dans un document officiel.
export const bbSafe = (value) => String(value ?? '').replace(/\[/g, '(').replace(/\]/g, ')').replace(/\r/g, '').trim();

const renderBlock = (block) => {
    if (typeof block === 'string') return `[justify]${block}[/justify]`;
    if (block.liste) {
        const items = block.liste.map((item) => `[*] ${item}`).join('\n');
        return `[list${block.numerotee ? '=1' : ''}]\n${items}\n[/list]`;
    }
    if (block.tableau) {
        const rows = block.tableau
            .map(([label, value]) => `[tr][td bgcolor=#E6E6E6][b]${label}[/b][/td][td]${value === '' || value == null ? '—' : value}[/td][/tr]`)
            .join('\n');
        return `[table]\n${rows}\n[/table]`;
    }
    if (block.serment) return `[center][i]« ${block.serment} »[/i][/center]`;
    if (block.encart) return `[divboxcolor=#E6E6E6][size=90]${block.encart}[/size][/divboxcolor]`;
    return '';
};

const renderArticle = (article, index) => `${sectionBanner(`Article ${index + 1} — ${article.titre}`, { size: 105 })}
${article.blocs.filter(Boolean).map(renderBlock).join('\n[br][/br]\n')}`;

const signatureCell = ({ label, name, role, mention, body, caption }) => `[td][center][b]${label}[/b]
${name ? `${name}\n` : ''}${role ? `[size=85]${role}[/size]\n` : ''}${mention ? `[size=85][i]${mention}[/i][/size]\n` : ''}${body}
[hr][/hr]
[size=85]${caption}[/size][/center][/td]`;

const generateContract = (doc) => {
    const {
        title, subtitle, reference, dateText, service, partiesTitre = 'Entre les soussignés', visas = [], parties = [], preambule = [], articles = [], signatures, footer = [],
    } = doc;

    const headerCell = `[divbox=white][table][tr][td][center][br][/br][size=130][b]${title}[/b][/size]
${subtitle ? `[size=105]${subtitle}[/size]\n` : ''}${service === 'coroner' ? '[size=90][b]DÉPARTEMENT DE PATHOLOGIE ET DE MÉDECINE LÉGALE[/b][/size]\n' : ''}[br][/br][size=85]Réf. ${reference}
${dateText}[/size]
${phmcHeaderEnd()}`;

    const visasBlock = visas.length
        ? `[divbox=white][size=90]${visas.map((visa) => `[i]${visa}[/i]`).join('\n')}[/size][/divbox]`
        : '';

    const partiesBlock = parties.length
        ? `${sectionBanner(partiesTitre, { size: 105 })}\n${parties.map(renderBlock).join('\n[br][/br]\n')}`
        : '';

    const preambuleBlock = preambule.length ? preambule.map(renderBlock).join('\n[br][/br]\n') : '';

    const body = articles.map(renderArticle).join('\n');

    const sigBlock = signatures
        ? `${sectionBanner(signatures.titre || 'Signatures', { size: 105 })}
${signatures.intro ? `[justify]${signatures.intro}[/justify]\n` : ''}[table][tr]${signatureCell(signatures.employer)}${signatureCell(signatures.employee)}[/tr][/table]`
        : '';

    const footerBlock = footer.length
        ? `[hr][/hr]\n[center][size=70][i]${footer.join('\n')}[/i][/size][/center]`
        : '';

    return [
        headerCell,
        visasBlock,
        '[divbox=white]',
        partiesBlock,
        preambuleBlock,
        body,
        sigBlock,
        footerBlock,
        '[/divbox]',
    ].filter(Boolean).join('\n');
};

export default generateContract;
