// src/phmc-field-data/shared/NameFields.js
//
// Nom d'une personne en TROIS champs (prénom, deuxième prénom, nom de famille), à placer dans une rangée flex. Le nom complet (`fields.full`) est recomposé
// tout seul pour le titre du rapport et le BBCode (voir hooks/usePatientNameParts.js). `fields` : { full, first, middle, last } = noms des champs du formulaire.
import React from 'react';
import { Form } from 'react-bootstrap';
import usePatientNameParts from '../../hooks/usePatientNameParts';

const NameFields = ({ formData, setFormData, handleChange, fields, placeholders = {}, disabled = false }) => {
    usePatientNameParts(formData, setFormData, fields);
    const input = (name, placeholder) => (
        <Form.Control type="text" name={name} value={formData[name] || ''} onChange={handleChange} placeholder={placeholder} className="form-control" disabled={disabled} />
    );
    return (
        <>
            {input(fields.first, placeholders.first || 'Prénom')}
            {input(fields.middle, placeholders.middle || 'Deuxième prénom')}
            {input(fields.last, placeholders.last || 'Nom de famille')}
        </>
    );
};

export default NameFields;
