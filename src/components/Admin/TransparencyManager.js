// src/components/Admin/TransparencyManager.js
//
// Boîte à outils → Comptabilité → « Transparence » (admins, Directrice, Assistante de Direction) : tout ce que l'établissement publie sur sa page publique « Transparence » (#/transparence), comme un établissement
// public doit le faire (Code du Gouvernement, art. 326 et 327) :
//   • Direction & contact : nom de la personne qui dirige l'établissement et moyen de la joindre ;
//   • Grille salariale   : le salaire de chaque échelon de chaque grade (ils alimentent aussi le champ « échelon » des contrats) ;
//   • Comptes            : recettes et dépenses de chaque trimestre. Seuls les comptes PUBLIÉS sont enregistrés ; un brouillon reste dans ce navigateur.
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, DropdownButton, Dropdown, Form, InputGroup, Spinner } from 'react-bootstrap';
import { ROLES, STAFF_FAMILIES } from '../../constants/ranks';
import {
    loadSalaryGrid, saveSalaryGrid, gradeKeyOf, formatAmount, DEFAULT_UNIT, emptyGrid,
} from '../../utils/salaryGrid';
import {
    loadTransparency, saveDirection, publishAccounts, unpublishAccounts, suggestQuarterRevenue, quarterKey, quarterLabel, currentQuarterKey, parseQuarterKey,
    isQuarterOver, totals, formatMoney, LINE_TYPES, labelSuggestionsFor, loadDraft, saveDraft, deleteDraft, MAX_DRAFT_LINES, quarterSchedule, MAX_MEMBERS, previousQuarterKey,
    ENTITIES, MAIN_ENTITY, entityOf, entityStartLabel, entityStartYear, firstQuarterOf, isBeforeOpening, draftKeyOf,
} from '../../utils/transparency';
import { loadStaffMembers } from '../../utils/staffAdmin';
import { getEmployeeFullName } from '../../utils/employeeName';
import '../Transparency/Transparency.css';

const TABS = [
    { key: 'direction', label: 'Direction & contact', icon: 'fa-id-badge' },
    { key: 'grille', label: 'Grille salariale', icon: 'fa-money-bill-wave' },
    { key: 'comptes', label: 'Comptes trimestriels', icon: 'fa-file-invoice-dollar' },
];

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleString('fr-FR') : '—');

// ───────────────────────────── Direction & contact ─────────────────────────────
// Les têtes logiques d'une page de transparence, tirées des fiches du personnel (rôle principal ou cumulé) : la direction, son assistance,
// les chefs de service et le recrutement.
const LEADERSHIP_GROUPS = [
    { key: 'direction', label: 'Direction', roles: ['Directeur(trice)'] },
    { key: 'assistance', label: 'Assistance de direction', roles: ['Assistant(e) de Direction'] },
    { key: 'chefs', label: 'Chefs de service', roles: ['Chef de Service'] },
    { key: 'recrutement', label: 'Recrutement', roles: ['Chargé(e) de Recrutement'] },
];
// Proposées d'office quand rien n'est encore publié.
const DEFAULT_GROUPS = ['direction', 'assistance'];

const contactOf = (member) => [member.email, member.phNumber ? `tél. ${member.phNumber}` : ''].filter(Boolean).join(' · ');
const functionOf = (member, role) => (role === 'Chef de Service' && member.serviceDirige ? `Chef(fe) de service — ${member.serviceDirige}` : role);
const lineOf = (entry) => ({ nom: entry.name, fonction: functionOf(entry.member, entry.role), contact: contactOf(entry.member) });
const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

const DirectionTab = ({ data, onSaved, showNotification, onLogAction }) => {
    const [lines, setLines] = useState([]);
    const [contactDemandes, setContactDemandes] = useState('');
    const [saving, setSaving] = useState(false);
    const [leaders, setLeaders] = useState([]);
    const [prefilled, setPrefilled] = useState(false);

    useEffect(() => {
        setLines(data.membres.map((member) => ({ ...member })));
        setContactDemandes(data.contactDemandes);
        setPrefilled(false);
    }, [data]);

    useEffect(() => {
        let cancelled = false;
        loadStaffMembers().then((members) => {
            if (cancelled) return;
            const entries = [];
            members.forEach((member) => {
                const roles = [member.rank || member.category, ...(member.extraRanks || [])];
                LEADERSHIP_GROUPS.forEach((group) => {
                    const role = roles.find((value) => group.roles.includes(value));
                    if (role) entries.push({ group: group.key, member, role, name: getEmployeeFullName(member) });
                });
            });
            setLeaders(entries);
            // Rien n'est encore publié : on propose la direction et son assistance (non enregistrées tant qu'on ne publie pas).
            if (data.membres.length === 0) {
                const proposed = entries.filter((entry) => DEFAULT_GROUPS.includes(entry.group));
                if (proposed.length > 0) {
                    setLines(proposed.map(lineOf));
                    setPrefilled(true);
                }
            }
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [data.membres.length]);

    const isListed = (entry) => lines.some((line) => sameName(line.nom, entry.name));
    const addLeader = (entry) => {
        if (isListed(entry)) return;
        if (lines.length >= MAX_MEMBERS) { showNotification(`Au plus ${MAX_MEMBERS} lignes sur la page publique.`, 'warning'); return; }
        setLines((prev) => [...prev, lineOf(entry)]);
        setPrefilled(true);
    };
    const removeLeader = (entry) => setLines((prev) => prev.filter((line) => !sameName(line.nom, entry.name)));

    const addBlank = () => setLines((prev) => (prev.length >= MAX_MEMBERS ? prev : [...prev, { nom: '', fonction: '', contact: '' }]));
    const removeLine = (index) => setLines((prev) => prev.filter((line, i) => i !== index));
    const changeLine = (index, field, value) => setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
    const moveLine = (index, delta) => setLines((prev) => {
        const target = index + delta;
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
    });

    const save = async () => {
        setSaving(true);
        try {
            await saveDirection({ membres: lines, contactDemandes });
            showNotification('Direction et contact publiés.', 'check-circle');
            if (onLogAction) onLogAction('Page Transparence : direction et contact modifiés', lines.filter((line) => line.nom).map((line) => `${line.nom} (${line.fonction || '—'})`).join(', ') || 'Aucune ligne');
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
                Vous pouvez aussi publier d'autres lignes (assistance de direction, chefs de service…) : la première est la personne qui dirige.
            </p>
            {prefilled && <Alert variant="info" className="py-2 small">Lignes remplies d'après les fiches du personnel : vérifiez-les, puis publiez.</Alert>}

            <div className="tm-members">
                {lines.length === 0 && <p className="text-muted small mb-2">Aucune ligne. Ajoutez une personne depuis la liste ci-dessous ou une ligne vide.</p>}
                {lines.map((line, index) => (
                    <div className="tm-member" key={index}>
                        <div className="tm-member-head">
                            <span className="tm-member-rank">{index === 0 ? 'Direction' : `Ligne ${index + 1}`}</span>
                            <div className="tm-member-tools">
                                <Button size="sm" variant="outline-secondary" disabled={index === 0} onClick={() => moveLine(index, -1)} title="Monter"><i className="fas fa-arrow-up"></i></Button>
                                <Button size="sm" variant="outline-secondary" disabled={index === lines.length - 1} onClick={() => moveLine(index, 1)} title="Descendre"><i className="fas fa-arrow-down"></i></Button>
                                <Button size="sm" variant="outline-danger" onClick={() => removeLine(index)} title="Retirer cette ligne"><i className="fas fa-trash"></i></Button>
                            </div>
                        </div>
                        <div className="adm-form-grid">
                            <div className="form-group"><label>Nom</label><Form.Control value={line.nom} onChange={(e) => changeLine(index, 'nom', e.target.value)} placeholder="ex. Dr Jane Doe" /></div>
                            <div className="form-group"><label>Fonction</label><Form.Control value={line.fonction} onChange={(e) => changeLine(index, 'fonction', e.target.value)} placeholder="ex. Directrice du Pillbox Hill Medical Center" /></div>
                            <div className="form-group"><label>Moyen de la contacter</label><Form.Control value={line.contact} onChange={(e) => changeLine(index, 'contact', e.target.value)} placeholder="ex. info@phmc.health · tél. 50056" /></div>
                        </div>
                    </div>
                ))}
                <Button size="sm" variant="outline-primary" onClick={addBlank} disabled={lines.length >= MAX_MEMBERS}><i className="fas fa-plus me-1"></i>Ajouter une ligne vide</Button>
            </div>

            <div className="form-group tm-wide-field">
                <label>Où adresser une demande d'accès aux informations <small className="text-muted">(facultatif)</small></label>
                <Form.Control as="textarea" rows={3} value={contactDemandes} onChange={(e) => setContactDemandes(e.target.value)}
                    placeholder="ex. Écrivez à la Direction : une réponse est apportée sous 7 jours (Code du Gouvernement, art. 328)." />
            </div>

            <Button variant="primary" onClick={save} disabled={saving}>{saving ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer et publier'}</Button>

            <h6 className="mt-4">Équipe de direction (d'après les fiches du personnel)</h6>
            <p className="text-muted small mb-2">Noms et contacts tirés des grades. « Ajouter » place la personne sur la page publique (vous pouvez ensuite retoucher sa ligne ci-dessus).</p>
            {leaders.length === 0 ? <p className="text-muted small">Aucune fiche avec un grade de direction, d'assistance, de chef de service ou de recrutement.</p> : (
                LEADERSHIP_GROUPS.map((group) => {
                    const entries = leaders.filter((entry) => entry.group === group.key);
                    if (entries.length === 0) return null;
                    return (
                        <div className="adm-fieldset mb-2" key={group.key}>
                            <div className="adm-fieldset-title">{group.label}</div>
                            {entries.map((entry) => {
                                const listed = isListed(entry);
                                return (
                                    <div key={`${entry.member.service}-${entry.member.storageKey}`} className="d-flex flex-wrap align-items-center gap-2 py-1">
                                        <div style={{ flex: '1 1 260px' }}>
                                            <strong>{entry.name}</strong> <span className="text-muted">— {functionOf(entry.member, entry.role)}</span>
                                            <small className="d-block text-muted">{contactOf(entry.member) || 'Aucun contact renseigné'}</small>
                                        </div>
                                        {listed
                                            ? <Button size="sm" variant="outline-secondary" onClick={() => removeLeader(entry)}><i className="fas fa-check me-1"></i>Sur la page · Retirer</Button>
                                            : <Button size="sm" variant="outline-primary" onClick={() => addLeader(entry)}><i className="fas fa-plus me-1"></i>Ajouter à la page</Button>}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })
            )}
        </>
    );
};

// ───────────────────────────── Grille salariale ─────────────────────────────
// Grille de référence du PHMC (« Rangs et Salaires ») : sert d'aide à la saisie, à côté de l'éditeur. Les deux montants sont repris tels que fournis ;
// un clic sur l'un d'eux ajoute un échelon de ce montant au(x) grade(s) correspondant(s).
const REFERENCE_GRID = [
    { rang: 15, label: 'Directrice', grades: ['Directeur(trice)'], montants: [4500, 90000] },
    { rang: 14, label: 'Assistante de Direction', grades: ['Assistant(e) de Direction'], montants: [4250, 85000] },
    { rang: 13, label: 'Chef de Service', grades: ['Chef de Service'], montants: [4000, 80000] },
    { rang: 12, label: 'Personnel Administratif', grades: ['Personnel Administratif'], montants: [3000, 60000] },
    { rang: 11, label: 'Médecin Titulaire', grades: ['Médecin Titulaire'], montants: [3750, 75000] },
    { rang: 10, label: 'Docteur Junior', grades: ['Docteur Junior'], montants: [3500, 70000] },
    { rang: 9, label: 'Interne en Médecine', grades: ['Interne en Médecine'], montants: [3000, 60000] },
    { rang: 8, label: 'Paramedic', grades: ['Paramedic'], montants: [3500, 70000] },
    { rang: 7, label: 'Infirmier en Pratique Avancée', grades: ['Infirmier(ère) en Pratique Avancée'], montants: [3500, 70000] },
    { rang: 6, label: 'Infirmier', grades: ['Infirmier(ère)'], montants: [3200, 64000] },
    { rang: 5, label: 'Technicien Ambulancier (EMT)', grades: ['Technicien(ne) Ambulancier(ère) (EMT)'], montants: [2900, 58000] },
    { rang: 4, label: 'Agent de Maîtrise', grades: ['Agent Maîtrise'], montants: [3100, 62000] },
    { rang: 3, label: 'Aide Soignant', grades: ['Aide Soignant(e)'], montants: [2700, 54000] },
    { rang: 2, label: 'Externe / Étudiant', grades: ['Externe / Étudiant(e) en Médecine', 'Externe / Étudiant(e) Infirmier(ère)', 'Externe / Étudiant(e) Paramédical(e)'], montants: [2500, 50000] },
    { rang: 1, label: 'Personnel Polyvalent', grades: ['Personnel Polyvalent'], montants: [2600, 52000] },
];
const money = (value) => `${Number(value).toLocaleString('fr-FR')} $`;

const ReferenceGrid = ({ roleByValue, hasEchelons, onAdd }) => (
    <aside className="tm-ref" aria-label="Grille de référence">
        <div className="tm-ref-title"><i className="fas fa-list-ol me-2"></i>Rangs et salaires — PHMC</div>
        <p className="tm-ref-help">Grille de référence. Cliquez un montant pour l'ajouter comme échelon au grade correspondant.</p>
        <div className="tm-ref-list">
            {REFERENCE_GRID.map((row) => {
                const done = row.grades.every((grade) => hasEchelons(roleByValue[grade]));
                return (
                    <div className={`tm-ref-row${done ? ' done' : ''}`} key={row.rang}>
                        <span className="tm-ref-rang">{row.rang}</span>
                        <span className="tm-ref-label">{row.label}{done && <i className="fas fa-check ms-1" title="Échelons déjà saisis"></i>}</span>
                        <span className="tm-ref-amounts">
                            {row.montants.map((montant, index) => (
                                <React.Fragment key={montant}>
                                    {index > 0 && <span className="tm-ref-sep">–</span>}
                                    <button type="button" className="tm-ref-amount" title={`Ajouter un échelon de ${money(montant)} à ${row.grades.length > 1 ? 'ces grades' : 'ce grade'}`}
                                        onClick={() => onAdd(row.grades.map((grade) => roleByValue[grade]).filter(Boolean), montant)}>{money(montant)}</button>
                                </React.Fragment>
                            ))}
                        </span>
                    </div>
                );
            })}
        </div>
    </aside>
);

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

    const addEchelon = (role, montant = '') => {
        const current = echelonsOf(role);
        setEchelons(role, [...current, { libelle: `Échelon ${current.length + 1}`, montant: montant === '' ? '' : String(montant) }]);
    };
    const roleByValue = useMemo(() => Object.fromEntries(ROLES.map((role) => [role.value, role])), []);
    // Ajout d'un échelon depuis la grille de référence : un seul passage d'état pour plusieurs grades (ex. les trois « Externe »).
    const addReferenceEchelon = (roles, montant) => update((prev) => {
        const grades = { ...prev.grades };
        roles.forEach((role) => {
            const key = gradeKeyOf(role.value);
            const current = grades[key]?.echelons || [];
            grades[key] = { grade: role.value, echelons: [...current, { libelle: `Échelon ${current.length + 1}`, montant: String(montant) }] };
        });
        return { ...prev, grades };
    });
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
        <div className="tm-grille-layout">
          <div className="tm-grille-main">
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
          </div>
          <ReferenceGrid roleByValue={roleByValue} hasEchelons={(role) => !!role && echelonsOf(role).length > 0} onAdd={addReferenceEchelon} />
        </div>
    );
};

// ───────────────────────────── Comptes trimestriels ─────────────────────────────
// Le brouillon vit désormais dans la base (nœud réservé aux admins). Les brouillons des versions précédentes étaient gardés dans le navigateur : on les
// reprend une fois (ils partent alors dans la base) puis on les efface.
const DRAFT_KEY = (key) => `transparenceBrouillon_${key}`;

const readLocalDraft = (key) => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY(key)) || 'null'); } catch (error) { return null; }
};
const clearLocalDraft = (key) => {
    try { localStorage.removeItem(DRAFT_KEY(key)); } catch (error) { /* rien à faire */ }
};
const SAVE_DELAY = 900;   // enregistrement du brouillon 0,9 s après la dernière frappe

// Libellé d'une ligne de comptes : on écrit directement, ou on choisit un libellé par défaut dans la liste (le choix remplit le champ, qui reste modifiable).
const LabelCombo = ({ value, options, placeholder, onChange }) => {
    const id = useId();
    return (
        <InputGroup size="sm" className="tm-label-combo">
            <Form.Control value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label="Libellé de la ligne" />
            <DropdownButton variant="outline-secondary" align="end" title={<i className="fas fa-list" aria-hidden="true"></i>} id={`tm-label-menu-${id}`}
                menuVariant="dark" popperConfig={{ strategy: 'fixed' }} aria-label="Libellés par défaut">
                <Dropdown.Header>Libellés par défaut</Dropdown.Header>
                {options.map((option) => (
                    <Dropdown.Item key={option} active={option === value} onClick={() => onChange(option)}>{option}</Dropdown.Item>
                ))}
            </DropdownButton>
        </InputGroup>
    );
};

const longDate = (date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const DAY = 24 * 60 * 60 * 1000;

// Quand publier : chaque trimestre se termine à une date fixe et ses comptes se publient dès le lendemain (art. 327 : « à la fin de chaque trimestre »).
const QuarterCalendar = ({ year, comptes, onPick, selected, entity }) => {
    const now = Date.now();
    return (
        <div className="mb-3">
            <div className="table-responsive">
                <table className="table table-sm mb-1" style={{ color: 'inherit' }}>
                    <thead><tr><th>Trimestre {year}</th><th>Période</th><th>À publier à partir du</th><th>État</th></tr></thead>
                    <tbody>
                        {quarterSchedule(year, entity).map((entry) => {
                            const published = comptes[entry.key];
                            const over = now >= entry.publishFrom.getTime();
                            const lateDays = Math.floor((now - entry.publishFrom.getTime()) / DAY);
                            let state = <Badge bg="secondary">À venir</Badge>;
                            if (published) state = <Badge bg="success">Publié le {new Date(published.publieLe).toLocaleDateString('fr-FR')}</Badge>;
                            else if (over) state = <Badge bg={lateDays > 30 ? 'danger' : 'warning'} text={lateDays > 30 ? undefined : 'dark'}>À publier{lateDays > 0 ? ` (depuis ${lateDays} j)` : ' maintenant'}</Badge>;
                            else if (now >= entry.startsOn.getTime()) state = <Badge bg="info" text="dark">En cours (fin le {longDate(entry.endsOn)})</Badge>;
                            return (
                                <tr key={entry.key} style={{ cursor: 'pointer', fontWeight: entry.quarter === selected ? 600 : 400 }} onClick={() => onPick(entry.quarter)}>
                                    <td>T{entry.quarter}</td>
                                    <td>{longDate(entry.startsOn)} → {longDate(entry.endsOn)}</td>
                                    <td>{longDate(entry.publishFrom)}</td>
                                    <td>{state}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <small className="text-muted">Le texte demande une publication « à la fin de chaque trimestre » : aucun délai supplémentaire n'est fixé, publiez donc dès la date indiquée. Cliquez une ligne pour ouvrir le trimestre.</small>
        </div>
    );
};

// Trimestre proposé par défaut : le dernier trimestre TERMINÉ (au 1er trimestre : le 4e de l'année précédente), ramené au premier trimestre de l'entité
// si celle-ci n'existait pas encore.
const defaultQuarterFor = (entityKey) => {
    const current = parseQuarterKey(currentQuarterKey());
    const last = current.quarter === 1 ? { year: current.year - 1, quarter: 4 } : { year: current.year, quarter: current.quarter - 1 };
    const first = firstQuarterOf(entityKey);
    return last.year * 4 + last.quarter < first.year * 4 + first.quarter ? first : last;
};

const ComptesTab = ({ data, onSaved, showNotification, onLogAction, adminName }) => {
    const nowYear = new Date().getFullYear();
    const [entity, setEntity] = useState(MAIN_ENTITY);          // PHMC, pharmacie du PHMC, pharmacie du Service des Urgences : trois comptes indépendants
    const [previous] = useState(() => defaultQuarterFor(MAIN_ENTITY));
    const [year, setYear] = useState(previous.year);
    const [quarter, setQuarter] = useState(previous.quarter);
    const key = quarterKey(year, quarter);
    const entityInfo = entityOf(entity);
    const accounts = data.comptesParEntite?.[entity] || {};
    const dKey = draftKeyOf(entity, key);                       // clé du brouillon : un brouillon par entité et par trimestre
    const published = accounts[key] || null;
    const [lignes, setLignes] = useState([]);
    const [notes, setNotes] = useState('');
    const [ouverture, setOuverture] = useState('');   // solde d'ouverture (texte saisi)
    const [busy, setBusy] = useState(false);

    // Brouillon persistant : enregistré dans la base (admins seulement) au fil de la saisie, partagé entre administrateurs et appareils.
    const [draftMeta, setDraftMeta] = useState(null);       // { majLe, majPar } du brouillon enregistré
    const [saveState, setSaveState] = useState('idle');     // idle | pending | saving | saved | error | conflict
    const [conflict, setConflict] = useState(null);         // version d'un autre admin, en cas de conflit
    const [loadingDraft, setLoadingDraft] = useState(true);
    const keyRef = useRef(dKey);                             // brouillon affiché (un enregistrement tardif d'un autre trimestre ou d'une autre entité ne touche pas l'écran)
    const basesRef = useRef({});                             // par brouillon : majLe du brouillon tel que cette page l'a chargé ou enregistré en dernier
    const timerRef = useRef(null);
    const pendingRef = useRef(null);                         // { key, lignes, notes, ouverture } en attente d'enregistrement
    const queueRef = useRef(Promise.resolve());              // un enregistrement à la fois (sinon le suivant se prendrait pour un conflit)

    // Enregistre ce qui attend. L'attente est prise TOUT DE SUITE (changer de trimestre ne la perd pas) ; l'écriture, elle, se met en file.
    const flush = useCallback(() => {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const pending = pendingRef.current;
        if (!pending) return queueRef.current;
        pendingRef.current = null;
        queueRef.current = queueRef.current.then(async () => {
            const onScreen = () => keyRef.current === pending.key;
            if (onScreen()) setSaveState('saving');
            try {
                const saved = await saveDraft(pending.key, pending, adminName, basesRef.current[pending.key] ?? null);
                basesRef.current[pending.key] = saved ? saved.majLe : null;
                clearLocalDraft(pending.key);
                if (onScreen()) {
                    setDraftMeta(saved ? { majLe: saved.majLe, majPar: saved.majPar } : null);
                    setSaveState(pendingRef.current ? 'pending' : 'saved');
                }
            } catch (error) {
                if (!onScreen()) { console.warn('Brouillon non enregistré :', error?.message || error); return; }
                pendingRef.current = pendingRef.current || pending;     // rien n'est perdu : la saisie reste à enregistrer
                if (error.conflict) { setConflict(error.conflict); setSaveState('conflict'); } else { console.warn('Brouillon non enregistré :', error?.message || error); setSaveState('error'); }
            }
        });
        return queueRef.current;
    }, [adminName]);

    const fromPublished = useCallback(() => {
        setLignes((published?.lignes || []).map((l) => ({ ...l, montant: String(l.montant) })));
        setNotes(published?.notes || '');
        setOuverture(published?.soldeOuverture ? String(published.soldeOuverture) : '');
    }, [published]);

    // Changement de trimestre : on enregistre d'abord ce qui attend, puis on charge le brouillon enregistré, sinon l'éventuel brouillon local d'avant, sinon le publié.
    useEffect(() => {
        let cancelled = false;
        keyRef.current = dKey;
        pendingRef.current = null;
        setLoadingDraft(true);
        setConflict(null);
        setSaveState('idle');
        setDraftMeta(null);
        // On attend la fin des enregistrements en cours (ceux du trimestre quitté) avant de lire : sinon on pourrait relire une version plus ancienne.
        queueRef.current.then(() => loadDraft(dKey)).then((remote) => {
            if (cancelled) return;
            basesRef.current[dKey] = remote ? remote.majLe : null;
            if (remote) {
                setLignes(remote.lignes); setNotes(remote.notes); setOuverture(remote.ouverture);
                setDraftMeta({ majLe: remote.majLe, majPar: remote.majPar });
                return;
            }
            const local = readLocalDraft(dKey);
            if (local) {
                const next = { key: dKey, lignes: (local.lignes || []).slice(0, MAX_DRAFT_LINES), notes: local.notes || '', ouverture: local.ouverture || '' };
                setLignes(next.lignes); setNotes(next.notes); setOuverture(next.ouverture);
                pendingRef.current = next;
                setSaveState('pending');
                timerRef.current = setTimeout(flush, 300);
                return;
            }
            fromPublished();
        }).catch((error) => {
            if (cancelled) return;
            console.warn('Brouillon illisible :', error?.message || error);
            fromPublished();
            setSaveState('error');
        }).finally(() => { if (!cancelled) setLoadingDraft(false); });
        return () => { cancelled = true; flush(); };
    }, [dKey, published, flush, fromPublished]);

    // Fermeture de l'onglet : on tente d'enregistrer ce qui attend encore.
    useEffect(() => {
        const onLeave = () => { if (pendingRef.current) flush(); };
        window.addEventListener('beforeunload', onLeave);
        return () => window.removeEventListener('beforeunload', onLeave);
    }, [flush]);

    const touch = (nextLignes, nextNotes, nextOuverture = ouverture) => {
        if (loadingDraft) return;
        const lines = nextLignes.slice(0, MAX_DRAFT_LINES);
        setLignes(lines); setNotes(nextNotes); setOuverture(nextOuverture);
        pendingRef.current = { key: dKey, lignes: lines, notes: nextNotes, ouverture: nextOuverture };
        clearTimeout(timerRef.current);
        if (saveState === 'conflict') return;                // en attente de la décision de l'admin
        setSaveState('pending');
        timerRef.current = setTimeout(flush, SAVE_DELAY);
    };
    const hasDraft = !!draftMeta || saveState === 'pending' || saveState === 'saving';

    // Conflit : reprendre la version de l'autre admin, ou garder la nôtre.
    const takeTheirs = () => {
        if (!conflict) return;
        basesRef.current[dKey] = conflict.majLe;
        pendingRef.current = null;
        setLignes(conflict.lignes); setNotes(conflict.notes); setOuverture(conflict.ouverture);
        setDraftMeta({ majLe: conflict.majLe, majPar: conflict.majPar });
        setConflict(null);
        setSaveState('saved');
    };
    const keepMine = () => {
        if (!conflict) return;
        basesRef.current[dKey] = conflict.majLe;
        setConflict(null);
        flush();
    };

    const sums = totals(lignes, ouverture);
    // Solde de clôture du trimestre précédent, s'il est publié : proposé comme solde d'ouverture de celui-ci.
    const previousKey = previousQuarterKey(key);
    const previousAccount = previousKey ? accounts[previousKey] : null;     // la clôture reportée est celle de la MÊME entité
    const previousClosing = previousAccount ? totals(previousAccount.lignes, previousAccount.soldeOuverture).cloture : null;

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
            await publishAccounts(key, { lignes, notes, soldeOuverture: ouverture }, adminName, entity);
            await dropDraft();
            showNotification(`Comptes de « ${entityInfo.label} » : ${quarterLabel(key)} publié.`, 'check-circle');
            if (onLogAction) onLogAction('Comptes trimestriels publiés', `${entityInfo.label} · ${quarterLabel(key)} · ouverture ${formatMoney(sums.ouverture)} · recettes ${formatMoney(sums.recettes)} · dépenses ${formatMoney(sums.depenses)} · clôture ${formatMoney(sums.cloture)}`);
            onSaved();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally { setBusy(false); }
    };

    const unpublish = async () => {
        if (!window.confirm(`Retirer les comptes de « ${entityInfo.label} » (${quarterLabel(key)}) de la page publique ? Les chiffres ne sont pas supprimés : ils repassent en brouillon, que vous pourrez modifier puis republier.`)) return;
        setBusy(true);
        try {
            // Les chiffres passent en brouillon AVANT d'être retirés de la page publique : si l'enregistrement du brouillon échoue, rien n'est retiré et rien ne se perd.
            pendingRef.current = { key: dKey, lignes, notes, ouverture };
            await flush();
            if (pendingRef.current) throw new Error("Le brouillon n'a pas pu être enregistré : rien n'a été retiré de la page publique.");
            await unpublishAccounts(key, entity);
            showNotification('Comptes retirés de la page publique : ils sont repassés en brouillon.', 'info');
            if (onLogAction) onLogAction('Comptes trimestriels retirés', `${entityInfo.label} · ${quarterLabel(key)}`);
            onSaved();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally { setBusy(false); }
    };

    // Le brouillon est supprimé de la base (après la fin d'un éventuel enregistrement en cours, pour ne pas le voir revenir).
    async function dropDraft() {
        pendingRef.current = null;
        clearTimeout(timerRef.current);
        await queueRef.current;
        try { await deleteDraft(dKey); } catch (error) { console.warn('Brouillon non supprimé :', error?.message || error); }
        clearLocalDraft(dKey);
        basesRef.current[dKey] = null;
        setDraftMeta(null);
        setConflict(null);
        setSaveState('idle');
    }

    const discardDraft = async () => {
        if (!window.confirm('Abandonner le brouillon ? Il sera supprimé pour tous les administrateurs.')) return;
        setBusy(true);
        try { await dropDraft(); fromPublished(); } finally { setBusy(false); }
    };

    const publishedKeys = Object.keys(accounts).sort().reverse();

    // Changer d'entité : on garde le trimestre affiché s'il existe pour elle, sinon on propose le dernier trimestre terminé (au plus tôt son premier trimestre).
    const switchEntity = (next) => {
        if (next === entity) return;
        setEntity(next);
        if (isBeforeOpening(key, next)) {
            const fallback = defaultQuarterFor(next);
            setYear(fallback.year);
            setQuarter(fallback.quarter);
        }
    };

    return (
        <>
            <ul className="nav nav-pills tm-entities" role="tablist" aria-label="Comptes de l'entité">
                {ENTITIES.map((candidate) => {
                    const count = Object.keys(data.comptesParEntite?.[candidate.key] || {}).length;
                    return (
                        <li className="nav-item" key={candidate.key}>
                            <button type="button" role="tab" aria-selected={candidate.key === entity} className={`nav-link ${candidate.key === entity ? 'active' : ''}`} onClick={() => switchEntity(candidate.key)}>
                                {candidate.label}{count > 0 && <Badge bg="success" className="ms-2">{count}</Badge>}
                            </button>
                        </li>
                    );
                })}
            </ul>
            <p className="text-muted small tm-entity-note">
                {entity === MAIN_ENTITY
                    ? "Comptes du Pillbox Hill Medical Center. Les pharmacies ont chacune les leurs (onglets voisins) : elles s'affichent à la suite sur la page publique, sans jamais être additionnées."
                    : `Comptes de « ${entityInfo.title} » : une comptabilité à part, avec son propre solde d'ouverture, ses recettes et ses dépenses (relevé bancaire de cette entité), jamais mêlée à celle du PHMC. Ses comptes commencent le ${entityStartLabel(entity)}.`}
            </p>
            <p className="text-muted">
                Un établissement public publie les éléments de sa comptabilité à la fin de chaque trimestre (Code du Gouvernement, art. 327). Les lignes liées à une enquête
                pénale peuvent être anonymisées (regroupez-les sous un libellé générique comme « Dépenses d'enquête »). Ce que vous saisissez est enregistré automatiquement comme <strong>brouillon</strong> (visible des seuls administrateurs, sur tous vos appareils) : rien n'est public tant que vous ne cliquez pas sur « Publier les comptes ».
            </p>
            <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
                <Form.Group><Form.Label>Année</Form.Label>
                    <Form.Select value={year} onChange={(e) => {
                        const nextYear = Number(e.target.value);
                        setYear(nextYear);
                        // Premier trimestre existant de l'année (la comptabilité de l'entité a un début) si le trimestre choisi n'existe pas.
                        const available = quarterSchedule(nextYear, entity).map((entry) => entry.quarter);
                        if (!available.includes(quarter)) setQuarter(available[0]);
                    }}>
                        {Array.from({ length: Math.max(nowYear + 1, year) - entityStartYear(entity) + 1 }, (_, i) => Math.max(nowYear + 1, year) - i).map((y) => <option key={y} value={y}>{y}</option>)}
                    </Form.Select></Form.Group>
                <Form.Group><Form.Label>Trimestre</Form.Label>
                    <Form.Select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
                        {quarterSchedule(year, entity).map((entry) => <option key={entry.quarter} value={entry.quarter}>T{entry.quarter}</option>)}
                    </Form.Select></Form.Group>
                <div className="pb-2">
                    {published ? <Badge bg="success">Publié le {formatDate(published.publieLe)}</Badge> : <Badge bg="secondary">Non publié</Badge>}
                    {hasDraft && <Badge bg="warning" text="dark" className="ms-1">Brouillon non publié</Badge>}
                </div>
                <div className="pb-2">
                    {loadingDraft && <span className="tm-draft-state"><Spinner as="span" animation="border" size="sm" />Chargement du brouillon…</span>}
                    {!loadingDraft && (saveState === 'pending' || saveState === 'saving') && <span className="tm-draft-state"><Spinner as="span" animation="border" size="sm" />Enregistrement du brouillon…</span>}
                    {!loadingDraft && saveState === 'saved' && draftMeta && <span className="tm-draft-state saved"><i className="fas fa-check"></i>Brouillon enregistré à {new Date(draftMeta.majLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {!loadingDraft && saveState === 'idle' && draftMeta && <span className="tm-draft-state">Brouillon de {draftMeta.majPar || 'un administrateur'}, enregistré le {formatDate(draftMeta.majLe)}</span>}
                    {!loadingDraft && saveState === 'error' && (
                        <span className="tm-draft-state error"><i className="fas fa-triangle-exclamation"></i>Brouillon non enregistré
                            <Button size="sm" variant="outline-danger" onClick={() => { setSaveState('pending'); flush(); }}>Réessayer</Button></span>
                    )}
                </div>
            </div>
            {saveState === 'conflict' && conflict && (
                <Alert variant="warning" className="py-2">
                    <strong>{conflict.majPar || 'Un autre administrateur'}</strong> a modifié ce brouillon le {formatDate(conflict.majLe)}. Vos dernières modifications ne sont pas encore enregistrées.
                    <div className="d-flex flex-wrap gap-2 mt-2">
                        <Button size="sm" variant="outline-secondary" onClick={takeTheirs}>Reprendre sa version</Button>
                        <Button size="sm" variant="warning" onClick={keepMine}>Garder la mienne (écraser la sienne)</Button>
                    </div>
                </Alert>
            )}
            <QuarterCalendar year={year} comptes={accounts} onPick={(q) => setQuarter(q)} selected={quarter} entity={entity} />
            {publishedKeys.length > 0 && <small className="text-muted d-block mb-2">Déjà publiés : {publishedKeys.map(quarterLabel).join(' · ')}.</small>}

            <fieldset className="tm-fieldset" disabled={loadingDraft}>
            <div className="tm-opening">
                <Form.Group>
                    <Form.Label>Solde d'ouverture <small className="text-muted">(solde au début du trimestre ; à renseigner au moins pour le premier, négatif possible)</small></Form.Label>
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                        <Form.Control style={{ maxWidth: 220 }} inputMode="decimal" value={ouverture} placeholder="ex. 250000"
                            onChange={(e) => touch(lignes, notes, e.target.value.replace(/[^\d.,-]/g, '').replace(/(?!^)-/g, ''))} />
                        {previousClosing !== null && (
                            <Button size="sm" variant="outline-info" onClick={() => touch(lignes, notes, String(previousClosing))} title={`Clôture du ${quarterLabel(previousKey)}`}>
                                <i className="fas fa-arrow-right-to-bracket me-1"></i>Reprendre la clôture du trimestre précédent ({formatMoney(previousClosing)})
                            </Button>
                        )}
                    </div>
                </Form.Group>
            </div>

            <div className="tm-lines">
                {lignes.length === 0 && <p className="text-muted">Aucune ligne. Ajoutez des recettes et des dépenses, ou préremplissez les recettes avec les factures payées.</p>}
                {lignes.map((line, index) => (
                    <div key={index} className="tm-line">
                        <Form.Select size="sm" value={line.type} onChange={(e) => changeLine(index, 'type', e.target.value)} style={{ maxWidth: 120 }}>
                            {Object.entries(LINE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </Form.Select>
                        <LabelCombo value={line.libelle} options={labelSuggestionsFor(entity, line.type)} placeholder="Libellé : choisir dans la liste ou écrire" onChange={(next) => changeLine(index, 'libelle', next)} />
                        <Form.Control size="sm" style={{ maxWidth: 150 }} inputMode="decimal" value={line.montant} placeholder="Montant ($)" onChange={(e) => changeLine(index, 'montant', e.target.value.replace(/[^\d.,]/g, ''))} />
                        <Button size="sm" variant="outline-danger" onClick={() => removeLine(index)}><i className="fas fa-times"></i></Button>
                    </div>
                ))}
            </div>

            <div className="d-flex flex-wrap gap-2 mb-3">
                <Button size="sm" variant="outline-success" onClick={() => addLine('recette')}><i className="fas fa-plus me-1"></i>Recette</Button>
                <Button size="sm" variant="outline-warning" onClick={() => addLine('depense')}><i className="fas fa-plus me-1"></i>Dépense</Button>
                {entity === MAIN_ENTITY && (
                    <Button size="sm" variant="outline-info" onClick={prefill} disabled={busy} title="Additionne les factures de dossiers médicaux payées pendant ce trimestre">
                        <i className="fas fa-wand-magic-sparkles me-1"></i>Préremplir les recettes (factures payées)
                    </Button>
                )}
            </div>

            <div className="tm-totals">
                <span>Ouverture : <strong>{formatMoney(sums.ouverture)}</strong></span>
                <span>Recettes : <strong>{formatMoney(sums.recettes)}</strong></span>
                <span>Dépenses : <strong>{formatMoney(sums.depenses)}</strong></span>
                <span>Variation : <strong className={sums.solde < 0 ? 'text-danger' : 'text-success'}>{formatMoney(sums.solde)}</strong></span>
                <span>Solde de clôture : <strong className={sums.cloture < 0 ? 'text-danger' : 'text-success'}>{formatMoney(sums.cloture)}</strong></span>
            </div>

            <Form.Group className="mb-3">
                <Form.Label>Notes <small className="text-muted">(facultatif, publiées avec les comptes)</small></Form.Label>
                <Form.Control as="textarea" rows={2} value={notes} onChange={(e) => touch(lignes, e.target.value)} placeholder="ex. Les dépenses liées à une enquête pénale sont regroupées sous « Dépenses d'enquête »." />
            </Form.Group>
            </fieldset>

            {!isQuarterOver(key) && <Alert variant="info" className="py-2 small">Ce trimestre n'est pas terminé : les comptes se publient en principe à sa fin.</Alert>}

            <div className="d-flex flex-wrap gap-2">
                <Button variant="primary" onClick={publish} disabled={busy || loadingDraft || lignes.length === 0}>{busy ? <Spinner as="span" animation="border" size="sm" /> : (published ? 'Mettre à jour la publication' : 'Publier les comptes')}</Button>
                {hasDraft && <Button variant="outline-secondary" onClick={discardDraft} disabled={busy}>Abandonner le brouillon</Button>}
                {published && <Button variant="outline-danger" onClick={unpublish} disabled={busy || loadingDraft} title="Retire les comptes de la page publique et les remet en brouillon (rien n'est supprimé)">Retirer de la page publique</Button>}
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
