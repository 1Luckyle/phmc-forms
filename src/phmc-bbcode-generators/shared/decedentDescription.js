const SEX_LABELS = {
    Male: 'Masculin',
    Female: 'Féminin',
    Undetermined: 'Indéterminé',
};

const clean = (value) => (value && String(value).trim() ? String(value).trim() : '');

/**
 * Description physique du défunt sur une ligne, ou chaîne vide si rien n'a
 * été renseigné (le rapport reste alors identique à avant).
 * Ex. « Sexe : Masculin | Âge : 35 ans | Taille : 1,80 m | Signes particuliers : tatouage au bras gauche »
 */
export const buildDecedentDescription = (formData) => {
    const parts = [];
    const sex = SEX_LABELS[formData.decedentSex];
    if (sex) parts.push(`Sexe : ${sex}`);
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
