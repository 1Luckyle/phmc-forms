// src/components/Admin/users/UsersHub.js
//
// Menu unique « Utilisateurs » du panneau admin : il remplace les anciennes fenêtres
// « Gérer le Personnel » et « Gérer les Civils » (styles et logiques différents) par UNE
// interface, découpée en catégories :
//   Personnel · Civils · Recruteurs · Outils (rôles en français, statistiques, rapports, migration, réindexation)
// Deux grandes familles de comptes : Civil (pur) et Personnel — lui-même en 4 familles (PHMC Soignant,
// PHMC Administration & Direction, PHMC Polyvalent, DMEC). Un recruteur est du personnel avec en plus le
// droit Recruteur. Civil ⇄ Personnel : conversion encadrée, avec confirmation et sans rien supprimer.
// L'admin n'est pas géré depuis ce menu (un badge Admin signale simplement ces comptes).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Dropdown, Form, Modal, Alert, Spinner, Badge } from 'react-bootstrap';
import './UsersHub.css';
import UserStats from '../UserStats';
import EmailChangeFlow from '../../EmailChangeFlow';
import AdminReportsTools from '../AdminReportsTools';
import RankMigrationPanel from './RankMigrationPanel';
import { sendAdminActionWebhook } from '../adminUtils';
import {
    StaffEditDialog, RemoveStaffDialog, ConvertToCivilDialog, ConvertToStaffDialog,
} from './StaffDialogs';
import {
    rankLabel, loadStaffMembers, loadCivilians, loadRecruiterUids, loadAdminUids,
    setRecruiterRole, saveCivilianProfile, deleteCivilianAccount,
} from '../../../utils/staffAdmin';
import { STAFF_FAMILIES } from '../../../constants/ranks';
import { loadContractCandidates } from '../../../utils/contractCandidates';

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

// Badges « qui est quoi » : une famille du personnel, Civil, Recruteur, Admin.
const BADGES = {
    soignant: { text: 'PHMC Soignant', bg: 'primary' },
    administration: { text: 'PHMC Administration', bg: 'warning', textColor: 'dark' },
    polyvalent: { text: 'PHMC Polyvalent', bg: 'secondary' },
    dmec: { text: 'DMEC', bg: 'dark' },
    civil: { text: 'Civil', bg: 'success' },
    recruiter: { text: 'Recruteur', bg: 'info', textColor: 'dark' },
    recruiterNoFile: { text: 'Recruteur sans fiche personnel', bg: 'danger' },
    admin: { text: 'Admin', bg: 'danger' },
};

const RoleBadge = ({ role }) => {
    const info = BADGES[role] || { text: role, bg: 'secondary' };
    return <Badge bg={info.bg} text={info.textColor} className="uh-role">{info.text}</Badge>;
};

const ActionsMenu = ({ children }) => (
    <Dropdown align="end">
        <Dropdown.Toggle size="sm" variant="outline-secondary" className="uh-actions-toggle">Actions</Dropdown.Toggle>
        <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>{children}</Dropdown.Menu>
    </Dropdown>
);

const nameOfCivilian = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;

// ───────────────────────────── Personnel ─────────────────────────────
// Quatre familles : PHMC Soignant, PHMC Administration & Direction, PHMC Polyvalent, DMEC. Chaque ligne
// montre la famille, le rôle (en français), le service dirigé d'un Chef de Service et les droits
// supplémentaires (Recruteur, Admin).
const StaffTab = ({ staff, civilUids, recruiterUids, adminUids, adminEmail, showNotification, reload }) => {
    const [query, setQuery] = useState('');
    const [family, setFamily] = useState('all');
    const [editing, setEditing] = useState(null);
    const [adding, setAdding] = useState(false);
    const [removing, setRemoving] = useState(null);
    const [toCivil, setToCivil] = useState(null);

    // Avec le cumul de rôles, une personne n'est comptée qu'UNE fois : par la famille de son rôle principal
    // (ses badges montrent quand même toutes ses familles). Les filtres suivent les mêmes compteurs.
    const familyCounts = useMemo(() => {
        const counts = {};
        staff.forEach((m) => { counts[m.family] = (counts[m.family] || 0) + 1; });
        return counts;
    }, [staff]);

    const rows = useMemo(() => staff.filter((m) => (family === 'all' || m.family === family)
        && matches(query, m.displayName, rankLabel(m.service, m.rank || m.category), ...m.extraRanks, m.serviceDirige, m.badge, m.discord, m.email, m.phNumber)),
    [staff, family, query]);

    const toggleRecruiter = async (member) => {
        const enabled = recruiterUids[member.uid] !== true;
        if (!window.confirm(enabled
            ? `Donner le droit Recruteur à ${member.displayName} ? Rôle et famille ne changent pas.`
            : `Retirer le droit Recruteur à ${member.displayName} ? Rôle et famille ne changent pas.`)) return;
        try {
            await setRecruiterRole(member.uid, enabled);
            sendAdminActionWebhook(adminEmail, enabled ? 'Rôle recruteur attribué' : 'Rôle recruteur retiré', `Membre : ${member.displayName}`, null, 'Admin');
            showNotification(enabled ? `${member.displayName} est maintenant recruteur.` : `${member.displayName} n'est plus recruteur.`, 'success');
            reload();
        } catch (error) {
            console.error(error);
            showNotification('Impossible de modifier le droit (règles Firebase à déployer ?).', 'error');
        }
    };

    // En-têtes de groupe quand toutes les familles sont affichées.
    let lastFamily = null;

    return (
        <>
            <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un membre (nom, rôle, service, badge, téléphone, Discord…)">
                <Button variant="primary" size="sm" onClick={() => setAdding(true)}><i className="fas fa-user-plus"></i> Ajouter</Button>
            </SearchBar>
            <div className="uh-family-filters">
                <button type="button" className={`uh-chip${family === 'all' ? ' on' : ''}`} onClick={() => setFamily('all')}>
                    Tous <Badge bg="secondary">{staff.length}</Badge>
                </button>
                {Object.values(STAFF_FAMILIES).map((f) => (
                    <button key={f.key} type="button" className={`uh-chip${family === f.key ? ' on' : ''}`} onClick={() => setFamily(f.key)} title={f.description}>
                        {f.label} <Badge bg="secondary">{familyCounts[f.key] || 0}</Badge>
                    </button>
                ))}
            </div>
            <div className="table-responsive">
                <table className="table table-hover align-middle uh-table">
                    <thead><tr><th>Nom</th><th>Rôle</th><th>Badge</th><th>Téléphone</th><th>Discord</th><th>Compte</th><th></th></tr></thead>
                    <tbody>
                        {rows.map((m) => {
                            const header = family === 'all' && m.family !== lastFamily;
                            lastFamily = m.family;
                            return (
                                <React.Fragment key={`${m.service}-${m.storageKey}`}>
                                    {header && (
                                        <tr className="uh-group-row">
                                            <td colSpan={7}>
                                                <strong>{STAFF_FAMILIES[m.family]?.label}</strong>
                                                <small className="ms-2">{STAFF_FAMILIES[m.family]?.description}</small>
                                            </td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td className="fw-semibold">
                                            {m.displayName}{' '}
                                            {m.families.map((f) => <React.Fragment key={f}><RoleBadge role={f} />{' '}</React.Fragment>)}
                                            {recruiterUids[m.uid] === true && <> <RoleBadge role="recruiter" /></>}
                                            {adminUids[m.uid] === true && <> <RoleBadge role="admin" /></>}
                                            {m.uid && civilUids.has(m.uid) && <small className="text-muted ms-1" title="Ce compte a aussi un profil Civil (conservé)">+ profil Civil</small>}
                                        </td>
                                        <td>
                                            {rankLabel(m.service, m.rank || m.category)}
                                            {m.extraRanks.length > 0 && <small className="d-block text-muted">+ {m.extraRanks.join(' · ')}</small>}
                                            {m.serviceDirige && <small className="d-block text-muted">Service : {m.serviceDirige}</small>}
                                        </td>
                                        <td>{m.badge || '—'}</td>
                                        <td>{m.phNumber || '—'}</td>
                                        <td>{m.discord || '—'}</td>
                                        <td>{m.uid
                                            ? <span className="text-success" title={m.email || ''}><i className="fas fa-check-circle"></i> lié</span>
                                            : <span className="text-muted" title="Fiche sans compte de connexion"><i className="fas fa-minus-circle"></i> aucun</span>}</td>
                                        <td className="text-end">
                                            <ActionsMenu>
                                                <Dropdown.Item onClick={() => setEditing(m)}><i className="fas fa-edit me-2"></i>Modifier (rôle, badge…)</Dropdown.Item>
                                                <Dropdown.Item disabled={!m.uid} onClick={() => toggleRecruiter(m)}>
                                                    <i className="fas fa-user-tie me-2"></i>{recruiterUids[m.uid] === true ? 'Retirer le droit Recruteur' : 'Donner le droit Recruteur'}{!m.uid ? ' (compte requis)' : ''}
                                                </Dropdown.Item>
                                                <Dropdown.Item disabled={!m.uid} onClick={() => setToCivil(m)}>
                                                    <i className="fas fa-user me-2"></i>Passer en Civil{!m.uid ? ' (compte requis)' : ''}
                                                </Dropdown.Item>
                                                <Dropdown.Divider />
                                                <Dropdown.Item className="text-danger" onClick={() => setRemoving(m)}><i className="fas fa-trash me-2"></i>Supprimer définitivement…</Dropdown.Item>
                                            </ActionsMenu>
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                        {rows.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">Aucun membre ne correspond.</td></tr>}
                    </tbody>
                </table>
            </div>

            <StaffEditDialog show={!!editing} onHide={() => setEditing(null)} member={editing} isRecruiter={!!editing && recruiterUids[editing.uid] === true}
                adminEmail={adminEmail} showNotification={showNotification} onDone={reload} />
            <StaffEditDialog show={adding} onHide={() => setAdding(false)} member={null} defaultFamily={family === 'all' ? 'soignant' : family}
                adminEmail={adminEmail} showNotification={showNotification} onDone={reload} />
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
    // Fermée : `civilian` repasse à null alors que `form` garde l'ancienne valeur ; sans ce garde-fou, la fenêtre
    // essayait de relire `civilian.uid` pendant sa fermeture et faisait planter tout l'onglet.
    if (!form || !civilian) return null;
    const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
    const save = async () => {
        setBusy(true);
        try {
            const outcome = await saveCivilianProfile(form, civilian);
            showNotification(outcome.renamedReports > 0
                ? `Profil Civil mis à jour (${outcome.renamedReports} rapport(s) migré(s) vers le nouveau nom).`
                : 'Profil Civil mis à jour.', 'success');
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
                <Form.Group className="mb-3"><Form.Label>ID patient</Form.Label><Form.Control value={form.patientID || ''} disabled /></Form.Group>
                {/* Changement d'e-mail : code de vérification envoyé à la nouvelle adresse (à relayer par la personne). */}
                <EmailChangeFlow
                    currentEmail={form.email}
                    targetUid={civilian.uid}
                    onChanged={(email) => { setForm((p) => ({ ...p, email })); onDone(); }}
                />
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                <Button variant="primary" onClick={save} disabled={busy}>{busy ? <Spinner size="sm" animation="border" /> : 'Enregistrer'}</Button>
            </Modal.Footer>
        </Modal>
    );
};

// ───────────────────────────── Civils (comptes Civils purs) ─────────────────────────────
// Un Civil « pur » n'a pas de fiche du personnel. Une personne qui a une fiche (y compris un recruteur) est
// dans l'onglet Personnel, même si elle garde aussi son profil Civil.
const CiviliansTab = ({ civilians, recruiterUids, candidateRoles = {}, adminEmail, showNotification, reload }) => {
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(null);
    const [toStaff, setToStaff] = useState(null); // { civilian, recruiter }
    const [deleting, setDeleting] = useState(null);

    const rows = useMemo(() => civilians.filter((c) => matches(query, c.firstName, c.lastName, c.patientID, c.email, c.phone, c.discord)), [civilians, query]);
    const nameOf = nameOfCivilian;

    const removeRecruiterFlag = async (civilian) => {
        if (!window.confirm(`Retirer le droit Recruteur à ${nameOf(civilian)} ? Il garde son compte Civil.`)) return;
        try {
            await setRecruiterRole(civilian.uid, false);
            sendAdminActionWebhook(adminEmail, 'Rôle recruteur retiré', `Compte : ${nameOf(civilian)} (${civilian.patientID})`, null, 'Admin');
            showNotification(`${nameOf(civilian)} n'est plus recruteur.`, 'success');
            reload();
        } catch (error) {
            console.error(error);
            showNotification('Impossible de modifier le droit (règles Firebase à déployer ?).', 'error');
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
            <p className="text-muted small">
                Comptes <strong>Civils purs</strong> (sans fiche du personnel). Un recruteur est du <strong>personnel</strong> : pour en nommer un,
                utilisez « Nommer recruteur » (le compte passe en Personnel, famille Administration & Direction, sans perdre son profil Civil).
            </p>
            <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un civil (nom, ID patient, e-mail, téléphone, Discord…)" />
            <div className="table-responsive">
                <table className="table table-hover align-middle uh-table">
                    <thead><tr><th>Nom</th><th>ID patient</th><th>E-mail</th><th>Téléphone</th><th>Discord</th><th>Statut</th><th></th></tr></thead>
                    <tbody>
                        {rows.map((c) => {
                            const flaggedRecruiter = recruiterUids[c.uid] === true;
                            return (
                                <tr key={c.uid}>
                                    <td className="fw-semibold">{nameOf(c)}</td>
                                    <td>{c.patientID}</td>
                                    <td>{c.email}</td>
                                    <td>{c.phone || '—'}</td>
                                    <td>{c.discord || '—'}</td>
                                    <td>
                                        <RoleBadge role="civil" />
                                        {candidateRoles[c.uid] && (
                                            <> <Badge bg="info" text="dark" title={candidateRoles[c.uid].poste ? `Candidat accepté pour : ${candidateRoles[c.uid].poste}` : 'Candidat accepté'}>
                                                En attente de contrat{candidateRoles[c.uid].role ? ` · ${candidateRoles[c.uid].role}` : ''}
                                            </Badge></>
                                        )}
                                        {flaggedRecruiter && <> <span title="Ancien recruteur resté Civil : créez sa fiche du personnel"><RoleBadge role="recruiterNoFile" /></span></>}
                                    </td>
                                    <td className="text-end">
                                        <ActionsMenu>
                                            <Dropdown.Item onClick={() => setEditing(c)}><i className="fas fa-edit me-2"></i>Modifier le profil</Dropdown.Item>
                                            <Dropdown.Item onClick={() => setToStaff({ civilian: c, recruiter: true })}>
                                                <i className="fas fa-user-tie me-2"></i>{flaggedRecruiter ? 'Créer sa fiche du personnel (recruteur)…' : 'Nommer recruteur…'}
                                            </Dropdown.Item>
                                            <Dropdown.Item onClick={() => setToStaff({ civilian: c, recruiter: false })}>
                                                <i className="fas fa-user-md me-2"></i>Passer en Personnel…
                                            </Dropdown.Item>
                                            {flaggedRecruiter && (
                                                <Dropdown.Item onClick={() => removeRecruiterFlag(c)}><i className="fas fa-user-slash me-2"></i>Retirer le droit Recruteur</Dropdown.Item>
                                            )}
                                            <Dropdown.Divider />
                                            <Dropdown.Item className="text-danger" onClick={() => setDeleting(c)}><i className="fas fa-trash me-2"></i>Supprimer le compte…</Dropdown.Item>
                                        </ActionsMenu>
                                    </td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-4">Aucun compte Civil ne correspond.</td></tr>}
                    </tbody>
                </table>
            </div>

            <CivilianEditDialog show={!!editing} onHide={() => setEditing(null)} civilian={editing} showNotification={showNotification} onDone={reload} />
            <ConvertToStaffDialog show={!!toStaff} onHide={() => setToStaff(null)} civilian={toStaff?.civilian || null} presetRecruiter={!!toStaff?.recruiter}
                suggestedRole={toStaff?.civilian ? (candidateRoles[toStaff.civilian.uid]?.role || '') : ''}
                adminEmail={adminEmail} showNotification={showNotification} onDone={reload} />
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
// Un recruteur est un membre du PERSONNEL (fiche PHMC, famille de son choix — par défaut Administration &
// Direction) qui a en plus le droit Recruteur. Cet onglet les liste tous, y compris les anciens recruteurs
// restés Civils sans fiche, à régulariser.
const RecruitersTab = ({ staff, civilians, recruiterUids, adminEmail, showNotification, reload }) => {
    const [selected, setSelected] = useState('');
    const [toStaff, setToStaff] = useState(null);
    const staffUidSet = useMemo(() => new Set(staff.map((m) => m.uid).filter(Boolean)), [staff]);

    const staffRecruiters = staff.filter((m) => m.uid && recruiterUids[m.uid] === true);
    const civilRecruiters = civilians.filter((c) => recruiterUids[c.uid] === true && !staffUidSet.has(c.uid));
    const staffCandidates = staff.filter((m) => m.uid && recruiterUids[m.uid] !== true);
    const civilCandidates = civilians.filter((c) => recruiterUids[c.uid] !== true && !staffUidSet.has(c.uid));

    const setFlag = async (uid, label, enabled) => {
        if (!window.confirm(enabled ? `Donner le droit Recruteur à ${label} ?` : `Retirer le droit Recruteur à ${label} ? Son rôle et son compte ne changent pas.`)) return;
        try {
            await setRecruiterRole(uid, enabled);
            sendAdminActionWebhook(adminEmail, enabled ? 'Rôle recruteur attribué' : 'Rôle recruteur retiré', `Compte : ${label}`, null, 'Admin');
            showNotification(enabled ? `${label} est maintenant recruteur.` : `${label} n'est plus recruteur.`, 'success');
            setSelected('');
            reload();
        } catch (error) {
            console.error(error);
            showNotification('Impossible de modifier le droit (règles Firebase à déployer ?).', 'error');
        }
    };

    const nominate = () => {
        const [kind, uid] = selected.split(':');
        if (kind === 'staff') {
            const member = staff.find((m) => m.uid === uid);
            if (member) setFlag(uid, member.displayName, true);
        } else {
            const civilian = civilians.find((c) => c.uid === uid);
            if (civilian) setToStaff(civilian);
        }
    };

    return (
        <>
            <p className="text-muted small">
                Un recruteur est du <strong>personnel</strong> : il se connecte par le portail du personnel et figure dans la liste des membres du PHMC.
                Ses droits sont ceux d'un compte Civil amélioré (gestion du recrutement, contrats) : le droit Recruteur est indépendant de son rôle.
            </p>
            <div className="uh-toolbar">
                <Form.Select className="uh-search" value={selected} onChange={(e) => setSelected(e.target.value)}>
                    <option value="">Choisir qui nommer recruteur…</option>
                    <optgroup label="Personnel (le droit est ajouté, rien d'autre ne change)">
                        {staffCandidates.map((m) => <option key={m.uid} value={`staff:${m.uid}`}>{m.displayName} — {rankLabel(m.service, m.rank || m.category)}</option>)}
                    </optgroup>
                    <optgroup label="Civils (passage en Personnel, famille Administration par défaut)">
                        {civilCandidates.map((c) => <option key={c.uid} value={`civil:${c.uid}`}>{nameOfCivilian(c)} — {c.patientID}</option>)}
                    </optgroup>
                </Form.Select>
                <Button variant="primary" size="sm" disabled={!selected} onClick={nominate}>
                    <i className="fas fa-user-plus"></i> Nommer recruteur
                </Button>
            </div>
            <div className="table-responsive">
                <table className="table table-hover align-middle uh-table">
                    <thead><tr><th>Nom</th><th>Famille & rôle</th><th>Fiche du personnel</th><th>Discord</th><th></th></tr></thead>
                    <tbody>
                        {staffRecruiters.map((m) => (
                            <tr key={`s-${m.uid}`}>
                                <td className="fw-semibold">{m.displayName} <RoleBadge role="recruiter" /></td>
                                <td><RoleBadge role={m.family} /> {rankLabel(m.service, m.rank || m.category)}</td>
                                <td className="text-success"><i className="fas fa-check-circle"></i> oui</td>
                                <td>{m.discord || '—'}</td>
                                <td className="text-end"><Button size="sm" variant="outline-danger" onClick={() => setFlag(m.uid, m.displayName, false)}>Retirer le droit</Button></td>
                            </tr>
                        ))}
                        {civilRecruiters.map((c) => (
                            <tr key={`c-${c.uid}`}>
                                <td className="fw-semibold">{nameOfCivilian(c)} <RoleBadge role="recruiterNoFile" /></td>
                                <td><RoleBadge role="civil" /> —</td>
                                <td className="text-danger"><i className="fas fa-exclamation-triangle"></i> manquante</td>
                                <td>{c.discord || '—'}</td>
                                <td className="text-end">
                                    <Button size="sm" variant="success" className="me-1" onClick={() => setToStaff(c)}>Créer la fiche</Button>
                                    <Button size="sm" variant="outline-danger" onClick={() => setFlag(c.uid, nameOfCivilian(c), false)}>Retirer le droit</Button>
                                </td>
                            </tr>
                        ))}
                        {staffRecruiters.length + civilRecruiters.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">Aucun recruteur pour le moment.</td></tr>}
                    </tbody>
                </table>
            </div>
            <ConvertToStaffDialog show={!!toStaff} onHide={() => setToStaff(null)} civilian={toStaff} presetRecruiter
                adminEmail={adminEmail} showNotification={showNotification} onDone={() => { setSelected(''); reload(); }} />
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
    const [adminUids, setAdminUids] = useState({});
    const [candidateRoles, setCandidateRoles] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const reload = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const [staffList, civilList, recruiters, admins, candidates] = await Promise.all([
                loadStaffMembers(), loadCivilians(), loadRecruiterUids(), loadAdminUids().catch(() => ({})), loadContractCandidates().catch(() => ({})),
            ]);
            setCandidateRoles(candidates);
            setStaff(staffList);
            setCivilians(civilList);
            setRecruiterUids(recruiters);
            setAdminUids(admins);
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
    // Civils purs : sans fiche du personnel (les autres sont dans l'onglet Personnel).
    const pureCivilians = useMemo(() => civilians.filter((c) => !staffUids.has(c.uid)), [civilians, staffUids]);
    const recruiterCount = useMemo(() => new Set([
        ...staff.filter((m) => m.uid && recruiterUids[m.uid] === true).map((m) => m.uid),
        ...civilians.filter((c) => recruiterUids[c.uid] === true).map((c) => c.uid),
    ]).size, [staff, civilians, recruiterUids]);
    const counts = { staff: staff.length, civilians: pureCivilians.length, recruiters: recruiterCount };
    const adminEmail = currentUser?.email;
    const familyCount = (key) => staff.filter((m) => m.family === key).length;

    return (
        <div className="card users-hub">
            <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                <span>Gestion des utilisateurs</span>
                <small className="text-muted">
                    Personnel {staff.length} (Soignant {familyCount('soignant')} · Administration {familyCount('administration')} · Polyvalent {familyCount('polyvalent')} · DMEC {familyCount('dmec')}) ·{' '}
                    {pureCivilians.length} Civils · {recruiterCount} recruteur(s)
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
                        {tab === 'staff' && <StaffTab staff={staff} civilUids={civilUids} recruiterUids={recruiterUids} adminUids={adminUids} adminEmail={adminEmail} showNotification={showNotification} reload={reload} />}
                        {tab === 'civilians' && <CiviliansTab civilians={pureCivilians} recruiterUids={recruiterUids} candidateRoles={candidateRoles} adminEmail={adminEmail} showNotification={showNotification} reload={reload} />}
                        {tab === 'recruiters' && <RecruitersTab staff={staff} civilians={civilians} recruiterUids={recruiterUids} adminEmail={adminEmail} showNotification={showNotification} reload={reload} />}
                        {tab === 'tools' && (
                            <>
                                <RankMigrationPanel adminEmail={adminEmail} showNotification={showNotification} onDone={reload} />
                                <hr />
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
