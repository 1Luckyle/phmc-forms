// src/clinical/death.js
//
// Aide de l'assistant (Pilou) quand le patient est décédé pendant la prise en charge : propose l'heure, la cause, les circonstances, la réanimation, la famille et la destination du corps à partir
// de ce que le formulaire sait déjà (motifs de prise en charge et gravité aux urgences, interventions à l'opération). Rien n'est écrit sans clic ; le soignant relit et corrige.
import { CONDITION_BY_ID } from './conditions';
import { PROCEDURE_BY_ID } from './procedures';

const VIOLENT = ['plaie_arme_feu', 'plaie_arme_blanche'];
const INTOXICATION = ['surdose_opioides', 'surdose_benzo', 'surdose_stimulants', 'intox_alcool', 'intox_paracetamol', 'intox_fumees'];
const ACCIDENT = ['noyade', 'brulure', 'polytraumatisme', 'trauma_cranien', 'trauma_thoracique', 'trauma_abdominal', 'fracture_ouverte', 'fracture_fermee', 'plaie_profonde', 'hemorragie_externe', 'coup_chaleur', 'hypothermie'];

/** Circonstances probables d'après les motifs ; 'Undetermined' quand rien ne permet de trancher. */
export const deathMannerOf = (conditionIds = []) => {
    const ids = (Array.isArray(conditionIds) ? conditionIds : []).filter((id) => CONDITION_BY_ID[id]);
    if (!ids.length) return 'Undetermined';
    if (ids.some((id) => VIOLENT.includes(id))) return 'Violent';
    if (ids.some((id) => INTOXICATION.includes(id))) return 'Intoxication';
    if (ids.some((id) => ACCIDENT.includes(id))) return 'Accidental';
    return ids.every((id) => !['TRAUMA', 'Traumatologie', 'Intoxications'].includes(CONDITION_BY_ID[id].group)) ? 'Natural' : 'Undetermined';
};

const lower = (text) => String(text || '').charAt(0).toLowerCase() + String(text || '').slice(1);
const frTime = (value) => /^\d{1,2}:\d{2}$/.test(String(value || '')) ? String(value) : '';

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
        const procedures = (Array.isArray(formData.surgeryProcedureIds) ? formData.surgeryProcedureIds : []).map((id) => PROCEDURE_BY_ID[id]).filter(Boolean);
        const names = procedures.length ? procedures.map((p) => p.label).join(', ') : String(formData.surgeryProcedures || '').trim();
        cause = names ? `Décès survenu au cours de l'intervention (${lower(names)}).` : "Décès survenu au cours de l'intervention.";
        manner = 'Undetermined';
        time = frTime(now);
        note = "Arrêt cardio-circulatoire pendant l'intervention : massage cardiaque et réanimation engagés, médicaments de réanimation administrés, aucun retour à une activité circulatoire spontanée. Décès constaté par le chirurgien.";
    } else {
        const ids = Array.isArray(formData.clinicalConditions) ? formData.clinicalConditions.filter((id) => CONDITION_BY_ID[id]) : [];
        const labels = ids.map((id) => CONDITION_BY_ID[id].label);
        const mechanism = String(formData.patientInjuryMechanism || '').trim();
        cause = labels.length ? `Décès consécutif à : ${lower(labels.join(', '))}${mechanism ? ` (${lower(mechanism).replace(/\.$/, '')})` : ''}.` : (String(formData.patientDiagnosis || '').trim() ? `Décès dans les suites de : ${lower(String(formData.patientDiagnosis).trim().replace(/\.$/, ''))}.` : '');
        manner = deathMannerOf(ids);
        time = frTime(formData.careEndTime) || frTime(now);
        note = 'Massage cardiaque et ventilation au ballon engagés, voie veineuse posée et adrénaline administrée selon le protocole, sans retour à une activité circulatoire spontanée. Arrêt de la réanimation et décès constaté.';
    }
    const body = manner === 'Natural' ? 'Morgue' : 'Coroner';
    const suggestion = {
        careDeathTime: time, careDeathCause: cause, careDeathManner: manner, careDeathResuscitation: 'Attempted', careDeathResuscitationNote: note,
        careDeathFamily: hasContact ? 'ToInform' : 'NoContact', careDeathBody: body,
    };
    return Object.fromEntries(Object.entries(suggestion).filter(([, value]) => String(value || '').trim() !== ''));
};
