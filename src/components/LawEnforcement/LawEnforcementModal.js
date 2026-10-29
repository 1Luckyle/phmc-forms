// src/components/LawEnforcement/LawEnforcementModal.js
//
// « Demandes des forces de l'ordre » (Boîte à outils du personnel) : un aide-mémoire pour répondre à un agent qui demande une information sur un patient
// (le secret médical est un crime, Code Pénal art. 323 : mandat → Direction, consentement, danger vital, sinon refus poli), et un registre court de ces
// demandes. Le registre ne contient JAMAIS de contenu médical : qui demande, quoi, sur quel fondement, décision. Chacun lit ses fiches ; les admins lisent
// tout et peuvent corriger ou supprimer.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import './LawEnforcement.css';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { copyToClipboard } from '../notificationService';
import {
    REQUEST_TYPES, LEGAL_BASES, DECISIONS, adviceFor, emptyRequest, validateRequest, saveRequest, loadMyRequests, loadAllRequests, deleteRequest,
} from '../../utils/lawEnforcement';

const DECISION_VARIANT = { remis: 'warning', refuse: 'secondary', transmis: 'info' };

// ───────────────────────────── Aide-mémoire ─────────────────────────────
const Memo = ({ onRegister, showNotification }) => {
    const [answers, setAnswers] = useState([]);
    const step = adviceFor(answers);

    return (
        <div className="le-memo">
            <p className="text-muted small mb-3">
                Un agent vous demande une information sur un patient ? Répondez aux questions, dans l'ordre : l'aide-mémoire vous dit quoi faire. En cas de doute, ne communiquez rien et appelez la Direction.
            </p>
            {answers.length > 0 && (
                <ol className="le-trail">
                    {answers.map((answer, index) => (
                        <li key={index}>{adviceFor(answers.slice(0, index)).question.text} <strong>{answer ? 'Oui' : 'Non'}</strong></li>
                    ))}
                </ol>
            )}
            {step.question && (
                <div className="le-question">
                    <strong>{step.question.text}</strong>
                    {step.question.help && <small className="d-block text-muted">{step.question.help}</small>}
                    <div className="d-flex gap-2 mt-2">
                        <Button variant="success" onClick={() => setAnswers([...answers, true])}>Oui</Button>
                        <Button variant="outline-secondary" onClick={() => setAnswers([...answers, false])}>Non</Button>
                        {answers.length > 0 && <Button variant="link" onClick={() => setAnswers(answers.slice(0, -1))}>Retour</Button>}
                    </div>
                </div>
            )}
            {step.outcome && (
                <Alert variant={step.outcome.tone} className="mt-2">
                    <Alert.Heading as="h6">{step.outcome.title}</Alert.Heading>
                    <p className="mb-2">{step.outcome.body}</p>
                    {step.outcome.script && (
                        <blockquote className="le-script">{step.outcome.script}</blockquote>
                    )}
                    <div className="d-flex flex-wrap gap-2">
                        {step.outcome.script && (
                            <Button size="sm" variant="outline-light" onClick={() => copyToClipboard(step.outcome.script, showNotification, 'Réponse copiée !')}>
                                <i className="fas fa-copy me-1"></i>Copier la réponse
                            </Button>
                        )}
                        <Button size="sm" variant="primary" onClick={() => onRegister({ baseLegale: step.outcome.base, decision: step.outcome.decision })}>
                            <i className="fas fa-pen me-1"></i>Enregistrer cette demande
                        </Button>
                        <Button size="sm" variant="link" onClick={() => setAnswers([])}>Recommencer</Button>
                    </div>
                </Alert>
            )}
        </div>
    );
};

// ───────────────────────────── Registre ─────────────────────────────
const Registry = ({ preset, isAdmin, uid, staffName, showNotification }) => {
    const [form, setForm] = useState({ ...emptyRequest(), ...(preset || {}) });
    const [list, setList] = useState([]);
    const [all, setAll] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { if (preset) setForm({ ...emptyRequest(), ...preset }); }, [preset]);

    const load = useCallback(async () => {
        if (!uid) return;
        setLoading(true);
        try {
            setList(all && isAdmin ? await loadAllRequests() : await loadMyRequests(uid));
            setError('');
        } catch (err) {
            console.error(err);
            setError('Impossible de charger le registre.');
        } finally {
            setLoading(false);
        }
    }, [uid, all, isAdmin]);
    useEffect(() => { load(); }, [load]);

    const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
    const errors = validateRequest(form);

    const submit = async () => {
        setSaving(true);
        try {
            await saveRequest(form, { staffName });
            showNotification('Demande enregistrée dans le registre.', 'check-circle');
            setForm(emptyRequest());
            await load();
        } catch (err) {
            showNotification(String(err?.message || err).slice(0, 160), 'error');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (entry) => {
        if (!window.confirm('Supprimer cette fiche du registre ?')) return;
        try { await deleteRequest(entry.id); await load(); } catch (err) { showNotification(`Suppression impossible : ${err.message}`, 'error'); }
    };

    return (
        <>
            <Alert variant="secondary" className="py-2 small">
                <i className="fas fa-shield-halved me-1"></i>N'écrivez ici <strong>aucun contenu médical</strong> : seulement qui a demandé quoi, sur quel fondement, et ce que vous avez décidé.
            </Alert>
            <div className="adm-form-grid le-form">
                <Form.Group><Form.Label>Service demandeur</Form.Label><Form.Control value={form.service} onChange={set('service')} placeholder="ex. LSPD, LSSD, FIB" maxLength={80} /></Form.Group>
                <Form.Group><Form.Label>Agent (nom, matricule)</Form.Label><Form.Control value={form.agent} onChange={set('agent')} placeholder="ex. Off. Dupont #4521" maxLength={120} /></Form.Group>
                <Form.Group><Form.Label>Type de demande</Form.Label>
                    <Form.Select value={form.type} onChange={set('type')}>{Object.entries(REQUEST_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Form.Select></Form.Group>
                <Form.Group><Form.Label>ID patient concerné <small className="text-muted">(facultatif)</small></Form.Label><Form.Control value={form.patientID} onChange={set('patientID')} placeholder="ex. PHMC-2752" maxLength={40} /></Form.Group>
                <Form.Group><Form.Label>Fondement invoqué</Form.Label>
                    <Form.Select value={form.baseLegale} onChange={set('baseLegale')}>{Object.entries(LEGAL_BASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Form.Select></Form.Group>
                {form.baseLegale === 'mandat' && (
                    <Form.Group><Form.Label>Référence du mandat</Form.Label><Form.Control value={form.reference} onChange={set('reference')} maxLength={120} /></Form.Group>
                )}
                <Form.Group><Form.Label>Décision</Form.Label>
                    <Form.Select value={form.decision} onChange={set('decision')}>{Object.entries(DECISIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Form.Select></Form.Group>
                <Form.Group className="le-note"><Form.Label>Note <small className="text-muted">(facultatif, sans contenu médical)</small></Form.Label>
                    <Form.Control as="textarea" rows={2} value={form.note} onChange={set('note')} maxLength={300} /></Form.Group>
            </div>
            {errors.length > 0 && <small className="text-warning d-block mb-2">{errors[0]}</small>}
            <Button variant="primary" onClick={submit} disabled={saving || errors.length > 0}>{saving ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer dans le registre'}</Button>

            <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
                <h6 className="mb-0">{all && isAdmin ? 'Toutes les demandes' : 'Mes demandes'}</h6>
                {isAdmin && <Form.Check type="switch" id="le-all" label="Voir toutes les demandes" checked={all} onChange={(e) => setAll(e.target.checked)} />}
            </div>
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}
            {loading ? <Spinner animation="border" size="sm" /> : list.length === 0 ? <p className="text-muted small">Aucune demande enregistrée.</p> : (
                <div className="le-table-scroll">
                    <Table size="sm" className="le-table">
                        <thead><tr><th>Date</th><th>Demandeur</th><th>Demande</th><th>Fondement</th><th>Décision</th>{all && isAdmin && <th>Par</th>}{isAdmin && <th></th>}</tr></thead>
                        <tbody>
                            {list.map((entry) => (
                                <tr key={entry.id}>
                                    <td>{new Date(entry.le).toLocaleString('fr-FR')}</td>
                                    <td>{entry.service}<small className="d-block text-muted">{entry.agent}</small></td>
                                    <td>{REQUEST_TYPES[entry.type] || entry.type}{entry.patientID && <small className="d-block text-muted">{entry.patientID}</small>}{entry.note && <small className="d-block text-muted">{entry.note}</small>}</td>
                                    <td>{LEGAL_BASES[entry.baseLegale] || entry.baseLegale}{entry.reference && <small className="d-block text-muted">Réf. {entry.reference}</small>}</td>
                                    <td><Badge bg={DECISION_VARIANT[entry.decision] || 'secondary'}>{DECISIONS[entry.decision] || entry.decision}</Badge></td>
                                    {all && isAdmin && <td>{entry.auteurNom}</td>}
                                    {isAdmin && <td><Button size="sm" variant="outline-danger" onClick={() => remove(entry)} title="Supprimer la fiche"><i className="fas fa-trash"></i></Button></td>}
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}
        </>
    );
};

// ───────────────────────────── Fenêtre ─────────────────────────────
const LawEnforcementModal = ({ show, onHide, showNotification }) => {
    const { currentEmployee, staffName, isAdmin } = useEmployeeAuth();
    const [tab, setTab] = useState('memo');
    const [preset, setPreset] = useState(null);

    useEffect(() => { if (show) { setTab('memo'); setPreset(null); } }, [show]);

    const register = (values) => { setPreset(values); setTab('registre'); };

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Demandes des forces de l'ordre" modalSize="large" zIndex={1100} className="dark-ui">
            <ul className="nav nav-tabs mb-3">
                <li className="nav-item"><button type="button" className={`nav-link ${tab === 'memo' ? 'active' : ''}`} onClick={() => setTab('memo')}><i className="fas fa-list-check me-1"></i>Aide-mémoire</button></li>
                <li className="nav-item"><button type="button" className={`nav-link ${tab === 'registre' ? 'active' : ''}`} onClick={() => setTab('registre')}><i className="fas fa-book me-1"></i>Registre</button></li>
            </ul>
            {tab === 'memo' && <Memo onRegister={register} showNotification={showNotification} />}
            {tab === 'registre' && <Registry preset={preset} isAdmin={!!isAdmin} uid={currentEmployee?.uid} staffName={staffName} showNotification={showNotification} />}
            <p className="text-muted small mt-3 mb-0">
                Secret médical : Code Pénal, art. 323. Exceptions : art. 123 (danger) ; mandats et injonctions : Code de Procédure Judiciaire, art. 330, 341 et 422. Aide-mémoire RP : en cas de doute, la Direction décide.
            </p>
        </BaseModal>
    );
};

export default LawEnforcementModal;
