// src/components/Admin/PendingAccountRequests.js
import React, { useState, useEffect } from 'react';
import { Form, Button, Table } from 'react-bootstrap';
import Select from 'react-select';
import { database, app as primaryApp } from '../../firebase';
import { ref, get, set, remove } from 'firebase/database';
import { initializeApp, deleteApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import { PHMC_RANKS, CORONER_RANKS, normalizeRank, familyOfRank } from '../../constants/ranks';
import { sendEyefindMail } from '../../utils/eyefindMail';
import { logAdminAction } from '../../utils/activityLog';
import { convertCivilianToStaff, badgeDigits, syncStaffUids } from '../../utils/staffAdmin';
import { clearDeletedMark, staffPatientIdOf } from '../../utils/deletedAccounts';
import { clearContractCandidate } from '../../utils/contractCandidates';

// Envoi de mail Eyefind en best-effort : un échec (adresse invalide, limite de
// débit...) ne doit jamais faire échouer l'action admin qui l'a déclenché.
const sendMailBestEffort = (params) => {
    sendEyefindMail(params).then((result) => {
        if (!result.ok) {
            console.warn('Eyefind Mail non envoyé:', result.error, result.message);
        }
    });
};

// map|array|null -> array
const ensureArray = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

// Mot de passe aléatoire (jamais affiché ni enregistré) : la personne définit le sien via l'e-mail de réinitialisation.
const randomPassword = () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return `Aa1!${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
};

// Helper : crée un compte Firebase Auth via une instance secondaire pour ne pas
// déconnecter l'admin qui est sur l'instance principale.
const createUserWithSecondaryApp = async (email, password) => {
    const secondaryAppName = 'SecondaryAccountCreation';
    const firebaseConfig = {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID,
    };

    // Réutilise l'instance si elle existe déjà, sinon en crée une nouvelle
    const existingApp = getApps().find(a => a.name === secondaryAppName);
    const secondaryApp = existingApp || initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        return userCredential.user;
    } finally {
        // Déconnecte le nouveau compte de l'instance secondaire
        await secondaryAuth.signOut();
        // Supprime l'app secondaire si elle n'existait pas avant
        if (!existingApp) {
            await deleteApp(secondaryApp);
        }
    }
};

// Helper : crée un compte Firebase Auth SANS mot de passe pour une demande liée
// à GTA World (identité déjà vérifiée via le personnage choisi lors de
// l'onboarding). Le SDK client (createUserWithEmailAndPassword) exige un mot de
// passe, donc on passe par l'Admin SDK côté serveur (voir createGtawEmployeeAccount
// dans functions/index.js) : l'employé se connectera ensuite uniquement via
// gtawEmployeeLogin (bouton « Se connecter avec GTA World »).
const createGtawUserAccount = async (email) => {
    const response = await fetch('https://europe-west1-phmcfr-forms.cloudfunctions.net/createGtawEmployeeAccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la création du compte GTA World.');
    }
    return { uid: data.uid };
};

const PendingAccountRequests = ({ showNotification, currentUser }) => {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingRequest, setEditingRequest] = useState(null);

    useEffect(() => {
        loadPendingRequests();
    }, []);

    const loadPendingRequests = async () => {
        setIsLoading(true);
        try {
            const requestsRef = ref(database, 'pendingAccountRequests');
            const snapshot = await get(requestsRef);
            
            if (snapshot.exists()) {
                const requests = snapshot.val();
                const requestsArray = Array.isArray(requests) ? requests : Object.values(requests);
                setPendingRequests(requestsArray.filter(req => req.status === 'pending'));
            } else {
                setPendingRequests([]);
            }
        } catch (error) {
            console.error('Error loading pending requests:', error);
            showNotification('Erreur lors du chargement des demandes', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (request) => {
        if (!currentUser) {
            showNotification('Non authentifié. Veuillez vous connecter en tant qu\'administrateur.', 'error');
            return;
        }
        try {
            // Filet de sécurité : la vérification forte se fait déjà côté serveur au
            // moment de la sélection du personnage GTA World (unavailableCharacterIds
            // dans exchangeAuthCodeForToken), mais deux demandes concurrentes peuvent
            // en théorie passer entre les deux. On revérifie ici sur les listes déjà
            // approuvées avant de créer le compte.
            if (request.gtawCharacterId != null) {
                const staffSnap = await get(ref(database, 'staff'));
                const staffData = staffSnap.exists() ? staffSnap.val() : {};
                const allStaff = [...ensureArray(staffData.phmc), ...ensureArray(staffData.coroner)];
                const duplicate = allStaff.find(m => m && String(m.gtawCharacterId) === String(request.gtawCharacterId));
                if (duplicate) {
                    const confirmDuplicate = window.confirm(
                        `⚠️ Ce personnage GTA World semble déjà lié au compte de "${duplicate.name}".\n\nApprouver quand même cette demande pour ${request.name} ?`
                    );
                    if (!confirmDuplicate) return;
                }
            }

            if (request.civilUid && !badgeDigits(request.badge)) {
                showNotification(`Renseignez d'abord le numéro de badge de ${request.name} (bouton « Modifier »), puis approuvez.`, 'warning');
                return;
            }

            const confirmApprove = window.confirm(
                request.civilUid
                    ? `Contrat signé par ${request.name}\n\nSon compte Civil sera converti en compte du personnel (${request.rank}, badge ${request.badge}). Confirmer ?`
                    : `Création du compte pour ${request.name}\n\nVoulez-vous confirmer l'approbation ?`
            );

            if (!confirmApprove) {
                return;
            }

            // Le même personnage a déjà un compte Civil (créé en attendant cette validation) : on le CONVERTIT en compte du
            // personnel (même identifiant de connexion, profil et rapports conservés) au lieu d'en créer un second.
            if (request.civilUid || request.gtawCharacterId != null) {
                const civiliansSnap = await get(ref(database, 'civilians'));
                const civilians = Object.values(civiliansSnap.val() || {});
                const civil = (request.civilUid && civilians.find((entry) => entry && entry.uid === request.civilUid))
                    || civilians.find((entry) => entry && entry.uid && entry.gtawCharacterId != null && request.gtawCharacterId != null
                        && String(entry.gtawCharacterId) === String(request.gtawCharacterId));
                if (civil) {
                    await convertCivilianToStaff(civil, {
                        service: request.isCoroner ? 'coroner' : 'phmc',
                        rank: normalizeRank(request.rank),
                        badgeDigitsValue: badgeDigits(request.badge),
                        discord: request.discord || '',
                        phNumber: request.phNumber || '',
                        middleName: request.middleName, address: request.address, zip: request.zip,
                    });
                    await removeRequest(request.email);
                    await clearContractCandidate(civil.uid).catch(() => {});
                    logAdminAction({ email: currentUser?.email, action: 'Compte du personnel approuvé (compte Civil converti)', details: `Membre : ${request.name}\nCompte : ${civil.email || request.email}`, categoryName: request.isCoroner ? 'DMEC' : 'PHMC' });
                    showNotification(`✅ Le compte Civil de ${request.name} a été converti en compte du personnel (dossiers conservés).`, 'success');
                    loadPendingRequests();
                    return;
                }
            }

            // Compte lié à GTA World (pas de mot de passe défini) : création côté
            // serveur via l'Admin SDK. Sinon, compte classique via l'instance
            // secondaire pour ne PAS déconnecter l'admin sur l'instance principale.
            let needsPasswordEmail = false;
            let user;
            if (request.gtawCharacterId != null) {
                user = await createGtawUserAccount(request.email);
            } else {
                // Ancienne demande (avant ce correctif) : son mot de passe est encore dans la base, on s'en sert une dernière fois.
                // Sinon : mot de passe aléatoire + e-mail de définition de mot de passe.
                needsPasswordEmail = !request.password;
                user = await createUserWithSecondaryApp(request.email, request.password || randomPassword());
            }

            // Ajouter l'UID Firebase aux données de l'employé
            const firstName = request.firstName || '';
            const lastName = request.lastName || '';
            const employeeWithUID = {
                name: `${firstName} ${lastName}`.trim() || request.name,
                firstName,
                ...((request.middleName || '').trim() ? { middleName: request.middleName.trim() } : {}),
                lastName,
                ...((request.address || '').trim() ? { address: request.address.trim() } : {}),
                ...((request.zip || '').trim() ? { zip: request.zip.trim() } : {}),
                discord: request.discord || '',
                // Une demande déposée avant la migration peut porter un ancien rôle anglais : on l'enregistre en français.
                rank: normalizeRank(request.rank),
                badge: request.badge || '',
                phNumber: request.phNumber || '',
                category: normalizeRank(request.rank),
                pole: familyOfRank(request.rank, request.isCoroner ? 'coroner' : 'phmc'),
                uid: user.uid,
                email: request.email,
                createdAt: new Date().toISOString(),
                ...(request.gtawCharacterId != null && { gtawCharacterId: request.gtawCharacterId }),
                ...(request.gtawUserId != null && { gtawUserId: request.gtawUserId }),
            };

            // Enregistrer dans la base de données (l'admin est toujours connecté)
            const listRef = ref(database, request.isCoroner ? 'staff/coroner' : 'staff/phmc');
            const snapshot = await get(listRef);
            const currentStaff = snapshot.exists() ? snapshot.val() : [];

            const newStaffArray = Array.isArray(currentStaff)
                ? [...currentStaff, employeeWithUID]
                : [...Object.values(currentStaff), employeeWithUID];
            await set(listRef, newStaffArray);
            await clearDeletedMark(staffPatientIdOf(employeeWithUID));
            await syncStaffUids().catch((error) => console.warn('Droits du personnel non synchronisés :', error?.message || error));

            // Supprimer la demande de la liste des demandes en attente
            await removeRequest(request.email);

            // Ancienne voie « mot de passe » : la personne définit son mot de passe via l'e-mail de réinitialisation (jamais enregistré chez nous).
            if (needsPasswordEmail) {
                try {
                    const appBase = window.location.hostname !== 'localhost' ? 'https://1luckyle.github.io/phmc-forms/' : `${window.location.origin}/phmc-forms/`;
                    await sendPasswordResetEmail(auth, request.email, { url: `${appBase}#/reset-password`, handleCodeInApp: false });
                } catch (resetError) {
                    console.warn('Mail de définition du mot de passe non envoyé :', resetError);
                    showNotification(`Compte créé, mais l'e-mail de définition du mot de passe n'a pas pu partir (${resetError.code || resetError.message}). La personne peut utiliser « Mot de passe oublié ».`, 'warning');
                }
            }

            sendMailBestEffort({
                to: request.email,
                subject: 'Votre compte PHMC a été approuvé',
                body: `Bonjour ${request.name},\n\nVotre demande de compte auprès du Pillbox Hill Medical Center a été approuvée. Votre badge est ${request.badge || 'en cours d\'attribution'}.\n\nVous pouvez dès à présent vous connecter sur l'outil PHMC-FR.\n\nCordialement,\nPillbox Hill Medical Center`,
                html: `<p>Bonjour ${request.name},</p><p>Votre demande de compte auprès du <b>Pillbox Hill Medical Center</b> a été approuvée. Votre badge est <b>${request.badge || 'en cours d\'attribution'}</b>.</p><p>Vous pouvez dès à présent vous connecter sur l'outil PHMC-FR.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
            });

            logAdminAction({ email: currentUser?.email, action: 'Compte du personnel approuvé', details: `Membre : ${request.name}
Compte : ${request.email}`, categoryName: request.isCoroner ? 'DMEC' : 'PHMC' });
            showNotification(`✅ Compte créé avec succès pour ${request.name} !`, 'success');
            loadPendingRequests();
        } catch (error) {
            console.error('Error approving request:', error);
            showNotification(`Erreur lors de l'approbation : ${error.message}`, 'error');
        }
    };

    const handleReject = async (request) => {
        if (!currentUser) {
            showNotification('Non authentifié. Veuillez vous connecter en tant qu\'administrateur.', 'error');
            return;
        }
        try {
            await removeRequest(request.email);

            sendMailBestEffort({
                to: request.email,
                subject: 'Votre demande de compte PHMC',
                body: `Bonjour ${request.name},\n\nVotre demande de compte auprès du Pillbox Hill Medical Center n'a pas été retenue. Pour plus d'informations, contactez la direction du PHMC.\n\nCordialement,\nPillbox Hill Medical Center`,
                html: `<p>Bonjour ${request.name},</p><p>Votre demande de compte auprès du <b>Pillbox Hill Medical Center</b> n'a pas été retenue. Pour plus d'informations, contactez la direction du PHMC.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
            });

            logAdminAction({ email: currentUser?.email, action: 'Demande de compte refusée', details: `Membre : ${request.name}
Compte : ${request.email}`, categoryName: request.isCoroner ? 'DMEC' : 'PHMC' });
            showNotification(`Demande rejetée pour ${request.email}`, 'info');
            loadPendingRequests();
        } catch (error) {
            console.error('Error rejecting request:', error);
            showNotification(`Erreur lors du rejet : ${error.message}`, 'error');
        }
    };

    const removeRequest = async (email) => {
        const emailKey = email.replace(/[.#$[\]]/g, '_');
        await remove(ref(database, `pendingAccountRequests/${emailKey}`));
    };

    const handleEdit = (request) => {
        setEditingRequest({ ...request });
    };

    const handleSaveEdit = async () => {
        if (!currentUser) {
            showNotification('Non authentifié. Veuillez vous connecter en tant qu\'administrateur.', 'error');
            return;
        }
        try {
            // Reconstruire le nom complet depuis les champs séparés
            const rebuilt = {
                ...editingRequest,
                name: `${editingRequest.firstName || ''} ${editingRequest.lastName || ''}`.trim()
            };
            const emailKey = rebuilt.email.replace(/[.#$[\]]/g, '_');
            await set(ref(database, `pendingAccountRequests/${emailKey}`), rebuilt);
            
            showNotification('Modifications enregistrées', 'success');
            setEditingRequest(null);
            loadPendingRequests();
        } catch (error) {
            console.error('Error saving edits:', error);
            showNotification(`Erreur lors de l'enregistrement : ${error.message}`, 'error');
        }
    };

    if (isLoading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Chargement des demandes...</div>;
    }

    if (pendingRequests.length === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#c9d1d9' }}>
                <i className="fas fa-inbox" style={{ fontSize: '3em', marginBottom: '15px', opacity: 0.5 }}></i>
                <p>Aucune demande de compte en attente</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>
            <h3 style={{ color: '#c9d1d9', marginBottom: '20px' }}>
                <i className="fas fa-user-clock" style={{ marginRight: '10px' }}></i>
                Demandes de compte en attente ({pendingRequests.length})
            </h3>

            {editingRequest && (
                <div style={{
                    backgroundColor: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: '5px',
                    padding: '20px',
                    marginBottom: '20px'
                }}>
                    <h4 style={{ color: '#c9d1d9', marginBottom: '15px' }}>
                        Modifier la demande - {editingRequest.name}
                    </h4>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label style={{ color: '#c9d1d9' }}>Prénom</Form.Label>
                            <Form.Control
                                type="text"
                                value={editingRequest.firstName || ''}
                                onChange={(e) => {
                                    const fn = e.target.value;
                                    setEditingRequest({ ...editingRequest, firstName: fn, name: `${fn} ${editingRequest.lastName || ''}`.trim() });
                                }}
                                style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label style={{ color: '#c9d1d9' }}>Nom de famille</Form.Label>
                            <Form.Control
                                type="text"
                                value={editingRequest.lastName || ''}
                                onChange={(e) => {
                                    const ln = e.target.value;
                                    setEditingRequest({ ...editingRequest, lastName: ln, name: `${editingRequest.firstName || ''} ${ln}`.trim() });
                                }}
                                style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label style={{ color: '#c9d1d9' }}>Grade</Form.Label>
                            <Select
                                options={editingRequest.isCoroner ? CORONER_RANKS : PHMC_RANKS}
                                value={(editingRequest.isCoroner ? CORONER_RANKS : PHMC_RANKS).find(r => r.value === normalizeRank(editingRequest.rank))}
                                onChange={(selectedOption) => setEditingRequest({...editingRequest, rank: selectedOption.value})}
                                placeholder="Sélectionner le grade..."
                                styles={{
                                    control: (base) => ({ ...base, backgroundColor: '#0d1117', borderColor: '#30363d' }),
                                    menu: (base) => ({ ...base, backgroundColor: '#0d1117', zIndex: 1051 }),
                                    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#1f2937' : '#0d1117', color: '#c9d1d9' }),
                                    singleValue: (base) => ({ ...base, color: '#c9d1d9' }),
                                    input: (base) => ({ ...base, color: '#c9d1d9' }),
                                    placeholder: (base) => ({ ...base, color: '#9aa7b4' })
                                }}
                            />
                        </Form.Group>
                        {editingRequest.isCoroner ? (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Discord</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.discord}
                                        onChange={(e) => setEditingRequest({...editingRequest, discord: e.target.value})}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Badge</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.badge}
                                        onChange={(e) => setEditingRequest({...editingRequest, badge: e.target.value})}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Numéro de téléphone</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.phNumber || ''}
                                        onChange={(e) => setEditingRequest({...editingRequest, phNumber: e.target.value})}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                            </>
                        ) : (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Discord</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.discord || ''}
                                        onChange={(e) => setEditingRequest({...editingRequest, discord: e.target.value})}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Badge</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.badge || ''}
                                        onChange={(e) => setEditingRequest({...editingRequest, badge: e.target.value})}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Numéro de téléphone</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.phNumber || ''}
                                        onChange={(e) => setEditingRequest({...editingRequest, phNumber: e.target.value})}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                            </>
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Button variant="success" onClick={handleSaveEdit}>
                                <i className="fas fa-save" style={{ marginRight: '5px' }}></i>
                                Enregistrer
                            </Button>
                            <Button variant="secondary" onClick={() => setEditingRequest(null)}>
                                Annuler
                            </Button>
                        </div>
                    </Form>
                </div>
            )}

            <Table striped bordered hover variant="dark" style={{ backgroundColor: '#0d1117' }}>
                <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Origine</th>
                        <th>Email</th>
                        <th>Type</th>
                        <th>Grade</th>
                        <th>Date de demande</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {pendingRequests.map((request, index) => (
                        <tr key={index}>
                            <td>
                                {request.name}
                                {request.source === 'contrat' && (
                                    <div><small style={{ color: '#3fb950' }} title={request.contratReference || ''}><i className="fas fa-file-signature"></i> Contrat signé{request.badge ? '' : ' — badge à renseigner'}</small></div>
                                )}
                            </td>
                            <td>
                                {request.gtawCharacterId != null ? (
                                    <span title={`Personnage GTA World #${request.gtawCharacterId}`} style={{ color: '#ff8c00' }}>
                                        <i className="fas fa-gamepad" style={{ marginRight: '5px' }}></i>
                                        GTA World
                                    </span>
                                ) : (
                                    <span style={{ color: '#9aa7b4' }}>
                                        <i className="fas fa-keyboard" style={{ marginRight: '5px' }}></i>
                                        Manuel
                                    </span>
                                )}
                            </td>
                            <td>{request.email}</td>
                            <td>{request.isCoroner ? 'Coroner' : 'PHMC'}</td>
                            <td>{request.rank}</td>
                            <td>{new Date(request.requestedAt).toLocaleDateString('fr-FR')}</td>
                            <td>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                    <Button
                                        size="sm"
                                        variant="success"
                                        onClick={() => handleApprove(request)}
                                        title="Approuver"
                                    >
                                        <i className="fas fa-check"></i>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="warning"
                                        onClick={() => handleEdit(request)}
                                        title="Modifier"
                                    >
                                        <i className="fas fa-edit"></i>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={() => handleReject(request)}
                                        title="Rejeter"
                                    >
                                        <i className="fas fa-times"></i>
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </div>
    );
};

export default PendingAccountRequests;
