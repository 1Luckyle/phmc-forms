// src/phmc-field-data/shared/ClinicalMedications.js
//
// Liste des médicaments administrés ou prescrits d'un rapport de soins : choix du médicament, de la voie, de la dose (valeurs proposées pour CE patient selon son âge et son poids), du nombre de prises,
// avec les contrôles de cohérence en direct (dose maximale, allergie, traitement en cours…). Les alertes informent, elles ne bloquent pas l'enregistrement.
import React, { useMemo, useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { darkSelectStyles } from './selectStyles';
import { MEDICATIONS, MEDICATION_BY_ID, regimenOf } from '../../clinical/medications';
import { doseOptions, checkList, newEntry, formatNumber } from '../../clinical/engine';
import { prescriptionPlainText, prescribeEntry, defaultStartDate } from '../../clinical/apply';
import { addDaysIso } from '../../clinical/engine';
import { todayIso } from '../../utils/appointmentDate';
import generatePrescription, { prescriptionTitle } from '../../phmc-bbcode-generators/generatePrescription';
import { PrescriptionMenu } from '../../components/PrescriptionMenu';
import { ExpandToggle, ReportPreviewFrame } from '../../components/ReportExpansion';
import { ASSISTANT_NAME } from '../../clinical/assistantName';

const MED_OPTIONS = MEDICATIONS.map((m) => ({ value: m.id, label: `${m.name} — ${m.category}`, search: [m.name, m.category, ...(m.brands || [])].join(' ').toLowerCase() }));
const filterMeds = (option, input) => !input || option.data.search.includes(input.toLowerCase());
const LEVEL_STYLE = { error: { color: '#ff7b72', icon: 'fa-circle-exclamation' }, warn: { color: '#e3b341', icon: 'fa-triangle-exclamation' }, info: { color: '#79c0ff', icon: 'fa-circle-info' } };

const Messages = ({ messages }) => messages.filter((m) => m.level !== 'ok').map((m) => (
    <div key={`${m.level}-${m.text}`} className="small" style={{ color: LEVEL_STYLE[m.level]?.color }}>
        <i className={`fas ${LEVEL_STYLE[m.level]?.icon} me-1`}></i>{m.text}
    </div>
));

// version : formulaire qui porte la liste (19 urgences, 20 consultation, 5 opération) : logo, pied de page et libellé de l'ordonnance.
const ClinicalMedications = ({ formData, setFormData, patient, tags, vitals, title = 'Médicaments administrés ou prescrits', version = 19 }) => {
    const entries = useMemo(() => (Array.isArray(formData.clinicalMeds) ? formData.clinicalMeds : []), [formData.clinicalMeds]);
    const reportDate = (formData.date && addDaysIso(formData.date, 0)) || todayIso();
    const results = useMemo(() => checkList(entries, { patient, tags, vitals, date: reportDate }), [entries, patient, tags, vitals, reportDate]);
    const setEntries = (updater) => setFormData((prev) => ({ ...prev, clinicalMeds: updater(Array.isArray(prev.clinicalMeds) ? prev.clinicalMeds : []) }));
    const update = (index, patch) => setEntries((list) => list.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
    const remove = (index) => setEntries((list) => list.filter((_, i) => i !== index));
    const [previewOpen, setPreviewOpen] = useState(false);
    const prescription = useMemo(() => prescriptionPlainText(formData), [formData]);
    const prescriptionBb = useMemo(() => generatePrescription(formData, version), [formData, version]);
    const allPrescribed = entries.length > 0 && entries.every((entry) => entry.prescribed);

    const changeRegimen = (index, regimenId) => {
        const base = newEntry(entries[index].medId, patient, regimenId);
        update(index, { regimenId, dose: base ? base.dose : '' });
    };

    return (
        <>
            <Form.Label className="form-section-title">{title}</Form.Label>
            {entries.length === 0 && <div className="helper-text" data-no-tip="1" style={{ marginBottom: '0.5rem' }}>Aucun médicament. Ajoutez-en depuis la liste, ou laissez {ASSISTANT_NAME} proposer ceux du motif choisi. Les doses proposées sont calculées pour l'âge et le poids du patient.</div>}
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
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                            <Form.Check type="checkbox" id={`rx-${index}`} className="small" label="Sur l'ordonnance (traitement à poursuivre après la sortie)" checked={!!entry.prescribed} onChange={(e) => update(index, e.target.checked ? { prescribed: true, startDate: entry.startDate || defaultStartDate(entry, entries, reportDate) } : { prescribed: false })} />
                            {entry.prescribed && (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span className="small text-muted">Début</span>
                                    <Form.Control type="date" value={entry.startDate || ''} onChange={(e) => update(index, { startDate: e.target.value })} title="Date de début du traitement" className="form-control" style={{ maxWidth: 160 }} />
                                    <Button size="sm" variant={entry.startDate === reportDate ? 'primary' : 'outline-secondary'} onClick={() => update(index, { startDate: reportDate })} title="Le traitement commence le jour du rapport">Aujourd'hui</Button>
                                    <Button size="sm" variant={entry.startDate === addDaysIso(reportDate, 1) ? 'primary' : 'outline-secondary'} onClick={() => update(index, { startDate: addDaysIso(reportDate, 1) })} title="Le traitement commence le lendemain (déjà administré aujourd'hui)">Demain</Button>
                                </div>
                            )}
                            {entry.prescribed && (
                                <Form.Control type="number" min="1" max="90" value={entry.days ?? ''} onChange={(e) => update(index, { days: e.target.value === '' ? '' : Math.max(1, Math.min(90, Number(e.target.value))) })} placeholder="Durée (jours)" title="Durée du traitement, en jours" className="form-control" style={{ maxWidth: 150 }} />
                            )}
                        </div>
                        {regimen.note && <div className="small text-muted" style={{ marginTop: 4 }}>{regimen.note}{regimen.maxDaily ? ` Maximum ${formatNumber(regimen.maxDaily)} ${regimen.unit}/24 h.` : ''}</div>}
                        <Messages messages={result.messages} />
                    </div>
                );
            })}
            <Messages messages={results.list} />
            {entries.length > 0 && (
                <div style={{ border: '1px solid #30363d', borderRadius: 8, padding: '0.6rem 0.75rem', margin: '0.4rem 0 0.6rem', background: '#101923' }} data-no-tip="1">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong><i className="fas fa-file-prescription me-1"></i>Ordonnance</strong>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {!allPrescribed && <Button size="sm" variant="outline-primary" onClick={() => setEntries((list) => list.map((entry) => prescribeEntry(entry, list, reportDate)))}>Tout mettre sur l'ordonnance</Button>}
                            {prescriptionBb && <ExpandToggle open={previewOpen} onClick={() => setPreviewOpen((value) => !value)} label="Aperçu" title="Aperçu de l'ordonnance en document à part" />}
                            {prescriptionBb && <PrescriptionMenu bbCode={prescriptionBb} title={prescriptionTitle(formData)} plainText={prescription} />}
                        </div>
                    </div>
                    {prescription
                        ? <pre className="small mb-0 mt-2" style={{ whiteSpace: 'pre-wrap', color: 'inherit', fontFamily: 'inherit' }}>{prescription}</pre>
                        : <div className="small text-muted mt-1">Cochez « Sur l'ordonnance » sur les médicaments à prescrire : {ASSISTANT_NAME} compose l'ordonnance (dose, voie, prises, durée), imprimée dans le rapport et prête à copier. Les autres sont notés comme administrés.</div>}
                    {previewOpen && prescriptionBb && <div className="mt-2"><ReportPreviewFrame bbCode={prescriptionBb} title={prescriptionTitle(formData)} height={420} /></div>}
                </div>
            )}
            <Select
                options={MED_OPTIONS} filterOption={filterMeds} styles={darkSelectStyles} className="form-control p-0 mt-2" value={null} placeholder="Ajouter un médicament… (nom, marque ou classe)"
                noOptionsMessage={() => 'Aucun médicament trouvé'}
                onChange={(option) => { if (!option) return; const entry = newEntry(option.value, patient); if (entry) setEntries((list) => [...list, entry]); }}
            />
        </>
    );
};

export default ClinicalMedications;
