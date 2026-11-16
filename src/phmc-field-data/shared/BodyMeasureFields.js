// src/phmc-field-data/shared/BodyMeasureFields.js
//
// Poids et taille du patient dans les formulaires du DOSSIER MÉDICAL (basique, avancé, mise à jour) : ces valeurs servent ensuite à préremplir les formulaires de soins
// (assistant clinique : doses calculées au poids, ASA, etc.). Saisie en kg et en cm (« 1,80 » est aussi compris comme 180 cm). Bornes communes à tout le site (clinical/bodyLimits.js) :
// poids de 1 à 400 kg, taille de 30 à 260 cm ; l'IMC se calcule tout seul dès que les deux valeurs sont lisibles.
import React from 'react';
import { Form } from 'react-bootstrap';
import { BODY_LIMITS, bmiOf, bmiCategory } from '../../clinical/bodyLimits';
import { ageOn } from '../../utils/minors';

const BodyMeasureFields = ({ formData, handleChange }) => {
    const bmi = bmiOf(formData.patientWeight, formData.patientHeight);
    const category = bmiCategory(bmi, ageOn(formData.patientDateOfBirth));
    return (
        <>
            <div style={{ display: 'flex', gap: '10px', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <Form.Control type="text" inputMode="decimal" name="patientWeight" value={formData.patientWeight || ''} onChange={handleChange} placeholder={`Poids en kg (de ${BODY_LIMITS.weightKg.min} à ${BODY_LIMITS.weightKg.max}, ex. 75)`} className="form-control" />
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <Form.Control type="text" inputMode="decimal" name="patientHeight" value={formData.patientHeight || ''} onChange={handleChange} placeholder={`Taille en cm (de ${BODY_LIMITS.heightCm.min} à ${BODY_LIMITS.heightCm.max}, ex. 178)`} className="form-control" />
                </div>
            </div>
            {bmi !== null && <span className="helper-text" data-no-tip="1">IMC calculé : <strong>{String(bmi).replace('.', ',')}</strong> kg/m² — {category.label}.</span>}
        </>
    );
};

export default BodyMeasureFields;
