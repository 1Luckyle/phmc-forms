// src/components/Pilou/PilouCare.js
//
// Pilou → « Aide à la prise en charge » : à gauche le cas (patient, motifs, précisions sur les blessures : les mêmes arguments que l'assistant des formulaires d'urgence et de consultation),
// à droite le PARCOURS proposé par Pilou (clinical/pathways.js), sous deux formes :
//   • « Vue complète » : tout le parcours d'un coup, temps par temps, avec les cases à cocher ;
//   • « Suivi pas à pas » : une étape à la fois, avec l'avancement, pour savoir où l'on en est et ne rien oublier.
// L'état (cas + avancement) appartient à PilouModal, qui le garde dans l'onglet (sessionStorage) : rien n'est envoyé au serveur.
import React, { useMemo } from 'react';
import { Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import { darkSelectStyles } from '../../phmc-field-data/shared/selectStyles';
import InjuryDetails from '../../phmc-field-data/shared/InjuryDetails';
import { CONDITION_GROUPS, CONDITION_BY_ID } from '../../clinical/conditions';
import { SEVERITIES } from '../../clinical/vitals';
import { ASSISTANT_NAME } from '../../clinical/assistantName';
import { buildCase, caseToText, patientLine, progressOf } from '../../clinical/protocols';
import { flatSteps } from '../../clinical/pathways';
import { lessonOfCondition } from '../../clinical/manual';
import { BODY_LIMITS, LIMIT_HINTS, parseAgeYears, parseWeightKg, parseHeightCm } from '../../clinical/bodyLimits';
import { SEX_OPTIONS, ALLERGY_CHOICES, HISTORY_CHOICES, MEDICATION_CHOICES, joinChoices } from '../../clinical/pilouChoices';
import PilouMascot from './PilouMascot';

const conditionOptions = CONDITION_GROUPS.map((group) => ({ label: group.label, options: group.options.map((c) => ({ value: c.id, label: c.label, search: [c.label, ...(c.aliases || [])].join(' ').toLowerCase() })) }));
const filterConditions = (option, input) => !input || option.data.search.includes(input.toLowerCase());
const selectStyles = { ...darkSelectStyles, container: (base) => ({ ...base, width: '100%' }) };
const asOptions = (values) => values.map((value) => ({ value, label: value }));
const comma = (value) => String(value).replace('.', ',');

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

// Médicament dosé pour ce patient, avec ses alertes ; `shared` : déjà compté pour un autre motif du cas.
const Dose = ({ med }) => (
    <div className={`pl-dose ${med.level && med.level !== 'ok' ? med.level : ''}`}>
        <i className="fas fa-syringe"></i>
        <div>
            <strong>{med.text}</strong>
            {med.shared && <span className="pl-dose-shared"> — déjà prévu pour « {med.shared} » : une seule administration</span>}
            {(med.alerts || []).map((alert) => <div key={alert} className="pl-dose-alert"><i className="fas fa-circle-exclamation"></i> {alert}</div>)}
        </div>
    </div>
);

const StepBody = ({ step }) => (
    <>
        {step.detail && <div className="pl-step-detail">{capitalize(step.detail)}</div>}
        {step.meds.length > 0 && <div className="pl-doses">{step.meds.map((med) => <Dose key={`${med.medId}-${med.text}`} med={med} />)}</div>}
        {step.points.length > 0 && <ul className={`pl-step-points${step.kind === 'med' && step.level && step.level !== 'ok' ? ` ${step.level}` : ''}`}>{step.points.map((point) => <li key={point}>{point}</li>)}</ul>}
    </>
);

/** Vue complète : tout le parcours, temps par temps ; chaque étape se coche, et « Suivre d'ici » ouvre le suivi pas à pas sur cette étape. */
const FullView = ({ result, done, onToggle, onFollow }) => {
    let number = 0;
    return (
        <>
            {(result.injuries.length > 0 || result.mutilations.length > 0) && (
                <div className="pl-block pl-injuries">
                    <h6><i className="fas fa-person-rays"></i>Lésions renseignées</h6>
                    <ul>{result.injuries.map((line) => <li key={line}>{line}</li>)}{result.mutilations.length > 0 && <li>Mutilation(s) : {result.mutilations.join(', ')}</li>}</ul>
                </div>
            )}
            {result.timeline.map((phase) => (
                <section key={phase.key} className={`pl-phase pl-phase-${phase.key}`}>
                    <h6 className="pl-phase-title"><i className={`fas ${phase.icon}`}></i>{phase.label}<small>{phase.hint}</small></h6>
                    {phase.steps.map((step) => {
                        number += 1;
                        const isDone = done.has(step.id);
                        return (
                            <div key={step.id} className={`pl-step ${step.kind}${step.meds.length ? ' has-meds' : ''}${isDone ? ' done' : ''}`}>
                                <Form.Check type="checkbox" id={`pilou-step-${step.id}`} checked={isDone} onChange={() => onToggle(step.id)} aria-label={`Étape faite : ${step.title}`} />
                                <div className="pl-step-main">
                                    <div className="pl-step-title"><span className="pl-step-n">{number}</span>{step.title}{step.tag && <span className="pl-tag">{step.tag}</span>}</div>
                                    <StepBody step={step} />
                                </div>
                                <button type="button" className="pl-follow" onClick={() => onFollow(step.id)} title="Ouvrir le suivi pas à pas sur cette étape" aria-label={`Suivre à partir de l'étape ${number}`}><i className="fas fa-location-arrow"></i></button>
                            </div>
                        );
                    })}
                </section>
            ))}
        </>
    );
};

/** Suivi pas à pas : l'étape en cours en grand, les six temps avec leur avancement, et la liste des étapes pour sauter où l'on veut. */
const TrackView = ({ result, done, currentId, onToggle, onGoto, onComplete, onResetProgress }) => {
    const steps = flatSteps(result.timeline);
    const index = Math.max(0, steps.findIndex((step) => step.id === currentId));
    const step = steps[index];
    const phase = result.timeline.find((item) => item.key === step.phase);
    const allDone = steps.every((item) => done.has(item.id));
    const upcoming = steps.slice(index + 1).filter((item) => !done.has(item.id)).slice(0, 3);
    return (
        <div className="pl-track">
            <div className="pl-phases">
                {result.timeline.map((item) => {
                    const count = item.steps.filter((s) => done.has(s.id)).length;
                    const state = count === item.steps.length ? 'done' : item.key === step.phase ? 'active' : '';
                    const target = item.steps.find((s) => !done.has(s.id)) || item.steps[0];
                    return (
                        <button key={item.key} type="button" className={`pl-phase-chip ${state}`} onClick={() => onGoto(target.id)} title={item.hint}>
                            <i className={`fas ${count === item.steps.length ? 'fa-check' : item.icon}`}></i><span>{item.label}</span><small>{count}/{item.steps.length}</small>
                        </button>
                    );
                })}
            </div>

            {allDone && (
                <div className="pl-finished"><PilouMascot mood="happy" size={52} label="" /><i className="fas fa-circle-check"></i> Bravo, parcours terminé : toutes les étapes sont cochées. Pensez au rapport.
                    <Button variant="link" size="sm" onClick={onResetProgress}>Recommencer le suivi</Button></div>
            )}

            <div className={`pl-current ${step.kind}${done.has(step.id) ? ' done' : ''}`}>
                <div className="pl-current-head"><span><i className={`fas ${phase.icon}`}></i> {phase.label}</span><span>Étape {index + 1} sur {steps.length}</span></div>
                <h5>{step.title}{step.tag && <span className="pl-tag">{step.tag}</span>}</h5>
                <StepBody step={step} />
                <div className="pl-current-actions">
                    <Button variant="outline-secondary" size="sm" disabled={index === 0} onClick={() => onGoto(steps[index - 1].id)}><i className="fas fa-arrow-left me-1"></i>Précédente</Button>
                    <Button variant="outline-secondary" size="sm" disabled={index === steps.length - 1} onClick={() => onGoto(steps[index + 1].id)}>Passer<i className="fas fa-arrow-right ms-1"></i></Button>
                    {done.has(step.id)
                        ? <Button variant="outline-warning" size="sm" onClick={() => onToggle(step.id)}><i className="fas fa-rotate-left me-1"></i>Décocher</Button>
                        : <Button variant="success" size="sm" onClick={() => onComplete(step.id)}><i className="fas fa-check me-1"></i>Fait — étape suivante</Button>}
                </div>
            </div>

            {upcoming.length > 0 && (
                <div className="pl-upcoming"><strong>Ensuite :</strong> {upcoming.map((item, i) => <button key={item.id} type="button" onClick={() => onGoto(item.id)}>{i + 1}. {item.title}</button>)}</div>
            )}

            <div className="pl-outline">
                {result.timeline.map((item) => (
                    <div key={item.key} className="pl-outline-phase">
                        <div className="pl-outline-title"><i className={`fas ${item.icon}`}></i>{item.label}</div>
                        {item.steps.map((s) => (
                            <div key={s.id} className={`pl-outline-step${s.id === step.id ? ' current' : ''}${done.has(s.id) ? ' done' : ''}`}>
                                <Form.Check type="checkbox" id={`pilou-outline-${s.id}`} checked={done.has(s.id)} onChange={() => onToggle(s.id)} aria-label={`Étape faite : ${s.title}`} />
                                <button type="button" onClick={() => onGoto(s.id)}>{s.title}{s.meds.length > 0 && <i className="fas fa-syringe pl-outline-med" title="Médicament dosé à cette étape"></i>}{s.tag && <em> · {s.tag}</em>}</button>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

const PilouCare = ({ state, setState, onReset, onOpenLesson, showNotification }) => {
    const { age, sex, weight, height, severity, allergies, chronic, currentMeds, selected } = state;
    const set = (patch) => setState((prev) => ({ ...prev, ...patch }));

    // Saisie libre pour l'âge, le poids et la taille, mais bornée (BODY_LIMITS) : Pilou en déduit lui-même ses tranches (constantes, doses, matériel).
    const invalid = {
        age: age !== '' && parseAgeYears(age) === null,
        weight: weight !== '' && parseWeightKg(weight) === null,
        height: height !== '' && parseHeightCm(height) === null,
    };
    const outOfRange = [invalid.age && `âge ${LIMIT_HINTS.ageYears}`, invalid.weight && `poids ${LIMIT_HINTS.weightKg}`, invalid.height && `taille ${LIMIT_HINTS.heightCm}`].filter(Boolean);
    const valid = (value, bad) => (value === '' || bad ? '' : value);
    // Champs obligatoires : tout sauf allergies, antécédents, traitements en cours et précisions sur les blessures.
    const missing = [['l\'âge', valid(age, invalid.age)], ['le sexe', sex], ['le poids', valid(weight, invalid.weight)], ['la taille', valid(height, invalid.height)], ['la gravité', severity], ['au moins un motif', selected.length ? 'ok' : '']].filter(([, value]) => !value).map(([label]) => label);
    const ready = missing.length === 0;

    const result = useMemo(() => (ready ? buildCase({
        ageYears: String(parseAgeYears(age)), sex, weightKg: String(parseWeightKg(weight)), heightCm: String(parseHeightCm(height)), severity,
        allergies: joinChoices(allergies), chronic: joinChoices(chronic), currentMeds: joinChoices(currentMeds), conditionIds: selected,
        injuryDetails: state.injuryDetails, injuryMutilations: state.injuryMutilations,
    }) : null), [ready, age, sex, weight, height, severity, allergies, chronic, currentMeds, selected, state.injuryDetails, state.injuryMutilations]);

    const steps = result ? flatSteps(result.timeline) : [];
    const done = useMemo(() => new Set(state.done), [state.done]);
    const progress = result ? progressOf(result.timeline, state.done) : null;
    // Étape en cours : celle choisie si elle existe encore, sinon la première non faite.
    const currentId = steps.some((step) => step.id === state.current) ? state.current : (progress && progress.next ? progress.next.id : (steps[0] || {}).id);

    const toggle = (id) => setState((prev) => ({ ...prev, done: prev.done.includes(id) ? prev.done.filter((other) => other !== id) : [...prev.done, id] }));
    const goto = (id) => set({ current: id, view: 'track' });
    const complete = (id) => setState((prev) => {
        const nextDone = prev.done.includes(id) ? prev.done : [...prev.done, id];
        const at = steps.findIndex((step) => step.id === id);
        const next = steps.slice(at + 1).find((step) => !nextDone.includes(step.id)) || steps.find((step) => !nextDone.includes(step.id)) || steps[at];
        return { ...prev, done: nextDone, current: next.id };
    });
    const notify = showNotification || (() => {});
    const copy = async () => {
        try { await navigator.clipboard.writeText(caseToText(result, state.done.filter((id) => steps.some((step) => step.id === id)))); notify('Prise en charge copiée.', 'check-circle'); } catch (error) { notify('Copie impossible dans ce navigateur.', 'error'); }
    };
    const selectedOptions = selected.map((id) => ({ value: id, label: CONDITION_BY_ID[id]?.label || id }));
    // Humeur de Pilou : content quand tout est fait, inquiet dès qu'un médicament porte une alerte (allergie, interaction, dose), sinon au travail.
    const hasAlert = !!result && result.meds.some((med) => med.level === 'error' || med.level === 'warn');
    const mood = progress && progress.percent === 100 ? 'happy' : hasAlert ? 'alert' : 'neutral';

    return (
        <div className="pl-layout">
            <div className="pl-form" data-guide-zone>
                <div className="field-legend"><span className="req"><i></i>Obligatoire</span><span className="opt"><i></i>Facultatif</span></div>
                <h6 className="pl-title"><i className="fas fa-user-injured"></i>Le patient</h6>
                <div className="pl-grid">
                    <Form.Group><Form.Label>Âge (ans)</Form.Label>
                        <Form.Control name="pilouAge" type="number" inputMode="numeric" required min={BODY_LIMITS.ageYears.min} max={BODY_LIMITS.ageYears.max} step="1" value={age} onChange={(e) => set({ age: e.target.value })}
                            placeholder={`Âge (${LIMIT_HINTS.ageYears}, 0 = nourrisson)`} isInvalid={invalid.age} data-guide={`Âge du patient, ${LIMIT_HINTS.ageYears} : Pilou adapte lui-même les constantes, les doses et le matériel (nourrisson, enfant, adulte, personne âgée).`} /></Form.Group>
                    <Form.Group><Form.Label>Sexe</Form.Label>
                        <Form.Select name="pilouSexe" required value={sex} onChange={(e) => set({ sex: e.target.value })} data-guide="Sexe du patient : constantes de repos, grossesse possible chez la femme en âge de procréer.">
                            <option value="">Choisir…</option>{SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </Form.Select></Form.Group>
                    <Form.Group><Form.Label>Poids (kg)</Form.Label>
                        <Form.Control name="pilouPoids" type="number" inputMode="decimal" required min={BODY_LIMITS.weightKg.min} max={BODY_LIMITS.weightKg.max} step="any" value={weight} onChange={(e) => set({ weight: e.target.value })}
                            placeholder={`Poids en kg (${LIMIT_HINTS.weightKg})`} isInvalid={invalid.weight} data-guide={`Poids du patient en kg, ${LIMIT_HINTS.weightKg} : les doses des médicaments sont calculées dessus.`} /></Form.Group>
                    <Form.Group><Form.Label>Taille (cm)</Form.Label>
                        <Form.Control name="pilouTaille" type="number" inputMode="numeric" required min={BODY_LIMITS.heightCm.min} max={BODY_LIMITS.heightCm.max} step="any" value={height} onChange={(e) => set({ height: e.target.value })}
                            placeholder={`Taille en cm (${LIMIT_HINTS.heightCm})`} isInvalid={invalid.height} data-guide={`Taille du patient en cm, ${LIMIT_HINTS.heightCm} : sert à l'IMC et aux valeurs de repos.`} /></Form.Group>
                </div>
                {outOfRange.length > 0 && <div className="pl-range" data-no-tip="1"><i className="fas fa-triangle-exclamation"></i> Valeur hors limites : {outOfRange.join(' ; ')}.</div>}
                <Form.Group className="mt-2"><Form.Label>Gravité estimée</Form.Label>
                    <Form.Select name="pilouGravite" required value={severity} onChange={(e) => set({ severity: e.target.value })} data-guide="Gravité de l'état du patient : elle règle les constantes attendues, les médicaments proposés, le rythme de la surveillance et l'orientation.">
                        <option value="">Choisir la gravité…</option>{SEVERITIES.map((sv) => <option key={sv.value} value={sv.value}>{sv.label}</option>)}
                    </Form.Select></Form.Group>
                <Form.Group className="mt-2"><Form.Label>Allergies connues</Form.Label>
                    <Select isMulti name="pilouAllergies" value={asOptions(allergies)} options={ALLERGY_CHOICES} styles={selectStyles} closeMenuOnSelect={false}
                        onChange={(options) => set({ allergies: (options || []).map((o) => o.value) })} placeholder="Aucune connue…" noOptionsMessage={() => 'Aucun autre choix'} /></Form.Group>
                <Form.Group className="mt-2"><Form.Label>Antécédents</Form.Label>
                    <Select isMulti name="pilouAntecedents" value={asOptions(chronic)} options={HISTORY_CHOICES} styles={selectStyles} closeMenuOnSelect={false}
                        onChange={(options) => set({ chronic: (options || []).map((o) => o.value) })} placeholder="Aucun connu…" noOptionsMessage={() => 'Aucun autre choix'} /></Form.Group>
                <Form.Group className="mt-2"><Form.Label>Traitements en cours</Form.Label>
                    <Select isMulti name="pilouTraitements" value={asOptions(currentMeds)} options={MEDICATION_CHOICES} styles={selectStyles} closeMenuOnSelect={false}
                        onChange={(options) => set({ currentMeds: (options || []).map((o) => o.value) })} placeholder="Aucun connu…" noOptionsMessage={() => 'Aucun autre choix'} /></Form.Group>

                <h6 className="pl-title mt-3"><i className="fas fa-stethoscope"></i>Les motifs</h6>
                <Form.Group><Form.Label>Motif(s) de la prise en charge</Form.Label>
                    <div data-required="1">
                        <Select
                            isMulti name="pilouMotifs" value={selectedOptions} options={conditionOptions} filterOption={filterConditions} styles={selectStyles} closeMenuOnSelect={false}
                            onChange={(options) => set({ selected: (options || []).map((o) => o.value) })}
                            placeholder="Choisir dans la liste (plusieurs choix possibles)…" noOptionsMessage={() => 'Aucun motif'}
                        />
                    </div>
                    <span className="helper-text" data-no-tip="1">Ce sont les motifs des formulaires d'urgence et de consultation : tapez un nom ou un synonyme (« balle », « foulure »…), puis choisissez.</span></Form.Group>

                {/* Mêmes « Précisions sur les blessures » que dans le protocole d'urgence, limitées aux listes : zone, côté, nombre, trajet, précisions, mutilations. */}
                <InjuryDetails formData={state} setFormData={setState} ids={selected} strict />

                <Button variant="outline-secondary" size="sm" className="mt-3" onClick={onReset}><i className="fas fa-rotate-left me-1"></i>Nouveau patient</Button>
            </div>

            <div className="pl-result">
                {!result && (
                    <div className="pl-empty"><PilouMascot mood="sleepy" size={130} label="" /><p>Renseignez les champs obligatoires : {ASSISTANT_NAME} se réveille et affiche ici le parcours de prise en charge.</p>{missing.length > 0 && <small>Il manque : {missing.join(', ')}.</small>}</div>
                )}
                {result && (
                    <>
                        <div className="pl-head">
                            <div className="pl-head-main">
                                <span className="pl-head-mood" title={mood === 'alert' ? "Pilou a repéré une alerte sur un médicament : voir les encadrés orange ou rouges." : mood === 'happy' ? 'Toutes les étapes sont faites.' : undefined}>
                                    <PilouMascot mood={mood} size={58} label="" />
                                </span>
                                <div>
                                    <h5>{result.conditions.map((c) => c.label).join(' + ')}</h5>
                                    <div className="pl-sub">{patientLine(result)} — gravité <strong>{result.severity.label.toLowerCase()}</strong></div>
                                </div>
                            </div>
                            <Button variant="outline-info" size="sm" onClick={copy}><i className="fas fa-copy me-1"></i>Copier</Button>
                        </div>

                        <div className="pl-vitals">
                            {[['FC', `${result.vitals.hr}/min`], ['PA', `${result.vitals.sbp}/${result.vitals.dbp}`], ['FR', `${result.vitals.rr}/min`], ['SpO₂', `${result.vitals.spo2} %`],
                                ['T°', `${comma(result.vitals.temp)} °C`], ['Glycémie', `${comma(result.vitals.glu)} g/L`], ['Glasgow', `${result.vitals.gcs}`]]
                                .map(([label, value]) => <div key={label} className="pl-vital"><span>{label}</span><strong>{value}</strong></div>)}
                        </div>
                        <small className="text-muted">Constantes attendues pour ce patient et cette gravité (estimation).</small>

                        <div className="pl-lessons">
                            {result.conditions.map((condition) => {
                                const lesson = lessonOfCondition(condition.id);
                                return lesson ? <button key={condition.id} type="button" onClick={() => onOpenLesson(lesson)}><i className="fas fa-book-medical"></i>Manuel : {lesson.title}</button> : null;
                            })}
                        </div>

                        {/* Tous les médicaments du cas, d'un coup d'œil ; chacun est aussi affiché sur l'étape du parcours qui le demande. */}
                        {(result.meds.length > 0 || result.skipped.length > 0 || result.prescription.length > 0) && (
                            <details className="pl-medlist">
                                <summary><i className="fas fa-pills"></i>Médicaments et doses pour ce patient ({result.meds.length})</summary>
                                {result.meds.length === 0 && <small className="text-muted">Aucun médicament proposé à cette gravité.</small>}
                                {result.meds.map((med) => <Dose key={`${med.medId}-${med.text}`} med={{ ...med, shared: '' }} />)}
                                {result.prescription.length > 0 && <div className="pl-medlist-sub"><strong>Ordonnance de sortie :</strong> {result.prescription.map((med) => med.text).join(' ; ')}</div>}
                                {result.skipped.length > 0 && <div className="pl-medlist-sub"><strong>Écartés :</strong> {result.skipped.map((item) => `${item.name}${item.reasons.length ? ` (${item.reasons.join(' ; ')})` : ''}`).join(' — ')}</div>}
                            </details>
                        )}

                        <div className="pl-toolbar">
                            <div className="pl-views" role="tablist" aria-label="Affichage du parcours">
                                <button type="button" role="tab" aria-selected={state.view !== 'track'} className={state.view !== 'track' ? 'active' : ''} onClick={() => set({ view: 'full' })}><i className="fas fa-list-check"></i>Vue complète</button>
                                <button type="button" role="tab" aria-selected={state.view === 'track'} className={state.view === 'track' ? 'active' : ''} onClick={() => set({ view: 'track', current: currentId })}><i className="fas fa-shoe-prints"></i>Suivi pas à pas</button>
                            </div>
                            <div className="pl-progress" title="Étapes cochées">
                                <div className="pl-progress-bar"><span style={{ width: `${progress.percent}%` }}></span></div>
                                <small>{progress.done} / {progress.total} étapes faites</small>
                            </div>
                        </div>

                        {state.view === 'track'
                            ? <TrackView result={result} done={done} currentId={currentId} onToggle={toggle} onGoto={goto} onComplete={complete} onResetProgress={() => set({ done: [], current: '' })} />
                            : <FullView result={result} done={done} onToggle={toggle} onFollow={goto} />}
                    </>
                )}
            </div>
        </div>
    );
};

export default PilouCare;
