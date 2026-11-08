import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select'; // Make sure react-select is imported
import NameFields from './shared/NameFields';
import PhmcEmployeeSelect, { withDmecOptions } from './shared/PhmcEmployeeSelect';

// Patient : titre et nom en trois champs (le nom complet « patientName » est recomposé tout seul).
const NOTE_PATIENT_FIELDS = { full: 'patientName', first: 'patientFirstName', middle: 'patientMiddleName', last: 'patientLastName', title: 'patientTitle' };

const CommNotePBC = ({
    formData,
    handleChange,
    phmcGroupedOptions,
    coronerGroupedOptions,
    departmentLarge,
    setFormData // We need this for the Select's onChange logic
}) => {
    return (
        <>
            <Form.Label className="form-section-title">Patient</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <NameFields
                    formData={formData} setFormData={setFormData} handleChange={handleChange} fields={NOTE_PATIENT_FIELDS}
                    placeholders={{ first: 'Prénom du patient', middle: 'Deuxième prénom', last: 'Nom de famille' }}
                />
            </div>
            <Form.Control
                type="text"
                name="patientID"
                value={formData.patientID}
                onChange={handleChange}
                placeholder="ID Patient (ex. PHMC-2752) : relie le rapport à son dossier"
                className="form-control"
                style={{ marginTop: '10px' }}
            />

            <Form.Label className="form-section-title">Note de service</Form.Label>
            <Form.Label>Date:</Form.Label>
            <Form.Control
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="form-control"
            />
            <Form.Control
                as="textarea" 
                name="patientNotes"
                value={formData.patientNotes}
                onChange={handleChange}
                placeholder="Notes du patient"
                rows="4"
                className="form-control"
            />

            <Form.Label className="form-section-title">Identifiants de l'employé</Form.Label>

            <PhmcEmployeeSelect options={withDmecOptions(phmcGroupedOptions, coronerGroupedOptions)} formData={formData} setFormData={setFormData} />
            <Form.Label className="form-section-title">Service</Form.Label>
            <Select
                name="departmentLarge"
                value={departmentLarge.find(option => option.value === formData.departmentLarge)}
                onChange={(selectedOption) => {
                    // This uses the standard handleChange for simple value updates
                    handleChange({
                        target: {
                            name: 'departmentLarge',
                            value: selectedOption ? selectedOption.value : ''
                        }
                    });
                }}
                options={departmentLarge}
                isClearable
                placeholder="Sélectionner un département..."
                className="form-control"
                styles={{ // Keep the styles for react-select
                    control: (base) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: '#30363d',
                        '&:hover': {
                            borderColor: '#30363d'
                        }
                    }),
                    menu: (base) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        zIndex: 1000
                    }),
                    option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused ? 'Grey' : '#16202c',
                        color: '#eeeeeeb0'
                    }),
                    singleValue: (base) => ({
                        ...base,
                        color: '#eeeeeeb0'
                    }),
                    input: (base) => ({
                        ...base,
                        color: '#eeeeeeb0'
                    }),
                    placeholder: (base) => ({
                        ...base,
                        color: '#eeeeeeb0'
                    })
                }}
            />
            <Form.Label></Form.Label>
        </>
    );
};

export default CommNotePBC;