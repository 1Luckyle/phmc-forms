// src/constants/activityCategories.js
//
// Catégories du journal d'activité (activityLogs). Partagé par l'écriture (utils/activityLog.js), le serveur
// (functions/index.js garde la même liste de clés) et le panneau admin (Admin/ActivityLog.js).
export const ACTIVITY_CATEGORIES = {
    auth:        { label: 'Connexions',               icon: 'fa-right-to-bracket',     color: '#58a6ff' },
    rapports:    { label: 'Rapports & formulaires',   icon: 'fa-file-medical',         color: '#3fb950' },
    recrutement: { label: 'Recrutement',              icon: 'fa-user-plus',            color: '#d2a8ff' },
    contrats:    { label: 'Contrats',                 icon: 'fa-file-signature',       color: '#a371f7' },
    comptes:     { label: 'Comptes & personnel',      icon: 'fa-users-gear',           color: '#79c0ff' },
    facturation: { label: 'Facturation & paiements',  icon: 'fa-file-invoice-dollar',  color: '#e3b341' },
    demandes:    { label: 'Demandes du site',         icon: 'fa-inbox',                color: '#ffa657' },
    securite:    { label: 'Sécurité incendie',        icon: 'fa-fire-extinguisher',    color: '#f0883e' },
    bingo:       { label: 'Bingo',                    icon: 'fa-dice',                 color: '#f778ba' },
    admin:       { label: 'Administration',           icon: 'fa-shield-halved',        color: '#ff9bce' },
    erreurs:     { label: 'Erreurs',                  icon: 'fa-triangle-exclamation', color: '#ff7b72' },
    systeme:     { label: 'Système (serveur)',        icon: 'fa-server',               color: '#8b949e' },
    divers:      { label: 'Divers',                   icon: 'fa-circle-info',          color: '#6e7681' },
};

export const ACTIVITY_SEVERITIES = {
    info:    { label: 'Info',        color: '#58a6ff' },
    success: { label: 'Succès',      color: '#3fb950' },
    warning: { label: 'Attention',   color: '#e3b341' },
    error:   { label: 'Erreur',      color: '#ff7b72' },
};

export const categoryInfo = (key) => ACTIVITY_CATEGORIES[key] || ACTIVITY_CATEGORIES.divers;
