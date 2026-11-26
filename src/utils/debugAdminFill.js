import { testEmail } from './siteModeNow';
// src/utils/debugAdminFill.js
//
// Données de test des formulaires d'ADMINISTRATION (contrats, accords commerciaux, sécurité incendie…) pour le bouton « Remplir (debug) » (components/DebugFillButton.js : visible seulement quand un
// admin a activé le mode debug ET que la personne est dans la liste blanche). Les formulaires de rapports ont leurs propres gabarits (utils/debugTemplates.js) ; ceux-ci servent aux formulaires
// décrits par une liste de champs { key, label, type, options?, placeholder? } : on remplit chaque champ visible selon son type, en deux passes (un choix peut faire apparaître d'autres champs).

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const isoToday = (offsetDays = 0) => { const date = new Date(); date.setDate(date.getDate() + offsetDays); return isoOf(date); };

// Types dont la valeur dépend du contexte (grades, échelons, contrat modifié…) : fournis par l'appelant via `specials`.
const SPECIAL_TYPES = new Set(['role', 'echelon', 'rateMode', 'criteres', 'contratRef', 'convocationRef', 'services']);

/** Valeur de test d'un champ décrit par { key, label, type, options?, placeholder? } ; undefined quand le type est particulier ou qu'il n'y a rien à poser. */
export const debugFieldValue = (field) => {
    if (!field || SPECIAL_TYPES.has(field.type)) return undefined;
    const label = String(field.label || field.key || 'champ');
    switch (field.type) {
        case 'textarea': return `Texte de test (debug) : ${label.toLowerCase()}.`;
        case 'number': return /dur[ée]e|jours?|pr[ée]avis|validit/i.test(`${field.key} ${label}`) ? '7' : '10';
        case 'date': return /fin|[ée]ch[ée]ance|jusqu|expir|retour|entretien/i.test(`${field.key} ${label}`) ? isoToday(30) : isoToday();
        case 'time': return '14:30';
        case 'person': return 'Dr. Test Debug — Médecin Titulaire'; // personne désignée dans un document (menu du personnel) : un texte de test suffit
        case 'persons': return undefined;
        case 'horaires': return 'Lundi au vendredi : 08h00 – 16h00';
        case 'select': {
            const option = (field.options || []).find((item) => item && item.value !== '' && item.value != null && !item.disabled);
            return option ? option.value : undefined;
        }
        case 'email': return testEmail('test', 'debug');
        case 'tel': return '555-0100';
        case 'url': return 'https://phmc-tools.com';
        case 'checkbox': return undefined; // une case n'est jamais cochée d'office
        default: {
            const hint = String(field.placeholder || '').replace(/^ex\.?\s*:?\s*/i, '').trim();
            return hint || `Test — ${label}`;
        }
    }
};

/**
 * Remplit les champs VISIBLES encore vides de `champs`. `visibleFn(champs)` renvoie les définitions de champs visibles pour ces valeurs ; `specials` : { clé: valeur } pour les types
 * particuliers (rôle, échelon, contrat modifié…). Ne remplace jamais une valeur déjà saisie. → nouveaux champs.
 */
export const debugFillChamps = (visibleFn, champs, specials = {}) => {
    let current = { ...champs };
    for (let pass = 0; pass < 3; pass += 1) {
        let changed = false;
        visibleFn(current).forEach((field) => {
            const key = field.key;
            const filled = current[key] !== undefined && current[key] !== null && String(current[key]).trim() !== '' && current[key] !== false;
            if (filled) return;
            const value = Object.prototype.hasOwnProperty.call(specials, key) && specials[key] !== undefined && specials[key] !== '' ? specials[key] : debugFieldValue(field);
            if (value === undefined || value === '') return;
            current = { ...current, [key]: value };
            changed = true;
        });
        if (!changed) break;
    }
    return current;
};
