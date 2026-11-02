import React, { useMemo } from 'react';
import Snowfall from 'react-snowfall';
import { getEventEffectEmoji, getEventEffectImage } from '../data/awarenessEvents';
import { makeEmojiImage } from './AmbientSeasonalEffect';

// Effet de saison piloté par le calendrier de la santé : pour chaque événement en cours, une
// particule à ses couleurs (ruban) ou à son emblème (emoji). Plusieurs événements = particules
// mélangées à parts égales ; le total reste plafonné (au-delà d'une trentaine d'éléments animés,
// les machines moins puissantes ralentissent).
const MAX_PARTICLES = 28;
const RADIUS = [10, 24];

// Ruban : exactement la forme de l'icône du calendrier (Font Awesome « ribbon »), découpée en bandes
// verticales nettes quand la cause a plusieurs couleurs (ex. turquoise + violet) — comme dans le
// calendrier et l'infobulle. Une seule couleur : ruban uni.
const RIBBON_PATH = 'M333.2 322.8s0 0 0 0l-133.9-146s0 0 0 0L146 118.6c7.8-5.1 37-22.6 78-22.6s70.2 17.4 78 22.6L245.7 180l85.6 93.4 27.4-29.8c16.3-17.7 25.3-40.9 25.3-65l0-29.5c0-19-5.6-37.5-16.1-53.3L327.8 35.6C312.9 13.4 287.9 0 261.2 0l-76 0c-25.8 0-50.1 12.5-65.1 33.5L81.9 87C70.3 103.2 64 122.8 64 142.8L64 164c0 23.2 8.4 45.6 23.6 63.1l56 64.2s0 0 0 0l83.3 95.6s0 0 0 0l91.8 105.3c10 11.5 26.8 14.3 40 6.8l54.5-31.1c17.8-10.2 21.6-34.3 7.7-49.4l-87.7-95.7zM205.2 410.6l-83.3-95.6L27.1 418.5c-13.9 15.1-10.1 39.2 7.7 49.4l55.1 31.5c13 7.4 29.3 4.9 39.4-6.1l75.9-82.6z';

const makeRibbonImage = (colors, size) => {
    const hexes = colors.map((c) => c.hex);
    const stops = hexes.length > 1
        ? hexes.map((hex, i) => `<stop offset="${(i * 100) / hexes.length}%" stop-color="${hex}"/><stop offset="${((i + 1) * 100) / hexes.length}%" stop-color="${hex}"/>`).join('')
        : `<stop offset="0%" stop-color="${hexes[0]}"/><stop offset="100%" stop-color="${hexes[0]}"/>`;
    // viewBox élargi à 512 de large pour centrer le ruban (448 de large) dans une image carrée.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-32 0 512 512">`
        + `<defs><linearGradient id="r" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="448" y2="0">${stops}</linearGradient></defs>`
        + `<path d="${RIBBON_PATH}" fill="url(#r)"/></svg>`;
    const img = document.createElement('img');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    img.width = size;
    img.height = size;
    return img;
};

// Moustache de Movember (à guidon) : dessinée en SVG car il n'existe pas d'emoji de moustache. Brun clair cerné de brun foncé pour rester lisible sur fond clair
// comme sur fond sombre.
const MOUSTACHE_PATH = 'M256 236 C 232 206, 190 196, 148 214 C 112 230, 92 258, 62 250 C 36 243, 24 214, 40 188 C 36 226, 62 262, 108 270 C 160 280, 212 262, 256 272 C 300 262, 352 280, 404 270 C 450 262, 476 226, 472 188 C 488 214, 476 243, 450 250 C 420 258, 400 230, 364 214 C 322 196, 280 206, 256 236 Z';
const MOUSTACHE_HAIR = 'M150 224 C 190 210, 226 220, 246 246 M362 224 C 322 210, 286 220, 266 246 M120 246 C 160 252, 200 252, 236 262 M392 246 C 352 252, 312 252, 276 262';

const makeMoustacheImage = (size) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">`
        + `<path d="${MOUSTACHE_PATH}" fill="#5a3820" stroke="#1d0f07" stroke-width="8" stroke-linejoin="round"/>`
        + `<path d="${MOUSTACHE_HAIR}" fill="none" stroke="#8a5a38" stroke-width="7" stroke-linecap="round" opacity="0.85"/></svg>`;
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
        if (getEventEffectImage(event) === 'moustache') return makeMoustacheImage(40);
        const emoji = getEventEffectEmoji(event);
        return emoji ? makeEmojiImage(emoji, 30) : makeRibbonImage(event.ribbon, 34);
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
