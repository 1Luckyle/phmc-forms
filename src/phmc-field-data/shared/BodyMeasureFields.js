// src/phmc-field-data/shared/BodyMeasureFields.js
//
// Poids et taille du patient dans les formulaires du DOSSIER MÉDICAL (basique, avancé, mise à jour) : ces valeurs servent ensuite à préremplir les formulaires de soins
// (assistant clinique : doses calculées au poids, ASA, etc.). Saisie en kg et en cm (« 1,80 » est aussi compris comme 180 cm).
import React from 'react';
import { Form } from 'react-bootstrap';

const BodyMeasureFields = ({ formData, handleChange }) => (
    <div style={{ display: 'flex', gap: '10px', marginTop: '0.6rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <Form.Control type="text" inputMode="decimal" name="patientWeight" value={formData.patientWeight || ''} onChange={handleChange} placeholder="Poids en kg (ex. 75)" className="form-control" />
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <Form.Control type="text" inputMode="decimal" name="patientHeight" value={formData.patientHeight || ''} onChange={handleChange} placeholder="Taille en cm (ex. 178)" className="form-control" />
        </div>
    </div>
);

export default BodyMeasureFields;
