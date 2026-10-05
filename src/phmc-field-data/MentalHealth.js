import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select'; // Make sure react-select is imported
import PatientContextFields from './shared/PatientContextFields';

const MentalHealth = ({
    formData,
    handleChange,
    phmcRank,
    phmcGroupedOptions,
    admission,
    followup,
    setFormData,
    handleSelectChange
}) => {
    
    return (
        <>
        <p>Ce formulaire est utilisé pour documenter une consultation psychatrique. Il doit être ajouté au dossier pour chaque rendez-vous de psychiatrie, à la suite des autres. Veuillez remplir tous les champs obligatoires avec précision. Le formulaire est ensuite enregistré dans le suivi des rapports du soignant.</p>
            <div style={{ display: 'flex', gap: '10px' }}>

                <Form.Control
                    type="text"
                    name="patientName"
                    value={formData.patientName}
                    onChange={handleChange}
                    placeholder="Prénom & Nom du patient"
                    required
                    className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientID"
                    value={formData.patientID}
                    onChange={handleChange}
                    placeholder="ID Patient (optionnel, si connu)"
                    className="form-control"
                />
                <Form.Label>Date:</Form.Label>
                <Form.Control
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Select
                name="phmcRank"
                value={formData.phmcRank}
                onChange={handleChange}
                required
                className={`form-control ${!formData.phmcRank ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Fonction au sein du PHMC</option>
                {phmcRank.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>


            <Select
                name="phmcEmployee"
                value={phmcGroupedOptions
                    .flatMap(group => group.options)
                    .find(option => option.value === formData.phmcEmployee) || null}
                onChange={(selectedOption) => {
                    handleSelectChange(selectedOption, { name: 'phmcEmployee' });

                    setFormData(prev => ({
                        ...prev,
                        phmcEmployee: selectedOption ? selectedOption.value : '',
                        lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                    }));
                }}
                options={phmcGroupedOptions}
                isClearable
                placeholder="Sélectionner un médecin. (Vous pouvez taper pour rechercher!)"
                className="form-control"
                styles={{
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

            <PatientContextFields formData={formData} handleChange={handleChange} />

            <Form.Label className="form-section-title">Motif et constatations</Form.Label>
            <Form.Control
                as="textarea"
                name="patientChiefComplaint"
                value={formData.patientChiefComplaint || ''}
                onChange={handleChange}
                placeholder="Plainte principale du patient"
                rows="2"
                required
                className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
            />
            <Form.Control
                as="textarea"
                rows="3"
                name="patientNotes"
                value={formData.patientNotes || ''}
                onChange={handleChange}
                placeholder="Notes de session / observations du patient"
                required
                className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
            />

            <Form.Label className="form-section-title">Diagnostic de sortie</Form.Label>
            <Form.Control
                as="textarea"
                name="patientDiagnosis"
                value={formData.patientDiagnosis || ''}
                onChange={handleChange}
                placeholder="Diagnostic"
                rows="2"
                required
                className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
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