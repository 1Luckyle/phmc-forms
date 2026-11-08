// src/utils/exemptions.js
//
// Exemption de paiement des dossiers médicaux (mineurs et personnes à faible revenu). Trois nœuds (règles : database.rules.json) :
//   exemptions/{ID patient}              le DRAPEAU « exempté » : { statut: 'active', source, depuisLe, parNom, note? } ;
//                                         source : 'mineur' (posé automatiquement à un profil mineur) | 'demande' (demande acceptée) | 'manuel' (accordée par l'administration) ;
//   demandesExemption/{ID patient}       une demande en attente : { patientID, patientNom, motif, details?, demandeLe, demandeurUid, demandeurNom, parSoignant?, statut: 'en_attente' } ;
//   exemptionsHistorique/{ID}/{id}       trace des décisions : { type: accordee | refusee | retiree, parNom, commentaire, le }.
// Une demande est traitée par le personnel administratif (Direction, administration) et les admins. Tant qu'elle est en attente, la facture du
// rapport reste due mais s'affiche « en attente de traitement pour l'exemption » (facture.exemptionEnAttente) ; acceptée, elle passe sans paiement ;
// refusée, elle redevient une facture à payer.
import { ref, get, set, update, remove, push } from 'firebase/database';
import { database, auth } from '../firebase';
import { canonicalPatientId } from './patientId';
import { logActivity } from './activityLog';
import { notifyGroup, notifyUser, findCivilianUidByPatientId } from './notifications';
import { sendTemplatedMail } from './mailTemplates';
import { INVOICE_STATUS } from './patientBilling';
import { ageOn, MAJORITY_AGE } from './minors';

export const EXEMPTION_MOTIFS = {
    faible_revenu: 'Faible revenu',
    mineur: 'Mineur (moins de 18 ans)',
    autre: 'Autre situation',
};

export const EXEMPTION_SOURCES = {
    mineur: 'Mineur (automatique)',
    demande: 'Demande acceptée',
    manuel: 'Accordée par l\'administration',
};

export const EXEMPTION_INFO = 'Les citoyens mineurs (moins de 18 ans) et les citoyens de l\'État à faible revenu sont exemptés du paiement de ces dossiers.';

const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const ID_PATTERN = /^PHMC-\d{3,}$/;
export const isValidPatientId = (patientID) => ID_PATTERN.test(canonicalPatientId(patientID));

// Drapeau d'un patient, ou null (absent, ou lecture refusée : un Civil ne lit que le sien).
export async function loadExemption(patientID) {
    const id = canonicalPatientId(patientID);
    if (!isValidPatientId(id)) return null;
    try {
        const snap = await get(ref(database, `exemptions/${id}`));
        return snap.exists() ? { patientID: id, ...snap.val() } : null;
    } catch (error) {
        return null;
    }
}

export async function loadAllExemptions() {
    const snap = await get(ref(database, 'exemptions'));
    return Object.entries(snap.exists() ? snap.val() : {}).map(([patientID, value]) => ({ patientID, ...value })).sort((a, b) => (b.depuisLe || 0) - (a.depuisLe || 0));
}

// Ensemble des ID exemptés (annuaire : badge). Vide si la lecture est refusée.
export async function loadExemptIds() {
    try {
        const snap = await get(ref(database, 'exemptions'));
        return new Set(snap.exists() ? Object.keys(snap.val()) : []);
    } catch (error) {
        return new Set();
    }
}

export async function loadMyPendingRequest(patientID) {
    const id = canonicalPatientId(patientID);
    if (!isValidPatientId(id)) return null;
    try {
        const snap = await get(ref(database, `demandesExemption/${id}`));
        return snap.exists() ? { patientID: id, ...snap.val() } : null;
    } catch (error) {
        return null;
    }
}

export async function loadPendingRequests() {
    const snap = await get(ref(database, 'demandesExemption'));
    return Object.entries(snap.exists() ? snap.val() : {}).map(([patientID, value]) => ({ patientID, ...value })).sort((a, b) => (a.demandeLe || 0) - (b.demandeLe || 0));
}

const history = (patientID, entry) => set(push(ref(database, `exemptionsHistorique/${patientID}`)), { ...entry, le: Date.now() }).catch(() => {});

// Mail à l'adresse du patient (compte Civil), au mieux.
const mailPatient = async (patientID, templateId, vars, fallbackEmail = '') => {
    try {
        let email = fallbackEmail;
        const snap = await get(ref(database, 'civilians'));
        const civil = Object.values(snap.val() || {}).find((entry) => entry && entry.patientID && canonicalPatientId(entry.patientID) === patientID);
        if (civil?.email) email = civil.email;
        if (email) await sendTemplatedMail(templateId, { to: email, vars });
    } catch (error) {
        if (fallbackEmail) sendTemplatedMail(templateId, { to: fallbackEmail, vars }).catch(() => {});
    }
};

// ───────────────────────────── Demande ─────────────────────────────

// Le patient (ou un soignant pour lui) demande l'exemption. `byStaff` : { uid, nom } quand un soignant s'engage pour le patient.
export async function requestExemption({ patientID, patientName, motif = 'faible_revenu', details = '', byStaff = null, patientEmail = '', requesterEmail = '' }) {
    const id = canonicalPatientId(patientID);
    const user = auth.currentUser;
    if (!user) throw new Error('Connexion requise.');
    if (!isValidPatientId(id)) throw new Error('ID patient invalide.');
    const existing = await loadExemption(id);
    if (existing) return { status: 'deja_exempte' };
    const entry = {
        patientID: id,
        patientNom: clean(patientName, 120) || 'Patient',
        motif: EXEMPTION_MOTIFS[motif] ? motif : 'autre',
        demandeLe: Date.now(),
        demandeurUid: user.uid,
        demandeurNom: clean(byStaff?.nom || patientName, 120) || 'Demandeur',
        statut: 'en_attente',
        ...(clean(details, 500) ? { details: clean(details, 500) } : {}),
        ...(byStaff ? { parSoignant: clean(byStaff.nom, 120) } : {}),
        ...(clean(patientEmail, 200) ? { patientEmail: clean(patientEmail, 200) } : {}),
    };
    try {
        await set(ref(database, `demandesExemption/${id}`), entry);
    } catch (error) {
        // Écriture refusée : une demande existe déjà pour cet ID (la création n'est permise qu'une fois).
        return { status: 'deja_demandee' };
    }
    notifyGroup('administration', {
        type: 'demande', titre: 'Demande d\'exemption de paiement',
        texte: `${entry.patientNom} (${id})${byStaff ? ` — demandée par ${entry.parSoignant}` : ''}`, lien: { cible: 'exemptions' },
    });
    if (requesterEmail) sendTemplatedMail('exemption_demande_recue', { to: requesterEmail, vars: { nom: entry.demandeurNom, patient: entry.patientNom } }).catch(() => {});
    logActivity({ category: 'demandes', action: 'exemption_requested', severity: 'info', summary: `Demande d'exemption : ${entry.patientNom} (${id})`, details: `${EXEMPTION_MOTIFS[entry.motif]}${byStaff ? `\nPar : ${entry.parSoignant}` : ''}`, target: id });
    return { status: 'demandee' };
}

// ───────────────────────────── Factures en attente d'exemption ─────────────────────────────

// Accordée : les factures en attente passent « sans paiement ». Refusée : elles redeviennent des factures à payer (et rejoignent les rappels).
async function settlePendingInvoices(patientID, granted) {
    const snap = await get(ref(database, `facturesPatients/${patientID}`));
    const updates = {};
    Object.entries(snap.exists() ? snap.val() : {}).forEach(([invoiceId, invoice]) => {
        if (!invoice || !invoice.exemptionEnAttente) return;
        updates[`facturesPatients/${patientID}/${invoiceId}/exemptionEnAttente`] = null;
        if (granted) {
            updates[`facturesPatients/${patientID}/${invoiceId}/statut`] = INVOICE_STATUS.SANS_PAIEMENT;
            updates[`facturesPatients/${patientID}/${invoiceId}/exemptionAccordee`] = true;
        } else {
            updates[`facturesEnAttente/${patientID}/${invoiceId}`] = Date.now();
            updates[`facturesPatients/${patientID}/${invoiceId}/exemptionRefusee`] = true;
        }
    });
    if (Object.keys(updates).length) await update(ref(database), updates);
    return Object.keys(updates).length;
}

const tellPatient = async (patientID, { titre, texte, templateId, vars, fallbackEmail }) => {
    const uid = await findCivilianUidByPatientId(patientID);
    if (uid) notifyUser(uid, { type: 'statut', titre, texte, lien: { cible: 'dossierPatient' } });
    await mailPatient(patientID, templateId, vars, fallbackEmail);
};

// ───────────────────────────── Décision de l'administration ─────────────────────────────

export async function approveRequest(request, { name, note = '' }) {
    const id = canonicalPatientId(request.patientID);
    const flag = { statut: 'active', source: 'demande', depuisLe: Date.now(), parNom: clean(name, 120), ...(clean(note, 300) ? { note: clean(note, 300) } : {}) };
    await set(ref(database, `exemptions/${id}`), flag);
    await remove(ref(database, `demandesExemption/${id}`));
    await history(id, { type: 'accordee', parNom: clean(name, 120), commentaire: clean(note, 300) });
    await settlePendingInvoices(id, true);
    if (request.demandeurUid) notifyUser(request.demandeurUid, { type: 'statut', titre: `Exemption accordée : ${request.patientNom}`, texte: clean(note, 300) || undefined });
    await tellPatient(id, {
        titre: 'Votre exemption de paiement est enregistrée', texte: clean(note, 300) || undefined,
        templateId: 'exemption_accordee', vars: { nom: request.patientNom, note: clean(note, 300) }, fallbackEmail: request.patientEmail,
    });
    logActivity({ category: 'demandes', action: 'exemption_granted', severity: 'info', summary: `Exemption accordée : ${request.patientNom} (${id})`, details: `Par : ${clean(name, 120)}`, target: id });
}

export async function refuseRequest(request, { name, note = '' }) {
    const id = canonicalPatientId(request.patientID);
    await remove(ref(database, `demandesExemption/${id}`));
    await history(id, { type: 'refusee', parNom: clean(name, 120), commentaire: clean(note, 300) });
    await settlePendingInvoices(id, false);
    if (request.demandeurUid) notifyUser(request.demandeurUid, { type: 'statut', titre: `Exemption refusée : ${request.patientNom}`, texte: clean(note, 300) || undefined });
    await tellPatient(id, {
        titre: 'Votre demande d\'exemption n\'a pas été retenue', texte: clean(note, 300) || undefined,
        templateId: 'exemption_refusee', vars: { nom: request.patientNom, note: clean(note, 300) }, fallbackEmail: request.patientEmail,
    });
    logActivity({ category: 'demandes', action: 'exemption_refused', severity: 'info', summary: `Exemption refusée : ${request.patientNom} (${id})`, details: `Par : ${clean(name, 120)}\n${clean(note, 300)}`, target: id });
}

// Accorde directement une exemption (sans demande préalable).
export async function grantExemption({ patientID, patientName, name, note = '' }) {
    const id = canonicalPatientId(patientID);
    if (!isValidPatientId(id)) throw new Error('ID patient invalide.');
    await set(ref(database, `exemptions/${id}`), { statut: 'active', source: 'manuel', depuisLe: Date.now(), parNom: clean(name, 120), ...(clean(note, 300) ? { note: clean(note, 300) } : {}) });
    await remove(ref(database, `demandesExemption/${id}`)).catch(() => {});
    await history(id, { type: 'accordee', parNom: clean(name, 120), commentaire: clean(note, 300) });
    await settlePendingInvoices(id, true);
    await tellPatient(id, {
        titre: 'Votre exemption de paiement est enregistrée', texte: clean(note, 300) || undefined,
        templateId: 'exemption_accordee', vars: { nom: clean(patientName, 120) || id, note: clean(note, 300) },
    });
    logActivity({ category: 'demandes', action: 'exemption_granted', severity: 'info', summary: `Exemption accordée : ${id}`, details: `Par : ${clean(name, 120)}`, target: id });
}

// Retire une exemption : un commentaire (le motif) est obligatoire ; il est conservé et envoyé au patient.
export async function withdrawExemption({ patientID, patientName, name, comment }) {
    const id = canonicalPatientId(patientID);
    const reason = clean(comment, 300);
    if (!reason) throw new Error('Indiquez le motif du retrait : il est transmis à la personne.');
    await remove(ref(database, `exemptions/${id}`));
    await history(id, { type: 'retiree', parNom: clean(name, 120), commentaire: reason });
    await tellPatient(id, {
        titre: 'Votre exemption de paiement a été retirée', texte: reason,
        templateId: 'exemption_retiree', vars: { nom: clean(patientName, 120) || id, motif: reason },
    });
    logActivity({ category: 'demandes', action: 'exemption_withdrawn', severity: 'warning', summary: `Exemption retirée : ${id}`, details: `Par : ${clean(name, 120)}\nMotif : ${reason}`, target: id });
}

// ───────────────────────────── Mineurs : drapeau automatique ─────────────────────────────

// Un profil mineur reçoit le drapeau (source « mineur ») ; devenu majeur, il le perd (et la personne en est avertie : retourne { removed: true } pour que l'appelant
// l'affiche). Appelée à la connexion, pour SON propre ID patient. Une fonction serveur quotidienne (minorExemptionExpiry) fait la même vérification pour ceux qui ne
// se connectent plus, et une exemption « mineur » ne vaut de toute façon jamais pour un formulaire dont la date de naissance indique un adulte (hooks/useExemption).
export async function syncMinorFlag(patientID, dateOfBirth, name = '') {
    const id = canonicalPatientId(patientID);
    if (!isValidPatientId(id) || !dateOfBirth) return null;
    const age = ageOn(dateOfBirth);
    if (age === null) return null;
    const flag = await loadExemption(id);
    if (age < MAJORITY_AGE && !flag) {
        await set(ref(database, `exemptions/${id}`), { statut: 'active', source: 'mineur', depuisLe: Date.now(), parNom: clean(name, 120) || 'Profil mineur' });
    } else if (age >= MAJORITY_AGE && flag?.source === 'mineur') {
        await remove(ref(database, `exemptions/${id}`));
        await history(id, { type: 'retiree', parNom: 'Majorité atteinte', commentaire: "L'exemption de paiement accordée aux mineurs prend fin à 18 ans." });
        return { removed: true };
    }
    return null;
}
