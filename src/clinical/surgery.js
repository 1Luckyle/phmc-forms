// src/clinical/surgery.js
//
// Assistant chirurgical : à partir d'une ou plusieurs interventions du catalogue (clinical/procedures.js) et du patient, propose le contenu du rapport d'opération :
// diagnostic, nom, caractère, anesthésie (produits et doses calculés et contrôlés par le moteur), durée et pertes, classe ASA, surveillance post-opératoire, résumé, consignes, médicaments post-opératoires.
import { PROCEDURE_BY_ID } from './procedures';
import { entryText, newEntry, checkPrescription, findTerm, swapAntibiotic } from './engine';
import { surgeryDeathBundle } from './death';
import { regimenOf } from './medications';
import { suggestPatient, patientNotices } from './context';

export const SURGERY_SECTIONS = [
    { key: 'patient', label: 'Patient', hint: 'Complète les champs vides du patient : date de naissance et âge plausibles, sexe, allergies, antécédents et traitements habituels. Ne remplace jamais ce qui est saisi.' },
    { key: 'intervention', label: 'Intervention', hint: 'Diagnostic pré-opératoire, nom, caractère, type d\'anesthésie, durée et pertes sanguines.' },
    { key: 'anesthesia', label: 'Anesthésie', hint: 'Produits et doses d\'anesthésie calculés pour ce patient, et détails du réveil.' },
    { key: 'risk', label: 'Risque (ASA)', hint: 'Classe ASA estimée à partir du terrain (âge, corpulence, antécédents) et de l\'intervention.' },
    { key: 'postop', label: 'Surveillance post-op', hint: 'Lieu de surveillance et examens post-opératoires.' },
    { key: 'summary', label: 'Résumé et consignes', hint: 'Déroulé de l\'intervention et consignes post-opératoires.' },
    { key: 'meds', label: 'Médicaments', hint: 'Ajoute les médicaments post-opératoires à la liste ci-dessous.' },
];

export const procedureList = (ids) => (Array.isArray(ids) ? ids : []).map((id) => PROCEDURE_BY_ID[id]).filter(Boolean);

// ───────────── Anesthésie ─────────────
const ANESTHESIA = {
    General: {
        label: 'Anesthésie générale avec intubation orotrachéale',
        drugs: [['fentanyl', 'iv', 'analgésie'], ['propofol', 'iv_induction', 'induction'], ['rocuronium', 'iv', 'curarisation'], ['sugammadex', 'iv', 'décurarisation en fin d\'intervention']],
        extra: 'Entretien par agent halogéné (sévoflurane) et ventilation contrôlée.',
        after: 'Extubation en fin d\'intervention puis transfert en salle de réveil. Surveillance continue (scope, SpO2, tension) toutes les 15 minutes jusqu\'au réveil complet, antalgie multimodale.',
    },
    Regional_spinale: {
        label: 'Rachianesthésie',
        drugs: [['bupivacaine', 'spinale', 'rachianesthésie']],
        extra: 'Installation assise ou en décubitus latéral, ponction au niveau lombaire.',
        after: 'Surveillance de la levée du bloc moteur et sensitif, tension et fréquence cardiaque toutes les 15 minutes, prévention des nausées et de la rétention urinaire.',
    },
    Regional_bloc: {
        label: 'Anesthésie locorégionale (bloc nerveux)',
        drugs: [['bupivacaine', 'bloc', 'bloc nerveux']],
        extra: 'Repérage échoguidé ou par neurostimulation.',
        after: 'Surveillance de la levée du bloc, protection du membre insensible, relais antalgique avant la fin du bloc.',
    },
    Sedation: {
        label: 'Sédation',
        drugs: [['midazolam', 'iv', 'sédation'], ['ketamine', 'iv_analgesie', 'analgésie']],
        extra: 'Ventilation spontanée sous oxygène, matériel de ventilation à portée de main.',
        after: 'Surveillance de la vigilance et de la ventilation jusqu\'au retour à l\'état de base, à jeun 2 heures.',
    },
    Local: {
        label: 'Anesthésie locale',
        drugs: [['lidocaine', 'infiltration', 'infiltration locale']],
        extra: '',
        after: 'Surveillance de 30 minutes, consignes de surveillance de la zone opérée.',
    },
};
const ANESTHESIA_RANK = ['Local', 'Sedation', 'Regional', 'General'];

const planKey = (type, procedures) => (type === 'Regional' ? `Regional_${procedures.find((p) => p.anesthesia === 'Regional')?.block || 'spinale'}` : type);

/** Lignes de l'anesthésie pour un type : { lines, skipped, usable } — usable=false si un produit essentiel est indisponible (âge, allergie). */
const anesthesiaLines = (key, patient, ctx) => {
    const plan = ANESTHESIA[key];
    const lines = [];
    const skipped = [];
    let usable = true;
    plan.drugs.forEach(([medId, regimenId, role]) => {
        const entry = newEntry(medId, patient, regimenId);
        const result = entry && Number.isFinite(Number(entry.dose)) ? checkPrescription(entry, ctx) : { level: 'error', messages: [{ level: 'error', text: 'Dose non calculable pour ce patient.' }] };
        if (result.level === 'error') { skipped.push({ medId, reasons: result.messages.filter((m) => m.level === 'error').map((m) => m.text) }); usable = false; return; }
        lines.push(`${role} : ${entryText(entry)}`);
    });
    return { lines, skipped, usable, plan };
};

// ───────────── Risque ASA ─────────────
const SEVERE_TERMS = ['insuffisance cardiaque', 'insuffisance rénale', 'insuffisance respiratoire', 'bpco', 'cirrhose', 'cardiopathie', 'infarctus', 'avc', 'dialyse', 'insuffisance hépatique'];
const MODERATE_TERMS = ['diabète', 'hypertension', 'asthme', 'épilepsie', 'obésité', 'apnée du sommeil', 'tabagisme', 'tabac'];
export const estimateAsa = (patient, procedures) => {
    const chronic = patient.chronic || '';
    const severe = SEVERE_TERMS.filter((term) => findTerm(chronic, [term])).length;
    const moderate = MODERATE_TERMS.filter((term) => findTerm(chronic, [term])).length;
    const bmi = patient.weightKg && patient.heightCm ? patient.weightKg / ((patient.heightCm / 100) ** 2) : null;
    let asa = 1;
    if (moderate >= 1 || (bmi && bmi >= 30) || (patient.ageYears !== null && patient.ageYears >= 75)) asa = 2;
    if (severe >= 1 || moderate >= 2 || (bmi && bmi >= 40)) asa = 3;
    if (severe >= 2) asa = 4;
    asa = Math.max(asa, ...procedures.map((p) => p.asaFloor || 1));
    return `ASA${Math.min(5, asa)}`;
};

const MONITORING_RANK = ['Home', 'ObservationBox', 'Ward', 'RecoveryRoom', 'Icu'];
const roundTo = (value, step) => Math.round(value / step) * step;

/**
 * Tout ce que l'assistant propose pour les interventions choisies.
 * → null sans intervention ; sinon { procedures, fields (par section), postOpMeds, skipped, anesthesiaType }
 */
export const buildSurgerySuggestions = ({ procedureIds, patient, seed = '', formData = {} }) => {
    const procedures = procedureList(procedureIds);
    if (!procedures.length) return null;
    // Patient décédé au bloc : récit détaillé (cause, complication, échec de la procédure, résumé) selon la cause choisie ou la plus probable.
    const death = formData && formData.careDeceased === 'Yes' ? surgeryDeathBundle({ formData: { ...formData, surgeryProcedureIds: procedureIds } }) : null;
    const ctx = { patient, vitals: {}, tags: new Set() };
    const skipped = [];

    // Type d'anesthésie : le plus lourd des interventions ; repli sur l'anesthésie générale si un produit n'est pas utilisable pour ce patient.
    const wanted = procedures.map((p) => p.anesthesia).sort((a, b) => ANESTHESIA_RANK.indexOf(b) - ANESTHESIA_RANK.indexOf(a))[0];
    let type = wanted;
    let built = anesthesiaLines(planKey(type, procedures), patient, ctx);
    if (!built.usable && type !== 'General') {
        skipped.push(...built.skipped.map((s) => ({ ...s, reasons: [`${ANESTHESIA[planKey(type, procedures)].label} impossible : ${s.reasons[0]}`] })));
        type = 'General';
        built = anesthesiaLines('General', patient, ctx);
    } else skipped.push(...built.skipped);
    const plan = built.plan;
    const lines = [...built.lines];
    if (procedures.some((p) => p.prophylaxis)) {
        // Allergie aux céphalosporines ou allergie sévère à la pénicilline : clindamycine (ou vancomycine) à la place de la céfazoline (déjà contrôlée par swapAntibiotic).
        const swap = swapAntibiotic('cefazoline', patient, ctx);
        if (swap) {
            skipped.push(swap.skipped);
            if (swap.entry) lines.push(`antibioprophylaxie avant l'incision : ${entryText(swap.entry)}${swap.entry.medId === 'vancomycine' ? ' (perfusion lente d\'au moins 60 minutes, à débuter avant l\'incision)' : ''}`);
        } else {
            const entry = newEntry('cefazoline', patient, 'iv');
            const result = entry && Number.isFinite(Number(entry.dose)) ? checkPrescription(entry, ctx) : { level: 'error', messages: [{ level: 'error', text: 'Dose non calculable.' }] };
            if (result.level === 'error') skipped.push({ medId: 'cefazoline', reasons: result.messages.filter((m) => m.level === 'error').map((m) => m.text) });
            else lines.push(`antibioprophylaxie avant l'incision : ${entryText(entry)}`);
        }
    }
    const anesthesiaText = `${plan.label}.${plan.extra ? ` ${plan.extra}` : ''}\n${lines.map((line) => `- ${line}`).join('\n')}`.trim();

    // Durée et pertes : somme, avec un gain de 15 % sur les gestes associés.
    const sumDuration = procedures.reduce((total, p, index) => total + p.duration * (index === 0 ? 1 : 0.85), 0);
    const duration = roundTo(sumDuration, 5);
    const bloodLoss = roundTo(procedures.reduce((total, p) => total + p.bloodLoss, 0), 10);

    const asa = estimateAsa(patient, procedures);
    const asaNumber = Number(asa.replace('ASA', ''));
    let monitoring = procedures.map((p) => p.monitoring).sort((a, b) => MONITORING_RANK.indexOf(b) - MONITORING_RANK.indexOf(a))[0];
    if (asaNumber >= 4) monitoring = 'Icu';
    else if (type === 'General' && asaNumber >= 3 && MONITORING_RANK.indexOf(monitoring) < MONITORING_RANK.indexOf('RecoveryRoom')) monitoring = 'RecoveryRoom';

    const single = procedures.length === 1;
    const summary = `Intervention réalisée sous ${plan.label.toLowerCase()}.\n\n${procedures.map((p) => `${single ? '' : `${p.name} :\n`}${p.steps.map((step) => `- ${step}`).join('\n')}`).join('\n\n')}`;
    const unique = (list) => [...new Set(list.filter(Boolean))];

    // Médicaments post-opératoires : posologie quotidienne usuelle plafonnée à 4 prises.
    const postOpMeds = [];
    procedures.forEach((p) => p.postOpMeds.forEach(([medId, regimenId]) => {
        if (postOpMeds.some((m) => m.medId === medId && m.regimenId === regimenId)) return;
        const swapped = swapAntibiotic(medId, patient, ctx);
        if (swapped) {
            if (!skipped.some((s) => s.medId === medId)) skipped.push(swapped.skipped);
            if (swapped.entry && !postOpMeds.some((m) => m.medId === swapped.entry.medId)) {
                const altInterval = regimenOf(swapped.entry.medId, swapped.entry.regimenId)?.intervalHours || 0;
                postOpMeds.push({ ...swapped.entry, count: altInterval >= 4 ? Math.min(4, Math.floor(24 / altInterval)) : 1 });
            }
            return;
        }
        const entry = newEntry(medId, patient, regimenId);
        if (!entry || !Number.isFinite(Number(entry.dose))) { skipped.push({ medId, reasons: ['Non indiqué pour ce patient.'] }); return; }
        const interval = (regimenOf(medId, regimenId)?.intervalHours || 0);
        const candidate = { ...entry, count: interval >= 4 ? Math.min(4, Math.floor(24 / interval)) : 1 };
        const result = checkPrescription(candidate, ctx);
        if (result.level === 'error') { skipped.push({ medId, reasons: result.messages.filter((m) => m.level === 'error').map((m) => m.text) }); return; }
        postOpMeds.push(candidate);
    }));

    const fields = {
        patient: suggestPatient({ ids: procedureIds, seed, formData }),
        intervention: {
            surgeryPreOpDiagnosis: unique(procedures.map((p) => p.indication)).join(' '),
            surgeryProcedures: procedures.map((p) => p.name).join(' + '),
            surgeryCharacter: procedures.some((p) => p.urgent) ? 'Urgent' : 'Scheduled',
            surgeryAnesthesiaType: type,
            surgeryDuration: String(duration),
            surgeryBloodLoss: String(bloodLoss),
            // Enquête chirurgicale : consentement, complications et réussite de la procédure (un patient décédé : complication fatale et procédure non aboutie, avec leur détail).
            patientConsentOption: 'Yes',
            patientComplicationOptions: death ? 'Yes' : 'No',
            ...(death ? { patientComplicationsYes: death.complication } : {}),
            procedureGoodOptions: death ? 'No' : 'Yes',
            ...(death ? { procedureGoodNo: death.failure } : {}),
        },
        anesthesia: { patientSummaryConsultation: anesthesiaText, patientAddress: plan.after },
        risk: { surgeryAsa: asa },
        postop: { postOpMonitoring: monitoring, postOpExams: unique(procedures.map((p) => p.postOpExams)).join(' ') },
        summary: { patientSummary: death ? `${summary}\n\n${death.summary}` : summary, surgeryPostOpInstructions: unique(procedures.map((p) => p.instructions)).join(' ') },
    };
    return { procedures, anesthesiaType: type, asa, duration, bloodLoss, monitoring, fields, postOpMeds, skipped, notices: patientNotices({ ids: procedureIds, patient, label: 'cette intervention' }) };
};
