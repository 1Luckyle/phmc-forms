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
import { buildCase, caseToText } from '../../clinical/protocols';
import { AGE_OPTIONS, WEIGHT_OPTIONS, HEIGHT_OPTIONS, SEX_OPTIONS, ALLERGY_CHOICES, HISTORY_CHOICES, MEDICATION_CHOICES, joinChoices } from '../../clinical/pilouChoices';
import '../FieldGuide.css';
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
    const [allergies, setAllergies] = useState([]);
    const [chronic, setChronic] = useState([]);
    const [currentMeds, setCurrentMeds] = useState([]);
    const [selected, setSelected] = useState([]);

    // Champs obligatoires : tout sauf allergies, antécédents et traitements en cours.
    const missing = [['l\'âge', age], ['le sexe', sex], ['le poids', weight], ['la taille', height], ['la gravité', severity], ['au moins un motif', selected.length ? 'ok' : '']].filter(([, value]) => !value).map(([label]) => label);
    const result = useMemo(() => (missing.length ? null : buildCase({
        ageYears: age, sex, weightKg: weight, heightCm: height, severity, allergies: joinChoices(allergies), chronic: joinChoices(chronic), currentMeds: joinChoices(currentMeds), conditionIds: selected,
    })), [missing.length, age, sex, weight, height, severity, allergies, chronic, currentMeds, selected]); // eslint-disable-line react-hooks/exhaustive-deps
    const asOptions = (values) => values.map((value) => ({ value, label: value }));
    const selectedOptions = selected.map((id) => ({ value: id, label: CONDITION_BY_ID[id]?.label || id }));
    const reset = () => { setAge(''); setSex(''); setWeight(''); setHeight(''); setSeverity('Moderate'); setAllergies([]); setChronic([]); setCurrentMeds([]); setSelected([]); };
    const notify = showNotification || (() => {});
    const copy = async () => {
        try { await navigator.clipboard.writeText(caseToText(result)); notify('Prise en charge copiée.', 'check-circle'); } catch (error) { notify('Copie impossible dans ce navigateur.', 'error'); }
    };

    return (
        <BaseModal isOpen={show} onClose={onHide} title={`${ASSISTANT_NAME} ${ASSISTANT_EMOJI} — aide à la prise en charge`} modalSize="xl" className="pl-modal" closeOnOverlayClick={false}>
            <p className="pl-intro">
                Renseignez le patient (tout est à choisir dans des listes) et ses symptômes : {ASSISTANT_NAME} propose la procédure complète, le matériel, les gestes et les médicaments dosés pour ce patient. Rien n'est enregistré. Aide à la décision pour le jeu de rôle :
                le soignant reste responsable de ses choix.
            </p>
            <div className="pl-layout">
                <div className="pl-form" data-guide-zone>
                    <div className="field-legend"><span className="req"><i></i>Obligatoire</span><span className="opt"><i></i>Facultatif</span></div>
                    <h6 className="pl-title"><i className="fas fa-user-injured"></i>Le patient</h6>
                    <div className="pl-grid">
                        <Form.Group><Form.Label>Âge</Form.Label>
                            <Form.Select name="pilouAge" required value={age} onChange={(e) => setAge(e.target.value)} data-guide="Âge du patient : Pilou adapte les constantes, les doses et le matériel (enfant, nourrisson, personne âgée).">
                                <option value="">Choisir l'âge…</option>{AGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Form.Select></Form.Group>
                        <Form.Group><Form.Label>Sexe</Form.Label>
                            <Form.Select name="pilouSexe" required value={sex} onChange={(e) => setSex(e.target.value)} data-guide="Sexe du patient : constantes de repos, grossesse possible chez la femme en âge de procréer.">
                                <option value="">Choisir…</option>{SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Form.Select></Form.Group>
                        <Form.Group><Form.Label>Poids</Form.Label>
                            <Form.Select name="pilouPoids" required value={weight} onChange={(e) => setWeight(e.target.value)} data-guide="Poids du patient : les doses des médicaments sont calculées dessus.">
                                <option value="">Choisir le poids…</option>{WEIGHT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Form.Select></Form.Group>
                        <Form.Group><Form.Label>Taille</Form.Label>
                            <Form.Select name="pilouTaille" required value={height} onChange={(e) => setHeight(e.target.value)} data-guide="Taille du patient (tranches de 5 cm) : sert à l'IMC et aux valeurs de repos.">
                                <option value="">Choisir la taille…</option>{HEIGHT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Form.Select></Form.Group>
                    </div>
                    <Form.Group className="mt-2"><Form.Label>Gravité estimée</Form.Label>
                        <Form.Select name="pilouGravite" required value={severity} onChange={(e) => setSeverity(e.target.value)} data-guide="Gravité de l'état du patient : elle règle les constantes attendues, les médicaments proposés et l'orientation.">
                            <option value="">Choisir la gravité…</option>{SEVERITIES.map((sv) => <option key={sv.value} value={sv.value}>{sv.label}</option>)}
                        </Form.Select></Form.Group>
                    <Form.Group className="mt-2"><Form.Label>Allergies connues</Form.Label>
                        <Select isMulti name="pilouAllergies" value={asOptions(allergies)} options={ALLERGY_CHOICES} styles={selectStyles} closeMenuOnSelect={false}
                            onChange={(options) => setAllergies((options || []).map((o) => o.value))} placeholder="Aucune connue (facultatif)…" noOptionsMessage={() => 'Aucun autre choix'} /></Form.Group>
                    <Form.Group className="mt-2"><Form.Label>Antécédents</Form.Label>
                        <Select isMulti name="pilouAntecedents" value={asOptions(chronic)} options={HISTORY_CHOICES} styles={selectStyles} closeMenuOnSelect={false}
                            onChange={(options) => setChronic((options || []).map((o) => o.value))} placeholder="Aucun connu (facultatif)…" noOptionsMessage={() => 'Aucun autre choix'} /></Form.Group>
                    <Form.Group className="mt-2"><Form.Label>Traitements en cours</Form.Label>
                        <Select isMulti name="pilouTraitements" value={asOptions(currentMeds)} options={MEDICATION_CHOICES} styles={selectStyles} closeMenuOnSelect={false}
                            onChange={(options) => setCurrentMeds((options || []).map((o) => o.value))} placeholder="Aucun connu (facultatif)…" noOptionsMessage={() => 'Aucun autre choix'} /></Form.Group>

                    <h6 className="pl-title mt-3"><i className="fas fa-stethoscope"></i>Les symptômes</h6>
                    <Form.Group><Form.Label>Motif(s) de la prise en charge</Form.Label>
                        <div data-required="1">
                            <Select
                                isMulti name="pilouMotifs" value={selectedOptions} options={conditionOptions} styles={selectStyles} closeMenuOnSelect={false}
                                onChange={(options) => setSelected((options || []).map((o) => o.value))}
                                placeholder="Choisir dans la liste (plusieurs choix possibles)…" noOptionsMessage={() => 'Aucun motif'}
                            />
                        </div>
                        <span className="helper-text" data-no-tip="1">Pilou ne comprend que les motifs de cette liste : tapez pour filtrer, puis choisissez.</span></Form.Group>
                    <Button variant="outline-secondary" size="sm" className="mt-3" onClick={reset}><i className="fas fa-rotate-left me-1"></i>Nouveau patient</Button>
                </div>

                <div className="pl-result">
                    {!result && (
                        <div className="pl-empty"><i className="fas fa-pills"></i><p>Renseignez les champs obligatoires : {ASSISTANT_NAME} affiche ici la prise en charge.</p>{missing.length > 0 && <small>Il manque : {missing.join(', ')}.</small>}</div>
                    )}
                    {result && (
                        <>
                            <div className="pl-head">
                                <div>
                                    <h5>{result.conditions.map((c) => c.label).join(' + ')}</h5>
                                    <div className="pl-sub">
                                        {[result.patient.ageYears !== null && result.patient.ageYears !== undefined ? `${result.patient.ageYears} an${result.patient.ageYears > 1 ? 's' : ''}` : 'âge non renseigné', result.sexLabel,
                                            result.patient.weightKg ? `${result.patient.weightKg} kg` : 'poids estimé', result.patient.heightCm ? `${result.patient.heightCm} cm` : '', result.patient.bmi ? `IMC ${String(result.patient.bmi).replace('.', ',')} (${result.patient.bmiLabel})` : '']
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
