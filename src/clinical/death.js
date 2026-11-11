// src/clinical/death.js
//
// Aide de l'assistant (Pilou) quand le patient est décédé pendant la prise en charge : propose l'heure, la cause (récit détaillé), la nature du décès, le déroulé de la réanimation, la famille et la destination du corps
// à partir de ce que le formulaire sait déjà (motifs de prise en charge et gravité aux urgences ; interventions, pertes sanguines, terrain et ASA à l'opération). Rien n'est écrit sans clic ; le soignant relit et corrige.
import { CONDITION_BY_ID } from './conditions';
import { PROCEDURE_BY_ID } from './procedures';
import { SURGERY_DEATH_MANNERS } from '../constants/careFormOptions';
import { minutesBetween } from '../utils/careFormRules';

const VIOLENT = ['plaie_arme_feu', 'plaie_arme_blanche'];
const INTOXICATION = ['surdose_opioides', 'surdose_benzo', 'surdose_stimulants', 'intox_alcool', 'intox_paracetamol', 'intox_fumees'];
const ACCIDENT = ['noyade', 'brulure', 'polytraumatisme', 'trauma_cranien', 'trauma_thoracique', 'trauma_abdominal', 'fracture_ouverte', 'fracture_fermee', 'plaie_profonde', 'hemorragie_externe', 'coup_chaleur', 'hypothermie'];

/** Circonstances probables d'après les motifs (urgences) ; 'Undetermined' quand rien ne permet de trancher. */
export const deathMannerOf = (conditionIds = []) => {
    const ids = (Array.isArray(conditionIds) ? conditionIds : []).filter((id) => CONDITION_BY_ID[id]);
    if (!ids.length) return 'Undetermined';
    if (ids.some((id) => VIOLENT.includes(id))) return 'Violent';
    if (ids.some((id) => INTOXICATION.includes(id))) return 'Intoxication';
    if (ids.some((id) => ACCIDENT.includes(id))) return 'Accidental';
    return ids.every((id) => !['TRAUMA', 'Traumatologie', 'Intoxications'].includes(CONDITION_BY_ID[id].group)) ? 'Natural' : 'Undetermined';
};

const lower = (text) => String(text || '').charAt(0).toLowerCase() + String(text || '').slice(1);
const frTime = (value) => (/^\d{1,2}:\d{2}$/.test(String(value || '')) ? String(value) : '');
const trimDot = (text) => String(text || '').trim().replace(/[.\s]+$/, '');

// ───────────── Opération : décès au bloc ─────────────
const ANESTHESIA_LABEL = { General: 'anesthésie générale', Regional: 'anesthésie locorégionale', Local: 'anesthésie locale', Sedation: 'sédation', None: 'sans anesthésie' };
const CARDIAC = /cardi|coronar|infarct|arythm|valv|angor/i;
const SURGERY_MANNER_VALUES = SURGERY_DEATH_MANNERS.map((option) => option.value);

const proceduresOf = (formData) => (Array.isArray(formData.surgeryProcedureIds) ? formData.surgeryProcedureIds : []).map((id) => PROCEDURE_BY_ID[id]).filter(Boolean);

/** Cause du décès au bloc : celle déjà choisie dans le formulaire, sinon la plus probable (pertes sanguines importantes → hémorragie ; terrain cardiaque ; ASA 4 ou 5 → pathologie initiale ; sinon à préciser par l'autopsie). */
export const surgeryDeathMannerOf = (formData = {}, procedures = proceduresOf(formData)) => {
    if (SURGERY_MANNER_VALUES.includes(formData.careDeathManner)) return formData.careDeathManner;
    const loss = Number(formData.surgeryBloodLoss) || procedures.reduce((total, p) => total + (p.bloodLoss || 0), 0);
    if (loss >= 400 || procedures.some((p) => p.urgent && p.asaFloor >= 3)) return 'Hemorrhage';
    if (CARDIAC.test(String(formData.patientChronicDiseases || ''))) return 'CardiacArrest';
    if (['ASA4', 'ASA5'].includes(formData.surgeryAsa)) return 'PreexistingCondition';
    return 'CauseUndetermined';
};

const SURGERY_CAUSE = {
    Hemorrhage: ({ loss }) => `Hémorragie peropératoire massive${loss ? ` (pertes estimées à ${loss} mL)` : ''}, non contrôlée malgré l'hémostase chirurgicale, le remplissage vasculaire et la transfusion, évoluant vers un choc hémorragique réfractaire puis un arrêt cardio-circulatoire.`,
    AnesthesiaComplication: () => "Complication de l'anesthésie : instabilité hémodynamique et ventilatoire survenue pendant l'endormissement ou l'entretien, évoluant vers un arrêt cardio-circulatoire malgré l'arrêt des agents anesthésiques et la prise en charge des voies aériennes.",
    Anaphylaxis: () => "Choc anaphylactique peropératoire (réaction à un produit administré pendant l'intervention) : collapsus cardio-vasculaire et bronchospasme réfractaires, évoluant vers un arrêt cardio-circulatoire.",
    CardiacArrest: ({ chronic }) => `Arrêt cardio-circulatoire peropératoire sur terrain cardiaque fragile${chronic ? ` (antécédents : ${trimDot(chronic)})` : ''} : fibrillation ventriculaire puis asystolie pendant l'acte, sans retour à une activité circulatoire spontanée.`,
    Embolism: () => "Embolie peropératoire (pulmonaire, graisseuse ou gazeuse) : désaturation brutale, collapsus cardio-vasculaire puis arrêt cardio-circulatoire pendant l'acte.",
    Shock: () => "Choc (septique ou hémorragique) non réversible : défaillance hémodynamique progressive malgré le remplissage et les amines vasopressives, évoluant vers un arrêt cardio-circulatoire.",
    SurgicalComplication: () => "Complication chirurgicale peropératoire (lésion d'un vaisseau ou d'un organe) ayant entraîné une défaillance hémodynamique irréversible, puis un arrêt cardio-circulatoire.",
    PreexistingCondition: ({ asa }) => `Aggravation de la pathologie initiale${asa ? ` (terrain ${asa})` : ''} : lésions trop graves pour être compensées, état hémodynamique irréversible malgré l'intervention, évoluant vers un arrêt cardio-circulatoire.`,
    CauseUndetermined: () => "Arrêt cardio-circulatoire peropératoire de cause non établie à ce stade : les circonstances exactes seront précisées par l'autopsie.",
};

// Geste spécifique de réanimation selon la cause.
const SURGERY_RESUS = {
    Hemorrhage: 'hémostase d\'urgence (clampage, packing), transfusion massive (culots globulaires et plasma frais), remplissage vasculaire et acide tranexamique',
    AnesthesiaComplication: 'arrêt des agents anesthésiques, contrôle des voies aériennes (intubation et ventilation vérifiées) et antidotes disponibles administrés',
    Anaphylaxis: 'adrénaline renforcée, remplissage vasculaire massif, bronchodilatateurs et corticoïdes',
    CardiacArrest: 'défibrillation par chocs électriques externes (200 J) et amiodarone 300 mg',
    Embolism: 'oxygénothérapie à haute concentration, remplissage prudent et amines vasopressives',
    Shock: 'remplissage vasculaire, amines vasopressives et antibiothérapie large selon le contexte',
    SurgicalComplication: 'contrôle chirurgical de la lésion (clampage, suture ou packing) et transfusion',
    PreexistingCondition: 'remplissage vasculaire, amines vasopressives et contrôle chirurgical des lésions accessibles',
    CauseUndetermined: 'défibrillation si le rythme est choquable, adrénaline et recherche d\'une cause réversible',
};

/**
 * Récit du décès au bloc : { manner, cause, resuscitation, complication, failure, summary }.
 *  cause / resuscitation : champs « Décès » ; complication / failure : « Complications » et « Procédure réussie ? » de l'enquête chirurgicale ; summary : paragraphe ajouté au résumé de la procédure.
 */
export const surgeryDeathBundle = ({ formData = {}, now = '' } = {}) => {
    const procedures = proceduresOf(formData);
    const manner = surgeryDeathMannerOf(formData, procedures);
    const names = procedures.length ? procedures.map((p) => p.label).join(', ') : String(formData.surgeryProcedures || '').trim();
    const loss = Number(formData.surgeryBloodLoss) || procedures.reduce((total, p) => total + (p.bloodLoss || 0), 0);
    const time = frTime(formData.careDeathTime) || frTime(now);
    const anesthesia = ANESTHESIA_LABEL[formData.surgeryAnesthesiaType];
    const opening = `Décès survenu au cours de l'intervention${names ? ` (${lower(names)})` : ''}${anesthesia ? `, sous ${anesthesia}` : ''}${time ? `, constaté à ${time}` : ''}.`;
    const reason = SURGERY_CAUSE[manner]({ loss: loss ? Math.round(loss) : 0, chronic: String(formData.patientChronicDiseases || '').trim(), asa: String(formData.surgeryAsa || '').replace('ASA', 'ASA ') });
    const resuscitation = `Arrêt cardio-circulatoire constaté au bloc : suspension de l'acte, massage cardiaque externe immédiat (100 à 120 compressions par minute), ventilation au ballon sur oxygène pur, adrénaline 1 mg IV renouvelée toutes les 3 à 5 minutes, ${SURGERY_RESUS[manner]}. Réanimation poursuivie environ 30 minutes, sans retour d'une activité circulatoire spontanée : décès constaté par le chirurgien principal${time ? ` à ${time}` : ''}.`;
    return {
        manner,
        cause: `${opening} ${reason}`,
        resuscitation,
        complication: reason,
        failure: `Intervention interrompue avant son terme par le décès du patient : l'objectif thérapeutique n'a pas pu être atteint.`,
        summary: `Interruption de l'intervention${time ? ` à ${time}` : ''} : ${lower(trimDot(reason))}. Suspension de l'acte, réanimation engagée sur table, décès constaté ; le corps est confié au service désigné et le décès est déclaré au DMEC.`,
    };
};

// ───────────── Urgences : décès pendant la prise en charge ─────────────
const tagsOf = (ids) => new Set(ids.flatMap((id) => CONDITION_BY_ID[id].tags || []));

const emergencyEvolution = (ids, tags) => {
    if (ids.some((id) => INTOXICATION.includes(id))) return "Dépression respiratoire puis arrêt cardio-respiratoire sur intoxication, malgré l'antidote, la ventilation et la surveillance continue";
    if (tags.has('anaphylaxie')) return 'Choc anaphylactique réfractaire : collapsus, bronchospasme puis arrêt cardio-respiratoire malgré les adrénalines répétées';
    if (tags.has('sca')) return "Arrêt cardiaque réfractaire sur syndrome coronarien aigu, malgré la défibrillation et le traitement antiarythmique";
    if (tags.has('hemorragie') || tags.has('choc')) return "Choc hémorragique réfractaire malgré le remplissage vasculaire et l'hémostase, évoluant vers un arrêt cardio-respiratoire";
    if (ids.includes('noyade')) return 'Hypoxie prolongée après submersion, évoluant vers un arrêt cardio-respiratoire réfractaire';
    if (tags.has('traumatisme_cranien') || tags.has('coma') || tags.has('avc') || tags.has('convulsions')) return 'Atteinte cérébrale irréversible (coma profond), évoluant vers un arrêt cardio-respiratoire';
    return 'Défaillance cardio-respiratoire progressive, évoluant vers un arrêt cardio-respiratoire réfractaire malgré la prise en charge';
};

const emergencySpecific = (ids, tags) => {
    if (ids.some((id) => INTOXICATION.includes(id))) return "naloxone ou antidote adapté, ventilation prolongée";
    if (tags.has('anaphylaxie')) return 'adrénaline IM puis IV, remplissage vasculaire massif et corticoïdes';
    if (tags.has('hemorragie') || tags.has('choc')) return 'remplissage vasculaire massif, hémostase et transfusion';
    if (ids.includes('noyade') || ids.includes('hypothermie')) return 'ventilation prolongée et réchauffement actif';
    return 'défibrillation (choc électrique) si rythme choquable et amiodarone 300 mg';
};

/**
 * Valeurs proposées pour le décès : { careDeathTime, careDeathCause, careDeathManner, careDeathResuscitation, careDeathResuscitationNote, careDeathFamily, careDeathBody } (champs vides omis).
 * kind : 'emergency' (protocole d'urgence) | 'surgery' (opération). now : heure « HH:MM » connue au clic.
 */
export const buildDeathSuggestion = ({ kind = 'emergency', formData = {}, now = '' } = {}) => {
    const surgery = kind === 'surgery';
    // Un contact d'urgence connu (dossier du patient) : la famille est à prévenir.
    const hasContact = [formData.patientEmergencyContact, formData.patientEmergencyContactFirstName, formData.patientEmergencyContactLastName, formData.patientEmergencyContactNumber].some((v) => String(v || '').trim() !== '');
    let cause = '';
    let manner = 'Undetermined';
    let time = '';
    let note = '';
    if (surgery) {
        const bundle = surgeryDeathBundle({ formData, now });
        cause = bundle.cause;
        manner = bundle.manner;
        note = bundle.resuscitation;
        time = frTime(now);
    } else {
        const ids = Array.isArray(formData.clinicalConditions) ? formData.clinicalConditions.filter((id) => CONDITION_BY_ID[id]) : [];
        const tags = tagsOf(ids);
        const labels = ids.map((id) => CONDITION_BY_ID[id].label);
        const mechanism = String(formData.patientInjuryMechanism || '').trim();
        manner = deathMannerOf(ids);
        time = frTime(formData.careEndTime) || frTime(now);
        const arrival = frTime(formData.arrivalTime) || frTime(formData.careStartTime);
        const minutes = minutesBetween(formData.careStartTime, formData.careEndTime);
        const when = `Décès constaté${time ? ` à ${time}` : ''}${arrival ? `, après une arrivée à ${arrival}` : ''}${minutes ? ` (prise en charge de ${minutes} minutes)` : ''}.`;
        if (labels.length) {
            cause = `${when} Prise en charge pour : ${lower(labels.join(', '))}${mechanism ? ` (${lower(trimDot(mechanism))})` : ''}. ${emergencyEvolution(ids, tags)}.`;
        } else if (String(formData.patientDiagnosis || '').trim()) {
            cause = `${when} Décès dans les suites de : ${lower(trimDot(formData.patientDiagnosis))}.`;
        }
        const duration = minutes ? `Réanimation poursuivie pendant ${minutes} minutes (de ${formData.careStartTime} à ${formData.careEndTime})` : 'Réanimation poursuivie environ 30 minutes';
        note = `Arrêt cardio-respiratoire : massage cardiaque externe immédiat (100 à 120 compressions par minute), ventilation au ballon sur oxygène pur, voie veineuse ou intra-osseuse, adrénaline 1 mg renouvelée toutes les 3 à 5 minutes, ${emergencySpecific(ids, tags)}. ${duration}, sans retour d'une activité circulatoire spontanée : arrêt de la réanimation et décès constaté${time ? ` à ${time}` : ''}.`;
    }
    const suggestion = {
        careDeathTime: time, careDeathCause: cause, careDeathManner: manner, careDeathResuscitation: 'Attempted', careDeathResuscitationNote: note,
        careDeathFamily: hasContact ? 'ToInform' : 'NoContact',
        careDeathBody: surgery || manner !== 'Natural' ? 'Coroner' : 'Morgue',
    };
    return Object.fromEntries(Object.entries(suggestion).filter(([, value]) => String(value || '').trim() !== ''));
};
