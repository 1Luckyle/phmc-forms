// src/phmc-field-data/shared/ClinicalAssistant.js
//
// « Assistant clinique » du protocole d'urgence : on choisit un ou plusieurs motifs de prise en charge et une gravité, et le site propose constantes vitales, plainte, diagnostic, procédure, médicaments (doses
// calculées pour l'âge et le poids du patient) et orientation. Rien n'est écrit sans clic ; un champ déjà rempli n'est pas écrasé sauf demande ; tout reste modifiable. Moteur : src/clinical/.
import React, { useMemo, useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { darkSelectStyles } from './selectStyles';
import ClinicalMedications from './ClinicalMedications';
import { ASSISTANT_NAME } from '../../clinical/assistantName';
import { CONDITION_GROUPS, CONDITION_BY_ID } from '../../clinical/conditions';
import { SEVERITIES } from '../../clinical/vitals';
import { patientFromForm, buildSuggestions, conditionsOf, contextTags, historySuggestions } from '../../clinical/engine';
import { MEDICATION_BY_ID } from '../../clinical/medications';
import { vitalsFromForm } from '../../clinical/vitals';
import { sectionsFor, applySection, applyAll } from '../../clinical/apply';
import { currentTime, pickNumericOption } from '../../clinical/context';

const GROUPED_OPTIONS = CONDITION_GROUPS.map((g) => ({ label: g.label, options: g.options.map((c) => ({ value: c.id, label: c.label, search: [c.label, ...(c.aliases || [])].join(' ').toLowerCase() })) }));
const filterConditions = (option, input) => !input || option.data.search.includes(input.toLowerCase());
const row = { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '0.6rem' };
const cell = (basis) => ({ flex: `1 1 ${basis}px`, minWidth: 0 });

const VITAL_SUMMARY = [['FC', 'heartRateValue', 'bpm'], ['TA', 'bloodPressureValue', 'mmHg'], ['FR', 'respiratoryRateValue', '/min'], ['SpO2', 'spo2Value', '%'], ['T°', 'temperatureValue', '°C'], ['Glycémie', 'glucoseValue', 'g/L'], ['Glasgow', 'gcsScore', '/15']];

const ClinicalAssistant = ({ formData, setFormData, handleChange, mode = 'emergency', bloodOxyOptions = [] }) => {
    const [overwrite, setOverwrite] = useState(false);
    const [done, setDone] = useState('');
    const patient = useMemo(
        () => patientFromForm(formData),
        // Seuls ces champs comptent pour le patient : le reste du formulaire ne doit pas recalculer les suggestions à chaque frappe.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [formData.patientAgeYears, formData.patientDateOfBirth, formData.date, formData.patientSex, formData.patientWeight, formData.patientHeight, formData.patientAllergies, formData.patientChronicDiseases, formData.patientCurrentMedicine],
    );
    const ids = useMemo(() => (Array.isArray(formData.clinicalConditions) ? formData.clinicalConditions.filter((id) => CONDITION_BY_ID[id]) : []), [formData.clinicalConditions]);
    const severity = formData.clinicalSeverity || 'Moderate';
    const seed = `${formData.patientID || ''}|${formData.date || ''}`;
    const suggestions = useMemo(
        () => buildSuggestions({ conditionIds: ids, severity, patient, seed, formData }),
        // formData ne sert qu'aux contrôles des médicaments proposés ; les champs lus (constantes saisies) sont couverts par `patient` et la graine à ce stade.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ids, severity, patient, seed],
    );
    const tags = useMemo(() => contextTags(conditionsOf(ids)), [ids]);
    const history = useMemo(() => historySuggestions(ids, patient), [ids, patient]);
    const addChronic = (item) => setFormData((prev) => ({ ...prev, patientChronicDiseases: [String(prev.patientChronicDiseases || '').trim(), item].filter(Boolean).join(' ; ') }));
    const vitals = useMemo(() => vitalsFromForm(formData), [formData]);

    const selected = ids.map((id) => ({ value: id, label: CONDITION_BY_ID[id].label }));
    const setIds = (options) => { setDone(''); setFormData((prev) => ({ ...prev, clinicalConditions: (options || []).map((o) => o.value) })); };

    // Valeurs connues seulement au moment du clic : l'heure, et la catégorie d'oxygène sanguin (liste de la base, choisie d'après la saturation proposée).
    const extraFor = (sug, data) => ({ now: currentTime(), appointmentTime: data.appointmentTime || '', bloodOxy: pickNumericOption(bloodOxyOptions, sug.vitals.values.spo2) });
    const sections = sectionsFor(mode);
    const apply = (key) => {
        if (!suggestions) return;
        setFormData((prev) => applySection(prev, key, suggestions, { overwrite, mode, extra: extraFor(suggestions, prev) }));
        setDone(`« ${sections.find((s) => s.key === key).label} » ${overwrite && key !== 'patient' ? 'remplacé' : 'complété'}.`);
    };
    const applyEverything = () => {
        if (!suggestions) return;
        setFormData((prev) => {
            // Le patient d'abord (âge, sexe) : constantes et doses sont ensuite recalculées pour lui.
            const withPatient = applySection(prev, 'patient', suggestions, { mode });
            const fresh = buildSuggestions({ conditionIds: ids, severity, patient: patientFromForm(withPatient), seed, formData: withPatient }) || suggestions;
            return applyAll(withPatient, fresh, overwrite, mode, extraFor(fresh, withPatient));
        });
        setDone(overwrite ? 'Toutes les suggestions ont été appliquées (champs existants remplacés, patient complété seulement là où il était vide).' : 'Toutes les suggestions ont été appliquées aux champs encore vides.');
    };

    return (
        <>
            <Form.Label className="form-section-title">Assistant clinique <span className="text-muted" style={{ fontWeight: 400, textTransform: 'none' }}>· {ASSISTANT_NAME}</span></Form.Label>
            <div className="helper-text" data-no-tip="1" style={{ marginBottom: '0.6rem' }}>
                Indiquez le poids, la taille et le ou les motifs {mode === 'consult' ? 'de la consultation' : 'de prise en charge'} : {ASSISTANT_NAME} propose constantes, diagnostic, {mode === 'consult' ? 'plan de traitement, examens' : 'procédure'} et médicaments adaptés au patient. Rien n'est écrit tant que vous ne cliquez pas, et tout reste modifiable.
            </div>
            <div style={row}>
                <div style={cell(120)}>
                    <Form.Label>Poids (kg)</Form.Label>
                    <Form.Control type="text" inputMode="decimal" name="patientWeight" value={formData.patientWeight || ''} onChange={handleChange} placeholder="ex. 75" className="form-control" />
                </div>
                <div style={cell(120)}>
                    <Form.Label>Taille (cm)</Form.Label>
                    <Form.Control type="text" inputMode="numeric" name="patientHeight" value={formData.patientHeight || ''} onChange={handleChange} placeholder="ex. 178" className="form-control" />
                </div>
                <div style={cell(200)}>
                    <Form.Label>Gravité</Form.Label>
                    <Form.Select value={severity} onChange={(e) => { setDone(''); setFormData((prev) => ({ ...prev, clinicalSeverity: e.target.value })); }} className="form-control">
                        {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Form.Select>
                </div>
            </div>
            {patient.ageYears !== null && patient.ageYears < 15 && !patient.weightKg && (
                <div className="helper-text" data-no-tip="1" style={{ color: '#e3b341', marginBottom: '0.5rem' }}>Patient de moins de 15 ans : indiquez son poids, sinon les doses sont calculées sur un poids estimé.</div>
            )}
            {suggestions && suggestions.notices.map((notice) => (
                <div key={notice} className="helper-text" data-no-tip="1" style={{ color: '#e3b341', marginBottom: '0.4rem' }}><i className="fas fa-triangle-exclamation me-1"></i>{notice}</div>
            ))}
            <Form.Label>{mode === 'consult' ? 'Motifs de la consultation' : 'Motifs de prise en charge'} (choix multiple)</Form.Label>
            <Select
                isMulti options={GROUPED_OPTIONS} value={selected} onChange={setIds} filterOption={filterConditions} styles={darkSelectStyles} className="form-control p-0"
                placeholder="Fracture, brûlure, asthme, surdose… (nom ou synonyme)" noOptionsMessage={() => 'Aucun motif trouvé'}
            />

            {suggestions && (
                <div style={{ border: '1px solid #30363d', borderRadius: 8, padding: '0.7rem 0.8rem', marginTop: '0.7rem', background: '#101923' }}>
                    <div style={{ marginBottom: 6 }}><strong>Suggestions</strong> <span className="text-muted small">— gravité {suggestions.severity.label.toLowerCase()}, patient de {patient.ageYears ?? '?'} ans{patient.weightKg ? `, ${patient.weightKg} kg` : ''}</span></div>
                    <div className="small" style={{ marginBottom: 6 }}>
                        {VITAL_SUMMARY.map(([label, key, unit]) => <span key={key} style={{ marginRight: 12 }}><span className="text-muted">{label}</span> <strong>{suggestions.vitals.fields[key]}</strong> {unit}</span>)}
                    </div>
                    <div className="small text-muted" style={{ marginBottom: 6 }}>
                        {suggestions.meds.length > 0 ? `Médicaments proposés : ${suggestions.meds.map((m) => MEDICATION_BY_ID[m.medId]?.name || m.medId).join(', ')}.` : 'Aucun médicament proposé pour ce motif.'}
                        {suggestions.skipped.length > 0 && <span style={{ color: '#e3b341' }}> Non proposés : {suggestions.skipped.map((s) => `${MEDICATION_BY_ID[s.medId]?.name || s.medId} (${s.reasons[0]})`).join(' ; ')}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {sections.map((s) => <Button key={s.key} size="sm" variant="outline-primary" title={s.hint} onClick={() => apply(s.key)}>{s.label}</Button>)}
                        <Button size="sm" variant="primary" onClick={applyEverything}><i className="fas fa-wand-magic-sparkles me-1"></i>Tout appliquer</Button>
                    </div>
                    <Form.Check type="checkbox" id="clinicalOverwrite" className="mt-2 small" label="Remplacer ce qui est déjà saisi (sinon seuls les champs vides sont complétés)" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                    {done && <div className="small" style={{ color: '#7ee787', marginTop: 4 }}><i className="fas fa-check me-1"></i>{done}</div>}
                </div>
            )}

            {suggestions && (history.chronic.length > 0 || history.allergen) && (
                <div className="small" style={{ marginTop: 8, padding: '0.5rem 0.7rem', border: '1px dashed #30363d', borderRadius: 8 }}>
                    <strong>À vérifier dans le dossier du patient</strong>
                    {history.chronic.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                            <span className="text-muted">Antécédent évoqué par ce motif, absent des antécédents :</span>{' '}
                            {history.chronic.map((item) => <Button key={item} size="sm" variant="outline-secondary" className="me-1" onClick={() => addChronic(item)}>+ {item}</Button>)}
                        </div>
                    )}
                    {history.allergen && <div style={{ marginTop: 4 }} className="text-muted">Notez l'allergène identifié dans les allergies du patient (champ « Allergies connues » plus haut) : il sera ajouté à son dossier.</div>}
                </div>
            )}

            <ClinicalMedications formData={formData} setFormData={setFormData} patient={patient} tags={tags} vitals={vitals} version={mode === 'consult' ? 20 : 19} />
        </>
    );
};

export default ClinicalAssistant;
