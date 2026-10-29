// src/components/Admin/FireSafetyManager.js
//
// Panneau admin → « Sécurité incendie » : le registre du PHMC. Le Titre II du Code du Feu (art. 200 à 208) s'applique à tout établissement, public compris
// (l'exemption de l'article 401 ne vise que le Titre IV : formation et certificat). Quatre vues : vue d'ensemble (dernier contrôle par étage, rappel au-delà
// de 30 jours), contrôles (check-list art. 202 à 208), non-conformités (responsable, échéance, résolution) et exercices d'évacuation.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap';
import {
    CHECKLIST, ITEM_STATUS, ARTICLES, NC_STATUS, ETAGE_SUGGESTIONS, REMINDER_DAYS, emptyItems, failedItems, floorStatus, isOverdue, summary,
    loadFireSafety, saveControl, addNonConformity, assignNonConformity, resolveNonConformity, reopenNonConformity, saveDrill,
} from '../../utils/fireSafety';
import './FireSafety.css';

const TABS = [
    { key: 'apercu', label: "Vue d'ensemble", icon: 'fa-gauge' },
    { key: 'controles', label: 'Contrôles', icon: 'fa-clipboard-check' },
    { key: 'nonconformites', label: 'Non-conformités', icon: 'fa-triangle-exclamation' },
    { key: 'exercices', label: "Exercices d'évacuation", icon: 'fa-person-running' },
];

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleDateString('fr-FR') : '—');
const dateToMs = (value) => (value ? new Date(`${value}T23:59:59`).getTime() : null);
const msToDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const EtageInput = ({ value, onChange }) => (
    <>
        <Form.Control list="fs-etages" value={value} onChange={onChange} placeholder="ex. Étage 2" maxLength={60} />
        <datalist id="fs-etages">{ETAGE_SUGGESTIONS.map((e) => <option key={e} value={e} />)}</datalist>
    </>
);

// ───────────────────────────── Vue d'ensemble ─────────────────────────────
const Overview = ({ data }) => {
    const floors = useMemo(() => floorStatus(data.controles), [data.controles]);
    const sums = summary(data);
    const lastDrill = data.exercices[0];
    return (
        <>
            <div className="fs-kpis">
                <div className={`fs-kpi ${sums.ouvertes ? 'warn' : 'ok'}`}><strong>{sums.ouvertes}</strong><span>non-conformité{sums.ouvertes > 1 ? 's' : ''} ouverte{sums.ouvertes > 1 ? 's' : ''}</span></div>
                <div className={`fs-kpi ${sums.enRetard ? 'bad' : 'ok'}`}><strong>{sums.enRetard}</strong><span>échéance{sums.enRetard > 1 ? 's' : ''} dépassée{sums.enRetard > 1 ? 's' : ''}</span></div>
                <div className={`fs-kpi ${sums.controlesEnRetard ? 'bad' : 'ok'}`}><strong>{sums.controlesEnRetard}</strong><span>étage{sums.controlesEnRetard > 1 ? 's' : ''} à recontrôler (+ {REMINDER_DAYS} j)</span></div>
                <div className="fs-kpi"><strong>{lastDrill ? formatDate(lastDrill.le) : '—'}</strong><span>dernier exercice</span></div>
            </div>
            <h6 className="mt-3">Dernier contrôle par étage</h6>
            {floors.length === 0 ? <p className="text-muted">Aucun contrôle enregistré : commencez par l'onglet « Contrôles ».</p> : (
                <Table size="sm" className="fs-table">
                    <thead><tr><th>Étage</th><th>Dernier contrôle</th><th>Par</th><th>Résultat</th><th></th></tr></thead>
                    <tbody>
                        {floors.map(({ etage, dernier, jours, enRetard }) => {
                            const failed = failedItems(dernier.items).length;
                            return (
                                <tr key={etage}>
                                    <td>{etage}</td>
                                    <td>{formatDate(dernier.le)} <small className="text-muted">({jours} j)</small></td>
                                    <td>{dernier.parNom}</td>
                                    <td>{failed ? <Badge bg="warning" text="dark">{failed} non conforme{failed > 1 ? 's' : ''}</Badge> : <Badge bg="success">Conforme</Badge>}</td>
                                    <td>{enRetard && <Badge bg="danger">À recontrôler</Badge>}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            )}
            <p className="text-muted small mt-3 mb-0">
                Le Titre II du Code du Feu (art. 200 à 208) s'applique à tout établissement, public compris : l'exemption de l'article 401 ne vise que le Titre IV (formation et certificat de sécurité incendie).
            </p>
        </>
    );
};

// ───────────────────────────── Contrôles ─────────────────────────────
const Controls = ({ data, onSaved, showNotification, adminName }) => {
    const [etage, setEtage] = useState('');
    const [items, setItems] = useState(emptyItems());
    const [notes, setNotes] = useState('');
    const [createNc, setCreateNc] = useState(true);
    const [responsable, setResponsable] = useState('');
    const [echeance, setEcheance] = useState('');
    const [busy, setBusy] = useState(false);
    const failed = failedItems(items);

    const submit = async () => {
        setBusy(true);
        try {
            const { created } = await saveControl({ etage, items, notes, name: adminName, createNonConformities: createNc, responsable, echeance: dateToMs(echeance) });
            showNotification(created ? `Contrôle enregistré, ${created} non-conformité${created > 1 ? 's' : ''} ouverte${created > 1 ? 's' : ''}.` : 'Contrôle enregistré.', 'check-circle');
            setItems(emptyItems()); setNotes(''); setEtage(''); setResponsable(''); setEcheance('');
            onSaved();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally { setBusy(false); }
    };

    return (
        <>
            <div className="adm-form-grid">
                <Form.Group><Form.Label>Étage contrôlé</Form.Label><EtageInput value={etage} onChange={(e) => setEtage(e.target.value)} /></Form.Group>
            </div>
            <div className="fs-checklist">
                {CHECKLIST.map((item) => (
                    <div key={item.key} className="fs-check">
                        <div><strong>Art. {item.article}</strong> · {item.label}</div>
                        <Form.Select size="sm" value={items[item.key]} onChange={(e) => setItems((prev) => ({ ...prev, [item.key]: e.target.value }))} className={`fs-status-${items[item.key]}`}>
                            {Object.entries(ITEM_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </Form.Select>
                    </div>
                ))}
            </div>
            <Form.Group className="my-2"><Form.Label>Notes <small className="text-muted">(facultatif)</small></Form.Label><Form.Control as="textarea" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></Form.Group>
            {failed.length > 0 && (
                <Alert variant="warning" className="py-2">
                    <Form.Check type="checkbox" id="fs-create-nc" checked={createNc} onChange={(e) => setCreateNc(e.target.checked)}
                        label={`Ouvrir une non-conformité pour chacun des ${failed.length} point${failed.length > 1 ? 's' : ''} non conforme${failed.length > 1 ? 's' : ''}`} />
                    {createNc && (
                        <div className="adm-form-grid mt-2">
                            <Form.Group><Form.Label>Responsable <small className="text-muted">(facultatif)</small></Form.Label><Form.Control value={responsable} maxLength={120} onChange={(e) => setResponsable(e.target.value)} placeholder="ex. Service technique" /></Form.Group>
                            <Form.Group><Form.Label>Échéance <small className="text-muted">(facultatif)</small></Form.Label><Form.Control type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} /></Form.Group>
                        </div>
                    )}
                </Alert>
            )}
            <Button variant="primary" onClick={submit} disabled={busy || !etage.trim()}>{busy ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer le contrôle'}</Button>

            <h6 className="mt-4">Historique des contrôles</h6>
            {data.controles.length === 0 ? <p className="text-muted">Aucun contrôle.</p> : (
                <Table size="sm" className="fs-table">
                    <thead><tr><th>Date</th><th>Étage</th><th>Par</th><th>Résultat</th><th>Notes</th></tr></thead>
                    <tbody>
                        {data.controles.slice(0, 30).map((controle) => {
                            const failedCount = failedItems(controle.items).length;
                            return (
                                <tr key={controle.id}>
                                    <td>{formatDate(controle.le)}</td><td>{controle.etage}</td><td>{controle.parNom}</td>
                                    <td>{failedCount ? <Badge bg="warning" text="dark">{failedCount} non conforme{failedCount > 1 ? 's' : ''}</Badge> : <Badge bg="success">Conforme</Badge>}</td>
                                    <td className="text-muted">{controle.notes || ''}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            )}
        </>
    );
};

// ───────────────────────────── Non-conformités ─────────────────────────────
const NonConformities = ({ data, onSaved, showNotification, adminName }) => {
    const [filter, setFilter] = useState('ouverte');
    const [form, setForm] = useState({ etage: '', article: '202', description: '', responsable: '', echeance: '' });
    const [busy, setBusy] = useState(false);

    const list = data.nonConformites.filter((nc) => filter === 'all' || nc.statut === filter);
    const run = async (action, successMessage) => {
        setBusy(true);
        try { await action(); if (successMessage) showNotification(successMessage, 'check-circle'); onSaved(); } catch (error) { showNotification(error.message, 'error'); } finally { setBusy(false); }
    };

    const add = () => run(async () => {
        await addNonConformity({ ...form, echeance: dateToMs(form.echeance) }, adminName);
        setForm({ etage: '', article: '202', description: '', responsable: '', echeance: '' });
    }, 'Non-conformité ajoutée.');

    const assign = (nc) => {
        const responsable = window.prompt('Responsable de la correction :', nc.responsable || '');
        if (responsable === null) return;
        const due = window.prompt('Échéance (AAAA-MM-JJ), vide pour aucune :', msToDate(nc.echeance));
        if (due === null) return;
        if (due && Number.isNaN(new Date(due).getTime())) { showNotification('Date invalide (format AAAA-MM-JJ).', 'warning'); return; }
        run(() => assignNonConformity(nc.id, { responsable, echeance: dateToMs(due) }), 'Responsable et échéance mis à jour.');
    };
    const resolve = (nc) => {
        const note = window.prompt('Comment le problème a-t-il été corrigé ? (facultatif)', '');
        if (note === null) return;
        run(() => resolveNonConformity(nc.id, { note, name: adminName }), 'Non-conformité résolue.');
    };

    return (
        <>
            <div className="adm-form-grid">
                <Form.Group><Form.Label>Étage</Form.Label><EtageInput value={form.etage} onChange={(e) => setForm({ ...form, etage: e.target.value })} /></Form.Group>
                <Form.Group><Form.Label>Obligation concernée</Form.Label>
                    <Form.Select value={form.article} onChange={(e) => setForm({ ...form, article: e.target.value })}>{Object.entries(ARTICLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Form.Select></Form.Group>
                <Form.Group className="fs-wide"><Form.Label>Description</Form.Label><Form.Control value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="ex. Extincteur du couloir expiré" /></Form.Group>
                <Form.Group><Form.Label>Responsable <small className="text-muted">(facultatif)</small></Form.Label><Form.Control value={form.responsable} maxLength={120} onChange={(e) => setForm({ ...form, responsable: e.target.value })} /></Form.Group>
                <Form.Group><Form.Label>Échéance <small className="text-muted">(facultatif)</small></Form.Label><Form.Control type="date" value={form.echeance} onChange={(e) => setForm({ ...form, echeance: e.target.value })} /></Form.Group>
            </div>
            <Button variant="primary" onClick={add} disabled={busy || !form.etage.trim() || form.description.trim().length < 5}>Ajouter la non-conformité</Button>

            <div className="d-flex gap-2 align-items-center mt-4 mb-2">
                <h6 className="mb-0 me-2">Non-conformités</h6>
                {[['ouverte', 'Ouvertes'], ['resolue', 'Résolues'], ['all', 'Toutes']].map(([value, label]) => (
                    <Button key={value} size="sm" variant={filter === value ? 'primary' : 'outline-secondary'} onClick={() => setFilter(value)}>{label}</Button>
                ))}
            </div>
            {list.length === 0 ? <p className="text-muted">Aucune non-conformité{filter === 'ouverte' ? ' ouverte' : ''}.</p> : (
                <div className="fs-table-scroll">
                    <Table size="sm" className="fs-table">
                        <thead><tr><th>Signalée</th><th>Étage</th><th>Problème</th><th>Responsable</th><th>Échéance</th><th>État</th><th></th></tr></thead>
                        <tbody>
                            {list.map((nc) => (
                                <tr key={nc.id} className={isOverdue(nc) ? 'fs-overdue' : ''}>
                                    <td>{formatDate(nc.creeLe)}<small className="d-block text-muted">{nc.creePar?.nom}{nc.source === 'signalement' ? ' · signalement' : ''}</small></td>
                                    <td>{nc.etage}</td>
                                    <td>{nc.description}<small className="d-block text-muted">{ARTICLES[nc.article] || nc.article}</small>{nc.resolutionNote && <small className="d-block text-success">{nc.resolutionNote}</small>}</td>
                                    <td>{nc.responsable || <span className="text-muted">—</span>}</td>
                                    <td>{nc.echeance ? formatDate(nc.echeance) : <span className="text-muted">—</span>}{isOverdue(nc) && <Badge bg="danger" className="ms-1">Dépassée</Badge>}</td>
                                    <td><Badge bg={nc.statut === 'ouverte' ? 'warning' : 'success'} text={nc.statut === 'ouverte' ? 'dark' : undefined}>{NC_STATUS[nc.statut]}</Badge></td>
                                    <td className="text-nowrap">
                                        {nc.statut === 'ouverte' ? (
                                            <>
                                                <Button size="sm" variant="outline-secondary" className="me-1" disabled={busy} onClick={() => assign(nc)} title="Responsable et échéance"><i className="fas fa-user-clock"></i></Button>
                                                <Button size="sm" variant="outline-success" disabled={busy} onClick={() => resolve(nc)} title="Marquer comme résolue"><i className="fas fa-check"></i></Button>
                                            </>
                                        ) : (
                                            <Button size="sm" variant="outline-warning" disabled={busy} onClick={() => run(() => reopenNonConformity(nc.id), 'Non-conformité rouverte.')} title="Rouvrir"><i className="fas fa-rotate-left"></i></Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}
        </>
    );
};

// ───────────────────────────── Exercices ─────────────────────────────
const Drills = ({ data, onSaved, showNotification, adminName }) => {
    const [form, setForm] = useState({ etage: '', participants: '', duree: '', observations: '' });
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        setBusy(true);
        try {
            await saveDrill({ ...form, name: adminName });
            showNotification("Exercice d'évacuation enregistré.", 'check-circle');
            setForm({ etage: '', participants: '', duree: '', observations: '' });
            onSaved();
        } catch (error) { showNotification(error.message, 'error'); } finally { setBusy(false); }
    };
    return (
        <>
            <div className="adm-form-grid">
                <Form.Group><Form.Label>Zone <small className="text-muted">(vide = tout le bâtiment)</small></Form.Label><EtageInput value={form.etage} onChange={(e) => setForm({ ...form, etage: e.target.value })} /></Form.Group>
                <Form.Group><Form.Label>Participants</Form.Label><Form.Control inputMode="numeric" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value.replace(/\D/g, '') })} /></Form.Group>
                <Form.Group><Form.Label>Durée d'évacuation (minutes)</Form.Label><Form.Control inputMode="numeric" value={form.duree} onChange={(e) => setForm({ ...form, duree: e.target.value.replace(/\D/g, '') })} /></Form.Group>
                <Form.Group className="fs-wide"><Form.Label>Observations <small className="text-muted">(facultatif)</small></Form.Label><Form.Control as="textarea" rows={2} maxLength={500} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} /></Form.Group>
            </div>
            <Button variant="primary" onClick={submit} disabled={busy || !form.participants || !form.duree}>Enregistrer l'exercice</Button>
            <h6 className="mt-4">Exercices réalisés</h6>
            {data.exercices.length === 0 ? <p className="text-muted">Aucun exercice enregistré.</p> : (
                <Table size="sm" className="fs-table">
                    <thead><tr><th>Date</th><th>Zone</th><th>Participants</th><th>Durée</th><th>Observations</th></tr></thead>
                    <tbody>{data.exercices.map((e) => <tr key={e.id}><td>{formatDate(e.le)}</td><td>{e.etage}</td><td>{e.participants}</td><td>{e.duree} min</td><td className="text-muted">{e.observations || ''}</td></tr>)}</tbody>
                </Table>
            )}
        </>
    );
};

// ───────────────────────────── Section ─────────────────────────────
const FireSafetyManager = ({ showNotification, adminName }) => {
    const [tab, setTab] = useState('apercu');
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try { setData(await loadFireSafety()); setError(''); } catch (err) { console.error(err); setError('Impossible de charger le registre.'); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const sums = data ? summary(data) : null;
    const alerts = sums ? sums.enRetard + sums.controlesEnRetard : 0;

    return (
        <div className="adm-card">
            <div className="adm-card-head">
                <div>
                    <h4><i className="fas fa-fire-extinguisher"></i> Sécurité incendie {alerts > 0 && <Badge bg="danger" className="ms-2">{alerts}</Badge>}</h4>
                    <p>Registre des contrôles, des non-conformités et des exercices d'évacuation (Code du Feu, Titre II).</p>
                </div>
            </div>
            <div className="adm-card-body">
                <ul className="nav nav-tabs mb-3">
                    {TABS.map((t) => (
                        <li className="nav-item" key={t.key}>
                            <button type="button" className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}><i className={`fas ${t.icon} me-1`}></i>{t.label}</button>
                        </li>
                    ))}
                </ul>
                {error && <Alert variant="danger" className="py-2">{error}</Alert>}
                {!data && !error && <Spinner animation="border" size="sm" />}
                {data && tab === 'apercu' && <Overview data={data} />}
                {data && tab === 'controles' && <Controls data={data} onSaved={load} showNotification={showNotification} adminName={adminName} />}
                {data && tab === 'nonconformites' && <NonConformities data={data} onSaved={load} showNotification={showNotification} adminName={adminName} />}
                {data && tab === 'exercices' && <Drills data={data} onSaved={load} showNotification={showNotification} adminName={adminName} />}
            </div>
        </div>
    );
};

export default FireSafetyManager;
