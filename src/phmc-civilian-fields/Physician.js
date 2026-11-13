// src/phmc-civilian-fields/Physician.js
// Candidature : médecine. Champs, validation et aperçu communs à toutes les candidatures (voir shared/ApplicationFields.js).
import React from 'react';
import ApplicationFields from './shared/ApplicationFields';

const CONFIG = { storageKey: 'applicationDraft_medecine', positionLabel: 'Sélectionner un poste en médecine…', medicalExperience: true };

const PhysicianFields = ({ formData, handleChange, setFormData, physicianRecruitmentDetails }) => (
    <ApplicationFields formData={formData} handleChange={handleChange} setFormData={setFormData} positionDetails={physicianRecruitmentDetails} config={CONFIG} />
);

export default PhysicianFields;
