// src/utils/takeHomeCars.js
//
// Programme « Take Home Car » (voir constants/takeHomeCar.js pour le règlement et les véhicules éligibles). Stockage :
//   takeHomeCars/demandes/{uid}/{id}   demandes de chaque membre du personnel (lisibles par leur auteur et par la Direction/les admins) ;
//   takeHomeCars/attributions/{plaque} qui a actuellement le véhicule : { uid, nom, depuis, demandeId } (lisible par le personnel).
// Le demandeur crée sa demande, l'annule tant qu'elle est en attente et rend le véhicule ; la Direction (admins, Directeur(trice), Assistant(e) de
// Direction, Personnel Administratif) accepte, refuse ou retire. Règles : database.rules.json.
import { ref, get, set, push, update, onValue } from 'firebase/database';
import { database, auth } from '../firebase';
import { logActivity } from './activityLog';
import { notifyGroup, notifyUser } from './notifications';
import { TAKE_HOME_STATUS, MOTIF_MIN, MOTIF_MAX, vehicleByPlate, vehicleLabel } from '../constants/takeHomeCar';

const clean = (text, max) => String(text || '').trim().slice(0, max);
const ACTIVE = ['en_attente', 'accepte'];

// demandes/{uid}/{id} → liste à plat [{ id, uid, ...demande }], les plus récentes d'abord.
export const flattenRequests = (value) => Object.entries(value || {})
    .flatMap(([uid, byId]) => Object.entries(byId || {}).map(([id, entry]) => ({ id, uid, ...entry })))
    .sort((a, b) => (b.demandeLe || 0) - (a.demandeLe || 0));

export const isActive = (request) => ACTIVE.includes(request?.statut);
export const statusInfo = (statut) => TAKE_HOME_STATUS[statut] || { label: String(statut || ''), bg: 'secondary' };

const listen = (path, onData) => onValue(ref(database, path), (snap) => onData(snap.exists() ? snap.val() : {}), (error) => {
    console.warn('Take Home Car : lecture impossible', error?.message || error);
    onData({});
});

// Mes demandes (une liste à plat) → désabonnement.
export const subscribeMyRequests = (uid, onData) => (uid ? listen(`takeHomeCars/demandes/${uid}`, (value) => onData(flattenRequests({ [uid]: value }))) : (onData([]), () => {}));
// Toutes les demandes (Direction, admins).
export const subscribeAllRequests = (onData) => listen('takeHomeCars/demandes', (value) => onData(flattenRequests(value)));
// Attributions en cours : { PHMC04: { uid, nom, depuis, demandeId } }.
export const subscribeAssignments = (onData) => listen('takeHomeCars/attributions', onData);

export async function submitRequest({ plate, motif, lieu, name }) {
    const user = auth.currentUser;
    if (!user) throw new Error('Connexion requise.');
    if (!vehicleByPlate(plate)) throw new Error('Choisissez un véhicule éligible.');
    const reason = clean(motif, MOTIF_MAX);
    if (reason.length < MOTIF_MIN) throw new Error('Expliquez votre demande en quelques mots.');
    const mine = await get(ref(database, `takeHomeCars/demandes/${user.uid}`));
    if (flattenRequests({ [user.uid]: mine.val() }).some(isActive)) throw new Error('Vous avez déjà une demande en attente ou un véhicule attribué.');
    const taken = await get(ref(database, `takeHomeCars/attributions/${plate}`));
    if (taken.exists()) throw new Error(`Ce véhicule est déjà attribué à ${taken.val().nom || 'un autre membre du personnel'}.`);
    const entry = {
        demandeLe: Date.now(), demandeurUid: user.uid, demandeurNom: clean(name, 120), plaque: plate, motif: reason, statut: 'en_attente',
        ...(clean(lieu, 120) ? { lieu: clean(lieu, 120) } : {}),
    };
    await set(push(ref(database, `takeHomeCars/demandes/${user.uid}`)), entry);
    notifyGroup('administration', { type: 'demande', titre: 'Demande de Take Home Car', texte: `${entry.demandeurNom || 'Un membre du personnel'} — ${vehicleLabel(plate)}`, lien: { cible: 'takehome', section: 'manage' } });
    logActivity({ category: 'demandes', action: 'take_home_requested', severity: 'info', summary: `Demande de Take Home Car : ${plate}`, details: `Par : ${entry.demandeurNom || '—'}\n${reason}` });
    return entry;
}

// Le demandeur annule une demande en attente.
export async function cancelRequest(request) {
    await update(ref(database, `takeHomeCars/demandes/${request.uid}/${request.id}`), { statut: 'annule', finLe: Date.now(), finPar: 'demandeur' });
}

// Le demandeur rend le véhicule accordé : la demande se clôt et le véhicule redevient libre (une seule écriture).
export async function returnVehicle(request) {
    await update(ref(database, 'takeHomeCars'), {
        [`demandes/${request.uid}/${request.id}/statut`]: 'rendu',
        [`demandes/${request.uid}/${request.id}/finLe`]: Date.now(),
        [`demandes/${request.uid}/${request.id}/finPar`]: 'demandeur',
        [`attributions/${request.plaque}`]: null,
    });
    notifyGroup('administration', { type: 'statut', titre: 'Take Home Car rendu', texte: `${request.demandeurNom || ''} — ${vehicleLabel(request.plaque)}`, lien: { cible: 'takehome', section: 'manage' } });
    logActivity({ category: 'demandes', action: 'take_home_returned', severity: 'info', summary: `Take Home Car rendu : ${request.plaque}`, details: `Par : ${request.demandeurNom || '—'}` });
}

// La Direction accorde ou refuse. En cas d'accord, le véhicule est attribué dans la même écriture (refusé s'il est déjà pris).
export async function decideRequest(request, { accept, note, name }) {
    if (!auth.currentUser) throw new Error('Connexion requise.');
    if (request.statut !== 'en_attente') throw new Error("Cette demande n'est plus en attente.");
    const base = `demandes/${request.uid}/${request.id}`;
    const now = Date.now();
    const updates = {
        [`${base}/statut`]: accept ? 'accepte' : 'refuse',
        [`${base}/decisionLe`]: now,
        [`${base}/decisionParNom`]: clean(name, 120),
        [`${base}/decisionNote`]: clean(note, 300) || null,
    };
    if (accept) {
        const taken = await get(ref(database, `takeHomeCars/attributions/${request.plaque}`));
        if (taken.exists()) throw new Error(`${request.plaque} est déjà attribué à ${taken.val().nom || 'un autre membre du personnel'}.`);
        updates[`attributions/${request.plaque}`] = { uid: request.uid, nom: clean(request.demandeurNom, 120), depuis: now, demandeId: request.id };
    }
    await update(ref(database, 'takeHomeCars'), updates);
    notifyUser(request.uid, {
        type: 'statut',
        titre: accept ? `Take Home Car accordé : ${request.plaque}` : `Demande de Take Home Car refusée : ${request.plaque}`,
        texte: clean(note, 300) || undefined,
        lien: { cible: 'takehome' },
    });
    logActivity({
        category: 'demandes', action: accept ? 'take_home_accepted' : 'take_home_refused', severity: 'info',
        summary: `Take Home Car ${accept ? 'accordé' : 'refusé'} : ${request.plaque}`, details: `Demandeur : ${request.demandeurNom || '—'}\nPar : ${clean(name, 120) || '—'}`,
    });
}

// La Direction retire un véhicule accordé (la demande reste dans l'historique, avec le motif du retrait).
export async function withdrawVehicle(request, { note, name }) {
    if (!auth.currentUser) throw new Error('Connexion requise.');
    const base = `demandes/${request.uid}/${request.id}`;
    await update(ref(database, 'takeHomeCars'), {
        [`${base}/statut`]: 'retire',
        [`${base}/finLe`]: Date.now(),
        [`${base}/finPar`]: 'direction',
        [`${base}/finNote`]: clean(note, 300) || null,
        [`${base}/finParNom`]: clean(name, 120) || null,
        [`attributions/${request.plaque}`]: null,
    });
    notifyUser(request.uid, { type: 'statut', titre: `Take Home Car retiré : ${request.plaque}`, texte: clean(note, 300) || undefined, lien: { cible: 'takehome' } });
    logActivity({ category: 'demandes', action: 'take_home_withdrawn', severity: 'warning', summary: `Take Home Car retiré : ${request.plaque}`, details: `Membre : ${request.demandeurNom || '—'}\nPar : ${clean(name, 120) || '—'}\n${clean(note, 300)}` });
}
