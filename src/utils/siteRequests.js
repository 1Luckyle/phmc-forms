// src/utils/siteRequests.js
//
// Demandes envoyées depuis le site à l'équipe : vidéosurveillance (CCTV), bugs, idées de fonctionnalités,
// propositions de formulaires. Elles étaient auparavant postées uniquement sur Discord (donc perdues si le
// webhook disparaissait) : elles sont désormais enregistrées dans RTDB (siteRequests/{id}) et traitées dans le
// panneau admin → « Demandes du site ».
import { ref, push, set } from 'firebase/database';
import { database, auth } from '../firebase';
import { logActivity, getActivityActorName } from './activityLog';

export const REQUEST_TYPES = {

    bug:     { label: 'Bug',               icon: 'fa-bug',         color: '#ff7b72' },
    feature: { label: 'Fonctionnalité',    icon: 'fa-lightbulb',   color: '#e3b341' },
    form:    { label: 'Nouveau formulaire', icon: 'fa-file-circle-plus', color: '#d2a8ff' },
};

export const REQUEST_STATUSES = {
    nouveau:  { label: 'Nouvelle',  color: '#58a6ff' },
    en_cours: { label: 'En cours',  color: '#e3b341' },
    traite:   { label: 'Traitée',   color: '#3fb950' },
    refuse:   { label: 'Refusée',   color: '#ff7b72' },
};

// Les champs d'une demande sont des chaînes courtes ; le contenu long (BBCode/HTML d'un formulaire) est plafonné.
const clean = (value, max) => String(value ?? '').trim().slice(0, max);

// type : clé de REQUEST_TYPES. fields : [{ label, value }] — affichés tels quels dans le panneau admin, dans l'ordre
// (une liste, car RTDB range les clés d'un objet par ordre alphabétique).
// by : { name, discord? } (le nom affiché de la personne ; l'uid vient de la session).
// Renvoie { ok, id } — ok = false (sans exception) si la personne n'est pas connectée ou si Firebase refuse.
export const submitSiteRequest = async ({ type, title, fields, by = {} }) => {
    const user = auth.currentUser;
    if (!user) return { ok: false, reason: 'not-signed-in' };
    if (!REQUEST_TYPES[type]) return { ok: false, reason: 'bad-type' };
    const cleanFields = (fields || [])
        .map(({ label, value }) => ({ l: clean(label, 120), v: clean(value, 20000) }))
        .filter((field) => field.l && field.v);
    const entry = {
        type,
        status: 'nouveau',
        ts: Date.now(),
        title: clean(title, 200) || REQUEST_TYPES[type].label,
        by: { uid: user.uid, name: clean(by.name || getActivityActorName() || user.email || 'Inconnu', 120) },
        fields: cleanFields,
    };
    if (by.discord) entry.by.discord = clean(by.discord, 80);
    if (user.email) entry.by.email = clean(user.email, 120);
    try {
        const newRef = push(ref(database, 'siteRequests'));
        await set(newRef, entry);
        logActivity({
            category: 'demandes',
            action: `request_${type}`,
            summary: `${REQUEST_TYPES[type].label} : ${entry.title}`,
            target: newRef.key,
        });
        return { ok: true, id: newRef.key };
    } catch (error) {
        console.error('Envoi de la demande impossible :', error);
        return { ok: false, reason: 'write-failed', error };
    }
};
