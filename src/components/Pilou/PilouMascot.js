// src/components/Pilou/PilouMascot.js
//
// Pilou le poulpe, mascotte de l'outil Pilou (« Pilou » ≈ « poulpe ») : un petit poulpe soignant, stéthoscope autour du cou, huit bras pour huit gestes à la fois. Dessin original en SVG, sans image externe.
// Cinq humeurs : neutral (au travail), thinking (il réfléchit), alert (il a repéré un risque), happy (tout est fait), sleepy (il attend un cas). Les petites animations (bras, clignement)
// sont coupées pour qui préfère moins de mouvement (voir PilouModal.css).
import React from 'react';

export const MOODS = ['neutral', 'thinking', 'alert', 'happy', 'sleepy'];

const BODY = '#ff8f7a';
const BODY_DARK = '#e5705c';
const INK = '#1b1f27';
const WHITE = '#ffffff';

// Quatre bras, dessinés pour le côté gauche ; le côté droit en est le miroir : huit bras en tout.
const ARMS = [
    'M64,112 C42,126 28,146 38,164 C44,175 58,172 55,163',
    'M76,116 C58,138 52,162 64,180 C70,190 83,186 79,177',
    'M88,118 C84,142 86,160 94,176 C98,184 108,182 105,174',
    'M96,119 C96,134 98,146 104,154 C108,159 114,156 112,151',
];
const Arms = () => ARMS.map((path, index) => (
    <g key={path} className={`pl-arm pl-arm-${index + 1}`}>
        <path d={path} fill="none" stroke={BODY} strokeWidth="13" strokeLinecap="round" />
        <path d={path} fill="none" stroke={BODY_DARK} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 11" opacity="0.7" />
    </g>
));

// Stéthoscope porté autour du cou : deux tubes qui partent des épaules (avec leurs embouts), se rejoignent en Y sur le torse, puis une seule tige descend jusqu'au pavillon.
const TUBE = '#27476b';
const METAL = '#d7dee6';
const METAL_DARK = '#7b8794';
const Stethoscope = () => {
    const left = 'M52,104 C54,128 84,134 100,142';
    const right = 'M148,104 C146,128 116,134 100,142';
    const stem = 'M100,142 C100,152 99,158 100,166';
    return (
        <g className="pl-stetho">
            {/* embouts auriculaires posés sur les épaules */}
            <g fill={METAL} stroke={METAL_DARK} strokeWidth="1.5">
                <rect x={46} y={92} width={8} height={15} rx={4} transform="rotate(-14 50 100)" />
                <rect x={146} y={92} width={8} height={15} rx={4} transform="rotate(14 150 100)" />
            </g>
            {/* tubes : trait sombre, puis un fin reflet pour le volume */}
            {[left, right, stem].map((d) => <path key={d} d={d} fill="none" stroke={TUBE} strokeWidth="6" strokeLinecap="round" />)}
            {[left, right, stem].map((d) => <path key={`${d}-shine`} d={d} fill="none" stroke="#8fb4dd" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" transform="translate(-1.2 -1)" />)}
            {/* jonction en Y */}
            <circle cx={100} cy={142} r={5} fill={METAL} stroke={METAL_DARK} strokeWidth="1.5" />
            {/* pavillon : coque métal, membrane, reflet */}
            <circle cx={100} cy={175} r={12.5} fill={METAL} stroke={METAL_DARK} strokeWidth="2" />
            <circle cx={100} cy={175} r={8} fill="#a9b6c3" stroke={METAL_DARK} strokeWidth="1.5" />
            <circle cx={100} cy={175} r={3} fill={METAL_DARK} />
            <path d="M92.5,170 Q95,166.5 99,166.5" fill="none" stroke={WHITE} strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
        </g>
    );
};

const Star = ({ x, y, scale = 1 }) => <path transform={`translate(${x} ${y}) scale(${scale})`} d="M0,-8 L2,-2 L8,0 L2,2 L0,8 L-2,2 L-8,0 L-2,-2 Z" fill="#ffd33d" />;

// Yeux ouverts : dx / dy décalent le regard, rx / ry la taille, pupil le rayon de la pupille.
const OpenEyes = ({ dx = 0, dy = 0, rx = 12, ry = 14, pupil = 6.5 }) => (
    <g className="pl-eyes">
        {[82, 118].map((cx) => (
            <g key={cx}>
                <ellipse cx={cx} cy={78} rx={rx} ry={ry} fill={WHITE} />
                <circle cx={cx + dx} cy={79 + dy} r={pupil} fill={INK} />
                <circle cx={cx + dx - 2} cy={77 + dy} r={2} fill={WHITE} />
            </g>
        ))}
    </g>
);
const Arcs = ({ d1, d2 }) => (
    <g fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round"><path d={d1} /><path d={d2} /></g>
);

const FACES = {
    neutral: (
        <>
            <OpenEyes />
            <path d="M91,100 Q100,107 109,100" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>
    ),
    thinking: (
        <>
            <OpenEyes dx={4} dy={-4} />
            <path d="M108,59 Q119,53 130,59" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <path d="M92,102 Q100,100 108,103" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <circle cx={158} cy={52} r={3} fill={WHITE} /><circle cx={166} cy={43} r={4.5} fill={WHITE} />
            <circle cx={178} cy={27} r={14} fill={WHITE} />
            <text x={178} y={33} fontSize="19" fontWeight="700" textAnchor="middle" fill="#1f6feb">?</text>
        </>
    ),
    alert: (
        <>
            <OpenEyes rx={13} ry={16} pupil={4} />
            <ellipse cx={100} cy={105} rx={5} ry={6.5} fill={INK} />
            <path d="M152,58 C148,66 146,70 150,73 C154,70 156,66 152,58 Z" fill="#7cc4ff" />
            <circle cx={176} cy={28} r={14} fill="#d29922" />
            <text x={176} y={35} fontSize="20" fontWeight="800" textAnchor="middle" fill={WHITE}>!</text>
        </>
    ),
    happy: (
        <>
            <Arcs d1="M72,82 Q82,68 92,82" d2="M108,82 Q118,68 128,82" />
            <path d="M88,97 Q100,117 112,97 Z" fill="#7a2e2e" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
            <Star x={168} y={36} scale={1.2} /><Star x={36} y={44} />
        </>
    ),
    sleepy: (
        <>
            <Arcs d1="M72,80 Q82,87 92,80" d2="M108,80 Q118,87 128,80" />
            <path d="M95,102 Q100,105 105,102" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <text x={162} y={46} fontSize="20" fontWeight="700" fill="#9da7b3">z</text>
            <text x={176} y={28} fontSize="13" fontWeight="700" fill="#9da7b3">z</text>
        </>
    ),
};

/**
 * mood : humeur (neutral par défaut) ; size : largeur en pixels ; label : texte alternatif — '' quand le dessin est purement décoratif (le texte voisin porte le sens).
 */
const PilouMascot = ({ mood = 'neutral', size = 96, label = 'Pilou, la mascotte', animated = true, className = '' }) => {
    const face = MOODS.includes(mood) ? mood : 'neutral';
    const decorative = label === '';
    return (
        <svg
            className={`pl-mascot${animated ? ' animated' : ''}${className ? ` ${className}` : ''}`} data-mood={face} viewBox="0 0 200 204" width={size} height={Math.round((size * 204) / 200)}
            role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative ? 'true' : undefined} focusable="false" xmlns="http://www.w3.org/2000/svg"
        >
            <ellipse cx={100} cy={198} rx={46} ry={4} fill="#000" opacity="0.25" />
            <Arms />
            <g transform="translate(200 0) scale(-1 1)"><Arms /></g>
            {/* tête */}
            <defs>
                <linearGradient id="pl-mascot-head" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ffa795" /><stop offset="1" stopColor="#f77f6a" /></linearGradient>
            </defs>
            <path d="M48,92 C48,48 72,26 100,26 C128,26 152,48 152,92 C152,108 140,116 128,118 L72,118 C60,116 48,108 48,92 Z" fill="url(#pl-mascot-head)" />
            <g fill={BODY_DARK} opacity="0.3"><circle cx={118} cy={40} r={3.5} /><circle cx={130} cy={54} r={2.6} /><circle cx={104} cy={33} r={2.2} /><circle cx={70} cy={38} r={2} /></g>
            <ellipse cx={78} cy={46} rx={15} ry={8} transform="rotate(-28 78 46)" fill={WHITE} opacity="0.28" />
            <circle cx={66} cy={95} r={7} fill="#ff6f61" opacity="0.45" /><circle cx={134} cy={95} r={7} fill="#ff6f61" opacity="0.45" />
            {FACES[face]}
            <Stethoscope />
        </svg>
    );
};

/** La mascotte qui parle : elle à gauche, une bulle de texte à droite. */
export const PilouSays = ({ mood = 'neutral', size = 84, children, className = '' }) => (
    <div className={`pl-says${className ? ` ${className}` : ''}`}>
        <PilouMascot mood={mood} size={size} label="" />
        <div className="pl-bubble">{children}</div>
    </div>
);

export default PilouMascot;
