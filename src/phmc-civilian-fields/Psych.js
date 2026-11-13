// src/phmc-civilian-fields/Psych.js
// Candidature : psychologie et psychiatrie. Champs, validation et aperçu communs à toutes les candidatures (voir shared/ApplicationFields.js).
import React from 'react';
import ApplicationFields from './shared/ApplicationFields';

const CONFIG = { storageKey: 'applicationDraft_psychologie', positionLabel: 'Sélectionner un poste en psychologie…', medicalExperience: true };

const PsychFields = ({ formData, handleChange, setFormData, psychRecruitmentDetails }) => (
    <ApplicationFields formData={formData} handleChange={handleChange} setFormData={setFormData} positionDetails={psychRecruitmentDetails} config={CONFIG} />
);

export default PsychFields;
