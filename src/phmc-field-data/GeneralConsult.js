import React from 'react';
import { Form, InputGroup, Button} from 'react-bootstrap';
import Select from 'react-select';
import ImagePreview from '../components/ImagePreview';
import PatientContextFields from './shared/PatientContextFields';

// Valeurs chiffrées facultatives des signes vitaux (voir EmergencyForm).
const VITAL_VALUE_FIELDS = [
    { name: 'temperatureValue', placeholder: 'T° (°C)', inputMode: 'decimal' },
    { name: 'heartRateValue', placeholder: 'FC (bpm)', inputMode: 'numeric' },
    { name: 'respiratoryRateValue', placeholder: 'FR (/min)', inputMode: 'numeric' },
    { name: 'bloodPressureValue', placeholder: 'TA (ex. 120/80)', inputMode: 'text' },
    { name: 'spo2Value', placeholder: 'SpO2 (%)', inputMode: 'numeric' },
    { name: 'glucoseValue', placeholder: 'Glycémie (g/L)', inputMode: 'decimal' },
];

const GeneralConsult = ({
    bbCodeVersion,
    formData,
    handleChange,
    setFormData,
    phmcRank,
    phmcGroupedOptions,
    setShowEmployeeModal,
    phmcEmployee,
    lab,
    bloodOxy,
    temperature,
    heartRate,
    breathing,
    bloodPressure,
    findings,
    lungs,
    pupils,
    wounds,
    ecg,
    sono,
    assignedDepartment,
    followup,
    admission,
    isUploading,
    handleImageUpload,
    handleSelectChange
}) => {
    return (
                            <> 
                                <p>Ce formulaire est utilisé pour documenter une consultation médicale. Il doit être ajouté au dossier pour chaque rendez-vous médical, à la suite des autres. Veuillez remplir tous les champs obligatoires avec précision. Le formulaire est ensuite enregistré dans le suivi des rapports du soignant.</p>
                                <p>Si vous avez besoin d'aide avec ce formulaire <a href="https://discord.gg/SAd4NxU9VJ" target="_blank" rel="noopener noreferrer">utilisez ce lien! Il vous renverra vers le Discord du PHMC</a>. </p>

                                <Form.Control
                                    type="text"
                                    name="patientName"
                                    value={formData.patientName}
                                    onChange={handleChange}
                                    placeholder="Prénom (Deuxième Prénom) & Nom du patient"
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
                                    style={{ marginTop: '10px' }}
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

                                <PatientContextFields formData={formData} handleChange={handleChange} />

                                <Form.Label className="form-section-title">Motif de la consultation</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={2}
                                    name="patientChiefComplaint"
                                    value={formData.patientChiefComplaint || ''}
                                    onChange={handleChange}
                                    placeholder="Motif de la visite / plainte principale du patient"
                                    required
                                    className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                                />
                                {bbCodeVersion === 21 ? (
                                    <Form.Select
                                        name="paletoClinicDepartment"
                                        value={formData.paletoClinicDepartment || ''}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.paletoClinicDepartment ? 'is-invalid' : ''}`}
                                    >
                                        <option value="" disabled>Département assigné</option>
                                        <option value="InternalMedicine">Médecine interne</option>
                                        <option value="SurgicalDepartment">Département chirurgical</option>
                                    </Form.Select>
                                ) : (
                                    <Form.Select
                                        name="assignedDepartment"
                                        value={formData.assignedDepartment}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.assignedDepartment ? 'is-invalid' : ''}`}
                                    >
                                        <option value="" disabled>Département assigné</option>
                                        {assignedDepartment.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                )}

                                <Form.Label className="form-section-title">Signes vitaux (T° | FC | FR | TA | SpO2)</Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="temperature"
                                                value={formData.temperature}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.temperature ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Température</option>
                                                {temperature.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="heartRate"
                                                value={formData.heartRate}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.heartRate ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Fréquence cardiaque</option>
                                                {heartRate.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="breathing"
                                                value={formData.breathing}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.breathing ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Respiration</option>
                                                {breathing.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="bloodPressure"
                                                value={formData.bloodPressure}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.bloodPressure ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Tension artérielle</option>
                                                {bloodPressure.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                        <Form.Select
                                            name="bloodOxy"
                                            value={formData.bloodOxy}
                                            onChange={handleChange}
                                            required
                                            className={`form-control ${!formData.bloodOxy ? 'is-invalid' : ''}`}
                                        >
                                            <option value="" disabled>Oxygène sanguin</option>
                                            {bloodOxy.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </Form.Select>

                                            </div>
                                <Form.Label>Valeurs mesurées (optionnel — précisent les catégories ci-dessus)</Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {VITAL_VALUE_FIELDS.map((field) => (
                                        <Form.Control
                                            key={field.name}
                                            type="text"
                                            inputMode={field.inputMode}
                                            name={field.name}
                                            value={formData[field.name] || ''}
                                            onChange={handleChange}
                                            placeholder={field.placeholder}
                                            title={field.placeholder}
                                            className="form-control"
                                        />
                                    ))}
                                </div>
                                            <Form.Label className="form-section-title">Constatations</Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="findings"
                                                value={formData.findings}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.findings ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>État de santé général</option>
                                                {findings.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="lungs"
                                                value={formData.lungs}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.lungs ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Poumons du patient</option>
                                                {lungs.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="pupils"
                                                value={formData.pupils}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.pupils ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Pupilles du patient</option>
                                                {pupils.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                            
                                            <Form.Select
                                                name="wounds"
                                                value={formData.wounds}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Blessures du patient</option>
                                                {wounds.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="ecg"
                                                value={formData.ecg}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.ecg ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Résultats ECG</option>
                                                {ecg.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="sono"
                                                value={formData.sono}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.sono ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Résultats échographie</option>
                                                {sono.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>

                                <Select
                                    isMulti
                                    name="lab"
                                    value={lab.filter(option =>
                                        (formData.lab || []).includes(option.value)
                                    )}
                                    onChange={(selectedOptions) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lab: selectedOptions ? selectedOptions.map(option => option.value) : []
                                        }));
                                    }}
                                    options={lab}
                                    className="form-control"
                                    placeholder="Sélectionner les résultats de laboratoire... (Multi-sélection)"
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
                                /><Form.Label></Form.Label>
                            <Form.Label className="form-section-title">{bbCodeVersion === 21 ? 'Diagnostic de sortie' : 'Diagnostic préliminaire'}</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    name="patientDiagnosis"
                                    value={formData.patientDiagnosis}
                                    onChange={handleChange}
                                    rows="2"
                                    placeholder="Diagnostic principal du patient"
                                    required
                                    className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientSecondaryDiagnosis"
                                    value={formData.patientSecondaryDiagnosis}
                                    onChange={handleChange}
                                    rows="2"
                                    placeholder="Diagnostic secondaire du patient (écrire « Aucun » si aucun)"
                                    required
                                    className={`form-control ${!formData.patientSecondaryDiagnosis ? 'is-invalid' : ''}`}
                                />
                                <Form.Label className="form-section-title">Thérapie et suivi</Form.Label>
                                <Form.Select
                                name="admission"
                                value={formData.admission}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.admission ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Admission</option>
                                {admission.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                                <Form.Control
                                    as="textarea"
                                    name="patientProcedure"
                                    value={formData.patientProcedure}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Plan de traitement (conseils verbaux, recommandations, notes additionnelles)"
                                    required
                                    className={`form-control ${!formData.patientProcedure ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientMedicine"
                                    value={formData.patientMedicine || ''}
                                    onChange={handleChange}
                                    rows="2"
                                    placeholder="Médicaments prescrits ou administrés (nom, dosage, durée)"
                                    className="form-control"
                                />
                                {bbCodeVersion === 21 && (
                                    <Form.Control
                                        as="textarea"
                                        name="patientNotes"
                                        value={formData.patientNotes || ''}
                                        onChange={handleChange}
                                        rows="2"
                                        placeholder="Notes supplémentaires (optionnel)"
                                        className="form-control"
                                    />
                                )}

                                <Form.Group className="mb-3 upload-container">
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        name="scenePhotos"
                        value={formData.scenePhotos}
                        onChange={handleChange}
                        rows="2"
                        className="form-control"
                        placeholder="Coller l'URL ou télécharger une image du/des bon/s de prescription dans cette section à des fins d'archivage. (si applicable) (séparées par des virgules)"
                        onPaste={(e) => { // Keep the paste logic
                            const clipboardData = e.clipboardData || window.clipboardData;
                            const pastedData = clipboardData.getData('text');
                            const items = clipboardData.items;
                            let hasImageItem = false;
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const containsUrl = urlRegex.test(pastedData);

                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.indexOf('image') !== -1) {
                                    hasImageItem = true;
                                    const file = items[i].getAsFile();
                                    handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                                    e.preventDefault();
                                    break;
                                }
                            }
                            if (containsUrl && !hasImageItem) {
                                const currentValue = formData.scenePhotos || '';
                                const cursorPos = e.target.selectionStart;
                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                const newValue = currentValue.slice(0, cursorPos) +
                                    (cursorPos > 0 ? separator : '') +
                                    pastedData +
                                    currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, scenePhotos: newValue }));
                                e.preventDefault();
                            } else {
                                console.log('No URL detected or image item present');
                            }
                        }}
                    />
                    <Button
                        variant="success"
                        disabled={isUploading}
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.multiple = true;
                            input.onchange = (e) => handleImageUpload(e, 'scenePhotos');
                            input.click();
                        }}
                    >
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                        {isUploading ? 'Téléchargement...' : 'Télécharger images'}
                    </Button>
                </InputGroup>
                <ImagePreview imageUrls={formData.scenePhotos} />
                <span className="helper-text">Télécharger une image du bon de prescription si applicable. Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.</span>
            </Form.Group>

                                <Form.Select
                                name="followup"
                                value={formData.followup}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.followup ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Suivi requis?</option>
                                {followup.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>

                            </>
    );
};
          
export default GeneralConsult;