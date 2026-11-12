// src/utils/openPositionsText.js
//
// Texte à copier : TOUS les postes ouverts du recrutement, rangés par catégorie, avec l'échelon et les salaires de chaque poste
// (l'échelon vient de la grille salariale, d'après le rôle du poste : voir utils/salaryGrid.js).
// Mise en forme Markdown de Discord (gras, italique, puces) : le texte se colle tel quel dans un salon.
import { isPositionOpen } from '../constants/recruitment';
import { echelonOf, formatEchelonRates } from './salaryGrid';

// Un message Discord est limité à 2 000 caractères : au-delà, il faut coller le texte en plusieurs fois.
export const DISCORD_MESSAGE_LIMIT = 2000;

const frDate = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

// Les caractères que Discord interprète (* _ ~ ` |) dans un nom de poste sont neutralisés pour ne pas casser la mise en forme.
const escapeMarkdown = (text) => String(text || '').replace(/([\\*_~`|])/g, '\\$1');

// « Échelon 7 — 4 500 $/h · 90 000 $/sem. » ; « échelon non défini » si le poste n'a pas de rôle ou que son rôle n'est pas dans la grille.
export const positionPayLabel = (grid, position) => {
    const found = position && position.role ? echelonOf(grid, position.role) : null;
    if (!found) return 'échelon non défini';
    const rates = formatEchelonRates(found);
    return rates ? `${found.libelle} — ${rates}` : found.libelle;
};

// categories : [{ label, positions: { clé: poste français } }] dans l'ordre voulu. Retourne { text, count } (count = postes ouverts au total).
export const buildOpenPositionsText = ({ categories, grid, date = new Date(), organisation = 'Pillbox Hill Medical Center' }) => {
    let count = 0;
    const blocks = (categories || []).map(({ label, positions }) => {
        const open = Object.entries(positions || {}).map(([key, position]) => ({ key, position }))
            .filter(({ position }) => isPositionOpen(position))
            .sort((a, b) => String(a.position.nom || a.key).localeCompare(String(b.position.nom || b.key), 'fr'));
        count += open.length;
        const lines = open.length
            ? open.map(({ key, position }) => `• ${escapeMarkdown(position.nom || key)} — ${positionPayLabel(grid, position)}`)
            : ['*Aucun poste ouvert actuellement.*'];
        return [`**${escapeMarkdown(label)}**`, ...lines].join('\n');
    });
    const header = `**POSTES OUVERTS — ${escapeMarkdown(organisation)}**\n*(au ${frDate(date)} : ${count} poste${count > 1 ? 's' : ''} ouvert${count > 1 ? 's' : ''})*`;
    return { text: [header, ...blocks].join('\n\n'), count };
};
