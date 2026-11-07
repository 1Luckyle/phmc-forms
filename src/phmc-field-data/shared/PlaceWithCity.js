// src/phmc-field-data/shared/PlaceWithCity.js
//
// Champ « lieu » en deux parties sur une même rangée : l'adresse (texte libre) et la ville (menu de la liste des villes, qui renseigne le code postal).
// Le code postal est enregistré sous `zipName`. À rendre dans une rangée flex.
import React from 'react';
import { Form } from 'react-bootstrap';
import ZipCityField from '../../components/ZipCityField';

const PlaceWithCity = ({ formData, setFormData, handleChange, addressName, zipName, placeholder = 'Adresse (Numéro, Étage, Rue)' }) => (
    <>
        <Form.Control type="text" name={addressName} value={formData[addressName] || ''} onChange={handleChange} placeholder={placeholder} className="form-control" />
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <ZipCityField zip={formData[zipName] || ''} onZipChange={(zip) => setFormData((prev) => ({ ...prev, [zipName]: zip }))} placeholder="Code postal" />
        </div>
    </>
);

export default PlaceWithCity;
