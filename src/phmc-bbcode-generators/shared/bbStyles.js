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
export const phmcHeaderEnd = () => `[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][td][center][br][/br][br][/br][size=100][b]CENTRE MÉDICAL PILLBOX HILL[/b]
ELGIN AVE. / STRAWBERRY AVE.
BP 742
LOS SANTOS, SAN ANDREAS
T: 50056[/size][/center][/table][/divbox]`;
