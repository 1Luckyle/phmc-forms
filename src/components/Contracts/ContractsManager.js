// src/components/Contracts/ContractsManager.js
//
// Onglet « Contrats » de la Gestion du recrutement (admins + recruteurs) : liste des contrats,
// création / édition d'un brouillon sur le MODÈLE VERROUILLÉ (voir utils/contracts.js), envoi à un
// membre du personnel (qui le signe depuis « Mes contrats »), retrait, suppression et consultation
// des contrats signés.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap';
import * as Sentry from '@sentry/react';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import ContractDocument from './ContractDocument';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { STAFF_SERVICES, loadStaffMembers, loadCivilians, loadRecruiterUids, rankLabel } from '../../utils/staffAdmin';
import { normalizeRank, getRoleInfo } from '../../constants/ranks';
import { loadContractCandidates, clearContractCandidate } from '../../utils/contractCandidates';
import { sendEyefindMail } from '../../utils/eyefindMail';
import { sendAdminActionWebhook } from '../Admin/adminUtils';
import { copyToClipboard } from '../notificationService';
import { downloadBbCodeAsHtml, contractToBbCode, contractTitle } from '../../utils/reportExport';
import {
    CONTRACT_STATUS, CONTRACT_TYPES, emptyContractFields, validateContractFields, renderContract,
    loadAllContracts, saveContractDraft, sendContract, retractContract, deleteContract,
} from '../../utils/contracts';

// ───────────────────────────── Éditeur / lecture d'un contrat ─────────────────────────────
// `staff` = destinataires possibles : membres du personnel (kind « staff »), recruteurs (kind
// « recruiter ») et candidats acceptés ayant le rôle « en attente de contrat » (kind « candidate »).
// Recruteurs et candidats sont des comptes Civils sans fiche : le service se choisit dans l'éditeur.
// Un recruteur ne peut jamais rédiger SON PROPRE contrat (un admin ou un autre recruteur le fait) :
// règle appliquée ici, dans saveContractDraft et dans database.rules.json.
const ContractEditor = ({ show, onHide, contract, staff, issuer, onChanged, showNotification }) => {
    const [employeeUid, setEmployeeUid] = useState('');
    const [candidateService, setCandidateService] = useState('phmc');
    const [filter, setFilter] = useState('');
    const [fields, setFields] = useState(emptyContractFields());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const isNew = !contract;
    const ownContract = !!contract && contract.employeUid === issuer.uid && !issuer.isAdmin;
    const readOnly = (!!contract && contract.statut !== 'brouillon') || ownContract;

    useEffect(() => {
        if (!show) return;
        setError('');
        setFilter('');
        setEmployeeUid(contract?.employeUid || '');
        setCandidateService(contract?.service || 'phmc');
        setFields({ ...emptyContractFields(), ...(contract?.champs || {}) });
    }, [show, contract]);

    // Personnel avec un compte de connexion (seul un compte lié peut recevoir et signer).
    const candidates = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return staff.filter((m) => m.uid && (issuer.isAdmin || m.uid !== issuer.uid) && (!q || m.displayName.toLowerCase().includes(q)));
    }, [staff, filter, issuer.uid, issuer.isAdmin]);
    const employee = staff.find((m) => m.uid === employeeUid) || null;
    const isCandidate = !!employee && employee.kind !== 'staff'; // compte Civil sans fiche : service à choisir
    const service = isCandidate ? candidateService : (employee?.service || contract?.service || 'phmc');
    const ranks = STAFF_SERVICES[service]?.ranks || [];

    const set = (field) => (e) => setFields((prev) => ({ ...prev, [field]: e.target.value }));

    const onPickEmployee = (uid) => {
        setEmployeeUid(uid);
        const picked = staff.find((m) => m.uid === uid);
        // Pré-remplit grade et fonction avec ceux de la fiche (modifiables : c'est parfois une promotion).
        if (picked && picked.kind === 'staff') {
            setFields((prev) => ({ ...prev, role: prev.role || normalizeRank(picked.rank || ''), poste: prev.poste || rankLabel(picked.service, picked.rank) }));
        } else if (picked?.role) {
            // Candidat accepté : le rôle relié à son poste de recrutement pré-remplit le contrat (service compris).
            setCandidateService(getRoleInfo(picked.role)?.pole === 'dmec' ? 'coroner' : 'phmc');
            setFields((prev) => ({ ...prev, role: prev.role || picked.role, poste: prev.poste || picked.poste || picked.role }));
        }
    };

    const preview = useMemo(() => {
        if (readOnly || !employee || !fields.role) return null;
        return renderContract({ service, employeeName: employee.displayName, employeeBadge: employee.badge, champs: fields, issuerName: issuer.name });
    }, [readOnly, employee, fields, service, issuer.name]);

    const guard = async (fn) => {
        setBusy(true);
        setError('');
        try { await fn(); } catch (err) {
            console.error(err);
            Sentry.captureException(err, { extra: { context: 'ContractsManager' } });
            setError(err.message || String(err));
        } finally { setBusy(false); }
    };

    const save = async ({ thenSend }) => guard(async () => {
        if (!employee) throw new Error('Choisissez le destinataire du contrat.');
        const errors = validateContractFields(fields);
        if (errors.length) throw new Error(errors.join(' '));
        if (thenSend && !window.confirm(`Envoyer le contrat à ${employee.displayName} ?\n\nLe texte sera figé : pour le modifier ensuite, il faudra le retirer.`)) return;
        const id = await saveContractDraft({ id: contract?.id, employee, service, champs: fields, issuer });
        if (thenSend) {
            await sendContract(id, issuer.name);
            sendAdminActionWebhook(issuer.email, 'Contrat envoyé', `Employé : ${employee.displayName}\nFonction : ${fields.poste}`, null, issuer.label);
            if (employee.email) {
                sendEyefindMail({
                    to: employee.email,
                    subject: 'Un contrat vous attend - Pillbox Hill Medical Center',
                    body: `Bonjour ${employee.displayName},\n\nUn contrat de travail a été préparé à votre attention. Connectez-vous à l'outil PHMC-FR, ouvrez la Boîte à outils puis « Mes contrats » pour le lire et le signer.\n\nCordialement,\nPillbox Hill Medical Center`,
                    html: `<p>Bonjour ${employee.displayName},</p><p>Un contrat de travail a été préparé à votre attention. Connectez-vous à l'outil PHMC-FR, ouvrez la <b>Boîte à outils</b> puis <b>« Mes contrats »</b> pour le lire et le signer.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
                });
            }
        }
        showNotification(thenSend ? `Contrat envoyé à ${employee.displayName}.` : 'Brouillon enregistré.', 'success');
        onChanged();
        onHide();
    });

    const retract = () => guard(async () => {
        if (!window.confirm('Retirer ce contrat ? Il disparaîtra de la liste de l\'employé et repassera en brouillon.')) return;
        await retractContract(contract.id);
        showNotification('Contrat retiré (repassé en brouillon).', 'info');
        onChanged();
        onHide();
    });

    return (
        <BaseModal isOpen={show} onClose={onHide} title={isNew ? 'Nouveau contrat' : `Contrat — ${contract.employeNom}`} modalSize="large" zIndex={1100} className="dark-ui">
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}

            {readOnly ? (
                <>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <Badge bg={CONTRACT_STATUS[contract.statut]?.variant}>{CONTRACT_STATUS[contract.statut]?.label}</Badge>
                        {contract.texteFige && (
                            <div className="d-flex gap-2">
                                <Button variant="outline-light" size="sm" onClick={() => copyToClipboard(contract.texteFige, showNotification, 'Texte du contrat copié.')}>
                                    <i className="fas fa-copy me-1"></i>Copier le texte
                                </Button>
                                <Button variant="outline-light" size="sm" title="Le HTML est destiné au forum GTA World"
                                    onClick={() => downloadBbCodeAsHtml({ bbCode: contractToBbCode(contract), title: contractTitle(contract), showNotification })}>
                                    <i className="fas fa-download me-1"></i>Télécharger le HTML
                                </Button>
                            </div>
                        )}
                    </div>
                    {ownContract && (
                        <Alert variant="info" className="py-2">
                            Il s'agit de votre propre contrat : un recruteur ne peut pas le modifier, c'est un admin ou un autre recruteur qui s'en charge.
                            {contract.statut !== 'signe' && ' Vous le lirez et le signerez depuis « Mes contrats » dès qu\'il vous aura été envoyé.'}
                        </Alert>
                    )}
                    {contract.texteFige
                        ? <ContractDocument text={contract.texteFige} signature={contract.signature} signedAt={contract.signeLe} />
                        : <Alert variant="secondary" className="py-2 mb-0">Brouillon en cours de rédaction : le texte n'est visible qu'une fois le contrat envoyé.</Alert>}
                    {contract.statut === 'envoye' && !ownContract && (
                        <div className="mt-3 d-flex justify-content-end">
                            <Button variant="outline-warning" onClick={retract} disabled={busy}>
                                {busy ? <Spinner size="sm" animation="border" /> : 'Retirer pour modifier'}
                            </Button>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <Form.Group className="mb-3">
                        <Form.Label>Destinataire</Form.Label>
                        {isNew ? (
                            <>
                                <Form.Control className="mb-1" type="search" placeholder="Filtrer par nom…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                                <Form.Select value={employeeUid} onChange={(e) => onPickEmployee(e.target.value)}>
                                    <option value="">Sélectionner…</option>
                                    {candidates.map((m) => (
                                        <option key={m.uid} value={m.uid}>
                                            {m.kind === 'candidate' ? `${m.displayName} — candidat accepté (en attente de contrat)`
                                                : m.kind === 'recruiter' ? `${m.displayName} — recruteur`
                                                    : `${m.displayName} — ${STAFF_SERVICES[m.service].label} — ${rankLabel(m.service, m.rank)}`}
                                        </option>
                                    ))}
                                </Form.Select>
                                <Form.Text className="text-muted">
                                    Membres du personnel avec un compte de connexion, recruteurs (hors vous-même, sauf admin) et candidats
                                    acceptés à qui vous avez passé le rôle « en attente de contrat » (bouton dans l'onglet Candidatures).
                                </Form.Text>
                            </>
                        ) : (
                            <Form.Control value={`${contract.employeNom} — ${STAFF_SERVICES[service]?.label || service}`} disabled />
                        )}
                    </Form.Group>

                    {isCandidate && (
                        <Form.Group className="mb-3">
                            <Form.Label>Service</Form.Label>
                            <Form.Select value={candidateService} onChange={(e) => { setCandidateService(e.target.value); setFields((p) => ({ ...p, role: '' })); }}>
                                {Object.values(STAFF_SERVICES).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </Form.Select>
                        </Form.Group>
                    )}
                    <div className="d-flex gap-2 mb-3">
                        <Form.Group className="flex-fill">
                            <Form.Label>Fonction exercée</Form.Label>
                            <Form.Control value={fields.poste} onChange={set('poste')} placeholder="ex. Médecin urgentiste" />
                        </Form.Group>
                        <Form.Group className="flex-fill">
                            <Form.Label>Grade</Form.Label>
                            <Form.Select value={fields.role} onChange={set('role')}>
                                <option value="">Sélectionner…</option>
                                {ranks.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </Form.Select>
                        </Form.Group>
                    </div>
                    <div className="d-flex gap-2 mb-3 flex-wrap">
                        <Form.Group className="flex-fill">
                            <Form.Label>Type de contrat</Form.Label>
                            <Form.Select value={fields.typeContrat} onChange={set('typeContrat')}>
                                {Object.entries(CONTRACT_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="flex-fill">
                            <Form.Label>Date de début</Form.Label>
                            <Form.Control type="date" value={fields.dateDebut} onChange={set('dateDebut')} />
                        </Form.Group>
                        {fields.typeContrat === 'cdd' && (
                            <Form.Group className="flex-fill">
                                <Form.Label>Date de fin</Form.Label>
                                <Form.Control type="date" value={fields.dateFin} onChange={set('dateFin')} />
                            </Form.Group>
                        )}
                    </div>
                    <div className="d-flex gap-2 mb-3">
                        <Form.Group className="flex-fill">
                            <Form.Label>Rémunération</Form.Label>
                            <Form.Control value={fields.remuneration} onChange={set('remuneration')} placeholder="ex. 85 $ de l'heure" />
                        </Form.Group>
                        <Form.Group style={{ maxWidth: 190 }}>
                            <Form.Label>Période d'essai (jours)</Form.Label>
                            <Form.Control inputMode="numeric" value={fields.essaiJours} onChange={(e) => setFields((p) => ({ ...p, essaiJours: e.target.value.replace(/\D/g, '') }))} placeholder="0 = aucune" />
                        </Form.Group>
                    </div>
                    <div className="d-flex gap-2 mb-3">
                        <Form.Group className="flex-fill">
                            <Form.Label>Responsable hiérarchique <small className="text-muted">(facultatif)</small></Form.Label>
                            <Form.Control value={fields.responsable} onChange={set('responsable')} />
                        </Form.Group>
                        <Form.Group className="flex-fill">
                            <Form.Label>Horaires / disponibilités <small className="text-muted">(facultatif)</small></Form.Label>
                            <Form.Control value={fields.horaires} onChange={set('horaires')} />
                        </Form.Group>
                    </div>

                    <div className="small text-muted mb-1">Aperçu (le reste du texte est fixé par le modèle) :</div>
                    {preview
                        ? <ContractDocument text={preview.text} />
                        : <Alert variant="secondary" className="py-2 mb-0">Choisissez un membre du personnel et un grade pour voir l'aperçu.</Alert>}

                    <div className="d-flex justify-content-end gap-2 mt-3">
                        <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                        <Button variant="outline-primary" onClick={() => save({ thenSend: false })} disabled={busy}>Enregistrer le brouillon</Button>
                        <Button variant="success" onClick={() => save({ thenSend: true })} disabled={busy}>
                            {busy ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-paper-plane me-1"></i>Enregistrer et envoyer</>}
                        </Button>
                    </div>
                </>
            )}
        </BaseModal>
    );
};

// ───────────────────────────── Liste ─────────────────────────────
const ContractsManager = ({ showNotification }) => {
    const { currentEmployee, isAdmin, staffName, civilianProfile } = useEmployeeAuth();
    const [contracts, setContracts] = useState([]);
    const [staff, setStaff] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [recruiters, setRecruiters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState(undefined); // undefined = fermé, null = nouveau, objet = existant

    const issuer = useMemo(() => ({
        uid: currentEmployee?.uid,
        email: currentEmployee?.email || 'Inconnu',
        // Un recruteur est un compte Civil (pas de fiche du personnel) : on prend alors son nom Civil.
        name: staffName
            || [civilianProfile?.firstName, civilianProfile?.lastName].filter(Boolean).join(' ')
            || currentEmployee?.email || 'Le recrutement',
        label: isAdmin ? 'Admin' : 'Recruteur',
        isAdmin,
    }), [currentEmployee, staffName, civilianProfile, isAdmin]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [list, members, roleMap, civilians, recruiterMap] = await Promise.all([
                loadAllContracts(), loadStaffMembers(), loadContractCandidates(), loadCivilians(), loadRecruiterUids(),
            ]);
            setContracts(list);
            setStaff(members.map((m) => ({ ...m, kind: 'staff' })));
            // Recruteurs : comptes Civils portant le drapeau recruiterUIDs (techniquement des employés).
            setRecruiters(civilians.filter((c) => recruiterMap[c.uid] === true).map((c) => ({
                uid: c.uid,
                kind: 'recruiter',
                displayName: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.uid,
                email: c.email || '',
                badge: '',
            })));
            // Candidats avec le rôle : on retrouve leur profil Civil (nom, e-mail).
            setCandidates(civilians.filter((c) => roleMap[c.uid]).map((c) => ({
                uid: c.uid,
                kind: 'candidate',
                displayName: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.uid,
                email: c.email || '',
                badge: '',
                poste: roleMap[c.uid].poste || '',
                role: roleMap[c.uid].role || '',
            })));
        } catch (err) {
            console.error('Chargement des contrats impossible :', err);
            setError('Impossible de charger les contrats.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Destinataires : personnel lié à un compte + candidats en attente de contrat.
    // Dédoublonnés par uid (un compte apparaît une seule fois : fiche du personnel > recruteur > candidat).
    const recipients = useMemo(() => {
        const byUid = new Map();
        [...staff, ...recruiters, ...candidates].forEach((m) => { if (m.uid && !byUid.has(m.uid)) byUid.set(m.uid, m); });
        return [...byUid.values()];
    }, [staff, recruiters, candidates]);

    const handleRemoveRole = async (candidate) => {
        if (!window.confirm(`Retirer le rôle « en attente de contrat » à ${candidate.displayName} ?`)) return;
        try {
            await clearContractCandidate(candidate.uid);
            showNotification('Rôle retiré.', 'info');
            load();
        } catch (err) {
            showNotification(`Action impossible : ${err.message}`, 'error');
        }
    };

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        return contracts.filter((c) => !q || (c.employeNom || '').toLowerCase().includes(q) || (c.champs?.poste || '').toLowerCase().includes(q));
    }, [contracts, query]);

    const handleDelete = async (contract) => {
        const warning = contract.statut === 'signe'
            ? `Supprimer DÉFINITIVEMENT le contrat SIGNÉ de ${contract.employeNom} ? L'employé n'y aura plus accès.`
            : `Supprimer le contrat de ${contract.employeNom} ?`;
        if (!window.confirm(warning)) return;
        try {
            await deleteContract(contract.id);
            sendAdminActionWebhook(issuer.email, 'Contrat supprimé', `Employé : ${contract.employeNom}\nStatut : ${CONTRACT_STATUS[contract.statut]?.label}`, null, issuer.label);
            showNotification('Contrat supprimé.', 'info');
            load();
        } catch (err) {
            showNotification(`Suppression impossible : ${err.message}`, 'error');
        }
    };

    return (
        <div className="dark-ui">
            <div className="d-flex gap-2 mb-3 flex-wrap">
                <Form.Control type="search" style={{ maxWidth: 320 }} placeholder="Rechercher (employé, fonction)…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <Button variant="success" size="sm" onClick={() => setEditing(null)} disabled={loading}>
                    <i className="fas fa-plus-circle me-1"></i>Nouveau contrat
                </Button>
                <Button variant="outline-secondary" size="sm" onClick={load} disabled={loading}><i className="fas fa-sync-alt"></i></Button>
            </div>

            {candidates.length > 0 && (
                <div className="mb-3">
                    <div className="small mb-1" style={{ color: '#8b949e' }}>
                        Candidats acceptés en attente de contrat ({candidates.length}) — ils voient « Mes contrats » et peuvent créer leur signature :
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                        {candidates.map((candidate) => (
                            <Badge key={candidate.uid} bg="info" text="dark" className="d-inline-flex align-items-center gap-2 py-2">
                                {candidate.displayName}{candidate.poste ? ` · ${candidate.poste}` : ''}
                                <button type="button" className="btn-close btn-sm" style={{ fontSize: '0.6rem' }} aria-label="Retirer le rôle"
                                    title="Retirer le rôle « en attente de contrat »" onClick={() => handleRemoveRole(candidate)}></button>
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {loading && <Spinner animation="border" size="sm" />}
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}
            {!loading && !error && rows.length === 0 && <p style={{ color: '#8b949e' }}>Aucun contrat.</p>}

            {rows.length > 0 && (
                <div className="table-responsive">
                    <Table variant="dark" hover size="sm" className="align-middle">
                        <thead><tr><th>Destinataire</th><th>Fonction</th><th>Type</th><th>Début</th><th>Statut</th><th>Créé par</th><th></th></tr></thead>
                        <tbody>
                            {rows.map((c) => (
                                <tr key={c.id}>
                                    <td className="fw-semibold">{c.employeNom}</td>
                                    <td>{c.champs?.poste || '—'}</td>
                                    <td>{c.champs?.typeContrat === 'cdd' ? 'CDD' : 'CDI'}</td>
                                    <td>{c.champs?.dateDebut ? new Date(c.champs.dateDebut).toLocaleDateString('fr-FR') : '—'}</td>
                                    <td><Badge bg={CONTRACT_STATUS[c.statut]?.variant || 'secondary'}>{CONTRACT_STATUS[c.statut]?.label || c.statut}</Badge></td>
                                    <td>{c.creeParNom || '—'}</td>
                                    <td>
                                        <div className="contracts-row-actions">
                                            <Button size="sm" variant="outline-light" onClick={() => setEditing(c)}>
                                                {c.statut === 'brouillon' && (isAdmin || c.employeUid !== issuer.uid)
                                                    ? <><i className="fas fa-edit me-1"></i>Modifier</>
                                                    : <><i className="fas fa-eye me-1"></i>Voir</>}
                                            </Button>
                                            {/* Un contrat signé ne se supprime que par un admin (règles Firebase). */}
                                            {(isAdmin || (c.statut !== 'signe' && c.employeUid !== issuer.uid)) && (
                                                <Button size="sm" variant="outline-danger" onClick={() => handleDelete(c)}><i className="fas fa-trash"></i></Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}

            <ContractEditor
                show={editing !== undefined}
                onHide={() => setEditing(undefined)}
                contract={editing || null}
                staff={recipients}
                issuer={issuer}
                onChanged={load}
                showNotification={showNotification}
            />
        </div>
    );
};

export default ContractsManager;
