// src/components/ZipCityField.js
//
// Champ « Ville / code postal » : un menu de villes qui renseigne tout seul le code postal (voir utils/cities.js). Sans liste, on retombe sur la saisie
// libre du code postal. Pour une ville absente de la liste, « Autre » affiche deux cases : le NOM de la ville et son CODE POSTAL.
//   • `city` + `onCityChange` : le nom de la ville « Autre » est enregistré à côté du code postal (formulaires de rapport). Sans eux (profils,
//     dont la base n'a qu'un code postal), « Autre » ne demande que le code postal.
//   • `fieldName` : nom du champ de formulaire du code postal ; l'infobulle (components/FieldGuide.js) en reprend le texte et l'indication obligatoire / facultatif.
import React, { useEffect, useState } from 'react';
import { Form } from 'react-bootstrap';
import { useCities, cityOfZip } from '../utils/cities';

const OTHER = '__autre__';
const DEFAULT_GUIDE = 'Choisissez la ville dans la liste : le code postal se renseigne tout seul. « Autre » permet de saisir une ville absente de la liste.';

const ZipCityField = ({ zip = '', onZipChange, city = '', onCityChange, fieldName = '', style, placeholder = 'Code postal (facultatif)', disabled = false }) => {
    const cities = useCities();
    const match = cityOfZip(cities, zip);
    const withName = typeof onCityChange === 'function';
    const hasName = withName && !!String(city).trim();
    const [otherMode, setOtherMode] = useState(false);
    const manual = otherMode || hasName || (!!String(zip).trim() && !match);
    const cityField = fieldName ? `${fieldName}City` : '';
    const zipAttrs = { 'data-field-name': fieldName || undefined, 'data-guide': fieldName ? undefined : DEFAULT_GUIDE };

    // Si la liste change et reconnaît le code saisi, on repasse sur le menu (sauf si un nom de ville a été saisi à la main).
    useEffect(() => { if (match && !hasName) setOtherMode(false); }, [match, hasName]);

    if (cities.length === 0) {
        return <Form.Control type="text" value={zip} onChange={(e) => onZipChange(e.target.value)} placeholder={placeholder} style={style} disabled={disabled} {...zipAttrs} />;
    }

    const handleSelect = (e) => {
        const value = e.target.value;
        if (value === OTHER) { setOtherMode(true); return; }
        setOtherMode(false);
        if (withName) onCityChange('');
        onZipChange(value ? (cities.find((entry) => entry.nom === value)?.cp || '') : '');
    };

    return (
        <>
            <Form.Select value={manual ? OTHER : (match?.nom || '')} onChange={handleSelect} style={style} disabled={disabled} aria-label="Ville" {...zipAttrs}>
                <option value="">— Choisir une ville —</option>
                {cities.map((entry) => <option key={entry.nom} value={entry.nom}>{entry.nom}</option>)}
                <option value={OTHER}>Autre (ma ville n'est pas dans la liste)</option>
            </Form.Select>
            {manual ? (
                <div className="d-flex gap-1 mt-1">
                    {withName && (
                        <Form.Control type="text" value={city} onChange={(e) => onCityChange(e.target.value)} placeholder="Nom de la ville" aria-label="Nom de la ville"
                            style={{ ...style, flex: '1 1 auto', minWidth: 0 }} disabled={disabled} maxLength={80}
                            data-field-name={cityField || undefined} data-guide={cityField ? undefined : 'Nom de la ville, quand elle n\'est pas dans la liste.'} />
                    )}
                    <Form.Control type="text" value={zip} onChange={(e) => onZipChange(e.target.value)} placeholder="Code postal" aria-label="Code postal"
                        style={{ ...style, flex: withName ? '0 0 120px' : '1 1 auto', minWidth: 0 }} disabled={disabled} maxLength={12} {...zipAttrs} />
                </div>
            ) : (match && <small className="d-block mt-1" style={{ opacity: 0.75 }}>Code postal : <strong>{match.cp}</strong></small>)}
        </>
    );
};

export default ZipCityField;
