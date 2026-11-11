// src/utils/careVisitSummary.js
//
// Historique des SOINS dans le dossier médical du patient : un passage aux urgences, une consultation ou une opération laisse un RÉSUMÉ dans son dossier.
// Le résumé est rangé sur l'entrée d'index du rapport (patientRecords/{ID patient}/{clé}/resume), à chaque enregistrement ; le dossier le LIT depuis l'index. Conséquence voulue : corriger
// le rapport met le résumé à jour, et supprimer le rapport (ou le retirer) le fait disparaître du dossier, sans aucune autre opération (l'entrée d'index disparaît avec lui).
// Les formulaires de santé mentale n'en font pas partie : leur contenu reste confidentiel.
import { DISCHARGE_DESTINATIONS, ORIENTED_SERVICES, DEATH_VERSIONS, labelOf } from '../constants/careFormOptions';
import { MEDICATION_BY_ID } from '../clinical/medications';

export const CARE_VISIT_VERSIONS = [5, 19, 20, 21];
export const CARE_VISIT_LABELS = { 5: 'Opération chirurgicale', 19: "Protocole d'urgence", 20: 'Consultation générale', 21: 'Consultation générale' };
// Intitulés des lignes du résumé, dans l'ordre d'affichage.
export const CARE_VISIT_FIELDS = [
    ['deces', 'Décès'], ['intervention', 'Intervention'], ['indication', 'Indication'], ['anesthesie', 'Anesthésie'], ['motif', 'Motif'], ['diagnostic', 'Diagnostic'], ['soins', 'Soins'],
    ['complications', 'Complications'], ['resultat', 'Résultat'], ['traitement', 'Traitement'], ['sortie', 'Orientation'],
];

const ANESTHESIA = { General: 'générale', Regional: 'locorégionale', Local: 'locale', Sedation: 'sédation', None: 'aucune' };
const clean = (value, max = 240) => String(value ?? '').replace(/\[|\]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

const medicationNames = (f) => {
    // Patient décédé : seuls les médicaments administrés comptent (pas d'ordonnance).
    const names = (Array.isArray(f.clinicalMeds) ? f.clinicalMeds : []).filter((entry) => !(f.careDeceased === 'Yes' && entry && entry.prescribed)).map((entry) => MEDICATION_BY_ID[entry && entry.medId]?.name).filter(Boolean);
    return [...new Set(names)].slice(0, 8).join(', ');
};

/** Résumé d'un rapport de soins : { date, motif?, diagnostic?, … } sans valeurs vides ; null pour un formulaire qui n'a pas de résumé. */
export const careVisitSummary = (version, formData = {}) => {
    const number = Number(version);
    if (!CARE_VISIT_VERSIONS.includes(number)) return null;
    const f = formData;
    const diagnosis = [clean(f.patientDiagnosis), /^(aucun|aucune|n\/a)$/i.test(clean(f.patientSecondaryDiagnosis)) ? '' : clean(f.patientSecondaryDiagnosis)].filter(Boolean).join(' ; ');
    let fields;
    if (number === 5) {
        fields = {
            intervention: clean(f.surgeryProcedures),
            indication: clean(f.surgeryPreOpDiagnosis),
            anesthesie: ANESTHESIA[f.surgeryAnesthesiaType] || '',
            complications: f.patientComplicationOptions === 'Yes' ? clean(f.patientComplicationsYes) || 'Oui' : (f.patientComplicationOptions === 'No' ? 'Aucune' : ''),
            resultat: f.procedureGoodOptions === 'Yes' ? 'Procédure réussie' : (f.procedureGoodOptions === 'No' ? clean(f.procedureGoodNo) || 'Procédure non aboutie' : ''),
        };
    } else if (number === 19) {
        fields = {
            motif: clean(f.patientChiefComplaint),
            diagnostic: diagnosis,
            soins: clean(f.patientProcedure, 300),
            traitement: medicationNames(f),
            sortie: [labelOf(DISCHARGE_DESTINATIONS, f.dischargeDestination), f.dischargeDestination === 'Transfer' ? clean(f.transferTo, 80) : ''].filter(Boolean).join(' : '),
        };
    } else {
        fields = {
            motif: clean(f.patientChiefComplaint),
            diagnostic: diagnosis,
            soins: clean(f.patientProcedure, 300),
            traitement: medicationNames(f),
            sortie: labelOf(ORIENTED_SERVICES, f.orientedService),
        };
    }
    if (DEATH_VERSIONS.includes(number) && f.careDeceased === 'Yes') {
        const time = /^\d{1,2}:\d{2}$/.test(String(f.careDeathTime || '')) ? `à ${f.careDeathTime}` : '';
        fields.deces = [`Patient décédé${time ? ` ${time}` : ''}`, clean(f.careDeathCause, 160)].filter(Boolean).join(' : ');
    }
    const date = /^\d{4}-\d{2}-\d{2}/.test(String(f.date || '')) ? String(f.date).slice(0, 10) : '';
    const resume = { ...(date ? { date } : {}) };
    Object.entries(fields).forEach(([key, value]) => { if (value) resume[key] = value; });
    return resume;
};

/** Passages à afficher dans le dossier : entrées d'index (patientRecords/{ID}) de rapports de soins ENCORE présents (ni copie, ni retiré), du plus récent au plus ancien. */
export const careVisitsFromIndex = (entriesByKey = {}) => Object.entries(entriesByKey)
    .filter(([, entry]) => entry && entry.reportPath && !entry.copiedFrom && !entry.ownerDeleted && CARE_VISIT_VERSIONS.includes(Number(entry.bbCodeVersion)))
    .map(([key, entry]) => ({
        key, version: Number(entry.bbCodeVersion), timestamp: Number(entry.timestamp) || 0, author: entry.creatorName || entry.authorName || '',
        date: (entry.resume && entry.resume.date) || (Number(entry.timestamp) ? new Date(Number(entry.timestamp)).toISOString().slice(0, 10) : ''), resume: entry.resume || null,
    }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.timestamp - a.timestamp);
