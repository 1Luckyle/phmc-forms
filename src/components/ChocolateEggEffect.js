import React, { useMemo } from 'react';
import Snowfall from 'react-snowfall';

// Pâques : des œufs en chocolat qui tombent (chocolat au lait nappé de glaçage, chocolat noir à
// bandes pastel, œufs emballés dans du papier doré ou rose). Dessinés en SVG, comme les autres
// particules : pas de fichier image en plus, et rien à charger sur le réseau.
const RADIUS = [10, 22];
const EGG_PATH = 'M32 3 C47 3 57 25 57 40 C57 54 46 62 32 62 C18 62 7 54 7 40 C7 25 17 3 32 3 Z';

const makeEggImage = ({ base, shade, decoration }, size) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">`
        + `<defs>`
        + `<radialGradient id="g" cx="35%" cy="28%" r="78%"><stop offset="0%" stop-color="${base}"/><stop offset="100%" stop-color="${shade}"/></radialGradient>`
        + `<clipPath id="c"><path d="${EGG_PATH}"/></clipPath>`
        + `</defs>`
        + `<path d="${EGG_PATH}" fill="url(#g)"/>`
        + `<g clip-path="url(#c)">${decoration}</g>`
        + `<ellipse cx="23" cy="22" rx="5" ry="10" fill="#fff" opacity="0.28" transform="rotate(18 23 22)"/>`
        + `<path d="${EGG_PATH}" fill="none" stroke="${shade}" stroke-width="1.6"/>`
        + `</svg>`;
    const img = document.createElement('img');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    img.width = size;
    img.height = size;
    return img;
};

const ZIGZAG = '<path d="M4 36 l7 -7 l7 7 l7 -7 l7 7 l7 -7 l7 7 l7 -7 l7 7" fill="none" stroke="#fff6e5" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>';
const BANDS = '<rect x="0" y="26" width="64" height="5" fill="#ffd6e7"/><rect x="0" y="36" width="64" height="5" fill="#c9f0d8"/><rect x="0" y="46" width="64" height="5" fill="#fff3b0"/>';
const FOIL_GOLD = '<rect x="0" y="22" width="64" height="4" fill="#fff" opacity="0.4"/><rect x="0" y="34" width="64" height="4" fill="#fff" opacity="0.4"/><rect x="0" y="46" width="64" height="4" fill="#fff" opacity="0.4"/>';
const FOIL_DOTS = '<circle cx="22" cy="34" r="3.2" fill="#fff" opacity="0.6"/><circle cx="40" cy="28" r="3.2" fill="#fff" opacity="0.6"/><circle cx="34" cy="46" r="3.2" fill="#fff" opacity="0.6"/><circle cx="18" cy="50" r="2.6" fill="#fff" opacity="0.6"/><circle cx="46" cy="44" r="2.6" fill="#fff" opacity="0.6"/>';

const VARIANTS = [
    { base: '#a8612f', shade: '#5a2e12', decoration: ZIGZAG },        // chocolat au lait + glaçage
    { base: '#5b3320', shade: '#2a140a', decoration: BANDS },         // chocolat noir à bandes pastel
    { base: '#ffd95a', shade: '#c28a00', decoration: FOIL_GOLD },     // papier doré
    { base: '#ff8fbf', shade: '#c2457f', decoration: FOIL_DOTS },     // papier rose à pois
];

const ChocolateEggEffect = ({ count = 22, size = 32 }) => {
    const images = useMemo(() => VARIANTS.map((variant) => makeEggImage(variant, size)), [size]);

    return (
        <Snowfall
            style={{ position: 'fixed', width: '100vw', height: '100vh', top: 0, left: 0, zIndex: 25 }}
            snowflakeCount={count}
            images={images}
            radius={RADIUS}
        />
    );
};

export default ChocolateEggEffect;
