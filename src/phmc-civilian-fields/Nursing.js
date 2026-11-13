// src/phmc-civilian-fields/Nursing.js
// Candidature : soins infirmiers. Champs, validation et aperçu communs à toutes les candidatures (voir shared/ApplicationFields.js).
import React from 'react';
import { getCategoryPositions } from '../constants/recruitment';
import ApplicationFields from './shared/ApplicationFields';

const CONFIG = { storageKey: 'applicationDraft_soinsInfirmiers', positionLabel: 'Sélectionner un poste d\'infirmier…', medicalExperience: true };

const NursingFields = ({ formData, handleChange, setFormData, selectOptions }) => (
    <ApplicationFields formData={formData} handleChange={handleChange} setFormData={setFormData} positionDetails={getCategoryPositions(selectOptions, 'soinsInfirmiers')} config={CONFIG} />
);

export default NursingFields;
