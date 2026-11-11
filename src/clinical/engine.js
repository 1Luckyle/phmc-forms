// src/clinical/engine.js
//
// Moteur de l'assistant clinique : doses proposées selon l'âge et le poids, contrôles de cohérence (dose maximale, cumul sur 24 h, allergies, antécédents, traitements en cours, constantes), et suggestions
// complètes à partir de motifs de prise en charge. Pur (aucune dépendance React / Firebase) : tout est testé dans engine.test.js.
import { MEDICATION_BY_ID, regimenOf, PENICILLIN_ALLERGY, CEPHALOSPORIN_ALLERGY } from './medications';
import { CONDITION_BY_ID, HISTORY_HINTS } from './conditions';
import { estimateVitals, categorizeVitals, vitalsFormFields, severityOf, vitalsFromForm } from './vitals';
import { ageOn } from '../utils/flightCertificate';
import { missingBackgroundItems } from '../utils/dossierCore';
import { suggestPatient, patientNotices, defaultFindings, arrivalModeFor, examResultsFor, ADVICE_BY_GROUP, ADVICE_ADMITTED } from './context';

// ───────────── Texte et patient ─────────────
const normalize = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim();
// Premier terme de `terms` présent (mot entier) dans `text`, sinon ''.
export const findTerm = (text, terms) => {
    const haystack = ` ${normalize(text)} `;
    if (haystack.trim() === '') return '';
    return (terms || []).find((term) => { const t = normalize(term); return t && haystack.includes(` ${t} `); }) || '';
};

export const parseWeightKg = (value) => {
    const n = parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) && n >= 1 && n <= 400 ? n : null;
};
export const parseHeightCm = (value) => {
    const text = String(value ?? '').replace(',', '.');
    const n = parseFloat(text);
    if (!Number.isFinite(n)) return null;
    const cm = n < 3 ? n * 100 : n;
    return cm >= 30 && cm <= 260 ? Math.round(cm) : null;
};
export const estimateWeightKg = (ageYears) => {
    if (!Number.isFinite(ageYears)) return 70;
    if (ageYears < 1) return 7;
    if (ageYears <= 10) return 2 * ageYears + 8;
    if (ageYears < 15) return 35 + (ageYears - 10) * 5;
    return 70;
};

export const patientFromForm = (f = {}) => {
    let ageYears = Number(f.patientAgeYears);
    if (!Number.isFinite(ageYears) || String(f.patientAgeYears ?? '').trim() === '') {
        const computed = ageOn(f.patientDateOfBirth, f.date);
        ageYears = computed !== null && computed >= 0 ? computed : null;
    }
    return {
        ageYears,
        sex: f.patientSex || '',
        weightKg: parseWeightKg(f.patientWeight),
        heightCm: parseHeightCm(f.patientHeight),
        allergies: f.patientAllergies || '',
        chronic: f.patientChronicDiseases || '',
        currentMeds: f.patientCurrentMedicine || '',
    };
};
export const isPediatric = (patient) => Number.isFinite(patient?.ageYears) && patient.ageYears < 15;

// ───────────── Nombres ─────────────
export const formatNumber = (n) => {
    const fixed = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
    const [int, dec] = fixed.split('.');
    return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${dec ? `,${dec}` : ''}`;
};
const roundDose = (value) => {
    const step = value >= 1000 ? 50 : value >= 100 ? 5 : value >= 10 ? 0.5 : value >= 1 ? 0.1 : 0.01;
    return Number((Math.round(value / step) * step).toFixed(2));
};
export const formatDose = (amount, unit) => `${formatNumber(amount)} ${unit}`;

// ───────────── Doses proposées ─────────────
const ageAllowed = (regimen, ageYears) => {
    if (!Number.isFinite(ageYears)) return '';
    const months = ageYears * 12 + 6;
    if (regimen.minAgeMonths !== undefined && months < regimen.minAgeMonths) return `Non indiqué avant ${regimen.minAgeMonths} mois.`;
    if (regimen.minAgeYears !== undefined && ageYears < regimen.minAgeYears) return `Non indiqué avant ${regimen.minAgeYears} ans.`;
    const hasChildDosing = regimen.perKg || regimen.byAge || regimen.weightBased;
    if (!hasChildDosing && regimen.minAgeYears === undefined && regimen.minAgeMonths === undefined && ageYears < 15) return 'Réservé à l\'adulte (15 ans et plus).';
    return '';
};

/**
 * Doses proposées pour un schéma.
 * → { options: [{ value, label, kind }], usual, mode, weightKg, weightEstimated, unavailable, maxSingle }
 */
export const doseOptions = (medId, regimenId, patient = {}) => {
    const med = MEDICATION_BY_ID[medId];
    const regimen = regimenOf(medId, regimenId);
    if (!med || !regimen) return { options: [], usual: null, mode: 'unknown', unavailable: 'Médicament ou voie inconnu.' };
    const unavailable = ageAllowed(regimen, patient.ageYears);
    const weightKnown = patient.weightKg || null;
    const weightKg = weightKnown || estimateWeightKg(patient.ageYears);
    const base = { weightKg, weightEstimated: !weightKnown, maxSingle: regimen.maxSingle ?? null, unavailable };
    const pack = (values, usual, mode) => {
        const sorted = [...new Set(values)].sort((a, b) => a - b);
        const options = sorted.map((value, index) => ({
            value,
            label: formatDose(value, regimen.unit),
            kind: value === usual ? 'usual' : index === 0 ? 'min' : index === sorted.length - 1 ? 'max' : 'mid',
        }));
        return { ...base, options, usual, mode };
    };
    if (unavailable) return { ...base, options: [], usual: null, mode: 'none' };
    const pediatric = isPediatric(patient);
    const useWeight = regimen.perKg && (regimen.weightBased || pediatric || (weightKnown && weightKnown < 40));
    if (pediatric && regimen.byAge) {
        const tier = regimen.byAge.find((t) => patient.ageYears < t.upToYears) || regimen.byAge[regimen.byAge.length - 1];
        return pack(tier.choices, tier.usual, 'byAge');
    }
    if (useWeight) {
        const [lo, usual, hi] = regimen.perKg.map((perKg) => roundDose(perKg * weightKg));
        const cap = (value) => (regimen.maxSingle ? Math.min(value, regimen.maxSingle) : value);
        const floor = (value) => (regimen.minSingle ? Math.max(value, regimen.minSingle) : value);
        const values = [lo, usual, hi].map((v) => floor(cap(v)));
        return pack(values, floor(cap(usual)), 'perKg');
    }
    if (regimen.adult.choices) return pack(regimen.adult.choices, regimen.adult.usual, 'adult');
    const [min, usual, max] = regimen.adult;
    return pack([min, usual, max], usual, 'adult');
};

// ───────────── Contrôles d'une prescription ─────────────
const LEVEL_RANK = { ok: 0, info: 1, warn: 2, error: 3 };
const worst = (messages) => messages.reduce((level, m) => (LEVEL_RANK[m.level] > LEVEL_RANK[level] ? m.level : level), 'ok');

/**
 * entry : { medId, regimenId, dose, count }
 * ctx   : { patient, vitals (vitalsFromForm), tags (Set d'identifiants de contexte, ex. 'hemorragie') }
 * → { level: 'ok'|'info'|'warn'|'error', messages: [{ level, text }] }
 */
export const checkPrescription = (entry, ctx = {}) => {
    const messages = [];
    const add = (level, text) => messages.push({ level, text });
    const patient = ctx.patient || {};
    const med = MEDICATION_BY_ID[entry?.medId];
    const regimen = regimenOf(entry?.medId, entry?.regimenId);
    if (!med || !regimen) { add('error', 'Médicament ou voie d\'administration inconnu.'); return { level: 'error', messages }; }
    const amount = Number(entry.dose);
    const count = Math.max(1, Number(entry.count) || 1);
    const opts = doseOptions(entry.medId, entry.regimenId, patient);

    if (opts.unavailable) add('error', `${med.name} (${regimen.route}) : ${opts.unavailable}`);
    if (!Number.isFinite(amount) || amount <= 0) add('error', 'Indiquez la dose.');
    else if (!opts.unavailable) {
        const values = opts.options.map((o) => o.value);
        const lo = Math.min(...values);
        const hi = Math.max(...values);
        if (regimen.maxSingle && amount > regimen.maxSingle) add('error', `Dose maximale d'une prise dépassée (${formatDose(regimen.maxSingle, regimen.unit)}).`);
        else if (opts.mode === 'perKg' || opts.mode === 'weightBased') {
            const perKg = amount / opts.weightKg;
            const [pMin, , pMax] = regimen.perKg;
            if (perKg > pMax * 1.25) add('error', `${formatNumber(Number(perKg.toFixed(2)))} ${regimen.unit}/kg : bien au-dessus de la dose maximale (${formatNumber(pMax)} ${regimen.unit}/kg).`);
            else if (perKg > pMax + 1e-9) add('warn', `${formatNumber(Number(perKg.toFixed(2)))} ${regimen.unit}/kg : au-dessus de la dose maximale (${formatNumber(pMax)} ${regimen.unit}/kg).`);
            else if (perKg < pMin * 0.5) add('warn', `Dose très inférieure à la dose usuelle (${formatNumber(pMin)} à ${formatNumber(pMax)} ${regimen.unit}/kg).`);
        } else if (opts.mode === 'byAge') {
            if (amount > hi) add('error', `Dose supérieure à celle prévue pour cet âge (${formatDose(hi, regimen.unit)}).`);
        } else if (amount > hi + 1e-9) add('warn', `Au-dessus de la dose usuelle maximale (${formatDose(hi, regimen.unit)}).`);
        else if (amount < lo * 0.5) add('warn', `Dose très inférieure à la dose usuelle minimale (${formatDose(lo, regimen.unit)}).`);
        if (opts.weightEstimated && opts.mode === 'perKg') add('info', `Poids du patient non renseigné : dose calculée sur un poids estimé de ${opts.weightKg} kg.`);
    }

    // Cumul sur 24 h (prise unique × nombre de prises), toutes voies du même médicament confondues dans checkList.
    if (!regimen.titration && Number.isFinite(amount) && amount > 0) {
        const total = amount * count;
        if (regimen.maxDaily && total > regimen.maxDaily) add('error', `${formatDose(total, regimen.unit)} sur 24 h : dépasse le maximum de ${formatDose(regimen.maxDaily, regimen.unit)}.`);
        if (regimen.maxDailyPerKg && opts.weightKg && total > regimen.maxDailyPerKg * opts.weightKg) add('error', `${formatDose(total, regimen.unit)} sur 24 h : dépasse ${formatNumber(regimen.maxDailyPerKg)} ${regimen.unit}/kg/24 h.`);
        if (regimen.intervalHours && regimen.intervalHours >= 1 && count > Math.floor(24 / regimen.intervalHours)) add('warn', `${count} prises par 24 h : l'intervalle minimal est de ${formatNumber(regimen.intervalHours)} h.`);
    }

    // Allergies, antécédents, traitements en cours.
    const allergyHit = findTerm(patient.allergies, med.allergy);
    if (allergyHit) add('error', `Allergie signalée (« ${allergyHit} ») : ${med.name} contre-indiqué.`);
    if (med.crossAllergy) {
        const hit = findTerm(patient.allergies, med.crossAllergy.terms);
        if (hit && !allergyHit) add(med.crossAllergy.level, med.crossAllergy.text);
    }
    (med.contra || []).forEach((rule) => { if (findTerm(`${patient.chronic} ${patient.allergies}`, rule.terms)) add(rule.level, rule.text); });
    (med.interacts || []).forEach((rule) => { const hit = findTerm(patient.currentMeds, rule.terms); if (hit) add(rule.level, `${rule.text} (« ${hit} »)`); });
    const tags = ctx.tags || new Set();
    Object.entries(med.avoidTags || {}).forEach(([tag, [level, text]]) => { if (tags.has(tag)) add(level, text); });
    const vitals = ctx.vitals || {};
    (med.vitalsWarn || []).forEach((rule) => { if (rule.when({ hr: null, rr: null, spo2: null, sbp: null, gcs: null, ...vitals })) add(rule.level, rule.text); });
    return { level: worst(messages), messages };
};

const FAMILY_CAUTION = { aine: 'anti-inflammatoires', opioide: 'opioïdes', benzo: 'benzodiazépines' };
/**
 * Contrôle de la liste entière : chaque prescription, cumul d'un même médicament sur 24 h, associations déconseillées.
 * → { entries: [{ level, messages }], list: [{ level, text }] }
 */
export const checkList = (entries, ctx = {}) => {
    const list = Array.isArray(entries) ? entries : [];
    const results = list.map((entry) => checkPrescription(entry, ctx));
    const listMessages = [];
    const byFamily = {};
    const dailyTotals = {};
    const reportDay = dayNumber(ctx.date) ?? dayNumber(new Date().toISOString().slice(0, 10));
    list.forEach((entry) => {
        const med = MEDICATION_BY_ID[entry.medId];
        const regimen = regimenOf(entry.medId, entry.regimenId);
        if (!med || !regimen) return;
        (byFamily[med.family] = byFamily[med.family] || new Set()).add(med.id);
        if (!regimen.titration && regimen.maxDaily) {
            const key = `${med.id}|${regimen.unit}`;
            dailyTotals[key] = dailyTotals[key] || { med, regimen, items: [] };
            // Médicament administré : le jour du rapport. Ordonnance : de sa date de début (à défaut le jour du rapport) pour sa durée (à défaut un jour : on contrôle le premier jour).
            const start = entry.prescribed && dayNumber(entry.startDate) !== null ? dayNumber(entry.startDate) - reportDay : 0;
            const length = entry.prescribed ? Math.max(1, Math.floor(Number(entry.days)) || 1) : 1;
            dailyTotals[key].items.push({ from: start, to: start + length - 1, perDay: (Number(entry.dose) || 0) * Math.max(1, Number(entry.count) || 1), prescribed: !!entry.prescribed });
        }
    });
    Object.entries(byFamily).forEach(([family, ids]) => {
        if (FAMILY_CAUTION[family] && ids.size > 1) listMessages.push({ level: 'warn', text: `Plusieurs ${FAMILY_CAUTION[family]} associés (${[...ids].map((id) => MEDICATION_BY_ID[id].name).join(', ')}) : association déconseillée.` });
    });
    // Pour chaque jour couvert, on additionne les lignes qui s'y chevauchent : seul un vrai chevauchement (au moins deux lignes le même jour) dépasse le maximum.
    Object.values(dailyTotals).forEach(({ med, regimen, items }) => {
        if (items.length < 2) return;
        const first = Math.min(...items.map((item) => item.from));
        const last = Math.min(Math.max(...items.map((item) => item.to)), first + 400);
        let worst = { total: 0, prescribed: false };
        for (let day = first; day <= last; day += 1) {
            const covering = items.filter((item) => item.from <= day && day <= item.to);
            if (covering.length < 2) continue;
            const total = covering.reduce((sum, item) => sum + item.perDay, 0);
            if (total > worst.total) worst = { total, prescribed: covering.some((item) => item.prescribed) };
        }
        if (worst.total > regimen.maxDaily) {
            const hint = worst.prescribed ? ' Si l\'un de ces traitements ne commence que plus tard (par exemple demain), indiquez sa date de début.' : '';
            listMessages.push({ level: 'error', text: `${med.name} : ${formatDose(worst.total, regimen.unit)} cumulés sur 24 h, au-dessus du maximum de ${formatDose(regimen.maxDaily, regimen.unit)}.${hint}` });
        }
    });
    return { entries: results, list: listMessages };
};

/** Nouvelle ligne de prescription avec la dose usuelle du schéma (ou du premier schéma disponible). */
export const newEntry = (medId, patient = {}, regimenId = '') => {
    const med = MEDICATION_BY_ID[medId];
    if (!med) return null;
    const ordered = regimenId ? med.regimens.filter((r) => r.id === regimenId) : med.regimens;
    const choice = ordered.map((r) => ({ r, opts: doseOptions(medId, r.id, patient) })).find(({ opts }) => !opts.unavailable) || { r: ordered[0] || med.regimens[0], opts: null };
    const opts = choice.opts || doseOptions(medId, choice.r.id, patient);
    return { medId, regimenId: choice.r.id, dose: opts.usual ?? '', count: 1, note: '' };
};

// ───────────── Dates (calendrier, sans fuseau) ─────────────
const dayNumber = (iso) => {
    const text = String(iso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    return Math.floor(Date.UTC(Number(text.slice(0, 4)), Number(text.slice(5, 7)) - 1, Number(text.slice(8, 10))) / 86400000);
};
/** « 2026-11-11 » + 1 → « 2026-11-12 » ; '' si la date est invalide. */
export const addDaysIso = (iso, days) => {
    const day = dayNumber(iso);
    return day === null ? '' : new Date((day + days) * 86400000).toISOString().slice(0, 10);
};
const frIso = (iso) => (dayNumber(iso) === null ? '' : String(iso).slice(0, 10).split('-').reverse().join('/'));

/** Ligne d'ORDONNANCE : le texte de la ligne, avec sa date de début et la durée du traitement (en jours) quand elles sont renseignées. */
export const prescriptionText = (entry) => {
    const base = entryText(entry);
    if (!base) return '';
    const days = Math.floor(Number(entry?.days));
    const start = frIso(entry?.startDate);
    return `${base}${start ? `, à partir du ${start}` : ''}${days > 0 ? `, pendant ${days} jour${days > 1 ? 's' : ''}` : ''}`;
};

/** Les morceaux d'une ligne d'ordonnance (tableau de l'ordonnance) : { name, posology, note, start, days, end } ; null si la ligne est inutilisable. */
export const prescriptionParts = (entry) => {
    const med = MEDICATION_BY_ID[entry?.medId];
    const regimen = regimenOf(entry?.medId, entry?.regimenId);
    if (!med || !regimen) return null;
    const count = Math.max(1, Number(entry.count) || 1);
    const dose = Number.isFinite(Number(entry.dose)) && entry.dose !== '' ? formatDose(Number(entry.dose), regimen.unit) : 'dose à préciser';
    const frequency = count > 1 ? `, ${count} prises/24 h${regimen.intervalHours >= 1 ? ` (toutes les ${formatNumber(regimen.intervalHours)} h)` : ''}` : '';
    const days = Math.floor(Number(entry.days)) > 0 ? Math.floor(Number(entry.days)) : 0;
    const startDate = dayNumber(entry.startDate) !== null ? String(entry.startDate).slice(0, 10) : '';
    return { name: med.name, posology: `${dose} — ${regimen.route}${frequency}`, note: String(entry.note || '').trim(), start: startDate, days, end: startDate && days ? addDaysIso(startDate, days - 1) : '' };
};

/** Texte d'une ligne de prescription, tel qu'imprimé dans le rapport. */
export const entryText = (entry) => {
    const med = MEDICATION_BY_ID[entry?.medId];
    const regimen = regimenOf(entry?.medId, entry?.regimenId);
    if (!med || !regimen) return '';
    const count = Math.max(1, Number(entry.count) || 1);
    const dose = Number.isFinite(Number(entry.dose)) && entry.dose !== '' ? formatDose(Number(entry.dose), regimen.unit) : 'dose à préciser';
    const frequency = count > 1 ? `, ${count} prises/24 h${regimen.intervalHours >= 1 ? ` (toutes les ${formatNumber(regimen.intervalHours)} h)` : ''}` : '';
    const note = String(entry.note || '').trim();
    return `${med.name} ${dose} — ${regimen.route}${frequency}${note ? ` (${note})` : ''}`;
};

// ───────────── Suggestions pour des motifs ─────────────
export const conditionsOf = (ids) => (Array.isArray(ids) ? ids : []).map((id) => CONDITION_BY_ID[id]).filter(Boolean);
export const contextTags = (conditions) => new Set(conditions.flatMap((c) => c.tags || []));

/**
 * Tout ce que l'assistant propose pour les motifs et la gravité choisis.
 * f : données du formulaire (patient, constantes déjà saisies pour les contrôles) ; seed : texte stable (ID patient + date).
 */
export const buildSuggestions = ({ conditionIds, severity, patient, seed = '', formData = {} }) => {
    const conditions = conditionsOf(conditionIds);
    if (!conditions.length) return null;
    const sev = severityOf(severity);
    const { values, airwayObstructed } = estimateVitals(patient, conditions, sev.value, seed);
    const categories = categorizeVitals(values, patient.ageYears, airwayObstructed);
    const tags = contextTags(conditions);

    const pick = (key) => conditions.map((c) => c.findings?.[key]).find(Boolean) || '';
    // Constatations : celles du motif, complétées par des constatations sans particularité pour les autres (aucune liste n'est laissée vide).
    const defaults = defaultFindings(sev.index);
    const specified = { findings: pick('esg'), lungs: pick('lungs'), pupils: pick('pupils'), wounds: pick('wounds'), ecg: pick('ecg'), sono: pick('sono') };
    const findings = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, specified[key] || fallback]));

    const admitted = conditions.some((c) => c.admitAt !== null && c.admitAt !== undefined && sev.index >= c.admitAt);
    const surgical = sev.index >= 2 && conditions.some((c) => c.surgical);
    const destination = surgical ? 'OperatingRoom' : admitted ? (conditions.map((c) => c.admitTo).find(Boolean) || 'Ward') : 'Home';
    const imaging = [...new Set(conditions.flatMap((c) => c.imaging || []))];
    const routineCare = [...new Set(conditions.flatMap((c) => c.routineCare || []))];

    const checkCtx = { patient, vitals: vitalsFromForm({ ...formData, ...vitalsFormFields(values) }), tags };
    const meds = [];
    const skipped = [];
    conditions.forEach((condition) => {
        (condition.meds || []).forEach(([medId, regimenId, minSeverity = 0]) => {
            if (sev.index < minSeverity) return;
            if (meds.some((m) => m.medId === medId && m.regimenId === regimenId)) return;
            const swap = swapAntibiotic(medId, patient, checkCtx);
            if (swap) {
                if (!skipped.some((s) => s.medId === medId)) skipped.push(swap.skipped);
                if (swap.entry && !meds.some((m) => m.medId === swap.entry.medId)) meds.push({ ...swap.entry, forCondition: condition.id });
                return;
            }
            const entry = newEntry(medId, patient, regimenId);
            if (!entry || !Number.isFinite(Number(entry.dose))) { skipped.push({ medId, reasons: [doseOptions(medId, regimenId, patient).unavailable || 'Dose non calculable.'] }); return; }
            const result = checkPrescription(entry, checkCtx);
            if (result.level === 'error') { skipped.push({ medId, reasons: result.messages.filter((m) => m.level === 'error').map((m) => m.text) }); return; }
            meds.push({ ...entry, forCondition: condition.id });
        });
    });

    // Résultats d'examens : seuls ceux des examens suggérés (imagerie) et de laboratoire.
    const exams = examResultsFor(conditions.map((c) => c.id), sev.index);
    const ids = conditions.map((c) => c.id);
    const patientPatch = suggestPatient({ ids, seed, formData, chronic: historySuggestions(ids, patient).chronic });
    const notices = patientNotices({ ids, patient });
    const advice = admitted || surgical ? ADVICE_ADMITTED : ADVICE_BY_GROUP[conditions[0].group] || '';

    const single = conditions.length === 1;
    const procedure = conditions.map((c) => `${single ? '' : `${c.label} :\n`}${(c.steps || []).map((step) => `- ${step}`).join('\n')}`).join('\n\n');
    const text = {
        complaint: conditions.map((c) => c.complaint).filter(Boolean).join(' ; '),
        mechanism: conditions.map((c) => c.mechanism).find(Boolean) || '',
        diagnosis: conditions[0].diagnosis,
        secondary: conditions.slice(1).map((c) => c.diagnosis).join(' ; '),
        procedure,
        advice,
    };
    return {
        conditions, severity: sev,
        vitals: { values, categories, fields: vitalsFormFields(values) },
        text, findings, imaging, routineCare, exams, patientPatch, notices,
        arrivalMode: arrivalModeFor(sev.index, tags),
        igu: sev.igu, admission: admitted ? 'Yes' : 'No',
        followup: conditions.some((c) => c.followup === 'Recommended') ? 'Recommended' : 'AsNeeded',
        destination, meds, skipped,
    };
};

// ───────────── Antibiotique de remplacement (allergie aux bêta-lactamines) ─────────────
const SEVERE_ALLERGY_TERMS = ['choc', 'anaphylaxie', 'anaphylactique', 'quincke', 'sévère', 'severe', 'grave', 'bronchospasme', 'détresse respiratoire'];
/** Allergie aux pénicillines / céphalosporines du patient : { penicillin, cephalosporin, severe } (« sévère » : choc, anaphylaxie… dans la même mention que la pénicilline). */
export const betaLactamAllergy = (patient = {}) => {
    const segments = String(patient.allergies || '').split(/[;\n]+/);
    const cephalosporin = !!findTerm(patient.allergies, CEPHALOSPORIN_ALLERGY);
    const penicillin = !!findTerm(patient.allergies, PENICILLIN_ALLERGY);
    const severe = segments.some((segment) => (findTerm(segment, PENICILLIN_ALLERGY) || findTerm(segment, CEPHALOSPORIN_ALLERGY)) && findTerm(segment, SEVERE_ALLERGY_TERMS));
    return { penicillin, cephalosporin, severe };
};
/**
 * La céfazoline est remplacée (clindamycine, puis vancomycine) en cas d'allergie aux céphalosporines ou d'allergie SÉVÈRE à la pénicilline ; une allergie légère garde la céfazoline avec son avertissement.
 * → null (pas de remplacement) ou { entry (null si aucune alternative utilisable), skipped: { medId, reasons } }.
 */
export const swapAntibiotic = (medId, patient, ctx = {}) => {
    if (medId !== 'cefazoline') return null;
    const allergy = betaLactamAllergy(patient);
    if (!allergy.cephalosporin && !allergy.severe) return null;
    const why = allergy.cephalosporin ? 'allergie aux céphalosporines' : 'allergie sévère à la pénicilline';
    for (const altId of ['clindamycine', 'vancomycine']) {
        const entry = newEntry(altId, patient, 'iv');
        if (!entry || !Number.isFinite(Number(entry.dose))) continue;
        if (checkPrescription(entry, { patient, vitals: ctx.vitals || {}, tags: ctx.tags || new Set() }).level === 'error') continue;
        return { entry, skipped: { medId, reasons: [`Remplacée par ${MEDICATION_BY_ID[altId].name} (${why} : pas de réaction croisée).`] } };
    }
    return { entry: null, skipped: { medId, reasons: [`Aucune alternative utilisable (${why}).`] } };
};

/** Avertissements (non bloquants) d'un rapport : prescriptions incohérentes. */
export const clinicalWarnings = (formData = {}) => {
    // Patient décédé : l'ordonnance n'existe plus, ses lignes ne déclenchent aucune alerte.
    const entries = (Array.isArray(formData.clinicalMeds) ? formData.clinicalMeds : []).filter((entry) => !(formData.careDeceased === 'Yes' && entry && entry.prescribed));
    if (!entries.length) return [];
    const patient = patientFromForm(formData);
    const conditions = conditionsOf(formData.clinicalConditions);
    const ctx = { patient, vitals: vitalsFromForm(formData), tags: contextTags(conditions), date: formData.date };
    const { entries: results, list } = checkList(entries, ctx);
    const lines = [];
    results.forEach((result, index) => {
        const med = MEDICATION_BY_ID[entries[index]?.medId];
        result.messages.filter((m) => m.level === 'error' || m.level === 'warn').forEach((m) => lines.push(`${med ? med.name : 'Médicament'} : ${m.text}`));
    });
    list.forEach((m) => lines.push(m.text));
    return lines;
};

/**
 * Éléments du dossier que les motifs choisis invitent à compléter : antécédents évoqués qui manquent au patient, et rappel de noter l'allergène.
 * → { chronic: ['Asthme'], allergen: boolean }
 */
export const historySuggestions = (conditionIds, patient = {}) => {
    const hints = (Array.isArray(conditionIds) ? conditionIds : []).map((id) => HISTORY_HINTS[id]).filter(Boolean);
    const wanted = [...new Set(hints.map((hint) => hint.chronic).filter(Boolean))];
    return { chronic: missingBackgroundItems(patient.chronic, wanted.join(' ; ')), allergen: hints.some((hint) => hint.allergen) };
};
