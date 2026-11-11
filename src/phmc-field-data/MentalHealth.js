import React from 'react';
import { Form } from 'react-bootstrap';
import PatientContextFields from './shared/PatientContextFields';
import CareFormHeader from './shared/CareFormHeader';
import { RiskFields, EmergencyContactSection } from './shared/CareExtraFields';

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
            <Form.Control
                as="textarea"
                name="patientChiefComplaint"
                value={formData.patientChiefComplaint || ''}
                onChange={handleChange}
                placeholder="Plainte principale du patient"
                rows="2"
                className="form-control"
            />
            <Form.Control
                as="textarea"
                rows="3"
                name="patientNotes"
                value={formData.patientNotes || ''}
                onChange={handleChange}
                placeholder="Notes de session / observations du patient"
                className="form-control"
            />

            <RiskFields formData={formData} handleChange={handleChange} />
            <EmergencyContactSection formData={formData} setFormData={setFormData} handleChange={handleChange} />

            <Form.Label className="form-section-title">Diagnostic de sortie</Form.Label>
            <Form.Control
                as="textarea"
                name="patientDiagnosis"
                value={formData.patientDiagnosis || ''}
                onChange={handleChange}
                placeholder="Diagnostic"
                rows="2"
                className="form-control"
            />

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
            <Form.Control
                as="textarea"
                name="patientProcedure"
                value={formData.patientProcedure || ''}
                onChange={handleChange}
                placeholder="Procédure(s) effectuée(s) / mise(s) en place"
                rows="2"
                className="form-control"
            />
            <Form.Control
                as="textarea"
                name="patientMedicine"
                value={formData.patientMedicine || ''}
                onChange={handleChange}
                placeholder="Médicament(s) prescrit(s) / administré(s)"
                rows="2"
                className="form-control"
            />
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