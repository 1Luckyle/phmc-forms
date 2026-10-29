// src/utils/fireSafety.js
//
// Registre de sécurité incendie du PHMC. Le Titre II du Code du Feu (art. 200 à 208) s'applique à TOUT établissement, public compris : l'exemption de
// l'article 401 ne vise que le Titre IV (formation et certificat). Le registre garde la trace des contrôles étage par étage, des non-conformités
// (avec responsable et échéance) et des exercices d'évacuation ; le personnel peut signaler un problème, les admins gèrent le reste.
// Stockage : securiteIncendie/{controles|nonConformites|exercices}/{id} (lecture : personnel et admins ; écriture : admins, sauf le signalement
// d'un problème par le personnel). Règles : database.rules.json, tests : rules-tests.
import { ref, get, set, push, update } from 'firebase/database';
import { database, auth } from '../firebase';
import { logActivity } from './activityLog';
import { notifyGroup } from './notifications';

import { FLOOR_LABELS } from '../constants/buildingPlan';
export const REMINDER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Points contrôlés : un par obligation du Titre II. `article` sert aussi de clé de non-conformité.
export const CHECKLIST = [
    { key: 'issues_degagees', article: '202', label: 'Accès aux issues de secours dégagé, sans aucun obstacle' },
    { key: 'issues_signalees', article: '202', label: 'Signalisation « issue de secours » au-dessus de chaque porte donnant sur l\'extérieur' },
    { key: 'extincteur', article: '203', label: 'Au moins un extincteur raisonnablement accessible' },
    { key: 'alarme', article: '204', label: 'Au moins une alarme anti-incendie réglementaire par étage' },
    { key: 'portes', article: '205', label: 'Portes anti-incendie à tous les accès (établissement de plusieurs pièces)' },
    { key: 'gicleurs', article: '206', label: 'Au moins un gicleur au plafond par étage' },
    { key: 'detecteurs', article: '207', label: 'Au moins un détecteur de fumée réglementaire au plafond' },
    { key: 'acces_dispositifs', article: '208', label: 'Extincteurs, alarmes et gicleurs visibles et non obstrués en permanence' },
];

export const ITEM_STATUS = { ok: 'Conforme', nc: 'Non conforme', na: 'Sans objet' };

export const ARTICLES = {
    202: 'Art. 202 · Issues de secours',
    203: 'Art. 203 · Extincteurs',
    204: 'Art. 204 · Alarme',
    205: 'Art. 205 · Portes anti-incendie',
    206: 'Art. 206 · Gicleurs',
    207: 'Art. 207 · Détecteurs de fumée',
    208: 'Art. 208 · Accès aux dispositifs',
    autre: 'Autre (hors check-list)',
};

export const NC_STATUS = { ouverte: 'Ouverte', resolue: 'Résolue' };

export const ETAGE_SUGGESTIONS = [...FLOOR_LABELS, 'Parking', 'Extérieur du bâtiment'];

const asList = (value) => (value ? Object.entries(value).map(([id, entry]) => ({ id, ...entry })) : []);
export const etageKey = (etage) => String(etage || '').trim().toLowerCase();

// ───────────────────────────── Calculs purs ─────────────────────────────

export const emptyItems = () => Object.fromEntries(CHECKLIST.map((item) => [item.key, 'ok']));

// Points non conformes d'un contrôle → liste d'éléments de CHECKLIST.
export const failedItems = (items) => CHECKLIST.filter((item) => items?.[item.key] === 'nc');

// Dernier contrôle par étage : [{ etage, dernier (contrôle), jours, enRetard }], les étages en retard d'abord.
export const floorStatus = (controles, now = Date.now()) => {
    const byFloor = new Map();
    controles.forEach((controle) => {
        const key = etageKey(controle.etage);
        const current = byFloor.get(key);
        if (!current || (controle.le || 0) > (current.le || 0)) byFloor.set(key, controle);
    });
    return [...byFloor.values()]
        .map((dernier) => {
            const jours = Math.floor((now - (dernier.le || 0)) / DAY_MS);
            return { etage: dernier.etage, dernier, jours, enRetard: jours >= REMINDER_DAYS };
        })
        .sort((a, b) => Number(b.enRetard) - Number(a.enRetard) || b.jours - a.jours);
};

export const isOverdue = (nc, now = Date.now()) => nc.statut === 'ouverte' && !!nc.echeance && nc.echeance < now;

// { ouvertes, enRetard, controlesEnRetard } : de quoi afficher une pastille d'alerte.
export const summary = ({ controles = [], nonConformites = [] }, now = Date.now()) => ({
    ouvertes: nonConformites.filter((nc) => nc.statut === 'ouverte').length,
    enRetard: nonConformites.filter((nc) => isOverdue(nc, now)).length,
    controlesEnRetard: floorStatus(controles, now).filter((floor) => floor.enRetard).length,
});

// ───────────────────────────── Lecture / écriture ─────────────────────────────

export async function loadFireSafety() {
    const snap = await get(ref(database, 'securiteIncendie'));
    const value = snap.exists() ? snap.val() : {};
    const byDate = (key) => (a, b) => (b[key] || 0) - (a[key] || 0);
    return {
        controles: asList(value.controles).sort(byDate('le')),
        nonConformites: asList(value.nonConformites).sort(byDate('creeLe')),
        exercices: asList(value.exercices).sort(byDate('le')),
    };
}

const whoAmI = (name) => ({ uid: auth.currentUser?.uid || '', nom: String(name || '').slice(0, 120) });
const clean = (text, max) => String(text || '').trim().slice(0, max);

const newNonConformity = ({ etage, article, description, source, name, responsable, echeance }) => {
    const entry = {
        creeLe: Date.now(),
        creePar: whoAmI(name),
        etage: clean(etage, 120),
        article: ARTICLES[article] ? String(article) : 'autre',
        description: clean(description, 500),
        statut: 'ouverte',
        source,
        ...(responsable ? { responsable: clean(responsable, 120) } : {}),
        ...(echeance ? { echeance: Number(echeance) } : {}),
    };
    return entry;
};

// Enregistre un contrôle ; crée une non-conformité par point non conforme si `createNonConformities`. Retourne { controle, created }.
export async function saveControl({ etage, items, notes, name, createNonConformities = true, responsable = '', echeance = null }) {
    if (!auth.currentUser) throw new Error('Connexion requise.');
    if (!clean(etage, 60)) throw new Error("Indiquez l'étage contrôlé.");
    const controle = {
        le: Date.now(), parUid: auth.currentUser.uid, parNom: clean(name, 120), etage: clean(etage, 60), items: { ...emptyItems(), ...items },
        ...(notes ? { notes: clean(notes, 500) } : {}),
    };
    const failed = failedItems(controle.items);
    // Tout en UNE écriture : le contrôle et ses non-conformités existent ensemble ou pas du tout (pas de contrôle à moitié enregistré à refaire).
    const writes = { [`controles/${push(ref(database, 'securiteIncendie/controles')).key}`]: controle };
    let created = 0;
    if (createNonConformities) {
        failed.forEach((item) => {
            writes[`nonConformites/${push(ref(database, 'securiteIncendie/nonConformites')).key}`] = newNonConformity({
                etage: controle.etage, article: item.article, description: item.label, source: 'controle', name, responsable, echeance,
            });
            created += 1;
        });
    }
    await update(ref(database, 'securiteIncendie'), writes);
    logActivity({
        category: 'securite', action: 'fire_control_saved', severity: failed.length ? 'warning' : 'info',
        summary: `Contrôle incendie : ${controle.etage} (${failed.length ? `${failed.length} non-conformité(s)` : 'conforme'})`,
        details: `Par : ${controle.parNom || '—'}`,
    });
    return { controle, created };
}

// Signalement d'un problème par n'importe quel membre du personnel (ou un admin).
export async function reportProblem({ etage, article, description, name }) {
    if (!auth.currentUser) throw new Error('Connexion requise.');
    if (!clean(etage, 120)) throw new Error("Indiquez l'étage concerné.");
    if (clean(description, 500).length < 5) throw new Error('Décrivez le problème en quelques mots.');
    const entry = newNonConformity({ etage, article, description, source: 'signalement', name });
    await set(push(ref(database, 'securiteIncendie/nonConformites')), entry);
    notifyGroup('incendie', { type: 'incendie', titre: 'Problème de sécurité incendie signalé', texte: `${entry.etage} — ${entry.description}`, lien: { cible: 'incendie' } });
    logActivity({
        category: 'securite', action: 'fire_problem_reported', severity: 'warning',
        summary: `Problème de sécurité incendie signalé : ${entry.etage}`, details: `${ARTICLES[entry.article]}\n${entry.description}`,
    });
    return entry;
}

export async function addNonConformity(fields, name) {
    if (clean(fields.description, 500).length < 5) throw new Error('Décrivez la non-conformité.');
    if (!clean(fields.etage, 60)) throw new Error("Indiquez l'étage concerné.");
    const entry = newNonConformity({ ...fields, source: 'controle', name });
    await set(push(ref(database, 'securiteIncendie/nonConformites')), entry);
    return entry;
}

// Responsable et échéance d'une non-conformité (admins).
export async function assignNonConformity(id, { responsable, echeance }) {
    await update(ref(database, `securiteIncendie/nonConformites/${id}`), {
        responsable: clean(responsable, 120) || null,
        echeance: echeance ? Number(echeance) : null,
    });
}

export async function resolveNonConformity(id, { note, name }) {
    await update(ref(database, `securiteIncendie/nonConformites/${id}`), {
        statut: 'resolue', resolueLe: Date.now(), resolueParNom: clean(name, 120), resolutionNote: clean(note, 500) || null,
    });
}

export async function reopenNonConformity(id) {
    await update(ref(database, `securiteIncendie/nonConformites/${id}`), { statut: 'ouverte', resolueLe: null, resolueParNom: null, resolutionNote: null });
}

export async function saveDrill({ etage, participants, duree, observations, name }) {
    if (!auth.currentUser) throw new Error('Connexion requise.');
    const entry = {
        le: Date.now(), parUid: auth.currentUser.uid, parNom: clean(name, 120), etage: clean(etage, 60) || 'Tout le bâtiment',
        participants: Math.max(0, Math.min(5000, Number(participants) || 0)), duree: Math.max(0, Math.min(600, Number(duree) || 0)),
        ...(observations ? { observations: clean(observations, 500) } : {}),
    };
    await set(push(ref(database, 'securiteIncendie/exercices')), entry);
    logActivity({ category: 'securite', action: 'fire_drill_saved', severity: 'info', summary: `Exercice d'évacuation enregistré : ${entry.etage}`, details: `${entry.participants} participant(s), ${entry.duree} min` });
    return entry;
}
