import React, { useMemo } from 'react';
import Snowfall from 'react-snowfall';
import { getEventEffectEmoji } from '../data/awarenessEvents';
import { makeEmojiImage } from './AmbientSeasonalEffect';

// Effet de saison piloté par le calendrier de la santé : pour chaque événement en cours, une
// particule à ses couleurs (ruban) ou à son emblème (emoji). Plusieurs événements = particules
// mélangées à parts égales ; le total reste plafonné (au-delà d'une trentaine d'éléments animés,
// les machines moins puissantes ralentissent).
const MAX_PARTICLES = 28;
const RADIUS = [10, 24];

const channel = (hex, start) => parseInt(hex.slice(start, start + 2), 16);
const darken = (hex, factor = 0.62) => {
    const clean = hex.length === 7 ? hex : '#888888';
    return `rgb(${Math.round(channel(clean, 1) * factor)},${Math.round(channel(clean, 3) * factor)},${Math.round(channel(clean, 5) * factor)})`;
};

// Ruban SVG (deux brins qui se croisent). Une couleur : liseré plus foncé ; plusieurs : liseré = 1re
// couleur, cœur = 2e, filet central = 3e (ex. ruban bleu-rose-vert des maladies rares).
const makeRibbonImage = (colors, size) => {
    const hexes = colors.map((c) => c.hex);
    const outer = hexes.length > 1 ? hexes[0] : darken(hexes[0]);
    const middle = hexes.length > 1 ? hexes[1] : hexes[0];
    const strands = (stroke, width) => (
        `<path d="M32 8 C22 8 16 16 20 26 C24 36 36 44 44 58" stroke="${stroke}" stroke-width="${width}"/>`
        + `<path d="M32 8 C42 8 48 16 44 26 C40 36 28 44 20 58" stroke="${stroke}" stroke-width="${width}"/>`
    );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">`
        + `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`
        + strands(outer, 11) + strands(middle, 7) + (hexes[2] ? strands(hexes[2], 3) : '')
        + `</g></svg>`;
    const img = document.createElement('img');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    img.width = size;
    img.height = size;
    return img;
};

const HealthEventEffect = ({ events }) => {
    // Clé stable : MainApp se re-rend chaque seconde et passe un nouveau tableau à chaque fois.
    const key = events.map((event) => event.id).join('|');
    const images = useMemo(() => events.map((event) => {
        const emoji = getEventEffectEmoji(event);
        return emoji ? makeEmojiImage(emoji, 30) : makeRibbonImage(event.ribbon, 32);
    }), [key]); // eslint-disable-line react-hooks/exhaustive-deps

    if (images.length === 0) return null;
    return (
        <Snowfall
            style={{ position: 'fixed', width: '100vw', height: '100vh', top: 0, left: 0, zIndex: 25 }}
            snowflakeCount={Math.min(MAX_PARTICLES, 12 + images.length * 6)}
            images={images}
            radius={RADIUS}
        />
    );
};

export default HealthEventEffect;
