// src/phmc-bbcode-generators/shared/requestingAuthority.js
//
// « Autorité requérante » d'un rapport de décès ou d'autopsie : qui a demandé ou ordonné l'intervention (mandat, officier, procureur, juge…),
// avec sa référence. Facultatif : sans autorité, rien n'est imprimé. Les libellés (AUTHORITY_TYPES) sont aussi ceux du gel judiciaire.
import { AUTHORITY_TYPES } from '../../constants/authorities';

// → « Autorité requérante : Mandat (réf. M-123) », ou '' si aucune autorité n'est renseignée.
export const requestingAuthorityText = ({ requestingAuthority = '', requestingAuthorityRef = '' } = {}) => {
    const label = AUTHORITY_TYPES[requestingAuthority];
    if (!label) return '';
    const reference = String(requestingAuthorityRef || '').trim();
    return `${label}${reference ? ` (réf. ${reference})` : ''}`;
};

export const requestingAuthorityLine = (formData) => {
    const text = requestingAuthorityText(formData);
    return text ? `[b]Autorité requérante :[/b] ${text}` : '';
};
