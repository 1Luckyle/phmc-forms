// src/phmc-field-data/shared/InjuryDetails.js
//
// « Précisions sur les blessures » du protocole d'urgence, SOUS « Motifs de prise en charge » et avant les suggestions de Pilou : pour chaque motif qui se localise (fracture, plaie, balle, couteau, brûlure…), OÙ sur le
// corps et COMBIEN ; puis les mutilations associées (dents, œil, oreille, amputations…) et une précision libre. Pilou reprend tout cela dans la plainte, le diagnostic et les soins ; le rapport l'imprime dans l'anamnèse
// (clinical/injuries.js).
import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';
import { darkSelectStyles } from './selectStyles';
import { ASSISTANT_LABEL } from '../../clinical/assistantName';
import { CONDITION_BY_ID } from '../../clinical/conditions';
import { INJURY_CONDITIONS, isInjuryCondition, BODY_REGION_GROUPS, REGION_LABEL, SIDES, COUNTS, TRAJECTORIES, MUTILATIONS, MUTILATION_BY_VALUE } from '../../clinical/injuries';

const row = { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '0.5rem' };
const cell = (basis) => ({ flex: `1 1 ${basis}px`, minWidth: 0 });

const InjuryDetails = ({ formData, setFormData, ids = [] }) => {
    const injuryIds = ids.filter((id) => isInjuryCondition(id) && CONDITION_BY_ID[id]);
    if (!injuryIds.length) return null;
    const entries = Array.isArray(formData.injuryDetails) ? formData.injuryDetails : [];
    const entryOf = (conditionId) => entries.find((entry) => entry && entry.conditionId === conditionId) || {};
    const update = (conditionId, patch) => setFormData((prev) => {
        const list = Array.isArray(prev.injuryDetails) ? prev.injuryDetails : [];
        const exists = list.some((entry) => entry && entry.conditionId === conditionId);
        const next = exists
            ? list.map((entry) => (entry && entry.conditionId === conditionId ? { ...entry, ...patch } : entry))
            : [...list, { conditionId, regions: [], side: '', count: '', note: '', ...patch }];
        return { ...prev, injuryDetails: next };
    });
    const mutilations = Array.isArray(formData.injuryMutilations) ? formData.injuryMutilations : [];

    return (
        <div style={{ border: '1px solid #30363d', borderRadius: 8, padding: '0.7rem 0.8rem', marginTop: '0.7rem', background: '#101923' }} data-no-tip="1">
            <div style={{ marginBottom: 6 }}><strong>Précisions sur les blessures</strong></div>
            <div className="helper-text" style={{ marginBottom: '0.6rem' }}>
                Où sur le corps, combien, et les éventuelles mutilations : à renseigner avant {ASSISTANT_LABEL}, qui les reprend dans la plainte, le diagnostic et les soins.
            </div>
            {injuryIds.map((conditionId) => {
                const entry = entryOf(conditionId);
                const config = INJURY_CONDITIONS[conditionId];
                return (
                    <div key={conditionId} style={{ borderLeft: '3px solid #1f6feb', paddingLeft: 10, marginBottom: '0.7rem' }}>
                        <div className="small" style={{ marginBottom: 4 }}><strong>{CONDITION_BY_ID[conditionId].label}</strong></div>
                        <div style={row}>
                            <div style={cell(300)}>
                                <Form.Label className="small mb-1">Localisation (plusieurs choix possibles)</Form.Label>
                                <Select
                                    isMulti options={BODY_REGION_GROUPS} styles={darkSelectStyles} className="form-control p-0" placeholder="Où sur le corps ? (main, cuisse, thorax…)" noOptionsMessage={() => 'Aucune zone trouvée'}
                                    value={(Array.isArray(entry.regions) ? entry.regions : []).map((value) => ({ value, label: REGION_LABEL[value] || value }))}
                                    onChange={(selected) => update(conditionId, { regions: (selected || []).map((option) => option.value) })}
                                />
                            </div>
                            <div style={cell(150)}>
                                <Form.Label className="small mb-1">Côté</Form.Label>
                                <Form.Select name={`injurySide-${conditionId}`} value={entry.side || ''} onChange={(e) => update(conditionId, { side: e.target.value })} className="form-control">
                                    <option value="">Non précisé</option>
                                    {SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}
                                </Form.Select>
                            </div>
                            <div style={cell(130)}>
                                <Form.Label className="small mb-1">{config.countLabel}</Form.Label>
                                <Form.Select name={`injuryCount-${conditionId}`} value={entry.count || ''} onChange={(e) => update(conditionId, { count: e.target.value })} className="form-control">
                                    <option value="">Non précisé</option>
                                    {COUNTS.map((count) => <option key={count.value} value={count.value}>{count.label}</option>)}
                                </Form.Select>
                            </div>
                            {config.trajectory && (
                                <div style={cell(220)}>
                                    <Form.Label className="small mb-1">Trajet du projectile</Form.Label>
                                    <Form.Select name={`injuryTrajectory-${conditionId}`} value={entry.trajectory || ''} onChange={(e) => update(conditionId, { trajectory: e.target.value })} className="form-control">
                                        <option value="">Non précisé</option>
                                        {TRAJECTORIES.map((trajectory) => <option key={trajectory.value} value={trajectory.value}>{trajectory.label}</option>)}
                                    </Form.Select>
                                </div>
                            )}
                        </div>
                        <Form.Control type="text" name={`injuryNote-${conditionId}`} value={entry.note || ''} onChange={(e) => update(conditionId, { note: e.target.value })} placeholder="Précision (profondeur, aspect, saignement, calibre…) — facultatif" className="form-control" />
                    </div>
                );
            })}
            <Form.Label className="small mb-1">Mutilations et atteintes associées</Form.Label>
            <Select
                isMulti options={MUTILATIONS} styles={darkSelectStyles} className="form-control p-0" placeholder="Perte de dents, atteinte de l'œil ou de l'oreille, amputation… (choix multiple)" noOptionsMessage={() => 'Aucune atteinte trouvée'}
                value={mutilations.map((value) => ({ value, label: (MUTILATION_BY_VALUE[value] || {}).label || value }))}
                onChange={(selected) => setFormData((prev) => ({ ...prev, injuryMutilations: (selected || []).map((option) => option.value) }))}
            />
            <Form.Control type="text" name="injuryNote" value={formData.injuryNote || ''} onChange={(e) => setFormData((prev) => ({ ...prev, injuryNote: e.target.value }))} placeholder="Autres précisions sur les lésions (facultatif)" className="form-control mt-2" />
        </div>
    );
};

export default InjuryDetails;
