// src/components/MissingFieldsBlock.js
//
// Bloc « ce qui reste à renseigner » affiché sous un formulaire : plus lisible qu'une notification qui disparaît. Même principe que dans les documents
// administratifs (contrats, accords) : la liste des champs obligatoires encore vides, ou « tout est renseigné ». Styles intégrés : il s'affiche aussi bien
// dans les fenêtres sombres du site que dans celles qui sont rendues dans un portail.
import React, { forwardRef } from 'react';

const boxStyle = (color, background) => ({
    border: `1px solid ${color}`, borderLeft: `4px solid ${color}`, borderRadius: '8px', backgroundColor: background,
    padding: '10px 14px', margin: '14px 0', fontSize: '0.9rem', color: '#e6edf3', textAlign: 'left',
});

const MissingFieldsBlock = forwardRef(({ missing = [], title = 'À renseigner pour envoyer :', okText = 'Tout est renseigné : vous pouvez envoyer.', highlight = false }, ref) => {
    const list = (missing || []).filter(Boolean);
    if (list.length === 0) {
        return (
            <div ref={ref} role="status" className="missing-fields-block missing-fields-ok" style={boxStyle('#3fb950', 'rgba(63, 185, 80, 0.10)')}>
                <i className="fas fa-circle-check" style={{ marginRight: '8px', color: '#3fb950' }}></i>{okText}
            </div>
        );
    }
    return (
        <div
            ref={ref} role="status" className="missing-fields-block"
            style={boxStyle(highlight ? '#f85149' : '#d29922', highlight ? 'rgba(248, 81, 73, 0.10)' : 'rgba(210, 153, 34, 0.10)')}
        >
            <strong><i className="fas fa-list-check" style={{ marginRight: '8px' }}></i>{title}</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: '1.3rem' }}>
                {list.map((message) => <li key={message}>{message}</li>)}
            </ul>
        </div>
    );
});

export default MissingFieldsBlock;
