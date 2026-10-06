// src/utils/patientId.js
//
// UNE seule définition de « l'ID patient » dans toute l'application (formulaires,
// titres, BBCode, index des dossiers, recherche). Fonctions pures, sans Firebase.
//
// Forme canonique : « PHMC-2752 ». Un ID peut avoir 4 ou 5 chiffres (ou plus : c'est
// l'ID du personnage GTA World) ; l'utilisateur peut saisir « 2752 », « phmc-2752 »,
// « PHMC 2752 » ou « PHMC-2752 » (avec des espaces parasites) : tout donne PHMC-2752.
// Un ID qui n'a pas la forme PHMC-chiffres (rare) est seulement nettoyé et mis en
// majuscules, jamais inventé.

// Retire les caractères interdits dans une clé Firebase (. # $ [ ] /).
const stripForbidden = (value) => String(value || '').replace(/[.#$[\]/]+/g, '_');

export const canonicalPatientId = (input) => {
    const compact = String(input || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!compact) return '';
    if (/^\d+$/.test(compact)) return `PHMC-${compact}`;
    const prefixed = compact.match(/^PHMC[-_]?(\d+)$/);
    if (prefixed) return `PHMC-${prefixed[1]}`;
    return stripForbidden(compact);
};

// Alias historique : tout le code existant qui « normalise » un ID obtient la forme canonique.
export const normalizePatientId = canonicalPatientId;

// Chiffres de l'ID (pour comparer « 2704 » et « PHMC-2704 »), ou '' si l'ID n'a pas cette forme.
export const patientIdDigits = (input) => {
    const canonical = canonicalPatientId(input);
    const match = canonical.match(/^PHMC-(\d+)$/);
    return match ? match[1] : '';
};

// Deux saisies désignent-elles le même patient ?
export const samePatientId = (a, b) => {
    const ca = canonicalPatientId(a);
    return !!ca && ca === canonicalPatientId(b);
};

// Clés sous lesquelles un ID a pu être indexé AVANT la forme canonique : saisie brute,
// chiffres seuls (« 2704 »), avec ou sans espace en trop. Sert de repli quand la liste
// des nœuds de l'index n'est pas lisible (compte civil).
export const patientIdCandidates = (input) => {
    const raw = String(input || '').trim();
    if (!raw) return [];
    const candidates = new Set([canonicalPatientId(raw), stripForbidden(raw), stripForbidden(raw.toUpperCase())]);
    const digits = patientIdDigits(raw);
    if (digits) {
        candidates.add(digits);
        candidates.add(`PHMC-${digits}`);
        candidates.add(`PHMC ${digits}`);
    }
    return [...candidates].filter(Boolean);
};

// Complète une saisie pour l'affichage dans un champ (au moment où on quitte le champ).
export const completePatientIdInput = (input) => {
    const raw = String(input || '');
    if (!raw.trim()) return raw;
    return canonicalPatientId(raw);
};
