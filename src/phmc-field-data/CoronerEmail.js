import React, { useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { getFormDefinition } from '../formDefinitions'; // Import getFormDefinition

const customSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '38px',
        backgroundColor: '#16202c',
        color: '#eeeeeeb0',
        borderColor: state.isFocused ? '#86b7fe' : '#30363d',
        boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
        '&:hover': {
            borderColor: '#86b7fe'
        }
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#16202c',
        zIndex: 1000,
        border: '1px solid #30363d',
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
    }),
    singleValue: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    group: (base) => ({
        ...base,
        paddingTop: 8,
        paddingBottom: 8
    }),
    groupHeading: (base) => ({
        ...base,
        color: '#6c757d',
        fontWeight: 600,
        textTransform: 'uppercase',
        fontSize: '0.75rem',
        marginBottom: 4
    })
};

const CoronerEmail = ({ // Renamed component to follow PascalCase convention
    formData,
    handleChange,
    setFormData, // <-- Make sure setFormData is passed as a prop
    handleSelectChange, // Added this prop
    setShowEmployeeModal,
    coronerGroupedOptions,
    handleFillCoronerPhone,
    fillPhoneChecked,
    setFillPhoneChecked,
    addReport,
    removeReport,
    handleReportChange,
    toggleSavedReports 
}) => {

    // Get agencyDataStore from context
    const { agencyDataStore, isLoadingData } = useData();

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            decedentName: '',
            decedentOOC: ''
        }));
    }, [setFormData]);


    return (
        <>
            <p>Veuillez faire attention lors de l'ajout de rapports, cela peut prendre un certain temps à traiter. De plus, l'ajout de rapports ajoutera automatiquement le nom du défunt et le nom HRP du défunt !!!</p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                                    <Form.Label style={{ marginBottom: 0 }}>Identifiants de l'employé</Form.Label>
                                    <button
                                        type="button"
                                        onClick={() => setShowEmployeeModal(true)}
                                        className="close-button"
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.8rem',     
                                            lineHeight: '1.2'       
                                        }}
                                    >
                                        <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i> {/* Changed icon */}
                                        Nom manquant?
                                    </button>

                                </div>
                            <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                onChange={(selectedOption, actionMeta) => handleSelectChange(selectedOption, actionMeta)}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Sélectionner un coroner. (Vous pouvez taper pour rechercher!)"
                                    className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                                styles={customSelectStyles}
                                />
                                <Form.Label></Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        type="text"
                                        name="requestingOfficer"
                                        value={formData.requestingOfficer}
                                        onChange={handleChange}
                                        placeholder="Matricule & Prénom & Nom de l'officier demandeur"
                                        required
                                        className={`form-control ${!formData.requestingOfficer ? 'is-invalid' : ''}`}
                                        />
                                <Form.Select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.department ? 'is-invalid' : ''}`}
                                    disabled={isLoadingData || !agencyDataStore || Object.keys(agencyDataStore).length === 0}
                                >
                                    <option value="" disabled>
                                        {isLoadingData ? 'Chargement des départements...' : 'Sélectionner un département'}
                                    </option>
                                    {agencyDataStore && Object.entries(agencyDataStore).map(([key, agency]) => (
                                        <option key={key} value={key}>
                                            {agency.fullName || key}
                                        </option>
                                    ))}
                                </Form.Select>
</div>
<Form.Group className="mb-3">
    <Form.Label>
        Numéro de contact du coroner:
    </Form.Label>
    {/* Keep the input field */}
    <Form.Control
        type="text"
        name="coronerPHNumber"
        value={formData.coronerPHNumber}
        onChange={handleChange}
        required
        placeholder="Numéro de téléphone du coroner"
        className={`form-control ${!formData.coronerPHNumber ? 'is-invalid' : ''}`}
    />
</Form.Group>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="decedentName"
                                            value={formData.decedentName}
                                            onChange={handleChange}
                                            placeholder="Prénom (Deuxième Prénom) & Nom du défunt (IC)"
                                            required
                                            className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="decedentOOC"
                                        value={formData.decedentOOC}
                                        onChange={handleChange}
                                        placeholder="(( Nom du défunt (HRP) ))"
                                        required
                                        className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}
                                        />
                                    </div>

                                <Form.Group className="mb-3">
                                    <Form.Label>Coller le BBCode du formulaire:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="deathReport"
                                        value={formData.deathReport}
                                        onChange={handleChange}
                                        placeholder="Joindre la paperasse (Rapport de décès, Fatalité de masse)"
                                        rows="2"
                                        className={`form-control ${!formData.deathReport ? 'is-invalid' : ''}`}

                                    />
                                </Form.Group>
                                <span className="helper-text">
                                Télécharger l'image. Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                                </span>
            <Form.Group className="mb-3">
                <Form.Label>Rapports supplémentaires:</Form.Label>
                <div className="reports-container">
                    {(formData.additionalReports || []).map((report, index) => (
                        <div key={index} className="report-input">
                            <Form.Control
                                as="textarea"
                                value={report}
                                onChange={(e) => handleReportChange(index, e.target.value)}
                                placeholder="Joindre le rapport de coroner supplémentaire"
                                rows="4"
                                className={`form-control ${!report ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="danger"
                                onClick={() => removeReport(index)}
                                className="remove-report-button"
                            >
                                Retirer le rapport
                            </Button>
                        </div>
                    ))}
                    <div className="email-buttons">
                        <Button
                            variant="primary"
                            onClick={addReport}
                            className="add-report-button"
                        >
                            Ajouter un autre rapport
                        </Button>

                        <Button
                            variant="info"
                            onClick={() => toggleSavedReports([1, 11], 'Coroner', (reportData) => {
                                console.log('Selected report data:', reportData);
                                // Update the deathReport field with the selected report's BBCode
                                if (reportData && reportData.bbCode) {
                                    handleChange({
                                        target: {
                                            name: 'deathReport',
                                            value: reportData.bbCode
                                        }
                                    });
                                }
                            })}
                            className="email-button"
                        >
                            <i className="fas fa-save"></i> Joindre la paperasse (Rapports de décès, Fatalité de masse)
                        </Button>

                    </div>

                </div>
            </Form.Group>
        </>
    );
};
export default CoronerEmail;