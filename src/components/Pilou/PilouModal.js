// src/components/Pilou/PilouModal.js
//
// Boîte à outils → « Pilou » : on renseigne un cas (âge, sexe, poids, taille, symptômes) et Pilou propose la prise en charge complète : constantes attendues, procédure étape par étape, matériel,
// gestes, médicaments dosés (contrôlés : allergies, antécédents, interactions), examens, surveillance et orientation. Moteur : clinical/engine.js + clinical/protocols.js.
// Aide à la décision pour le jeu de rôle : rien n'est enregistré, rien n'est envoyé.
import React, { useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import BaseModal from '../BaseModal';
import { darkSelectStyles } from '../../phmc-field-data/shared/selectStyles';
import { CONDITION_GROUPS, CONDITION_BY_ID } from '../../clinical/conditions';
import { SEVERITIES } from '../../clinical/vitals';
import { ASSISTANT_NAME, ASSISTANT_EMOJI } from '../../clinical/assistantName';
import { matchConditions, buildCase, caseToText } from '../../clinical/protocols';
import './PilouModal.css';

const conditionOptions = CONDITION_GROUPS.map((group) => ({ label: group.label, options: group.options.map((c) => ({ value: c.id, label: c.label })) }));
const selectStyles = { ...darkSelectStyles, container: (base) => ({ ...base, width: '100%' }) };
const LEVEL_CLASS = { ok: '', info: 'info', warn: 'warn', error: 'error' };

const List = ({ title, icon, items, ordered = false }) => (items && items.length > 0 ? (
    <div className="pl-block">
        <h6><i className={`fas ${icon}`}></i>{title}</h6>
        {ordered ? <ol>{items.map((item) => <li key={item}>{item}</li>)}</ol> : <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>}
    </div>
) : null);

const PilouModal = ({ show, onHide, showNotification }) => {
    const [age, setAge] = useState('');
    const [sex, setSex] = useState('');
    const [weight, setWeight] = useState('');
    const [height, setHeight] = useState('');
    const [severity, setSeverity] = useState('Moderate');
    const [allergies, setAllergies] = useState('');
    const [chronic, setChronic] = useState('');
    const [currentMeds, setCurrentMeds] = useState('');
    const [text, setText] = useState('');
    const [selected, setSelected] = useState([]);

    const suggestions = useMemo(() => matchConditions(text).filter((item) => !selected.includes(item.id)), [text, selected]);
    const result = useMemo(() => buildCase({ ageYears: age, sex, weightKg: weight, heightCm: height, severity, allergies, chronic, currentMeds, conditionIds: selected }), [age, sex, weight, height, severity, allergies, chronic, currentMeds, selected]);
    const selectedOptions = selected.map((id) => ({ value: id, label: CONDITION_BY_ID[id]?.label || id }));
    const add = (id) => setSelected((current) => (current.includes(id) ? current : [...current, id]));
    const reset = () => { setAge(''); setSex(''); setWeight(''); setHeight(''); setSeverity('Moderate'); setAllergies(''); setChronic(''); setCurrentMeds(''); setText(''); setSelected([]); };
    const notify = showNotification || (() => {});
    const copy = async () => {
        try { await navigator.clipboard.writeText(caseToText(result)); notify('Prise en charge copiée.', 'check-circle'); } catch (error) { notify('Copie impossible dans ce navigateur.', 'error'); }
    };

    return (
        <BaseModal isOpen={show} onClose={onHide} title={`${ASSISTANT_NAME} ${ASSISTANT_EMOJI} — aide à la prise en charge`} modalSize="xl" className="pl-modal" closeOnOverlayClick={false}>
            <p className="pl-intro">
                Renseignez le patient et ses symptômes : {ASSISTANT_NAME} propose la procédure complète, le matériel, les gestes et les médicaments dosés pour ce patient. Rien n'est enregistré. Aide à la décision pour le jeu de rôle :
                le soignant reste responsable de ses choix.
            </p>
            <div className="pl-layout">
                <div className="pl-form">
                    <h6 className="pl-title"><i className="fas fa-user-injured"></i>Le patient</h6>
                    <div className="pl-grid">
                        <Form.Group><Form.Label>Âge (ans)</Form.Label>
                            <Form.Control size="sm" type="number" min="0" max="120" value={age} onChange={(e) => setAge(e.target.value)} placeholder="ex. 35 (0 = nourrisson)" /></Form.Group>
                        <Form.Group><Form.Label>Sexe</Form.Label>
                            <Form.Select size="sm" value={sex} onChange={(e) => setSex(e.target.value)}>
                                <option value="">Non précisé</option><option value="Male">Homme</option><option value="Female">Femme</option>
                            </Form.Select></Form.Group>
                        <Form.Group><Form.Label>Poids (kg)</Form.Label>
                            <Form.Control size="sm" type="number" min="1" max="400" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="ex. 75" /></Form.Group>
                        <Form.Group><Form.Label>Taille (cm)</Form.Label>
                            <Form.Control size="sm" type="number" min="30" max="260" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="ex. 178" /></Form.Group>
                    </div>
                    <Form.Group className="mt-2"><Form.Label>Gravité estimée</Form.Label>
                        <Form.Select size="sm" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                            {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </Form.Select></Form.Group>
                    <Form.Group className="mt-2"><Form.Label>Allergies connues</Form.Label>
                        <Form.Control size="sm" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="ex. pénicilline, aspirine… (facultatif)" /></Form.Group>
                    <Form.Group className="mt-2"><Form.Label>Antécédents</Form.Label>
                        <Form.Control size="sm" value={chronic} onChange={(e) => setChronic(e.target.value)} placeholder="ex. asthme, diabète, insuffisance rénale… (facultatif)" /></Form.Group>
                    <Form.Group className="mt-2"><Form.Label>Traitements en cours</Form.Label>
                        <Form.Control size="sm" value={currentMeds} onChange={(e) => setCurrentMeds(e.target.value)} placeholder="ex. anticoagulant, ramipril… (facultatif)" /></Form.Group>

                    <h6 className="pl-title mt-3"><i className="fas fa-stethoscope"></i>Les symptômes</h6>
                    <Form.Control as="textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Décrivez ce que présente le patient : « douleur thoracique, sueurs, bras gauche engourdi »…" />
                    {text.trim() && (
                        <div className="pl-chips">
                            {suggestions.length === 0 && <small className="text-muted">Aucune correspondance : choisissez un motif dans la liste ci-dessous.</small>}
                            {suggestions.map((item) => (
                                <button type="button" key={item.id} className="pl-chip" onClick={() => add(item.id)} title="Ajouter ce motif"><i className="fas fa-plus"></i> {item.label}</button>
                            ))}
                        </div>
                    )}
                    <Form.Group className="mt-2"><Form.Label>Motif(s) retenu(s)</Form.Label>
                        <Select
                            isMulti value={selectedOptions} options={conditionOptions} styles={selectStyles} closeMenuOnSelect={false}
                            onChange={(options) => setSelected((options || []).map((o) => o.value))}
                            placeholder="Choisir dans la liste (plusieurs choix possibles)…" noOptionsMessage={() => 'Aucun motif'}
                        /></Form.Group>
                    <Button variant="outline-secondary" size="sm" className="mt-3" onClick={reset}><i className="fas fa-rotate-left me-1"></i>Nouveau patient</Button>
                </div>

                <div className="pl-result">
                    {!result && (
                        <div className="pl-empty"><i className="fas fa-pills"></i><p>Choisissez au moins un motif (ou écrivez les symptômes) : {ASSISTANT_NAME} affiche ici la prise en charge.</p></div>
                    )}
                    {result && (
                        <>
                            <div className="pl-head">
                                <div>
                                    <h5>{result.conditions.map((c) => c.label).join(' + ')}</h5>
                                    <div className="pl-sub">
                                        {[result.patient.ageYears !== null && result.patient.ageYears !== undefined ? `${result.patient.ageYears} an${result.patient.ageYears > 1 ? 's' : ''}` : 'âge non renseigné', result.sexLabel,
                                            result.patient.weightKg ? `${result.patient.weightKg} kg` : 'poids estimé', result.patient.heightCm ? `${result.patient.heightCm} cm` : '', result.patient.bmi ? `IMC ${String(result.patient.bmi).replace('.', ',')}` : '']
                                            .filter(Boolean).join(' · ')} — gravité <strong>{result.severity.label.toLowerCase()}</strong>
                                    </div>
                                </div>
                                <Button variant="outline-info" size="sm" onClick={copy}><i className="fas fa-copy me-1"></i>Copier</Button>
                            </div>

                            {(result.notices.length > 0 || result.adaptations.length > 0) && (
                                <div className="pl-alert">{[...result.adaptations, ...result.notices].map((note) => <div key={note}><i className="fas fa-triangle-exclamation"></i> {note}</div>)}</div>
                            )}

                            <div className="pl-vitals">
                                {[['FC', `${result.vitals.hr}/min`], ['PA', `${result.vitals.sbp}/${result.vitals.dbp}`], ['FR', `${result.vitals.rr}/min`], ['SpO₂', `${result.vitals.spo2} %`],
                                    ['T°', `${String(result.vitals.temp).replace('.', ',')} °C`], ['Glycémie', `${String(result.vitals.glu).replace('.', ',')} g/L`], ['Glasgow', `${result.vitals.gcs}`]]
                                    .map(([label, value]) => <div key={label} className="pl-vital"><span>{label}</span><strong>{value}</strong></div>)}
                            </div>
                            <small className="text-muted">Constantes attendues pour ce patient et cette gravité (estimation).</small>

                            {result.conditions.map((condition) => (
                                <section key={condition.id} className="pl-condition">
                                    <h6 className="pl-cond-title">{condition.label}</h6>
                                    <List title="Procédure, étape par étape" icon="fa-list-ol" items={condition.steps} ordered />
                                    <div className="pl-two">
                                        <List title="Matériel à préparer" icon="fa-toolbox" items={condition.equipment} />
                                        <List title="Gestes à réaliser" icon="fa-hand-holding-medical" items={condition.gestures} />
                                    </div>
                                    <List title="Surveillance et signes d'alerte" icon="fa-heart-pulse" items={condition.monitoring} />
                                </section>
                            ))}

                            <div className="pl-block">
                                <h6><i className="fas fa-syringe"></i>Médicaments proposés (doses calculées pour ce patient)</h6>
                                {result.meds.length === 0 && <small className="text-muted">Aucun médicament proposé à cette gravité.</small>}
                                {result.meds.map((med) => (
                                    <div key={`${med.medId}-${med.text}`} className={`pl-med ${LEVEL_CLASS[med.level] || ''}`}>
                                        <div><strong>{med.text}</strong>{med.forLabel && <span className="pl-for"> · {med.forLabel}</span>}</div>
                                        {med.alerts.map((alert) => <div key={alert} className="pl-med-alert"><i className="fas fa-circle-exclamation"></i> {alert}</div>)}
                                    </div>
                                ))}
                                {result.skipped.length > 0 && (
                                    <div className="pl-skipped"><strong>Non proposés :</strong> {result.skipped.map((s) => `${s.name}${s.reasons.length ? ` (${s.reasons.join(' ; ')})` : ''}`).join(' — ')}</div>
                                )}
                            </div>

                            {result.prescription.length > 0 && (
                                <List title="Ordonnance de sortie" icon="fa-file-prescription" items={result.prescription.map((rx) => rx.text)} />
                            )}
                            <div className="pl-two">
                                <List title="Examens à demander" icon="fa-x-ray" items={result.exams} />
                                <List title="Soins associés" icon="fa-bandage" items={result.routineCare} />
                            </div>
                            <div className="pl-block">
                                <h6><i className="fas fa-route"></i>Orientation</h6>
                                <p className="mb-1"><strong>{result.destination}</strong></p>
                                {result.advice && <small className="text-muted">{result.advice}</small>}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </BaseModal>
    );
};

export default PilouModal;
