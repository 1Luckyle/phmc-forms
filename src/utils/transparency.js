// src/utils/transparency.js
//
// Page « Transparence » d'un établissement public (Code du Gouvernement, art. 326 à 328) : nom et contact de la personne qui dirige l'établissement,
// grille des rémunérations (voir salaryGrid.js) et comptes publiés à la fin de chaque trimestre (art. 327, avec la possibilité d'anonymiser les lignes
// liées à une enquête pénale).
//
// Stockage : adminSettings/transparence (lecture publique, écriture admin : voir database.rules.json)
//   { direction: { nom, fonction, contact }, equipe: [{ nom, fonction, contact }], contactDemandes, comptes: { 'AAAA-Tn': { periode, publieLe, publiePar, soldeOuverture, lignes: [{ type, libelle, montant }], notes } } }
// Seuls les comptes PUBLIÉS sont enregistrés (la lecture du nœud étant publique, un brouillon n'y serait pas privé) : le brouillon d'un trimestre reste
// dans le navigateur de l'admin (voir TransparencyManager).
import { ref, get, set, update, remove } from 'firebase/database';
import { database } from '../firebase';
import { parseAmount } from './amounts';

export const TRANSPARENCY_PATH = 'adminSettings/transparence';
export const MAX_LINE_AMOUNT = 1000000000;

const asArray = (value) => (!value ? [] : Array.isArray(value) ? value : Object.values(value));

export const LINE_TYPES = { recette: 'Recette', depense: 'Dépense' };

// Libellés proposés par défaut pour une ligne de comptes (l'admin peut aussi écrire le sien). Ils regroupent les « raisons » du relevé bancaire de
// l'établissement ; jamais de nom de personne ni d'IBAN : une ligne de comptes est une catégorie, pas une opération.
export const LINE_LABEL_SUGGESTIONS = {
    recette: [
        "Frais d'hospitalisation",
        'Dossiers médicaux payés par les patients',
        'Subvention',
        'Dons reçus',
        "Bénéfice d'un événement",
        'Transferts de fonds reçus',
    ],
    depense: [
        'Salaires des employés',
        'Primes',
        'Rattrapage de salaires',
        'Stock de médicaments (pharmacie)',
        'Alarme et sécurité',
        'Remboursement de matériel',
        'Dons reversés',
        'Transferts de fonds vers un service',
        "Dépenses d'enquête",
    ],
};

// ───────────────────────────── Trimestres ─────────────────────────────

export const quarterKey = (year, quarter) => `${year}-T${quarter}`;

export const parseQuarterKey = (key) => {
    const match = /^(\d{4})-T([1-4])$/.exec(String(key || ''));
    return match ? { year: Number(match[1]), quarter: Number(match[2]) } : null;
};

export const quarterLabel = (key) => {
    const parsed = parseQuarterKey(key);
    return parsed ? `${parsed.quarter === 1 ? '1er' : `${parsed.quarter}e`} trimestre ${parsed.year}` : String(key);
};

// [début, fin[ en millisecondes (heure locale du navigateur).
export const quarterBounds = (key) => {
    const parsed = parseQuarterKey(key);
    if (!parsed) return null;
    const startMonth = (parsed.quarter - 1) * 3;
    return [new Date(parsed.year, startMonth, 1).getTime(), new Date(parsed.year, startMonth + 3, 1).getTime()];
};

// Calendrier des quatre trimestres d'une année : le trimestre se termine le dernier jour du dernier mois, et ses comptes se publient « à la fin de
// chaque trimestre » (Code du Gouvernement, art. 327), donc dès le lendemain (aucun délai de grâce n'est fixé par le texte).
// → [{ key, quarter, label, startsOn: Date, endsOn: Date (dernier jour), publishFrom: Date (lendemain) }]
// Les trimestres antérieurs à l'ouverture de l'établissement n'existent pas ; celui de l'ouverture commence à cette date.
export const OPENING_DATE = new Date(2024, 8, 8);   // 8 septembre 2024
export const OPENING_YEAR = OPENING_DATE.getFullYear();

export const isBeforeOpening = (key) => {
    const bounds = quarterBounds(key);
    return !!bounds && bounds[1] <= OPENING_DATE.getTime();
};

export const quarterSchedule = (year) => [1, 2, 3, 4].filter((quarter) => !isBeforeOpening(quarterKey(year, quarter))).map((quarter) => {
    const startMonth = (quarter - 1) * 3;
    const firstDay = new Date(year, startMonth, 1);
    return {
        key: quarterKey(year, quarter), quarter, label: quarterLabel(quarterKey(year, quarter)),
        startsOn: firstDay < OPENING_DATE ? OPENING_DATE : firstDay, endsOn: new Date(year, startMonth + 3, 0), publishFrom: new Date(year, startMonth + 3, 1),
    };
});

export const currentQuarterKey = (now = Date.now()) => {
    const d = new Date(now);
    return quarterKey(d.getFullYear(), Math.floor(d.getMonth() / 3) + 1);
};

export const isQuarterOver = (key, now = Date.now()) => {
    const bounds = quarterBounds(key);
    return !!bounds && now >= bounds[1];
};

// ───────────────────────────── Lignes et totaux ─────────────────────────────

export const normalizeLines = (lines) => asArray(lines)
    .map((line) => ({
        type: line?.type === 'depense' ? 'depense' : 'recette',
        libelle: String(line?.libelle || '').trim(),
        montant: parseAmount(line?.montant),
    }))
    .filter((line) => line.libelle && Number.isFinite(line.montant));

// Validation AVANT publication : contrairement à normalizeLines (qui ignore ce qui est invalide pour l'affichage), rien ne disparaît ni ne devient « 0 $ »
// en silence. Une ligne entièrement vide est ignorée ; une ligne sans libellé, ou dont le montant est vide ou invalide, est une erreur.
// → { errors: [message], lines: [{ type, libelle, montant }] }
export const validateLines = (lines) => {
    const errors = [];
    const valid = [];
    asArray(lines).forEach((line, index) => {
        const libelle = String(line?.libelle || '').trim();
        const blankAmount = String(line?.montant ?? '').trim() === '';
        if (!libelle && blankAmount) return;
        const montant = parseAmount(line?.montant);
        if (!libelle) errors.push(`Ligne ${index + 1} : le libellé est vide.`);
        else if (!Number.isFinite(montant) || montant < 0 || montant > MAX_LINE_AMOUNT) errors.push(`Ligne ${index + 1} (« ${libelle} ») : le montant est vide ou invalide (entre 0 et 1 000 000 000).`);
        else valid.push({ type: line?.type === 'depense' ? 'depense' : 'recette', libelle, montant });
    });
    return { errors, lines: valid };
};

// Solde d'ouverture d'un trimestre (report du précédent, ou solde de départ de l'établissement) : peut être négatif ; vide = 0.
export const parseOpening = (value) => {
    const amount = parseAmount(value);
    return Number.isFinite(amount) ? amount : 0;
};

// Clé du trimestre précédent (« 2026-T1 » → « 2025-T4 »).
export const previousQuarterKey = (key) => {
    const parsed = parseQuarterKey(key);
    if (!parsed) return null;
    return parsed.quarter === 1 ? quarterKey(parsed.year - 1, 4) : quarterKey(parsed.year, parsed.quarter - 1);
};

// `solde` = variation du trimestre (recettes − dépenses) ; `cloture` = solde d'ouverture + variation.
export const totals = (lines, opening = 0) => {
    const normalized = normalizeLines(lines);
    const recettes = normalized.filter((l) => l.type === 'recette').reduce((sum, l) => sum + l.montant, 0);
    const depenses = normalized.filter((l) => l.type === 'depense').reduce((sum, l) => sum + l.montant, 0);
    const ouverture = parseOpening(opening);
    return { recettes, depenses, solde: recettes - depenses, ouverture, cloture: ouverture + recettes - depenses };
};

export const formatMoney = (value) => `${Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $`;

// ───────────────────────────── Lecture / écriture ─────────────────────────────

export const MAX_MEMBERS = 12;

const cleanMember = (member) => ({
    nom: String(member?.nom || '').trim().slice(0, 120),
    fonction: String(member?.fonction || '').trim().slice(0, 120),
    contact: String(member?.contact || '').trim().slice(0, 240),
});

export const normalizeTransparency = (raw) => {
    const comptes = {};
    Object.entries(raw?.comptes || {}).forEach(([key, account]) => {
        if (!parseQuarterKey(key) || !account) return;
        comptes[key] = {
            periode: key,
            publieLe: account.publieLe || null,
            publiePar: account.publiePar || '',
            soldeOuverture: parseOpening(account.soldeOuverture),
            lignes: normalizeLines(account.lignes),
            notes: String(account.notes || ''),
        };
    });
    const direction = cleanMember(raw?.direction);
    const membres = [direction, ...asArray(raw?.equipe).map(cleanMember)].filter((member) => member.nom || member.contact);
    return {
        direction,   // la personne qui dirige (première ligne) : champ historique, conservé
        membres,     // toutes les lignes publiées : direction, assistance de direction, etc.
        contactDemandes: String(raw?.contactDemandes || ''),
        comptes,
    };
};

export const loadTransparency = async () => {
    const snap = await get(ref(database, TRANSPARENCY_PATH));
    return normalizeTransparency(snap.exists() ? snap.val() : null);
};

// membres : [{ nom, fonction, contact }] — la première ligne est la personne qui dirige (stockée dans `direction`), les suivantes dans `equipe`.
export const saveDirection = async ({ membres, contactDemandes }) => {
    const lines = asArray(membres).map(cleanMember).filter((member) => member.nom || member.contact);
    if (lines.length > MAX_MEMBERS) throw new Error(`Au plus ${MAX_MEMBERS} lignes sur la page publique.`);
    await update(ref(database, TRANSPARENCY_PATH), {
        direction: lines[0] || { nom: '', fonction: '', contact: '' },
        equipe: lines.slice(1),
        contactDemandes: String(contactDemandes || '').trim().slice(0, 400),
    });
};

// Publie (ou met à jour) les comptes d'un trimestre. Retourne le compte enregistré.
export const publishAccounts = async (key, { lignes, notes, soldeOuverture }, byName) => {
    if (!parseQuarterKey(key)) throw new Error('Trimestre invalide.');
    if (isBeforeOpening(key)) throw new Error("Ce trimestre est antérieur à l'ouverture de l'établissement (8 septembre 2024).");
    const { errors, lines } = validateLines(lignes);
    if (errors.length > 0) throw new Error(errors.slice(0, 3).join(' '));
    if (lines.length === 0) throw new Error('Ajoutez au moins une ligne avant de publier.');
    const opening = parseOpening(soldeOuverture);
    if (Math.abs(opening) > MAX_LINE_AMOUNT) throw new Error('Solde d\'ouverture invalide (au plus 1 000 000 000 en valeur absolue).');
    const account = {
        periode: key,
        publieLe: Date.now(),
        publiePar: byName || '',
        soldeOuverture: opening,
        lignes: lines,
        notes: String(notes || '').trim().slice(0, 1500),
    };
    await set(ref(database, `${TRANSPARENCY_PATH}/comptes/${key}`), account);
    return account;
};

export const unpublishAccounts = async (key) => {
    if (!parseQuarterKey(key)) throw new Error('Trimestre invalide.');
    await remove(ref(database, `${TRANSPARENCY_PATH}/comptes/${key}`));
};

// Recettes tirées des factures payées dans le trimestre (admins : la lecture de tous les patients leur est ouverte). Retourne { montant, count }.
export const suggestQuarterRevenue = async (key) => {
    const bounds = quarterBounds(key);
    if (!bounds) return { montant: 0, count: 0 };
    const snap = await get(ref(database, 'facturesPatients'));
    let montant = 0;
    let count = 0;
    Object.values(snap.val() || {}).forEach((patientInvoices) => {
        Object.values(patientInvoices || {}).forEach((invoice) => {
            if (invoice?.statut === 'paye' && invoice.payeLe >= bounds[0] && invoice.payeLe < bounds[1]) {
                montant += Number(invoice.montant) || 0;
                count += 1;
            }
        });
    });
    return { montant, count };
};
