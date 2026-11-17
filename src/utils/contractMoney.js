// src/utils/contractMoney.js
//
// Rémunération d'un contrat : on ne saisit que le MONTANT (des chiffres) ; le « $ » et le mode (« de l'heure », « par semaine ») sont ajoutés tout seuls. Le texte enregistré reste celui d'avant
// (« 4 500 $ de l'heure »), donc le contrat, le dossier du personnel et la comparaison avec la grille ne changent pas. Voir utils/salaryGrid.js (formatRate).
import { formatRate } from './salaryGrid';

const MAX_DIGITS = 9;

/** Montant contenu dans un texte de rémunération (« 4 500 $ de l'heure », « 90000 $ par semaine ») : nombre, ou null. */
export const amountOf = (text) => {
    const match = /\d[\d\s  ]*(?:[.,]\d+)?/.exec(String(text ?? '').split('$')[0]);
    if (!match) return null;
    const n = parseFloat(match[0].replace(/[\s  ]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

/** Ce qui s'affiche dans la case du montant : « 4 500 » (vide si rien n'est saisi). */
export const moneyDisplay = (text) => {
    const n = amountOf(text);
    return n === null ? '' : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
};

/** Texte enregistré pour ce que la personne vient de taper : seuls les chiffres comptent. '' si aucun chiffre. */
export const moneyText = (typed, mode) => {
    const digits = String(typed ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITS);
    return digits ? formatRate(Number(digits), mode) : '';
};

/** Fin de l'unité affichée à droite de la case : « $ de l'heure », « $ par semaine ». */
export const moneyUnit = (mode) => formatRate(1, mode).replace(/^1\s*/, '');
