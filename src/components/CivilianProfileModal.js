// src/components/CivilianProfileModal.js
//
// « Mon profil » d'un compte Civil : ses coordonnées (modifiables sans payer : prénom, deuxième prénom, nom, téléphone, Discord, adresse, ville / code postal), l'ID et
// l'e-mail (lecture seule ici), puis son dossier médical au format PHMC (components/MyDossierPanel.js). La date de naissance, le genre, l'origine et toute donnée de
// santé ne se changent que par un formulaire du dossier (payant) : « Mise à jour du dossier médical ». L'ID ne se modifie nulle part.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { ref, update } from 'firebase/database';
import { database } from '../firebase';
import BaseModal from './BaseModal';
import ZipCityField from './ZipCityField';
import MyDossierPanel from './MyDossierPanel';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';

const FIELDS = ['firstName', 'middleName', 'lastName', 'phone', 'discord', 'address', 'zip'];

const CivilianProfileModal = ({ show, onHide, showNotification, onLoadForm }) => {
    const { currentEmployee, civilianProfile, updateLocalCivilianProfile } = useEmployeeAuth();
    const [values, setValues] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!show) return;
        setValues(Object.fromEntries(FIELDS.map((key) => [key, civilianProfile?.[key] || ''])));
        setError('');
    }, [show, civilianProfile]);

    const dirty = FIELDS.some((key) => String(values[key] || '').trim() !== String(civilianProfile?.[key] || ''));
    const set = (key) => (event) => setValues((prev) => ({ ...prev, [key]: event.target.value }));

    // Identité du compte qui prime sur le dossier dans l'affichage (le profil est la source des coordonnées gratuites).
    const identity = useMemo(() => ({
        patientFirstName: civilianProfile?.firstName, patientMiddleName: civilianProfile?.middleName, patientLastName: civilianProfile?.lastName,
        patientPH: civilianProfile?.phone, patientDiscord: civilianProfile?.discord, patientAddress: civilianProfile?.address, patientZIP: civilianProfile?.zip,
        patientEmail: civilianProfile?.email,
        // Identité qui ne change que par le dossier : reprise du profil tant que le dossier ne l'a pas encore.
        patientDateOfBirth: civilianProfile?.dateOfBirth,
    }), [civilianProfile]);

    const handleSave = async () => {
        if (!String(values.firstName || '').trim() || !String(values.lastName || '').trim()) { setError('Le prénom et le nom sont obligatoires.'); return; }
        setSaving(true);
        setError('');
        try {
            const patch = {};
            FIELDS.forEach((key) => { const value = String(values[key] || '').trim(); patch[key] = value || null; });
            await update(ref(database, `civilians/${currentEmployee.uid}`), patch);
            if (updateLocalCivilianProfile) updateLocalCivilianProfile(Object.fromEntries(FIELDS.map((key) => [key, String(values[key] || '').trim()])));
            if (showNotification) showNotification('Profil mis à jour.', 'check-circle');
        } catch (err) {
            setError(err.message || String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Mon profil" modalSize="large" className="dark-ui">
            {!civilianProfile ? (
                <Alert variant="warning" className="mb-0">Aucun profil Civil n'est lié à ce compte.</Alert>
            ) : (
                <div data-guide-zone>
                    <div className="mb-3">
                        <div className="fw-semibold">{[civilianProfile.firstName, civilianProfile.middleName, civilianProfile.lastName].filter(Boolean).join(' ')}</div>
                        <small className="text-muted">ID patient : <strong>{civilianProfile.patientID || '—'}</strong> (il ne change jamais) · {civilianProfile.email || currentEmployee?.email}</small>
                    </div>

                    <div className="d-flex gap-3 flex-wrap">
                        <Form.Group className="mb-3 flex-grow-1"><Form.Label>Prénom</Form.Label><Form.Control name="civilPrenom" required value={values.firstName || ''} maxLength={40} onChange={set('firstName')} /></Form.Group>
                        <Form.Group className="mb-3 flex-grow-1"><Form.Label>Deuxième prénom <small className="text-muted">(facultatif)</small></Form.Label><Form.Control name="civilDeuxiemePrenom" value={values.middleName || ''} maxLength={40} onChange={set('middleName')} /></Form.Group>
                        <Form.Group className="mb-3 flex-grow-1"><Form.Label>Nom</Form.Label><Form.Control name="civilNom" required value={values.lastName || ''} maxLength={40} onChange={set('lastName')} /></Form.Group>
                    </div>
                    <div className="d-flex gap-3 flex-wrap">
                        <Form.Group className="mb-3" style={{ flex: '2 1 220px' }}><Form.Label>Adresse</Form.Label><Form.Control name="civilAdresse" value={values.address || ''} maxLength={150} onChange={set('address')} /></Form.Group>
                        <Form.Group className="mb-3" style={{ flex: '1 1 180px' }}><Form.Label>Ville / code postal</Form.Label><ZipCityField zip={values.zip || ''} onZipChange={(zip) => setValues((prev) => ({ ...prev, zip }))} placeholder="Code postal" /></Form.Group>
                    </div>
                    <div className="d-flex gap-3 flex-wrap">
                        <Form.Group className="mb-3" style={{ flex: '1 1 180px' }}><Form.Label>Téléphone</Form.Label><Form.Control name="civilTelephone" value={values.phone || ''} maxLength={40} onChange={set('phone')} /></Form.Group>
                        <Form.Group className="mb-3" style={{ flex: '1 1 180px' }}><Form.Label>Discord</Form.Label><Form.Control name="civilDiscord" value={values.discord || ''} maxLength={64} onChange={set('discord')} /></Form.Group>
                    </div>
                    <Form.Text className="text-muted d-block mb-3">
                        Ces coordonnées se modifient ici sans payer. La date de naissance, le genre, l'origine ethnique et les informations de santé se modifient par la « Mise à jour du dossier médical ».
                        L'adresse e-mail est liée à votre compte Eyefind Mail.
                    </Form.Text>
                    {error && <Alert variant="danger" className="py-2">{error}</Alert>}
                    <div className="d-flex justify-content-end mb-3">
                        <Button variant="primary" onClick={handleSave} disabled={saving || !dirty}>{saving ? <Spinner size="sm" animation="border" /> : 'Enregistrer'}</Button>
                    </div>

                    <hr />
                    <div data-no-mark>
                        <MyDossierPanel patientID={civilianProfile.patientID} identity={identity} showNotification={showNotification} onLoadForm={onLoadForm} />
                    </div>
                </div>
            )}
        </BaseModal>
    );
};

export default CivilianProfileModal;
