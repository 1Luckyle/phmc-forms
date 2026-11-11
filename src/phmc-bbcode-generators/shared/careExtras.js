// src/phmc-bbcode-generators/shared/careExtras.js
//
// BBCode des champs ajoutés aux formulaires du personnel soignant (voir constants/careFormOptions.js) : un seul endroit, utilisé par les générateurs PHMC et PBC. Chaque bloc retourne une chaîne
// vide si rien n'est renseigné (un ancien rapport s'imprime exactement comme avant).
import { sectionBanner, BB_COLORS } from './bbStyles';
import {
    labelOf, SURGERY_CHARACTERS, ASA_CLASSES, POST_OP_MONITORING, EVAL_REASONS, VACCINATION_STATES, RISK_LEVELS, RISK_ACTIONS, INVOLUNTARY_HOLDS,
    DISCHARGE_DESTINATIONS, ROUTINE_CARE, ORIENTED_SERVICES, EXAMS_ORDERED, REFERRAL_REASONS, ARRIVAL_MODES, DEATH_MANNERS, DEATH_RESUSCITATION, DEATH_FAMILY, DEATH_BODY,
} from '../../constants/careFormOptions';
import { minutesBetween, durationLabel, aptitudeValidUntil } from '../../utils/careFormRules';
import { CONDITION_BY_ID } from '../../clinical/conditions';
import { severityOf } from '../../clinical/vitals';
import { parseWeightKg, parseHeightCm } from '../../clinical/engine';
import { clinicalMedLines, prescriptionLines } from '../../clinical/apply';

const filled = (value) => (Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '');
const text = (value) => String(value ?? '').trim();
const frDate = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};
const accentOf = (blue) => (blue ? { accent: BB_COLORS.blue } : {});
const multiLabels = (options, values) => (Array.isArray(values) ? values : []).map((value) => labelOf(options, value)).filter(Boolean).join(', ');
// Une ligne « [u]Libellé: [/u] valeur » (ignorée si la valeur est vide).
const line = (label, value) => (filled(value) ? `[u]${label}: [/u] ${value}` : '');
const joinLines = (lines) => lines.filter(Boolean).join('\n[br][/br]');

export { ARRIVAL_MODES };
export const arrivalModeLabel = (value) => labelOf(ARRIVAL_MODES, value);

// ── Commun : heure, adressage, médecin adressant, accompagnant (dans la section « Contexte patient ») ──
export const referralLinesBBCode = (f) => {
    const reason = f.referralReason === 'Other' && filled(f.referralOther) ? `Autre : ${text(f.referralOther)}` : labelOf(REFERRAL_REASONS, f.referralReason);
    const companion = [text(f.companionName), filled(f.companionRelation) ? `(${text(f.companionRelation)})` : ''].filter(Boolean).join(' ');
    return joinLines([
        line('Heure du rendez-vous', f.appointmentTime),
        line("Motif d'adressage", reason),
        line('Médecin adressant', text(f.referringDoctor)),
        line('Accompagnant', companion),
    ]);
};

// Allergies, antécédents ou traitements modifiés par le soignant par rapport au dossier.
export const backgroundUpdatedBBCode = (f) => {
    const labels = (Array.isArray(f.patientBackgroundUpdated) ? f.patientBackgroundUpdated : []).filter(Boolean);
    return labels.length ? `[i]Mis à jour lors de cette consultation : ${labels.join(', ')}.[/i]` : '';
};

// ── Opération chirurgicale ──
export const surgeryRowsBBCode = (f) => {
    const rows = [];
    const weight = parseWeightKg(f.patientWeight);
    const height = parseHeightCm(f.patientHeight);
    if (weight || height) rows.push(`[tr][td]Poids / taille du patient[/td][td]
${[weight ? `${weight} kg` : '', height ? `${height} cm` : ''].filter(Boolean).join(' / ')}
[/td][/tr]`);
    if (filled(f.surgeryCharacter)) rows.push(`[tr][td]Caractère de l'intervention[/td][td]\n${labelOf(SURGERY_CHARACTERS, f.surgeryCharacter)}\n[/td][/tr]`);
    if (filled(f.surgeryAsa)) rows.push(`[tr][td]Classification ASA (risque anesthésique)[/td][td]\n${labelOf(ASA_CLASSES, f.surgeryAsa)}\n[/td][/tr]`);
    return rows.length ? `\n${rows.join('\n')}\n` : '';
};
export const postOpBBCode = (f, blue = false) => {
    const medLines = clinicalMedLines(f);
    const rxLines = prescriptionLines(f);
    if (!filled(f.postOpMonitoring) && !filled(f.postOpExams) && !medLines.length && !rxLines.length) return '';
    const rows = [
        medLines.length ? `[tr][td]Médicaments post-opératoires[/td][td]\n${medLines.map((l) => `• ${l}`).join('\n[br][/br]')}\n[/td][/tr]` : '',
        rxLines.length ? `[tr][td]Ordonnance${filled(f.phmcEmployee) ? ` (prescrite par ${text(f.phmcEmployee)})` : ''}[/td][td]\n${rxLines.map((l) => `• ${l}`).join('\n[br][/br]')}\n[/td][/tr]` : '',
        filled(f.postOpMonitoring) ? `[tr][td]Lieu de surveillance[/td][td]\n${labelOf(POST_OP_MONITORING, f.postOpMonitoring)}\n[/td][/tr]` : '',
        filled(f.postOpExams) ? `[tr][td]Examens post-opératoires[/td][td]\n${text(f.postOpExams)}\n[/td][/tr]` : '',
    ].filter(Boolean).join('\n');
    return `${sectionBanner('Surveillance post-opératoire', accentOf(blue))}\n[table]\n${rows}\n[/table]\n`;
};

// ── Évaluation physique : conclusion d'aptitude ──
export const aptitudeBBCode = (f, blue = false) => {
    if (!filled(f.aptitudeConclusion) && !filled(f.evalReason) && !filled(f.visualAcuity) && !filled(f.hearingValue) && !filled(f.vaccinationState)) return '';
    const conclusion = text(f.aptitudeConclusion);
    const color = conclusion === 'Apte' ? '#008000' : conclusion === 'Inapte' ? '#FF0000' : '#FF8000';
    const until = aptitudeValidUntil(f);
    const rows = [
        filled(f.evalReason) ? `[tr][td]Motif de l'évaluation[/td][td]${labelOf(EVAL_REASONS, f.evalReason)}[/td][/tr]` : '',
        conclusion ? `[tr][td]Conclusion d'aptitude[/td][td][color=${color}][b]${conclusion.toUpperCase()}[/b][/color]${conclusion === 'Apte avec restrictions' && filled(f.aptitudeRestrictions) ? `\n[br][/br][i]Restrictions :[/i] ${text(f.aptitudeRestrictions)}` : ''}[/td][/tr]` : '',
        conclusion && conclusion !== 'Inapte' && until ? `[tr][td]Valable jusqu'au[/td][td]${frDate(until)} (${Number(f.aptitudeValidityMonths) || 12} mois)[/td][/tr]` : '',
        filled(f.visualAcuity) ? `[tr][td]Acuité visuelle[/td][td]${text(f.visualAcuity)}[/td][/tr]` : '',
        filled(f.hearingValue) ? `[tr][td]Audition[/td][td]${text(f.hearingValue)}[/td][/tr]` : '',
        filled(f.vaccinationState) ? `[tr][td]Vaccinations[/td][td]${labelOf(VACCINATION_STATES, f.vaccinationState)}${f.vaccinationState === 'No' && filled(f.vaccinationNote) ? ` : ${text(f.vaccinationNote)}` : ''}[/td][/tr]` : '',
    ].filter(Boolean).join('\n');
    return `${sectionBanner("Conclusion d'aptitude", accentOf(blue))}\n[table]\n${rows}\n[/table]\n`;
};

// ── Santé mentale : risque, conduite à tenir, hospitalisation sous contrainte ; contact d'urgence ──
export const riskBBCode = (f, blue = false) => {
    if (!filled(f.riskSuicide) && !filled(f.riskDanger) && !filled(f.riskAction) && !filled(f.involuntaryHold)) return '';
    const hold = filled(f.involuntaryHold) ? labelOf(INVOLUNTARY_HOLDS, f.involuntaryHold) : '';
    const rows = [
        filled(f.riskSuicide) ? `[tr][td]Risque suicidaire[/td][td]${labelOf(RISK_LEVELS, f.riskSuicide)}[/td][/tr]` : '',
        filled(f.riskDanger) ? `[tr][td]Dangerosité (pour autrui)[/td][td]${labelOf(RISK_LEVELS, f.riskDanger)}[/td][/tr]` : '',
        filled(f.riskAction) ? `[tr][td]Conduite à tenir[/td][td]${labelOf(RISK_ACTIONS, f.riskAction)}${filled(f.riskActionNote) ? `\n[br][/br]${text(f.riskActionNote)}` : ''}[/td][/tr]` : '',
        hold ? `[tr][td]Hospitalisation sous contrainte[/td][td]${hold}[/td][/tr]` : '',
    ].filter(Boolean).join('\n');
    return `${sectionBanner('Évaluation du risque et conduite à tenir', accentOf(blue))}\n[table]\n${rows}\n[/table]\n`;
};
export const emergencyContactBBCode = (f, blue = false) => {
    const name = [f.patientEmergencyContactFirstName, f.patientEmergencyContactMiddleName, f.patientEmergencyContactLastName].map(text).filter(Boolean).join(' ') || text(f.patientEmergencyContact);
    if (!name && !filled(f.patientEmergencyContactNumber)) return '';
    const rows = [
        name ? `[tr][td]Contact d'urgence[/td][td]${name}${filled(f.patientEmergencyContactRelation) ? ` (${text(f.patientEmergencyContactRelation)})` : ''}[/td][/tr]` : '',
        filled(f.patientEmergencyContactNumber) ? `[tr][td]Téléphone[/td][td]${text(f.patientEmergencyContactNumber)}[/td][/tr]` : '',
        filled(f.patientEmergencyContactDiscord) ? `[tr][td]Discord[/td][td](( ${text(f.patientEmergencyContactDiscord)} ))[/td][/tr]` : '',
    ].filter(Boolean).join('\n');
    return `${sectionBanner("Contact d'urgence", accentOf(blue))}\n[table]\n${rows}\n[/table]\n`;
};

// ── Protocole d'urgence (lignes à insérer dans la cellule « Thérapie ») ──
export const emergencyExtrasBBCode = (f) => {
    const minutes = minutesBetween(f.careStartTime, f.careEndTime);
    const destination = labelOf(DISCHARGE_DESTINATIONS, f.dischargeDestination) + (f.dischargeDestination === 'Transfer' && filled(f.transferTo) ? ` : ${text(f.transferTo)}` : '');
    const lines = joinLines([
        line('Soins systématiques réalisés', multiLabels(ROUTINE_CARE, f.routineCare)),
        line('Prise en charge', filled(f.careStartTime) || filled(f.careEndTime)
            ? `${filled(f.careStartTime) ? `de ${text(f.careStartTime)}` : ''}${filled(f.careEndTime) ? ` à ${text(f.careEndTime)}` : ''}${minutes !== null ? ` (${durationLabel(minutes)})` : ''}`.trim() : ''),
        line('Orientation de sortie', destination),
    ]);
    return lines ? `${lines}\n[br][/br]\n` : '';
};

// ── Consultation générale (lignes à insérer dans la cellule « Thérapie ») ──
export const consultExtrasBBCode = (f) => {
    const service = labelOf(ORIENTED_SERVICES, f.orientedService) + (f.orientedService === 'Other' && filled(f.orientedServiceOther) ? ` : ${text(f.orientedServiceOther)}` : '');
    const exams = [multiLabels(EXAMS_ORDERED, f.examsOrdered), filled(f.examsOrderedNote) ? text(f.examsOrderedNote) : ''].filter(Boolean).join(' : ');
    const stoppage = f.workStoppage === 'Yes' ? `Oui, ${Number(f.workStoppageDays) || '?'} jour(s)` : (f.workStoppage === 'No' ? 'Non' : '');
    const lines = joinLines([line('Service orienté après consultation', service), line('Examens complémentaires prescrits', exams), line('Arrêt de travail', stoppage)]);
    return lines ? `${lines}\n[br][/br]\n` : '';
};

// ── Protocole d'urgence : assistant clinique ──
// Motifs de prise en charge (avec la gravité) et poids / taille, dans l'anamnèse. Vide si rien n'est renseigné.
export const clinicalAnamnesisBBCode = (f) => {
    const labels = (Array.isArray(f.clinicalConditions) ? f.clinicalConditions : []).map((id) => CONDITION_BY_ID[id]?.label).filter(Boolean);
    const weight = parseWeightKg(f.patientWeight);
    const height = parseHeightCm(f.patientHeight);
    const body = [
        labels.length ? line('Motifs de prise en charge', `${labels.join(', ')} (gravité : ${severityOf(f.clinicalSeverity).label.toLowerCase()})`) : '',
        weight || height ? line('Poids / taille', [weight ? `${weight} kg` : '', height ? `${height} cm` : ''].filter(Boolean).join(' / ')) : '',
    ].filter(Boolean);
    return body.length ? `${body.join('\n[br][/br]')}\n[br][/br]\n` : '';
};
// Médicaments de la liste de l'assistant (dose, voie, prises), dans la thérapie.
export const clinicalMedsBBCode = (f) => {
    const lines = clinicalMedLines(f);
    const given = lines.length ? `[u]Médicaments administrés: [/u][br][/br]\n${lines.map((l) => `• ${l}`).join('\n[br][/br]')}\n[br][/br]\n` : '';
    return `${given}${prescriptionBBCode(f)}`;
};
// Ordonnance : les médicaments cochés « sur l'ordonnance » (dose, voie, prises, durée), avec le prescripteur.
export const prescriptionBBCode = (f) => {
    const lines = prescriptionLines(f);
    return lines.length ? `[u]Ordonnance${filled(f.phmcEmployee) ? ` (prescrite par ${text(f.phmcEmployee)})` : ''}: [/u][br][/br]\n${lines.map((l) => `• ${l}`).join('\n[br][/br]')}\n[br][/br]\n` : '';
};

// ── Décès du patient pendant la prise en charge (urgences, opération) ──
// Section placée à la fin du rapport de soins ; vide si le patient n'est pas décédé.
export const deathBBCode = (f, blue = false) => {
    if (f.careDeceased !== 'Yes') return '';
    const resuscitation = [labelOf(DEATH_RESUSCITATION, f.careDeathResuscitation), filled(f.careDeathResuscitationNote) ? text(f.careDeathResuscitationNote) : ''].filter(Boolean).join('\n[br][/br]');
    const rows = [
        filled(f.careDeathTime) ? `[tr][td]Heure du décès[/td][td]${text(f.careDeathTime)}[/td][/tr]` : '',
        filled(f.careDeathCause) ? `[tr][td]Cause et circonstances[/td][td]\n${text(f.careDeathCause)}\n[/td][/tr]` : '',
        filled(f.careDeathManner) ? `[tr][td]Nature du décès[/td][td]${labelOf(DEATH_MANNERS, f.careDeathManner)}[/td][/tr]` : '',
        resuscitation ? `[tr][td]Réanimation[/td][td]\n${resuscitation}\n[/td][/tr]` : '',
        filled(f.careDeathFamily) ? `[tr][td]Famille[/td][td]${labelOf(DEATH_FAMILY, f.careDeathFamily)}[/td][/tr]` : '',
        filled(f.careDeathBody) ? `[tr][td]Destination du corps[/td][td]${labelOf(DEATH_BODY, f.careDeathBody)}[/td][/tr]` : '',
    ].filter(Boolean).join('\n');
    return `${sectionBanner('Décès du patient', accentOf(blue))}\n[table]\n${rows || '[tr][td]Décès constaté[/td][td]Détails non renseignés[/td][/tr]'}\n[/table]\n`;
};
