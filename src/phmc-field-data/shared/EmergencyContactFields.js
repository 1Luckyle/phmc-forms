// src/phmc-field-data/shared/EmergencyContactFields.js
//
// Contact d'urgence commun aux dossiers patient (Basique, Avancé, Mise à jour) : titre et nom en trois champs, lien avec le patient, téléphone, Discord.
// Pas de date de naissance à vérifier ici : le choix du titre est libre.
import React from 'react';
import { Form } from 'react-bootstrap';
import NameFields from './NameFields';

export const EMERGENCY_FIELDS = {
    full: 'patientEmergencyContact', first: 'patientEmergencyContactFirstName', middle: 'patientEmergencyContactMiddleName',
    last: 'patientEmergencyContactLastName', title: 'patientEmergencyContactTitle',
};

const EmergencyContactFields = ({ formData, handleChange, setFormData }) => {
    const text = (name, placeholder) => <Form.Control type="text" name={name} value={formData[name] || ''} onChange={handleChange} placeholder={placeholder} className="form-control" />;
    return (
        <>
            <div style={{ display: 'flex', gap: '10px' }}>
                <NameFields
                    formData={formData} setFormData={setFormData} handleChange={handleChange} fields={EMERGENCY_FIELDS}
                    placeholders={{ first: "Prénom du contact d'urgence", middle: 'Deuxième prénom', last: 'Nom de famille' }}
                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                {text('patientEmergencyContactRelation', "Relation du contact d'urgence avec le patient")}
                {text('patientEmergencyContactNumber', "Numéro de téléphone du contact d'urgence")}
                {text('patientEmergencyContactDiscord', "(( Pseudo Discord du contact d'urgence ))")}
            </div>
        </>
    );
};

export default EmergencyContactFields;
