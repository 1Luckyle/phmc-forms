// src/phmc-field-data/shared/EmergencyContactFields.js
//
// Contact d'urgence commun aux dossiers patient (Basique, Avancé, Mise à jour) : nom, lien avec le patient, téléphone avec son type, Discord.
import React from 'react';
import { Form } from 'react-bootstrap';

const EmergencyContactFields = ({ formData, handleChange }) => {
    const text = (name, placeholder) => <Form.Control type="text" name={name} value={formData[name] || ''} onChange={handleChange} placeholder={placeholder} className="form-control" />;
    return (
        <>
            <div style={{ display: 'flex', gap: '10px' }}>
                {text('patientEmergencyContact', "Prénom & Nom complet du contact d'urgence")}
                {text('patientEmergencyContactRelation', "Relation du contact d'urgence avec le patient")}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                {text('patientEmergencyContactNumber', "Numéro de téléphone du contact d'urgence")}
                {text('patientEmergencyContactDiscord', "(( Pseudo Discord du contact d'urgence ))")}
            </div>
        </>
    );
};

export default EmergencyContactFields;
