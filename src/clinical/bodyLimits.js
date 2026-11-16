// src/clinical/bodyLimits.js
//
// Bornes de l'âge, du poids et de la taille, et calcul de l'IMC : UNE seule définition pour tout le site (dossier médical, formulaires de soins, assistants cliniques, fiches du DMEC, outil Pilou).
// Les bornes sont celles que le moteur de Pilou sait traiter (doses, constantes de repos, matériel) : au-delà, un calcul ne serait plus fiable. Module pur.
export const BODY_LIMITS = {
    ageYears: { min: 0, max: 120 },
    weightKg: { min: 1, max: 400 },
    heightCm: { min: 30, max: 260 },
};

const toNumber = (value) => parseFloat(String(value ?? '').replace(',', '.'));

/** Âge en années entières (0 à 120), ou null. « 42 », « 42 ans » acceptés. */
export const parseAgeYears = (value) => {
    const n = toNumber(value);
    return Number.isFinite(n) && n >= BODY_LIMITS.ageYears.min && n <= BODY_LIMITS.ageYears.max ? Math.floor(n) : null;
};
/** Poids en kg (1 à 400), ou null. */
export const parseWeightKg = (value) => {
    const n = toNumber(value);
    return Number.isFinite(n) && n >= BODY_LIMITS.weightKg.min && n <= BODY_LIMITS.weightKg.max ? n : null;
};
/** Taille en cm (30 à 260), ou null. « 1,80 » (moins de 3) est lu comme 1,80 m. */
export const parseHeightCm = (value) => {
    const n = toNumber(value);
    if (!Number.isFinite(n)) return null;
    const cm = n < 3 ? n * 100 : n;
    return cm >= BODY_LIMITS.heightCm.min && cm <= BODY_LIMITS.heightCm.max ? Math.round(cm) : null;
};

export const LIMIT_HINTS = {
    ageYears: `de ${BODY_LIMITS.ageYears.min} à ${BODY_LIMITS.ageYears.max} ans`,
    weightKg: `de ${BODY_LIMITS.weightKg.min} à ${BODY_LIMITS.weightKg.max} kg`,
    heightCm: `de ${BODY_LIMITS.heightCm.min} à ${BODY_LIMITS.heightCm.max} cm`,
};

/** IMC (kg/m², une décimale) ; null si le poids ou la taille manque ou sort des bornes. */
export const bmiOf = (weight, height) => {
    const kg = parseWeightKg(weight);
    const cm = parseHeightCm(height);
    return kg && cm ? Number((kg / ((cm / 100) ** 2)).toFixed(1)) : null;
};

/** Interprétation d'un IMC (adulte) ; chez l'enfant et l'adolescent, l'IMC se lit sur les courbes de croissance : { label, level: 'ok' | 'info' | 'warn' }. */
export const bmiCategory = (bmi, ageYears = null) => {
    if (!Number.isFinite(bmi)) return null;
    if (Number.isFinite(ageYears) && ageYears < 18) return { label: 'à lire sur les courbes de croissance (enfant / adolescent)', level: 'info' };
    if (bmi < 16.5) return { label: 'dénutrition', level: 'warn' };
    if (bmi < 18.5) return { label: 'maigreur', level: 'info' };
    if (bmi < 25) return { label: 'corpulence normale', level: 'ok' };
    if (bmi < 30) return { label: 'surpoids', level: 'info' };
    if (bmi < 35) return { label: 'obésité modérée', level: 'warn' };
    if (bmi < 40) return { label: 'obésité sévère', level: 'warn' };
    return { label: 'obésité morbide', level: 'warn' };
};

/** IMC très improbable pour un humain (poids et taille probablement inversés ou mal saisis). */
export const isBmiImplausible = (bmi) => Number.isFinite(bmi) && (bmi < 8 || bmi > 90);
