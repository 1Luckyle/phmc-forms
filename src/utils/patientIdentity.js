// src/utils/patientIdentity.js
//
// Valeurs et libellés communs aux formulaires de dossier patient (Basique, Avancé, Mise à jour, Libération) : genre, ethnicité, type de téléphone,
// titre, et découpage d'un nom complet en prénom / deuxième prénom / nom. Module pur.

export const GENDER_OPTIONS = ['Homme', 'Femme', 'Autre'];

const GENDER_ALIASES = { male: 'Homme', masculin: 'Homme', homme: 'Homme', female: 'Femme', féminin: 'Femme', feminin: 'Femme', femme: 'Femme', other: 'Autre', autre: 'Autre' };
// « Male » (profil, anciens rapports) → « Homme » ; une valeur inconnue est gardée telle quelle.
export const toFrenchGender = (value) => GENDER_ALIASES[String(value ?? '').trim().toLowerCase()] || String(value ?? '');

export const ETHNICITY_OPTIONS = [
    'Caucasien(ne)', 'Afro-américain(e)', 'Hispanique / Latino(a)', 'Asiatique', 'Moyen-oriental(e)', 'Amérindien(ne)', 'Océanien(ne)', 'Métis(se)', 'Autre',
];


// Titre affiché dans les rapports (la valeur enregistrée est celle de la liste : Mr, Mrs…).
export const TITLE_LABELS = { Mineur: 'Mineur', Mstr: 'Maître', Mr: 'M.', Mrs: 'Mme', Ms: 'Mme/Mlle', Miss: 'Mlle', Other: 'Autre' };
export const titleLabel = (value) => TITLE_LABELS[value] || String(value || '');
// « M. Jean Dupont » : le titre devant le nom (rien si pas de titre ; le texte « Non renseigné » n'est jamais précédé d'un titre).
export const withTitle = (title, name, placeholder = 'Non renseigné') => {
    const label = titleLabel(title);
    const text = String(name || '').trim();
    return label && text && text !== placeholder ? `${label} ${text}` : text;
};

// « Jane Marie Doe » → { first: 'Jane', middle: 'Marie', last: 'Doe' } ; un seul mot = le prénom.
export const splitFullName = (fullName) => {
    const words = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return { first: '', middle: '', last: '' };
    if (words.length === 1) return { first: words[0], middle: '', last: '' };
    return { first: words[0], middle: words.slice(1, -1).join(' '), last: words[words.length - 1] };
};
export const joinFullName = (first, middle, last) => [first, middle, last].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
