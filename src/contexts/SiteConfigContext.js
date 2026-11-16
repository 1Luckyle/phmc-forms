// src/contexts/SiteConfigContext.js
//
// Réglages d'affichage du site décidés par les admins (panneau admin → Affichage) et lus par tout le monde :
//   • bbcodeEnabled : accès au BBCode (copie, « Montrer BBCode », onglets BBCode, convertisseur Discord).
//     Désactivé, le site ne propose plus que l'aperçu et le téléchargement HTML.
//   • pbcEnabled : formulaires de la clinique de Paleto Bay (PBC) et choix « PBC » des candidatures. Désactivé, personne n'y accède (les agences à choisir comme
//     destinataire ou requérant restent proposées). Stocké dans adminSettings/pbcAccess.
//   • bingoEnabled : bouton d'accès au Bingo. Désactivé, il disparaît pour le personnel (les admins le gardent, grisé). Stocké dans adminSettings/bingoAccess.
// Stockés dans adminSettings/bbcodeAccess (lecture publique, écriture admin : voir database.rules.json). La dernière valeur
// connue est gardée dans le navigateur pour éviter un clignotement au chargement.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

const CACHE_KEY = 'siteConfig_bbcodeEnabled';
const PBC_CACHE_KEY = 'siteConfig_pbcEnabled';
const BINGO_CACHE_KEY = 'siteConfig_bingoEnabled';
const SiteConfigContext = createContext({ bbcodeEnabled: true, pbcEnabled: true, bingoEnabled: true });

export const useSiteConfig = () => useContext(SiteConfigContext);

const readCache = (key = CACHE_KEY) => {
    try { return localStorage.getItem(key) !== 'false'; } catch (error) { return true; }
};

export const SiteConfigProvider = ({ children }) => {
    const [bbcodeEnabled, setBbcodeEnabled] = useState(() => readCache(CACHE_KEY));
    const [pbcEnabled, setPbcEnabled] = useState(() => readCache(PBC_CACHE_KEY));
    const [bingoEnabled, setBingoEnabled] = useState(() => readCache(BINGO_CACHE_KEY));

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

    useEffect(() => {
        const unsubscribe = onValue(ref(database, 'adminSettings/pbcAccess'), (snapshot) => {
            const value = snapshot.val();
            // Aucun réglage enregistré = comportement d'origine (formulaires PBC disponibles).
            const enabled = value ? value.enabled !== false : true;
            setPbcEnabled(enabled);
            try { localStorage.setItem(PBC_CACHE_KEY, String(enabled)); } catch (error) { /* stockage indisponible */ }
        }, (error) => console.warn('Réglage PBC illisible :', error));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = onValue(ref(database, 'adminSettings/bingoAccess'), (snapshot) => {
            const value = snapshot.val();
            // Aucun réglage enregistré = comportement d'origine (Bingo disponible).
            const enabled = value ? value.enabled !== false : true;
            setBingoEnabled(enabled);
            try { localStorage.setItem(BINGO_CACHE_KEY, String(enabled)); } catch (error) { /* stockage indisponible */ }
        }, (error) => console.warn('Réglage Bingo illisible :', error));
        return () => unsubscribe();
    }, []);

    return <SiteConfigContext.Provider value={{ bbcodeEnabled, pbcEnabled, bingoEnabled }}>{children}</SiteConfigContext.Provider>;
};
