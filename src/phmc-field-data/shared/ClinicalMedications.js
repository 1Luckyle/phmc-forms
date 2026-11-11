// src/phmc-field-data/shared/ClinicalMedications.js
//
// Liste des médicaments administrés ou prescrits d'un rapport de soins : choix du médicament, de la voie, de la dose (valeurs proposées pour CE patient selon son âge et son poids), du nombre de prises,
// avec les contrôles de cohérence en direct (dose maximale, allergie, traitement en cours…). Les alertes informent, elles ne bloquent pas l'enregistrement.
import React, { useMemo } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { darkSelectStyles } from './selectStyles';
import { MEDICATIONS, MEDICATION_BY_ID, regimenOf } from '../../clinical/medications';
import { doseOptions, checkList, newEntry, formatNumber } from '../../clinical/engine';

const MED_OPTIONS = MEDICATIONS.map((m) => ({ value: m.id, label: `${m.name} — ${m.category}`, search: [m.name, m.category, ...(m.brands || [])].join(' ').toLowerCase() }));
const filterMeds = (option, input) => !input || option.data.search.includes(input.toLowerCase());
const LEVEL_STYLE = { error: { color: '#ff7b72', icon: 'fa-circle-exclamation' }, warn: { color: '#e3b341', icon: 'fa-triangle-exclamation' }, info: { color: '#79c0ff', icon: 'fa-circle-info' } };

const Messages = ({ messages }) => messages.filter((m) => m.level !== 'ok').map((m) => (
    <div key={`${m.level}-${m.text}`} className="small" style={{ color: LEVEL_STYLE[m.level]?.color }}>
        <i className={`fas ${LEVEL_STYLE[m.level]?.icon} me-1`}></i>{m.text}
    </div>
));

const ClinicalMedications = ({ formData, setFormData, patient, tags, vitals }) => {
    const entries = useMemo(() => (Array.isArray(formData.clinicalMeds) ? formData.clinicalMeds : []), [formData.clinicalMeds]);
    const results = useMemo(() => checkList(entries, { patient, tags, vitals }), [entries, patient, tags, vitals]);
    const setEntries = (updater) => setFormData((prev) => ({ ...prev, clinicalMeds: updater(Array.isArray(prev.clinicalMeds) ? prev.clinicalMeds : []) }));
    const update = (index, patch) => setEntries((list) => list.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
    const remove = (index) => setEntries((list) => list.filter((_, i) => i !== index));

    const changeRegimen = (index, regimenId) => {
        const base = newEntry(entries[index].medId, patient, regimenId);
        update(index, { regimenId, dose: base ? base.dose : '' });
    };

    return (
        <>
            <Form.Label className="form-section-title">Médicaments administrés ou prescrits</Form.Label>
            {entries.length === 0 && <div className="helper-text" data-no-tip="1" style={{ marginBottom: '0.5rem' }}>Aucun médicament. Ajoutez-en depuis la liste, ou laissez l'assistant proposer ceux du motif choisi. Les doses proposées sont calculées pour l'âge et le poids du patient.</div>}
            {entries.map((entry, index) => {
                const med = MEDICATION_BY_ID[entry.medId];
                const regimen = regimenOf(entry.medId, entry.regimenId);
                if (!med || !regimen) return null;
                const opts = doseOptions(entry.medId, entry.regimenId, patient);
                const result = results.entries[index];
                const border = result.level === 'error' ? '#ff7b72' : result.level === 'warn' ? '#e3b341' : '#30363d';
                return (
                    <div key={`${entry.medId}-${index}`} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '0.6rem', background: '#101923' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                            <div><strong>{med.name}</strong> <span className="text-muted small">{med.category}{med.brands?.length ? ` · ${med.brands.join(', ')}` : ''}</span></div>
                            <Button variant="link" size="sm" className="text-danger p-0" onClick={() => remove(index)} aria-label={`Retirer ${med.name}`}><i className="fas fa-trash"></i></Button>
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                            <div style={{ flex: '1 1 190px', minWidth: 0 }}>
                                <Form.Label className="small mb-1">Voie</Form.Label>
                                <Form.Select value={entry.regimenId} onChange={(e) => changeRegimen(index, e.target.value)} className="form-control" disabled={med.regimens.length < 2}>
                                    {med.regimens.map((r) => <option key={r.id} value={r.id}>{r.route}</option>)}
                                </Form.Select>
                            </div>
                            <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                                <Form.Label className="small mb-1">Dose ({regimen.unit})</Form.Label>
                                <Form.Control type="number" step="any" min="0" value={entry.dose ?? ''} onChange={(e) => update(index, { dose: e.target.value === '' ? '' : Number(e.target.value) })} className="form-control" />
                            </div>
                            <div style={{ flex: '0 1 120px', minWidth: 0 }}>
                                <Form.Label className="small mb-1">Prises / 24 h</Form.Label>
                                <Form.Control type="number" min="1" max="12" value={entry.count ?? 1} onChange={(e) => update(index, { count: e.target.value === '' ? '' : Math.max(1, Math.min(12, Number(e.target.value))) })} className="form-control" />
                            </div>
                            <div style={{ flex: '2 1 220px', minWidth: 0 }}>
                                <Form.Label className="small mb-1">Précision (facultatif)</Form.Label>
                                <Form.Control type="text" value={entry.note || ''} onChange={(e) => update(index, { note: e.target.value })} placeholder="Site d'injection, horaire…" className="form-control" />
                            </div>
                        </div>
                        {opts.options.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                <span className="small text-muted" style={{ alignSelf: 'center' }}>Doses proposées{opts.mode === 'perKg' ? ` (${opts.weightEstimated ? 'poids estimé ' : ''}${opts.weightKg} kg)` : ''} :</span>
                                {opts.options.map((o) => (
                                    <Button key={o.value} size="sm" variant={Number(entry.dose) === o.value ? 'primary' : 'outline-secondary'} onClick={() => update(index, { dose: o.value })}>
                                        {o.label}{o.kind === 'usual' ? ' · usuelle' : ''}
                                    </Button>
                                ))}
                            </div>
                        )}
                        {regimen.note && <div className="small text-muted" style={{ marginTop: 4 }}>{regimen.note}{regimen.maxDaily ? ` Maximum ${formatNumber(regimen.maxDaily)} ${regimen.unit}/24 h.` : ''}</div>}
                        <Messages messages={result.messages} />
                    </div>
                );
            })}
            <Messages messages={results.list} />
            <Select
                options={MED_OPTIONS} filterOption={filterMeds} styles={darkSelectStyles} className="form-control p-0 mt-2" value={null} placeholder="Ajouter un médicament… (nom, marque ou classe)"
                noOptionsMessage={() => 'Aucun médicament trouvé'}
                onChange={(option) => { if (!option) return; const entry = newEntry(option.value, patient); if (entry) setEntries((list) => [...list, entry]); }}
            />
        </>
    );
};

export default ClinicalMedications;
