// src/phmc-field-data/shared/SurgeryAssistant.js
//
// Assistant du rapport d'opération : on choisit une ou plusieurs interventions du catalogue, et le site propose diagnostic, nom, caractère, anesthésie (produits et doses calculés pour le patient), durée, ASA, surveillance,
// résumé, consignes et médicaments post-opératoires. Rien n'est écrit sans clic ; un champ rempli n'est pas écrasé sauf demande ; tout reste modifiable. Moteur : src/clinical/surgery.js.
import React, { useMemo, useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { darkSelectStyles } from './selectStyles';
import ClinicalMedications from './ClinicalMedications';
import { PROCEDURE_GROUPS, PROCEDURE_BY_ID } from '../../clinical/procedures';
import { buildSurgerySuggestions, SURGERY_SECTIONS } from '../../clinical/surgery';
import { patientFromForm } from '../../clinical/engine';
import { MEDICATION_BY_ID } from '../../clinical/medications';
import { vitalsFromForm } from '../../clinical/vitals';
import { applyPatch, applyMeds } from '../../clinical/apply';
import { labelOf, ASA_CLASSES, POST_OP_MONITORING } from '../../constants/careFormOptions';

const GROUPED_OPTIONS = PROCEDURE_GROUPS.map((g) => ({ label: g.label, options: g.options.map((p) => ({ value: p.id, label: p.label, search: [p.label, p.name, ...(p.aliases || [])].join(' ').toLowerCase() })) }));
const filterProcedures = (option, input) => !input || option.data.search.includes(input.toLowerCase());
const row = { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '0.6rem' };
const cell = (basis) => ({ flex: `1 1 ${basis}px`, minWidth: 0 });
const ANESTHESIA_LABELS = { General: 'générale', Regional: 'locorégionale', Sedation: 'sédation', Local: 'locale' };
const NO_TAGS = new Set();

const SurgeryAssistant = ({ formData, setFormData, handleChange }) => {
    const [overwrite, setOverwrite] = useState(false);
    const [done, setDone] = useState('');
    const patient = useMemo(
        () => patientFromForm(formData),
        // Seuls ces champs comptent pour le patient : le reste du formulaire ne doit pas recalculer les suggestions à chaque frappe.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [formData.patientAgeYears, formData.patientDateOfBirth, formData.date, formData.patientSex, formData.patientWeight, formData.patientHeight, formData.patientAllergies, formData.patientChronicDiseases, formData.patientCurrentMedicine],
    );
    const ids = useMemo(() => (Array.isArray(formData.surgeryProcedureIds) ? formData.surgeryProcedureIds.filter((id) => PROCEDURE_BY_ID[id]) : []), [formData.surgeryProcedureIds]);
    const suggestions = useMemo(() => buildSurgerySuggestions({ procedureIds: ids, patient }), [ids, patient]);
    const vitals = useMemo(() => vitalsFromForm(formData), [formData]);

    const selected = ids.map((id) => ({ value: id, label: PROCEDURE_BY_ID[id].label }));
    const setIds = (options) => { setDone(''); setFormData((prev) => ({ ...prev, surgeryProcedureIds: (options || []).map((o) => o.value) })); };

    const apply = (key) => {
        if (!suggestions) return;
        setFormData((prev) => (key === 'meds' ? applyMeds(prev, suggestions.postOpMeds, overwrite) : applyPatch(prev, suggestions.fields[key], overwrite)));
        setDone(`« ${SURGERY_SECTIONS.find((s) => s.key === key).label} » ${overwrite ? 'remplacé' : 'complété'}.`);
    };
    const applyEverything = () => {
        if (!suggestions) return;
        setFormData((prev) => {
            let next = prev;
            SURGERY_SECTIONS.forEach(({ key }) => { next = key === 'meds' ? applyMeds(next, suggestions.postOpMeds, overwrite) : applyPatch(next, suggestions.fields[key], overwrite); });
            return next;
        });
        setDone(overwrite ? 'Toutes les suggestions ont été appliquées (champs existants remplacés).' : 'Toutes les suggestions ont été appliquées aux champs encore vides.');
    };

    return (
        <>
            <Form.Label className="form-section-title">Assistant chirurgical</Form.Label>
            <div className="helper-text" data-no-tip="1" style={{ marginBottom: '0.6rem' }}>
                Choisissez la ou les interventions : l'assistant propose l'indication, l'anesthésie avec ses doses calculées pour le patient, la durée, la classe ASA, la surveillance et les suites. Rien n'est écrit tant que vous ne cliquez pas, et tout reste modifiable.
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
            </div>
            {patient.ageYears !== null && patient.ageYears < 15 && !patient.weightKg && (
                <div className="helper-text" data-no-tip="1" style={{ color: '#e3b341', marginBottom: '0.5rem' }}>Patient de moins de 15 ans : indiquez son poids, sinon les doses sont calculées sur un poids estimé.</div>
            )}
            <Form.Label>Interventions (choix multiple)</Form.Label>
            <Select
                isMulti options={GROUPED_OPTIONS} value={selected} onChange={setIds} filterOption={filterProcedures} styles={darkSelectStyles} className="form-control p-0"
                placeholder="Appendicectomie, ostéosynthèse, césarienne… (nom ou synonyme)" noOptionsMessage={() => 'Aucune intervention trouvée'}
            />

            {suggestions && (
                <div style={{ border: '1px solid #30363d', borderRadius: 8, padding: '0.7rem 0.8rem', marginTop: '0.7rem', background: '#101923' }}>
                    <div style={{ marginBottom: 6 }}><strong>Suggestions</strong> <span className="text-muted small">— patient de {patient.ageYears ?? '?'} ans{patient.weightKg ? `, ${patient.weightKg} kg` : ''}</span></div>
                    <div className="small" style={{ marginBottom: 6 }}>
                        <span style={{ marginRight: 12 }}><span className="text-muted">Anesthésie</span> <strong>{ANESTHESIA_LABELS[suggestions.anesthesiaType]}</strong></span>
                        <span style={{ marginRight: 12 }}><span className="text-muted">Durée</span> <strong>{suggestions.duration}</strong> min</span>
                        <span style={{ marginRight: 12 }}><span className="text-muted">Pertes</span> <strong>{suggestions.bloodLoss}</strong> mL</span>
                        <span style={{ marginRight: 12 }}><span className="text-muted">Risque</span> <strong>{labelOf(ASA_CLASSES, suggestions.asa).split(' :')[0]}</strong></span>
                        <span><span className="text-muted">Surveillance</span> <strong>{labelOf(POST_OP_MONITORING, suggestions.monitoring)}</strong></span>
                    </div>
                    {suggestions.skipped.length > 0 && (
                        <div className="small" style={{ color: '#e3b341', marginBottom: 6 }}>Non proposés : {suggestions.skipped.map((s) => `${MEDICATION_BY_ID[s.medId]?.name || s.medId} (${s.reasons[0]})`).join(' ; ')}</div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {SURGERY_SECTIONS.map((s) => <Button key={s.key} size="sm" variant="outline-primary" title={s.hint} onClick={() => apply(s.key)}>{s.label}</Button>)}
                        <Button size="sm" variant="primary" onClick={applyEverything}><i className="fas fa-wand-magic-sparkles me-1"></i>Tout appliquer</Button>
                    </div>
                    <Form.Check type="checkbox" id="surgeryOverwrite" className="mt-2 small" label="Remplacer ce qui est déjà saisi (sinon seuls les champs vides sont complétés)" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                    {done && <div className="small" style={{ color: '#7ee787', marginTop: 4 }}><i className="fas fa-check me-1"></i>{done}</div>}
                </div>
            )}

            <ClinicalMedications formData={formData} setFormData={setFormData} patient={patient} tags={NO_TAGS} vitals={vitals} title="Médicaments post-opératoires" />
        </>
    );
};

export default SurgeryAssistant;
