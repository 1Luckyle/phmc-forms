// src/contexts/DebugContext.js
//
// Interrupteur global "remplissage automatique de debug" : quand il est activé
// depuis le panneau admin (section "Debug"), TOUT le monde (visiteur, civil,
// employé, admin) voit un bouton « Remplir (debug) » sur chaque formulaire et
// modale, pour tester les formulaires ET les permissions de chaque rôle.
//
// Stocké dans adminSettings/debugAutofill (lecture publique, écriture admin
// uniquement — voir database.rules.json, nœud adminSettings). Le remplissage
// lui-même est 100 % local au navigateur : aucune donnée n'est envoyée.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { database } from '../firebase';

const DEBUG_PATH = 'adminSettings/debugAutofill';
// Second interrupteur : permet de SUPPRIMER une candidature dans l'historique (nettoyage des
// candidatures de test). Les règles Firebase ne l'autorisent que tant qu'il est activé.
const DEBUG_DELETE_APPLICATIONS_PATH = 'adminSettings/debugDeleteApplications';

const DebugContext = createContext({
    debugAutofillEnabled: false,
    setDebugAutofillEnabled: async () => {},
    debugDeleteApplicationsEnabled: false,
    setDebugDeleteApplicationsEnabled: async () => {},
});

export const useDebug = () => useContext(DebugContext);

export const DebugProvider = ({ children }) => {
    const [debugAutofillEnabled, setEnabled] = useState(false);
    const [debugDeleteApplicationsEnabled, setDeleteEnabled] = useState(false);

    useEffect(() => {
        const unsubscribe = onValue(
            ref(database, DEBUG_PATH),
            (snapshot) => setEnabled(snapshot.val()?.enabled === true),
            // Lecture refusée / hors-ligne : on retombe sur "désactivé".
            () => setEnabled(false)
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
    const setDebugAutofillEnabled = useCallback(async (enabled, updatedBy = null) => {
        await set(ref(database, DEBUG_PATH), {
            enabled: Boolean(enabled),
            updatedBy: updatedBy || null,
            updatedAt: Date.now(),
        });
    }, []);

    return (
        <DebugContext.Provider value={{ debugAutofillEnabled, setDebugAutofillEnabled, debugDeleteApplicationsEnabled, setDebugDeleteApplicationsEnabled }}>
            {children}
        </DebugContext.Provider>
    );
};
