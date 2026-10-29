// src/utils/amounts.js
//
// Montants saisis à la main : « 85 », « 85,5 » ou « 85.5 ». Une saisie VIDE n'est pas 0 (Number('') vaut 0 et passerait pour un vrai montant) : elle donne NaN,
// que les validations rejettent.
export const parseAmount = (value) => {
    if (typeof value === 'number') return value;
    const text = String(value ?? '').trim().replace(',', '.');
    return text === '' ? NaN : Number(text);
};
