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
import { loadSalaryGrid, echelonsFor, validateEchelons, addGradeIfMissing, formatEchelonRates } from '../../utils/salaryGrid';
import { createCustomRole, validateNewRole, suggestBadgePrefix, DEFAULT_FILIERE } from '../../utils/customRoles';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';

// Valeur du sélecteur de rôle qui ouvre la création d'un nouveau rôle du personnel.
const NEW_ROLE = '__nouveau__';
const EMPTY_NEW_ROLE = { value: '', pole: 'soignant', badgePrefix: '', filiere: '' };
const EMPTY_NEW_ECHELON = { libelle: 'Échelon 1', horaire: '', hebdo: '' };
const cleanAmountInput = (value) => value.replace(/[^\d.,]/g, '');
const snapshot = (roleData, newRole, newEchelon) => JSON.stringify({ roleData, newRole, newEchelon });

const getInitialRoleState = (category) => ({
    nom: '',
    groupe: category?.key || '',
    statut: STATUT_OUVERT,
    role: '',
    echelon: '',
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

    // Nouveau rôle du personnel (si « Créer un nouveau rôle… » est choisi) et définition de l'échelon d'un rôle qui n'est pas encore dans la grille salariale.
    const [newRole, setNewRole] = useState(EMPTY_NEW_ROLE);
    const [prefixTouched, setPrefixTouched] = useState(false);
    const [newEchelon, setNewEchelon] = useState(EMPTY_NEW_ECHELON);
    const [grid, setGrid] = useState(null);   // grille salariale publiée (échelons proposés pour le rôle choisi)

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
            setNewEchelon(EMPTY_NEW_ECHELON);
            setBaseline(snapshot(initial, EMPTY_NEW_ROLE, EMPTY_NEW_ECHELON));
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
    const gridEchelons = useMemo(() => (effectiveRole ? echelonsFor(grid, effectiveRole) : []), [grid, effectiveRole]);
    // Rôle sans échelon dans la grille : on peut (rôle existant) ou on doit (nouveau rôle) en définir un, qui s'y ajoutera.
    const needsEchelonDefinition = !!effectiveRole && !!grid && gridEchelons.length === 0;
    const filledEchelon = String(newEchelon.horaire).trim() !== '' || String(newEchelon.hebdo).trim() !== '';

    // Échelon choisi par défaut : le premier du grade (une fonction exercée a toujours un échelon). La valeur initiale tient compte de ce défaut :
    // il ne compte pas comme une modification faite par la personne.
    useEffect(() => {
        if (!show || !grid || creatingRole) return;
        const valid = gridEchelons.some((e) => e.libelle === roleData.echelon);
        let wanted = roleData.echelon;
        if (gridEchelons.length > 0 && !valid) wanted = gridEchelons[0].libelle;
        else if (gridEchelons.length === 0 && roleData.echelon) wanted = '';
        if (wanted === roleData.echelon) return;
        const next = { ...roleData, echelon: wanted };
        if (baseline === snapshot(roleData, newRole, newEchelon)) setBaseline(snapshot(next, newRole, newEchelon));
        setRoleData(next);
    }, [show, grid, creatingRole, gridEchelons, roleData, baseline, newRole, newEchelon]);

    const requiredFields = useMemo(() => [
        'nom', 'codeCourt', 'contact', 'presentation', 'competence1', 'competence2', 'competence3', 'diplome',
    ], []);
    const isFormValid = requiredFields.every((field) => String(roleData[field] ?? '').trim() !== '');

    // CRÉATION : tous les champs sont requis. MODIFICATION : le bouton s'active dès qu'un champ change
    // (un poste existant peut avoir des champs vides — anciens postes — sans qu'on puisse alors
    // enregistrer la moindre correction) ; seul le nom doit rester renseigné.
    const isDirty = baseline !== '' && snapshot(roleData, newRole, newEchelon) !== baseline;

    // Rôle et échelon : un nouveau rôle doit être complet (nom, famille, préfixe, premier échelon avec ses DEUX montants) ; pour un rôle existant absent de la
    // grille, définir un échelon est facultatif mais, s'il est commencé, il doit être complet.
    const roleErrors = useMemo(() => (creatingRole ? validateNewRole({ ...newRole, value: newRole.value.trim() }) : []), [creatingRole, newRole]);
    const echelonErrors = (() => {
        if (!needsEchelonDefinition || (!creatingRole && !filledEchelon)) return creatingRole && !grid ? ['La grille salariale est en cours de chargement.'] : [];
        const checked = validateEchelons([newEchelon], effectiveRole || 'Grade').errors;
        if (checked.length > 0) return checked;
        const bothRates = String(newEchelon.horaire).trim() !== '' && String(newEchelon.hebdo).trim() !== '';
        return bothRates ? [] : ["Renseignez les deux montants de l'échelon : à l'heure et à la semaine."];
    })();
    const roleBlockValid = roleErrors.length === 0 && echelonErrors.length === 0;
    const canSave = roleBlockValid && (roleToEdit
        ? isDirty && String(roleData.nom || '').trim() !== ''
        : isFormValid);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setRoleData((prev) => ({ ...prev, [name]: value }));
    }, []);

    // Changer de rôle : l'échelon d'un autre grade n'a pas de sens (le défaut du nouveau grade est posé par l'effet ci-dessus).
    const handleRoleChange = useCallback((e) => {
        const { value } = e.target;
        setRoleData((prev) => ({ ...prev, role: value, echelon: '' }));
        setNewEchelon(EMPTY_NEW_ECHELON);
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
            // 1) Nouveau rôle du personnel (ajouté aux rôles d'origine) ; 2) sa ligne dans la grille salariale, ou celle d'un rôle qui n'y figurait pas encore.
            let roleValue = roleData.role === NEW_ROLE ? '' : roleData.role;
            let echelonLabel = roleData.echelon || '';
            if (roleData.role === NEW_ROLE) {
                const created = await createCustomRole({ ...newRole, value: newRole.value.trim() }, actorName);
                roleValue = created.value;
            }
            if (roleValue && needsEchelonDefinition && (roleData.role === NEW_ROLE || filledEchelon)) {
                await addGradeIfMissing(roleValue, [newEchelon]);
                echelonLabel = newEchelon.libelle.trim();
            }
            if (!roleValue) echelonLabel = '';

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

            const { cle, ...position } = { ...roleData, role: roleValue, echelon: echelonLabel }; // eslint-disable-line no-unused-vars
            await savePosition(category, key, { ...position, groupe: category.key }, store);

            if (onRoleSaved) onRoleSaved({ ...position, groupe: category.key, cle: key }, roleToEdit ? 'edited' : 'added');
            handleClose();
        } catch (dbError) {
            setError(`Échec de ${roleToEdit ? 'la modification' : 'l\'ajout'} du poste : ${dbError.message}`);
            if (showNotification) showNotification(`Échec de ${roleToEdit ? 'la modification' : 'l\'ajout'} du poste. ${dbError.message}`, "error");
        }
        setIsSaving(false);
    }, [roleData, newRole, newEchelon, needsEchelonDefinition, filledEchelon, roleErrors, echelonErrors, actorName, category, showNotification, onRoleSaved, handleClose, canSave, roleToEdit]);

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
        <div style={modalOverlayStyle} onClick={handleClose}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
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
                                <BootstrapForm.Label>Échelon de la grille salariale{creatingRole ? ' *' : ''}</BootstrapForm.Label>
                                {gridEchelons.length > 0 ? (
                                    <>
                                        <BootstrapForm.Select name="echelon" value={roleData.echelon || ''} onChange={handleChange}>
                                            {gridEchelons.map((e) => <option key={e.libelle} value={e.libelle}>{e.libelle} — {formatEchelonRates(e)}</option>)}
                                        </BootstrapForm.Select>
                                        <BootstrapForm.Text className="text-muted">
                                            Échelon obtenu à l'embauche : il s'affiche à côté du rôle et pré-remplit le contrat. La grille se modifie dans Comptabilité → Transparence.
                                        </BootstrapForm.Text>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                                            <BootstrapForm.Control type="text" value={newEchelon.libelle} maxLength={60} aria-label="Nom de l'échelon" placeholder="Échelon 1"
                                                onChange={(e) => setNewEchelon((prev) => ({ ...prev, libelle: e.target.value }))} />
                                            <div className="input-group" style={{ flexWrap: 'nowrap' }}>
                                                <BootstrapForm.Control type="text" inputMode="decimal" value={newEchelon.horaire} aria-label="Montant à l'heure" placeholder="À l'heure"
                                                    onChange={(e) => setNewEchelon((prev) => ({ ...prev, horaire: cleanAmountInput(e.target.value) }))} />
                                                <span className="input-group-text">$ / h</span>
                                            </div>
                                            <div className="input-group" style={{ flexWrap: 'nowrap' }}>
                                                <BootstrapForm.Control type="text" inputMode="decimal" value={newEchelon.hebdo} aria-label="Montant à la semaine" placeholder="À la semaine"
                                                    onChange={(e) => setNewEchelon((prev) => ({ ...prev, hebdo: cleanAmountInput(e.target.value) }))} />
                                                <span className="input-group-text">$ / sem.</span>
                                            </div>
                                        </div>
                                        <BootstrapForm.Text className="text-muted">
                                            {creatingRole
                                                ? "Ce rôle n'est pas encore dans la grille salariale : définissez son premier échelon, il y sera ajouté (page Transparence, contrats)."
                                                : "Ce rôle n'a pas encore d'échelon dans la grille salariale. Renseigner ses montants l'y ajoute (facultatif ici)."}
                                        </BootstrapForm.Text>
                                        {echelonErrors.length > 0 && (creatingRole || filledEchelon) && <p className="text-warning small mb-0 mt-1">{echelonErrors[0]}</p>}
                                    </>
                                )}
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
        </div>
    );
    return ReactDOM.createPortal(modalPortalContent, document.getElementById('modal-root'));
};

export default RoleModal;
