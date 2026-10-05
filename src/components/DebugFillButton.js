// src/components/DebugFillButton.js
//
// Bouton « Remplir (debug) » : n'apparaît que si un admin a activé le mode
// debug (voir DebugContext). À placer dans chaque formulaire / modale avec un
// onFill qui renseigne les champs avec des données de test.
import React from 'react';
import { Button } from 'react-bootstrap';
import { useDebug } from '../contexts/DebugContext';

const DebugFillButton = ({ onFill, label = 'Remplir (debug)', className = '', style, size, disabled }) => {
    const { debugAutofillEnabled } = useDebug();
    if (!debugAutofillEnabled || typeof onFill !== 'function') return null;

    return (
        <Button
            type="button"
            variant="warning"
            size={size}
            className={`debug-fill-button ${className}`.trim()}
            style={style}
            disabled={disabled}
            onClick={onFill}
            title="Outil de debug : remplit ce formulaire avec des données de test (activé depuis le panneau admin)"
        >
            <i className="fas fa-bug" style={{ marginRight: '6px' }}></i>
            {label}
        </Button>
    );
};

export default DebugFillButton;
