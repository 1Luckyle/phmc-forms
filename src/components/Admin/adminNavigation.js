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
        key: 'site',
        label: 'Site',
        items: [
            {
                key: 'serviceStatus', icon: 'fa-server', label: 'Statut du service',
                description: "Les messages d'état affichés par le site selon l'endroit où il est hébergé.",
                keywords: 'état disponibilité déploiement bandeau',
            },
            {
                key: 'lockdown', icon: 'fa-lock', label: 'Confinement',
                description: 'Verrouiller temporairement le site, avec un message pour les visiteurs.',
                keywords: 'maintenance verrouillage blocage',
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
            {
                key: 'webhooks', icon: 'fa-bullhorn', label: 'Webhooks Discord',
                description: "Canaux Discord de notification, envoi de messages et journal des envois.",
                keywords: 'discord notification canal message journal',
            },
            {
                key: 'database', icon: 'fa-database', label: 'Base de données',
                description: 'Explorateur et éditeur de la base Firebase (à manier avec précaution).',
                keywords: 'firebase realtime edition données',
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
                description: "Échange de données utilisateur, test CCTV, test d'erreur Sentry.",
                keywords: 'sentry cctv échange',
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
