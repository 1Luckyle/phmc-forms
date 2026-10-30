// src/utils/salaryGrid.js
//
// Grille des rémunérations du PHMC et du DMEC : pour chaque GRADE, une liste d'ÉCHELONS ; chaque échelon a DEUX montants : à l'HEURE et à la SEMAINE
// (le contrat propose l'un ou l'autre). Un établissement public publie le salaire de chaque échelon de ses services (Code du Gouvernement, art. 326) : la
// grille est donc PUBLIQUE (page « Transparence ») et sert aussi aux contrats (le champ « échelon » propose ceux du grade choisi et préremplit la
// rémunération). Elle se modifie dans la Boîte à outils → Comptabilité → Transparence, sans toucher au code.
//
// Stockage : adminSettings/grilleSalariale (lecture publique ; écriture : admins, Directrice et Assistante de Direction)
//   { majLe, majPar, grades: { [clé du grade]: { grade, echelons: [{ libelle, horaire, hebdo }] } } }
// Anciennes grilles : un seul montant par échelon (`montant`) et une unité commune (`unite`, « de l'heure » ou « par semaine ») : lues comme un montant
// horaire ou hebdomadaire selon cette unité, réécrites au nouveau format à la prochaine publication.
// La clé d'un grade est une version sans accent ni caractère interdit de son nom (une clé Firebase ne peut contenir « . # $ [ ] / »).
// Un RECRUTEUR peut seulement CRÉER la ligne d'un grade qui n'y figure pas encore (nouveau rôle ajouté avec un poste), jamais modifier un salaire.
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';
import { normalizeRank } from '../constants/ranks';
import { parseAmount } from './amounts';

export const GRID_PATH = 'adminSettings/grilleSalariale';
export const DEFAULT_UNIT = 'de l\'heure';   // ancien format (une unité pour toute la grille)
export const MAX_AMOUNT = 10000000;

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
const orNull = (value) => (validAmount(value) ? value : null);

// Échelon propre (montants invalides = null) à partir de ce qui est en base ; `legacyWeekly` : l'ancien montant unique était hebdomadaire.
const normalizeEchelon = (raw, legacyWeekly) => {
    const legacy = raw?.montant !== undefined && raw?.horaire === undefined && raw?.hebdo === undefined ? parseAmount(raw.montant) : null;
    return {
        libelle: String(raw?.libelle || '').trim(),
        horaire: orNull(raw?.horaire !== undefined ? parseAmount(raw.horaire) : (legacyWeekly ? NaN : legacy)),
        hebdo: orNull(raw?.hebdo !== undefined ? parseAmount(raw.hebdo) : (legacyWeekly ? legacy : NaN)),
    };
};

// Ancien format, à lire d'une façon particulière : la grille de référence proposait deux montants par grade (taux horaire puis total hebdomadaire de 20 h) et
// chaque clic ajoutait un échelon. Deux échelons de l'ancien format dont l'un vaut exactement 20 fois l'autre sont donc les deux montants d'UN échelon.
const isLegacyEchelon = (e) => e && e.montant !== undefined && e.horaire === undefined && e.hebdo === undefined;
const mergeLegacyPair = (rawEchelons) => {
    if (rawEchelons.length !== 2 || !rawEchelons.every(isLegacyEchelon)) return null;
    const [first, second] = rawEchelons;
    const [a, b] = [parseAmount(first.montant), parseAmount(second.montant)];
    if (!validAmount(a) || !validAmount(b) || a === 0 || b === 0) return null;
    const [small, large] = a <= b ? [a, b] : [b, a];
    return large === small * 20 ? [{ libelle: String((a <= b ? first : second).libelle || '').trim(), horaire: small, hebdo: large }] : null;
};

// Grille propre à partir de ce qui est en base (échelons sans nom ou sans aucun montant valide ignorés).
export const normalizeGrid = (raw) => {
    const legacyWeekly = /semaine|hebdo/i.test(String(raw?.unite || ''));
    const grades = {};
    Object.entries(raw?.grades || {}).forEach(([key, entry]) => {
        const rawEchelons = asArray(entry?.echelons);
        const merged = mergeLegacyPair(rawEchelons);
        const echelons = (merged || rawEchelons.map((e) => normalizeEchelon(e, legacyWeekly)))
            .filter((e) => e.libelle && (e.horaire !== null || e.hebdo !== null));
        if (echelons.length > 0) grades[key] = { grade: String(entry?.grade || key), echelons };
    });
    return { majLe: raw?.majLe || null, majPar: String(raw?.majPar || ''), grades };
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

// Valide une liste d'échelons saisis (montants en texte ou en nombre) → { errors, echelons: [{ libelle, horaire, hebdo }] }. Au moins un montant par échelon.
export const validateEchelons = (rawEchelons, gradeLabel = 'Grade') => {
    const errors = [];
    const seen = new Set();
    const echelons = asArray(rawEchelons).map((e, index) => {
        const libelle = String(e?.libelle || '').trim();
        const horaireText = String(e?.horaire ?? '').trim();
        const hebdoText = String(e?.hebdo ?? '').trim();
        const horaire = horaireText === '' ? null : parseAmount(horaireText);
        const hebdo = hebdoText === '' ? null : parseAmount(hebdoText);
        if (!libelle) errors.push(`${gradeLabel} : l'échelon ${index + 1} n'a pas de nom.`);
        else if (seen.has(libelle.toLowerCase())) errors.push(`${gradeLabel} : deux échelons portent le nom « ${libelle} ».`);
        seen.add(libelle.toLowerCase());
        if (horaire === null && hebdo === null) errors.push(`${gradeLabel} : « ${libelle || `échelon ${index + 1}`} » n'a aucun montant (à l'heure ou à la semaine).`);
        if ((horaire !== null && !validAmount(horaire)) || (hebdo !== null && !validAmount(hebdo))) errors.push(`${gradeLabel} : un montant de « ${libelle || `échelon ${index + 1}`} » est invalide (entre 0 et ${MAX_AMOUNT.toLocaleString('fr-FR')}).`);
        return { libelle, horaire: horaire !== null && validAmount(horaire) ? horaire : null, hebdo: hebdo !== null && validAmount(hebdo) ? hebdo : null };
    });
    return { errors, echelons };
};

// Valide puis publie la grille. `grid.grades[clé].echelons` : [{ libelle, horaire, hebdo }] (montants texte ou nombre). Retourne la grille enregistrée.
export const saveSalaryGrid = async (grid, byName) => {
    const grades = {};
    const errors = [];
    Object.entries(grid.grades || {}).forEach(([key, entry]) => {
        if (asArray(entry.echelons).length === 0) return;
        const checked = validateEchelons(entry.echelons, entry.grade);
        errors.push(...checked.errors);
        grades[key] = { grade: entry.grade, echelons: checked.echelons.map(({ libelle, horaire, hebdo }) => ({ libelle, ...(horaire !== null ? { horaire } : {}), ...(hebdo !== null ? { hebdo } : {}) })) };
    });
    if (errors.length) throw new Error(errors.slice(0, 4).join(' '));
    const payload = { majLe: Date.now(), majPar: byName || '', grades };
    await set(ref(database, GRID_PATH), payload);
    return normalizeGrid(payload);
};

// Ajoute la ligne d'un grade s'il n'y figure pas encore (jamais de modification d'un grade existant). Retourne true si la ligne a été créée.
// Permis aux recruteurs : c'est ce qui range un nouveau rôle dans la grille quand on l'ajoute avec un poste.
export const addGradeIfMissing = async (rank, rawEchelons) => {
    const role = normalizeRank(rank);
    const key = gradeKeyOf(role);
    if (!key) throw new Error('Grade invalide.');
    const existing = await get(ref(database, `${GRID_PATH}/grades/${key}`));
    if (existing.exists() && asArray(existing.val()?.echelons).length > 0) return false;
    const checked = validateEchelons(rawEchelons, role);
    if (checked.errors.length) throw new Error(checked.errors[0]);
    if (checked.echelons.length === 0) throw new Error('Renseignez au moins un échelon.');
    await set(ref(database, `${GRID_PATH}/grades/${key}`), {
        grade: role,
        echelons: checked.echelons.map(({ libelle, horaire, hebdo }) => ({ libelle, ...(horaire !== null ? { horaire } : {}), ...(hebdo !== null ? { hebdo } : {}) })),
    });
    return true;
};

export const echelonsFor = (grid, rank) => grid?.grades?.[gradeKeyOf(rank)]?.echelons || [];

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
