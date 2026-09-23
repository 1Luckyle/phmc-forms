// src/components/TitlePrefixPicker.js
//
// Petit sélecteur Dr./Pr. affiché uniquement pour les grades "médecin" (voir
// DOCTOR_RANKS dans constants/ranks.js). Ne stocke rien à part : il modifie
// directement le champ prénom via applyTitlePrefix, donc aucun champ ni
// générateur BBCode n'a besoin d'être touché ailleurs.
import React from 'react';
import { TITLE_PREFIXES, applyTitlePrefix, getTitlePrefix } from '../constants/ranks';

const TitlePrefixPicker = ({ firstName, onChange }) => {
    const currentTitle = getTitlePrefix(firstName);

    return (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {TITLE_PREFIXES.map((title) => {
                const isActive = currentTitle === title;
                return (
                    <button
                        key={title}
                        type="button"
                        onClick={() => onChange(applyTitlePrefix(firstName, isActive ? null : title))}
                        style={{
                            padding: '6px 14px', borderRadius: '4px', cursor: 'pointer',
                            border: `1px solid ${isActive ? '#007bff' : '#444'}`,
                            backgroundColor: isActive ? '#1a3a5c' : '#2a2a2a',
                            color: '#fff', fontSize: '0.85em'
                        }}
                    >
                        {title}
                    </button>
                );
            })}
        </div>
    );
};

export default TitlePrefixPicker;
