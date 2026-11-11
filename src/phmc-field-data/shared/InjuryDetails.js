// src/phmc-field-data/shared/InjuryDetails.js
//
// « Précisions sur les blessures » du protocole d'urgence, SOUS « Motifs de prise en charge » et avant les suggestions de Pilou : pour chaque motif qui se localise (fracture, plaie, balle, couteau, brûlure…), une ou plusieurs
// LIGNES — chacune avec UNE zone du corps, son côté et le nombre — et un bouton « + » pour en ajouter : la même blessure peut toucher des zones de côtés différents (plaie au thorax à droite, plaie à l'oreille à gauche).
// Puis les mutilations associées (dents, œil, oreille, amputations…) et une précision libre. Pilou reprend tout cela dans la plainte, le diagnostic et les soins ; le rapport l'imprime dans l'anamnèse (clinical/injuries.js).
import React from 'react';
import { Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { darkSelectStyles } from './selectStyles';
import { ASSISTANT_LABEL } from '../../clinical/assistantName';
import { CONDITION_BY_ID } from '../../clinical/conditions';
import { INJURY_CONDITIONS, isInjuryCondition, BODY_REGION_GROUPS, REGION_LABEL, SIDES, COUNTS, TRAJECTORIES, MUTILATIONS, MUTILATION_BY_VALUE, precisionOptions } from '../../clinical/injuries';

const row = { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '0.5rem' };
const cell = (basis) => ({ flex: `1 1 ${basis}px`, minWidth: 0 });
const emptyRow = (conditionId) => ({ conditionId, region: '', side: '', count: '', precisions: [], note: '' });

const InjuryDetails = ({ formData, setFormData, ids = [] }) => {
    const injuryIds = ids.filter((id) => isInjuryCondition(id) && CONDITION_BY_ID[id]);
    if (!injuryIds.length) return null;
    const stored = Array.isArray(formData.injuryDetails) ? formData.injuryDetails : [];
    // Lignes d'un motif ; tant qu'aucune n'est enregistrée, une ligne vide est affichée.
    const rowsOf = (conditionId) => {
        const mine = stored.filter((entry) => entry && entry.conditionId === conditionId);
        return mine.length ? mine : [emptyRow(conditionId)];
    };

    // Les écritures travaillent sur la liste à jour (prev) : la n-ième ligne d'un motif se retrouve par sa position parmi les lignes de CE motif.
    const mutate = (conditionId, change) => setFormData((prev) => {
        const all = Array.isArray(prev.injuryDetails) ? prev.injuryDetails : [];
        const others = all.filter((entry) => !entry || entry.conditionId !== conditionId);
        const mine = all.filter((entry) => entry && entry.conditionId === conditionId);
        const nextMine = change(mine.length ? mine : [emptyRow(conditionId)]);
        // L'ordre des motifs est conservé : les lignes d'un motif restent groupées à la place de la première.
        const firstIndex = all.findIndex((entry) => entry && entry.conditionId === conditionId);
        const merged = firstIndex < 0 ? [...others, ...nextMine] : [...others.slice(0, firstIndex), ...nextMine, ...others.slice(firstIndex)];
        return { ...prev, injuryDetails: merged };
    });
    const updateRow = (conditionId, position, patch) => mutate(conditionId, (mine) => mine.map((entry, i) => (i === position ? { ...entry, ...patch } : entry)));
    const addRow = (conditionId) => mutate(conditionId, (mine) => [...mine, emptyRow(conditionId)]);
    const removeRow = (conditionId, position) => mutate(conditionId, (mine) => (mine.length > 1 ? mine.filter((_, i) => i !== position) : mine));
    const mutilations = Array.isArray(formData.injuryMutilations) ? formData.injuryMutilations : [];

    return (
        <div style={{ border: '1px solid #30363d', borderRadius: 8, padding: '0.7rem 0.8rem', marginTop: '0.7rem', background: '#101923' }} data-no-tip="1">
            <div style={{ marginBottom: 6 }}><strong>Précisions sur les blessures</strong></div>
            <div className="helper-text" style={{ marginBottom: '0.6rem' }}>
                Une zone du corps par ligne : ajoutez une ligne (+) pour chaque autre zone, avec son côté, son nombre et ses précisions (à choisir dans la liste). À renseigner avant {ASSISTANT_LABEL}, qui reprend tout dans la plainte, le diagnostic et les soins.
            </div>
            {injuryIds.map((conditionId) => {
                const config = INJURY_CONDITIONS[conditionId];
                const rows = rowsOf(conditionId);
                return (
                    <div key={conditionId} style={{ borderLeft: '3px solid #1f6feb', paddingLeft: 10, marginBottom: '0.8rem' }}>
                        <div className="small" style={{ marginBottom: 4 }}><strong>{CONDITION_BY_ID[conditionId].label}</strong></div>
                        {rows.map((entry, position) => {
                            const suffix = `${conditionId}-${position}`;
                            const region = entry.region ? { value: entry.region, label: REGION_LABEL[entry.region] || entry.region } : null;
                            return (
                                <div key={suffix} style={{ marginBottom: '0.6rem' }}>
                                    <div style={row}>
                                        <div style={cell(240)}>
                                            {position === 0 && <Form.Label className="small mb-1">Zone du corps</Form.Label>}
                                            <Select
                                                options={BODY_REGION_GROUPS} value={region} isClearable styles={darkSelectStyles} className="form-control p-0" placeholder="Où sur le corps ? (main, cuisse, thorax…)" noOptionsMessage={() => 'Aucune zone trouvée'}
                                                onChange={(selected) => updateRow(conditionId, position, { region: selected ? selected.value : '' })}
                                            />
                                        </div>
                                        <div style={cell(140)}>
                                            {position === 0 && <Form.Label className="small mb-1">Côté</Form.Label>}
                                            <Form.Select name={`injurySide-${suffix}`} value={entry.side || ''} onChange={(e) => updateRow(conditionId, position, { side: e.target.value })} className="form-control">
                                                <option value="">Non précisé</option>
                                                {SIDES.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}
                                            </Form.Select>
                                        </div>
                                        <div style={cell(120)}>
                                            {position === 0 && <Form.Label className="small mb-1">{config.countLabel}</Form.Label>}
                                            <Form.Select name={`injuryCount-${suffix}`} value={entry.count || ''} onChange={(e) => updateRow(conditionId, position, { count: e.target.value })} className="form-control">
                                                <option value="">Non précisé</option>
                                                {COUNTS.map((count) => <option key={count.value} value={count.value}>{count.label}</option>)}
                                            </Form.Select>
                                        </div>
                                        {config.trajectory && (
                                            <div style={cell(200)}>
                                                {position === 0 && <Form.Label className="small mb-1">Trajet du projectile</Form.Label>}
                                                <Form.Select name={`injuryTrajectory-${suffix}`} value={entry.trajectory || ''} onChange={(e) => updateRow(conditionId, position, { trajectory: e.target.value })} className="form-control">
                                                    <option value="">Non précisé</option>
                                                    {TRAJECTORIES.map((trajectory) => <option key={trajectory.value} value={trajectory.value}>{trajectory.label}</option>)}
                                                </Form.Select>
                                            </div>
                                        )}
                                        {rows.length > 1 && (
                                            <div style={{ flex: '0 0 auto', alignSelf: position === 0 ? 'flex-end' : 'center' }}>
                                                <Button variant="outline-danger" size="sm" onClick={() => removeRow(conditionId, position)} aria-label="Retirer cette ligne" title="Retirer cette ligne"><i className="fas fa-xmark"></i></Button>
                                            </div>
                                        )}
                                    </div>
                                    <CreatableSelect
                                        isMulti isClearable options={precisionOptions(conditionId)} styles={darkSelectStyles} className="form-control p-0" placeholder="Précisions sur cette zone : choisissez ou saisissez (facultatif)" noOptionsMessage={() => 'Saisissez une précision'}
                                        formatCreateLabel={(text) => `Ajouter « ${text} »`} value={(Array.isArray(entry.precisions) ? entry.precisions : []).map((label) => ({ value: label, label }))}
                                        onChange={(selected) => updateRow(conditionId, position, { precisions: (selected || []).map((option) => option.value) })}
                                    />
                                    {entry.note ? <div className="small text-muted mt-1">Ancienne précision : {entry.note}</div> : null}
                                </div>
                            );
                        })}
                        <Button variant="outline-primary" size="sm" onClick={() => addRow(conditionId)}><i className="fas fa-plus me-1"></i>Ajouter une zone</Button>
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
