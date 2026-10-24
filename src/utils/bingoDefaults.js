// src/utils/bingoDefaults.js
//
// 24 phrases par défaut pour chaque carte de bingo (Urgences, EMS, Médecine légale). Une carte compte 24 cases (la case
// centrale est libre) : avec ces listes, un admin peut générer une carte même quand la liste principale est vide ou trop courte.
// L'ajout ne remplace jamais les phrases déjà présentes : il n'ajoute que celles qui manquent.
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';

export const DEFAULT_BINGO_PHRASES = {
    ER: [
        'Un patient arrive en disant « ce n\'est rien, juste une égratignure » avec un os apparent',
        'Quelqu\'un demande combien de temps d\'attente il reste alors que la salle est vide',
        'Le patient jure « n\'avoir rien bu » (l\'haleine dit le contraire)',
        'Un patient refuse de donner son identité',
        'Un patient se déclare « allergique à tout »',
        'Une ambulance arrive sans prévenir',
        'Un patient exige de voir « le vrai médecin »',
        'Un patient veut partir contre avis médical (AMA)',
        'Un patient arrive menotté, escorté par la police',
        'Une blessure par balle « tombé sur un clou »',
        'Un proche s\'évanouit à la vue du sang',
        'Il n\'y a plus de compresses en réserve',
        'Le scanner ou la radio est en panne',
        'Un patient réclame des antidouleurs puissants sans raison',
        'Une pause café interrompue par un code rouge',
        'Un patient prétend être médecin',
        '« C\'est urgent, j\'ai rendez-vous dans une heure »',
        'Un patient confond l\'accueil avec un hôtel',
        'Un dossier patient arrive incomplet',
        'Un patient est transféré en hélicoptère',
        'Un patient arrive après une bagarre de bar',
        'Un patient s\'est fait mordre par un animal improbable',
        'Un patient demande un arrêt de travail pour « une migraine »',
        'Un patient donne un faux nom évident',
    ],
    EMS: [
        'Arrivée sur place avant la police, zone non sécurisée',
        'Le patient refuse d\'être transporté',
        'Appel pour un « malaise » : un simple coup de chaud',
        'Une course-poursuite passe juste derrière l\'ambulance',
        'Un badaud filme toute l\'intervention',
        'Le patient donne une fausse adresse',
        'L\'ambulance reste coincée dans les embouteillages',
        'Un blessé par balle qui « n\'a rien vu »',
        'Un renfort immédiat est nécessaire',
        'Intervention en plein milieu de l\'autoroute',
        'Un patient inconscient après une soirée trop arrosée',
        'Un accident de la route impliquant plusieurs véhicules',
        'Le patient vomit dans l\'ambulance',
        'Plus aucun brancard disponible',
        'Un patient agressif envers l\'équipe',
        'Une scène de crime découverte pendant l\'intervention',
        'Un transport vers le mauvais hôpital',
        'Un appel en pleine nuit pour un simple rhume',
        'Un patient qui connaît le protocole mieux que vous',
        'L\'ambulance tombe en panne d\'essence',
        'La radio grésille sans qu\'on comprenne un mot',
        'Une naissance dans l\'ambulance',
        'Un patient a avalé quelque chose d\'improbable',
        'Un chien « de garde » bloque l\'entrée de la maison',
    ],
    Coroner: [
        'Une demande d\'autopsie sans motif clair',
        'Un officier demande les résultats « pour hier »',
        'Un rapport de décès sans nom ni identité',
        'Un corps arrive sans aucun dossier',
        'Un John ou une Jane Doe sans le moindre indice',
        'Cause du décès : « les circonstances restent à déterminer »',
        'Un témoin change sa version des faits',
        'Les photos de la scène sont floues',
        'Le formulaire est rempli en majuscules',
        'Une demande de certificat de décès « urgente »',
        'Une famille conteste la cause du décès',
        'Un dossier public de décès à publier',
        'Un appel en pleine nuit pour se rendre sur place',
        'Une demande d\'exhumation',
        'Plusieurs victimes pour un seul incident',
        'Cause du décès : « arrêt cardiaque » (comme tout le monde)',
        'Un PK ou un CK qui demande une autopsie',
        'La morgue est pleine',
        'Un policier arrive avec des preuves non scellées',
        'Un faux rapport découvert dans le dossier',
        'Fausse alerte : le défunt est en fait bien vivant',
        'Un décès sans lien déclaré avec une enquête',
        'Une analyse toxicologique est demandée',
        'Une réclamation contre un rapport déjà publié',
    ],
};

// Phrases déjà enregistrées (tableau, ou objet de phrases / d'objets { phrase }) → tableau de textes.
const toPhraseArray = (value) => {
    if (!value) return [];
    const list = Array.isArray(value) ? value : Object.values(value);
    return list.map((entry) => (entry && typeof entry === 'object' ? entry.phrase : entry))
        .filter((phrase) => typeof phrase === 'string' && phrase.trim() !== '');
};

const normalizePhrase = (phrase) => phrase.trim().toLowerCase();

// Ajoute à bingo/phrases/{type} les phrases par défaut qui n'y sont pas déjà. `types` : [{ path, name }].
// → [{ name, before, added, total }]
export async function seedDefaultBingoPhrases(types) {
    const results = [];
    for (const type of types) {
        const defaults = DEFAULT_BINGO_PHRASES[type.path] || [];
        const phraseRef = ref(database, `bingo/phrases/${type.path}`);
        // eslint-disable-next-line no-await-in-loop
        const snapshot = await get(phraseRef);
        const existing = toPhraseArray(snapshot.exists() ? snapshot.val() : null);
        const known = new Set(existing.map(normalizePhrase));
        const missing = defaults.filter((phrase) => !known.has(normalizePhrase(phrase)));
        if (missing.length > 0) {
            // eslint-disable-next-line no-await-in-loop
            await set(phraseRef, [...existing, ...missing]);
        }
        results.push({ name: type.name, before: existing.length, added: missing.length, total: existing.length + missing.length });
    }
    return results;
}
