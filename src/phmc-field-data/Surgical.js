import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';

const Surgical = ({ // Renamed component to follow PascalCase convention
            formData,
            handleChange,
            phmcGroupedOptions, // Added this prop
            unrestrictedPhmcGroupedOptions,
            setFormData,
            phmcRank,
            patientConsent,
            complications,
            procedureGood,
        }) => {
    return (
    <>
    <p>Ce formulaire est utilisé pour documenter une intervention chirurgicale. Il doit être ajouté au dossier pour chaque rendez-vous de chirurgie, à la suite des autres. Veuillez remplir tous les champs obligatoires avec précision. Le formulaire est ensuite enregistré dans le suivi des rapports du soignant.</p>
    <Form.Label>Identifiant unique du patient.</Form.Label>
    <Form.Control
                type="text"
                name="patientID"
                value={formData.patientID}
                onChange={handleChange}
                placeholder="ID Patient (Prénom (Deuxième Prénom) & Nom du patient si incertain)"
                className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}

            />

        <Form.Label>Date du rendez-vous</Form.Label>
        <Form.Control
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className={`form-control ${!formData.date ? 'is-invalid' : ''}`}

            required
        />

    <Form.Select
                name="phmcRank"
                value={formData.phmcRank || ''}
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
            const lastName = selectedOption ? selectedOption.lastName : '';
            setFormData(prev => ({
                ...prev,
                phmcEmployee: selectedOption ? selectedOption.value : '',
                lastName: lastName
            }));
        }}
        options={phmcGroupedOptions}
        isClearable
        placeholder="Sélectionner un chirurgien. (Vous pouvez taper pour rechercher!)"
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

    <Select
        isMulti
        name="extraStaff"
        options={unrestrictedPhmcGroupedOptions.map(group => ({
            label: group.label,
            options: group.options.map(option => ({ value: option.value, label: option.label }))
        }))}
        value={Array.isArray(formData.extraStaff)
            ? formData.extraStaff.map(staff => ({ value: staff, label: staff }))
            : []}
        onChange={(selectedOptions) => {
            const selectedValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
            handleChange({
                target: {
                    name: 'extraStaff',
                    value: selectedValues
                }
            });
        }}
        className="form-control"
        placeholder="Entrer le personnel présent (( Laisser vide si aucun )) "
        styles={{                                        
            control: (base) => ({
        ...base,
        minHeight: '38px',
        backgroundColor: '#16202c',
        color: '#eeeeeeb0',
        borderColor: '#6c757d',
        '&:hover': {
            borderColor: '#eeeeeeb0'
        }
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#16202c',
        zIndex: 1000,
        border: '1px solid #6c757d',
        borderRadius: '0.375rem'
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#30363d' : '#16202c',
        color: '#eeeeeeb0',
        padding: '0.5rem 1rem',
        '&:hover': {
            backgroundColor: '#30363d'
        }
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: '#30363d',
        color: '#eeeeeeb0'
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#6c757d',
        '&:hover': {
            backgroundColor: '#dc3545',
            color: '#fff'
        }
    }),
    input: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    placeholder: (base) => ({
        ...base,
        color: '#6c757d'
    })
}}
/>                                
    <Form.Label></Form.Label>
        <Form.Label>Enquête chirurgicale</Form.Label>
        <Form.Control
            type="text"
            name="surgeryProcedures"
            value={formData.surgeryProcedures}
            onChange={handleChange}
            placeholder="Nom de la procédure"
            required
        />

        <div style={{ display: 'flex', gap: '10px' }}>
        <Form.Select
        name="patientConsentOption"
        value={formData.patientConsentOption}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                patientConsentOption: selectedType,
                patientConsentYes: selectedType === 'Yes' ? prev.patientConsentYes : '',
                patientConsentNo: selectedType === 'No' ? prev.patientConsentNo : '',
            }));
        }}
        required
        className={`form-control ${!formData.patientConsentOption ? 'is-invalid' : ''}`}
    >
        <option value="" disabled>Patient consentant?</option>
        {patientConsent.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>        
    <Form.Select
        name="patientComplicationOptions"
        value={formData.patientComplicationOptions}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                patientComplicationOptions: selectedType,
                patientComplicationsYes: selectedType === 'Yes' ? prev.patientComplicationsYes : '',
                patientComplicationsNo: selectedType === 'No' ? prev.patientComplicationsNo : '',
            }));
        }}
        required
        className={`form-control ${!formData.patientComplicationOptions ? 'is-invalid' : ''}`}
    >
        <option value="" disabled>Complications chirurgicales?</option>
        {complications.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>
    <Form.Select
        name="procedureGoodOptions"
        value={formData.procedureGoodOptions}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                procedureGoodOptions: selectedType,
                procedureGoodYes: selectedType === 'Yes' ? prev.procedureGoodYes : '',
                procedureGoodNo: selectedType === 'No' ? prev.procedureGoodNo : '',
            }));
        }}
        required
        className={`form-control ${!formData.procedureGoodOptions ? 'is-invalid' : ''}`}
    >
        <option value="" disabled>Procédure réussie?</option>
        {procedureGood.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>
    </div>

        <Form.Label>Rapport post-anesthésie</Form.Label>
        <div style={{ display: 'flex', gap: '10px' }}>
        <Form.Control
            as="textarea"
            name="patientSummaryConsultation"
            value={formData.patientSummaryConsultation}
            onChange={handleChange}
            placeholder="Type et dosage d'anesthésie administrée"
            rows="4"
            required
            className={`form-control ${!formData.patientSummaryConsultation ? 'is-invalid' : ''}`}
        />
        <Form.Control
            as="textarea"
            name="patientAddress"
            value={formData.patientAddress}
            onChange={handleChange}
            rows="4"
            required
            className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}
            placeholder="Détails de l'anesthésie post-opératoire"
        /></div>
        <Form.Label>Résumé de la procédure chirurgicale</Form.Label>
        <Form.Control
            as="textarea"
            name="patientSummary"
            value={formData.patientSummary}
            onChange={handleChange}
            rows="4"
            required
            className={`form-control ${!formData.patientSummary ? 'is-invalid' : ''}`}
            placeholder="Résumé de la procédure chirurgicale"
        />
</>
    );
};

export default Surgical; // Export with PascalCase name
