// src/utils/signatureRenderer.js
//
// Dessine une signature « manuscrite » (encre noire fine, fond transparent) à partir du texte
// « Dr. Prénom Nom ». Les polices sont embarquées (src/assets/fonts, licence OFL) pour que le rendu
// soit identique pour tous et sans requête externe.
export const SIGNATURE_WIDTH = 460;
export const SIGNATURE_HEIGHT = 95;

export const SIGNATURE_STYLES = [
    { key: 'muellerhoff', label: 'Élancée', family: "'Herr Von Muellerhoff'", scale: 1.0 },
    { key: 'delafield', label: 'Classique', family: "'Mrs Saint Delafield'", scale: 1.0 },
    { key: 'doulaise', label: 'Cursive', family: "'Monsieur La Doulaise'", scale: 0.95 },
];

export const getSignatureStyle = (key) => SIGNATURE_STYLES.find((s) => s.key === key) || SIGNATURE_STYLES[0];

// Texte de la signature : « Dr. » + nom du médecin (sans doublon si déjà présent).
// `doctor: false` (patient, compte Civil) : le nom seul, sans « Dr. ».
export const buildSignatureText = (fullName, { doctor = true } = {}) => {
    const clean = (fullName || '').replace(/\s+/g, ' ').trim().replace(/^(dr\.?|docteur)\s+/i, '');
    if (!clean) return '';
    return doctor ? `Dr. ${clean}` : clean;
};

const ensureFont = async (family) => {
    if (!document.fonts || !document.fonts.load) return;
    try { await document.fonts.load(`64px ${family}`); } catch (e) { /* on dessinera avec la police de secours */ }
};

// Retourne un data URL PNG (fond transparent).
export const renderSignatureDataUrl = async (text, styleKey) => {
    const style = getSignatureStyle(styleKey);
    await ensureFont(style.family);

    const scaleFactor = 2; // rendu net une fois affiché/réduit
    const canvas = document.createElement('canvas');
    canvas.width = SIGNATURE_WIDTH * scaleFactor;
    canvas.height = SIGNATURE_HEIGHT * scaleFactor;
    const ctx = canvas.getContext('2d');
    ctx.scale(scaleFactor, scaleFactor);
    ctx.clearRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    ctx.fillStyle = '#111111';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // Taille maximale qui tient dans le cadre (marges comprises).
    const maxWidth = SIGNATURE_WIDTH - 24;
    let fontSize = Math.round(78 * style.scale);
    ctx.font = `${fontSize}px ${style.family}, cursive`;
    while (fontSize > 18 && ctx.measureText(text).width > maxWidth) {
        fontSize -= 2;
        ctx.font = `${fontSize}px ${style.family}, cursive`;
    }
    const width = ctx.measureText(text).width;
    ctx.fillText(text, Math.max(12, (SIGNATURE_WIDTH - width) / 2), SIGNATURE_HEIGHT * 0.72);
    return canvas.toDataURL('image/png');
};
