import React, { createContext, useState, useContext } from 'react';

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

    // En-tête « immersif » (identité, horloge du serveur, météo) à la place de l'en-tête de remerciements. Désactivé par défaut.
    const [immersiveHeaderEnabled, setImmersiveHeaderEnabled] = useState(() => localStorage.getItem('immersiveHeaderEnabled') === 'true');

    const toggleImmersiveHeader = () => {
        const newValue = !immersiveHeaderEnabled;
        setImmersiveHeaderEnabled(newValue);
        localStorage.setItem('immersiveHeaderEnabled', String(newValue));
    };

    const value = {
        seasonalEffectsEnabled,
        toggleSeasonalEffects,
        immersiveHeaderEnabled,
        toggleImmersiveHeader,
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
