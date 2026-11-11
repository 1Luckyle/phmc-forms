import React, { useMemo } from 'react'; // Added useMemo
import { Form } from 'react-bootstrap';
import Select from 'react-select';
import PatientContextFields from './shared/PatientContextFields';
import CareFormHeader from './shared/CareFormHeader';
import { EmergencyTimingFields, EmergencyDischargeFields, DeathFields } from './shared/CareExtraFields';
import ClinicalAssistant from './shared/ClinicalAssistant';
import { ARRIVAL_MODES } from '../constants/careFormOptions';

// Modes d'arrivée : constants/careFormOptions.js (à pied, véhicule personnel, ambulance, hélicoptère, forces de l'ordre, transfert).
const ARRIVAL_MODE_OPTIONS = ARRIVAL_MODES;

// Valeurs chiffrées facultatives des signes vitaux. Les catégories (normal /
// anormal) restent les cases à cocher du protocole ; ces valeurs les précisent.
const VITAL_VALUE_FIELDS = [
    { name: 'temperatureValue', placeholder: 'T° (°C)', inputMode: 'decimal' },
    { name: 'heartRateValue', placeholder: 'FC (bpm)', inputMode: 'numeric' },
    { name: 'respiratoryRateValue', placeholder: 'FR (/min)', inputMode: 'numeric' },
    { name: 'bloodPressureValue', placeholder: 'TA (ex. 120/80)', inputMode: 'text' },
    { name: 'spo2Value', placeholder: 'SpO2 (%)', inputMode: 'numeric' },
    { name: 'glucoseValue', placeholder: 'Glycémie (g/L)', inputMode: 'decimal' },
    { name: 'gcsScore', placeholder: 'Glasgow (3-15)', inputMode: 'numeric' },
];

// customSelectStyles remains the same

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
        color: '#9aa7b4',
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
        color: '#9aa7b4'
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
        color: '#9aa7b4',
        fontWeight: 600,
        textTransform: 'uppercase',
        fontSize: '0.75rem',
        marginBottom: 4
    })
};


const EmergencyForm = ({
    formData,
    handleChange,
    setFormData,
    phmcRank,
    phmcGroupedOptions,
    unrestrictedPhmcGroupedOptions,
    lab,
    painLevel,
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
    admission,
    bloodOxy,
    handleSelectChange,
    followup,
    Imaging,
    XrayResults,
    ctResults,
    mriResults,
    ultrasoundResults,
    otherResults
}) => {

    const imagingOptionsMapping = useMemo(() => ({
        XRay: { options: XrayResults || [], formDataKey: 'XrayResults', label: 'Résultats radiographie' },
        CTScan: { options: ctResults || [], formDataKey: 'ctResults', label: 'Résultats scanner' },
        MRI: { options: mriResults || [], formDataKey: 'mriResults', label: 'Résultats IRM' },
        Ultrasound: { options: ultrasoundResults || [], formDataKey: 'ultrasoundResults', label: 'Résultats échographie' },
        Other: { options: otherResults || [], formDataKey: 'otherImagingResults', label: 'Autres résultats d\'imagerie' },
    }), [XrayResults, ctResults, mriResults, ultrasoundResults, otherResults]);

    const groupedImagingResultsOptions = useMemo(() => {
        if (!formData.Imaging || formData.Imaging.length === 0 || formData.Imaging.includes('NoneRequired')) {
            return [];
        }
        return formData.Imaging.reduce((acc, imagingType) => {
            const mapping = imagingOptionsMapping[imagingType];
            if (mapping && mapping.options.length > 0) {
                acc.push({
                    label: mapping.label,
                    options: mapping.options.map(opt => ({ ...opt, imagingType: imagingType, originalFormDataKey: mapping.formDataKey }))
                });
            }
            return acc;
        }, []);
    }, [formData.Imaging, imagingOptionsMapping]);

    const selectedImagingResultsValue = useMemo(() => {
        const selectedValues = [];

        if (formData.Imaging && !formData.Imaging.includes('NoneRequired')) {
            formData.Imaging.forEach(imagingType => {
                const mapping = imagingOptionsMapping[imagingType];
                if (mapping && formData[mapping.formDataKey]) {
                    const resultsForType = formData[mapping.formDataKey];
                    resultsForType.forEach(resultValue => {
                        const option = mapping.options.find(opt => opt.value === resultValue);
                        if (option) {
                            selectedValues.push({
                                ...option,
                                imagingType: imagingType,
                                originalFormDataKey: mapping.formDataKey
                            });
                        }
                    });
                }
            });
        }
        return selectedValues;
    }, [formData, imagingOptionsMapping]);

 const handleImagingResultsChange = (selectedOptions) => {
     console.log("handleImagingResultsChange called with:", selectedOptions);

         const newFormDataSlice = {};
     // Initialize all relevant formData keys to empty arrays
     Object.values(imagingOptionsMapping).forEach(mapping => {
         newFormDataSlice[mapping.formDataKey] = [];
     });

    if (selectedOptions && selectedOptions.length > 0 && !selectedOptions.some(opt => opt.value === 'NoneRequired')) {
        selectedOptions.forEach(option => {
            const { originalFormDataKey, value } = option;
            if (originalFormDataKey && newFormDataSlice[originalFormDataKey]) {
                newFormDataSlice[originalFormDataKey].push(value);
            }
        });
    }

    setFormData(prev => ({
        ...prev,
        ...newFormDataSlice
    }));
};
    // Patient décédé : plus d'admission, de traitement à poursuivre, d'ordonnance ni de suivi.
    const deceased = formData.careDeceased === 'Yes';
    return (
        <>
            {/* ... (Your existing form fields up to the Findings section) ... */}
            <p>Si vous avez besoin d'aide avec ce formulaire <a href="https://discord.gg/Qupn5tWc6H" target="_blank" rel="noopener noreferrer">utilisez ce lien! Il vous renverra vers le Discord du PHMC</a>. </p>
            <CareFormHeader formData={formData} setFormData={setFormData} handleChange={handleChange} phmcGroupedOptions={phmcGroupedOptions} unrestrictedPhmcGroupedOptions={unrestrictedPhmcGroupedOptions} withExtraStaff />

            <PatientContextFields formData={formData} setFormData={setFormData} handleChange={handleChange} allergiesRequired={false} />

            <ClinicalAssistant formData={formData} setFormData={setFormData} handleChange={handleChange} bloodOxyOptions={bloodOxy} />

            <Form.Label className="form-section-title">Arrivée aux urgences</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select
                    name="arrivalMode"
                    value={formData.arrivalMode || ''}
                    onChange={handleChange}
                    className="form-control"
                >
                    <option value="" disabled>Mode d'arrivée</option>
                    {ARRIVAL_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                <Form.Control
                    type="time"
                    name="arrivalTime"
                    value={formData.arrivalTime || ''}
                    onChange={handleChange}
                    title="Heure d'arrivée du patient"
                    className="form-control"
                />
            </div>

            <EmergencyTimingFields formData={formData} handleChange={handleChange} />

            <Form.Label className="form-section-title">Anamnèse</Form.Label>
            <Form.Control
                as="textarea"
                rows={2}
                name="patientChiefComplaint"
                value={formData.patientChiefComplaint || ''}
                onChange={handleChange}
                placeholder="Plainte principale du patient"
                className="form-control"
            />
            <Form.Control
                as="textarea"
                rows={2}
                name="patientInjuryMechanism"
                value={formData.patientInjuryMechanism || ''}
                onChange={handleChange}
                placeholder="Mécanisme de la blessure / circonstances (comment le patient a été blessé)"
                className="form-control"
            />
            <Form.Select
                name="painLevel"
                value={formData.painLevel}
                onChange={handleChange}
                className="form-control"
            >
                <option value="" disabled>Indice de gravité d'urgence / douleur (EVA)</option>
                {painLevel.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>

            <Form.Label className="form-section-title">Signes vitaux (T° | FC | FR | TA | SpO2)</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select name="temperature" value={formData.temperature} onChange={handleChange} className="form-control">
                    <option value="" disabled>Température</option>
                    {temperature.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="heartRate" value={formData.heartRate} onChange={handleChange} className="form-control">
                    <option value="" disabled>Fréquence cardiaque</option>
                    {heartRate.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="breathing" value={formData.breathing} onChange={handleChange} className="form-control">
                    <option value="" disabled>Respiration</option>
                    {breathing.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="bloodPressure" value={formData.bloodPressure} onChange={handleChange} className="form-control">
                    <option value="" disabled>Tension artérielle</option>
                    {bloodPressure.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="bloodOxy" value={formData.bloodOxy} onChange={handleChange} className="form-control">
                    <option value="" disabled>Oxygène sanguin</option>
                    {bloodOxy.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
            </div>
            <Form.Label>Valeurs mesurées (précisent les catégories ci-dessus)</Form.Label>
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
                <Form.Select name="findings" value={formData.findings} onChange={handleChange} className="form-control">
                    <option value="" disabled>État de santé général</option>
                    {findings.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="lungs" value={formData.lungs} onChange={handleChange} className="form-control">
                    <option value="" disabled>Poumons du patient</option>
                    {lungs.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="pupils" value={formData.pupils} onChange={handleChange} className="form-control">
                    <option value="" disabled>Pupilles du patient</option>
                    {pupils.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select name="wounds" value={formData.wounds} onChange={handleChange} className="form-control">
                    <option value="" disabled>Blessures du patient</option>
                    {wounds.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="ecg" value={formData.ecg} onChange={handleChange} className="form-control">
                    <option value="" disabled>Résultats ECG</option>
                    {ecg.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
                <Form.Select name="sono" value={formData.sono} onChange={handleChange} className="form-control">
                    <option value="" disabled>Résultats échographie</option>
                    {sono.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
            </div>


            {/* Imaging Type Select */}
            <Form.Label className="form-section-title">Examens complémentaires</Form.Label>
            <Form.Label>Imagerie effectuée</Form.Label>
<Select
    isMulti
    name="Imaging"
    value={(Imaging || []).filter(option =>
        formData.Imaging?.includes(option.value)
    )}
    onChange={(selectedOptions) => {
        console.log("Imaging Select onChange:", selectedOptions);
        const newImagingSelectionValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
        let updatedFormDataSlice = { Imaging: [] };

        if (newImagingSelectionValues.includes('NoneRequired')) {
            updatedFormDataSlice.Imaging = ['NoneRequired'];
            Object.values(imagingOptionsMapping).forEach(mapping => {
                updatedFormDataSlice[mapping.formDataKey] = [];
            });
        } else {
            updatedFormDataSlice.Imaging = newImagingSelectionValues.filter(val => val !== 'NoneRequired');
            const oldImagingSelectionValues = formData.Imaging || [];
            oldImagingSelectionValues.forEach(type => {
                if (type !== 'NoneRequired' && !updatedFormDataSlice.Imaging.includes(type)) {
                    const mapping = imagingOptionsMapping[type];
                    console.log(`Mapping for type "${type}":`, mapping); // <---- ADD THIS LOG
                    if (mapping) {
                        if (!updatedFormDataSlice.hasOwnProperty(mapping.formDataKey)) {
                             updatedFormDataSlice[mapping.formDataKey] = [];
                        }
                    }
                }
            });
        }
        console.log("Imaging Select onChange - updatedFormDataSlice:", updatedFormDataSlice);
        setFormData(prev => ({ ...prev, ...updatedFormDataSlice }));
    }}
    options={Imaging || []}
    className={`form-control p-0 `}
    classNamePrefix="react-select"
    placeholder="Sélectionner le(s) type(s) d'imagerie... (Multi-sélection)"
    styles={customSelectStyles}
/>
            <Form.Label></Form.Label>

            {/* Single Merged Imaging Results Select - Conditionally Rendered */}
            {formData.Imaging && formData.Imaging.length > 0 && !formData.Imaging.includes('NoneRequired') && (
                <>
                    <Form.Label>Résultats d'imagerie</Form.Label>
                    <Select
                        isMulti
                        name="CombinedImagingResults"
                        value={selectedImagingResultsValue}
                        onChange={handleImagingResultsChange}
                        options={groupedImagingResultsOptions}
                        className={`form-control p-0 mb-2`}
                        classNamePrefix="react-select"
                        placeholder="Sélectionner le(s) résultat(s) d'imagerie... (Multi-sélection | Scroller jusqu'en bas pour voir tous les résultats)"
                        styles={customSelectStyles}
                    />
                </>
            )}
            <Form.Label></Form.Label>


            <Select
                isMulti
                name="lab"
                value={(lab || []).filter(option =>
                    formData.lab?.includes(option.value)
                )}
                onChange={(selectedOptions) => {
                    setFormData(prev => ({
                        ...prev,
                        lab: selectedOptions ? selectedOptions.map(option => option.value) : []
                    }));
                }}
                options={lab || []}
                className={`form-control p-0 `}
                classNamePrefix="react-select"
                placeholder="Sélectionner les résultats de laboratoire... (Multi-sélection)"
                styles={customSelectStyles}
            />
            <Form.Label></Form.Label> {/* Spacer */}

            {/* ... (rest of your form: Preliminary Diagnosis, Discharge Notes, etc.) ... */}
            <Form.Label className="form-section-title">Diagnostic préliminaire</Form.Label>
            <Form.Control as="textarea" name="patientDiagnosis" value={formData.patientDiagnosis} onChange={handleChange} rows="2" placeholder="Diagnostic principal du patient" className="form-control" />
            <Form.Control as="textarea" name="patientSecondaryDiagnosis" value={formData.patientSecondaryDiagnosis} onChange={handleChange} rows="2" placeholder="Diagnostic secondaire du patient (écrire « Aucun » si aucun)" className="form-control" />

            <Form.Label className="form-section-title">Thérapie et sortie</Form.Label>
            <Form.Control as="textarea" name="patientProcedure" value={formData.patientProcedure} onChange={handleChange} rows="3" placeholder="Procédures effectuées sur le patient" className="form-control" />
            {!deceased && (
                <Form.Select name="admission" value={formData.admission} onChange={handleChange} className="form-control">
                    <option value="" disabled>Patient admis?</option>
                    {admission.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </Form.Select>
            )}
            {!deceased && (
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    <Form.Control as="textarea" name="patientMedicine" value={formData.patientMedicine} onChange={handleChange} rows="3" placeholder="Autres traitements, conseils verbaux et recommandations (les médicaments se saisissent dans la liste de l'assistant clinique)" className={`form-control mb-2 `} />
                    {/* Le suivi se renseigne que le patient soit admis ou non (le BBCode l'imprime dans les deux cas). */}
                    <Form.Select name="followup" value={formData.followup || ''} onChange={handleChange} className="form-control">
                        <option value="" disabled>Suivi requis?</option>
                        {(followup || []).map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                    </Form.Select>
                </div>
            )}

            <EmergencyDischargeFields formData={formData} setFormData={setFormData} handleChange={handleChange} />

            <DeathFields kind="emergency" formData={formData} setFormData={setFormData} handleChange={handleChange} />
        </>
    );
};

export default EmergencyForm;
