const SEX_LABELS = {
    Male: 'Masculin',
    Female: 'Féminin',
    Undetermined: 'Indéterminé',
};

const clean = (value) => (value && String(value).trim() ? String(value).trim() : '');

/**
 * Description physique du défunt sur une ligne, ou chaîne vide si rien n'a
 * été renseigné (le rapport reste alors identique à avant).
 * Ex. « Genre à l'état civil : Masculin | Âge : 35 ans | Taille : 1,80 m | Signes particuliers : tatouage au bras gauche »
 */
export const buildDecedentDescription = (formData) => {
    const parts = [];
    const sex = SEX_LABELS[formData.decedentSex];
    if (sex) parts.push(`Genre à l'état civil : ${sex}`);
    const born = clean(formData.decedentDateOfBirth);
    if (/^\d{4}-\d{2}-\d{2}/.test(born)) parts.push(`Né(e) le ${born.slice(0, 10).split('-').reverse().join('/')}`);
    const age = clean(formData.decedentAge);
    if (age) parts.push(`Âge : ${/^\d+$/.test(age) ? `${age} ans` : age}`);
    const height = clean(formData.decedentHeight);
    if (height) parts.push(`Taille : ${height}`);
    const weight = clean(formData.decedentWeight);
    if (weight) parts.push(`Poids : ${weight}`);
    const marks = clean(formData.decedentMarks);
    if (marks) parts.push(`Signes particuliers : ${marks}`);
    return parts.join(' | ');
};
