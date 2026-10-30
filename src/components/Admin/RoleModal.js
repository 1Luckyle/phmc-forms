// src/components/Admin/RoleModal.js
//
// Fenêtre d'ajout / de modification d'un POSTE de recrutement, en français : les champs suivent le schéma
// de constants/recruitment.js (nom, statut OUVERT/FERMÉ, contact, codeCourt, presentation,
// competence1-3, diplome). Chaque poste est relié à un RÔLE du personnel (référentiel constants/ranks.js) :
// c'est le rôle que la personne recevra à l'embauche (conversion en personnel, contrat).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Form as BootstrapForm, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get } from "firebase/database";
import ReactDOM from 'react-dom';
import DebugFillButton from '../DebugFillButton';
import { STAFF_FAMILIES, ROLES, rolesByFiliere, normalizeRank } from '../../constants/ranks';
import { STATUT_OUVERT, STATUT_FERME, makePositionKey } from '../../constants/recruitment';
import { savePosition, positionsPath, getActiveStore } from '../../utils/recruitmentStore';
import { loadSalaryGrid, echelonOf, addGradeIfMissing, formatEchelonRates } from '../../utils/salaryGrid';
import { referenceEchelonOf } from '../../constants/salaryReference';
import EchelonGuide from './EchelonGuide';
import { createCustomRole, validateNewRole, suggestBadgePrefix, DEFAULT_FILIERE } from '../../utils/customRoles';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';

// Grades de la grille par échelon : { [numéro]: [noms] }, pour l'aide à la saisie.
const gradeUsage = (grid) => Object.values(grid.grades).reduce((usage, entry) => {
    (usage[entry.echelon] = usage[entry.echelon] || []).push(entry.grade);
    return usage;
}, {});

// Valeur du sélecteur de rôle qui ouvre la création d'un nouveau rôle du personnel.
const NEW_ROLE = '__nouveau__';
const EMPTY_NEW_ROLE = { value: '', pole: 'soignant', badgePrefix: '', filiere: '' };
const snapshot = (roleData, newRole, echelonPick) => JSON.stringify({ roleData, newRole, echelonPick });

const getInitialRoleState = (category) => ({
    nom: '',
    groupe: category?.key || '',
    statut: STATUT_OUVERT,
    role: '',
    contact: '',
    codeCourt: '',
    presentation: '',
    competence1: '',
    competence2: '',
    competence3: '',
    diplome: '',
});

// --- Styles ---
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1040,
};
const modalContentStyle = {
    position: 'relative', backgroundColor: '#2a2a2e', color: '#e1e1e1',
    padding: '25px 30px', borderRadius: '10px', boxShadow: '0 7px 20px rgba(0,0,0,0.5)',
    zIndex: 1050, width: '90%', maxWidth: '750px', maxHeight: '88vh',
    display: 'flex', flexDirection: 'column', border: '1px solid #444',
};
const modalHeaderStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid #444', paddingBottom: '15px', marginBottom: '20px',
    color: '#ffffff',
};
const modalTitleStyle = { margin: 0, fontSize: '1.4rem', fontWeight: '500' };
const modalBodyStyle = {
    overflowY: 'auto', flexGrow: 1, scrollbarWidth: 'thin', scrollbarColor: '#555 #333',
};
const modalFooterStyle = {
    display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #444',
    paddingTop: '20px', marginTop: '25px',
};

// `category` : catégorie de recrutement (RECRUITMENT_CATEGORIES). `roleToEdit` : poste français (avec `cle`).
const RoleModal = ({ show, onHide, category, showNotification, onRoleSaved, roleToEdit }) => {
    const initialRoleState = useMemo(() => getInitialRoleState(category), [category]);
    const [roleData, setRoleData] = useState(() => roleToEdit ? { ...initialRoleState, ...roleToEdit } : initialRoleState);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const { staffName, currentEmployee } = useEmployeeAuth();
    const actorName = staffName || currentEmployee?.email || '';

    // Nouveau rôle du personnel (si « Créer un nouveau rôle… » est choisi) et échelon d'un rôle qui n'est pas encore dans la grille salariale (un rôle a UN échelon).
    const [newRole, setNewRole] = useState(EMPTY_NEW_ROLE);
    const [prefixTouched, setPrefixTouched] = useState(false);
    const [echelonPick, setEchelonPick] = useState('');   // numéro d'échelon choisi (1 à 15) ou ''
    const [guideOpen, setGuideOpen] = useState(false);   // grille des échelons ouverte sur le côté
    const [grid, setGrid] = useState(null);   // grille salariale publiée (échelon du rôle choisi)

    // Valeurs à l'ouverture : sert à savoir si l'utilisateur a modifié quelque chose.
    const [baseline, setBaseline] = useState('');

    useEffect(() => {
        if (show) {
            const initial = roleToEdit
                ? { ...initialRoleState, ...roleToEdit, role: normalizeRank(roleToEdit.role || '') }
                : initialRoleState;
            setRoleData(initial);
            setNewRole(EMPTY_NEW_ROLE);
            setPrefixTouched(false);
            setEchelonPick('');
            setGuideOpen(false);
            setBaseline(snapshot(initial, EMPTY_NEW_ROLE, ''));
            setError('');
            let cancelled = false;
            loadSalaryGrid().then((loaded) => { if (!cancelled) setGrid(loaded); });
            return () => { cancelled = true; };
        }
        return undefined;
    }, [show, roleToEdit, initialRoleState]);

    // Rôle effectif du poste : celui qu'on crée, ou celui choisi dans la liste.
    const creatingRole = roleData.role === NEW_ROLE;
    const effectiveRole = creatingRole ? newRole.value.trim() : roleData.role;
    // Échelon déjà défini par la grille pour ce rôle (alors non modifiable ici : il se change dans Comptabilité → Transparence), sinon à choisir parmi les 15.
    const gradeEchelon = useMemo(() => (effectiveRole && grid ? echelonOf(grid, effectiveRole) : null), [grid, effectiveRole]);
    const needsEchelon = !!effectiveRole && !!grid && !gradeEchelon;
    const shownEchelon = gradeEchelon || (needsEchelon && echelonPick ? grid.echelons[echelonPick - 1] : null);

    // Rôle d'origine qui figure dans la grille de référence : son échelon de référence est proposé d'office. Il ne compte pas comme une modification faite par la
    // personne (la valeur initiale en tient compte).
    useEffect(() => {
        if (!show || !needsEchelon || echelonPick !== '' || creatingRole) return;
        const reference = referenceEchelonOf(effectiveRole);
        if (!reference) return;
        if (baseline === snapshot(roleData, newRole, echelonPick)) setBaseline(snapshot(roleData, newRole, reference));
        setEchelonPick(reference);
    }, [show, needsEchelon, echelonPick, creatingRole, effectiveRole, baseline, roleData, newRole]);

    const requiredFields = useMemo(() => [
        'nom', 'codeCourt', 'contact', 'presentation', 'competence1', 'competence2', 'competence3', 'diplome',
    ], []);
    const isFormValid = requiredFields.every((field) => String(roleData[field] ?? '').trim() !== '');

    // CRÉATION : tous les champs sont requis. MODIFICATION : le bouton s'active dès qu'un champ change
    // (un poste existant peut avoir des champs vides — anciens postes — sans qu'on puisse alors
    // enregistrer la moindre correction) ; seul le nom doit rester renseigné.
    const isDirty = baseline !== '' && snapshot(roleData, newRole, echelonPick) !== baseline;

    // Rôle et échelon : un nouveau rôle doit être complet (nom, famille, préfixe) ; un rôle absent de la grille doit recevoir son échelon.
    const roleErrors = useMemo(() => (creatingRole ? validateNewRole({ ...newRole, value: newRole.value.trim() }) : []), [creatingRole, newRole]);
    const echelonErrors = (() => {
        if (!effectiveRole) return [];
        if (!grid) return creatingRole ? ['La grille salariale est en cours de chargement.'] : [];
        return needsEchelon && !echelonPick ? ["Choisissez l'échelon de ce rôle (le salaire en dépend)."] : [];
    })();
    const roleBlockValid = roleErrors.length === 0 && echelonErrors.length === 0;
    const canSave = roleBlockValid && (roleToEdit
        ? isDirty && String(roleData.nom || '').trim() !== ''
        : isFormValid);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setRoleData((prev) => ({ ...prev, [name]: value }));
    }, []);

    // Changer de rôle : l'échelon choisi pour un autre rôle n'a pas de sens (l'échelon de référence du nouveau rôle est posé par l'effet ci-dessus).
    const handleRoleChange = useCallback((e) => {
        const { value } = e.target;
        setRoleData((prev) => ({ ...prev, role: value }));
        setEchelonPick('');
    }, []);

    const changeNewRole = (field, value) => setNewRole((prev) => {
        const next = { ...prev, [field]: value };
        if (field === 'value' && !prefixTouched) next.badgePrefix = suggestBadgePrefix(value);
        if (field === 'pole') next.filiere = '';
        return next;
    });

    // Mode debug : remplit un poste de test (le nom d'un poste existant en modification n'est pas touché :
    // il détermine la clé Firebase).
    const handleDebugFill = useCallback(() => {
        setRoleData((prev) => ({
            ...prev,
            ...(roleToEdit ? {} : { nom: '[TEST] Poste de démonstration' }),
            statut: STATUT_OUVERT,
            contact: 'Testeur Debug (testeur.debug)',
            codeCourt: 'TEST-DBG',
            presentation: "[TEST] Poste généré par le mode debug pour vérifier l'affichage.",
            competence1: 'Compétence de test numéro 1',
            competence2: 'Compétence de test numéro 2',
            competence3: 'Compétence de test numéro 3',
            diplome: 'Diplôme de test',
        }));
    }, [roleToEdit]);

    const handleClose = useCallback(() => {
        setRoleData(initialRoleState);
        setError('');
        onHide();
    }, [onHide, initialRoleState]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError('');

        if (!canSave) {
            setError(roleErrors[0] || echelonErrors[0] || (roleToEdit
                ? 'Modifiez au moins un champ (le nom ne peut pas être vide).'
                : 'Tous les champs marqués d\'un * sont obligatoires, et les autres doivent également être remplis.'));
            if (showNotification) showNotification('Veuillez remplir tous les champs du formulaire.', 'warning');
            return;
        }

        const key = roleToEdit?.cle || makePositionKey(roleData.nom);
        if (!key) {
            setError('Le nom ne peut pas être vide ou invalide pour la génération de la clé.');
            if (showNotification) showNotification('Le nom n\'est pas valide pour cette clé.', 'warning');
            return;
        }
        if (!category) {
            setError('Configuration de catégorie invalide.');
            return;
        }

        setIsSaving(true);
        try {
            // 1) Nouveau rôle du personnel (ajouté aux rôles d'origine) ; 2) son échelon dans la grille salariale (ou celui d'un rôle qui n'y figurait pas encore).
            let roleValue = roleData.role === NEW_ROLE ? '' : roleData.role;
            if (roleData.role === NEW_ROLE) {
                const created = await createCustomRole({ ...newRole, value: newRole.value.trim() }, actorName);
                roleValue = created.value;
            }
            if (roleValue && needsEchelon) await addGradeIfMissing(roleValue, echelonPick);

            const store = await getActiveStore(category);
            if (!roleToEdit) {
                const snapshot = await get(ref(database, `${positionsPath(category, store)}/${key}`));
                if (snapshot.exists()) {
                    setError(`Un poste de clé "${key}" existe déjà.`);
                    if (showNotification) showNotification(`La clé de poste "${key}" existe déjà.`, 'error');
                    setIsSaving(false);
                    return;
                }
            }

            // L'échelon n'est plus enregistré avec le poste : il vient de la grille, d'après le rôle (un ancien champ `echelon` est abandonné).
            const { cle, echelon, ...position } = { ...roleData, role: roleValue }; // eslint-disable-line no-unused-vars
            await savePosition(category, key, { ...position, groupe: category.key }, store);

            if (onRoleSaved) onRoleSaved({ ...position, groupe: category.key, cle: key }, roleToEdit ? 'edited' : 'added');
            handleClose();
        } catch (dbError) {
            setError(`Échec de ${roleToEdit ? 'la modification' : 'l\'ajout'} du poste : ${dbError.message}`);
            if (showNotification) showNotification(`Échec de ${roleToEdit ? 'la modification' : 'l\'ajout'} du poste. ${dbError.message}`, "error");
        }
        setIsSaving(false);
    }, [roleData, newRole, needsEchelon, echelonPick, roleErrors, echelonErrors, actorName, category, showNotification, onRoleSaved, handleClose, canSave, roleToEdit]);

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape') handleClose();
        };
        if (show) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [show, handleClose]);

    if (!show) return null;

    const modalTitleText = roleToEdit ? ` ${roleToEdit.nom || roleToEdit.cle}` : `Ajouter un poste — ${category?.label || 'Catégorie'}`;
    const submitButtonText = roleToEdit ? (isSaving ? 'Enregistrement...' : 'Enregistrer les modifications') : (isSaving ? 'Enregistrement...' : 'Enregistrer le poste');

    const modalPortalContent = (
        <div style={{ ...modalOverlayStyle, gap: '16px', flexWrap: 'wrap', overflowY: 'auto', padding: '16px' }} onClick={handleClose}>
            <div style={{ ...modalContentStyle, width: 'min(90%, 750px)', flex: '0 1 750px' }} onClick={(e) => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>{modalTitleText}</h5>
                    <Button variant="link" onClick={handleClose} aria-label="Fermer" style={{ color: '#aaa', textDecoration: 'none', fontSize: '1.5rem', padding: '0 .5rem', lineHeight: 1 }}>
                        &times;
                    </Button>
                </div>
                <div style={modalBodyStyle}>
                    <BootstrapForm onSubmit={handleSubmit} noValidate>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Nom du poste *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="nom" value={roleData.nom || ''} onChange={handleChange} required placeholder="ex. Paramedic Sénior" />
                        </BootstrapForm.Group>

                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Catégorie de recrutement</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" value={category?.label || ''} readOnly />
                        </BootstrapForm.Group>

                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Rôle du personnel obtenu à l'embauche</BootstrapForm.Label>
                            <BootstrapForm.Select name="role" value={roleData.role || ''} onChange={handleRoleChange}>
                                <option value="">— Non défini —</option>
                                {Object.values(STAFF_FAMILIES).map((family) => (
                                    <optgroup key={family.key} label={family.label}>
                                        {rolesByFiliere(family.key).flatMap((group) => group.roles).map((role) => (
                                            <option key={role.value} value={role.value}>{role.label}{role.custom ? ' (ajouté)' : ''}</option>
                                        ))}
                                    </optgroup>
                                ))}
                                <option value={NEW_ROLE}>➕ Créer un nouveau rôle du personnel…</option>
                            </BootstrapForm.Select>
                            <BootstrapForm.Text className="text-muted">
                                Sert à pré-remplir le rôle quand un candidat accepté devient membre du personnel, et son contrat.
                            </BootstrapForm.Text>
                        </BootstrapForm.Group>

                        {creatingRole && (
                            <div className="mb-3 p-3" style={{ border: '1px solid #3b82f6', borderRadius: '8px', background: 'rgba(59,130,246,0.07)' }}>
                                <div style={{ fontWeight: 600, marginBottom: '10px' }}>Nouveau rôle du personnel</div>
                                <BootstrapForm.Group className="mb-2">
                                    <BootstrapForm.Label>Nom du rôle *</BootstrapForm.Label>
                                    <BootstrapForm.Control type="text" value={newRole.value} maxLength={60} placeholder="ex. Technicien(ne) de laboratoire" onChange={(e) => changeNewRole('value', e.target.value)} />
                                </BootstrapForm.Group>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
                                    <BootstrapForm.Group>
                                        <BootstrapForm.Label>Famille *</BootstrapForm.Label>
                                        <BootstrapForm.Select value={newRole.pole} onChange={(e) => changeNewRole('pole', e.target.value)}>
                                            {Object.values(STAFF_FAMILIES).map((family) => <option key={family.key} value={family.key}>{family.label}</option>)}
                                        </BootstrapForm.Select>
                                    </BootstrapForm.Group>
                                    <BootstrapForm.Group>
                                        <BootstrapForm.Label>Préfixe de badge *</BootstrapForm.Label>
                                        <BootstrapForm.Control type="text" value={newRole.badgePrefix} maxLength={4} placeholder="ex. TL"
                                            onChange={(e) => { setPrefixTouched(true); changeNewRole('badgePrefix', e.target.value.toUpperCase().replace(/[^A-Z]/g, '')); }} />
                                    </BootstrapForm.Group>
                                    <BootstrapForm.Group>
                                        <BootstrapForm.Label>Filière <small className="text-muted">(facultatif)</small></BootstrapForm.Label>
                                        <BootstrapForm.Control type="text" list="role-modal-filieres" value={newRole.filiere} placeholder={DEFAULT_FILIERE[newRole.pole]} maxLength={60}
                                            onChange={(e) => changeNewRole('filiere', e.target.value)} />
                                        <datalist id="role-modal-filieres">
                                            {[...new Set(ROLES.filter((role) => role.pole === newRole.pole).map((role) => role.filiere))].map((name) => <option key={name} value={name} />)}
                                        </datalist>
                                    </BootstrapForm.Group>
                                </div>
                                <BootstrapForm.Text className="text-muted d-block mt-2">
                                    Le rôle s'ajoute à ceux d'origine : il se choisit ensuite partout (fiche du personnel, contrat). Son préfixe commence les badges (ex. TL-123). La famille décide de ses accès.
                                </BootstrapForm.Text>
                                {roleErrors.length > 0 && newRole.value.trim() !== '' && <p className="text-warning small mb-0 mt-2">{roleErrors[0]}</p>}
                            </div>
                        )}

                        {effectiveRole && grid && (
                            <BootstrapForm.Group className="mb-3">
                                <div className="d-flex flex-wrap justify-content-between align-items-end gap-2">
                                    <BootstrapForm.Label className="mb-1">Échelon de la grille salariale{needsEchelon ? ' *' : ''}</BootstrapForm.Label>
                                    <Button size="sm" variant={guideOpen ? 'primary' : 'outline-primary'} className="mb-1" onClick={() => setGuideOpen((open) => !open)} aria-pressed={guideOpen}>
                                        <i className="fas fa-list-ol me-1"></i>{guideOpen ? 'Masquer la grille des échelons' : 'Voir la grille des échelons'}
                                    </Button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                                    <BootstrapForm.Select
                                        aria-label="Échelon" value={gradeEchelon ? gradeEchelon.numero : echelonPick} disabled={!!gradeEchelon}
                                        onChange={(e) => setEchelonPick(e.target.value === '' ? '' : Number(e.target.value))}
                                    >
                                        {!gradeEchelon && <option value="">Choisir un échelon…</option>}
                                        {(grid.echelons || []).map((e) => <option key={e.numero} value={e.numero}>{e.libelle} — {formatEchelonRates(e)}</option>)}
                                    </BootstrapForm.Select>
                                    <div className="input-group" style={{ flexWrap: 'nowrap' }}>
                                        <BootstrapForm.Control type="text" value={shownEchelon ? shownEchelon.horaire : ''} aria-label="Montant à l'heure" placeholder="À l'heure" disabled readOnly />
                                        <span className="input-group-text">$ / h</span>
                                    </div>
                                    <div className="input-group" style={{ flexWrap: 'nowrap' }}>
                                        <BootstrapForm.Control type="text" value={shownEchelon ? shownEchelon.hebdo : ''} aria-label="Montant à la semaine" placeholder="À la semaine" disabled readOnly />
                                        <span className="input-group-text">$ / sem.</span>
                                    </div>
                                </div>
                                <BootstrapForm.Text className="text-muted d-block">
                                    {gradeEchelon
                                        ? "Échelon de ce rôle dans la grille : un rôle n'a qu'un échelon, qui fixe son salaire. Il se modifie, avec le salaire des échelons, dans Comptabilité → Transparence."
                                        : "Ce rôle n'est pas encore dans la grille salariale : son échelon fixe son salaire (les montants se remplissent seuls) et il y sera rangé à l'enregistrement."}
                                </BootstrapForm.Text>
                                {echelonErrors.length > 0 && echelonPick === '' && <p className="text-warning small mb-0 mt-1">{echelonErrors[0]}</p>}
                            </BootstrapForm.Group>
                        )}

                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Statut *</BootstrapForm.Label>
                            <BootstrapForm.Select name="statut" value={roleData.statut || STATUT_OUVERT} onChange={handleChange} required>
                                <option value={STATUT_OUVERT}>OUVERT</option>
                                <option value={STATUT_FERME}>FERMÉ</option>
                            </BootstrapForm.Select>
                        </BootstrapForm.Group>

                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Point de contact *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="contact" value={roleData.contact || ''} onChange={handleChange} required placeholder="ex. Jean Dupont (jeandupont#1234)" />
                        </BootstrapForm.Group>

                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Code court *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="codeCourt" value={roleData.codeCourt || ''} onChange={handleChange} required placeholder="ex. PARAMEDIC" />
                        </BootstrapForm.Group>

                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Présentation du poste *</BootstrapForm.Label>
                            <BootstrapForm.Control as="textarea" rows={4} name="presentation" value={roleData.presentation || ''} onChange={handleChange} required placeholder="Description du poste, missions…" />
                        </BootstrapForm.Group>

                        <BootstrapForm.Group className="mb-3"><BootstrapForm.Label>Compétence requise 1 *</BootstrapForm.Label><BootstrapForm.Control as="textarea" rows={2} name="competence1" value={roleData.competence1 || ''} onChange={handleChange} required placeholder="ex. Soins de réanimation avancés" /></BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3"><BootstrapForm.Label>Compétence requise 2 *</BootstrapForm.Label><BootstrapForm.Control as="textarea" rows={2} name="competence2" value={roleData.competence2 || ''} onChange={handleChange} required placeholder="ex. Conduite d'urgence" /></BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3"><BootstrapForm.Label>Compétence requise 3 *</BootstrapForm.Label><BootstrapForm.Control as="textarea" rows={2} name="competence3" value={roleData.competence3 || ''} onChange={handleChange} required placeholder="ex. Évaluation du patient" /></BootstrapForm.Group>

                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Diplôme / formation exigés *</BootstrapForm.Label>
                            <BootstrapForm.Control as="textarea" rows={3} name="diplome" value={roleData.diplome || ''} onChange={handleChange} required placeholder="ex. Certification EMT-P (les diplômes américains restent en anglais : MD, DO, BSN…)" />
                        </BootstrapForm.Group>

                        {error && <p className="text-danger mt-2 mb-0">{error}</p>}

                        <div style={modalFooterStyle}>
                            <DebugFillButton onFill={handleDebugFill} disabled={isSaving} style={{ marginRight: 'auto' }} />
                            <Button variant="secondary" onClick={handleClose} disabled={isSaving}>Annuler</Button>
                            <Button variant="primary" type="submit" disabled={isSaving || !canSave} style={{ minWidth: '120px', marginLeft: '10px' }}>
                                {isSaving ? <Spinner as="span" animation="border" size="sm" /> : submitButtonText}
                            </Button>
                        </div>
                    </BootstrapForm>
                </div>
            </div>
            {guideOpen && grid && (
                <div style={{ flex: '0 1 380px', width: 'min(90%, 380px)', maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                    <EchelonGuide
                        echelons={grid.echelons} usage={gradeUsage(grid)} selected={gradeEchelon ? gradeEchelon.numero : (echelonPick || null)}
                        onPick={gradeEchelon ? null : (numero) => setEchelonPick(numero)}
                        help={gradeEchelon ? "Les 15 échelons, leur salaire et les grades qui s'y trouvent." : "Cliquez un échelon pour l'affecter à ce rôle ; le rôle donné en exemple aide à choisir."}
                    />
                </div>
            )}
        </div>
    );
    return ReactDOM.createPortal(modalPortalContent, document.getElementById('modal-root'));
};

export default RoleModal;
