// src/clinical/context.js
//
// Données de contexte de l'assistant clinique qui complètent les motifs et les interventions : âge et sexe plausibles du patient, constatations par défaut, résultats d'examens, conseils de sortie,
// et petites fonctions pures (heure, choix d'une liste d'après un chiffre). Tout est testé dans clinical.test.js.
import { seededRandom } from './vitals';

// ───────────── Patient : âge, sexe, antécédents ─────────────
// Tranches d'âge où le motif ou l'intervention se voit surtout [min, max] ; sans entrée : adulte.
export const DEFAULT_AGE_RANGE = [18, 60];
export const AGE_RANGES = {
    sca: [45, 78], oap: [60, 85], avc: [55, 85], crise_hypertensive: [45, 80], tachyarythmie: [30, 75], bradycardie: [60, 85], syncope: [18, 85], asthme: [8, 45], pneumopathie: [18, 80],
    hypothermie: [25, 80], coup_chaleur: [18, 70], noyade: [5, 45], migraine: [18, 50], convulsions: [8, 60], hypoglycemie: [20, 70], acidocetose: [12, 45], deshydratation: [3, 80],
    intox_alcool: [18, 55], surdose_opioides: [18, 45], surdose_benzo: [20, 55], surdose_stimulants: [18, 40], agitation: [18, 50], plaie_arme_feu: [18, 40], plaie_arme_blanche: [18, 40],
    polytraumatisme: [18, 50], fracture_fermee: [8, 70], entorse_luxation: [12, 55], trauma_cranien: [8, 70], brulure: [3, 60], intox_paracetamol: [16, 45], douleur_abdominale: [10, 60],
    colique_nephretique: [25, 60], sepsis: [18, 85],
    // interventions
    appendicectomie: [8, 45], cholecystectomie: [30, 70], hernie: [20, 75], cesarienne: [20, 40], geu: [18, 42], torsion_testiculaire: [11, 25], fractures_faciales: [15, 45], trepanation: [18, 70],
    osteosynthese_membre: [15, 70], enclouage_femur: [18, 75], thoracotomie: [18, 50], laparotomie: [18, 60], splenectomie: [18, 60], amputation: [18, 60], greffe_peau: [5, 60],
};
// Sexe imposé par le motif ou l'intervention.
export const SEX_HINTS = { cesarienne: 'Female', geu: 'Female', torsion_testiculaire: 'Male' };
const SEX_LABELS = { Male: 'masculin', Female: 'féminin' };

const ageRangeFor = (ids) => {
    const ranges = ids.map((id) => AGE_RANGES[id]).filter(Boolean);
    if (!ranges.length) return DEFAULT_AGE_RANGE;
    const min = Math.max(...ranges.map((r) => r[0]));
    const max = Math.min(...ranges.map((r) => r[1]));
    return min <= max ? [min, max] : ranges[0];
};
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Valeurs proposées pour compléter le patient (seuls les champs vides sont à remplir, voir apply.js) : date de naissance et âge plausibles pour les motifs, sexe, et valeurs « aucun » des antécédents.
 * ids : motifs ou interventions choisis ; chronic : antécédents évoqués par les motifs (facultatif) ; formData : état du formulaire ; seed : texte stable (ID patient + date).
 */
export const suggestPatient = ({ ids = [], seed = '', formData = {}, chronic = [] }) => {
    const rand = seededRandom(`${seed}|patient|${ids.join(',')}`);
    const [min, max] = ageRangeFor(ids);
    const age = Math.round(min + rand() * (max - min));
    const onDate = /^\d{4}-\d{2}-\d{2}/.test(formData.date || '') ? new Date(`${String(formData.date).slice(0, 10)}T00:00:00`) : new Date();
    const birth = new Date(onDate.getFullYear() - age, onDate.getMonth(), onDate.getDate());
    birth.setDate(birth.getDate() - Math.floor(rand() * 364));
    const hinted = ids.map((id) => SEX_HINTS[id]).find(Boolean);
    const sex = hinted || (rand() < 0.5 ? 'Male' : 'Female');
    return {
        patientDateOfBirth: isoOf(birth > new Date() ? new Date(onDate.getFullYear() - age, 0, 1) : birth),
        patientAgeYears: String(age),
        patientSex: sex,
        patientAllergies: 'Aucune connue',
        patientChronicDiseases: chronic.length ? chronic.join(' ; ') : 'Aucun connu',
        patientCurrentMedicine: 'Aucun',
    };
};

/** Remarques sur le patient saisi : âge ou sexe manquants (calculs sur un adulte de 35 ans), sexe incompatible avec le motif ou l'intervention. */
export const patientNotices = ({ ids = [], patient = {}, label = 'ce motif' }) => {
    const notices = [];
    if (patient.ageYears === null || patient.ageYears === undefined) notices.push("Date de naissance non renseignée : constantes et doses calculées pour un adulte de 35 ans. « Patient » propose un âge plausible.");
    if (!patient.sex || patient.sex === 'Other') notices.push('Sexe non renseigné : les valeurs de repos sont celles d\'un adulte moyen.');
    ids.forEach((id) => {
        const wanted = SEX_HINTS[id];
        if (wanted && patient.sex && patient.sex !== 'Other' && patient.sex !== wanted) notices.push(`Sexe renseigné (${SEX_LABELS[patient.sex] || patient.sex}) : ${label} concerne un patient de sexe ${SEX_LABELS[wanted]}.`);
    });
    return notices;
};

// ───────────── Constatations par défaut ─────────────
/** Constatations d'un patient sans particularité, pour compléter celles que le motif ne précise pas (l'état général est altéré à partir d'une gravité modérée). */
export const defaultFindings = (severityIndex) => ({
    findings: severityIndex >= 1 ? 'patientImpared' : 'patientNormal',
    lungs: 'patientNormal',
    pupils: 'patientPupilsNormal',
    wounds: 'patientNoWounds',
    ecg: 'patientSinusRhythm',
    sono: 'patientNormal',
});

// ───────────── Arrivée et horaires ─────────────
export const arrivalModeFor = (severityIndex, tags) => (severityIndex >= 2 || tags.has('choc') ? 'EMS' : 'Walk-in');
/** Heure + minutes (HH:MM), au besoin au-delà de minuit. */
export const addMinutes = (time, minutes) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''));
    if (!match) return '';
    const total = (Number(match[1]) * 60 + Number(match[2]) + minutes + 24 * 60) % (24 * 60);
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};
export const currentTime = () => { const now = new Date(); return `${pad(now.getHours())}:${pad(now.getMinutes())}`; };

// ───────────── Résultats d'examens (valeurs des listes de constants/clinicalOptions.js) ─────────────
// Par motif : résultats d'imagerie et de laboratoire les plus probables ; un objet, ou une fonction de la gravité (0-3). Clés : XrayResults, ctResults, mriResults, ultrasoundResults, otherImagingResults, lab.
const NONE = 'NothingFound';
export const EXAM_RESULTS = {
    plaie_profonde: { XrayResults: [NONE] },
    fracture_fermee: { XrayResults: ['Displaced Fracture'] },
    fracture_ouverte: { XrayResults: ['Displaced Fracture', 'Fracture comminutive (esquilles osseuses)'] },
    entorse_luxation: { XrayResults: ['Dislocation'] },
    trauma_cranien: (sev) => ({ ctResults: [sev >= 2 ? 'Contusion cérébrale' : 'Pas de lésion intracrânienne aiguë'] }),
    plaie_arme_feu: { XrayResults: ['Projectile balistique ou fragments métalliques'], ctResults: ['Projectile balistique ou corps étranger'] },
    plaie_arme_blanche: (sev) => ({ XrayResults: [NONE], ultrasoundResults: [sev >= 2 ? 'Hémopéritoine (FAST positif)' : NONE] }),
    trauma_thoracique: (sev) => ({ XrayResults: [sev >= 1 ? 'Pneumothorax' : 'Fracture de côte(s)'], ultrasoundResults: sev >= 1 ? ['Pneumothorax (absence de glissement pleural)'] : [NONE], ctResults: sev >= 2 ? ['Hémothorax'] : [] }),
    trauma_abdominal: (sev) => ({ ultrasoundResults: ['Free Fluid Accumulation'], ctResults: [sev >= 2 ? 'Lésion splénique' : 'Lésion hépatique'] }),
    polytraumatisme: { XrayResults: ['Fracture du bassin'], ultrasoundResults: ['Hémopéritoine (FAST positif)'], ctResults: ['Hémopéritoine', 'Fractures costales multiples'] },
    sca: { lab: ['Troponine élevée'] },
    arret_cardiaque: { lab: ['Lactates élevés', 'Acidose métabolique'] },
    oap: { XrayResults: ['Pulmonary Edema'], lab: ['BNP élevé'] },
    pneumopathie: { XrayResults: ['Foyer de condensation (pneumonie)'], lab: ['Leucocytose', 'CRP élevée'] },
    detresse_respiratoire: { XrayResults: [NONE], lab: ['Hypoxémie'] },
    noyade: { XrayResults: ['Pulmonary Edema'], lab: ['Hypoxémie'] },
    avc: { ctResults: ['AVC ischémique (hypodensité)'], mriResults: ['Stroke'] },
    coma: { ctResults: ['Pas de lésion intracrânienne aiguë'] },
    surdose_opioides: { lab: ['Dépistage toxicologique positif (stupéfiants)'] },
    surdose_benzo: { lab: ['Dépistage toxicologique positif (stupéfiants)'] },
    surdose_stimulants: { lab: ['Dépistage toxicologique positif (stupéfiants)'] },
    intox_alcool: { lab: ['Alcoolémie positive'] },
    intox_paracetamol: { lab: ['Intoxication médicamenteuse'] },
    intox_fumees: { XrayResults: [NONE], lab: ['Carboxyhémoglobine élevée'] },
    hypoglycemie: { lab: ['Hypoglycémie'] },
    acidocetose: { lab: ['Hyperglycémie', 'Glycosurie ou cétonurie', 'Acidose métabolique'] },
    deshydratation: { lab: ['ElectrolyteImbalance'] },
    sepsis: (sev) => ({ lab: sev >= 2 ? ['Leucocytose', 'CRP élevée', 'Lactates élevés'] : ['Leucocytose', 'CRP élevée'] }),
    douleur_abdominale: { ultrasoundResults: ['Appendicite'], lab: ['Leucocytose', 'CRP élevée'] },
    colique_nephretique: { ultrasoundResults: ['Calcul rénal'], lab: ['Hématurie'] },
    coup_chaleur: { lab: ['Insuffisance rénale (créatinine élevée)'] },
};
const RESULT_KEYS = ['XrayResults', 'ctResults', 'mriResults', 'ultrasoundResults', 'otherImagingResults', 'lab'];
/** Résultats d'examens réunis pour des motifs : { XrayResults: [...], …, lab: [...] } (clés vides omises). */
export const examResultsFor = (ids, severityIndex) => {
    const merged = {};
    ids.forEach((id) => {
        const entry = EXAM_RESULTS[id];
        const value = typeof entry === 'function' ? entry(severityIndex) : entry;
        RESULT_KEYS.forEach((key) => { if (value && value[key] && value[key].length) merged[key] = [...new Set([...(merged[key] || []), ...value[key]])]; });
    });
    // « Aucune anomalie » ne cohabite pas avec un résultat positif.
    Object.keys(merged).forEach((key) => { if (merged[key].length > 1) merged[key] = merged[key].filter((value) => value !== NONE); });
    return merged;
};
/** Clé du formulaire qui porte les résultats de chaque type d'imagerie. */
export const examKeyOfImaging = { XRay: 'XrayResults', CTScan: 'ctResults', MRI: 'mriResults', Ultrasound: 'ultrasoundResults', Other: 'otherImagingResults' };

// ───────────── Conseils de sortie, par famille de motifs ─────────────
export const ADVICE_BY_GROUP = {
    Traumatologie: "Repos de la zone atteinte, glaçage 15 minutes plusieurs fois par jour, surveillance du pansement ou de l'immobilisation. Reconsulter en cas de douleur croissante, d'engourdissement, de fièvre ou de saignement.",
    'Cardio-vasculaire': 'Repos, éviter tout effort et ne pas conduire. Reconsulter immédiatement en cas de douleur thoracique, d\'essoufflement ou de malaise.',
    Respiratoire: 'Repos, hydratation, éviter les facteurs déclenchants. Reconsulter en cas de gêne respiratoire, de fièvre persistante ou de lèvres bleutées.',
    Neurologie: 'Repos au calme. Reconsulter en cas de somnolence, de vomissements répétés, de trouble de la parole ou de faiblesse d\'un membre.',
    Intoxications: 'Ne pas rester seul les prochaines heures, éviter l\'alcool et les autres substances. Reconsulter en cas de somnolence anormale ou de difficultés respiratoires.',
    'Métabolique et infectieux': 'Hydratation régulière et repos, surveiller la température (et la glycémie si diabétique). Reconsulter en cas de fièvre élevée, de vomissements persistants ou d\'aggravation.',
};
export const ADVICE_ADMITTED = 'Admission pour surveillance : constantes à intervalles réguliers, à jeun jusqu\'à avis médical, réévaluation clinique répétée.';

/**
 * Valeur de la liste dont le libellé contient l'intervalle ou le seuil qui correspond à `value` (« Normal (≥ 95 %) », « Faible (< 90 %) », « 90–94 % »…). undefined si aucun libellé n'est interprétable.
 * Sert aux listes de la base dont on ne connaît pas les valeurs (oxygène sanguin).
 */
export const pickNumericOption = (options, value) => {
    if (!Array.isArray(options) || !Number.isFinite(value)) return undefined;
    const matches = (label) => {
        const text = String(label || '').replace(/,/g, '.');
        const range = /(\d+(?:\.\d+)?)\s*(?:[-–—]|à)\s*(\d+(?:\.\d+)?)/.exec(text);
        if (range) return value >= Number(range[1]) && value <= Number(range[2]);
        const upper = /(?:<|≤|&lt;|inférieur[e]? à|moins de)\s*=?\s*(\d+(?:\.\d+)?)/i.exec(text);
        if (upper) return /≤|<=/.test(text) ? value <= Number(upper[1]) : value < Number(upper[1]);
        const lower = /(?:>|≥|&gt;|supérieur[e]? à|plus de)\s*=?\s*(\d+(?:\.\d+)?)/i.exec(text);
        if (lower) return /≥|>=/.test(text) ? value >= Number(lower[1]) : value > Number(lower[1]);
        // « 95%+ » ou « 95 % et plus » : à partir de ce seuil.
        const orMore = /(\d+(?:\.\d+)?)\s*%?\s*(?:\+|et plus)/i.exec(text);
        if (orMore) return value >= Number(orMore[1]);
        return null;
    };
    const found = options.find((option) => matches(option.label) === true);
    return found ? found.value : undefined;
};

