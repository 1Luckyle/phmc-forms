// src/phmc-bbcode-generators/shared/bbStyles.js
//
// Styles BBCode COMMUNS à tous les formulaires : un seul endroit pour changer les couleurs, la forme
// des bandeaux de section, les cases à cocher ou l'en-tête PHMC, au lieu de modifier chaque générateur.
// Chaque fonction produit exactement le BBCode qui était auparavant recopié dans les générateurs.

import { isPbcVersion } from '../../utils/formAccess';

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

// Pied de page des formulaires de la clinique de Paleto Bay (PBC) : ses propres coordonnées (celles de son en-tête), pas celles de l'hôpital.
export const PBC_FOOTER_MARK = 'Paleto Bay Blvd., BP 685';
export const pbcFooter = () => `[hr][/hr]
[center][size=85][b]Clinique de Paleto Bay[/b]
${PBC_FOOTER_MARK}, Paleto Bay, San Andreas
Téléphone: 50056 — Courriel: info.phmc@mail.eyefind.fr
[url=https://phmc-tools.com]phmc-tools.com[/url][/size][/center]`;

// Formulaires qui portent déjà ce pied de page dans leur propre texte (courriels du PHMC) : rien n'est ajouté.
const FORMS_WITH_OWN_FOOTER = [27, 35, 42];
export const withPhmcFooter = (bbCode, version) => {
    const text = String(bbCode || '');
    if (!text.trim() || FORMS_WITH_OWN_FOOTER.includes(Number(version)) || text.includes(PHMC_FOOTER_MARK) || text.includes(PBC_FOOTER_MARK)) return text;
    return `${text.replace(/\s+$/, '')}\n${isPbcVersion(version) ? pbcFooter() : phmcFooter()}`;
};

// ─────────────────────────── Signature du personnel (pied de page par défaut) ───────────────────────────
// Tout rapport du personnel (hors candidatures, dossiers Civils, courriels qui ont leur propre signature) se termine par la signature de la personne qui l'a rempli, puis par
// son nom en gras, son rôle et son service, puis par le pied de page du centre. La signature est réduite à SIGNATURE_IMG_WIDTH pixels dans l'aperçu et le HTML ([img=largeur] est une
// extension du site : elle est retirée à la copie du BBCode, voir notificationService.copyToClipboard).
export const SIGNATURE_IMG_WIDTH = 200;
const NO_SIGNATURE_VERSIONS = [3, 24, 25, 26, 27, 35, 40, 42, 50, 51, 52, 53, 54, 55, 999];
export const hasStaffSignatureFooter = (version) => !NO_SIGNATURE_VERSIONS.includes(Number(version));
// Un « [mot] » saisi dans un champ ne doit pas devenir une balise BBCode : crochets pleine largeur (même règle que la messagerie, utils/internalMail.js).
export const escapeBbText = (text) => String(text || '').replace(/\[(\/?[a-z*][^\]\n]{0,60})\]/gi, '［$1］');
const bbSafe = (value) => String(value || '').replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
const httpsUrl = (value) => (/^https:\/\/[^\s[\]]+$/i.test(String(value || '').trim()) ? String(value).trim() : '');

// signer : { name, rank, service, signatureUrl }. Sans nom : rien. Sans signature (pas encore créée) : le nom seul s'imprime.
export const staffSignatureBlock = (signer = {}, { withGreeting = true } = {}) => {
    const name = bbSafe(signer.name);
    if (!name) return '';
    const image = httpsUrl(signer.signatureUrl);
    const details = [bbSafe(signer.rank), bbSafe(signer.service)].filter(Boolean).join('\n');
    return `${withGreeting && image ? 'Respectueusement,\n' : ''}${image ? `[img=${SIGNATURE_IMG_WIDTH}]${image}[/img]\n` : ''}[hr][/hr]
[b][size=105]${name}[/size][/b]${details ? `\n[size=85]${details}[/size]` : ''}`;
};

export const withStaffSignature = (bbCode, version, signer) => {
    const text = String(bbCode || '');
    if (!text.trim() || !hasStaffSignatureFooter(version) || !signer || !bbSafe(signer.name)) return text;
    return `${text.replace(/\s+$/, '')}\n[br][/br]\n${staffSignatureBlock(signer)}`;
};

// Pied de page commun des COURRIELS (messagerie interne, certificat de maladie, mail externe) : même bloc que celui des rapports du DMEC, suivi de la mention de confidentialité.
export const CONFIDENTIALITY_NOTICE = "Le contenu de ce message et de toute pièce jointe est confidentiel. Ils sont destinés uniquement au(x) destinataire(s) nommé(s). Si vous avez reçu ce courriel par erreur, veuillez en informer l'expéditeur immédiatement et ne pas divulguer le contenu à quiconque ni en faire de copies.";
export const mailFooter = ({ pbc = false } = {}) => `${pbc ? pbcFooter() : phmcFooter()}
[center][size=70][i]${CONFIDENTIALITY_NOTICE}[/i][/size][/center]`;

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
