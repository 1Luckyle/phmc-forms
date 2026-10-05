import React from 'react';
import { Form } from 'react-bootstrap';

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
 * `showHistory` : false pour les formulaires qui ont déjà leurs propres champs
 * d'antécédents/allergies/traitements (évaluation physique, psychiatrie).
 */
const PatientContextFields = ({ formData, handleChange, showHistory = true, allergiesRequired = true, title = 'Contexte patient' }) => (
    <>
        <Form.Label className="form-section-title">{title}</Form.Label>
        <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                type="number"
                min="0"
                max="120"
                name="patientAgeYears"
                value={formData.patientAgeYears || ''}
                onChange={handleChange}
                placeholder="Âge du patient (en années)"
                required
                className={`form-control ${!formData.patientAgeYears ? 'is-invalid' : ''}`}
            />
            <Form.Select
                name="patientSex"
                value={formData.patientSex || ''}
                onChange={handleChange}
                required
                className={`form-control ${!formData.patientSex ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Sexe du patient</option>
                {PATIENT_GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
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
                        : 'Allergies connues (optionnel)'}
                    required={allergiesRequired}
                    className={`form-control ${allergiesRequired && !formData.patientAllergies ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    as="textarea"
                    rows={2}
                    name="patientChronicDiseases"
                    value={formData.patientChronicDiseases || ''}
                    onChange={handleChange}
                    placeholder="Antécédents médicaux / maladies chroniques (optionnel)"
                    className="form-control"
                />
                <Form.Control
                    as="textarea"
                    rows={2}
                    name="patientCurrentMedicine"
                    value={formData.patientCurrentMedicine || ''}
                    onChange={handleChange}
                    placeholder="Traitements habituels du patient (optionnel)"
                    className="form-control"
                />
            </>
        )}
    </>
);

export default PatientContextFields;
