import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';

const PhysEval = ({
            formData,
            handleChange,
            phmcGroupedOptions,
            setFormData,
            phmcRank,
            setShowEmployeeModal,
            BodyMassIndex,
            temperature,
            heartRate,
            breathing,
            bloodPressure,
            patientJob,
            patientJobRisks,
            patientAllergiesRisk,
            patientMedicineRegular,
            patientOther,
            predisposition,
            handleSelectChange,
            
        }) => {
    return (
    <>
                                <p>Le FORMULAIRE ci-dessous doit être utilisé et ajouté au dossier pour chaque rendez-vous médical, à la suite des autres.</p>
                                <Form.Label>Identifiant unique du patient | Date:</Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="ID Patient (Prénom (Deuxième Prénom) & Nom du patient si incertain)"
                                    required
                                    className="form-control"
                                />

                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                    
                                /> </div>

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
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
onChange={(selectedOption) => {
    handleSelectChange(selectedOption, { name: 'phmcEmployee' }); // Correct call to App.js handler

    // eslint-disable-next-line no-unused-vars
    const lastName = selectedOption ? selectedOption.lastName : '';
    // This direct setFormData is redundant if handleSelectChange in App.js already updates these fields
    setFormData(prev => ({
        ...prev,
        phmcEmployee: selectedOption ? selectedOption.value : '',
        lastName: selectedOption ? selectedOption.lastName : '' 
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


                                    <Form.Label>Mesures du patient</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    <Form.Control
                                        type="text"
                                        name="patientHeight"
                                        value={formData.patientHeight}
                                        onChange={handleChange}
                                        placeholder="Taille"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Poids"
                                    />

                                    <Form.Select
                                        name="BodyMassIndex"
                                        value={formData.BodyMassIndex}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                BodyMassIndex: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Indice de masse corporelle</option>
                                        {BodyMassIndex.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>


                                    <Form.Label>Signes vitaux</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="temperature"
                                        value={formData.temperature}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                temperature: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Température</option>
                                        {temperature.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="heartRate"
                                        value={formData.heartRate}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                heartRate: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Fréquence cardiaque</option>
                                        {heartRate.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="breathing"
                                        value={formData.breathing}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                breathing: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Respiration</option>
                                        {breathing.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="bloodPressure"
                                        value={formData.bloodPressure}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                bloodPressure: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Pression artérielle</option>
                                        {bloodPressure.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>

                                <Form.Group className="mb-3">
                                    <Form.Label>Anamnèse</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="patientJob"
                                        value={formData.patientJob}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientJob: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Emploi du patient</option>
                                        {patientJob.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientJobRisks"
                                        value={formData.patientJobRisks}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientJobRisks: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Risques professionnels (Optionnel) </option>
                                        {patientJobRisks.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientAllergiesRisk"
                                        value={formData.patientAllergiesRisk}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientAllergiesRisk: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Risques d'allergies du patient</option>
                                        {patientAllergiesRisk.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
</div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    {formData.patientJob === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientCareer"
                                    value={formData.patientCareer}
                                    onChange={handleChange}
                                    placeholder="Emploi du patient"
                                    required
                                    className="form-control"
                                    />
                                )}
                                    {formData.patientJob === 'No' && (
                                    <Form.Control
                                    type="text"
                                    name="patientcareerNo"
                                    value={formData.patientcareerNo}
                                    onChange={handleChange}
                                    placeholder="Description de l'activité sans emploi"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                    {formData.patientJobRisks === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="careerRisks"
                                    value={formData.careerRisks}
                                    onChange={handleChange}
                                    placeholder="Risques professionnels du patient"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                  {formData.patientAllergiesRisk === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientAllergies"
                                    value={formData.patientAllergies}
                                    onChange={handleChange}
                                    placeholder="Risques d'allergies du patient"
                                    required
                                    className="form-control"
                                    />
                                )} 

                                </div>
                                
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Select
                                        name="patientMedicineRegular"
                                        value={formData.patientMedicineRegular}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientMedicineRegular: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Médicaments actuels du patient</option>
                                        {patientMedicineRegular.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientOther"
                                        value={formData.patientOther}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientOther: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Déficiences du patient?</option>
                                        {patientOther.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="predisposition"
                                        value={formData.predisposition}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                predisposition: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Prédisposition</option>
                                        {predisposition.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    {formData.patientMedicineRegular === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientMedicine"
                                    value={formData.patientMedicine}
                                    onChange={handleChange}
                                    placeholder="Quel(s) médicament(s) le patient prend-il actuellement?"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                    {formData.patientOther === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientImpairments"
                                    value={formData.patientImpairments}
                                    onChange={handleChange}
                                    placeholder="Déficiences du patient"
                                    required
                                    className="form-control"
                                    />
                                )} </div>
                                        <Form.Control
                                        as="textarea"
                                        name="patientSummary"
                                        value={formData.patientSummary}
                                        onChange={handleChange}
                                        rows="4"
                                        required
                                        className={`form-control ${!formData.patientSummary ? 'is-invalid' : ''}`}
                                        placeholder="Déclaration d'évaluation"
                                    />
                                </Form.Group>
                            </>
    );
};

export default PhysEval;
