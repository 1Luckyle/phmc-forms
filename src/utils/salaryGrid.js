// src/utils/salaryGrid.js
//
// Grille des rémunérations du PHMC et du DMEC : 15 ÉCHELONS fixes, chacun avec un taux À L'HEURE et un total À LA SEMAINE (le contrat propose l'un ou l'autre) ;
// chaque GRADE (rôle du personnel) a UN seul échelon, qui fixe son salaire. Modifier le salaire d'un échelon le modifie pour tous les grades qui s'y trouvent.
// Un établissement public publie le salaire de ses agents (Code du Gouvernement, art. 326) : la grille est donc PUBLIQUE (page « Transparence») et sert aussi aux
// contrats (le grade choisi donne son échelon, qui préremplit la rémunération). Elle se modifie dans la Boîte à outils → Comptabilité → Transparence.
//
// Stockage : adminSettings/grilleSalariale (lecture publique ; écriture : admins, Directrice et Assistante de Direction)
//   { majLe, majPar, echelons: { "1": { horaire, hebdo }, … "15": … }, grades: { [clé du grade]: { grade, echelon } } }
// Sans `echelons` en base, les salaires par défaut de constants/salaryReference.js s'appliquent. Anciennes grilles (plusieurs échelons par grade, avec un montant
// et une unité commune) : lues à la volée — l'échelon d'un grade se retrouve par le numéro de son nom (« Échelon 13 ») ou par son montant — et réécrites au
// nouveau format à la prochaine publication.
// La clé d'un grade est une version sans accent ni caractère interdit de son nom (une clé Firebase ne peut contenir « . # $ [ ] / »).
// Un RECRUTEUR peut seulement CRÉER la ligne d'un grade qui n'y figure pas encore (nouveau rôle ajouté avec un poste), jamais modifier un échelon ni un salaire.
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';
import { normalizeRank } from '../constants/ranks';
import { ECHELON_COUNT, DEFAULT_ECHELON_RATES } from '../constants/salaryReference';
import { parseAmount } from './amounts';

export const GRID_PATH = 'adminSettings/grilleSalariale';
export const MAX_AMOUNT = 10000000;
export { ECHELON_COUNT };

// Modes de rémunération d'un contrat : `field` = champ de l'échelon qui porte le montant.
export const RATE_MODES = {
    heure: { label: 'À l\'heure', suffix: 'de l\'heure', field: 'horaire' },
    semaine: { label: 'À la semaine', suffix: 'par semaine', field: 'hebdo' },
};
export const DEFAULT_RATE_MODE = 'heure';

export const gradeKeyOf = (rank) => String(normalizeRank(rank) || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const asArray = (value) => (!value ? [] : Array.isArray(value) ? value : Object.values(value));

const validAmount = (value) => Number.isFinite(value) && value >= 0 && value <= MAX_AMOUNT;

export const echelonLabel = (numero) => `Échelon ${numero}`;

// Numéro d'échelon (1 à 15) d'un nombre ou d'un nom comme « Échelon 13 », ou null.
export const parseEchelonNumber = (value) => {
    const n = typeof value === 'number' ? value : Number((String(value ?? '').match(/\d+/) || [])[0]);
    return Number.isInteger(n) && n >= 1 && n <= ECHELON_COUNT ? n : null;
};

// Les 15 échelons à partir de ce qui est en base (objet indexé par numéro, ou liste) : un montant absent ou invalide retombe sur le défaut.
const normalizeEchelons = (raw) => {
    const byNumber = {};
    if (Array.isArray(raw)) raw.forEach((value, index) => { byNumber[index + 1] = value; });
    else Object.entries(raw || {}).forEach(([key, value]) => { byNumber[key] = value; });
    return Array.from({ length: ECHELON_COUNT }, (unused, index) => {
        const numero = index + 1;
        const stored = byNumber[numero] || {};
        const fallback = DEFAULT_ECHELON_RATES[numero];
        const horaire = parseAmount(stored.horaire);
        const hebdo = parseAmount(stored.hebdo);
        return {
            numero,
            libelle: echelonLabel(numero),
            horaire: validAmount(horaire) ? horaire : fallback.horaire,
            hebdo: validAmount(hebdo) ? hebdo : fallback.hebdo,
        };
    });
};

// Échelon d'un grade de l'ancien format (liste d'échelons, un montant chacun) : le numéro lu dans le nom ou, à défaut, l'échelon dont un montant correspond.
// Si le nom et le montant s'accordent, c'est lui ; sinon le montant l'emporte (un nom d'échelon était libre).
const legacyEchelonOf = (entry, echelons, legacyWeekly) => {
    const first = asArray(entry?.echelons)[0];
    if (!first) return null;
    const named = parseEchelonNumber(first.libelle);
    const horaire = first.horaire !== undefined ? parseAmount(first.horaire) : (legacyWeekly ? NaN : parseAmount(first.montant));
    const hebdo = first.hebdo !== undefined ? parseAmount(first.hebdo) : (legacyWeekly ? parseAmount(first.montant) : NaN);
    const matches = echelons.filter((e) => (Number.isFinite(horaire) && e.horaire === horaire) || (Number.isFinite(hebdo) && e.hebdo === hebdo)).map((e) => e.numero);
    if (matches.length === 0) return named;
    return matches.includes(named) ? named : matches[0];
};

// Grille propre à partir de ce qui est en base : { majLe, majPar, echelons: [{ numero, libelle, horaire, hebdo }] (toujours 15), grades: { clé: { grade, echelon } } }.
export const normalizeGrid = (raw) => {
    const echelons = normalizeEchelons(raw?.echelons);
    const legacyWeekly = /semaine|hebdo/i.test(String(raw?.unite || ''));
    const grades = {};
    Object.entries(raw?.grades || {}).forEach(([key, entry]) => {
        const numero = parseEchelonNumber(entry?.echelon) ?? legacyEchelonOf(entry, echelons, legacyWeekly);
        if (numero) grades[key] = { grade: String(entry?.grade || key), echelon: numero };
    });
    return { majLe: raw?.majLe || null, majPar: String(raw?.majPar || ''), echelons, grades };
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

// L'échelon (objet { numero, libelle, horaire, hebdo }) d'un grade, ou null s'il n'est pas dans la grille.
export const echelonOf = (grid, rank) => {
    const numero = grid?.grades?.[gradeKeyOf(rank)]?.echelon;
    return numero ? grid.echelons[numero - 1] || null : null;
};

// Valide des salaires saisis d'échelons (montants en texte ou en nombre ; les DEUX sont obligatoires) → { errors, echelons: [{ numero, libelle, horaire, hebdo }] }.
export const validateEchelonRates = (rawEchelons) => {
    const errors = [];
    const echelons = asArray(rawEchelons).map((e) => {
        const numero = Number(e?.numero);
        const horaire = parseAmount(e?.horaire);
        const hebdo = parseAmount(e?.hebdo);
        const label = echelonLabel(numero);
        if (!Number.isInteger(numero) || numero < 1 || numero > ECHELON_COUNT) errors.push(`Numéro d'échelon invalide (1 à ${ECHELON_COUNT}).`);
        else if (!validAmount(horaire)) errors.push(`${label} : le montant à l'heure est vide ou invalide (entre 0 et ${MAX_AMOUNT.toLocaleString('fr-FR')}).`);
        else if (!validAmount(hebdo)) errors.push(`${label} : le montant à la semaine est vide ou invalide (entre 0 et ${MAX_AMOUNT.toLocaleString('fr-FR')}).`);
        return { numero, libelle: label, horaire, hebdo };
    });
    return { errors, echelons };
};

// Valide puis publie la grille. `grid.echelons` : [{ numero, horaire, hebdo }] (texte ou nombre) ; `grid.grades[clé]` : { grade, echelon }. Retourne la grille enregistrée.
export const saveSalaryGrid = async (grid, byName) => {
    const checked = validateEchelonRates(grid.echelons);
    const errors = [...checked.errors];
    const grades = {};
    Object.entries(grid.grades || {}).forEach(([key, entry]) => {
        const numero = parseEchelonNumber(entry?.echelon);
        if (!numero) { errors.push(`${entry?.grade || key} : choisissez un échelon (1 à ${ECHELON_COUNT}).`); return; }
        grades[key] = { grade: entry.grade, echelon: numero };
    });
    if (errors.length) throw new Error(errors.slice(0, 4).join(' '));
    const payload = {
        majLe: Date.now(),
        majPar: byName || '',
        echelons: Object.fromEntries(checked.echelons.map((e) => [String(e.numero), { horaire: e.horaire, hebdo: e.hebdo }])),
        grades,
    };
    await set(ref(database, GRID_PATH), payload);
    return normalizeGrid(payload);
};

// Range un grade dans la grille s'il n'y figure pas encore (jamais de modification d'un grade existant). Retourne true si la ligne a été créée.
// Permis aux recruteurs : c'est ce qui range un nouveau rôle dans la grille quand on l'ajoute avec un poste.
export const addGradeIfMissing = async (rank, echelon) => {
    const role = normalizeRank(rank);
    const key = gradeKeyOf(role);
    if (!key) throw new Error('Grade invalide.');
    const numero = parseEchelonNumber(echelon);
    if (!numero) throw new Error(`Choisissez l'échelon de ce grade (1 à ${ECHELON_COUNT}).`);
    const existing = await get(ref(database, `${GRID_PATH}/grades/${key}`));
    if (existing.exists() && normalizeGrid({ grades: { [key]: existing.val() } }).grades[key]) return false;
    await set(ref(database, `${GRID_PATH}/grades/${key}`), { grade: role, echelon: numero });
    return true;
};

// Montant d'un échelon dans un mode (« heure » ou « semaine »), ou null.
export const rateOf = (echelon, mode = DEFAULT_RATE_MODE) => {
    const field = (RATE_MODES[mode] || RATE_MODES[DEFAULT_RATE_MODE]).field;
    const value = echelon?.[field];
    return Number.isFinite(value) ? value : null;
};

const formatNumber = (n) => (Number.isInteger(n) ? n.toLocaleString('fr-FR') : n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// « 4 500 $ de l'heure », « 90 000 $ par semaine ».
export const formatRate = (montant, mode = DEFAULT_RATE_MODE) => {
    const n = Number(montant);
    if (!Number.isFinite(n)) return '';
    return `${formatNumber(n)} $ ${(RATE_MODES[mode] || RATE_MODES[DEFAULT_RATE_MODE]).suffix}`;
};

// Les deux montants d'un échelon, pour l'affichage : « 4 500 $/h · 90 000 $/sem. ».
export const formatEchelonRates = (echelon) => [
    echelon?.horaire !== null && echelon?.horaire !== undefined ? `${formatNumber(echelon.horaire)} $/h` : null,
    echelon?.hebdo !== null && echelon?.hebdo !== undefined ? `${formatNumber(echelon.hebdo)} $/sem.` : null,
].filter(Boolean).join(' · ');
