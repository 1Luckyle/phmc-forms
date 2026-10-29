// src/components/MyProfileModal.js
//
// « Mon profil » pour le PERSONNEL (PHMC / DMEC) : chacun peut modifier lui-même son prénom / nom, son
// deuxième prénom, adresse, ville / code postal, téléphone et Discord (tout ce qui est demandé à la création du compte), choisir son titre
// (Dr. / Pr., pour les grades médecins), et changer son adresse Eyefind Mail après vérification par code (voir
// EmailChangeFlow). Tout est rattaché à l'ID (badge = ID employé / patient, qui ne change jamais) : un
// changement de nom déplace les rapports enregistrés sous le nouveau nom. Grade et badge restent gérés par les admins.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import BaseModal from './BaseModal';
import EmailChangeFlow from './EmailChangeFlow';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { updateOwnStaffContact, updateOwnStaffName, rankLabel, staffNameParts } from '../utils/staffAdmin';
import { extraRanksOf, DOCTOR_RANKS } from '../constants/ranks';
import TitlePrefixPicker from './TitlePrefixPicker';
import ZipCityField from './ZipCityField';

const MyProfileModal = ({ show, onHide, showNotification }) => {
    const { currentEmployee, staffProfile, staffName, updateLocalStaffProfile } = useEmployeeAuth();
    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [address, setAddress] = useState('');
    const [zip, setZip] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [gender, setGender] = useState('');
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
        setMiddleName(staffProfile?.middleName || '');
        setAddress(staffProfile?.address || '');
        setZip(staffProfile?.zip || '');
        setDateOfBirth(staffProfile?.dateOfBirth || '');
        setGender(staffProfile?.gender || '');
        setPhNumber(staffProfile?.phNumber || '');
        setDiscord(staffProfile?.discord || '');
        setError('');
    }, [show, staffProfile]);

    // Seule une fiche liée au compte connecté est modifiable par son titulaire (règles Firebase).
    const ownsProfile = !!currentEmployee?.uid && staffProfile?.uid === currentEmployee.uid;
    const currentParts = staffNameParts(staffProfile || {});
    const nameChanged = firstName.trim() !== (currentParts.firstName || '') || lastName.trim() !== (currentParts.lastName || '');
    const contactChanged = (phNumber.trim() !== String(staffProfile?.phNumber || '')) || (discord.trim() !== String(staffProfile?.discord || ''))
        || middleName.trim() !== String(staffProfile?.middleName || '') || address.trim() !== String(staffProfile?.address || '') || zip.trim() !== String(staffProfile?.zip || '')
        || dateOfBirth !== String(staffProfile?.dateOfBirth || '') || gender !== String(staffProfile?.gender || '');
    // Le titre (Dr. / Pr.) fait partie du prénom : seuls les grades médecins (principal ou cumulé) peuvent en choisir un.
    const canHaveTitle = [staffProfile?.rank, ...extraRanksOf(staffProfile || {})].some((rank) => DOCTOR_RANKS.includes(rank));
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
                await updateOwnStaffContact(currentEmployee.uid, { phNumber, discord, middleName, address, zip, dateOfBirth, gender });
                updateLocalStaffProfile({ phNumber: phNumber.trim(), discord: discord.trim(), middleName: middleName.trim(), address: address.trim(), zip: zip.trim(), dateOfBirth, gender });
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

                    {canHaveTitle && (
                        <Form.Group className="mb-2">
                            <Form.Label>Titre</Form.Label>
                            <TitlePrefixPicker firstName={firstName} onChange={setFirstName} />
                        </Form.Group>
                    )}
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
                        <Form.Label>Deuxième prénom <small className="text-muted">(facultatif)</small></Form.Label>
                        <Form.Control value={middleName} maxLength={40} onChange={(e) => setMiddleName(e.target.value)} />
                    </Form.Group>
                    <div className="d-flex gap-3 flex-wrap">
                        <Form.Group className="mb-3" style={{ flex: '2 1 220px' }}>
                            <Form.Label>Adresse <small className="text-muted">(facultatif)</small></Form.Label>
                            <Form.Control value={address} maxLength={150} onChange={(e) => setAddress(e.target.value)} />
                        </Form.Group>
                        <Form.Group className="mb-3" style={{ flex: '1 1 180px' }}>
                            <Form.Label>Ville / code postal</Form.Label>
                            <ZipCityField zip={zip} onZipChange={setZip} placeholder="Code postal (facultatif)" />
                        </Form.Group>
                    </div>
                    <div className="d-flex gap-3 flex-wrap">
                        <Form.Group className="mb-3" style={{ flex: '1 1 180px' }}>
                            <Form.Label>Date de naissance <small className="text-muted">(facultatif)</small></Form.Label>
                            <Form.Control type="date" value={dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDateOfBirth(e.target.value)} />
                        </Form.Group>
                        <Form.Group className="mb-3" style={{ flex: '1 1 180px' }}>
                            <Form.Label>Genre à l'état civil <small className="text-muted">(facultatif)</small></Form.Label>
                            <Form.Select value={gender} onChange={(e) => setGender(e.target.value)}>
                                <option value="">—</option>
                                <option value="Male">Homme</option>
                                <option value="Female">Femme</option>
                                <option value="Other">Autre</option>
                            </Form.Select>
                        </Form.Group>
                    </div>
                    <Form.Text className="text-muted d-block mb-3">Ces deux informations servent à pré-remplir vos propres dossiers médicaux (bouton « C'est pour moi »).</Form.Text>
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
