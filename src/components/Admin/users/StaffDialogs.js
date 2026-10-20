// src/components/Admin/users/StaffDialogs.js
//
// Boîtes de dialogue du menu « Utilisateurs » : fiche du personnel (ajout / modification),
// suppression définitive, conversions Civil ⇄ Personnel. Toutes les écritures passent par
// utils/staffAdmin.js. Les actions sensibles demandent une confirmation explicite et disent
// ce qui est conservé et ce qui ne l'est pas.
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import {
    rankLabel, badgeDigits, buildBadge, staffNameParts, updateStaffMember, addStaffMember,
    removeStaffMember, convertCivilianToStaff, convertStaffToCivilian, setRecruiterRole,
} from '../../../utils/staffAdmin';
import { STAFF_FAMILIES, familyOfMember, normalizeRank, getRoleInfo, RECRUITER_DEFAULT_RANK } from '../../../constants/ranks';
import RolePicker from './RolePicker';
import { sendAdminActionWebhook } from '../adminUtils';
import { canonicalPatientId } from '../../../utils/patientId';
import EmailChangeFlow from '../../EmailChangeFlow';

const DigitsInput = ({ value, onChange, ...rest }) => (
    <Form.Control
        inputMode="numeric"
        maxLength={5}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
        {...rest}
    />
);

const useBusy = () => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const run = async (fn) => {
        setBusy(true);
        setError('');
        try { await fn(); } catch (e) { console.error(e); setError(e.message || String(e)); } finally { setBusy(false); }
    };
    return { busy, error, setError, run };
};

// ─────────────── Fiche du personnel : ajout / modification ───────────────
// Le rôle se choisit par famille (PHMC Soignant / Administration & Direction / Polyvalent / DMEC) ;
// en modification, la liste d'origine (PHMC ou DMEC) ne change pas : on reste dans ses familles.
// Le droit Recruteur est une case indépendante du rôle (elle n'existe que pour une fiche avec compte).
export const StaffEditDialog = ({ show, onHide, member, defaultFamily = 'soignant', isRecruiter = false, adminEmail, showNotification, onDone }) => {
    const isEdit = !!member;
    const [family, setFamily] = useState(defaultFamily);
    const [form, setForm] = useState({ firstName: '', lastName: '', discord: '', phNumber: '', rank: '', badge: '' });
    const [serviceDirige, setServiceDirige] = useState('');
    const [extraRanks, setExtraRanks] = useState([]);
    const [recruiter, setRecruiter] = useState(false);
    const [emailShown, setEmailShown] = useState('');
    const { busy, error, setError, run } = useBusy();

    const service = STAFF_FAMILIES[family].service;

    useEffect(() => {
        if (!show) return;
        setError('');
        if (member) {
            setFamily(familyOfMember(member, member.service));
            setEmailShown(member.email || '');
            setServiceDirige(member.serviceDirige || '');
            setExtraRanks(member.extraRanks || []);
            setRecruiter(isRecruiter);
            const parts = staffNameParts(member);
            setForm({
                firstName: parts.firstName, lastName: parts.lastName,
                discord: member.discord || '', phNumber: member.phNumber || '',
                // Un ancien rôle anglais (avant migration) est présélectionné sous son équivalent français.
                rank: normalizeRank(member.rank || member.category || ''), badge: badgeDigits(member.badge),
            });
        } else {
            setFamily(defaultFamily);
            setServiceDirige('');
            setExtraRanks([]);
            setRecruiter(false);
            setForm({ firstName: '', lastName: '', discord: '', phNumber: '', rank: '', badge: '' });
        }
    }, [show, member, defaultFamily, isRecruiter, setError]);

    const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

    const handleSave = () => run(async () => {
        if (!form.rank) throw new Error('Choisissez un rôle.');
        // L'ID employé n'est validé qu'à la création : en modification il n'est jamais touché.
        if (!isEdit && !/^\d{4,5}$/.test(form.badge)) throw new Error('Le numéro de badge doit contenir 4 ou 5 chiffres.');
        if (isEdit) {
            const newName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
            if (newName && newName !== member.name && !window.confirm(
                `Renommer « ${member.displayName} » en « ${newName} » ?\n\nSes rapports sauvegardés et leurs dossiers patients sont migrés automatiquement vers le nouveau nom. Son ID employé (${member.badge}) ne change pas.`
            )) return;
            const outcome = await updateStaffMember(member, {
                firstName: form.firstName, lastName: form.lastName, rank: form.rank, discord: form.discord, phNumber: form.phNumber, serviceDirige, extraRanks,
            });
            if (member.uid && recruiter !== isRecruiter) {
                await setRecruiterRole(member.uid, recruiter);
                sendAdminActionWebhook(adminEmail, recruiter ? 'Rôle recruteur attribué' : 'Rôle recruteur retiré', `Membre : ${member.displayName}`, null, 'Admin');
            }
            sendAdminActionWebhook(adminEmail, 'Fiche du personnel modifiée', `Membre : ${outcome.renamed ? `${outcome.previousName} → ${newName}` : member.displayName}\nRôle : ${rankLabel(member.service, form.rank)}\nID employé : ${member.badge}`, null, 'Admin');
            showNotification(outcome.renamed ? `${outcome.previousName} renommé(e) en ${newName} (rapports migrés).` : `Fiche de ${member.displayName} mise à jour.`, 'success');
        } else {
            if (!form.firstName.trim() || !form.lastName.trim()) throw new Error('Prénom et nom obligatoires.');
            await addStaffMember(service, {
                firstName: form.firstName.trim(), lastName: form.lastName.trim(),
                discord: form.discord, phNumber: form.phNumber, rank: form.rank, badgeDigitsValue: form.badge, serviceDirige, extraRanks,
            });
            sendAdminActionWebhook(adminEmail, 'Membre du personnel ajouté', `Membre : ${form.firstName} ${form.lastName}\nFamille : ${STAFF_FAMILIES[family].label}\nRôle : ${rankLabel(service, form.rank)}`, null, 'Admin');
            showNotification(`${form.firstName} ${form.lastName} ajouté(e) au personnel (sans compte de connexion).`, 'success');
        }
        onDone();
        onHide();
    });

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>{isEdit ? `Modifier ${member.displayName}` : 'Ajouter un membre du personnel'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <div className="d-flex gap-2 mb-3">
                    <Form.Group className="flex-fill">
                        <Form.Label>Prénom</Form.Label>
                        <Form.Control value={form.firstName} onChange={set('firstName')} />
                    </Form.Group>
                    <Form.Group className="flex-fill">
                        <Form.Label>Nom</Form.Label>
                        <Form.Control value={form.lastName} onChange={set('lastName')} />
                    </Form.Group>
                </div>
                {isEdit && (
                    <p className="text-muted small">
                        Le prénom et le nom sont modifiables : la fiche est enregistrée sur l'<strong>ID employé</strong> (non modifiable),
                        et les rapports de la personne suivent automatiquement le nouveau nom.
                    </p>
                )}
                <RolePicker
                    family={family}
                    onFamilyChange={(value) => { setFamily(value); setForm((p) => ({ ...p, rank: '' })); }}
                    rank={form.rank}
                    onRankChange={(value) => setForm((p) => ({ ...p, rank: value }))}
                    serviceDirige={serviceDirige}
                    onServiceDirigeChange={setServiceDirige}
                    extraRanks={extraRanks}
                    onExtraRanksChange={setExtraRanks}
                    allowedServices={isEdit ? [member.service] : null}
                    idPrefix="staff-edit"
                />
                <div className="d-flex gap-2 mb-3">
                    <Form.Group className="flex-fill">
                        <Form.Label>{isEdit ? 'ID employé (badge) — non modifiable' : 'ID employé / badge (4 ou 5 chiffres)'}</Form.Label>
                        {isEdit ? (
                            <Form.Control value={buildBadge(service, form.rank || member.rank, form.badge)} disabled
                                title="L'ID employé est unique (lié à l'UCP). C'est aussi l'ID patient PHMC-{ID} de la personne." />
                        ) : (
                            <DigitsInput value={form.badge} onChange={(v) => setForm((p) => ({ ...p, badge: v }))} placeholder="00000" />
                        )}
                        {isEdit && <Form.Text className="text-muted">ID patient : PHMC-{form.badge}</Form.Text>}
                    </Form.Group>
                    <Form.Group className="flex-fill">
                        <Form.Label>Téléphone</Form.Label>
                        <Form.Control value={form.phNumber} onChange={set('phNumber')} />
                    </Form.Group>
                </div>
                <Form.Group>
                    <Form.Label>Discord</Form.Label>
                    <Form.Control value={form.discord} onChange={set('discord')} />
                </Form.Group>
                {isEdit && member.uid && (
                    <Form.Check
                        className="mt-3"
                        type="switch"
                        id="staff-edit-recruiter"
                        checked={recruiter}
                        onChange={(e) => setRecruiter(e.target.checked)}
                        label="Droit Recruteur (gestion du recrutement et des contrats)"
                    />
                )}
                {isEdit && member.uid && (
                    <div className="mt-3">
                        {/* E-mail : modifiable uniquement s'il s'agit d'une adresse Eyefind Mail, après code de vérification. */}
                        <EmailChangeFlow currentEmail={emailShown} targetUid={member.uid} onChanged={(email) => { setEmailShown(email); onDone(); }} />
                    </div>
                )}
                {!isEdit && (
                    <p className="text-muted small mt-3 mb-0">
                        Cette fiche n'a pas de compte de connexion : la personne en obtient un via « Demandes de compte », ou en
                        convertissant son compte Civil existant depuis l'onglet Civils.
                    </p>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                <Button variant="primary" onClick={handleSave} disabled={busy}>
                    {busy ? <Spinner size="sm" animation="border" /> : (isEdit ? 'Enregistrer' : 'Ajouter')}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

// ─────────────── Suppression définitive ───────────────
export const RemoveStaffDialog = ({ show, onHide, member, allStaff, adminEmail, showNotification, onDone }) => {
    const [transferTo, setTransferTo] = useState('');
    const [typed, setTyped] = useState('');
    const { busy, error, setError, run } = useBusy();

    useEffect(() => { if (show) { setTransferTo(''); setTyped(''); setError(''); } }, [show, setError]);
    if (!member) return null;
    const confirmed = typed.trim().toLowerCase() === member.displayName.toLowerCase();

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton><Modal.Title>Supprimer {member.displayName}</Modal.Title></Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Alert variant="danger">
                    <strong>Suppression définitive.</strong> La fiche du personnel, <strong>le compte de connexion</strong> et
                    (sauf transfert) <strong>tous les rapports</strong> de cette personne seront supprimés, et un mail de fin de
                    fonctions lui sera envoyé.
                </Alert>
                <p className="small">
                    Pour que la personne garde son compte (par exemple pour devenir patiente ou candidate), utilisez
                    plutôt <strong>« Passer en Civil »</strong> : rien n'est supprimé.
                </p>
                <Form.Group className="mb-3">
                    <Form.Label>Rapports de {member.displayName}</Form.Label>
                    <Form.Select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                        <option value="">— Supprimer les rapports (aucun transfert) —</option>
                        {allStaff.filter((m) => m.name !== member.name).map((m) => (
                            <option key={`${m.service}-${m.name}`} value={m.name}>Transférer vers {m.displayName}</option>
                        ))}
                    </Form.Select>
                </Form.Group>
                <Form.Group>
                    <Form.Label>Pour confirmer, tapez « {member.displayName} »</Form.Label>
                    <Form.Control value={typed} onChange={(e) => setTyped(e.target.value)} />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                <Button variant="danger" disabled={!confirmed || busy} onClick={() => run(async () => {
                    await removeStaffMember(member, { transferTo: transferTo || null });
                    sendAdminActionWebhook(adminEmail, 'Membre du personnel supprimé', `Membre : ${member.displayName}\nRapports : ${transferTo ? `transférés vers ${transferTo}` : 'supprimés'}`, null, 'Admin');
                    showNotification(`${member.displayName} supprimé(e) du personnel.`, 'success');
                    onDone();
                    onHide();
                })}>
                    {busy ? <Spinner size="sm" animation="border" /> : 'Supprimer définitivement'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

// ─────────────── Personnel → Civil ───────────────
export const ConvertToCivilDialog = ({ show, onHide, member, hasCivilProfile, adminEmail, showNotification, onDone }) => {
    const [patientID, setPatientID] = useState('');
    const { busy, error, setError, run } = useBusy();

    useEffect(() => {
        if (!show || !member) return;
        setError('');
        setPatientID(member.gtawCharacterId != null ? `PHMC-${member.gtawCharacterId}` : '');
    }, [show, member, setError]);
    if (!member) return null;
    const needsId = !hasCivilProfile && !patientID.trim();

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton><Modal.Title>Passer {member.displayName} en Civil</Modal.Title></Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <p>
                    Les fonctions de <strong>{member.displayName}</strong> ({rankLabel(member.service, member.rank)}) prennent fin :
                    sa fiche du personnel est retirée et elle/il redevient un compte <strong>Civil</strong>.
                </p>
                <ul className="small">
                    <li><strong>Conservés :</strong> le compte de connexion, son profil Civil (ou un nouveau profil créé ci-dessous), ses dossiers de patient.</li>
                    <li><strong>Non supprimés :</strong> ses rapports. Ils restent rangés sous son nom de personnel : un administrateur peut les retrouver ou les migrer, mais la personne ne les verra plus dans son compte Civil.</li>
                    <li><strong>Mail :</strong> un message l'informe de la fin de ses fonctions.</li>
                </ul>
                {!hasCivilProfile && (
                    <Form.Group className="mb-2">
                        <Form.Label>ID patient du nouveau profil Civil *</Form.Label>
                        <Form.Control value={patientID} onChange={(e) => setPatientID(e.target.value)}
                            onBlur={() => setPatientID((v) => (v.trim() ? canonicalPatientId(v) : v))} placeholder="ex. PHMC-2752" />
                        <Form.Text className="text-muted">
                            Cette personne n'a pas encore de profil Civil : il est créé avec son identité de personnel. Elle complétera le reste elle-même.
                        </Form.Text>
                    </Form.Group>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                <Button variant="warning" disabled={busy || needsId} onClick={() => run(async () => {
                    await convertStaffToCivilian(member, { patientID });
                    sendAdminActionWebhook(adminEmail, 'Personnel → Civil', `Membre : ${member.displayName}\nRôle retiré : ${rankLabel(member.service, member.rank)}`, null, 'Admin');
                    showNotification(`${member.displayName} est maintenant un compte Civil.`, 'success');
                    onDone();
                    onHide();
                })}>
                    {busy ? <Spinner size="sm" animation="border" /> : 'Confirmer le passage en Civil'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

// ─────────────── Civil → Personnel ───────────────
// `presetRecruiter` : nommer un recruteur. Un recruteur est du personnel (famille Administration & Direction,
// rôle par défaut « Chargé de Recrutement ») : il se connecte par le portail personnel et figure dans la liste
// des membres du PHMC. Ses droits ne changent pas : le droit Recruteur reste une case indépendante du rôle,
// et son profil Civil est conservé.
// `suggestedRole` : rôle relié au poste de la candidature acceptée (poste de recrutement → rôle), proposé par défaut.
export const ConvertToStaffDialog = ({ show, onHide, civilian, presetRecruiter = false, suggestedRole = '', adminEmail, showNotification, onDone }) => {
    const [family, setFamily] = useState('soignant');
    const [rank, setRank] = useState('');
    const [serviceDirige, setServiceDirige] = useState('');
    const [extraRanks, setExtraRanks] = useState([]);
    const [recruiter, setRecruiter] = useState(false);
    const [badge, setBadge] = useState('');
    const { busy, error, setError, run } = useBusy();

    useEffect(() => {
        if (!show || !civilian) return;
        setError('');
        const suggested = !presetRecruiter && suggestedRole ? getRoleInfo(suggestedRole) : null;
        setFamily(presetRecruiter ? 'administration' : (suggested?.pole || 'soignant'));
        setRank(presetRecruiter ? RECRUITER_DEFAULT_RANK : (suggested?.value || ''));
        setServiceDirige('');
        setExtraRanks([]);
        setRecruiter(presetRecruiter);
        // L'ID du personnage GTA World sert de badge s'il tient sur 4-5 chiffres ; sinon à saisir.
        const characterId = civilian.gtawCharacterId != null ? String(civilian.gtawCharacterId) : '';
        setBadge(/^\d{4,5}$/.test(characterId) ? characterId : '');
    }, [show, civilian, presetRecruiter, suggestedRole, setError]);
    if (!civilian) return null;
    const name = `${civilian.firstName || ''} ${civilian.lastName || ''}`.trim() || civilian.email;
    const service = STAFF_FAMILIES[family].service;

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton><Modal.Title>{presetRecruiter ? `Nommer ${name} recruteur` : `Passer ${name} en Personnel`}</Modal.Title></Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <p className="small">
                    La fiche du personnel est créée avec le <strong>même compte de connexion</strong> : la personne se connecte désormais par le
                    portail du personnel. Le profil Civil et les dossiers de patient sont <strong>conservés</strong>. Elle doit se reconnecter
                    pour voir ses nouveaux outils.
                </p>
                <RolePicker
                    family={family}
                    onFamilyChange={(value) => { setFamily(value); setRank(''); }}
                    rank={rank}
                    onRankChange={setRank}
                    serviceDirige={serviceDirige}
                    onServiceDirigeChange={setServiceDirige}
                    extraRanks={extraRanks}
                    onExtraRanksChange={setExtraRanks}
                    idPrefix="convert-staff"
                />
                <Form.Group className="mb-3">
                    <Form.Label>Badge (4 ou 5 chiffres)</Form.Label>
                    <DigitsInput value={badge} onChange={setBadge} placeholder="00000" />
                </Form.Group>
                <Form.Check
                    type="switch"
                    id="convert-staff-recruiter"
                    checked={recruiter}
                    onChange={(e) => setRecruiter(e.target.checked)}
                    label="Droit Recruteur (gestion du recrutement et des contrats)"
                />
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                <Button variant="success" disabled={busy || !rank || !/^\d{4,5}$/.test(badge)} onClick={() => run(async () => {
                    await convertCivilianToStaff(civilian, { service, rank, badgeDigitsValue: badge, serviceDirige, extraRanks });
                    if (recruiter) await setRecruiterRole(civilian.uid, true);
                    sendAdminActionWebhook(adminEmail, recruiter ? 'Civil → Personnel (recruteur)' : 'Civil → Personnel', `Compte : ${name}\nFamille : ${STAFF_FAMILIES[family].label}\nRôle : ${rankLabel(service, rank)}`, null, 'Admin');
                    showNotification(`${name} est maintenant membre du personnel${recruiter ? ' et recruteur' : ''}.`, 'success');
                    onDone();
                    onHide();
                })}>
                    {busy ? <Spinner size="sm" animation="border" /> : 'Confirmer le passage en Personnel'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};
