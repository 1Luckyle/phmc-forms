// src/utils/transparency.js
//
// Page « Transparence » d'un établissement public (Code du Gouvernement, art. 326 à 328) : nom et contact de la personne qui dirige l'établissement,
// grille des rémunérations (voir salaryGrid.js) et comptes publiés à la fin de chaque trimestre (art. 327, avec la possibilité d'anonymiser les lignes
// liées à une enquête pénale).
//
// Stockage : adminSettings/transparence (lecture publique, écriture admin : voir database.rules.json)
//   { direction: { nom, fonction, contact }, equipe: [{ nom, fonction, contact }], contactDemandes,
//     comptes: { 'AAAA-Tn': { periode, publieLe, publiePar, soldeOuverture, lignes: [{ type, libelle, montant }], notes } },       ← comptes du PHMC
//     comptesEntites: { [entité]: { 'AAAA-Tn': { …même forme… } } } }                                                          ← pharmacies : comptes à part (ENTITIES)
// Seuls les comptes PUBLIÉS sont enregistrés ici (la lecture du nœud étant publique, un brouillon n'y serait pas privé) : le brouillon d'un trimestre vit
// dans un nœud réservé aux admins, brouillonsTransparence (voir plus bas).
import { ref, get, set, update, remove, runTransaction } from 'firebase/database';
import { database } from '../firebase';
import { parseAmount } from './amounts';

export const TRANSPARENCY_PATH = 'adminSettings/transparence';
export const MAX_LINE_AMOUNT = 1000000000;

const asArray = (value) => (!value ? [] : Array.isArray(value) ? value : Object.values(value));

export const LINE_TYPES = { recette: 'Recette', depense: 'Dépense' };

// Libellés proposés par défaut pour une ligne de comptes (l'admin peut aussi écrire le sien). Ils regroupent les « raisons » du relevé bancaire de
// l'établissement ; jamais de nom de personne ni d'IBAN : une ligne de comptes est une catégorie, pas une opération.
// Les premiers de chaque liste viennent des relevés ; les suivants complètent avec les postes qu'un établissement de santé peut avoir (soins, formulaires payants
// du site comme les dossiers et l'autopsie, matériel, entretien…). L'admin peut toujours écrire son propre libellé.
export const LINE_LABEL_SUGGESTIONS = {
    recette: [
        "Frais d'hospitalisation",
        'Dossiers médicaux payés par les patients',
        'Dossiers patients avancés',
        'Divulgation de dossiers médicaux',
        "Frais d'autopsie",
        'Certificats médicaux',
        'Consultations',
        'Soins et interventions',
        'Transport sanitaire (ambulance)',
        'Subvention',
        'Dons reçus',
        "Bénéfice d'un événement",
        'Reversement des pharmacies',
        'Transferts de fonds reçus',
        'Remboursement reçu',
        'Autres recettes',
    ],
    depense: [
        'Salaires des employés',
        'Primes',
        'Primes de chef de service',
        'Rattrapage de salaires',
        'Stock de médicaments (pharmacie)',
        'Matériel médical',
        'Équipements et mobilier',
        'Entretien et réparations',
        'Alarme et sécurité',
        'Livraisons',
        'Formation du personnel',
        'Organisation d\'un événement',
        'Remboursement de matériel',
        'Dons reversés',
        'Transferts de fonds vers un service',
        'Taxes et impôts',
        'Frais bancaires',
        "Dépenses d'enquête",
        'Autres dépenses',
    ],
};

// Libellés des pharmacies (relevés de leurs comptes : ventes, stock, taxes sur les ventes, livraisons), complétés des postes habituels d'une officine.
export const PHARMACY_LABEL_SUGGESTIONS = {
    recette: [
        'Ventes de médicaments',
        "Ventes d'articles",
        'Ventes sur ordonnance',
        'Ventes en libre accès',
        'Dossiers médicaux payés par les patients',
        'Transferts de fonds reçus',
        'Dons reçus',
        'Subvention',
        'Remboursement reçu',
        'Autres recettes',
    ],
    depense: [
        'Stock de médicaments',
        'Taxes sur les ventes (Gouvernement)',
        'Livraisons',
        'Salaires des employés',
        'Primes',
        'Matériel et emballages',
        'Entretien et réparations',
        'Alarme et sécurité',
        'Transferts de fonds vers un service',
        'Remboursement de matériel',
        'Frais bancaires',
        'Autres dépenses',
    ],
};

// Libellés proposés pour une ligne de l'entité (le PHMC, ou une pharmacie) : `type` = 'recette' | 'depense'.
export const labelSuggestionsFor = (entityKey, type) => (entityKey === 'phmc' ? LINE_LABEL_SUGGESTIONS : PHARMACY_LABEL_SUGGESTIONS)[type] || [];

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

// ENTITÉS qui publient des comptes. Chacune tient sa PROPRE comptabilité (son compte, ses relevés) : rien n'est jamais additionné entre deux entités.
// `since` : début de la comptabilité de l'entité (premier relevé) ; les trimestres qui se terminent avant n'existent pas pour elle, et son premier trimestre
// commence à cette date. `phmc` est l'établissement lui-même (comptes historiques, stockés dans `comptes`) ; les autres sont des commerces rattachés au PHMC
// (stockés dans `comptesEntites/{clé}`) et s'affichent à la suite des siens.
export const ENTITIES = [
    { key: 'phmc', label: 'PHMC', title: 'Pillbox Hill Medical Center', since: OPENING_DATE },
    { key: 'pharmacie', label: 'Pharmacie du PHMC', title: 'Pharmacie du PHMC', since: new Date(2024, 7, 14, 4, 28) },       // 14 août 2024, 04:28
    { key: 'pharmacie-urgences', label: 'Pharmacie du Service des Urgences', title: 'Pharmacie du Service des Urgences du PHMC', since: new Date(2025, 10, 17, 22, 56) }, // 17 nov. 2025, 22:56
];
export const MAIN_ENTITY = 'phmc';
export const entityOf = (entityKey) => ENTITIES.find((entity) => entity.key === entityKey) || ENTITIES[0];
export const entityStartLabel = (entityKey) => entityOf(entityKey).since.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export const isBeforeOpening = (key, entityKey = MAIN_ENTITY) => {
    const bounds = quarterBounds(key);
    return !!bounds && bounds[1] <= entityOf(entityKey).since.getTime();
};

export const quarterSchedule = (year, entityKey = MAIN_ENTITY) => {
    const since = entityOf(entityKey).since;
    // Le premier trimestre commence à la date de début (jour entier : l'heure du premier relevé ne change pas la période affichée).
    const sinceDay = new Date(since.getFullYear(), since.getMonth(), since.getDate());
    return [1, 2, 3, 4].filter((quarter) => !isBeforeOpening(quarterKey(year, quarter), entityKey)).map((quarter) => {
        const startMonth = (quarter - 1) * 3;
        const firstDay = new Date(year, startMonth, 1);
        return {
            key: quarterKey(year, quarter), quarter, label: quarterLabel(quarterKey(year, quarter)),
            startsOn: firstDay < sinceDay ? sinceDay : firstDay, endsOn: new Date(year, startMonth + 3, 0), publishFrom: new Date(year, startMonth + 3, 1),
        };
    });
};

export const entityStartYear = (entityKey = MAIN_ENTITY) => entityOf(entityKey).since.getFullYear();

// Premier trimestre de l'entité : { year, quarter }.
export const firstQuarterOf = (entityKey = MAIN_ENTITY) => {
    const year = entityStartYear(entityKey);
    return { year, quarter: quarterSchedule(year, entityKey)[0].quarter };
};

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

// Comptes publiés d'UNE entité : { 'AAAA-Tn': { periode, publieLe, publiePar, soldeOuverture, lignes, notes } } (valeurs invalides ignorées).
export const normalizeAccounts = (rawAccounts) => {
    const comptes = {};
    Object.entries(rawAccounts || {}).forEach(([key, account]) => {
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
    return comptes;
};

// Où se publient les comptes d'une entité : le PHMC garde son emplacement historique, les autres ont le leur (comptes jamais mélangés).
export const accountPath = (entityKey, key) => (entityKey === MAIN_ENTITY
    ? `${TRANSPARENCY_PATH}/comptes/${key}`
    : `${TRANSPARENCY_PATH}/comptesEntites/${entityKey}/${key}`);

export const normalizeTransparency = (raw) => {
    const comptes = normalizeAccounts(raw?.comptes);
    // Comptes publiés de chaque entité, côte à côte : { phmc: {…}, pharmacie: {…}, 'pharmacie-urgences': {…} }
    const comptesParEntite = { [MAIN_ENTITY]: comptes };
    ENTITIES.filter((entity) => entity.key !== MAIN_ENTITY).forEach((entity) => { comptesParEntite[entity.key] = normalizeAccounts(raw?.comptesEntites?.[entity.key]); });
    const direction = cleanMember(raw?.direction);
    const membres = [direction, ...asArray(raw?.equipe).map(cleanMember)].filter((member) => member.nom || member.contact);
    return {
        direction,   // la personne qui dirige (première ligne) : champ historique, conservé
        membres,     // toutes les lignes publiées : direction, assistance de direction, etc.
        contactDemandes: String(raw?.contactDemandes || ''),
        comptes,     // comptes du PHMC (= comptesParEntite.phmc)
        comptesParEntite,
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
export const publishAccounts = async (key, { lignes, notes, soldeOuverture }, byName, entityKey = MAIN_ENTITY) => {
    if (!parseQuarterKey(key)) throw new Error('Trimestre invalide.');
    if (!ENTITIES.some((entity) => entity.key === entityKey)) throw new Error('Entité inconnue.');
    if (isBeforeOpening(key, entityKey)) throw new Error(`Ce trimestre est antérieur au début des comptes de « ${entityOf(entityKey).label} » (${entityStartLabel(entityKey)}).`);
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
    await set(ref(database, accountPath(entityKey, key)), account);
    return account;
};

export const unpublishAccounts = async (key, entityKey = MAIN_ENTITY) => {
    if (!parseQuarterKey(key)) throw new Error('Trimestre invalide.');
    if (!ENTITIES.some((entity) => entity.key === entityKey)) throw new Error('Entité inconnue.');
    await remove(ref(database, accountPath(entityKey, key)));
};

// ───────────────────────────── Brouillon des comptes (persistant, réservé aux admins) ─────────────────────────────
// brouillonsTransparence/{AAAA-Tn | entité_AAAA-Tn}: { lignes: [{ type, libelle, montant }], notes, ouverture, majLe, majPar } : un brouillon par entité et par trimestre, enregistré au fil de
// la saisie et visible des seuls admins (le nœud public adminSettings/transparence ne peut pas le porter). Les montants restent du TEXTE tant qu'on n'a pas
// publié : une saisie à moitié finie (montant vide, libellé manquant) est permise dans un brouillon, jamais à la publication (validateLines).
export const DRAFT_PATH = 'brouillonsTransparence';
export const MAX_DRAFT_LINES = 100;

// Clé du brouillon : « 2026-T3 » pour le PHMC (clé historique), « pharmacie_2026-T3 » pour une autre entité : un brouillon par entité ET par trimestre.
export const draftKeyOf = (entityKey, key) => (entityKey === MAIN_ENTITY ? key : `${entityKey}_${key}`);

// → { entity, quarter } ou null si la clé n'est pas celle d'un brouillon.
export const parseDraftKey = (draftKey) => {
    const text = String(draftKey || '');
    const separator = text.lastIndexOf('_');
    const entity = separator === -1 ? MAIN_ENTITY : text.slice(0, separator);
    const quarter = separator === -1 ? text : text.slice(separator + 1);
    return ENTITIES.some((candidate) => candidate.key === entity) && parseQuarterKey(quarter) ? { entity, quarter } : null;
};

const draftRef = (key) => ref(database, `${DRAFT_PATH}/${key}`);

export const normalizeDraft = (raw) => ({
    lignes: asArray(raw?.lignes).slice(0, MAX_DRAFT_LINES).map((line) => ({
        type: line?.type === 'depense' ? 'depense' : 'recette',
        libelle: String(line?.libelle ?? '').slice(0, 120),
        montant: String(line?.montant ?? '').slice(0, 30),
    })),
    notes: String(raw?.notes ?? '').slice(0, 1500),
    ouverture: String(raw?.ouverture ?? '').slice(0, 30),
    majLe: Number(raw?.majLe) || 0,
    majPar: String(raw?.majPar ?? ''),
});

export const isEmptyDraft = (draft) => (draft.lignes || []).length === 0 && !String(draft.notes || '').trim() && !String(draft.ouverture || '').trim();

// Brouillon enregistré du trimestre, ou null.
export const loadDraft = async (key) => {
    if (!parseDraftKey(key)) return null;
    const snap = await get(draftRef(key));
    return snap.exists() ? normalizeDraft(snap.val()) : null;
};

// Enregistre le brouillon du trimestre (un brouillon vide est supprimé). `baseMajLe` : date du brouillon tel que cette page l'a chargé ou enregistré en dernier ;
// si quelqu'un d'autre l'a modifié depuis, rien n'est écrasé : l'erreur porte `conflict` (sa version). Retourne le brouillon enregistré, ou null s'il a été supprimé.
export const saveDraft = async (key, draft, byName, baseMajLe = null) => {
    if (!parseDraftKey(key)) throw new Error('Trimestre invalide.');
    const clean = normalizeDraft(draft);
    const payload = isEmptyDraft(clean) ? null : { ...clean, majLe: Date.now(), majPar: String(byName || '').slice(0, 120) };
    const result = await runTransaction(draftRef(key), (current) => {
        if (current && (Number(current.majLe) || 0) > (Number(baseMajLe) || 0)) return undefined; // modifié par un autre depuis notre dernière lecture
        return payload;
    });
    if (!result.committed) {
        const error = new Error('Ce brouillon a été modifié par un autre administrateur.');
        error.conflict = normalizeDraft(result.snapshot.val());
        throw error;
    }
    return payload;
};

export const deleteDraft = async (key) => {
    if (!parseDraftKey(key)) return;
    await remove(draftRef(key));
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
