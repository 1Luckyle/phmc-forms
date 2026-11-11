import React, { useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { ageOn } from '../../utils/flightCertificate';
import { todayIso } from '../../utils/appointmentDate';
import { usePatientDossier } from '../../utils/dossierLookup';
import { changedBackgroundFields, BACKGROUND_FIELD_LABELS } from '../../utils/careFormRules';

export const PATIENT_GENDER_OPTIONS = [
    { value: 'Male', label: 'Masculin' },
    { value: 'Female', label: 'Féminin' },
    { value: 'Other', label: 'Autre / Non précisé' },
];

/**
 * Bloc « Contexte patient » commun aux formulaires cliniques : ce qu'un
 * soignant a besoin de savoir avant d'interpréter le reste du dossier.
 * Garde la même présentation et les mêmes noms de champs partout (les valeurs
 * saisies suivent donc le patient d'un formulaire à l'autre).
 *
 * La date de naissance remplace la saisie de l'âge : l'âge (à la date du rendez-vous) se calcule
 * tout seul (`patientAgeYears`), et les deux figurent dans le rapport.
 *
 * `showHistory` : false pour les formulaires qui ont déjà leurs propres champs
 * d'antécédents/allergies/traitements (évaluation physique, psychiatrie).
 */
const PatientContextFields = ({ formData, setFormData, handleChange, showHistory = true, allergiesRequired = true, title = 'Contexte patient' }) => {
    const computedAge = ageOn(formData.patientDateOfBirth, formData.date);
    const ageText = computedAge !== null && computedAge >= 0 ? String(computedAge) : '';
    useEffect(() => {
        if (!setFormData || !formData.patientDateOfBirth) return;
        if (ageText !== String(formData.patientAgeYears || '')) setFormData((prev) => (String(prev.patientAgeYears || '') === ageText ? prev : { ...prev, patientAgeYears: ageText }));
    }, [ageText, formData.patientDateOfBirth, formData.patientAgeYears, setFormData]);


    // Allergies, antécédents et traitements corrigés par rapport au dossier : la mention « mis à jour lors de cette consultation » est ajoutée au rapport.
    const { status, donnees } = usePatientDossier(formData.patientID);
    const changedLabels = showHistory && status === 'found' ? changedBackgroundFields(donnees, formData).map((field) => BACKGROUND_FIELD_LABELS[field]) : [];
    const changedKey = changedLabels.join('|');
    const settled = status === 'found' || status === 'missing';
    useEffect(() => {
        if (!setFormData || !showHistory || !settled) return;
        const current = Array.isArray(formData.patientBackgroundUpdated) ? formData.patientBackgroundUpdated.join('|') : '';
        if (current !== changedKey) setFormData((prev) => ({ ...prev, patientBackgroundUpdated: changedKey ? changedKey.split('|') : [] }));
    }, [changedKey, settled, showHistory, formData.patientBackgroundUpdated, setFormData]);

    return (
        <>
            <Form.Label className="form-section-title">{title}</Form.Label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <Form.Label>Date de naissance</Form.Label>
                    <Form.Control type="date" name="patientDateOfBirth" value={formData.patientDateOfBirth || ''} max={todayIso()} onChange={handleChange} className="form-control" />
                </div>
                <div style={{ flex: '0 1 140px', minWidth: 0 }}>
                    <Form.Label>Âge</Form.Label>
                    <Form.Control type="text" readOnly disabled value={ageText ? `${ageText} ans` : ''} placeholder="Calculé" className="form-control" aria-label="Âge calculé à partir de la date de naissance" />
                </div>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <Form.Label>Sexe</Form.Label>
                    <Form.Select name="patientSex" value={formData.patientSex || ''} onChange={handleChange} className="form-control">
                        <option value="" disabled>Sexe du patient</option>
                        {PATIENT_GENDER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                </div>
            </div>
            {showHistory && (
                <>
                    <Form.Control
                        as="textarea"
                        rows={2}
                        name="patientAllergies"
                        value={formData.patientAllergies || ''}
                        onChange={handleChange}
                        placeholder={allergiesRequired
                            ? 'Allergies connues (écrire « Aucune connue » si aucune)'
                            : 'Allergies connues'}
                        className="form-control"
                    />
                    <Form.Control
                        as="textarea"
                        rows={2}
                        name="patientChronicDiseases"
                        value={formData.patientChronicDiseases || ''}
                        onChange={handleChange}
                        placeholder="Antécédents médicaux / maladies chroniques"
                        className="form-control"
                    />
                    <Form.Control
                        as="textarea"
                        rows={2}
                        name="patientCurrentMedicine"
                        value={formData.patientCurrentMedicine || ''}
                        onChange={handleChange}
                        placeholder="Traitements habituels du patient"
                        className="form-control"
                    />
                    {changedLabels.length > 0 && (
                        <span className="helper-text" data-no-tip="1">Modifié(s) par rapport au dossier ({changedLabels.join(', ')}) : la mention « mis à jour lors de cette consultation » sera ajoutée au rapport.</span>
                    )}
                </>
            )}
        </>
    );
};

export default PatientContextFields;
