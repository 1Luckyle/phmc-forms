import React from 'react';
import { Form } from 'react-bootstrap'; 
import Select from 'react-select';

const Shrink = ({
    formData,
    handleChange,
    setFormData,
    phmcGroupedOptions,
    phmcRank,
    Appearance,
    Behavior,
    Speech,
    Mood,
    ThoughtProcess,
    ThoughtContent,
    Insight,
    Cognition,
    Risk,
    admission,
    followup


}) => {
    return (
        <>
        <Form.Control
            type="text"
            name="patientID"
            value={formData.patientID}
            onChange={handleChange}
            placeholder="ID Patient"
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

<Form.Select
                    name="phmcRank"
                    value={formData.phmcRank}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.phmcRank ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Rang PHMC</option>
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
                // eslint-disable-next-line no-unused-vars
                const lastName = selectedOption ? selectedOption.lastName : '';
                setFormData(prev => ({
                    ...prev,
                    phmcEmployee: selectedOption ? selectedOption.value : '',
                    lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                }));
            }}
            options={phmcGroupedOptions}
            isClearable
            placeholder="Rechercher ou sélectionner un médecin..."
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
                <Form.Control
                as="textarea"
                name="patientChiefComplaint"
                value={formData.patientChiefComplaint}
                onChange={handleChange}
                placeholder="Plainte principale du patient"
                rows="3"
                className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                />

            <Form.Label> Problème présenté</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="patientVisitReason"
                    value={formData.patientVisitReason}
                    onChange={handleChange}
                    placeholder="Description du problème (ex: anxiété, dépression)"
                    required
                    className={`form-control ${!formData.patientVisitReason ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientSymptoms"
                    value={formData.patientSymptoms}
                    onChange={handleChange}
                    placeholder="Apparition et durée des symptômes"
                    required
                    className={`form-control ${!formData.patientSymptoms ? 'is-invalid' : ''}`}

                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="patientTriggers"
                    value={formData.patientTriggers}
                    onChange={handleChange}
                    placeholder="Déclencheurs ou facteurs de stress:"
                    required
                    className={`form-control ${!formData.patientTherapyMedicine ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientStress"
                    value={formData.patientStress}
                    onChange={handleChange}
                    placeholder="Impact sur la vie quotidienne:"
                    required
                    className={`form-control ${!formData.patientCareer ? 'is-invalid' : ''}`}

                />
            </div>

            <Form.Label> Examen de l'état mental (EEM) </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>

            <Form.Select
                    name="Appearance"
                    value={formData.Appearance}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.Appearance ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Apparence</option>
                    {Appearance.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                <Form.Select
                    name="Behavior"
                    value={formData.Behavior}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.Behavior ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Comportement</option>
                    {Behavior.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                <Form.Select
                    name="Speech"
                    value={formData.Speech}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.Speech ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Discours</option>
                    {Speech.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select
                        name="Mood"
                        value={formData.Mood}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.Mood ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Humeur</option>
                        {Mood.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    <Form.Select
                        name="Affect"
                        value={formData.Affect}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.Affect ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Affect</option>
                        {Behavior.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    <Form.Select
                        name="ThoughtProcess"
                        value={formData.ThoughtProcess}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.ThoughtProcess ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Processus de pensée</option>
                        {ThoughtProcess.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select
                        name="ThoughtContent"
                        value={formData.ThoughtContent}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.ThoughtContent ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Contenu de pensée</option>
                        {ThoughtContent.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    <Form.Select
                        name="Insight"
                        value={formData.Insight}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.Insight ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Perspicacité</option>
                        {Insight.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    <Form.Select
                        name="Cognition"
                        value={formData.Cognition}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.Cognition ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Cognition</option>
                        {Cognition.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    </div>
                    <Form.Label> Historique psychiatrique </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                name="patientTreatment"
                value={formData.patientTreatment}
                onChange={handleChange}
                placeholder="Diagnostics et traitements psychiatriques antérieurs:"
                rows="3"
                className={`form-control ${!formData.patientTreatment ? 'is-invalid' : ''}`}
                />
                <Form.Control
                as="textarea"
                name="patientMedicalRecord"
                value={formData.patientMedicalRecord}
                onChange={handleChange}
                placeholder="Hospitalisations"
                rows="3"
                className={`form-control ${!formData.patientMedicalRecord ? 'is-invalid' : ''}`}
                                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                name="patientFamily"
                value={formData.patientFamily}
                onChange={handleChange}
                placeholder="Historique psychiatrique familial:"
                rows="3"
                className={`form-control ${!formData.patientFamily ? 'is-invalid' : ''}`}
                 />
                <Form.Control
                as="textarea"
                name="patientJobRisks"
                value={formData.patientJobRisks}
                onChange={handleChange}
                placeholder="Historique d'automutilation ou tentatives de suicide"
                rows="3"
                className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}
                                />
                </div>
                <Form.Label> Historique médical </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                name="patientCondition"
                value={formData.patientCondition}
                onChange={handleChange}
                placeholder="Conditions médicales actuelles et passées:"
                rows="3"
                className={`form-control ${!formData.patientCondition ? 'is-invalid' : ''}`}
                 />
                <Form.Control
                as="textarea"
                name="patientChronicDiseases"
                value={formData.patientChronicDiseases}
                onChange={handleChange}
                placeholder="Médicaments (y compris psychiatriques et non psychiatriques):"
                rows="3"
                className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}
                />
                <Form.Control
                as="textarea"
                name="patientAllergies"
                value={formData.patientAllergies}
                onChange={handleChange}
                placeholder="Allergies du patient"
                rows="3"
                className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label> Historique d'abus de substances </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                type="text"
                name="patientDrugs"
                value={formData.patientDrugs}
                onChange={handleChange}
                placeholder="Consommation d'alcool, drogues, nicotine et autres substances:"
                className={`form-control ${!formData.patientDrugs ? 'is-invalid' : ''}`}
                 />
                <Form.Control
                type="text"
                name="patientDrugsUsage"
                value={formData.patientDrugsUsage}
                onChange={handleChange}
                placeholder="Fréquence et durée de consommation:"
                className={`form-control ${!formData.patientDrugsUsage ? 'is-invalid' : ''}`}
                />
                <Form.Control
                type="text"
                name="patientMental"
                value={formData.patientMental}
                onChange={handleChange}
                placeholder="Impact sur la santé mentale"
                className={`form-control ${!formData.patientMental ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label> Historique psychosocial </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                type="text"
                name="patientFam"
                value={formData.patientFam}
                onChange={handleChange}
                placeholder="Enfance et contexte familial:"
                className={`form-control ${!formData.patientFam ? 'is-invalid' : ''}`}
                 />
                <Form.Control
                type="text"
                name="patientJob"
                value={formData.patientJob}
                onChange={handleChange}
                placeholder="Historique d'éducation et d'emploi:"
                className={`form-control ${!formData.patientJob ? 'is-invalid' : ''}`}
                />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                type="text"
                name="patientRelationship"
                value={formData.patientRelationship}
                onChange={handleChange}
                placeholder="Relations et système de soutien:"
                className={`form-control ${!formData.patientRelationship ? 'is-invalid' : ''}`}
                />
                <Form.Control
                type="text"
                name="patientLegal"
                value={formData.patientLegal}
                onChange={handleChange}
                placeholder="Problèmes juridiques"
                className={`form-control ${!formData.patientLegal ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label> Évaluation des risques </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Select
                name="Risk"
                value={formData.Risk}
                onChange={handleChange}
                required
                className={`form-control ${!formData.Risk ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Évaluation des risques</option>
                {Risk.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
                <Form.Control
                type="text"
                name="patientRiskAssessment"
                value={formData.patientRiskAssessment}
                onChange={handleChange}
                placeholder="Détails de l'évaluation des risques:"
                className={`form-control ${!formData.patientRiskAssessment ? 'is-invalid' : ''}`}
                />
                </div>
                <Form.Label> Constatations </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                type="text"
                name="patientFindings"
                value={formData.patientFindings}
                onChange={handleChange}
                placeholder="Notes / Constatations du patient:"
                className={`form-control ${!formData.patientFindings ? 'is-invalid' : ''}`}
                />
                </div>

                <Form.Label> Diagnostic de sortie </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                type="text"
                name="patientDiagnosis"
                value={formData.patientDiagnosis}
                onChange={handleChange}
                placeholder="Diagnostic principal:"
                className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
                />
                </div>
                <Form.Label> Thérapie </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
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
                type="text"
                name="patientTreatmentPlan"
                value={formData.patientTreatmentPlan}
                onChange={handleChange}
                placeholder="Plan de traitement:"
                className={`form-control ${!formData.patientTreatmentPlan ? 'is-invalid' : ''}`}
                />
                <Form.Control
                type="text"
                name="patientTherapyMedicine"
                value={formData.patientTherapyMedicine}
                onChange={handleChange}
                placeholder="Médicament:"
                className={`form-control ${!formData.patientTherapyMedicine ? 'is-invalid' : ''}`}
                />
                <Form.Select
                name="followup"
                value={formData.followup}
                onChange={handleChange}
                required
                className={`form-control ${!formData.followup ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Suivi</option>
                {followup.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>

                </div>
                <Form.Label> Plan de traitement / Recommandations </Form.Label>
        <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                type="text"
                name="patientTreatmentMedicine"
                value={formData.patientTreatmentMedicine}
                onChange={handleChange}
                placeholder="Médicaments:"
                className={`form-control ${!formData.patientTreatmentMedicine ? 'is-invalid' : ''}`}

                />
                <Form.Control
                type="text"
                name="patientTherapy"
                value={formData.patientTherapy}
                onChange={handleChange}
                placeholder="Thérapie (ex: TCC, TCD):"
                className={`form-control ${!formData.patientTherapy ? 'is-invalid' : ''}`}
                /></div> 
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                type="text"
                name="patientFollowUp"
                value={formData.patientFollowUp}
                onChange={handleChange}
                placeholder="Rendez-vous de suivi:"
                className={`form-control ${!formData.patientFollowUp ? 'is-invalid' : ''}`}

                />
                <Form.Control
                type="text"
                name="patientSafety"
                value={formData.patientSafety}
                onChange={handleChange}
                placeholder="Planification de la sécurité (si à risque):"
                className={`form-control ${!formData.patientSafety ? 'is-invalid' : ''}`}
                />

                </div>

                </>
);
};

export default Shrink;
