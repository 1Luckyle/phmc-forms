// src/phmc-field-data/shared/CarePatientTemporaryId.js
//
// VERSION CLASSIQUE du site (constants/siteMode.js) : sous le champ « ID patient » des formulaires remplis par le personnel (formulaires de soins, dossiers patient,
// notes de service), proposer un ID TEMPORAIRE (TMP-XXXXX) pour un patient qui n'a pas encore de compte. Ses rapports, son dossier et ses factures sont rangés sous cet ID ;
// quand il ouvre son compte, un administrateur lui attribue son vrai ID (panneau admin → Utilisateurs → Décès et identifiants temporaires) et tout est transféré.
// Rien en version GTA World, ni pour un compte Civil qui remplit son propre dossier.
import React from 'react';
import TemporaryIdPicker from './TemporaryIdPicker';
import { useSiteMode } from '../../contexts/SiteConfigContext';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';

const CarePatientTemporaryId = ({ formData = {}, setFormData, idField = 'patientID', nameFields = ['patientFirstName', 'patientMiddleName', 'patientLastName'], fullNameField = 'patientName' }) => {
    const { isClassic } = useSiteMode();
    const { currentEmployee, isCivilian } = useEmployeeAuth();
    if (!isClassic || !currentEmployee || isCivilian || !idField) return null;
    const personName = nameFields.map((field) => (field ? formData[field] : '')).filter(Boolean).join(' ').trim() || String(formData[fullNameField] || '').trim();
    return (
        <TemporaryIdPicker
            context="care"
            value={formData[idField] || ''}
            onChange={(next) => setFormData((prev) => ({ ...prev, [idField]: next }))}
            personName={personName}
        />
    );
};

export default CarePatientTemporaryId;
