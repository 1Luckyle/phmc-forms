import React from 'react';
import { Form } from 'react-bootstrap'; 
import PatientContextFields from './shared/PatientContextFields';
import CareFormHeader from './shared/CareFormHeader';
import { RiskFields, EmergencyContactSection } from './shared/CareExtraFields';
import PresetTextField from './shared/PresetTextField';
import { PSYCH_EVAL_PRESETS } from '../constants/careFormPresets';

const Shrink = ({
    formData,
    handleChange,
    setFormData,
    phmcGroupedOptions,
    unrestrictedPhmcGroupedOptions,
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
        <CareFormHeader formData={formData} setFormData={setFormData} handleChange={handleChange} phmcGroupedOptions={phmcGroupedOptions} unrestrictedPhmcGroupedOptions={unrestrictedPhmcGroupedOptions} />

        <PatientContextFields formData={formData} setFormData={setFormData} handleChange={handleChange} showHistory={false} />
        <Form.Label className="form-section-title">Motif de la consultation</Form.Label>
                <PresetTextField name="patientChiefComplaint" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientChiefComplaint} placeholder="Plainte principale du patient" rows={3} />

            <Form.Label className="form-section-title">Problème présenté</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <PresetTextField name="patientVisitReason" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientVisitReason} placeholder="Description du problème (ex: anxiété, dépression)" rows={2} />
                <PresetTextField name="patientSymptoms" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientSymptoms} placeholder="Apparition et durée des symptômes" rows={2} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <PresetTextField name="patientTriggers" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientTriggers} placeholder="Déclencheurs ou facteurs de stress" rows={2} />
                <PresetTextField name="patientStress" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientStress} placeholder="Impact sur la vie quotidienne" rows={2} />
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
            <PresetTextField name="patientTreatment" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientTreatment} placeholder="Diagnostics et traitements psychiatriques antérieurs" rows={3} />
                <PresetTextField name="patientMedicalRecord" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientMedicalRecord} placeholder="Hospitalisations" rows={3} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
            <PresetTextField name="patientFamily" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientFamily} placeholder="Historique psychiatrique familial" rows={3} />
                <PresetTextField name="patientJobRisks" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientJobRisks} placeholder="Historique d'automutilation ou tentatives de suicide" rows={3} />
                </div>
                <Form.Label className="form-section-title">Historique médical</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <PresetTextField name="patientCondition" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientCondition} placeholder="Conditions médicales actuelles et passées" rows={3} />
                <PresetTextField name="patientChronicDiseases" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientChronicDiseases} placeholder="Médicaments (y compris psychiatriques et non psychiatriques)" rows={3} />
                <PresetTextField name="patientAllergies" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientAllergies} placeholder="Allergies du patient" rows={3} />
            </div>
            <Form.Label className="form-section-title">Historique d'abus de substances</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <PresetTextField name="patientDrugs" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientDrugs} placeholder="Consommation d'alcool, drogues, nicotine et autres substances" rows={2} />
                <PresetTextField name="patientDrugsUsage" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientDrugsUsage} placeholder="Fréquence et durée de consommation" rows={2} />
                <PresetTextField name="patientMental" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientMental} placeholder="Impact sur la santé mentale" rows={2} />
            </div>
            <Form.Label className="form-section-title">Historique psychosocial</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <PresetTextField name="patientFam" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientFam} placeholder="Enfance et contexte familial" rows={2} />
                <PresetTextField name="patientJob" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientJob} placeholder="Historique d'éducation et d'emploi" rows={2} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                <PresetTextField name="patientRelationship" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientRelationship} placeholder="Relations et système de soutien social" rows={2} />
                <PresetTextField name="patientLegal" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientLegal} placeholder="Problèmes juridiques" rows={2} />
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
                <PresetTextField name="patientRiskAssessment" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientRiskAssessment} placeholder="Détails de l'évaluation des risques" rows={2} />
                </div>
                <RiskFields formData={formData} handleChange={handleChange} />
                <EmergencyContactSection formData={formData} setFormData={setFormData} handleChange={handleChange} />

                <Form.Label className="form-section-title">Constatations</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <PresetTextField name="patientFindings" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientFindings} placeholder="Notes / Constatations du patient" rows={2} />
                </div>

                <Form.Label className="form-section-title">Diagnostic de sortie</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <PresetTextField name="patientDiagnosis" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientDiagnosis} placeholder="Diagnostic principal" rows={2} />
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
                <PresetTextField name="patientTreatmentPlan" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientTreatmentPlan} placeholder="Plan de traitement" rows={2} />
                <PresetTextField name="patientTherapyMedicine" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientTherapyMedicine} placeholder="Médicaments" rows={2} />
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
                <PresetTextField name="patientTreatmentMedicine" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientTreatmentMedicine} placeholder="Médicaments" rows={2} />
                <PresetTextField name="patientTherapy" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientTherapy} placeholder="Thérapie (ex: TCC, TCD)" rows={2} /></div> 
            <div style={{ display: 'flex', gap: '10px' }}>
                <PresetTextField name="patientFollowUp" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientFollowUp} placeholder="Rendez-vous de suivi" rows={2} />
                <PresetTextField name="patientSafety" formData={formData} setFormData={setFormData} presets={PSYCH_EVAL_PRESETS.patientSafety} placeholder="Planification de la sécurité (si à risque)" rows={2} />

                </div>

                </>
);
};

export default Shrink;
