import React from 'react';
import { Form } from 'react-bootstrap';
import PatientContextFields from './shared/PatientContextFields';
import CareFormHeader from './shared/CareFormHeader';
import { RiskFields, EmergencyContactSection } from './shared/CareExtraFields';
import PresetTextField from './shared/PresetTextField';
import { MENTAL_HEALTH_PRESETS } from '../constants/careFormPresets';

const MentalHealth = ({
    formData,
    handleChange,
    phmcRank,
    phmcGroupedOptions,
    unrestrictedPhmcGroupedOptions,
    admission,
    followup,
    setFormData,
    handleSelectChange
}) => {
    
    return (
        <>
            <CareFormHeader formData={formData} setFormData={setFormData} handleChange={handleChange} phmcGroupedOptions={phmcGroupedOptions} unrestrictedPhmcGroupedOptions={unrestrictedPhmcGroupedOptions} />

            <PatientContextFields formData={formData} setFormData={setFormData} handleChange={handleChange} />

            <Form.Label className="form-section-title">Motif et constatations</Form.Label>
            <PresetTextField name="patientChiefComplaint" formData={formData} setFormData={setFormData} presets={MENTAL_HEALTH_PRESETS.patientChiefComplaint} placeholder="Plainte principale du patient" rows={2} />
            <PresetTextField name="patientNotes" formData={formData} setFormData={setFormData} presets={MENTAL_HEALTH_PRESETS.patientNotes} placeholder="Notes de session / observations du patient" rows={3} />

            <RiskFields formData={formData} handleChange={handleChange} />
            <EmergencyContactSection formData={formData} setFormData={setFormData} handleChange={handleChange} />

            <Form.Label className="form-section-title">Diagnostic de sortie</Form.Label>
            <PresetTextField name="patientDiagnosis" formData={formData} setFormData={setFormData} presets={MENTAL_HEALTH_PRESETS.patientDiagnosis} placeholder="Diagnostic" rows={2} />

            <Form.Label className="form-section-title">Thérapie et suivi</Form.Label>
            <Form.Select
                name="admission"
                value={formData.admission || ''}
                onChange={handleChange}
                className="form-control"
            >
                <option value="">Patient admis?</option>
                {(admission || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
            <PresetTextField name="patientProcedure" formData={formData} setFormData={setFormData} presets={MENTAL_HEALTH_PRESETS.patientProcedure} placeholder="Procédure(s) effectuée(s) / mise(s) en place" rows={2} />
            <PresetTextField name="patientMedicine" formData={formData} setFormData={setFormData} presets={MENTAL_HEALTH_PRESETS.patientMedicine} placeholder="Médicament(s) prescrit(s) / administré(s)" rows={2} />
            <Form.Select
                name="followup"
                value={formData.followup || ''}
                onChange={handleChange}
                className="form-control"
            >
                <option value="">Processus de suivi</option>
                {(followup || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
        </>
    );
};

export default MentalHealth;