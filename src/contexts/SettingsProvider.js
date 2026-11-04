import React, { createContext, useState, useContext, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const [seasonalEffectsEnabled, setSeasonalEffectsEnabled] = useState(() => {
        // Default to true if the setting isn't found in localStorage
        return localStorage.getItem('seasonalEffectsEnabled') !== 'false';
    });

    const toggleSeasonalEffects = () => {
        const newValue = !seasonalEffectsEnabled;
        setSeasonalEffectsEnabled(newValue);
        localStorage.setItem('seasonalEffectsEnabled', String(newValue));
    };

    // En-tête : par défaut, et pour tout le monde, l'en-tête « immersif » (identité, horloge du serveur, météo). Les admins peuvent rétablir le CHOIX
    // avec l'en-tête de remerciements (Admin → Affichage, adminSettings/headerChoice) : chacun retrouve alors le bouton, et sa préférence (mémorisée
    // dans son navigateur) s'applique ; sans préférence, c'est la météo.
    const [headerChoiceEnabled, setHeaderChoiceEnabled] = useState(false);
    useEffect(() => {
        const unsubscribe = onValue(
            ref(database, 'adminSettings/headerChoice'),
            (snapshot) => setHeaderChoiceEnabled(snapshot.val()?.enabled === true),
            () => setHeaderChoiceEnabled(false)
        );
        return () => unsubscribe();
    }, []);
    const [storedImmersive, setStoredImmersive] = useState(() => localStorage.getItem('immersiveHeaderEnabled'));
    const immersiveHeaderEnabled = headerChoiceEnabled ? storedImmersive !== 'false' : true;

    const toggleImmersiveHeader = () => {
        const newValue = String(!immersiveHeaderEnabled);
        setStoredImmersive(newValue);
        localStorage.setItem('immersiveHeaderEnabled', newValue);
    };

    const value = {
        seasonalEffectsEnabled,
        toggleSeasonalEffects,
        immersiveHeaderEnabled,
        headerChoiceEnabled,
        toggleImmersiveHeader,
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
