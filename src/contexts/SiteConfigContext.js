// src/contexts/SiteConfigContext.js
//
// Réglages d'affichage du site décidés par les admins (panneau admin → Affichage) et lus par tout le monde :
//   • bbcodeEnabled : accès au BBCode (copie, « Montrer BBCode », onglets BBCode, convertisseur Discord).
//     Désactivé, le site ne propose plus que l'aperçu et le téléchargement HTML.
// Stockés dans adminSettings/bbcodeAccess (lecture publique, écriture admin : voir database.rules.json). La dernière valeur
// connue est gardée dans le navigateur pour éviter un clignotement au chargement.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

const CACHE_KEY = 'siteConfig_bbcodeEnabled';
const SiteConfigContext = createContext({ bbcodeEnabled: true });

export const useSiteConfig = () => useContext(SiteConfigContext);

const readCache = () => {
    try { return localStorage.getItem(CACHE_KEY) !== 'false'; } catch (error) { return true; }
};

export const SiteConfigProvider = ({ children }) => {
    const [bbcodeEnabled, setBbcodeEnabled] = useState(readCache);

    useEffect(() => {
        const unsubscribe = onValue(ref(database, 'adminSettings/bbcodeAccess'), (snapshot) => {
            const value = snapshot.val();
            // Aucun réglage enregistré = comportement d'origine (BBCode disponible).
            const enabled = value ? value.enabled !== false : true;
            setBbcodeEnabled(enabled);
            try { localStorage.setItem(CACHE_KEY, String(enabled)); } catch (error) { /* stockage indisponible */ }
        }, (error) => console.warn('Réglage BBCode illisible :', error));
        return () => unsubscribe();
    }, []);

    return <SiteConfigContext.Provider value={{ bbcodeEnabled }}>{children}</SiteConfigContext.Provider>;
};
