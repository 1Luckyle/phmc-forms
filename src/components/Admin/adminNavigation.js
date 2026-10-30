// src/components/Admin/adminNavigation.js
//
// Plan du panneau admin : les sections sont rangées par thème (à traiter, personnes, site, outils, développement).
// Les clés de section ne changent pas (« debug », « users »…) : d'autres écrans y renvoient (ex. la sortie du mode « visualiser en tant que »).
export const ADMIN_SECTION_GROUPS = [
    {
        key: 'home',
        label: 'Accueil',
        items: [
            {
                key: 'overview', icon: 'fa-gauge-high', label: "Vue d'ensemble",
                description: "L'état du site et les demandes à traiter, d'un coup d'œil.",
                keywords: 'accueil résumé tableau de bord statut',
            },
        ],
    },
    {
        key: 'requests',
        label: 'À traiter',
        items: [
            {
                key: 'pendingAccounts', icon: 'fa-user-clock', label: 'Demandes de compte', badge: 'accounts',
                description: 'Valider ou refuser les demandes de création de compte du personnel.',
                keywords: 'inscription approbation personnel compte nouveau',
            },
            {
                key: 'pendingModifications', icon: 'fa-pen-to-square', label: 'Demandes de modification', badge: 'modifications',
                description: 'Modifications de fiche demandées par le personnel, à valider.',
                keywords: 'fiche profil changement',
            },
            {
                key: 'siteRequests', icon: 'fa-inbox', label: 'Demandes du site', badge: 'requests',
                description: 'Bugs, idées de fonctionnalités et propositions de nouveaux formulaires envoyés par les utilisateurs.',
                keywords: 'bug fonctionnalité suggestion ticket formulaire idée',
            },
            {
                key: 'imageCleanup', icon: 'fa-images', label: 'Images à supprimer', badge: 'images',
                description: 'Images imgBB à retirer à la main (cartes de visite et signatures remplacées).',
                keywords: 'imgbb nettoyage carte signature',
            },
        ],
    },
    {
        key: 'people',
        label: 'Personnes & accès',
        items: [
            {
                key: 'users', icon: 'fa-users-gear', label: 'Utilisateurs',
                description: 'Personnel, civils, rôles, recruteurs, comptes liés et outils de migration.',
                keywords: 'personnel civil rôle grade recruteur compte migration badge',
            },
            {
                key: 'authMethods', icon: 'fa-key', label: 'Méthodes de connexion',
                description: 'Connexion par GTA World seulement, ou aussi par e-mail et mot de passe.',
                keywords: 'login gta world email mot de passe',
            },
        ],
    },
    {
        key: 'tracking',
        label: 'Suivi',
        items: [
            {
                key: 'errors', icon: 'fa-triangle-exclamation', label: 'Erreurs du site',
                description: "Erreurs rencontrées par les utilisateurs connectés (page, navigateur, pile d'appels), sur les 30 derniers jours.",
                keywords: 'erreur bug crash sentry exception plantage',
            },
            {
                key: 'activity', icon: 'fa-clock-rotate-left', label: "Journal d'activité",
                description: 'Qui a fait quoi, et quand : connexions, rapports, candidatures, paiements, actions admin, erreurs.',
                keywords: 'logs historique audit traçabilité événements actions erreurs journal',
            },
        ],
    },
    {
        key: 'site',
        label: 'Site',
        items: [
            {
                key: 'lockdown', icon: 'fa-lock', label: 'Confinement',
                description: 'Verrouiller temporairement le site, avec un message pour les visiteurs.',
                keywords: 'maintenance verrouillage blocage',
            },
            {
                key: 'pricing', icon: 'fa-coins', label: 'Tarifs des formulaires',
                description: "Les montants demandés aux patients et aux demandeurs (dossiers médicaux, divulgation, frais d'autopsie…).",
                keywords: 'prix tarif coût montant argent paiement fleeca facture dossier médical autopsie dollars',
            },
            {
                key: 'cities', icon: 'fa-city', label: 'Villes & codes postaux',
                description: 'La liste des villes proposées dans les formulaires : le code postal se remplit tout seul.',
                keywords: 'ville adresse code postal zip quartier',
            },
            {
                key: 'mails', icon: 'fa-envelope-open-text', label: 'E-mails',
                description: 'Tous les mails envoyés par le système : quand ils partent, à qui, leur aperçu, et leur texte modifiable.',
                keywords: 'mail e-mail email courrier eyefind message notification modèle texte aperçu envoi candidature compte facture code vérification',
            },
            {
                key: 'privacyPolicy', icon: 'fa-user-shield', label: 'Politique de confidentialité',
                description: "Le texte de la politique, affiché dans le pied de page et dans le guide de configuration : une seule modification pour tous.",
                keywords: 'confidentialité politique données personnelles rgpd vie privée mentions légales texte conditions',
            },
            {
                key: 'transparency', icon: 'fa-scale-balanced', label: 'Transparence',
                description: "La page publique de l'établissement : direction, grille des rémunérations et comptes trimestriels.",
                keywords: 'transparence grille salariale salaire échelon comptes trimestre recettes dépenses direction publication',
            },
            {
                key: 'display', icon: 'fa-sliders', label: 'Affichage & BBCode',
                description: "Réglages d'affichage communs à tous : accès au BBCode ou HTML et aperçu seulement.",
                keywords: 'bbcode html aperçu copie convertisseur',
            },
        ],
    },
    {
        key: 'tools',
        label: 'Outils',
        items: [
            {
                key: 'bingo', icon: 'fa-dice', label: 'Bingo',
                description: 'Cartes de bingo du personnel, journal, phrases et demandes de révision.',
                keywords: 'jeu cartes phrases',
            },
        ],
    },
    {
        key: 'dev',
        label: 'Développement',
        items: [
            {
                key: 'debug', icon: 'fa-bug', label: 'Mode debug & simulation',
                description: 'Remplissage de test, effets de saison, « visualiser en tant que ».',
                keywords: 'test simulation saison autofill whitelist rôle',
            },
            {
                key: 'dev', icon: 'fa-code', label: 'Outils développeur',
                description: "Échange de données utilisateur, test d'erreur Sentry.",
                keywords: 'sentry échange',
            },
        ],
    },
];

export const ALL_ADMIN_SECTIONS = ADMIN_SECTION_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label, groupKey: group.key })));

export const findAdminSection = (key) => ALL_ADMIN_SECTIONS.find((section) => section.key === key) || ALL_ADMIN_SECTIONS[0];

const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Sections dont le nom, la description ou les mots-clés contiennent la recherche (sans tenir compte des accents).
export const filterAdminSections = (query) => {
    const needle = normalize(query).trim();
    if (!needle) return null;
    return ALL_ADMIN_SECTIONS.filter((section) => normalize(`${section.label} ${section.description} ${section.keywords} ${section.group}`).includes(needle));
};
