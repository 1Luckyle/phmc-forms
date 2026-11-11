// src/utils/medicalCertificates.js
//
// Certificats et courriels médicaux envoyés HORS du site (formulaire 35, « Certificat de Maladie ») : les différents types, les champs qu'ils demandent, leur texte et leur contrôle.
// Un certificat part chez un tiers (employeur, école, assurance…) : il ne contient jamais de diagnostic détaillé (voir utils/employerSummary.js pour le résumé d'un rapport joint).
// Module pur (testé dans medicalCertificates.test.js).

// Les valeurs `Sickness Note` et `Illness Confirmation` sont celles des anciens courriels : ils restent lisibles et modifiables.
export const CERTIFICATE_TYPES = {
    'Sickness Note': {
        label: 'Certificat médical (repos / maladie)', fields: ['period', 'reason'],
        hint: "Atteste qu'un repos est médicalement justifié, sur une période. Pour un arrêt de travail avec incapacité (ITT), choisissez « Arrêt de travail ».",
    },
    'Work Stoppage': {
        label: 'Arrêt de travail (avec ITT)', fields: ['period', 'itt', 'exit', 'reason'],
        hint: "Arrêt de travail avec durée d'incapacité totale de travail (ITT) calculée sur la période, et autorisation ou non de sortir.",
    },
    'Work Extension': {
        label: "Prolongation d'arrêt de travail", fields: ['previousEnd', 'period', 'itt', 'exit', 'reason'],
        hint: "Prolonge un arrêt précédent : indiquez sa date de fin, puis la nouvelle période.",
    },
    'Return To Work': {
        label: 'Certificat de reprise du travail', fields: ['returnDate', 'restrictions'],
        hint: "Atteste que la personne peut reprendre le travail à une date donnée, avec ou sans aménagement.",
    },
    Attendance: {
        label: 'Certificat de présence / de consultation', fields: ['attendanceTimes'],
        hint: "Atteste que la personne a été reçue au PHMC à la date de consultation (justificatif d'absence ponctuelle).",
    },
    'Illness Confirmation': {
        label: 'Confirmation de maladie', fields: ['condition', 'purpose'],
        hint: "Confirme une condition médicale pour un usage précis (dossier d'emploi, assurance…).",
    },
    Fitness: {
        label: "Certificat d'aptitude (sport, activité)", fields: ['activity', 'fitness'],
        hint: "Atteste l'aptitude ou l'inaptitude à une activité précise (sport, formation, stage…). Pour le vol, utilisez le « Certificat de Vol ».",
    },
};
export const CERTIFICATE_TYPE_LIST = Object.entries(CERTIFICATE_TYPES).map(([value, info]) => ({ value, ...info }));

export const EXIT_OPTIONS = ['Sorties autorisées', 'Sorties autorisées avec restrictions', 'Sorties interdites'];
export const FITNESS_OPTIONS = ['Apte', 'Apte avec restrictions', 'Inapte'];

export const certificateType = (value) => CERTIFICATE_TYPES[value] || null;
export const needsField = (type, field) => !!(CERTIFICATE_TYPES[type] && CERTIFICATE_TYPES[type].fields.includes(field));

const isIso = (value) => /^\d{4}-\d{2}-\d{2}/.test(String(value || ''));
const toDate = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`);
export const frDate = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};
export const frLongDate = (value) => (isIso(value) ? toDate(value).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '');

// Durée en jours, bornes comprises (du 10 au 12 : 3 jours) ; null si une date manque ou si la fin précède le début.
export const inclusiveDays = (start, end) => {
    if (!isIso(start) || !isIso(end)) return null;
    const days = Math.round((toDate(end) - toDate(start)) / 86400000) + 1;
    return days >= 1 ? days : null;
};
export const ittLabel = (days) => (days ? `${days} jour${days > 1 ? 's' : ''}` : '');

// Contrôle avant enregistrement (en plus des champs obligatoires communs : patient, date de consultation, employé). → liste de problèmes.
export const validateMedicalCertificate = (data = {}) => {
    const f = data || {};
    const problems = [];
    const type = certificateType(f.emailPurpose);
    if (!type) { problems.push("Choisissez le type de courrier (certificat de maladie, arrêt de travail, reprise…)."); return problems; }
    if (!String(f.emailRecipient || '').trim()) problems.push('Indiquez le destinataire (employeur, école, assurance…).');
    const has = (field) => needsField(f.emailPurpose, field);
    if (has('period')) {
        if (!f.sicknessStartDate) problems.push('Indiquez la date de début.');
        if (!f.sicknessEndDate) problems.push('Indiquez la date de fin.');
        if (f.sicknessStartDate && f.sicknessEndDate && inclusiveDays(f.sicknessStartDate, f.sicknessEndDate) === null) problems.push('La date de fin ne peut pas précéder la date de début.');
    }
    if (has('previousEnd') && !f.previousEndDate) problems.push("Indiquez la date de fin de l'arrêt précédent.");
    if (has('previousEnd') && f.previousEndDate && f.sicknessStartDate && String(f.sicknessStartDate) < String(f.previousEndDate)) problems.push("La prolongation doit commencer à partir de la fin de l'arrêt précédent.");
    if (has('exit') && !f.certificateExit) problems.push('Précisez si les sorties sont autorisées.');
    if (has('exit') && f.certificateExit === 'Sorties autorisées avec restrictions' && !String(f.certificateRestrictions || '').trim()) problems.push('Précisez les restrictions de sortie.');
    if (has('returnDate') && !f.returnDate) problems.push('Indiquez la date de reprise du travail.');
    if (has('condition') && !String(f.illnessCondition || '').trim()) problems.push('Indiquez la condition médicale confirmée.');
    if (has('activity') && !String(f.fitnessActivity || '').trim()) problems.push("Indiquez l'activité concernée.");
    if (has('fitness') && !f.fitnessConclusion) problems.push('Choisissez la conclusion (apte, apte avec restrictions, inapte).');
    if (has('fitness') && f.fitnessConclusion === 'Apte avec restrictions' && !String(f.certificateRestrictions || '').trim()) problems.push('Précisez les restrictions.');
    return problems;
};

// Titre du courrier (objet) et paragraphes du texte, selon le type. `f` : données du formulaire.
export const buildCertificateContent = (f = {}) => {
    const patient = String(f.patientName || '').trim() || 'le patient';
    const patientTitleCase = String(f.patientName || '').trim() || 'Patient';
    const visit = frLongDate(f.dateOfVisit);
    const start = frLongDate(f.sicknessStartDate);
    const end = frLongDate(f.sicknessEndDate);
    const days = inclusiveDays(f.sicknessStartDate, f.sicknessEndDate);
    const seen = visit ? `a été vu(e) au Pillbox Hill Medical Center le ${visit}` : 'a été vu(e) au Pillbox Hill Medical Center';
    const reason = String(f.reasonForSickness || '').trim();
    const restrictions = String(f.certificateRestrictions || '').trim();
    const greeting = `Cher(ère) ${String(f.emailRecipient || '').trim() || 'Destinataire'},`;
    const contact = "N'hésitez pas à nous contacter si vous avez besoin d'informations supplémentaires.";
    const exitLine = f.certificateExit ? `${f.certificateExit}${f.certificateExit === 'Sorties autorisées avec restrictions' && restrictions ? ` : ${restrictions}` : ''}.` : '';

    switch (f.emailPurpose) {
    case 'Sickness Note':
        return {
            subject: `Certificat médical de repos : ${patientTitleCase}`,
            paragraphs: [
                greeting,
                `Ce courriel sert de certificat médical pour ${patient} du ${start || 'N/A'} au ${end || 'N/A'}${days ? ` (${ittLabel(days)})` : ''}.`,
                `${patient} ${seen} et a reçu conseil de se reposer${reason ? ` en raison de ${reason}` : ' pour des raisons médicales'}.`,
                `Nous anticipons que ${patient === 'le patient' ? 'il/elle' : patient} pourra reprendre ses activités normales après la période spécifiée.`,
                contact,
            ],
            rows: [['Période de repos', `du ${frDate(f.sicknessStartDate) || 'N/A'} au ${frDate(f.sicknessEndDate) || 'N/A'}`]],
        };
    case 'Work Stoppage':
        return {
            subject: `Arrêt de travail : ${patientTitleCase}`,
            paragraphs: [
                greeting,
                `Je certifie que l'état de santé de ${patient}, ${seen}, justifie un arrêt de travail du ${start || 'N/A'} au ${end || 'N/A'} inclus, soit une incapacité totale de travail (ITT) de ${ittLabel(days) || 'N/A'}.`,
                exitLine ? `Sorties : ${exitLine}` : '',
                reason ? `Motif (général) : ${reason}.` : '',
                "Cet arrêt est délivré sous réserve d'une éventuelle prolongation, qui ferait l'objet d'un nouveau certificat.",
                contact,
            ].filter(Boolean),
            rows: [['Arrêt de travail', `du ${frDate(f.sicknessStartDate) || 'N/A'} au ${frDate(f.sicknessEndDate) || 'N/A'}`], ['ITT', ittLabel(days) || 'N/A'], ...(f.certificateExit ? [['Sorties', f.certificateExit]] : [])],
        };
    case 'Work Extension':
        return {
            subject: `Prolongation d'arrêt de travail : ${patientTitleCase}`,
            paragraphs: [
                greeting,
                `Faisant suite à l'arrêt de travail de ${patient} qui prenait fin le ${frLongDate(f.previousEndDate) || 'N/A'}, son état de santé justifie une prolongation du ${start || 'N/A'} au ${end || 'N/A'} inclus, soit ${ittLabel(days) || 'N/A'} supplémentaire(s).`,
                exitLine ? `Sorties : ${exitLine}` : '',
                reason ? `Motif (général) : ${reason}.` : '',
                contact,
            ].filter(Boolean),
            rows: [['Arrêt précédent jusqu\'au', frDate(f.previousEndDate) || 'N/A'], ['Prolongation', `du ${frDate(f.sicknessStartDate) || 'N/A'} au ${frDate(f.sicknessEndDate) || 'N/A'}`], ['ITT supplémentaire', ittLabel(days) || 'N/A']],
        };
    case 'Return To Work':
        return {
            subject: `Certificat de reprise du travail : ${patientTitleCase}`,
            paragraphs: [
                greeting,
                `Je certifie que l'état de santé de ${patient}, ${seen}, permet la reprise du travail à compter du ${frLongDate(f.returnDate) || 'N/A'}.`,
                restrictions ? `Aménagements recommandés : ${restrictions}.` : 'Aucun aménagement particulier n\'est recommandé.',
                contact,
            ],
            rows: [['Reprise du travail le', frDate(f.returnDate) || 'N/A']],
        };
    case 'Attendance':
        return {
            subject: `Certificat de présence : ${patientTitleCase}`,
            paragraphs: [
                greeting,
                `Je certifie que ${patient} a été reçu(e) en consultation au Pillbox Hill Medical Center le ${visit || 'N/A'}${f.attendanceFrom ? `, de ${f.attendanceFrom}${f.attendanceTo ? ` à ${f.attendanceTo}` : ''}` : ''}.`,
                "Ce certificat justifie l'absence de la personne pendant ce créneau ; il ne contient aucune information médicale.",
                contact,
            ],
            rows: [['Consultation', `${frDate(f.dateOfVisit) || 'N/A'}${f.attendanceFrom ? ` — ${f.attendanceFrom}${f.attendanceTo ? ` à ${f.attendanceTo}` : ''}` : ''}`]],
        };
    case 'Illness Confirmation':
        return {
            subject: `Confirmation de maladie : ${patientTitleCase}`,
            paragraphs: [
                greeting,
                `Ce courriel confirme que ${patient} ${seen}.`,
                `${patient === 'le patient' ? 'Le patient' : patient} a été diagnostiqué(e) avec ${String(f.illnessCondition || '').trim() || 'une condition médicale'}. Cette confirmation est fournie pour ${String(f.confirmationPurpose || '').trim() || 'ses dossiers'}.`,
                contact,
            ],
            rows: [],
        };
    case 'Fitness':
        return {
            subject: `Certificat d'aptitude : ${patientTitleCase}`,
            paragraphs: [
                greeting,
                `Je certifie avoir examiné ${patient} le ${visit || 'N/A'} afin d'évaluer son aptitude à l'activité suivante : ${String(f.fitnessActivity || '').trim() || 'N/A'}.`,
                `Conclusion : ${f.fitnessConclusion || 'N/A'}${f.fitnessConclusion === 'Apte avec restrictions' && restrictions ? ` (${restrictions})` : ''}.`,
                "Ce certificat atteste uniquement de l'aptitude à l'activité indiquée : il ne contient aucun diagnostic ni donnée médicale détaillée.",
                contact,
            ],
            rows: [['Activité', String(f.fitnessActivity || '').trim() || 'N/A'], ['Conclusion', f.fitnessConclusion || 'N/A']],
        };
    default:
        return { subject: 'Courriel PHMC : type manquant', paragraphs: ['Veuillez sélectionner le type de courrier (certificat de maladie, arrêt de travail, reprise du travail…).'], rows: [] };
    }
};
