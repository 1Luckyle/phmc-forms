// src/utils/activePrescriptions.js
//
// ORDONNANCES EN COURS d'un patient. Chaque rapport de soins qui comporte une ordonnance range sur son entrée d'index (patientRecords/{ID}/{clé}/ordonnances) la liste COMPACTE de ses lignes
// d'ordonnance : { medId, name, posology, start, end }. À l'ouverture d'un formulaire de soins, on relit cet index pour le patient et on garde les ordonnances ENCORE EN COURS (date de fin
// atteinte ou à venir) : elles sont comptées avec les « traitements habituels » (rapport, contrôles de l'assistant Pilou), sans jamais entrer dans le dossier du patient (elles disparaissent
// toutes seules à leur date de fin). Une ordonnance sans date de fin (durée non précisée) n'est jamais comptée : on ne peut pas savoir si elle est en cours.
// Même logique pour l'affichage du dossier : « en cours jusqu'au … » ou « terminée le … ».
import { addDaysIso, prescriptionParts } from '../clinical/engine';
import { todayIso } from './appointmentDate';

const DAY = /^\d{4}-\d{2}-\d{2}/;
const dayOf = (value) => (DAY.test(String(value || '')) ? String(value).slice(0, 10) : '');
export const frDayOf = (iso) => (dayOf(iso) ? dayOf(iso).split('-').reverse().join('/') : '');

/** Lignes d'ordonnance d'un formulaire de soins, sous la forme compacte rangée dans l'index : [{ medId, name, posology, start, end }] (rien pour un patient décédé). */
export const prescriptionItemsOf = (formData) => {
    if (!formData || formData.careDeceased === 'Yes') return [];
    const entries = Array.isArray(formData.clinicalMeds) ? formData.clinicalMeds : [];
    return entries.filter((entry) => entry && entry.prescribed).map((entry) => {
        const parts = prescriptionParts(entry);
        return parts ? { medId: entry.medId, name: parts.name, posology: parts.posology, start: parts.start, end: parts.end } : null;
    }).filter(Boolean);
};

const listOf = (value) => (Array.isArray(value) ? value : (value && typeof value === 'object' ? Object.values(value) : []));

// Signature d'une liste d'ordonnance (médicament + début + fin) : sert à reconnaître l'ordonnance du rapport qu'on est en train de modifier.
const signatureOf = (items) => listOf(items).filter((item) => item && item.medId).map((item) => `${item.medId}|${dayOf(item.start)}|${dayOf(item.end)}`).sort().join(';');

/**
 * Ordonnances en cours à la date `asOf`, d'après les entrées d'index d'un patient ({ clé: entrée }).
 *   • en cours : fin >= asOf et début au plus tard le lendemain (un médicament déjà donné ce jour-là commence le lendemain) ;
 *   • un même médicament n'apparaît qu'une fois (la fin la plus tardive) ; les copies et rapports retirés sont ignorés ;
 *   • seules les ordonnances des AUTRES rapports comptent, jamais celle qu'on est en train de rédiger : un rapport enregistré rouvert est reconnu à son titre (`excludeTitle`) ET à
 *     une ordonnance identique (`ownItems`, voir prescriptionItemsOf) — un autre rapport du même jour, même titre, avec une autre ordonnance reste compté ;
 *   • `off` : médicaments que le soignant a retirés de la liste (patient qui a arrêté son traitement).
 * → [{ medId, name, posology, start, end, report }] triées par date de fin.
 */
export const activePrescriptions = (indexEntries, { asOf = '', excludeTitle = '', ownItems = [], off = [] } = {}) => {
    const day = dayOf(asOf) || todayIso();
    const own = signatureOf(ownItems);
    const horizon = addDaysIso(day, 1);
    const best = new Map();
    Object.values(indexEntries || {}).forEach((entry) => {
        if (!entry || entry.copiedFrom || entry.ownerDeleted) return;
        if (excludeTitle && entry.title === excludeTitle && own && signatureOf(entry.ordonnances) === own) return;
        listOf(entry.ordonnances).forEach((item) => {
            if (!item || !item.medId || !dayOf(item.end) || off.includes(item.medId)) return;
            if (dayOf(item.end) < day || (dayOf(item.start) && dayOf(item.start) > horizon)) return;
            const current = best.get(item.medId);
            if (!current || dayOf(item.end) > current.end) {
                best.set(item.medId, { medId: item.medId, name: String(item.name || ''), posology: String(item.posology || ''), start: dayOf(item.start), end: dayOf(item.end), report: String(entry.title || '') });
            }
        });
    });
    return [...best.values()].sort((a, b) => a.end.localeCompare(b.end) || a.name.localeCompare(b.name));
};

/** 'active' (fin aujourd'hui ou plus tard), 'ended' (fin dépassée) ou 'undated' (pas de date de fin). */
export const prescriptionStatus = (end, today = todayIso()) => (dayOf(end) ? (dayOf(end) >= today ? 'active' : 'ended') : 'undated');

export const prescriptionStatusLabel = (end, today = todayIso()) => {
    const status = prescriptionStatus(end, today);
    if (status === 'active') return `en cours jusqu'au ${frDayOf(end)}`;
    if (status === 'ended') return `terminée le ${frDayOf(end)}`;
    return 'durée non précisée';
};

/** Texte de l'étiquette d'une ordonnance dans un rapport ou le dossier : « Ordonnance · en cours jusqu'au 20/11/2026 ». */
export const prescriptionBadgeText = (ordonnance, today = todayIso()) => `Ordonnance · ${prescriptionStatusLabel(ordonnance && ordonnance.fin, today)}`;

/** Une ordonnance en cours comptée avec les traitements habituels : « Ibuprofène (ordonnance en cours jusqu'au 20/11/2026) ». */
export const activePrescriptionText = (item) => `${item.name} (ordonnance en cours jusqu'au ${frDayOf(item.end)})`;

/** « Traitements habituels » d'un rapport : ceux du dossier ou saisis, puis les ordonnances en cours (avec leur date de fin). */
export const habitualMedicineText = (formData) => {
    const f = formData || {};
    const active = (Array.isArray(f.patientActivePrescriptions) ? f.patientActivePrescriptions : []).filter((item) => item && item.name && dayOf(item.end));
    return [String(f.patientCurrentMedicine || '').trim(), ...active.map(activePrescriptionText)].filter(Boolean).join(' ; ');
};
