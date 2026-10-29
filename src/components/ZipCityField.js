// src/components/ZipCityField.js
//
// Champ « Ville / code postal » : un menu de villes qui renseigne tout seul le code postal (voir utils/cities.js). Sans liste
// (ou pour une ville absente de la liste), on retombe sur la saisie libre du code postal.
import React, { useEffect, useState } from 'react';
import { Form } from 'react-bootstrap';
import { useCities, cityOfZip } from '../utils/cities';

const OTHER = '__autre__';

const ZipCityField = ({ zip = '', onZipChange, style, placeholder = 'Code postal (facultatif)', disabled = false }) => {
    const cities = useCities();
    const match = cityOfZip(cities, zip);
    const [otherMode, setOtherMode] = useState(false);
    const manual = otherMode || (!!String(zip).trim() && !match);

    // Si la liste change et reconnaît le code saisi, on repasse sur le menu.
    useEffect(() => { if (match) setOtherMode(false); }, [match]);

    if (cities.length === 0) {
        return <Form.Control type="text" value={zip} onChange={(e) => onZipChange(e.target.value)} placeholder={placeholder} style={style} disabled={disabled} />;
    }

    const handleSelect = (e) => {
        const value = e.target.value;
        if (value === OTHER) { setOtherMode(true); return; }
        setOtherMode(false);
        onZipChange(value ? (cities.find((entry) => entry.nom === value)?.cp || '') : '');
    };

    return (
        <>
            <Form.Select value={manual ? OTHER : (match?.nom || '')} onChange={handleSelect} style={style} disabled={disabled} aria-label="Ville">
                <option value="">— Choisir une ville —</option>
                {cities.map((entry) => <option key={entry.nom} value={entry.nom}>{entry.nom}</option>)}
                <option value={OTHER}>Autre (ma ville n'est pas dans la liste)</option>
            </Form.Select>
            {manual ? (
                <Form.Control type="text" className="mt-1" value={zip} onChange={(e) => onZipChange(e.target.value)} placeholder="Code postal" style={style} disabled={disabled} />
            ) : (match && <small className="d-block mt-1" style={{ opacity: 0.75 }}>Code postal : <strong>{match.cp}</strong></small>)}
        </>
    );
};

export default ZipCityField;
