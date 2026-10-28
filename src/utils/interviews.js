// src/utils/interviews.js
//
// Entretiens de recrutement : qui les mène, qui y assiste, et la décharge à signer quand aucun personnel administratif n'y est.
//
//   candidatures/{uid}/{id}/entretien = { date (ISO), recruteur: { nom, uid? }, presents: [{ nom, role? }], sansAdministratif: bool,
//                                          planifiePar: { nom, le }, modifieLe? }
//   decharges/{uid}/{id}/{pushId}     = { ts, par: { uid, nom }, signature, texte, entretien: { date, recruteur, presents } }
//                                       (lecture/écriture : recrutement et admins seulement — le candidat n'y a pas accès)
// Chaque planification, modification ou annulation est consignée dans l'historique de la candidature (evenement + details).
import { ref, push, set } from 'firebase/database';
import { database } from '../firebase';
import { normalizeRank } from '../constants/ranks';

// Rôles du personnel ADMINISTRATIF (direction et administration) : leur présence dispense de décharge.
const ADMIN_ROLES = new Set(['Directeur(trice)', 'Assistant(e) de Direction', 'Personnel Administratif']);

export const isAdministrativeMember = (member) => {
    if (!member) return false;
    const roles = [member.rank, member.category, ...(Array.isArray(member.extraRanks) ? member.extraRanks : Object.values(member.extraRanks || {}))];
    return roles.filter(Boolean).some((role) => ADMIN_ROLES.has(normalizeRank(role)));
};

export const DECHARGE_TEXT = "Je soussigné(e) m'engage, en tant que recruteur, à mener cet entretien en l'absence de personnel administratif (Direction, Assistant(e) de Direction, Personnel Administratif). J'en assume la responsabilité : conduite de l'entretien, respect des règles de recrutement du PHMC et compte rendu à l'administration.";

const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR') : '—');

export const presentsLabel = (entretien) => (entretien?.presents || []).map((person) => person.nom).join(', ');

// Description lisible d'un entretien (mail, historique).
export const describeInterview = (entretien) => {
    if (!entretien) return '';
    const parts = [`le ${formatDateTime(entretien.date)}`, `mené par ${entretien.recruteur?.nom || 'le recrutement'}`];
    if ((entretien.presents || []).length > 0) parts.push(`en présence de ${presentsLabel(entretien)}`);
    return parts.join(', ');
};

// Ce qui a changé entre deux versions d'un entretien (pour l'historique et le mail au candidat).
export const interviewChanges = (previous, next) => {
    const changes = [];
    if ((previous?.date || '') !== (next?.date || '')) changes.push(`Date : ${formatDateTime(previous?.date)} → ${formatDateTime(next?.date)}`);
    if ((previous?.recruteur?.nom || '') !== (next?.recruteur?.nom || '')) changes.push(`Recruteur : ${previous?.recruteur?.nom || '—'} → ${next?.recruteur?.nom || '—'}`);
    if (presentsLabel(previous) !== presentsLabel(next)) changes.push(`Présents : ${presentsLabel(previous) || 'aucun'} → ${presentsLabel(next) || 'aucun'}`);
    return changes;
};

const normalizeName = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// La signature électronique de la décharge : le nom complet du recruteur qui planifie (ou, à défaut de nom connu, 3 caractères minimum).
export const signatureMatches = (typed, actorName) => {
    const signature = normalizeName(typed);
    if (!signature) return false;
    if (!actorName || String(actorName).includes('@')) return signature.length >= 3;
    return signature === normalizeName(actorName);
};

// Conserve la décharge signée (accès recrutement / admins uniquement).
export const saveDecharge = async ({ application, actor, signature, entretien }) => {
    const dechargeRef = push(ref(database, `decharges/${application.candidatUid}/${application.id}`));
    await set(dechargeRef, {
        ts: Date.now(),
        par: { uid: actor.uid || null, nom: clean(actor.name, 120) },
        signature: clean(signature, 120),
        texte: DECHARGE_TEXT,
        entretien: { date: entretien.date, recruteur: entretien.recruteur?.nom || '', presents: presentsLabel(entretien) },
    });
    return dechargeRef.key;
};
