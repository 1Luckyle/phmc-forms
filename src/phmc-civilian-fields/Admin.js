// src/phmc-civilian-fields/Admin.js
// Candidature : administration et services. Champs, validation et aperçu communs à toutes les candidatures (voir shared/ApplicationFields.js).
import React from 'react';
import { getCategoryPositions } from '../constants/recruitment';
import ApplicationFields from './shared/ApplicationFields';

const CONFIG = { storageKey: 'applicationDraft_administration', positionLabel: 'Sélectionner un poste administratif…', medicalExperience: false };

const AdminFields = ({ formData, handleChange, setFormData, selectOptions }) => (
    <ApplicationFields formData={formData} handleChange={handleChange} setFormData={setFormData} positionDetails={getCategoryPositions(selectOptions, 'administration')} config={CONFIG} />
);

export default AdminFields;
