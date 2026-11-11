import React from 'react';
import { Form } from 'react-bootstrap';
import PatientContextFields from './shared/PatientContextFields';
import CareFormHeader from './shared/CareFormHeader';
import { AptitudeFields } from './shared/CareExtraFields';
import { aptitudeStatement } from '../utils/careFormRules';
import PresetTextField from './shared/PresetTextField';
import { PHYS_EVAL_PRESETS } from '../constants/careFormPresets';

const PhysEval = ({
            formData,
            handleChange,
            phmcGroupedOptions,
            unrestrictedPhmcGroupedOptions,
            setFormData,
            phmcRank,
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
                                <CareFormHeader formData={formData} setFormData={setFormData} handleChange={handleChange} phmcGroupedOptions={phmcGroupedOptions} unrestrictedPhmcGroupedOptions={unrestrictedPhmcGroupedOptions} />

                                <PatientContextFields formData={formData} setFormData={setFormData} handleChange={handleChange} showHistory={false} />

                                    <Form.Label className="form-section-title">Mesures du patient</Form.Label>
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


                                    <Form.Label className="form-section-title">Signes vitaux</Form.Label>
                                    <div style={{ marginBottom: '0.5rem' }}>
                                        <button type="button" className="btn btn-sm btn-outline-primary" title="Renseigne des constantes normales (température, pouls, respiration, tension) : à ajuster ensuite si besoin"
                                            onClick={() => setFormData((prev) => ({ ...prev, temperature: 'patientTempNormal', heartRate: 'patientHeartRateNormal', breathing: 'patientBreathingNormal', bloodPressure: 'patientBloodPressureNormal' }))}>
                                            <i className="fas fa-heart-pulse me-1"></i>Constantes normales
                                        </button>
                                    </div>
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
                                    <Form.Label className="form-section-title">Anamnèse</Form.Label>
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
                                        <option value="" disabled>Risques professionnels</option>
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
                                    <PresetTextField name="patientCareer" formData={formData} setFormData={setFormData} presets={PHYS_EVAL_PRESETS.patientCareer} placeholder="Emploi du patient" rows={2} />
                                )}
                                    {formData.patientJob === 'No' && (
                                    <PresetTextField name="patientcareerNo" formData={formData} setFormData={setFormData} presets={PHYS_EVAL_PRESETS.patientcareerNo} placeholder="Description de l'activité sans emploi" rows={2} />
                                )} 
                                    {formData.patientJobRisks === 'Yes' && (
                                    <PresetTextField name="careerRisks" formData={formData} setFormData={setFormData} presets={PHYS_EVAL_PRESETS.careerRisks} placeholder="Risques professionnels du patient" rows={2} />
                                )} 
                                  {formData.patientAllergiesRisk === 'Yes' && (
                                    <PresetTextField name="patientAllergies" formData={formData} setFormData={setFormData} presets={PHYS_EVAL_PRESETS.patientAllergies} placeholder="Risques d'allergies du patient" rows={2} />
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
                                    <PresetTextField name="patientMedicine" formData={formData} setFormData={setFormData} presets={PHYS_EVAL_PRESETS.patientMedicine} placeholder="Quel(s) médicament(s) le patient prend-il actuellement?" rows={2} />
                                )} 
                                    {formData.patientOther === 'Yes' && (
                                    <PresetTextField name="patientImpairments" formData={formData} setFormData={setFormData} presets={PHYS_EVAL_PRESETS.patientImpairments} placeholder="Déficiences du patient" rows={2} />
                                )} </div>
                                        <Form.Control
                                        as="textarea"
                                        name="patientSummary"
                                        value={formData.patientSummary}
                                        onChange={handleChange}
                                        rows="4"
                                        className="form-control"
                                        placeholder="Déclaration d'évaluation"
                                    />
                                    <div style={{ marginTop: '0.4rem' }}>
                                        <button type="button" className="btn btn-sm btn-outline-primary" disabled={!formData.aptitudeConclusion}
                                            title={formData.aptitudeConclusion ? "Propose une déclaration d'après la conclusion d'aptitude choisie plus bas" : "Choisissez d'abord la conclusion d'aptitude plus bas"}
                                            onClick={() => {
                                                const text = aptitudeStatement(formData);
                                                if (formData.patientSummary && String(formData.patientSummary).trim() && !window.confirm('Remplacer la déclaration déjà saisie ?')) return;
                                                setFormData((prev) => ({ ...prev, patientSummary: text }));
                                            }}>
                                            <i className="fas fa-wand-magic-sparkles me-1"></i>Proposer une déclaration
                                        </button>
                                    </div>
                                </Form.Group>
                                <AptitudeFields formData={formData} setFormData={setFormData} handleChange={handleChange} />
                            </>
    );
};

export default PhysEval;
