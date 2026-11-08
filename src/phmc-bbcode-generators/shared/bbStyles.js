// src/phmc-bbcode-generators/shared/bbStyles.js
//
// Styles BBCode COMMUNS à tous les formulaires : un seul endroit pour changer les couleurs, la forme
// des bandeaux de section, les cases à cocher ou l'en-tête PHMC, au lieu de modifier chaque générateur.
// Chaque fonction produit exactement le BBCode qui était auparavant recopié dans les générateurs.

export const BB_COLORS = {
    red: '#FF0000',     // chevron « > » des bandeaux (PHMC, DMEC)
    blue: '#0080FF',    // chevron « > » des bandeaux (variante bleue)
    onDark: '#FFFFFF',  // texte sur bandeau noir
};

// Case à cocher : [cbc] = cochée, [cb] = vide.
export const checkbox = (checked) => (checked ? '[cbc]' : '[cb]');

// Bandeau de section : bandeau noir, chevron coloré, titre en gras blanc.
//   sectionBanner('Anamnèse')                                  → chevron rouge
//   sectionBanner('Titre', { accent: BB_COLORS.blue })          → chevron bleu
//   sectionBanner('Titre', { size: 115 })                       → texte agrandi
export const sectionBanner = (title, { accent = BB_COLORS.red, size = null } = {}) => {
    const content = `[color=${accent}]>[/color] [color=${BB_COLORS.onDark}][b]${title}[/b][/color]`;
    return `[divboxcolor=black][center]${size ? `[size=${size}]${content}[/size]` : content}[/center][/divboxcolor]`;
};

// Fin de l'en-tête des formulaires PHMC (logo + bloc d'adresse du centre médical). À placer juste après
// la première cellule de l'en-tête (titre, patient, date…), dans la table ouverte par le générateur :
//   [table][tr][td][center]…première cellule…${phmcHeaderEnd()}
export const phmcHeaderEnd = () => `[/center][td][center][img]https://phmc-tools.com/img/phmc.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CENTRE MÉDICAL PILLBOX HILL[/b]
ELGIN AVE. / STRAWBERRY AVE.
BP 742
LOS SANTOS, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]`;

// Pied de page commun à tous les rapports : coordonnées du Pillbox Hill Medical Center. Ajouté à la fin du BBCode, une seule fois, par withPhmcFooter
// (appelée là où le BBCode est produit : MainApp.getBBCodeContent), jamais dans chaque générateur.
export const PHMC_FOOTER_MARK = 'Elgin Avenue/Strawberry Avenue, Pillbox Hill';
export const phmcFooter = () => `[hr][/hr]
[center][size=85][b]Pillbox Hill Medical Center[/b]
${PHMC_FOOTER_MARK}, Los Santos, SA
Téléphone: 50056 — Courriel: info.phmc@mail.eyefind.fr
[url=https://phmc-tools.com]phmc-tools.com[/url][/size][/center]`;

// Formulaires qui portent déjà ce pied de page dans leur propre texte (courriels du PHMC) : rien n'est ajouté.
const FORMS_WITH_OWN_FOOTER = [27, 35];
export const withPhmcFooter = (bbCode, version) => {
    const text = String(bbCode || '');
    if (!text.trim() || FORMS_WITH_OWN_FOOTER.includes(Number(version)) || text.includes(PHMC_FOOTER_MARK)) return text;
    return `${text.replace(/\s+$/, '')}\n${phmcFooter()}`;
};

// ─────────────────────────── Rapports du DMEC (Médecine légale) ───────────────────────────
// Même vocabulaire que les dossiers médicaux (en-tête à deux cellules, bandeaux noirs, tableaux « étiquette : valeur »), pour que les rapports du
// DMEC se lisent comme le reste des formulaires, aussi bien sur le forum (BBCode) que dans l'aperçu HTML.

export const PHMC_LOGO = 'https://phmc-tools.com/img/phmc.png';
// Sceau du DMEC seul (public/img/dmec-seal.png). L'ancienne image ItaoQkO.webp montrait aussi celui du Comté.
export const DMEC_LOGO = 'https://phmc-tools.com/img/dmec-seal.png';
// Même sceau en petit (public/img/dmec-seal-small.png) : à côté du logo PHMC dans l'en-tête des rapports du DMEC, comme le logo de Paleto Bay à côté de celui du PHMC.
export const DMEC_LOGO_SMALL = 'https://phmc-tools.com/img/dmec-seal-small.png';
// Logos de l'en-tête des rapports du DMEC : le logo du PHMC, et le sceau du DMEC plus petit à côté.
export const dmecHeaderLogos = () => `[img]${PHMC_LOGO}[/img][img]${DMEC_LOGO_SMALL}[/img]`;

// En-tête d'un rapport : à gauche l'étiquette du dossier, le défunt et son identifiant ; à droite le logo et le titre du rapport.
//   dmecHeader({ label: 'Informations du défunt', name: 'Jane Doe', detail: 'ID Patient : PHMC-12', title: 'RAPPORT D\'AUTOPSIE', subtitle: '…' })
export const dmecHeader = ({ label, name, detail = '', title, subtitle = '' }) => `[table][tr][td][center][br][/br][br][/br][b]${label}[/b]

[size=110]${name}${detail ? `\n${detail}` : ''}[/size]

[/center][td][center]${dmecHeaderLogos()}
[b][size=150]${title}[/size][/b]${subtitle ? `\n${subtitle}` : ''}[/center][/table]`;

// Tableau « étiquette : valeur ». Chaque ligne est une liste de 1 à 3 paires [étiquette, valeur] ; une ligne à une seule paire prend toute la largeur.
//   infoTable([[['Lieu', 'Pillbox Hill'], ['Date', '12/03/2026']], [['Cause', 'Arme à feu']]])
export const infoTable = (rows) => `[table]\n${rows
    .filter((row) => Array.isArray(row) && row.length > 0)
    .map((row) => `[tr]${row.map(([label, value]) => `[td] ${label}: ${value} `).join('')}`)
    .join('\n')}\n[/table]`;

// Paragraphe de texte courant (déclarations, récits) : bloc sans puce, comme dans l'autorisation de divulgation.
export const paragraph = (text) => `[divbox=transparent][list=none]${text}[/list][/divbox]`;

// Tableau simple à une colonne par ligne (listes d'éléments, constatations), chaque ligne : « étiquette » en gras puis le texte.
export const labelledRows = (rows) => `[table]\n${rows.map(([label, text]) => `[tr][td] [b]${label}[/b]: ${text} `).join('\n')}\n[/table]`;

// Liste de photos : une image par ligne, centrée ; un texte d'attente quand il n'y en a pas.
export const photoBlock = (urls, empty) => (urls.length > 0 ? `[center]${urls.map((url) => `[img]${url}[/img]`).join('\n')}[/center]` : `[center][i]${empty}[/i][/center]`);
