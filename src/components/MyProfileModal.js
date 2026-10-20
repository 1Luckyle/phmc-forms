// src/components/MyProfileModal.js
//
// « Mon profil » pour le PERSONNEL (PHMC / DMEC) : chacun peut modifier lui-même son téléphone et
// son Discord, et changer son adresse Eyefind Mail après vérification par code (voir
// EmailChangeFlow). Nom, grade et badge restent gérés par les admins : le nom sert de clé à tous
// les rapports et le badge est l'ID employé / patient.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import BaseModal from './BaseModal';
import EmailChangeFlow from './EmailChangeFlow';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { updateOwnStaffContact, rankLabel } from '../utils/staffAdmin';

const MyProfileModal = ({ show, onHide, showNotification }) => {
    const { currentEmployee, staffProfile, staffName, updateLocalStaffProfile } = useEmployeeAuth();
    const [phNumber, setPhNumber] = useState('');
    const [discord, setDiscord] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!show) return;
        setPhNumber(staffProfile?.phNumber || '');
        setDiscord(staffProfile?.discord || '');
        setError('');
    }, [show, staffProfile]);

    // Seule une fiche liée au compte connecté est modifiable par son titulaire (règles Firebase).
    const ownsProfile = !!currentEmployee?.uid && staffProfile?.uid === currentEmployee.uid;
    const dirty = (phNumber.trim() !== String(staffProfile?.phNumber || '')) || (discord.trim() !== String(staffProfile?.discord || ''));

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            await updateOwnStaffContact(currentEmployee.uid, { phNumber, discord });
            updateLocalStaffProfile({ phNumber: phNumber.trim(), discord: discord.trim() });
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
                            {rankLabel(staffProfile.type, staffProfile.rank)} · Badge {staffProfile.badge || '—'}
                        </small>
                        <div><small className="text-muted">Le nom, le grade et le badge sont gérés par les administrateurs.</small></div>
                    </div>

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
