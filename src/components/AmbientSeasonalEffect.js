import React, { useMemo } from 'react';
import Snowfall from 'react-snowfall';

// Génère à la volée une petite image (SVG en data URI) affichant un emoji, pour
// servir de particule à react-snowfall sans avoir besoin d'un asset PNG dédié
// par saison (voir HalloweenEffect.js pour l'équivalent avec un vrai fichier
// image). Simple et synchrone : pas de chargement réseau à attendre.
export const makeEmojiImage = (emoji, size) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
        + `<text x="50%" y="52%" font-size="${size * 0.85}" text-anchor="middle" dominant-baseline="central">${emoji}</text>`
        + `</svg>`;
    const img = document.createElement('img');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    img.width = size;
    img.height = size;
    return img;
};

// Effet de particules génériques (confettis, cœurs, feuilles, trèfles...) pour
// les périodes de l'année qui n'ont pas d'image PHMC dédiée : voir
// SeasonalEvents.js, qui choisit l'emoji et la densité selon la saison.
// `emojis` (liste) permet de mélanger plusieurs particules (ex. 🐟 et 🐠 pour le poisson d'avril).
const AmbientSeasonalEffect = ({ emoji, emojis, count = 30, size = 28, radius = [10, 20] }) => {
    const emojiKey = emojis ? emojis.join('|') : emoji;
    const images = useMemo(
        () => (emojis || [emoji]).map((item) => makeEmojiImage(item, size)),
        [emojiKey, size] // eslint-disable-line react-hooks/exhaustive-deps
    );

    return (
        <Snowfall
            style={{
                position: 'fixed',
                width: '100vw',
                height: '100vh',
                top: 0,
                left: 0,
                zIndex: 25,
            }}
            snowflakeCount={count}
            images={images}
            radius={radius}
        />
    );
};

export default AmbientSeasonalEffect;
