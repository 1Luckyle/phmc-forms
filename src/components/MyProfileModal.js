// src/components/MyProfileModal.js
//
// « Mon profil » pour le PERSONNEL (PHMC / DMEC) : chacun peut modifier lui-même son prénom / nom, son
// téléphone et son Discord, et changer son adresse Eyefind Mail après vérification par code (voir
// EmailChangeFlow). Tout est rattaché à l'ID (badge = ID employé / patient, qui ne change jamais) : un
// changement de nom déplace les rapports enregistrés sous le nouveau nom. Grade et badge restent gérés par les admins.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import BaseModal from './BaseModal';
import EmailChangeFlow from './EmailChangeFlow';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { updateOwnStaffContact, updateOwnStaffName, rankLabel, staffNameParts } from '../utils/staffAdmin';
import { extraRanksOf } from '../constants/ranks';

const MyProfileModal = ({ show, onHide, showNotification }) => {
    const { currentEmployee, staffProfile, staffName, updateLocalStaffProfile } = useEmployeeAuth();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phNumber, setPhNumber] = useState('');
    const [discord, setDiscord] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!show) return;
        const parts = staffNameParts(staffProfile || {});
        setFirstName(parts.firstName || '');
        setLastName(parts.lastName || '');
        setPhNumber(staffProfile?.phNumber || '');
        setDiscord(staffProfile?.discord || '');
        setError('');
    }, [show, staffProfile]);

    // Seule une fiche liée au compte connecté est modifiable par son titulaire (règles Firebase).
    const ownsProfile = !!currentEmployee?.uid && staffProfile?.uid === currentEmployee.uid;
    const currentParts = staffNameParts(staffProfile || {});
    const nameChanged = firstName.trim() !== (currentParts.firstName || '') || lastName.trim() !== (currentParts.lastName || '');
    const contactChanged = (phNumber.trim() !== String(staffProfile?.phNumber || '')) || (discord.trim() !== String(staffProfile?.discord || ''));
    const dirty = nameChanged || contactChanged;

    const handleSave = async () => {
        if (nameChanged) {
            const newName = `${firstName.trim()} ${lastName.trim()}`.trim();
            if (!window.confirm(`Changer votre nom en « ${newName} » ?\n\nVos rapports enregistrés seront rattachés au nouveau nom. Votre ID (badge / ID patient) ne change pas.`)) return;
        }
        setSaving(true);
        setError('');
        try {
            if (contactChanged) {
                await updateOwnStaffContact(currentEmployee.uid, { phNumber, discord });
                updateLocalStaffProfile({ phNumber: phNumber.trim(), discord: discord.trim() });
            }
            if (nameChanged) {
                const result = await updateOwnStaffName(currentEmployee.uid, { firstName, lastName });
                updateLocalStaffProfile({ name: result.name, firstName: result.firstName, ...(staffProfile.type === 'phmc' ? { lastName: result.lastName } : {}) });
            }
            if (showNotification) showNotification('Profil mis à jour.', 'success');
        } catch (err) {
            console.error('Mise à jour du profil impossible :', err);
            setError(err.message || String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Mon profil" modalSize="medium" className="dark-ui">
            {!ownsProfile ? (
                <Alert variant="warning" className="mb-0">
                    Aucune fiche du personnel n'est liée à votre compte : il n'y a rien à modifier ici.
                </Alert>
            ) : (
                <>
                    <div className="mb-3">
                        <div className="fw-semibold">{staffName}</div>
                        <small className="text-muted">
                            {rankLabel(staffProfile.type, staffProfile.rank)}
                            {extraRanksOf(staffProfile).length > 0 && ` + ${extraRanksOf(staffProfile).join(' · ')}`} · Badge {staffProfile.badge || '—'}
                        </small>
                        <div><small className="text-muted">Le grade et le badge (votre ID) sont gérés par les administrateurs.</small></div>
                    </div>

                    <div className="d-flex gap-3 flex-wrap">
                        <Form.Group className="mb-3 flex-grow-1">
                            <Form.Label>Prénom</Form.Label>
                            <Form.Control value={firstName} maxLength={40} onChange={(e) => setFirstName(e.target.value)} />
                        </Form.Group>
                        <Form.Group className="mb-3 flex-grow-1">
                            <Form.Label>Nom</Form.Label>
                            <Form.Control value={lastName} maxLength={40} onChange={(e) => setLastName(e.target.value)} />
                        </Form.Group>
                    </div>
                    {nameChanged && (
                        <Alert variant="info" className="py-2 small">
                            Tout est rattaché à votre ID : votre badge et votre ID patient ne changent pas, et vos rapports enregistrés suivent votre nouveau nom.
                        </Alert>
                    )}

                    <Form.Group className="mb-3">
                        <Form.Label>Téléphone</Form.Label>
                        <Form.Control value={phNumber} maxLength={40} onChange={(e) => setPhNumber(e.target.value)} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Discord</Form.Label>
                        <Form.Control value={discord} maxLength={64} onChange={(e) => setDiscord(e.target.value)} />
                    </Form.Group>
                    {error && <Alert variant="danger" className="py-2">{error}</Alert>}
                    <div className="d-flex justify-content-end mb-4">
                        <Button variant="primary" onClick={handleSave} disabled={saving || !dirty}>
                            {saving ? <Spinner size="sm" animation="border" /> : 'Enregistrer'}
                        </Button>
                    </div>

                    <hr />
                    <EmailChangeFlow
                        currentEmail={staffProfile.email || currentEmployee.email}
                        onChanged={(email) => updateLocalStaffProfile({ email })}
                    />
                </>
            )}
        </BaseModal>
    );
};

export default MyProfileModal;
