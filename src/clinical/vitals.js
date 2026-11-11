// src/clinical/vitals.js
//
// Constantes vitales plausibles d'un patient : valeurs de repos selon l'âge, le sexe, le poids et la taille, puis modifiées par les motifs de prise en charge et leur gravité.
// Pur et déterministe : pour un même patient, une même date et les mêmes motifs, les mêmes valeurs ressortent (une petite variation propre au patient évite que tous les rapports se ressemblent).

// Valeurs de repos par tranche d'âge : fréquence cardiaque et respiratoire (bornes normales + valeur centrale), tension systolique/diastolique centrale.
const BANDS = [
    { upTo: 1, hr: [110, 160, 135], rr: [30, 50, 40], sbp: 90, dbp: 55 },
    { upTo: 3, hr: [90, 150, 115], rr: [24, 40, 30], sbp: 95, dbp: 58 },
    { upTo: 6, hr: [80, 120, 100], rr: [22, 34, 26], sbp: 100, dbp: 62 },
    { upTo: 12, hr: [70, 110, 88], rr: [18, 30, 21], sbp: 108, dbp: 66 },
    { upTo: 18, hr: [60, 100, 78], rr: [12, 20, 16], sbp: 114, dbp: 70 },
    { upTo: 65, hr: [60, 100, 74], rr: [12, 20, 15], sbp: 120, dbp: 77 },
    { upTo: 200, hr: [60, 100, 72], rr: [14, 22, 16], sbp: 132, dbp: 80 },
];
const DEFAULT_ADULT_AGE = 35;
export const bandOf = (ageYears) => {
    const age = Number.isFinite(ageYears) ? ageYears : DEFAULT_ADULT_AGE;
    return BANDS.find((band) => age < band.upTo) || BANDS[BANDS.length - 1];
};

export const SEVERITIES = [
    { value: 'Mild', label: 'Légère', factor: 0.5, index: 0, igu: 'patientNormalPain' },
    { value: 'Moderate', label: 'Modérée', factor: 1, index: 1, igu: 'patientMildPain' },
    { value: 'Severe', label: 'Sévère', factor: 1.6, index: 2, igu: 'patientSeverePain' },
    { value: 'Critical', label: 'Critique', factor: 2.2, index: 3, igu: 'patientCritical' },
];
export const severityOf = (value) => SEVERITIES.find((s) => s.value === value) || SEVERITIES[1];

// Générateur pseudo-aléatoire déterministe (graine = texte).
const hashSeed = (text) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
};
const rngFrom = (seedText) => {
    let a = hashSeed(String(seedText));
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
export const seededRandom = (seedText) => rngFrom(seedText);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 0) => { const k = 10 ** digits; return Math.round(value * k) / k; };

/**
 * Valeurs de repos { hr, sbp, dbp, rr, spo2, temp, glu, gcs } d'un patient.
 * patient : { ageYears, sex, weightKg, heightCm } (tout peut manquer : on prend alors un adulte moyen).
 */
export const restingVitals = (patient = {}) => {
    const age = Number.isFinite(patient.ageYears) ? patient.ageYears : DEFAULT_ADULT_AGE;
    const band = bandOf(age);
    let hr = band.hr[2];
    let sbp = band.sbp;
    let dbp = band.dbp;
    const rr = band.rr[2];
    let spo2 = 98;
    if (patient.sex === 'Female') { hr += 3; sbp -= 5; dbp -= 3; }
    if (age >= 18 && patient.weightKg && patient.heightCm) {
        const bmi = patient.weightKg / ((patient.heightCm / 100) ** 2);
        if (bmi >= 35) { sbp += 14; dbp += 8; spo2 -= 1; hr += 4; }
        else if (bmi >= 30) { sbp += 8; dbp += 5; hr += 2; }
        else if (bmi < 18.5) { sbp -= 6; dbp -= 4; }
    }
    if (age >= 75) spo2 -= 1;
    return { hr, sbp, dbp, rr, spo2, temp: 36.8, glu: 0.9, gcs: 15 };
};

// Limites physiologiques de ce que le moteur peut produire.
const LIMITS = { hr: [30, 210], sbp: [40, 230], dbp: [20, 130], rr: [4, 60], spo2: [50, 100], temp: [30, 42], glu: [0.2, 6], gcs: [3, 15] };

/**
 * Combine les écarts (modérés) de plusieurs motifs : le plus fort écart compte en entier, les autres du même sens pour 30 %.
 * `deltasList` : liste d'objets { hr, sbp, ... } ; `factor` : coefficient de gravité.
 */
const combineDeltas = (deltasList) => {
    const out = {};
    Object.keys(LIMITS).forEach((key) => {
        const values = deltasList.map((d) => d?.[key]).filter((v) => typeof v === 'number' && v !== 0);
        if (!values.length) return;
        const positives = values.filter((v) => v > 0).sort((a, b) => b - a);
        const negatives = values.filter((v) => v < 0).sort((a, b) => a - b);
        const part = (list) => (list.length ? list[0] + 0.3 * list.slice(1).reduce((s, v) => s + v, 0) : 0);
        out[key] = part(positives) + part(negatives);
    });
    return out;
};

/**
 * Constantes estimées d'un patient pour des motifs donnés.
 * conditions : objets de clinical/conditions.js ; severity : 'Mild'|'Moderate'|'Severe'|'Critical' ; seed : texte stable (ID patient + date).
 * → { values: { hr, sbp, dbp, rr, spo2, temp, glu, gcs }, airwayObstructed }
 */
export const estimateVitals = (patient, conditions, severity, seed = '') => {
    const base = restingVitals(patient);
    const { factor } = severityOf(severity);
    const rand = rngFrom(`${seed}|${conditions.map((c) => c.id).join(',')}|${severity}`);
    const jitter = (amplitude) => (rand() * 2 - 1) * amplitude;
    const absolute = conditions.find((c) => c.vitalsOverride)?.vitalsOverride;
    const deltas = combineDeltas(conditions.map((c) => c.vitals));
    const values = {};
    Object.keys(LIMITS).forEach((key) => {
        const [min, max] = LIMITS[key];
        let value = base[key] + (deltas[key] || 0) * factor;
        if (key === 'gcs') value = base.gcs + (deltas.gcs || 0) * Math.min(factor, 1.6);
        const amplitude = { hr: 3, sbp: 4, dbp: 3, rr: 1, spo2: 0.8, temp: 0.2, glu: 0.04, gcs: 0 }[key];
        value += jitter(amplitude);
        values[key] = clamp(value, min, max);
    });
    // La diastolique reste nettement sous la systolique.
    if (values.dbp > values.sbp - 15) values.dbp = Math.max(LIMITS.dbp[0], values.sbp - 15);
    const result = {
        hr: Math.round(values.hr),
        sbp: Math.round(values.sbp),
        dbp: Math.round(values.dbp),
        rr: Math.round(values.rr),
        spo2: Math.round(values.spo2),
        temp: round(values.temp, 1),
        glu: round(values.glu, 2),
        gcs: Math.round(values.gcs),
    };
    if (absolute) Object.assign(result, absolute);
    return { values: result, airwayObstructed: conditions.some((c) => c.airway) && factor >= 1 };
};

/**
 * Catégories des listes déroulantes (valeurs du formulaire) à partir des chiffres.
 */
export const categorizeVitals = (values, ageYears, airwayObstructed = false) => {
    const age = Number.isFinite(ageYears) ? ageYears : DEFAULT_ADULT_AGE;
    const band = bandOf(age);
    const hypoSbp = age >= 12 ? 90 : age >= 1 ? 70 + 2 * age : 70;
    const hyperSbp = age >= 18 ? 140 : age >= 12 ? 130 : 105 + 2 * age;
    const out = {};
    out.temperature = values.temp < 35.5 ? 'patientHypothermic' : values.temp >= 38 ? 'patientHyperthermic' : 'patientTempNormal';
    out.heartRate = values.hr < band.hr[0] ? 'patientHeartRateBradycardia' : values.hr > band.hr[1] ? 'patientHeartRateTachycardia' : 'patientHeartRateNormal';
    if (airwayObstructed) out.breathing = 'patientBreathingObstructed';
    else out.breathing = values.rr < band.rr[0] ? 'patientBreathingSlow' : values.rr > band.rr[1] ? 'patientBreathingFast' : 'patientBreathingNormal';
    out.bloodPressure = values.sbp < hypoSbp ? 'patientBloodPressureHypotension' : (values.sbp >= hyperSbp || (age >= 18 && values.dbp >= 90)) ? 'patientBloodPressureHypertension' : 'patientBloodPressureNormal';
    return out;
};

const frNumber = (n, digits) => (digits ? n.toFixed(digits).replace('.', ',') : String(n));
/** Valeurs prêtes pour les champs « Valeurs mesurées » du formulaire. */
export const vitalsFormFields = (values) => ({
    temperatureValue: frNumber(values.temp, 1),
    heartRateValue: String(values.hr),
    respiratoryRateValue: String(values.rr),
    bloodPressureValue: `${values.sbp}/${values.dbp}`,
    spo2Value: String(values.spo2),
    glucoseValue: frNumber(values.glu, 2),
    gcsScore: String(values.gcs),
});

/** Relit les champs du formulaire en nombres (null si absent) — pour les contrôles des médicaments. */
export const vitalsFromForm = (f = {}) => {
    const num = (value) => { const n = parseFloat(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
    const bp = String(f.bloodPressureValue || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    return { hr: num(f.heartRateValue), rr: num(f.respiratoryRateValue), spo2: num(f.spo2Value), temp: num(f.temperatureValue), glu: num(f.glucoseValue), gcs: num(f.gcsScore), sbp: bp ? Number(bp[1]) : null, dbp: bp ? Number(bp[2]) : null };
};
