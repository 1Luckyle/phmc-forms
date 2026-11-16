// src/utils/reportExpiries.js
//
// Échéances à surveiller après l'enregistrement d'un rapport : validité d'un certificat de vol (voir utils/flightCertificate.js), d'une évaluation d'aptitude, fin d'une ordonnance. Le serveur
// (tâche « rappels quotidiens », functions/index.js) prévient le patient par la cloche et par mail quand l'échéance approche, et le soignant par la cloche.
// Module PUR (reportExpiries) + écriture au mieux (registerExpiries) dans echeances/{id} : création seule, lue par le serveur et les admins (règles : database.rules.json).
import { ref, set } from 'firebase/database';
import { database, auth } from '../firebase';
import { canonicalPatientId } from './patientId';
import { validityMonthsFor, validUntil } from './flightCertificate';
import { addDaysIso } from '../clinical/engine';

export const EXPIRY_TYPES = ['certificat_vol', 'aptitude', 'ordonnance'];
// Préavis (jours) : un certificat se renouvelle plusieurs semaines à l'avance, une ordonnance se prolonge en quelques jours.
const LEAD_DAYS = { certificat_vol: 30, aptitude: 30, ordonnance: 3 };

const isoOf = (value) => (/^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '');
const endOfDayMs = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 20, 0, 0);
const addMonthsIso = (iso, months) => {
    const base = isoOf(iso);
    if (!base || !Number.isFinite(Number(months)) || Number(months) <= 0) return '';
    const date = new Date(Date.UTC(Number(base.slice(0, 4)), Number(base.slice(5, 7)) - 1 + Number(months), Number(base.slice(8, 10))));
    return date.toISOString().slice(0, 10);
};

/** → [{ type, finIso, finLe, delaiJours, titre }] : les échéances d'un rapport enregistré (vide si rien n'expire). */
export const reportExpiries = (version, formData = {}) => {
    const f = formData || {};
    const out = [];
    const patient = f.patientName || [f.patientFirstName, f.patientLastName].filter(Boolean).join(' ') || '';
    const reportDate = isoOf(f.date);
    const push = (type, finIso, titre) => { if (finIso) out.push({ type, finIso, finLe: endOfDayMs(finIso), delaiJours: LEAD_DAYS[type], titre }); };

    if (Number(version) === 41 && f.flightCertConclusion && f.flightCertConclusion !== 'Inapte') {
        const months = validityMonthsFor(f.flightCertClass, f.patientDateOfBirth, f.date);
        push('certificat_vol', isoOf(validUntil(f.date, months)), `Certificat de vol${patient ? ` — ${patient}` : ''}`);
    }
    if ([6, 7].includes(Number(version)) && f.aptitudeConclusion && f.aptitudeConclusion !== 'Inapte') {
        push('aptitude', addMonthsIso(reportDate, Number(f.aptitudeValidityMonths) || 12), `Évaluation d'aptitude${patient ? ` — ${patient}` : ''}`);
    }
    // Ordonnance : la dernière fin de traitement des lignes prescrites (jamais pour un patient décédé).
    if (f.careDeceased !== 'Yes' && Array.isArray(f.clinicalMeds)) {
        const ends = f.clinicalMeds.filter((entry) => entry && entry.prescribed && Math.floor(Number(entry.days)) > 0)
            .map((entry) => addDaysIso(isoOf(entry.startDate) || reportDate, Math.floor(Number(entry.days)) - 1)).filter(Boolean).sort();
        if (ends.length) push('ordonnance', ends[ends.length - 1], `Ordonnance${patient ? ` — ${patient}` : ''}`);
    }
    return out;
};

// Écriture au mieux, à l'identifiant déterministe (patient + type + date) : enregistrer deux fois le même rapport ne double pas l'échéance.
export const registerExpiries = async (version, formData) => {
    const user = auth.currentUser;
    const patientID = canonicalPatientId(formData?.patientID);
    if (!user || !patientID) return 0;
    let written = 0;
    for (const item of reportExpiries(version, formData)) {
        try {
            const id = `${patientID}_${item.type}_${item.finIso}`.replace(/[.#$[\]/]/g, '_');
            await set(ref(database, `echeances/${id}`), {
                type: item.type, finLe: item.finLe, delaiJours: item.delaiJours, patientID, patientNom: String(formData.patientName || '').slice(0, 120),
                titre: item.titre.slice(0, 160), auteurUid: user.uid, creeLe: Date.now(),
            });
            written += 1;
        } catch (error) { /* déjà posée (création seule) ou refusée : sans conséquence pour le rapport */ }
    }
    return written;
};
