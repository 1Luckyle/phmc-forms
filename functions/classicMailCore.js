// functions/classicMailCore.js
//
// VERSION CLASSIQUE du site (sans Eyefind) : un mail du site dont le destinataire n'a AUCUN autre avis sur le site devient une notification de son compte
// (functions/index.js : mailAsNotificationInClassic). Fonctions pures, testées depuis src/utils/classicMailCore.test.js.
//
// Modèles convertis (modèle → type de notification et lien). Les autres modèles ont déjà leur notification, posée par le code qui envoie le mail
// (contrats, Take Home Car, suivi des candidatures, décisions d'exemption, paiements, rappels planifiés), ou visent un compte supprimé.
export const CLASSIC_NOTIFY_TEMPLATES = {
    compte_approuve: { type: 'compte' },
    compte_refuse: { type: 'compte' },
    grade_modifie: { type: 'compte' },
    compte_converti_personnel: { type: 'compte' },
    fin_fonctions_compte_civil: { type: 'compte' },
    rapport_enregistre_admin: { type: 'statut', lien: { cible: 'rapports' } },
    candidature_recue: { type: 'recrutement', lien: { cible: 'candidature' } },
    exemption_demande_recue: { type: 'statut' },
    recrutement_interne_accorde: { type: 'recrutement' },
    recrutement_interne_refuse: { type: 'recrutement' },
};

// Texte brut d'un mail pour la cloche : sans la formule d'appel, sans mise en forme, liens réduits à leur texte, 400 caractères au plus.
export const mailTextForNotification = (body) => String(body || '')
    .replace(/^\s*Bonjour[^\n]*\n+/i, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, 400);

// Variables d'un modèle envoyées par le navigateur : 15 au plus, clés simples, texte court.
export const cleanTemplateVars = (input) => {
    const vars = {};
    Object.entries(input && typeof input === 'object' ? input : {}).slice(0, 15).forEach(([key, value]) => {
        if (/^[a-z_]{1,30}$/.test(key) && ['string', 'number'].includes(typeof value)) vars[key] = String(value).slice(0, 200);
    });
    return vars;
};
