import React from 'react';
import { Form } from 'react-bootstrap'; 
import Select from 'react-select';
import PatientContextFields from './shared/PatientContextFields';

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
        <p>Si vous avez besoin d'aide avec ce formulaire <a href="https://discord.gg/Qupn5tWc6H" target="_blank" rel="noopener noreferrer">utilisez ce lien! Il vous renverra vers le Discord du PHMC</a>. </p>
        <Form.Label className="form-section-title">Patient et rendez-vous</Form.Label>
        <Form.Control
            type="text"
            name="patientName"
            value={formData.patientName}
            onChange={handleChange}
            placeholder="Prénom & Nom du patient"
            className="form-control"
            />
        <Form.Control
            type="text"
            name="patientID"
            value={formData.patientID}
            onChange={handleChange}
            placeholder="ID Patient (ex. PHMC-2752) : relie le rapport à son dossier"
            className="form-control"
            style={{ marginTop: '10px' }}
            />

        <Form.Label>Date:</Form.Label>
        <Form.Control
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className="form-control"
            />

<Form.Select
                    name="phmcRank"
                    value={formData.phmcRank}
                    onChange={handleChange}
                    className="form-control"
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
        <PatientContextFields formData={formData} handleChange={handleChange} showHistory={false} />
        <Form.Label className="form-section-title">Motif de la consultation</Form.Label>
                <Form.Control
                as="textarea"
                name="patientChiefComplaint"
                value={formData.patientChiefComplaint}
                onChange={handleChange}
                placeholder="Plainte principale du patient"
                rows="3"
                className="form-control"
                />

            <Form.Label className="form-section-title">Problème présenté</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    as="textarea"
                    rows="2"
                    name="patientVisitReason"
                    value={formData.patientVisitReason}
                    onChange={handleChange}
                    placeholder="Description du problème (ex: anxiété, dépression)"
                    className="form-control"

                />
                <Form.Control
                    as="textarea"
                    rows="2"
                    name="patientSymptoms"
                    value={formData.patientSymptoms}
                    onChange={handleChange}
                    placeholder="Apparition et durée des symptômes"
                    className="form-control"

                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    as="textarea"
                    rows="2"
                    name="patientTriggers"
                    value={formData.patientTriggers}
                    onChange={handleChange}
                    placeholder="Déclencheurs ou facteurs de stress"
                    className="form-control"

                />
                <Form.Control
                    as="textarea"
                    rows="2"
                    name="patientStress"
                    value={formData.patientStress}
                    onChange={handleChange}
                    placeholder="Impact sur la vie quotidienne"
                    className="form-control"

                />
            </div>

            <Form.Label className="form-section-title">Examen de l'état mental (EEM)</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>

            <Form.Select
                    name="Appearance"
                    value={formData.Appearance}
                    onChange={handleChange}
                    className="form-control"
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
                    className="form-control"
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
                    className="form-control"
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
                        className="form-control"
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
                        className="form-control"
                    >
                        <option value="" disabled>Aspect</option>
                        {Behavior.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    <Form.Select
                        name="ThoughtProcess"
                        value={formData.ThoughtProcess}
                        onChange={handleChange}
                        className="form-control"
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
                        className="form-control"
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
                        className="form-control"
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
                        className="form-control"
                    >
                        <option value="" disabled>Cognition</option>
                        {Cognition.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    </div>
                    <Form.Label className="form-section-title">Historique psychiatrique</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                name="patientTreatment"
                value={formData.patientTreatment}
                onChange={handleChange}
                placeholder="Diagnostics et traitements psychiatriques antérieurs"
                rows="3"
                className="form-control"
                />
                <Form.Control
                as="textarea"
                name="patientMedicalRecord"
                value={formData.patientMedicalRecord}
                onChange={handleChange}
                placeholder="Hospitalisations"
                rows="3"
                className="form-control"
                                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                name="patientFamily"
                value={formData.patientFamily}
                onChange={handleChange}
                placeholder="Historique psychiatrique familial"
                rows="3"
                className="form-control"
                 />
                <Form.Control
                as="textarea"
                name="patientJobRisks"
                value={formData.patientJobRisks}
                onChange={handleChange}
                placeholder="Historique d'automutilation ou tentatives de suicide"
                rows="3"
                className="form-control"
                                />
                </div>
                <Form.Label className="form-section-title">Historique médical</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                name="patientCondition"
                value={formData.patientCondition}
                onChange={handleChange}
                placeholder="Conditions médicales actuelles et passées"
                rows="3"
                className="form-control"
                 />
                <Form.Control
                as="textarea"
                name="patientChronicDiseases"
                value={formData.patientChronicDiseases}
                onChange={handleChange}
                placeholder="Médicaments (y compris psychiatriques et non psychiatriques)"
                rows="3"
                className="form-control"
                />
                <Form.Control
                as="textarea"
                name="patientAllergies"
                value={formData.patientAllergies}
                onChange={handleChange}
                placeholder="Allergies du patient"
                rows="3"
                className="form-control"
                />
            </div>
            <Form.Label className="form-section-title">Historique d'abus de substances</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                rows="2"
                name="patientDrugs"
                value={formData.patientDrugs}
                onChange={handleChange}
                placeholder="Consommation d'alcool, drogues, nicotine et autres substances"
                className="form-control"
                 />
                <Form.Control
                as="textarea"
                rows="2"
                name="patientDrugsUsage"
                value={formData.patientDrugsUsage}
                onChange={handleChange}
                placeholder="Fréquence et durée de consommation"
                className="form-control"
                />
                <Form.Control
                as="textarea"
                rows="2"
                name="patientMental"
                value={formData.patientMental}
                onChange={handleChange}
                placeholder="Impact sur la santé mentale"
                className="form-control"
                />
            </div>
            <Form.Label className="form-section-title">Historique psychosocial</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                rows="2"
                name="patientFam"
                value={formData.patientFam}
                onChange={handleChange}
                placeholder="Enfance et contexte familial"
                className="form-control"
                 />
                <Form.Control
                as="textarea"
                rows="2"
                name="patientJob"
                value={formData.patientJob}
                onChange={handleChange}
                placeholder="Historique d'éducation et d'emploi"
                className="form-control"
                />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                as="textarea"
                rows="2"
                name="patientRelationship"
                value={formData.patientRelationship}
                onChange={handleChange}
                placeholder="Relations et système de soutien social"
                className="form-control"
                />
                <Form.Control
                as="textarea"
                rows="2"
                name="patientLegal"
                value={formData.patientLegal}
                onChange={handleChange}
                placeholder="Problèmes juridiques"
                className="form-control"
                />
            </div>
            <Form.Label className="form-section-title">Évaluation des risques</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Select
                name="Risk"
                value={formData.Risk}
                onChange={handleChange}
                className="form-control"
            >
                <option value="" disabled>Évaluation des risques</option>
                {Risk.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
                <Form.Control
                as="textarea"
                rows="2"
                name="patientRiskAssessment"
                value={formData.patientRiskAssessment}
                onChange={handleChange}
                placeholder="Détails de l'évaluation des risques"
                className="form-control"
                />
                </div>
                <Form.Label className="form-section-title">Constatations</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                as="textarea"
                rows="2"
                name="patientFindings"
                value={formData.patientFindings}
                onChange={handleChange}
                placeholder="Notes / Constatations du patient"
                className="form-control"
                />
                </div>

                <Form.Label className="form-section-title">Diagnostic de sortie</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                as="textarea"
                rows="2"
                name="patientDiagnosis"
                value={formData.patientDiagnosis}
                onChange={handleChange}
                placeholder="Diagnostic principal"
                className="form-control"
                />
                </div>
                <Form.Label className="form-section-title">Thérapie</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Select
                name="admission"
                value={formData.admission}
                onChange={handleChange}
                className="form-control"
            >
                <option value="" disabled>Admission</option>
                {admission.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
                <Form.Control
                as="textarea"
                rows="2"
                name="patientTreatmentPlan"
                value={formData.patientTreatmentPlan}
                onChange={handleChange}
                placeholder="Plan de traitement"
                className="form-control"
                />
                <Form.Control
                as="textarea"
                rows="2"
                name="patientTherapyMedicine"
                value={formData.patientTherapyMedicine}
                onChange={handleChange}
                placeholder="Médicaments"
                className="form-control"
                />
                <Form.Select
                name="followup"
                value={formData.followup}
                onChange={handleChange}
                className="form-control"
            >
                <option value="" disabled>Suivi</option>
                {followup.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>

                </div>
                <Form.Label className="form-section-title">Plan de traitement / Recommandations</Form.Label>
        <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                as="textarea"
                rows="2"
                name="patientTreatmentMedicine"
                value={formData.patientTreatmentMedicine}
                onChange={handleChange}
                placeholder="Médicaments"
                className="form-control"

                />
                <Form.Control
                as="textarea"
                rows="2"
                name="patientTherapy"
                value={formData.patientTherapy}
                onChange={handleChange}
                placeholder="Thérapie (ex: TCC, TCD)"
                className="form-control"
                /></div> 
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                as="textarea"
                rows="2"
                name="patientFollowUp"
                value={formData.patientFollowUp}
                onChange={handleChange}
                placeholder="Rendez-vous de suivi"
                className="form-control"

                />
                <Form.Control
                as="textarea"
                rows="2"
                name="patientSafety"
                value={formData.patientSafety}
                onChange={handleChange}
                placeholder="Planification de la sécurité (si à risque)"
                className="form-control"
                />

                </div>

                </>
);
};

export default Shrink;
