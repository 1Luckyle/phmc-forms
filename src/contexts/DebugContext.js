// src/contexts/DebugContext.js
//
// Interrupteur global "remplissage automatique de debug" : quand il est activé
// depuis le panneau admin (section "Debug"), le bouton « Remplir (debug) » apparaît
// sur chaque formulaire et modale, mais UNIQUEMENT pour les personnes de la liste
// blanche (WL) gérée au même endroit. Cela permet de tester directement en
// production sans exposer le bouton aux autres utilisateurs.
//
// Stocké dans adminSettings/debugAutofill :
//   { enabled, updatedBy, updatedAt, allowed: { [uid]: { label, addedBy, addedAt } } }
// (lecture publique, écriture admin uniquement — voir database.rules.json, nœud
// adminSettings). Le remplissage lui-même est 100 % local au navigateur : aucune
// donnée n'est envoyée, la WL ne protège donc qu'un confort d'usage, pas un secret.
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ref, onValue, update, set, remove } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { database, auth } from '../firebase';

const DEBUG_PATH = 'adminSettings/debugAutofill';
// Second interrupteur : permet de SUPPRIMER une candidature dans l'historique (nettoyage des
// candidatures de test). Les règles Firebase ne l'autorisent que tant qu'il est activé.
const DEBUG_DELETE_APPLICATIONS_PATH = 'adminSettings/debugDeleteApplications';

const DebugContext = createContext({
    debugAutofillEnabled: false,
    setDebugAutofillEnabled: async () => {},
    debugAutofillAllowed: {},
    canUseDebugFill: false,
    addDebugAutofillUser: async () => {},
    removeDebugAutofillUser: async () => {},
    debugDeleteApplicationsEnabled: false,
    setDebugDeleteApplicationsEnabled: async () => {},
});

export const useDebug = () => useContext(DebugContext);

export const DebugProvider = ({ children }) => {
    const [debugAutofillEnabled, setEnabled] = useState(false);
    const [debugAutofillAllowed, setAllowed] = useState({});
    const [uid, setUid] = useState(null);
    const [debugDeleteApplicationsEnabled, setDeleteEnabled] = useState(false);

    // Compte connecté (toutes méthodes de connexion confondues) : sert à tester l'appartenance à la WL.
    useEffect(() => onAuthStateChanged(auth, (user) => setUid(user ? user.uid : null)), []);

    useEffect(() => {
        const unsubscribe = onValue(
            ref(database, DEBUG_PATH),
            (snapshot) => {
                const value = snapshot.val();
                setEnabled(value?.enabled === true);
                setAllowed(value?.allowed && typeof value.allowed === 'object' ? value.allowed : {});
            },
            // Lecture refusée / hors-ligne : on retombe sur "désactivé".
            () => { setEnabled(false); setAllowed({}); }
        );
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = onValue(
            ref(database, DEBUG_DELETE_APPLICATIONS_PATH),
            (snapshot) => setDeleteEnabled(snapshot.val()?.enabled === true),
            () => setDeleteEnabled(false)
        );
        return () => unsubscribe();
    }, []);

    const setDebugDeleteApplicationsEnabled = useCallback(async (enabled, updatedBy = null) => {
        await set(ref(database, DEBUG_DELETE_APPLICATIONS_PATH), {
            enabled: Boolean(enabled),
            updatedBy: updatedBy || null,
            updatedAt: Date.now(),
        });
    }, []);

    // Réservé aux admins (les règles Firebase refusent l'écriture aux autres).
    // update() et non set() : set() écraserait la liste blanche stockée sous le même nœud.
    const setDebugAutofillEnabled = useCallback(async (enabled, updatedBy = null) => {
        await update(ref(database, DEBUG_PATH), {
            enabled: Boolean(enabled),
            updatedBy: updatedBy || null,
            updatedAt: Date.now(),
        });
    }, []);

    const addDebugAutofillUser = useCallback(async (userUid, label = '', addedBy = null) => {
        if (!userUid) return;
        await set(ref(database, `${DEBUG_PATH}/allowed/${userUid}`), {
            label: label || '',
            addedBy: addedBy || null,
            addedAt: Date.now(),
        });
    }, []);

    const removeDebugAutofillUser = useCallback(async (userUid) => {
        if (!userUid) return;
        await remove(ref(database, `${DEBUG_PATH}/allowed/${userUid}`));
    }, []);

    // Le bouton n'est affiché que si le mode est actif ET que la personne connectée est dans la WL.
    const canUseDebugFill = useMemo(
        () => debugAutofillEnabled && !!uid && !!debugAutofillAllowed[uid],
        [debugAutofillEnabled, uid, debugAutofillAllowed]
    );

    return (
        <DebugContext.Provider value={{
            debugAutofillEnabled, setDebugAutofillEnabled,
            debugAutofillAllowed, canUseDebugFill, addDebugAutofillUser, removeDebugAutofillUser,
            debugDeleteApplicationsEnabled, setDebugDeleteApplicationsEnabled,
        }}>
            {children}
        </DebugContext.Provider>
    );
};
