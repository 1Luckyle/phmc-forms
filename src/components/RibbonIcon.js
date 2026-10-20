// src/components/RibbonIcon.js
//
// Ruban de la/des couleur(s) d'une cause (calendrier de la santé, infobulle du header) : dégradé à
// paliers nets quand il y a plusieurs couleurs, icône neutre quand la cause n'a pas de ruban.
import React from 'react';
import './AwarenessCalendar.css';

const RibbonIcon = ({ ribbon, size = 28 }) => {
    if (!ribbon || ribbon.length === 0) {
        return <i className="fas fa-hand-holding-medical awareness-ribbon awareness-ribbon-none" style={{ fontSize: size }} aria-hidden="true"></i>;
    }
    if (ribbon.length === 1) {
        return <i className="fas fa-ribbon awareness-ribbon" style={{ fontSize: size, color: ribbon[0].hex }} aria-hidden="true"></i>;
    }
    const step = 100 / ribbon.length;
    const stops = ribbon.map((c, i) => `${c.hex} ${i * step}% ${(i + 1) * step}%`).join(', ');
    return (
        <i className="fas fa-ribbon awareness-ribbon awareness-ribbon-multi" aria-hidden="true"
            style={{ fontSize: size, backgroundImage: `linear-gradient(90deg, ${stops})` }}></i>
    );
};

export default RibbonIcon;
