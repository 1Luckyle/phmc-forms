// src/utils/salaryGrid.js
//
// Grille des rémunérations du PHMC et du DMEC : pour chaque GRADE, une liste d'ÉCHELONS (libellé + montant). Un établissement public publie le salaire
// de chaque échelon de ses services (Code du Gouvernement, art. 326) : la grille est donc PUBLIQUE (page « Transparence ») et sert aussi aux contrats
// (le champ « échelon » propose ceux du grade choisi et préremplit la rémunération). Elle se modifie dans la Boîte à outils → Comptabilité → Transparence, sans
// toucher au code.
//
// Stockage : adminSettings/grilleSalariale (lecture publique, écriture admin : voir database.rules.json)
//   { unite, majLe, majPar, grades: { [clé du grade]: { grade, echelons: [{ libelle, montant }] } } }
// La clé d'un grade est une version sans accent ni caractère interdit de son nom (une clé Firebase ne peut contenir « . # $ [ ] / »).
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';
import { normalizeRank } from '../constants/ranks';
import { parseAmount } from './amounts';

export const GRID_PATH = 'adminSettings/grilleSalariale';
export const DEFAULT_UNIT = 'de l\'heure';
export const MAX_AMOUNT = 10000000;

export const gradeKeyOf = (rank) => String(normalizeRank(rank) || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const asArray = (value) => (!value ? [] : Array.isArray(value) ? value : Object.values(value));

// Grille propre à partir de ce qui est en base (valeurs invalides ignorées).
export const normalizeGrid = (raw) => {
    const grades = {};
    Object.entries(raw?.grades || {}).forEach(([key, entry]) => {
        const echelons = asArray(entry?.echelons)
            .map((e) => ({ libelle: String(e?.libelle || '').trim(), montant: parseAmount(e?.montant) }))
            .filter((e) => e.libelle && Number.isFinite(e.montant) && e.montant >= 0 && e.montant <= MAX_AMOUNT);
        if (echelons.length > 0) grades[key] = { grade: String(entry?.grade || key), echelons };
    });
    return { unite: String(raw?.unite || DEFAULT_UNIT), majLe: raw?.majLe || null, majPar: raw?.majPar || '', grades };
};

export const emptyGrid = () => normalizeGrid(null);

export const loadSalaryGrid = async () => {
    try {
        const snap = await get(ref(database, GRID_PATH));
        return normalizeGrid(snap.exists() ? snap.val() : null);
    } catch (error) {
        console.warn('Grille des rémunérations illisible :', error?.message || error);
        return emptyGrid();
    }
};

// Valide puis publie la grille. `grid.grades[clé].echelons` : [{ libelle, montant }] (montant texte ou nombre). Retourne la grille enregistrée.
export const saveSalaryGrid = async (grid, byName) => {
    const grades = {};
    const errors = [];
    Object.entries(grid.grades || {}).forEach(([key, entry]) => {
        const echelons = asArray(entry.echelons).map((e) => ({ libelle: String(e.libelle || '').trim(), montant: parseAmount(e.montant) }));
        if (echelons.length === 0) return;
        const seen = new Set();
        echelons.forEach((e, index) => {
            if (!e.libelle) errors.push(`${entry.grade} : l'échelon ${index + 1} n'a pas de nom.`);
            else if (seen.has(e.libelle.toLowerCase())) errors.push(`${entry.grade} : deux échelons portent le nom « ${e.libelle} ».`);
            seen.add(e.libelle.toLowerCase());
            if (!Number.isFinite(e.montant) || e.montant < 0 || e.montant > MAX_AMOUNT) errors.push(`${entry.grade} : le montant de « ${e.libelle || `échelon ${index + 1}`} » est vide ou invalide.`);
        });
        grades[key] = { grade: entry.grade, echelons };
    });
    if (errors.length) throw new Error(errors.slice(0, 4).join(' '));
    const payload = {
        unite: String(grid.unite || DEFAULT_UNIT).trim().slice(0, 40) || DEFAULT_UNIT,
        majLe: Date.now(),
        majPar: byName || '',
        grades,
    };
    await set(ref(database, GRID_PATH), payload);
    return normalizeGrid(payload);
};

export const echelonsFor = (grid, rank) => grid?.grades?.[gradeKeyOf(rank)]?.echelons || [];

// « 85 $ de l'heure ».
export const formatAmount = (montant, unite = DEFAULT_UNIT) => {
    const n = Number(montant);
    const text = Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
    return `${text} $ ${unite}`;
};
