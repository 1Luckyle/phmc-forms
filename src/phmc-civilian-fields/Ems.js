// src/phmc-civilian-fields/Ems.js
// Candidature : paramédical (EMS). Champs, validation et aperçu communs à toutes les candidatures (voir shared/ApplicationFields.js) ; les rubriques
// dépendent du poste : paramédic et technicien ambulancier présentent leurs emplois, les autres rôles leur licence et leur demande de programme à temps partiel.
import React from 'react';
import { getCategoryPositions } from '../constants/recruitment';
import ApplicationFields from './shared/ApplicationFields';

const CONFIG = { storageKey: 'applicationDraft_paramedical', positionLabel: 'Sélectionner un poste EMS…', ems: true, medicalExperience: true };

const EMSFields = ({ formData, handleChange, setFormData, selectOptions }) => (
    <ApplicationFields formData={formData} handleChange={handleChange} setFormData={setFormData} positionDetails={getCategoryPositions(selectOptions, 'paramedical')} config={CONFIG} />
);

export default EMSFields;
