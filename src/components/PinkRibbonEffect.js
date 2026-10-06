import React, { useMemo } from 'react';
import Snowfall from 'react-snowfall';

// Octobre Rose : le ruban de sensibilisation au cancer du sein tombe à la place des
// tombes (qui, elles, ne reviennent que le 31 octobre — voir HalloweenEffect.js).
// Le ruban est dessiné en SVG (deux boucles qui se croisent) : un emoji ne donne pas
// un ruban rose fiable selon les systèmes, et ça évite un fichier image de plus.
const makeRibbonImage = (size) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">`
        + `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`
        + `<path d="M32 8 C22 8 16 16 20 26 C24 36 36 44 44 58" stroke="#c2185b" stroke-width="11"/>`
        + `<path d="M32 8 C42 8 48 16 44 26 C40 36 28 44 20 58" stroke="#c2185b" stroke-width="11"/>`
        + `<path d="M32 8 C22 8 16 16 20 26 C24 36 36 44 44 58" stroke="#ff4f9a" stroke-width="7"/>`
        + `<path d="M32 8 C42 8 48 16 44 26 C40 36 28 44 20 58" stroke="#ff4f9a" stroke-width="7"/>`
        + `</g></svg>`;
    const img = document.createElement('img');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    img.width = size;
    img.height = size;
    return img;
};

const PinkRibbonEffect = ({ count = 24, size = 32 }) => {
    const images = useMemo(() => [makeRibbonImage(size)], [size]);

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
            radius={[10.0, 26.0]}
        />
    );
};

export default PinkRibbonEffect;
