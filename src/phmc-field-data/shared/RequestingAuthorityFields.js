// Champs « Autorité requérante » des rapports de décès et d'autopsie (facultatifs) : qui a demandé ou ordonné l'intervention, et sa référence.
import React from 'react';
import { Form } from 'react-bootstrap';
import { AUTHORITY_TYPES } from '../../constants/authorities';

const RequestingAuthorityFields = ({ formData, handleChange }) => (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
        <Form.Select name="requestingAuthority" value={formData.requestingAuthority || ''} onChange={handleChange} className="form-control">
            <option value="">Autorité requérante : aucune</option>
            {Object.entries(AUTHORITY_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Form.Select>
        {formData.requestingAuthority && (
            <Form.Control
                type="text" name="requestingAuthorityRef" value={formData.requestingAuthorityRef || ''} onChange={handleChange}
                placeholder="Référence (n° de mandat, de dossier…)"
            />
        )}
    </div>
);

export default RequestingAuthorityFields;
