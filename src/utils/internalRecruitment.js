// src/utils/internalRecruitment.js
//
// Statut de recrutement interne (évolution interne). Un employé ne peut pas candidater : pour postuler à un autre
// poste, il demande ce statut spécial depuis le formulaire de candidature.
//
//   demandesMobilite/{uid}  : sa demande { statut: en_attente | acceptee | refusee, motif, nom, role, badge,
//                              creeLe, traiteLe, traiteParNom, noteRecruteur } — une seule par personne (la dernière).
//   statutsMobilite/{uid}   : le statut ACCORDÉ { accordeLe, accordeParNom, accordePar, demandeLe } — c'est lui qui
//                              rouvre les candidatures à l'employé.
//
// Cycle : demande → un recruteur/admin accepte (le statut est posé) ou refuse → l'employé candidate → quand une de
// ses candidatures est ACCEPTÉE et que son contrat est SIGNÉ, le statut est retiré (voir utils/contracts.js) ; il
// pourra le redemander au besoin.
import { ref, get, set, update, onValue } from 'firebase/database';
import { database } from '../firebase';
import { logActivity } from './activityLog';
import { loadApplicationsOf } from './recruitmentStore';
import { assertNotLocked } from './lockdownGuard';

export const INTERNAL_REQUEST_STATUS = {
    en_attente: { label: 'En attente', color: '#e3b341' },
    acceptee:   { label: 'Acceptée',   color: '#3fb950' },
    refusee:    { label: 'Refusée',    color: '#ff7b72' },
    terminee:   { label: 'Terminée',   color: '#8b949e' },
};

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

// Sa demande et son statut, en direct. callback({ request, granted }).
export const subscribeToMyInternalRecruitment = (uid, callback) => {
    if (!uid) { callback({ request: null, granted: null }); return () => {}; }
    let request = null;
    let granted = null;
    const emit = () => callback({ request, granted });
    const unsubscribeRequest = onValue(ref(database, `demandesMobilite/${uid}`), (snapshot) => { request = snapshot.val(); emit(); }, () => { request = null; emit(); });
    const unsubscribeGranted = onValue(ref(database, `statutsMobilite/${uid}`), (snapshot) => { granted = snapshot.val(); emit(); }, () => { granted = null; emit(); });
    return () => { unsubscribeRequest(); unsubscribeGranted(); };
};

// L'employé demande le statut. member : { name, role, badge }.
export const requestInternalRecruitment = async ({ uid, member, motif }) => {
    assertNotLocked();
    await set(ref(database, `demandesMobilite/${uid}`), {
        statut: 'en_attente',
        creeLe: Date.now(),
        nom: clean(member.name, 120),
        role: clean(member.role, 80),
        badge: clean(member.badge, 40),
        motif: clean(motif, 1500),
    });
    logActivity({ category: 'recrutement', action: 'internal_request', summary: `Demande de recrutement interne : ${clean(member.name, 120)}`, details: clean(motif, 1500) || undefined, target: clean(member.name, 120) });
};

// ── Côté recrutement ──
// Statuts de recrutement interne ACCORDÉS : { [uid]: { accordeLe, accordeParNom, … } } (lecture : recrutement et admins).
export const loadInternalGrants = async () => {
    const snapshot = await get(ref(database, 'statutsMobilite'));
    return snapshot.exists() ? snapshot.val() : {};
};

export const loadInternalRequests = async () => {
    const [requestsSnap, grantedSnap] = await Promise.all([get(ref(database, 'demandesMobilite')), get(ref(database, 'statutsMobilite'))]);
    const granted = grantedSnap.val() || {};
    return Object.entries(requestsSnap.val() || {})
        .map(([uid, request]) => ({ uid, ...request, actif: !!granted[uid] }))
        .sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));
};

export const acceptInternalRequest = async (request, { byUid, byName, note }) => {
    assertNotLocked();
    const now = Date.now();
    await update(ref(database), {
        [`statutsMobilite/${request.uid}`]: { accordeLe: now, accordePar: byUid || null, accordeParNom: clean(byName, 120), demandeLe: request.creeLe || null },
        [`demandesMobilite/${request.uid}/statut`]: 'acceptee',
        [`demandesMobilite/${request.uid}/traiteLe`]: now,
        [`demandesMobilite/${request.uid}/traiteParNom`]: clean(byName, 120),
        [`demandesMobilite/${request.uid}/noteRecruteur`]: clean(note, 1000),
    });
    logActivity({ category: 'recrutement', action: 'internal_accepted', summary: `Statut de recrutement interne accordé : ${request.nom}`, target: request.nom, severity: 'success' });
};

export const refuseInternalRequest = async (request, { byName, note }) => {
    assertNotLocked();
    await update(ref(database), {
        [`demandesMobilite/${request.uid}/statut`]: 'refusee',
        [`demandesMobilite/${request.uid}/traiteLe`]: Date.now(),
        [`demandesMobilite/${request.uid}/traiteParNom`]: clean(byName, 120),
        [`demandesMobilite/${request.uid}/noteRecruteur`]: clean(note, 1000),
    });
    logActivity({ category: 'recrutement', action: 'internal_refused', summary: `Demande de recrutement interne refusée : ${request.nom}`, details: clean(note, 1000) || undefined, target: request.nom, severity: 'warning' });
};

// Retrait manuel par le recrutement (le statut disparaît ; la demande passe à « terminée »).
export const revokeInternalStatus = async (request, { byName }) => {
    assertNotLocked();
    await update(ref(database), {
        [`statutsMobilite/${request.uid}`]: null,
        [`demandesMobilite/${request.uid}/statut`]: 'terminee',
        [`demandesMobilite/${request.uid}/traiteLe`]: Date.now(),
        [`demandesMobilite/${request.uid}/traiteParNom`]: clean(byName, 120),
    });
    logActivity({ category: 'recrutement', action: 'internal_revoked', summary: `Statut de recrutement interne retiré : ${request.nom}`, target: request.nom });
};

// Appelé après la signature d'un contrat : si la personne a le statut ET une candidature acceptée, il est retiré.
export const releaseInternalStatusAfterContract = async (uid) => {
    try {
        const grantedSnap = await get(ref(database, `statutsMobilite/${uid}`));
        if (!grantedSnap.exists()) return false;
        const applications = await loadApplicationsOf(uid);
        if (!applications.some((application) => application.statut === 'acceptee')) return false;
        await update(ref(database), {
            [`statutsMobilite/${uid}`]: null,
            [`demandesMobilite/${uid}/statut`]: 'terminee',
            [`demandesMobilite/${uid}/traiteLe`]: Date.now(),
        });
        logActivity({ category: 'recrutement', action: 'internal_released', summary: 'Statut de recrutement interne terminé (candidature acceptée et contrat signé)', severity: 'success' });
        return true;
    } catch (error) {
        console.warn('Statut de recrutement interne : retrait impossible', error?.message || error);
        return false;
    }
};

