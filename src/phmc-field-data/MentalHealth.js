import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select'; // Make sure react-select is imported

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
                    name="patientID"
                    value={formData.patientID}
                    onChange={handleChange}
                    placeholder="ID Patient (Prénom & Nom du patient si incertain)"
                    required
                    className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
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
            <Form.Label></Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    as="textarea"
                    name="patientChiefComplaint"
                    value={formData.patientChiefComplaint}
                    onChange={handleChange}
                    placeholder="Plainte principale du patient"
                    rows="3"
                    required
                    className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}

                />

                <Form.Control
                    as="textarea"
                    rows="3"
                    name="patientNotes"
                    value={formData.patientNotes}
                    onChange={handleChange}
                    placeholder="Notes du patient"
                    required
                    className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
                />
            </div>
            <Select
                name="admission"
                value={admission.find(option => option.value === formData.admission)}
                onChange={(selectedOption) => {
                    setFormData(prev => ({
                        ...prev,
                        admission: selectedOption ? selectedOption.value : ''
                    }));
                }}
                options={admission}
                isClearable
                placeholder="Patient admis?"
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
            <Form.Label></Form.Label>
            <Form.Label><br></br></Form.Label>

            <Form.Control
                as="textarea"
                name="patientDiagnosis"
                value={formData.patientDiagnosis}
                onChange={handleChange}
                placeholder="Diagnostic"
                rows="3"
                required
                className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}

            />
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    as="textarea"
                    name="patientProcedure"
                    value={formData.patientProcedure}
                    onChange={handleChange}
                    placeholder="Procédure(s) effectuée(s) / mise(s) en place"
                    rows="2"
                    className={`form-control ${!formData.patientProcedure ? 'is-invalid' : ''}`}

                />

                <Form.Control
                    as="textarea"
                    name="patientMedicine"
                    value={formData.patientMedicine}
                    onChange={handleChange}
                    placeholder="Médicament(s) prescrit(s) / administré(s)"
                    rows="2"
                    className={`form-control ${!formData.patientMedicine ? 'is-invalid' : ''}`}
                />
            </div>
            <Select
                name="followup"
                value={followup.find(option => option.value === formData.followup)}
                onChange={(selectedOption) => {
                    setFormData(prev => ({
                        ...prev,
                        followup: selectedOption ? selectedOption.value : ''
                    }));
                }}
                options={followup}
                isClearable
                placeholder="Sélectionner le processus de suivi..."
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

        </>
    );
};

export default MentalHealth;