// src/components/Admin/TransparencyManager.js
//
// Panneau admin → « Transparence » : tout ce que l'établissement publie sur sa page publique « Transparence » (#/transparence), comme un établissement
// public doit le faire (Code du Gouvernement, art. 326 et 327) :
//   • Direction & contact : nom de la personne qui dirige l'établissement et moyen de la joindre ;
//   • Grille salariale   : le salaire de chaque échelon de chaque grade (ils alimentent aussi le champ « échelon » des contrats) ;
//   • Comptes            : recettes et dépenses de chaque trimestre. Seuls les comptes PUBLIÉS sont enregistrés ; un brouillon reste dans ce navigateur.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { ROLES, STAFF_FAMILIES } from '../../constants/ranks';
import {
    loadSalaryGrid, saveSalaryGrid, gradeKeyOf, formatAmount, DEFAULT_UNIT, emptyGrid,
} from '../../utils/salaryGrid';
import {
    loadTransparency, saveDirection, publishAccounts, unpublishAccounts, suggestQuarterRevenue, quarterKey, quarterLabel, currentQuarterKey, parseQuarterKey,
    isQuarterOver, totals, formatMoney, LINE_TYPES,
} from '../../utils/transparency';
import '../Transparency/Transparency.css';

const TABS = [
    { key: 'direction', label: 'Direction & contact', icon: 'fa-id-badge' },
    { key: 'grille', label: 'Grille salariale', icon: 'fa-money-bill-wave' },
    { key: 'comptes', label: 'Comptes trimestriels', icon: 'fa-file-invoice-dollar' },
];

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleString('fr-FR') : '—');

// ───────────────────────────── Direction & contact ─────────────────────────────
const DirectionTab = ({ data, onSaved, showNotification, onLogAction }) => {
    const [form, setForm] = useState({ nom: '', fonction: '', contact: '', contactDemandes: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm({ nom: data.direction.nom, fonction: data.direction.fonction, contact: data.direction.contact, contactDemandes: data.contactDemandes });
    }, [data]);

    const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

    const save = async () => {
        setSaving(true);
        try {
            await saveDirection(form);
            showNotification('Direction et contact publiés.', 'check-circle');
            if (onLogAction) onLogAction('Page Transparence : direction et contact modifiés', `Direction : ${form.nom || '—'}`);
            onSaved();
        } catch (error) {
            showNotification(`Enregistrement impossible : ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <p className="text-muted">
                Un établissement public publie sur son site le nom de la personne qui le dirige et un moyen de la contacter (Code du Gouvernement, art. 326).
            </p>
            <div className="adm-form-grid">
                <div className="form-group"><label>Nom de la personne qui dirige l'établissement</label><Form.Control value={form.nom} onChange={set('nom')} placeholder="ex. Dr Jane Doe" /></div>
                <div className="form-group"><label>Fonction</label><Form.Control value={form.fonction} onChange={set('fonction')} placeholder="ex. Directrice du Pillbox Hill Medical Center" /></div>
                <div className="form-group"><label>Moyen de la contacter</label><Form.Control value={form.contact} onChange={set('contact')} placeholder="ex. info@phmc.health · MP forum PHMC · standard : 50056" /></div>
                <div className="form-group"><label>Où adresser une demande d'accès aux informations <small className="text-muted">(facultatif)</small></label>
                    <Form.Control as="textarea" rows={2} value={form.contactDemandes} onChange={set('contactDemandes')}
                        placeholder="ex. Écrivez à la Direction : une réponse est apportée sous 7 jours (Code du Gouvernement, art. 328)." /></div>
            </div>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer et publier'}</Button>
        </>
    );
};

// ───────────────────────────── Grille salariale ─────────────────────────────
const GrilleTab = ({ showNotification, onLogAction, adminName }) => {
    const [grid, setGrid] = useState(null);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const load = useCallback(async () => { setGrid(await loadSalaryGrid()); setDirty(false); }, []);
    useEffect(() => { load(); }, [load]);

    const groups = useMemo(() => Object.values(STAFF_FAMILIES).map((family) => ({
        family,
        roles: ROLES.filter((role) => role.pole === family.key),
    })), []);

    const update = (updater) => { setGrid((prev) => updater(prev || emptyGrid())); setDirty(true); };

    const echelonsOf = (role) => grid?.grades?.[gradeKeyOf(role.value)]?.echelons || [];

    const setEchelons = (role, echelons) => update((prev) => {
        const grades = { ...prev.grades };
        const key = gradeKeyOf(role.value);
        if (echelons.length === 0) delete grades[key]; else grades[key] = { grade: role.value, echelons };
        return { ...prev, grades };
    });

    const addEchelon = (role) => {
        const current = echelonsOf(role);
        setEchelons(role, [...current, { libelle: `Échelon ${current.length + 1}`, montant: '' }]);
    };
    const changeEchelon = (role, index, field, value) => setEchelons(role, echelonsOf(role).map((e, i) => (i === index ? { ...e, [field]: value } : e)));
    const removeEchelon = (role, index) => setEchelons(role, echelonsOf(role).filter((e, i) => i !== index));

    const save = async () => {
        setSaving(true);
        try {
            const saved = await saveSalaryGrid(grid, adminName);
            setGrid(saved);
            setDirty(false);
            const gradeCount = Object.keys(saved.grades).length;
            showNotification(`Grille publiée (${gradeCount} grade${gradeCount > 1 ? 's' : ''}).`, 'check-circle');
            if (onLogAction) onLogAction('Grille salariale publiée', `${gradeCount} grade(s) · unité : ${saved.unite}`);
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!grid) return <Spinner animation="border" size="sm" />;
    const publishedCount = Object.keys(grid.grades).length;

    return (
        <>
            <p className="text-muted">
                Le salaire de chaque échelon est <strong>public</strong> (Code du Gouvernement, art. 326) et fait foi dans les contrats : le champ « échelon » d'un contrat
                propose ceux du grade choisi et préremplit la rémunération. Un grade sans échelon n'apparaît pas sur la page publique.
            </p>
            <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
                <Form.Group style={{ maxWidth: 260 }}>
                    <Form.Label>Unité affichée après le montant</Form.Label>
                    <Form.Control value={grid.unite} onChange={(e) => update((prev) => ({ ...prev, unite: e.target.value }))} placeholder={DEFAULT_UNIT} />
                    <Form.Text className="text-muted">Rendu : « {formatAmount(85, grid.unite)} ».</Form.Text>
                </Form.Group>
                <div className="text-muted small">
                    {publishedCount} grade{publishedCount > 1 ? 's' : ''} avec échelons · dernière publication : {formatDate(grid.majLe)}{grid.majPar ? ` par ${grid.majPar}` : ''}
                </div>
            </div>

            {groups.map(({ family, roles }) => (
                <div className="adm-fieldset mb-3" key={family.key}>
                    <div className="adm-fieldset-title">{family.label}</div>
                    {roles.map((role) => {
                        const echelons = echelonsOf(role);
                        return (
                            <div key={role.value} className="tm-grade">
                                <div className="tm-grade-head">
                                    <strong>{role.value}</strong>
                                    <Button size="sm" variant="outline-secondary" onClick={() => addEchelon(role)}><i className="fas fa-plus me-1"></i>Échelon</Button>
                                </div>
                                {echelons.map((e, index) => (
                                    <div key={index} className="tm-echelon">
                                        <Form.Control size="sm" value={e.libelle} onChange={(ev) => changeEchelon(role, index, 'libelle', ev.target.value)} aria-label="Nom de l'échelon" />
                                        <Form.Control size="sm" inputMode="decimal" value={e.montant} placeholder="Montant ($)" onChange={(ev) => changeEchelon(role, index, 'montant', ev.target.value.replace(/[^\d.,]/g, ''))} aria-label="Montant" />
                                        <Button size="sm" variant="outline-danger" onClick={() => removeEchelon(role, index)} title="Retirer cet échelon"><i className="fas fa-times"></i></Button>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            ))}

            <div className="d-flex gap-2 align-items-center">
                <Button variant="primary" onClick={save} disabled={saving || !dirty}>{saving ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer et publier la grille'}</Button>
                {dirty && <small className="text-warning">Modifications non publiées.</small>}
            </div>
        </>
    );
};

// ───────────────────────────── Comptes trimestriels ─────────────────────────────
const DRAFT_KEY = (key) => `transparenceBrouillon_${key}`;

const readDraft = (key) => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY(key)) || 'null'); } catch (error) { return null; }
};
const writeDraft = (key, value) => {
    try { localStorage.setItem(DRAFT_KEY(key), JSON.stringify(value)); } catch (error) { /* stockage indisponible : le brouillon n'est pas gardé */ }
};
const clearDraft = (key) => {
    try { localStorage.removeItem(DRAFT_KEY(key)); } catch (error) { /* rien à faire */ }
};

const ComptesTab = ({ data, onSaved, showNotification, onLogAction, adminName }) => {
    const nowYear = new Date().getFullYear();
    // Par défaut, le dernier trimestre TERMINÉ (au 1er trimestre : le 4e de l'année précédente).
    const [previous] = useState(() => {
        const current = parseQuarterKey(currentQuarterKey());
        return current.quarter === 1 ? { year: current.year - 1, quarter: 4 } : { year: current.year, quarter: current.quarter - 1 };
    });
    const [year, setYear] = useState(previous.year);
    const [quarter, setQuarter] = useState(previous.quarter);
    const key = quarterKey(year, quarter);
    const published = data.comptes[key] || null;
    const [lignes, setLignes] = useState([]);
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);

    // Le brouillon du navigateur prime sur la version publiée.
    useEffect(() => {
        const draft = readDraft(key);
        if (draft) { setLignes(draft.lignes || []); setNotes(draft.notes || ''); setHasDraft(true); }
        else { setLignes((published?.lignes || []).map((l) => ({ ...l, montant: String(l.montant) }))); setNotes(published?.notes || ''); setHasDraft(false); }
    }, [key, published]);

    const touch = (nextLignes, nextNotes) => {
        setLignes(nextLignes); setNotes(nextNotes);
        writeDraft(key, { lignes: nextLignes, notes: nextNotes });
        setHasDraft(true);
    };

    const sums = totals(lignes);

    const addLine = (type) => touch([...lignes, { type, libelle: '', montant: '' }], notes);
    const changeLine = (index, field, value) => touch(lignes.map((l, i) => (i === index ? { ...l, [field]: value } : l)), notes);
    const removeLine = (index) => touch(lignes.filter((l, i) => i !== index), notes);

    const prefill = async () => {
        setBusy(true);
        try {
            const { montant, count } = await suggestQuarterRevenue(key);
            if (count === 0) { showNotification('Aucune facture payée sur ce trimestre.', 'info'); return; }
            touch([...lignes.filter((l) => !l.libelle.startsWith('Dossiers médicaux payés')), { type: 'recette', libelle: `Dossiers médicaux payés par les patients (${count} facture${count > 1 ? 's' : ''})`, montant: String(montant) }], notes);
            showNotification(`Recettes des factures payées ajoutées : ${formatMoney(montant)} (${count}).`, 'check-circle');
        } catch (error) {
            showNotification(`Calcul impossible : ${error.message}`, 'error');
        } finally { setBusy(false); }
    };

    const publish = async () => {
        if (!isQuarterOver(key) && !window.confirm(`Le ${quarterLabel(key)} n'est pas terminé. Publier quand même des comptes provisoires ?`)) return;
        setBusy(true);
        try {
            await publishAccounts(key, { lignes, notes }, adminName);
            clearDraft(key);
            setHasDraft(false);
            showNotification(`Comptes du ${quarterLabel(key)} publiés.`, 'check-circle');
            if (onLogAction) onLogAction('Comptes trimestriels publiés', `${quarterLabel(key)} · recettes ${formatMoney(sums.recettes)} · dépenses ${formatMoney(sums.depenses)}`);
            onSaved();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally { setBusy(false); }
    };

    const unpublish = async () => {
        if (!window.confirm(`Retirer les comptes du ${quarterLabel(key)} de la page publique ?`)) return;
        setBusy(true);
        try {
            await unpublishAccounts(key);
            showNotification('Comptes retirés de la page publique.', 'info');
            if (onLogAction) onLogAction('Comptes trimestriels retirés', quarterLabel(key));
            onSaved();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally { setBusy(false); }
    };

    const discardDraft = () => { clearDraft(key); setHasDraft(false); setLignes((published?.lignes || []).map((l) => ({ ...l, montant: String(l.montant) }))); setNotes(published?.notes || ''); };

    const publishedKeys = Object.keys(data.comptes).sort().reverse();

    return (
        <>
            <p className="text-muted">
                Un établissement public publie les éléments de sa comptabilité à la fin de chaque trimestre (Code du Gouvernement, art. 327). Les lignes liées à une enquête
                pénale peuvent être anonymisées (regroupez-les sous un libellé générique comme « Dépenses d'enquête »). Le brouillon reste dans votre navigateur tant que vous ne publiez pas.
            </p>
            <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
                <Form.Group><Form.Label>Année</Form.Label>
                    <Form.Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                        {[...new Set([nowYear + 1, nowYear, nowYear - 1, nowYear - 2, year])].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
                    </Form.Select></Form.Group>
                <Form.Group><Form.Label>Trimestre</Form.Label>
                    <Form.Select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
                        {[1, 2, 3, 4].map((q) => <option key={q} value={q}>T{q}</option>)}
                    </Form.Select></Form.Group>
                <div className="pb-2">
                    {published ? <Badge bg="success">Publié le {formatDate(published.publieLe)}</Badge> : <Badge bg="secondary">Non publié</Badge>}
                    {hasDraft && <Badge bg="warning" text="dark" className="ms-1">Brouillon non publié</Badge>}
                </div>
            </div>
            {publishedKeys.length > 0 && <small className="text-muted d-block mb-2">Déjà publiés : {publishedKeys.map(quarterLabel).join(' · ')}.</small>}

            <div className="tm-lines">
                {lignes.length === 0 && <p className="text-muted">Aucune ligne. Ajoutez des recettes et des dépenses, ou préremplissez les recettes avec les factures payées.</p>}
                {lignes.map((line, index) => (
                    <div key={index} className="tm-line">
                        <Form.Select size="sm" value={line.type} onChange={(e) => changeLine(index, 'type', e.target.value)} style={{ maxWidth: 120 }}>
                            {Object.entries(LINE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </Form.Select>
                        <Form.Control size="sm" value={line.libelle} placeholder="Libellé (ex. Salaires du personnel soignant)" onChange={(e) => changeLine(index, 'libelle', e.target.value)} />
                        <Form.Control size="sm" style={{ maxWidth: 150 }} inputMode="decimal" value={line.montant} placeholder="Montant ($)" onChange={(e) => changeLine(index, 'montant', e.target.value.replace(/[^\d.,]/g, ''))} />
                        <Button size="sm" variant="outline-danger" onClick={() => removeLine(index)}><i className="fas fa-times"></i></Button>
                    </div>
                ))}
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
                <Button size="sm" variant="outline-success" onClick={() => addLine('recette')}><i className="fas fa-plus me-1"></i>Recette</Button>
                <Button size="sm" variant="outline-warning" onClick={() => addLine('depense')}><i className="fas fa-plus me-1"></i>Dépense</Button>
                <Button size="sm" variant="outline-info" onClick={prefill} disabled={busy} title="Additionne les factures de dossiers médicaux payées pendant ce trimestre">
                    <i className="fas fa-wand-magic-sparkles me-1"></i>Préremplir les recettes (factures payées)
                </Button>
            </div>

            <div className="tm-totals">
                <span>Recettes : <strong>{formatMoney(sums.recettes)}</strong></span>
                <span>Dépenses : <strong>{formatMoney(sums.depenses)}</strong></span>
                <span>Solde : <strong className={sums.solde < 0 ? 'text-danger' : 'text-success'}>{formatMoney(sums.solde)}</strong></span>
            </div>

            <Form.Group className="mb-3">
                <Form.Label>Notes <small className="text-muted">(facultatif, publiées avec les comptes)</small></Form.Label>
                <Form.Control as="textarea" rows={2} value={notes} onChange={(e) => touch(lignes, e.target.value)} placeholder="ex. Les dépenses liées à une enquête pénale sont regroupées sous « Dépenses d'enquête »." />
            </Form.Group>

            {!isQuarterOver(key) && <Alert variant="info" className="py-2 small">Ce trimestre n'est pas terminé : les comptes se publient en principe à sa fin.</Alert>}

            <div className="d-flex flex-wrap gap-2">
                <Button variant="primary" onClick={publish} disabled={busy || lignes.length === 0}>{busy ? <Spinner as="span" animation="border" size="sm" /> : (published ? 'Mettre à jour la publication' : 'Publier les comptes')}</Button>
                {hasDraft && <Button variant="outline-secondary" onClick={discardDraft} disabled={busy}>Abandonner le brouillon</Button>}
                {published && <Button variant="outline-danger" onClick={unpublish} disabled={busy}>Retirer de la page publique</Button>}
            </div>
        </>
    );
};

// ───────────────────────────── Section ─────────────────────────────
const TransparencyManager = ({ showNotification, onLogAction, adminName }) => {
    const [tab, setTab] = useState('direction');
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try { setData(await loadTransparency()); setError(''); } catch (err) { console.error(err); setError('Impossible de charger la page Transparence.'); }
    }, []);
    useEffect(() => { load(); }, [load]);

    return (
        <div className="adm-card">
            <div className="adm-card-head">
                <div>
                    <h4><i className="fas fa-scale-balanced"></i> Transparence</h4>
                    <p>Ce que l'établissement publie sur sa page publique : direction, grille des rémunérations et comptes trimestriels.</p>
                </div>
                <a className="btn btn-sm btn-outline-info" href="#/transparence" target="_blank" rel="noopener noreferrer"><i className="fas fa-arrow-up-right-from-square me-1"></i>Voir la page publique</a>
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
                {data && tab === 'direction' && <DirectionTab data={data} onSaved={load} showNotification={showNotification} onLogAction={onLogAction} />}
                {data && tab === 'grille' && <GrilleTab showNotification={showNotification} onLogAction={onLogAction} adminName={adminName} />}
                {data && tab === 'comptes' && <ComptesTab data={data} onSaved={load} showNotification={showNotification} onLogAction={onLogAction} adminName={adminName} />}
            </div>
        </div>
    );
};

export default TransparencyManager;
