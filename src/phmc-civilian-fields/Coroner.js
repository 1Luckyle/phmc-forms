// src/phmc-civilian-fields/Coroner.js
// Candidature : médecine légale (DMEC). Champs, validation et aperçu communs à toutes les candidatures (voir shared/ApplicationFields.js).
import React from 'react';
import { getCategoryPositions } from '../constants/recruitment';
import ApplicationFields from './shared/ApplicationFields';

const CONFIG = { storageKey: 'applicationDraft_medecineLegale', positionLabel: 'Sélectionner un poste de médecine légale…', medicalExperience: true };

const CoronerFields = ({ formData, handleChange, setFormData, selectOptions }) => (
    <ApplicationFields formData={formData} handleChange={handleChange} setFormData={setFormData} positionDetails={getCategoryPositions(selectOptions, 'medecineLegale')} config={CONFIG} />
);

export default CoronerFields;
