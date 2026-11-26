// functions/discordCore.js
//
// VERSION CLASSIQUE du site (sans GTA World) : connexion et création de compte avec Discord. Fonctions PURES (sans Firebase), testées
// depuis src/utils/discordCore.test.js ; les Cloud Functions de functions/index.js (discordExchange, discordCreateCivil,
// discordRequestStaff, discordApproveStaff) s'en servent.
//
// Modèle : un compte Discord porte des PERSONNAGES, enregistrés côté serveur seulement (discordPersonnages/{discordId}/{persoId}) :
//   { prenom, nom, patientID, email, uid?, creeLe }
//   • patientID : donné à la création du personnage et CONSERVÉ pour toujours, même si le compte est supprimé : en recréant un compte
//     pour ce personnage, la personne retrouve son ID (et ses archives) ;
//   • email : adresse FICTIVE prenom.nom@phmc.health, réservée au premier compte ou à la première demande (identifiant Firebase, ne
//     reçoit rien) ;
//   • uid : le compte de connexion du personnage (Civil, ou Personnel après validation / conversion).
// Discord ne sert qu'à prouver l'identité du joueur : aucun rôle, aucun serveur, aucune adresse mail ne sont demandés (portée « identify »).
export const FAKE_EMAIL_DOMAIN = 'phmc.health';
export const TICKET_TTL_MS = 30 * 60 * 1000;
export const MAX_CHARACTERS = 10;

// Prénom / nom d'un personnage : lettres (accents compris), espaces, tirets, apostrophes ; 1 à 40 caractères.
export const cleanName = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
export const isValidName = (value) => /^[\p{L}][\p{L}' -]{0,39}$/u.test(cleanName(value));

// « Élodie-Anne », « O'Brien » → « elodieanne », « obrien » (sans accent ni séparateur, comme une adresse de messagerie).
const slug = (value) => cleanName(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// prenom.nom@phmc.health ; en cas de doublon : prenom.nom2@phmc.health, prenom.nom3@… (taken : adresses déjà prises, en minuscules).
export const fakeEmailFor = (firstName, lastName, taken = new Set()) => {
    const base = [slug(firstName), slug(lastName)].filter(Boolean).join('.') || 'patient';
    for (let n = 1; n < 1000; n += 1) {
        const candidate = `${base}${n === 1 ? '' : n}@${FAKE_EMAIL_DOMAIN}`;
        if (!taken.has(candidate)) return candidate;
    }
    throw new Error('Aucune adresse disponible pour ce nom.');
};

// Clé d'un nœud dérivée d'une adresse (même règle que le site : . # $ [ ] → _).
export const emailKeyOf = (email) => String(email || '').replace(/[.#$[\]]/g, '_');

const text = (value, max) => String(value ?? '').trim().slice(0, max);

// Profil Civil saisi par la personne : seuls ces champs sont repris (identité et nom viennent du personnage, jamais du client).
export const sanitizeCivilProfile = (profile = {}) => ({
    middleName: text(profile.middleName, 40),
    dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(String(profile.dateOfBirth || '')) ? profile.dateOfBirth : '',
    gender: ['Male', 'Female', 'Other'].includes(profile.gender) ? profile.gender : '',
    address: text(profile.address, 120),
    zip: text(profile.zip, 20),
    phone: text(profile.phone, 30),
    discord: text(profile.discord, 60),
});

// Demande de compte du personnel : champs repris de la saisie (le nom vient du personnage).
export const sanitizeStaffRequest = (request = {}) => {
    const out = {
        discord: text(request.discord, 60),
        phNumber: text(request.phNumber, 30),
        rank: text(request.rank, 80),
        category: text(request.rank, 80),
        badge: text(request.badge, 20),
    };
    ['middleName', 'address', 'zip'].forEach((field) => { const value = text(request[field], field === 'address' ? 120 : 40); if (value) out[field] = value; });
    return out;
};

// Titre des médecins (« Dr. », « Pr. »), ajouté au prénom de la DEMANDE seulement (le personnage garde son nom) : même forme que
// applyTitlePrefix (src/constants/ranks.js). Toute autre valeur est ignorée.
export const TITLE_PREFIXES = ['Dr.', 'Pr.'];
export const withTitlePrefix = (firstName, title) => (TITLE_PREFIXES.includes(title) ? `${title} ${firstName}`.trim() : firstName);

// Même personne ? Mêmes mots du nom (dans n'importe quel ordre), ou tous les mots du nom le plus court (deux au moins) retrouvés dans l'autre.
// Même règle que namesMatch de src/utils/temporaryIds.js : sert à signaler aux admins les ID temporaires qui portent le nom d'un nouveau personnage.
const nameWords = (name) => String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
export const namesMatch = (a, b) => {
    const first = new Set(nameWords(a));
    const second = new Set(nameWords(b));
    if (!first.size || !second.size) return false;
    const [small, large] = first.size <= second.size ? [first, second] : [second, first];
    return [...small].every((word) => large.has(word)) && (small.size === large.size || small.size >= 2);
};

// ID temporaires encore ouverts du registre (identifiantsTemporaires) qui portent ce nom : [{ id, nom }].
export const openTemporaryIdsFor = (registry = {}, name = '') => Object.entries(registry || {})
    .filter(([, entry]) => entry && entry.statut !== 'attribue' && entry.nom && namesMatch(entry.nom, name))
    .map(([id, entry]) => ({ id, nom: entry.nom }));

// Vue d'un personnage renvoyée au navigateur (account : { type, label, customToken } s'il a un compte actif).
export const characterView = (persoId, entry, { account = null, pending = false } = {}) => ({
    id: persoId,
    firstName: entry.prenom || '',
    lastName: entry.nom || '',
    patientID: entry.patientID || '',
    account,
    // Demande de compte du personnel en attente (le personnage peut avoir en même temps son compte Civil).
    pending: !!pending,
});
