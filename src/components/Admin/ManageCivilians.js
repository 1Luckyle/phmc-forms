// src/components/Admin/ManageCivilians.js
//
// Gestion des comptes Civil par l'admin (voir la demande utilisateur : "un
// moyen de gérer les civils comme ce qu'on a pour les employés"). Suit les
// mêmes conventions que PendingAccountRequests.js / PendingJobApplications.js
// (accès Firebase direct, pas de props lourdes depuis AdminDashboard — la
// route /admin est déjà protégée, pas besoin de re-vérifier l'admin ici).
import React, { useState, useEffect } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, set, remove } from 'firebase/database';
import { auth } from '../../firebase';
import { sendEyefindMail } from '../../utils/eyefindMail';

const sendMailBestEffort = (params) => {
    if (!params.to) return;
    sendEyefindMail(params).then((result) => {
        if (!result.ok) {
            console.warn('Eyefind Mail non envoyé:', result.error, result.message);
        }
    });
};

const fieldBoxStyle = {
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    borderColor: '#30363d',
};

const ManageCivilians = ({ showNotification }) => {
    const [civilians, setCivilians] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUid, setEditingUid] = useState(null);
    const [editData, setEditData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadCivilians();
    }, []);

    const loadCivilians = async () => {
        setIsLoading(true);
        try {
            const snapshot = await get(ref(database, 'civilians'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.entries(data).map(([uid, civilian]) => ({ uid, ...civilian }));
                list.sort((a, b) => `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`));
                setCivilians(list);
            } else {
                setCivilians([]);
            }
        } catch (error) {
            console.error('Error loading civilians:', error);
            showNotification('Erreur lors du chargement des civils', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartEdit = (civilian) => {
        setEditingUid(civilian.uid);
        setEditData({ ...civilian });
    };

    const handleCancelEdit = () => {
        setEditingUid(null);
        setEditData(null);
    };

    const handleEditFieldChange = (e) => {
        const { name, value } = e.target;
        setEditData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSaveEdit = async () => {
        if (!editData) return;
        setIsSaving(true);
        try {
            // IMPORTANT : ne JAMAIS retirer le champ `uid` avant d'écrire — il est
            // stocké à l'intérieur même du profil (pas seulement comme clé RTDB) et
            // sert de preuve d'existence du compte lors de la connexion GTAW
            // (exchangeAuthCodeForToken exige entry.uid pour reconnaître un
            // personnage déjà enregistré). Un set() sans ce champ rendait le compte
            // invisible à la connexion ("le compte n'existe plus").
            await set(ref(database, `civilians/${editData.uid}`), editData);
            showNotification('Profil Civil mis à jour.', 'success');
            setEditingUid(null);
            setEditData(null);
            loadCivilians();
        } catch (error) {
            console.error('Error saving civilian:', error);
            showNotification(`Erreur lors de l'enregistrement : ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (civilian) => {
        const displayName = `${civilian.firstName || ''} ${civilian.lastName || ''}`.trim() || civilian.email;
        if (!window.confirm(`Supprimer le compte Civil de ${displayName} (${civilian.patientID}) ?\n\nSon profil et son compte de connexion seront supprimés. Ses dossiers/candidatures déjà enregistrés ne sont PAS supprimés automatiquement.\n\nCette action est irréversible.`)) {
            return;
        }
        try {
            await remove(ref(database, `civilians/${civilian.uid}`));

            // Best-effort : supprime aussi le compte de connexion Firebase Auth
            // (même Cloud Function que pour le retrait d'un employé).
            try {
                const idToken = await auth.currentUser?.getIdToken();
                if (idToken) {
                    const functionUrl = `https://europe-west1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/deleteUserAccount`;
                    await fetch(functionUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                        body: JSON.stringify({ uid: civilian.uid, email: civilian.email }),
                    });
                }
            } catch (authErr) {
                console.warn(`Could not delete Auth account for civilian ${civilian.uid}:`, authErr);
            }

            sendMailBestEffort({
                to: civilian.email,
                subject: 'Votre compte Civil a été supprimé - Pillbox Hill Medical Center',
                body: `Bonjour ${displayName},\n\nVotre compte Civil sur l'outil PHMC-FR a été supprimé par un administrateur.\n\nCordialement,\nPillbox Hill Medical Center`,
                html: `<p>Bonjour ${displayName},</p><p>Votre compte Civil sur l'outil PHMC-FR a été supprimé par un administrateur.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
            });

            showNotification(`Compte Civil de ${displayName} supprimé.`, 'success');
            loadCivilians();
        } catch (error) {
            console.error('Error deleting civilian:', error);
            showNotification(`Erreur lors de la suppression : ${error.message}`, 'error');
        }
    };

    const filteredCivilians = civilians.filter((c) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
            `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(q) ||
            (c.patientID || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
        );
    });

    if (isLoading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Chargement des civils...</div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder="Rechercher par nom, ID patient ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-control"
                    style={{ ...fieldBoxStyle, maxWidth: '350px' }}
                />
                <span style={{ color: '#8b949e' }}>{filteredCivilians.length} civil(s)</span>
            </div>

            {editingUid && editData && (
                <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '5px', padding: '20px', marginBottom: '20px' }}>
                    <h5 style={{ color: '#c9d1d9', marginBottom: '15px' }}>
                        Modifier — {editData.firstName} {editData.lastName} ({editData.patientID})
                    </h5>
                    <Form>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Group className="mb-3" style={{ flex: 1 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>Prénom</Form.Label>
                                <Form.Control name="firstName" value={editData.firstName || ''} onChange={handleEditFieldChange} style={fieldBoxStyle} />
                            </Form.Group>
                            <Form.Group className="mb-3" style={{ flex: 1 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>Deuxième prénom</Form.Label>
                                <Form.Control name="middleName" value={editData.middleName || ''} onChange={handleEditFieldChange} style={fieldBoxStyle} />
                            </Form.Group>
                            <Form.Group className="mb-3" style={{ flex: 1 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>Nom</Form.Label>
                                <Form.Control name="lastName" value={editData.lastName || ''} onChange={handleEditFieldChange} style={fieldBoxStyle} />
                            </Form.Group>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Group className="mb-3" style={{ flex: 1 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>Date de naissance</Form.Label>
                                <Form.Control type="date" name="dateOfBirth" value={editData.dateOfBirth || ''} onChange={handleEditFieldChange} style={fieldBoxStyle} />
                            </Form.Group>
                            <Form.Group className="mb-3" style={{ flex: 1 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>Genre à l'état civil</Form.Label>
                                <Form.Select name="gender" value={editData.gender || ''} onChange={handleEditFieldChange} style={fieldBoxStyle}>
                                    <option value="">Sélectionner...</option>
                                    <option value="Male">Homme</option>
                                    <option value="Female">Femme</option>
                                    <option value="Other">Autre</option>
                                </Form.Select>
                            </Form.Group>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Group className="mb-3" style={{ flex: 2 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>Adresse</Form.Label>
                                <Form.Control name="address" value={editData.address || ''} onChange={handleEditFieldChange} style={fieldBoxStyle} />
                            </Form.Group>
                            <Form.Group className="mb-3" style={{ flex: 1 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>Code postal</Form.Label>
                                <Form.Control name="zip" value={editData.zip || ''} onChange={handleEditFieldChange} style={fieldBoxStyle} />
                            </Form.Group>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Group className="mb-3" style={{ flex: 1 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>Téléphone</Form.Label>
                                <Form.Control name="phone" value={editData.phone || ''} onChange={handleEditFieldChange} style={fieldBoxStyle} />
                            </Form.Group>
                            <Form.Group className="mb-3" style={{ flex: 1 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>Discord</Form.Label>
                                <Form.Control name="discord" value={editData.discord || ''} onChange={handleEditFieldChange} style={fieldBoxStyle} />
                            </Form.Group>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Group className="mb-3" style={{ flex: 1 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>ID Patient</Form.Label>
                                <Form.Control value={editData.patientID || ''} disabled style={fieldBoxStyle} />
                            </Form.Group>
                            <Form.Group className="mb-3" style={{ flex: 1 }}>
                                <Form.Label style={{ color: '#c9d1d9' }}>Email (connexion)</Form.Label>
                                <Form.Control value={editData.email || ''} disabled style={fieldBoxStyle} />
                            </Form.Group>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <Button variant="secondary" onClick={handleCancelEdit} disabled={isSaving}>Annuler</Button>
                            <Button variant="success" onClick={handleSaveEdit} disabled={isSaving}>
                                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                            </Button>
                        </div>
                    </Form>
                </div>
            )}

            {filteredCivilians.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#c9d1d9' }}>
                    <i className="fas fa-user-slash" style={{ fontSize: '2em', marginBottom: '10px', opacity: 0.5 }}></i>
                    <p>Aucun compte Civil {searchQuery ? 'ne correspond à cette recherche' : "n'a encore été créé"}.</p>
                </div>
            ) : (
                <Table striped bordered hover variant="dark" style={{ backgroundColor: '#0d1117' }}>
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>ID Patient</th>
                            <th>Email</th>
                            <th>Téléphone</th>
                            <th>Personnage GTAW</th>
                            <th>Créé le</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCivilians.map((civilian) => (
                            <tr key={civilian.uid}>
                                <td>{civilian.firstName} {civilian.lastName}</td>
                                <td>{civilian.patientID}</td>
                                <td>{civilian.email}</td>
                                <td>{civilian.phone}</td>
                                <td>{civilian.gtawCharacterId ?? 'N/A'}</td>
                                <td>{civilian.createdAt ? new Date(civilian.createdAt).toLocaleDateString('fr-FR') : 'N/A'}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <Button size="sm" variant="warning" onClick={() => handleStartEdit(civilian)} title="Modifier">
                                            <i className="fas fa-edit"></i>
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => handleDelete(civilian)} title="Supprimer">
                                            <i className="fas fa-trash"></i>
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </div>
    );
};

export default ManageCivilians;
