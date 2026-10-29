// src/utils/lawEnforcement.js
//
// Demandes des forces de l'ordre (« niveau 2 ») : le secret médical est un crime (Code Pénal, art. 323) avec des exceptions précises (art. 123 du
// Code Pénal ; mandats et injonctions : Code de Procédure Judiciaire, art. 330, 341 et 422). Deux outils pour le personnel :
//   • un AIDE-MÉMOIRE (arbre de décision, adviceFor) : que faire quand un agent demande une information sur un patient ;
//   • un REGISTRE court : qui a demandé quoi, sur quel fondement, et ce qui a été décidé. On n'y écrit JAMAIS de contenu médical.
// Stockage : demandesAutorites/{id} (lecture : l'auteur de la fiche et les admins ; création : le personnel, à son propre nom ; modification et
// suppression : admins). Règles : database.rules.json, tests : rules-tests.
import { ref, get, set, push, remove, query, orderByChild, equalTo } from 'firebase/database';
import { database, auth } from '../firebase';
import { canonicalPatientId } from './patientId';
import { logActivity } from './activityLog';

export const REQUEST_TYPES = {
    presence: "Présence d'un patient",
    etat: "État d'un patient",
    dossier: 'Dossier médical',
    prelevement: 'Prélèvement (sang, ADN…)',
    identite_defunt: "Identité d'un défunt",
    images: 'Images (vidéosurveillance…)',
    autre: 'Autre',
};

export const LEGAL_BASES = {
    mandat: 'Mandat ou injonction de la Cour',
    consentement: 'Consentement du patient',
    danger: 'Danger vital (Code Pénal, art. 123)',
    aucune: 'Aucun fondement',
};

export const DECISIONS = {
    remis: 'Information communiquée',
    refuse: 'Refusée',
    transmis: 'Transmise à la Direction',
};

export const REFUSAL_TEXT = "Je suis tenu(e) au secret médical (Code Pénal, art. 323) : sans mandat ni consentement du patient, je ne peux pas vous communiquer cette information. Si vous disposez d'un mandat ou d'une injonction de la Cour, veuillez le remettre à la Direction du Pillbox Hill Medical Center, qui traitera votre demande.";

// ───────────────────────────── Aide-mémoire ─────────────────────────────

// Étapes de l'arbre : chaque question mène à une autre question ou à un résultat.
export const QUESTIONS = {
    mandat: {
        text: "L'agent présente-t-il un mandat, une injonction de la Cour ou une réquisition écrite ?",
        help: 'Code de Procédure Judiciaire, art. 330, 341 et 422.',
        yes: 'direction', no: 'consentement',
    },
    consentement: {
        text: 'Le patient concerné consent-il, en personne et librement, à ce que cette information soit communiquée ?',
        help: 'Un accord donné sous pression, ou par un tiers, ne compte pas.',
        yes: 'consentement_ok', no: 'danger',
    },
    danger: {
        text: 'Une personne (le patient ou un tiers) est-elle en danger de mort imminent, et la communication permet-elle de l\'écarter ?',
        help: 'Code Pénal, art. 123.',
        yes: 'danger_ok', no: 'refus',
    },
};

export const OUTCOMES = {
    direction: {
        tone: 'info', base: 'mandat', decision: 'transmis',
        title: 'Ne remettez rien vous-même : transmettez à la Direction',
        body: "Prenez le document (ou son numéro de référence), notez l'identité de l'agent, et adressez la demande à la Direction du PHMC. C'est elle qui vérifie le mandat et décide de ce qui est communiqué.",
    },
    consentement_ok: {
        tone: 'success', base: 'consentement', decision: 'remis',
        title: "Communiquez seulement ce que le patient autorise",
        body: "Limitez-vous à ce que le patient accepte de communiquer, et à ce qui est demandé. Notez son accord dans le registre.",
    },
    danger_ok: {
        tone: 'warning', base: 'danger', decision: 'remis',
        title: "Communiquez seulement l'essentiel, puis prévenez la Direction",
        body: "Donnez uniquement l'information nécessaire pour écarter le danger (pas le dossier). Prévenez ensuite la Direction et enregistrez la demande.",
    },
    refus: {
        tone: 'danger', base: 'aucune', decision: 'refuse',
        title: 'Refus poli',
        body: 'Sans mandat, sans consentement et sans danger vital, le secret médical s\'applique. Vous pouvez dire :',
        script: REFUSAL_TEXT,
    },
};

// → { question } tant que l'arbre n'est pas terminé, { outcome, key } à la fin. `answers` : suite de true / false depuis la première question.
export const adviceFor = (answers = []) => {
    let key = 'mandat';
    for (const answer of answers) {
        const step = QUESTIONS[key];
        if (!step) break;
        key = answer ? step.yes : step.no;
    }
    return QUESTIONS[key] ? { key, question: QUESTIONS[key] } : { key, outcome: OUTCOMES[key] };
};

// ───────────────────────────── Registre ─────────────────────────────

export const emptyRequest = () => ({ service: '', agent: '', type: 'dossier', patientID: '', baseLegale: 'aucune', reference: '', decision: 'refuse', note: '' });

// → liste de messages d'erreur (vide si la fiche est valide).
export const validateRequest = (form) => {
    const errors = [];
    if (!String(form.service || '').trim()) errors.push('Indiquez le service demandeur (ex. LSPD).');
    if (!String(form.agent || '').trim()) errors.push("Indiquez le nom ou le matricule de l'agent.");
    if (!REQUEST_TYPES[form.type]) errors.push('Choisissez le type de demande.');
    if (!LEGAL_BASES[form.baseLegale]) errors.push('Choisissez le fondement invoqué.');
    if (!DECISIONS[form.decision]) errors.push('Choisissez la décision prise.');
    if (form.baseLegale === 'mandat' && !String(form.reference || '').trim()) errors.push('Indiquez la référence du mandat.');
    if (form.decision === 'remis' && form.baseLegale === 'aucune') errors.push("Une information ne se communique pas sans fondement (mandat, consentement ou danger vital).");
    return errors;
};

const normalize = (id, value) => ({ id, ...value });
const byDateDesc = (a, b) => (b.le || 0) - (a.le || 0);

export async function saveRequest(form, { staffName } = {}) {
    if (!auth.currentUser) throw new Error('Connexion requise.');
    const errors = validateRequest(form);
    if (errors.length) throw new Error(errors[0]);
    const patientID = form.patientID ? canonicalPatientId(form.patientID) : '';
    const entry = {
        auteurUid: auth.currentUser.uid,
        auteurNom: String(staffName || '').slice(0, 120),
        le: Date.now(),
        service: String(form.service).trim().slice(0, 80),
        agent: String(form.agent).trim().slice(0, 120),
        type: form.type,
        baseLegale: form.baseLegale,
        decision: form.decision,
        ...(patientID ? { patientID } : {}),
        ...(form.reference ? { reference: String(form.reference).trim().slice(0, 120) } : {}),
        ...(form.note ? { note: String(form.note).trim().slice(0, 300) } : {}),
    };
    const newRef = push(ref(database, 'demandesAutorites'));
    await set(newRef, entry);
    logActivity({
        category: 'rapports', action: 'law_enforcement_request', severity: entry.decision === 'remis' ? 'warning' : 'info',
        summary: `Demande d'une autorité enregistrée : ${REQUEST_TYPES[entry.type]} (${DECISIONS[entry.decision]})`,
        details: `Service : ${entry.service}\nFondement : ${LEGAL_BASES[entry.baseLegale]}${entry.reference ? ` (${entry.reference})` : ''}`,
        target: patientID || undefined,
    });
    return normalize(newRef.key, entry);
}

// Les demandes enregistrées par la personne connectée (requête filtrée : c'est la seule lecture permise hors admin).
export async function loadMyRequests(uid) {
    const snap = await get(query(ref(database, 'demandesAutorites'), orderByChild('auteurUid'), equalTo(uid)));
    return snap.exists() ? Object.entries(snap.val()).map(([id, value]) => normalize(id, value)).sort(byDateDesc) : [];
}

// Toutes les demandes (admins).
export async function loadAllRequests() {
    const snap = await get(ref(database, 'demandesAutorites'));
    return snap.exists() ? Object.entries(snap.val()).map(([id, value]) => normalize(id, value)).sort(byDateDesc) : [];
}

export async function deleteRequest(id) {
    await remove(ref(database, `demandesAutorites/${id}`));
}
