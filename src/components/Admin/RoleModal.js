// src/components/Admin/RoleModal.js
//
// Fenêtre d'ajout / de modification d'un POSTE de recrutement, en français : les champs suivent le schéma
// de constants/recruitment.js (nom, statut OUVERT/FERMÉ, contact, codeCourt, lien, presentation,
// competence1-3, diplome). Chaque poste est relié à un RÔLE du personnel (référentiel constants/ranks.js) :
// c'est le rôle que la personne recevra à l'embauche (conversion en personnel, contrat).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Form as BootstrapForm, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get } from "firebase/database";
import ReactDOM from 'react-dom';
import DebugFillButton from '../DebugFillButton';
import { STAFF_FAMILIES, rolesByFiliere, normalizeRank } from '../../constants/ranks';
import { STATUT_OUVERT, STATUT_FERME, makePositionKey } from '../../constants/recruitment';
import { savePosition, positionsPath, getActiveStore } from '../../utils/recruitmentStore';

const getInitialRoleState = (category) => ({
    nom: '',
    groupe: category?.key || '',
    statut: STATUT_OUVERT,
    role: '',
    contact: '',
    codeCourt: '',
    lien: '',
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

    // Valeurs à l'ouverture : sert à savoir si l'utilisateur a modifié quelque chose.
    const [baseline, setBaseline] = useState('');

    useEffect(() => {
        if (show) {
            const initial = roleToEdit
                ? { ...initialRoleState, ...roleToEdit, role: normalizeRank(roleToEdit.role || '') }
                : initialRoleState;
            setRoleData(initial);
            setBaseline(JSON.stringify(initial));
            setError('');
        }
    }, [show, roleToEdit, initialRoleState]);

    const requiredFields = useMemo(() => [
        'nom', 'codeCourt', 'contact', 'lien', 'presentation', 'competence1', 'competence2', 'competence3', 'diplome',
    ], []);
    const isFormValid = requiredFields.every((field) => String(roleData[field] ?? '').trim() !== '');

    // CRÉATION : tous les champs sont requis. MODIFICATION : le bouton s'active dès qu'un champ change
    // (un poste existant peut avoir des champs vides — anciens postes — sans qu'on puisse alors
    // enregistrer la moindre correction) ; seul le nom doit rester renseigné.
    const isDirty = baseline !== '' && JSON.stringify(roleData) !== baseline;
    const canSave = roleToEdit
        ? isDirty && String(roleData.nom || '').trim() !== ''
        : isFormValid;

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setRoleData((prev) => ({ ...prev, [name]: value }));
    }, []);

    // Mode debug : remplit un poste de test (le nom d'un poste existant en modification n'est pas touché :
    // il détermine la clé Firebase).
    const handleDebugFill = useCallback(() => {
        setRoleData((prev) => ({
            ...prev,
            ...(roleToEdit ? {} : { nom: '[TEST] Poste de démonstration' }),
            statut: STATUT_OUVERT,
            contact: 'Testeur Debug (testeur.debug)',
            codeCourt: 'TEST-DBG',
            lien: 'https://phmc.gta.world/viewtopic.php?t=10291',
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
            setError(roleToEdit
                ? 'Modifiez au moins un champ (le nom ne peut pas être vide).'
                : 'Tous les champs marqués d\'un * sont obligatoires, et les autres doivent également être remplis.');
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

            const { cle, ...position } = roleData; // eslint-disable-line no-unused-vars
            await savePosition(category, key, { ...position, groupe: category.key }, store);

            if (onRoleSaved) onRoleSaved({ ...position, groupe: category.key, cle: key }, roleToEdit ? 'edited' : 'added');
            handleClose();
        } catch (dbError) {
            setError(`Échec de ${roleToEdit ? 'la modification' : 'l\'ajout'} du poste : ${dbError.message}`);
            if (showNotification) showNotification(`Échec de ${roleToEdit ? 'la modification' : 'l\'ajout'} du poste. ${dbError.message}`, "error");
        }
        setIsSaving(false);
    }, [roleData, category, showNotification, onRoleSaved, handleClose, canSave, roleToEdit]);

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
                            <BootstrapForm.Select name="role" value={roleData.role || ''} onChange={handleChange}>
                                <option value="">— Non défini —</option>
                                {Object.values(STAFF_FAMILIES).map((family) => (
                                    <optgroup key={family.key} label={family.label}>
                                        {rolesByFiliere(family.key).flatMap((group) => group.roles).map((role) => (
                                            <option key={role.value} value={role.value}>{role.label}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </BootstrapForm.Select>
                            <BootstrapForm.Text className="text-muted">
                                Sert à pré-remplir le rôle quand un candidat accepté devient membre du personnel, et son contrat.
                            </BootstrapForm.Text>
                        </BootstrapForm.Group>

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
                            <BootstrapForm.Label>Lien de l'annonce *</BootstrapForm.Label>
                            <BootstrapForm.Control type="url" name="lien" value={roleData.lien || ''} onChange={handleChange} required placeholder="https://forum.example.com/lien" />
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
