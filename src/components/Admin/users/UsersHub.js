// src/components/Admin/users/UsersHub.js
//
// Menu unique « Utilisateurs » du panneau admin : il remplace les anciennes fenêtres
// « Gérer le Personnel » et « Gérer les Civils » (styles et logiques différents) par UNE
// interface, découpée en catégories :
//   Personnel · Civils · Recruteurs · Outils (statistiques, rapports, migration, réindexation)
// Les rôles se gèrent ici : recruteur (ajout/retrait direct), Civil ⇄ Personnel (conversion
// encadrée, avec confirmation et sans rien supprimer). L'admin n'est pas géré depuis ce menu.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Dropdown, Form, Modal, Alert, Spinner, Badge } from 'react-bootstrap';
import './UsersHub.css';
import UserStats from '../UserStats';
import AdminReportsTools from '../AdminReportsTools';
import { sendAdminActionWebhook } from '../adminUtils';
import {
    StaffEditDialog, RemoveStaffDialog, ConvertToCivilDialog, ConvertToStaffDialog,
} from './StaffDialogs';
import {
    STAFF_SERVICES, rankLabel, loadStaffMembers, loadCivilians, loadRecruiterUids,
    setRecruiterRole, saveCivilianProfile, deleteCivilianAccount,
} from '../../../utils/staffAdmin';

const matches = (query, ...values) => {
    const q = query.trim().toLowerCase();
    return !q || values.some((v) => String(v || '').toLowerCase().includes(q));
};

const SearchBar = ({ value, onChange, placeholder, children }) => (
    <div className="uh-toolbar">
        <Form.Control className="uh-search" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        <div className="uh-toolbar-actions">{children}</div>
    </div>
);

const RoleBadge = ({ role }) => {
    const map = {
        phmc: { text: 'PHMC', bg: 'primary' },
        coroner: { text: 'DMEC', bg: 'dark' },
        civil: { text: 'Civil', bg: 'success' },
        recruiter: { text: 'Recruteur', bg: 'info' },
    };
    const info = map[role] || { text: role, bg: 'secondary' };
    return <Badge bg={info.bg} className="uh-role">{info.text}</Badge>;
};

const ActionsMenu = ({ children }) => (
    <Dropdown align="end">
        <Dropdown.Toggle size="sm" variant="outline-secondary" className="uh-actions-toggle">Actions</Dropdown.Toggle>
        <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>{children}</Dropdown.Menu>
    </Dropdown>
);

// ───────────────────────────── Personnel ─────────────────────────────
const StaffTab = ({ staff, civilUids, adminEmail, showNotification, reload }) => {
    const [query, setQuery] = useState('');
    const [service, setService] = useState('all');
    const [editing, setEditing] = useState(null);
    const [adding, setAdding] = useState(false);
    const [removing, setRemoving] = useState(null);
    const [toCivil, setToCivil] = useState(null);

    const rows = useMemo(() => staff.filter((m) => (service === 'all' || m.service === service)
        && matches(query, m.displayName, m.rank, m.badge, m.discord, m.email)), [staff, service, query]);

    return (
        <>
            <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un membre (nom, grade, badge, Discord…)">
                <Form.Select className="uh-filter" value={service} onChange={(e) => setService(e.target.value)}>
                    <option value="all">Tous les services</option>
                    {Object.values(STAFF_SERVICES).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </Form.Select>
                <Button variant="primary" size="sm" onClick={() => setAdding(true)}><i className="fas fa-user-plus"></i> Ajouter</Button>
            </SearchBar>
            <div className="table-responsive">
                <table className="table table-hover align-middle uh-table">
                    <thead><tr><th>Nom</th><th>Service</th><th>Grade</th><th>Badge</th><th>Discord</th><th>Compte</th><th></th></tr></thead>
                    <tbody>
                        {rows.map((m) => (
                            <tr key={`${m.service}-${m.storageKey}`}>
                                <td className="fw-semibold">{m.displayName}</td>
                                <td><RoleBadge role={m.service} /></td>
                                <td>{rankLabel(m.service, m.rank)}</td>
                                <td>{m.badge || '—'}</td>
                                <td>{m.discord || '—'}</td>
                                <td>{m.uid
                                    ? <span className="text-success" title={m.email || ''}><i className="fas fa-check-circle"></i> lié</span>
                                    : <span className="text-muted" title="Fiche sans compte de connexion"><i className="fas fa-minus-circle"></i> aucun</span>}</td>
                                <td className="text-end">
                                    <ActionsMenu>
                                        <Dropdown.Item onClick={() => setEditing(m)}><i className="fas fa-edit me-2"></i>Modifier (grade, badge…)</Dropdown.Item>
                                        <Dropdown.Item disabled={!m.uid} onClick={() => setToCivil(m)}>
                                            <i className="fas fa-user me-2"></i>Passer en Civil{!m.uid ? ' (compte requis)' : ''}
                                        </Dropdown.Item>
                                        <Dropdown.Divider />
                                        <Dropdown.Item className="text-danger" onClick={() => setRemoving(m)}><i className="fas fa-trash me-2"></i>Supprimer définitivement…</Dropdown.Item>
                                    </ActionsMenu>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">Aucun membre ne correspond.</td></tr>}
                    </tbody>
                </table>
            </div>

            <StaffEditDialog show={!!editing} onHide={() => setEditing(null)} member={editing} adminEmail={adminEmail} showNotification={showNotification} onDone={reload} />
            <StaffEditDialog show={adding} onHide={() => setAdding(false)} member={null} adminEmail={adminEmail} showNotification={showNotification} onDone={reload} />
            <RemoveStaffDialog show={!!removing} onHide={() => setRemoving(null)} member={removing} allStaff={staff} adminEmail={adminEmail} showNotification={showNotification} onDone={reload} />
            <ConvertToCivilDialog show={!!toCivil} onHide={() => setToCivil(null)} member={toCivil}
                hasCivilProfile={!!toCivil && civilUids.has(toCivil.uid)} adminEmail={adminEmail} showNotification={showNotification} onDone={reload} />
        </>
    );
};

// ───────────────────────────── Civils ─────────────────────────────
const CivilianEditDialog = ({ show, onHide, civilian, showNotification, onDone }) => {
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { if (show && civilian) setForm({ ...civilian }); }, [show, civilian]);
    if (!form) return null;
    const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
    const save = async () => {
        setBusy(true);
        try {
            await saveCivilianProfile(form);
            showNotification('Profil Civil mis à jour.', 'success');
            onDone();
            onHide();
        } catch (error) {
            showNotification(`Erreur lors de l'enregistrement : ${error.message}`, 'error');
        } finally { setBusy(false); }
    };
    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton><Modal.Title>Modifier {form.firstName} {form.lastName}</Modal.Title></Modal.Header>
            <Modal.Body>
                <div className="d-flex gap-2 mb-3">
                    <Form.Group className="flex-fill"><Form.Label>Prénom</Form.Label><Form.Control value={form.firstName || ''} onChange={set('firstName')} /></Form.Group>
                    <Form.Group className="flex-fill"><Form.Label>Deuxième prénom</Form.Label><Form.Control value={form.middleName || ''} onChange={set('middleName')} /></Form.Group>
                    <Form.Group className="flex-fill"><Form.Label>Nom</Form.Label><Form.Control value={form.lastName || ''} onChange={set('lastName')} /></Form.Group>
                </div>
                <div className="d-flex gap-2 mb-3">
                    <Form.Group className="flex-fill"><Form.Label>Date de naissance</Form.Label><Form.Control type="date" value={form.dateOfBirth || ''} onChange={set('dateOfBirth')} /></Form.Group>
                    <Form.Group className="flex-fill"><Form.Label>Genre</Form.Label>
                        <Form.Select value={form.gender || ''} onChange={set('gender')}>
                            <option value="">Sélectionner…</option><option value="Male">Homme</option><option value="Female">Femme</option><option value="Other">Autre</option>
                        </Form.Select>
                    </Form.Group>
                </div>
                <div className="d-flex gap-2 mb-3">
                    <Form.Group style={{ flex: 2 }}><Form.Label>Adresse</Form.Label><Form.Control value={form.address || ''} onChange={set('address')} /></Form.Group>
                    <Form.Group style={{ flex: 1 }}><Form.Label>Code postal</Form.Label><Form.Control value={form.zip || ''} onChange={set('zip')} /></Form.Group>
                </div>
                <div className="d-flex gap-2 mb-3">
                    <Form.Group className="flex-fill"><Form.Label>Téléphone</Form.Label><Form.Control value={form.phone || ''} onChange={set('phone')} /></Form.Group>
                    <Form.Group className="flex-fill"><Form.Label>Discord</Form.Label><Form.Control value={form.discord || ''} onChange={set('discord')} /></Form.Group>
                </div>
                <div className="d-flex gap-2">
                    <Form.Group className="flex-fill"><Form.Label>ID patient</Form.Label><Form.Control value={form.patientID || ''} disabled /></Form.Group>
                    <Form.Group className="flex-fill"><Form.Label>E-mail (connexion)</Form.Label><Form.Control value={form.email || ''} disabled /></Form.Group>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                <Button variant="primary" onClick={save} disabled={busy}>{busy ? <Spinner size="sm" animation="border" /> : 'Enregistrer'}</Button>
            </Modal.Footer>
        </Modal>
    );
};

const CiviliansTab = ({ civilians, staffUids, recruiterUids, adminEmail, showNotification, reload }) => {
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null);
    const [toStaff, setToStaff] = useState(null);
    const [deleting, setDeleting] = useState(null);

    const rows = useMemo(() => civilians.filter((c) => matches(query, c.firstName, c.lastName, c.patientID, c.email, c.phone)), [civilians, query]);
    const nameOf = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;

    const toggleRecruiter = async (civilian) => {
        const isRecruiter = recruiterUids[civilian.uid] === true;
        const question = isRecruiter
            ? `Retirer le rôle de recruteur à ${nameOf(civilian)} ? Il garde son compte Civil.`
            : `Donner le rôle de recruteur à ${nameOf(civilian)} ? Il gardera ses accès de Civil et gérera en plus les postes et les candidatures.`;
        if (!window.confirm(question)) return;
        try {
            await setRecruiterRole(civilian.uid, !isRecruiter);
            sendAdminActionWebhook(adminEmail, isRecruiter ? 'Rôle recruteur retiré' : 'Rôle recruteur attribué', `Compte : ${nameOf(civilian)} (${civilian.patientID})`, null, 'Admin');
            showNotification(isRecruiter ? `${nameOf(civilian)} n'est plus recruteur.` : `${nameOf(civilian)} est maintenant recruteur.`, 'success');
            reload();
        } catch (error) {
            console.error(error);
            showNotification('Impossible de modifier le rôle (règles Firebase à déployer ?).', 'error');
        }
    };

    const confirmDelete = async () => {
        const civilian = deleting;
        setDeleting(null);
        try {
            await deleteCivilianAccount(civilian);
            sendAdminActionWebhook(adminEmail, 'Compte Civil supprimé', `Compte : ${nameOf(civilian)} (${civilian.patientID})`, null, 'Admin');
            showNotification(`Compte Civil de ${nameOf(civilian)} supprimé.`, 'success');
            reload();
        } catch (error) {
            console.error(error);
            showNotification(`Erreur lors de la suppression : ${error.message}`, 'error');
        }
    };

    return (
        <>
            <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un civil (nom, ID patient, e-mail, téléphone…)" />
            <div className="table-responsive">
                <table className="table table-hover align-middle uh-table">
                    <thead><tr><th>Nom</th><th>ID patient</th><th>E-mail</th><th>Téléphone</th><th>Rôle</th><th></th></tr></thead>
                    <tbody>
                        {rows.map((c) => {
                            const isStaff = staffUids.has(c.uid);
                            const isRecruiter = recruiterUids[c.uid] === true;
                            return (
                                <tr key={c.uid}>
                                    <td className="fw-semibold">{nameOf(c)}</td>
                                    <td>{c.patientID}</td>
                                    <td>{c.email}</td>
                                    <td>{c.phone || '—'}</td>
                                    <td>
                                        {isStaff ? <span title="Ce compte a aussi une fiche du personnel (elle a la priorité)"><RoleBadge role="phmc" /> <small className="text-muted">+ profil Civil</small></span>
                                            : isRecruiter ? <RoleBadge role="recruiter" /> : <RoleBadge role="civil" />}
                                    </td>
                                    <td className="text-end">
                                        <ActionsMenu>
                                            <Dropdown.Item onClick={() => setEditing(c)}><i className="fas fa-edit me-2"></i>Modifier le profil</Dropdown.Item>
                                            <Dropdown.Item disabled={isStaff} onClick={() => toggleRecruiter(c)}>
                                                <i className="fas fa-user-tie me-2"></i>{isRecruiter ? 'Retirer le rôle de recruteur' : 'Donner le rôle de recruteur'}
                                            </Dropdown.Item>
                                            <Dropdown.Item disabled={isStaff} onClick={() => setToStaff(c)}>
                                                <i className="fas fa-user-md me-2"></i>Passer en Personnel…{isStaff ? ' (déjà personnel)' : ''}
                                            </Dropdown.Item>
                                            <Dropdown.Divider />
                                            <Dropdown.Item className="text-danger" onClick={() => setDeleting(c)}><i className="fas fa-trash me-2"></i>Supprimer le compte…</Dropdown.Item>
                                        </ActionsMenu>
                                    </td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">Aucun compte Civil ne correspond.</td></tr>}
                    </tbody>
                </table>
            </div>

            <CivilianEditDialog show={!!editing} onHide={() => setEditing(null)} civilian={editing} showNotification={showNotification} onDone={reload} />
            <ConvertToStaffDialog show={!!toStaff} onHide={() => setToStaff(null)} civilian={toStaff} adminEmail={adminEmail} showNotification={showNotification} onDone={reload} />
            <Modal show={!!deleting} onHide={() => setDeleting(null)} centered>
                <Modal.Header closeButton><Modal.Title>Supprimer le compte Civil</Modal.Title></Modal.Header>
                <Modal.Body>
                    {deleting && (
                        <Alert variant="danger" className="mb-0">
                            Supprimer le compte Civil de <strong>{nameOf(deleting)}</strong> ({deleting.patientID}) ?<br />
                            Son profil et son <strong>compte de connexion</strong> seront supprimés. Ses dossiers et candidatures ne
                            sont pas supprimés, mais elle/il ne pourra plus s'y connecter.
                        </Alert>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setDeleting(null)}>Annuler</Button>
                    <Button variant="danger" onClick={confirmDelete}>Supprimer définitivement</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

// ───────────────────────────── Recruteurs ─────────────────────────────
const RecruitersTab = ({ civilians, recruiterUids, adminEmail, showNotification, reload }) => {
    const [selectedUid, setSelectedUid] = useState('');
    const recruiters = civilians.filter((c) => recruiterUids[c.uid] === true);
    const candidates = civilians.filter((c) => recruiterUids[c.uid] !== true);
    const nameOf = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;

    const change = async (civilian, enabled) => {
        if (!window.confirm(enabled
            ? `Donner le rôle de recruteur à ${nameOf(civilian)} ?`
            : `Retirer le rôle de recruteur à ${nameOf(civilian)} ? Il garde son compte Civil.`)) return;
        try {
            await setRecruiterRole(civilian.uid, enabled);
            sendAdminActionWebhook(adminEmail, enabled ? 'Rôle recruteur attribué' : 'Rôle recruteur retiré', `Compte : ${nameOf(civilian)} (${civilian.patientID})`, null, 'Admin');
            showNotification(enabled ? `${nameOf(civilian)} est maintenant recruteur.` : `${nameOf(civilian)} n'est plus recruteur.`, 'success');
            setSelectedUid('');
            reload();
        } catch (error) {
            console.error(error);
            showNotification('Impossible de modifier le rôle (règles Firebase à déployer ?).', 'error');
        }
    };

    return (
        <>
            <p className="text-muted small">
                Un recruteur est un compte <strong>Civil</strong> qui garde tous ses accès, avec en plus la « Gestion du recrutement »
                (postes et candidatures) dans sa Boîte à Outils.
            </p>
            <div className="uh-toolbar">
                <Form.Select className="uh-search" value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)}>
                    <option value="">Choisir un compte Civil à nommer recruteur…</option>
                    {candidates.map((c) => <option key={c.uid} value={c.uid}>{nameOf(c)} — {c.patientID}</option>)}
                </Form.Select>
                <Button variant="primary" size="sm" disabled={!selectedUid} onClick={() => change(civilians.find((c) => c.uid === selectedUid), true)}>
                    <i className="fas fa-user-plus"></i> Nommer recruteur
                </Button>
            </div>
            <div className="table-responsive">
                <table className="table table-hover align-middle uh-table">
                    <thead><tr><th>Nom</th><th>ID patient</th><th>E-mail</th><th></th></tr></thead>
                    <tbody>
                        {recruiters.map((c) => (
                            <tr key={c.uid}>
                                <td className="fw-semibold">{nameOf(c)} <RoleBadge role="recruiter" /></td>
                                <td>{c.patientID}</td>
                                <td>{c.email}</td>
                                <td className="text-end"><Button size="sm" variant="outline-danger" onClick={() => change(c, false)}>Retirer le rôle</Button></td>
                            </tr>
                        ))}
                        {recruiters.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-4">Aucun recruteur pour le moment.</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    );
};

// ───────────────────────────── Hub ─────────────────────────────
const TABS = [
    { key: 'staff', label: 'Personnel', icon: 'fa-user-md' },
    { key: 'civilians', label: 'Civils', icon: 'fa-id-card' },
    { key: 'recruiters', label: 'Recruteurs', icon: 'fa-user-tie' },
    { key: 'tools', label: 'Outils', icon: 'fa-tools' },
];

const UsersHub = ({ currentUser, showNotification, onOpenMigrationTools }) => {
    const [tab, setTab] = useState('staff');
    const [staff, setStaff] = useState([]);
    const [civilians, setCivilians] = useState([]);
    const [recruiterUids, setRecruiterUids] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const reload = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const [staffList, civilList, recruiters] = await Promise.all([loadStaffMembers(), loadCivilians(), loadRecruiterUids()]);
            setStaff(staffList);
            setCivilians(civilList);
            setRecruiterUids(recruiters);
        } catch (error) {
            console.error('Error loading users:', error);
            setLoadError(error.message || String(error));
        } finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => { reload(); }, [reload]);

    const staffUids = useMemo(() => new Set(staff.map((m) => m.uid).filter(Boolean)), [staff]);
    const civilUids = useMemo(() => new Set(civilians.map((c) => c.uid)), [civilians]);
    const recruiterCount = civilians.filter((c) => recruiterUids[c.uid] === true).length;
    const counts = { staff: staff.length, civilians: civilians.length, recruiters: recruiterCount };
    const adminEmail = currentUser?.email;

    return (
        <div className="card users-hub">
            <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span>Gestion des utilisateurs</span>
                <small className="text-muted">
                    {staff.filter((m) => m.service === 'phmc').length} PHMC · {staff.filter((m) => m.service === 'coroner').length} DMEC ·{' '}
                    {civilians.length} Civils · {recruiterCount} recruteur(s)
                </small>
            </div>
            <div className="card-body">
                <ul className="nav nav-tabs uh-tabs">
                    {TABS.map((t) => (
                        <li className="nav-item" key={t.key}>
                            <button type="button" className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                                <i className={`fas ${t.icon} me-2`}></i>{t.label}
                                {counts[t.key] !== undefined && <Badge bg="secondary" className="ms-2">{counts[t.key]}</Badge>}
                            </button>
                        </li>
                    ))}
                </ul>

                {loadError && <Alert variant="danger">Chargement impossible : {loadError}</Alert>}
                {isLoading && tab !== 'tools' ? <div className="text-center py-5"><Spinner animation="border" /></div> : (
                    <div className="uh-panel">
                        {tab === 'staff' && <StaffTab staff={staff} civilUids={civilUids} adminEmail={adminEmail} showNotification={showNotification} reload={reload} />}
                        {tab === 'civilians' && <CiviliansTab civilians={civilians} staffUids={staffUids} recruiterUids={recruiterUids} adminEmail={adminEmail} showNotification={showNotification} reload={reload} />}
                        {tab === 'recruiters' && <RecruitersTab civilians={civilians} recruiterUids={recruiterUids} adminEmail={adminEmail} showNotification={showNotification} reload={reload} />}
                        {tab === 'tools' && (
                            <>
                                <div className="d-flex gap-2 flex-wrap mb-2">
                                    <Button variant="outline-secondary" onClick={onOpenMigrationTools}>
                                        <i className="fas fa-exchange-alt"></i> Outils de migration des rapports
                                    </Button>
                                </div>
                                <AdminReportsTools showNotification={showNotification} />
                                <hr />
                                <UserStats currentUser={currentUser} />
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UsersHub;
