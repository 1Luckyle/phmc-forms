// src/utils/lockdownGuard.js
//
// Confinement du site : état partagé hors de React, pour que les fonctions d'écriture de la Boîte à outils (CCTV, candidatures,
// contrats, dossiers patient, demandes…) puissent refuser d'agir pendant un confinement, même si un bouton avait été laissé actif.
// Posé par LockdownProvider ; levé depuis le panneau admin → Confinement (qui n'est pas concerné par ces gardes).
let active = false;
export const LOCK_MESSAGE = 'Action désactivée pendant le confinement du site.';
export const setLockdownActive = (value) => { active = !!value; };
export const isLockdownOn = () => active;
export const assertNotLocked = () => {
    if (active) {
        const error = new Error(LOCK_MESSAGE);
        error.code = 'lockdown';
        throw error;
    }
};
