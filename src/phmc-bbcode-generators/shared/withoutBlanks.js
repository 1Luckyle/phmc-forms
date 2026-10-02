/**
 * Copie de formData sans les champs texte vides.
 *
 * Les générateurs déclarent des valeurs par défaut (`champ = NOT_FILLED`) qui
 * ne s'appliquent qu'aux champs `undefined`. Or un champ jamais rempli vaut
 * souvent '' dans le formulaire : sans ce nettoyage, il s'imprimait comme un
 * blanc au lieu de « Non renseigné ».
 */
const withoutBlanks = (formData) => {
    const cleaned = {};
    Object.keys(formData || {}).forEach((key) => {
        const value = formData[key];
        if (typeof value === 'string' && value.trim() === '') return;
        cleaned[key] = value;
    });
    return cleaned;
};

export default withoutBlanks;
