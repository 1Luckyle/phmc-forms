// src/components/Admin/PendingAccountRequests.js
import React, { useState, useEffect } from 'react';
import { Form, Button, Table } from 'react-bootstrap';
import Select from 'react-select';
import { database, app as primaryApp } from '../../firebase';
import { ref, get, set, remove } from 'firebase/database';
import { initializeApp, deleteApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { PHMC_RANKS, CORONER_RANKS } from '../../constants/ranks';

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
            const confirmApprove = window.confirm(
                `Création du compte pour ${request.name}\n\nVoulez-vous confirmer l'approbation ?`
            );

            if (!confirmApprove) {
                return;
            }

            // Créer le compte Firebase Auth via l'instance secondaire pour ne PAS
            // déconnecter l'admin sur l'instance principale.
            const user = await createUserWithSecondaryApp(request.email, request.password);

            // Ajouter l'UID Firebase aux données de l'employé
            const firstName = request.firstName || '';
            const lastName = request.lastName || '';
            const employeeWithUID = {
                name: `${firstName} ${lastName}`.trim() || request.name,
                firstName,
                lastName,
                discord: request.discord || '',
                rank: request.rank,
                badge: request.badge || '',
                phNumber: request.phNumber || '',
                category: request.rank,
                uid: user.uid,
                email: request.email,
                createdAt: new Date().toISOString()
            };

            // Enregistrer dans la base de données (l'admin est toujours connecté)
            const listRef = ref(database, request.isCoroner ? 'staff/coroner' : 'staff/phmc');
            const snapshot = await get(listRef);
            const currentStaff = snapshot.exists() ? snapshot.val() : [];

            const newStaffArray = Array.isArray(currentStaff)
                ? [...currentStaff, employeeWithUID]
                : [...Object.values(currentStaff), employeeWithUID];
            await set(listRef, newStaffArray);

            // Supprimer la demande de la liste des demandes en attente
            await removeRequest(request.email);

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
                                value={(editingRequest.isCoroner ? CORONER_RANKS : PHMC_RANKS).find(r => r.value === editingRequest.rank)}
                                onChange={(selectedOption) => setEditingRequest({...editingRequest, rank: selectedOption.value})}
                                placeholder="Sélectionner le grade..."
                                styles={{
                                    control: (base) => ({ ...base, backgroundColor: '#0d1117', borderColor: '#30363d' }),
                                    menu: (base) => ({ ...base, backgroundColor: '#0d1117', zIndex: 1051 }),
                                    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#1f2937' : '#0d1117', color: '#c9d1d9' }),
                                    singleValue: (base) => ({ ...base, color: '#c9d1d9' }),
                                    input: (base) => ({ ...base, color: '#c9d1d9' }),
                                    placeholder: (base) => ({ ...base, color: '#6c757d' })
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
                            <td>{request.name}</td>
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
