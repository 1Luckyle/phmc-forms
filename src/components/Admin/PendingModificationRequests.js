// src/components/Admin/PendingModificationRequests.js
import React, { useState, useEffect } from 'react';
import { Form, Button, Table, Badge } from 'react-bootstrap';
import Select from 'react-select';
import { database } from '../../firebase';
import { ref, get, set, update, remove } from 'firebase/database';
import { PHMC_RANKS, CORONER_RANKS } from '../../constants/ranks';

const PendingModificationRequests = ({ showNotification, currentUser }) => {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingRequest, setEditingRequest] = useState(null);

    useEffect(() => {
        loadPendingRequests();
    }, []);

    const loadPendingRequests = async () => {
        setIsLoading(true);
        try {
            const requestsRef = ref(database, 'pendingModificationRequests');
            const snapshot = await get(requestsRef);
            
            if (snapshot.exists()) {
                const requests = snapshot.val();
                const requestsArray = Array.isArray(requests) ? requests : Object.values(requests);
                setPendingRequests(requestsArray.filter(req => req.status === 'pending'));
            } else {
                setPendingRequests([]);
            }
        } catch (error) {
            console.error('Error loading pending modification requests:', error);
            showNotification('Erreur lors du chargement des demandes de modification', 'error');
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
            const basePath = request.isCoroner ? 'staff/coroner' : 'staff/phmc';
            const listRef = ref(database, basePath);
            
            // Récupérer les données actuelles
            const snapshot = await get(listRef);
            if (!snapshot.exists()) {
                showNotification('Aucune donnée sur les employés n\'est disponible.', 'error');
                return;
            }

            const data = snapshot.val();
            const entry = findEntryByName(data, request.originalName);
            
            if (!entry) {
                showNotification(`Employé "${request.originalName}" introuvable.`, 'error');
                return;
            }

            const [key, employee] = entry;

            // Appliquer les modifications
            const updated = { ...employee, ...request.newData };

            // Mettre à jour dans Firebase
            await set(ref(database, `${basePath}/${key}`), updated);

            // Supprimer la demande de la liste des demandes en attente
            await removeRequest(request.requestId);

            showNotification(`Modifications approuvées pour ${request.originalName}`, 'success');
            loadPendingRequests();
        } catch (error) {
            console.error('Error approving modification request:', error);
            showNotification(`Erreur lors de l'approbation : ${error.message}`, 'error');
        }
    };

    const handleReject = async (request) => {
        if (!currentUser) {
            showNotification('Non authentifié. Veuillez vous connecter en tant qu\'administrateur.', 'error');
            return;
        }
        try {
            await removeRequest(request.requestId);
            showNotification(`Demande de modification rejetée pour ${request.originalName}`, 'info');
            loadPendingRequests();
        } catch (error) {
            console.error('Error rejecting modification request:', error);
            showNotification(`Erreur lors du rejet : ${error.message}`, 'error');
        }
    };

    const handleDelete = async (request) => {
        if (!currentUser) {
            showNotification('Non authentifié. Veuillez vous connecter en tant qu\'administrateur.', 'error');
            return;
        }
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement ${request.originalName} ?`)) {
            return;
        }

        try {
            const basePath = request.isCoroner ? 'staff/coroner' : 'staff/phmc';
            const listRef = ref(database, basePath);
            
            const snapshot = await get(listRef);
            if (!snapshot.exists()) {
                showNotification('Aucune donnée sur les employés n\'est disponible.', 'error');
                return;
            }

            const data = snapshot.val();
            const entry = findEntryByName(data, request.originalName);
            
            if (!entry) {
                showNotification(`Employé "${request.originalName}" introuvable.`, 'error');
                return;
            }

            const [key] = entry;

            // Supprimer l'employé
            await set(ref(database, `${basePath}/${key}`), null);

            // Supprimer la demande de modification
            await removeRequest(request.requestId);

            showNotification(`Employé ${request.originalName} supprimé avec succès`, 'success');
            loadPendingRequests();
        } catch (error) {
            console.error('Error deleting employee:', error);
            showNotification(`Erreur lors de la suppression : ${error.message}`, 'error');
        }
    };

    const removeRequest = async (requestId) => {
        await remove(ref(database, `pendingModificationRequests/${requestId}`));
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
            await set(ref(database, `pendingModificationRequests/${editingRequest.requestId}`), editingRequest);
            
            showNotification('Modifications enregistrées', 'success');
            setEditingRequest(null);
            loadPendingRequests();
        } catch (error) {
            console.error('Error saving edits:', error);
            showNotification(`Erreur lors de l'enregistrement : ${error.message}`, 'error');
        }
    };

    const findEntryByName = (data, name) => {
        if (!data || !name) return null;
        const lower = name.toLowerCase();
        if (Array.isArray(data)) {
            const idx = data.findIndex(e => (e?.name || '').toLowerCase() === lower);
            return idx >= 0 ? [String(idx), data[idx]] : null;
        }
        for (const [k, v] of Object.entries(data)) {
            if ((v?.name || '').toLowerCase() === lower) return [k, v];
        }
        return null;
    };

    const renderChanges = (request) => {
        const changes = [];
        const oldData = request.oldData || {};
        const newData = request.newData || {};
        
        Object.keys(newData).forEach(key => {
            if (oldData[key] !== newData[key]) {
                changes.push(
                    <div key={key} style={{ marginBottom: '5px' }}>
                        <strong>{key}:</strong> 
                        <span style={{ color: '#dc3545', textDecoration: 'line-through', marginLeft: '5px' }}>
                            {oldData[key] || 'N/A'}
                        </span>
                        <span style={{ color: '#28a745', marginLeft: '5px' }}>
                            → {newData[key]}
                        </span>
                    </div>
                );
            }
        });
        
        return changes.length > 0 ? changes : <span style={{ color: '#6c757d' }}>Aucune modification</span>;
    };

    if (isLoading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Chargement des demandes de modification...</div>;
    }

    if (pendingRequests.length === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: '#c9d1d9' }}>
                <i className="fas fa-edit" style={{ fontSize: '3em', marginBottom: '15px', opacity: 0.5 }}></i>
                <p>Aucune demande de modification en attente</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>
            <h3 style={{ color: '#c9d1d9', marginBottom: '20px' }}>
                <i className="fas fa-edit" style={{ marginRight: '10px' }}></i>
                Demandes de modification en attente ({pendingRequests.length})
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
                        Modifier la demande - {editingRequest.originalName}
                    </h4>
                    <Form>
                        {editingRequest.isCoroner ? (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Prénom</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.newData.firstName || editingRequest.newData.name?.split(' ')[0] || ''}
                                        onChange={(e) => {
                                            const fn = e.target.value;
                                            const ln = editingRequest.newData.lastName || editingRequest.newData.name?.split(' ').slice(1).join(' ') || '';
                                            setEditingRequest({ ...editingRequest, newData: { ...editingRequest.newData, firstName: fn, name: `${fn} ${ln}`.trim() } });
                                        }}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Nom de famille</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.newData.lastName || editingRequest.newData.name?.split(' ').slice(1).join(' ') || ''}
                                        onChange={(e) => {
                                            const ln = e.target.value;
                                            const fn = editingRequest.newData.firstName || editingRequest.newData.name?.split(' ')[0] || '';
                                            setEditingRequest({ ...editingRequest, newData: { ...editingRequest.newData, lastName: ln, name: `${fn} ${ln}`.trim() } });
                                        }}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Discord</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.newData.discord}
                                        onChange={(e) => setEditingRequest({
                                            ...editingRequest,
                                            newData: {...editingRequest.newData, discord: e.target.value}
                                        })}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Rang</Form.Label>
                                    <Select
                                        options={CORONER_RANKS}
                                        value={CORONER_RANKS.find(r => r.value === editingRequest.newData.rank)}
                                        onChange={(selectedOption) => setEditingRequest({
                                            ...editingRequest,
                                            newData: {...editingRequest.newData, rank: selectedOption.value, category: selectedOption.value}
                                        })}
                                        placeholder="Sélectionner le rang..."
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
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Badge</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.newData.badge}
                                        onChange={(e) => setEditingRequest({
                                            ...editingRequest,
                                            newData: {...editingRequest.newData, badge: e.target.value}
                                        })}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Numéro de téléphone</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.newData.phNumber || ''}
                                        onChange={(e) => setEditingRequest({
                                            ...editingRequest,
                                            newData: {...editingRequest.newData, phNumber: e.target.value}
                                        })}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                            </>
                        ) : (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Prénom</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.newData.name}
                                        onChange={(e) => setEditingRequest({
                                            ...editingRequest,
                                            newData: {...editingRequest.newData, name: e.target.value}
                                        })}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Nom de famille</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.newData.lastName || ''}
                                        onChange={(e) => setEditingRequest({
                                            ...editingRequest,
                                            newData: {...editingRequest.newData, lastName: e.target.value}
                                        })}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Discord</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.newData.discord || ''}
                                        onChange={(e) => setEditingRequest({
                                            ...editingRequest,
                                            newData: {...editingRequest.newData, discord: e.target.value}
                                        })}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Rang</Form.Label>
                                    <Select
                                        options={PHMC_RANKS}
                                        value={PHMC_RANKS.find(r => r.value === editingRequest.newData.rank)}
                                        onChange={(selectedOption) => setEditingRequest({
                                            ...editingRequest,
                                            newData: {...editingRequest.newData, rank: selectedOption.value, category: selectedOption.value}
                                        })}
                                        placeholder="Sélectionner le rang..."
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
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Badge</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.newData.badge || ''}
                                        onChange={(e) => setEditingRequest({
                                            ...editingRequest,
                                            newData: {...editingRequest.newData, badge: e.target.value}
                                        })}
                                        style={{ backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ color: '#c9d1d9' }}>Numéro de téléphone</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editingRequest.newData.phNumber || ''}
                                        onChange={(e) => setEditingRequest({
                                            ...editingRequest,
                                            newData: {...editingRequest.newData, phNumber: e.target.value}
                                        })}
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
                        <th>Employé</th>
                        <th>Type</th>
                        <th>Modifications demandées</th>
                        <th>Demandé par</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {pendingRequests.map((request, index) => (
                        <tr key={index}>
                            <td>{request.originalName}</td>
                            <td>
                                <Badge bg={request.isCoroner ? 'danger' : 'primary'}>
                                    {request.isCoroner ? 'Coroner' : 'PHMC'}
                                </Badge>
                            </td>
                            <td style={{ fontSize: '0.9em' }}>
                                {renderChanges(request)}
                            </td>
                            <td>{request.requestedBy || 'Employé'}</td>
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
                                    <Button
                                        size="sm"
                                        variant="dark"
                                        onClick={() => handleDelete(request)}
                                        title="Supprimer l'employé"
                                        style={{ borderColor: '#dc3545' }}
                                    >
                                        <i className="fas fa-trash"></i>
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

export default PendingModificationRequests;
