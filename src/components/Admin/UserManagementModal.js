import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { ref, get, set, remove, update } from "firebase/database";
import './UserManagementModal.css';
import { sendDiscordNotification } from './adminUtils';

const UserManagementModal = ({ show, onHide, database, showNotification }) => {
    const [users, setUsers] = useState([]);
    const [sourceUser, setSourceUser] = useState('');
    const [destinationUser, setDestinationUser] = useState('');
    const [confirm, setConfirm] = useState(false);
    const [error, setError] = useState('');

    const comprehensiveSanitize = (str) => {
        if (!str) return '';
        let sanitized = str.trim().replace(/[.#$[\/ \]]+/g, '_');
        sanitized = sanitized.replace(/_{2,}/g, '_');
        sanitized = sanitized.replace(/^_+|_+$/g, '');
        return sanitized;
    };

    useEffect(() => {
        if (show) {
            const fetchUsers = async () => {
                try {
                    const savedReportsRef = ref(database, 'savedReports');
                    const snapshot = await get(savedReportsRef);
                    if (snapshot.exists()) {
                        setUsers(Object.keys(snapshot.val()));
                    } else {
                        setUsers([]);
                    }
                } catch (error) {
                    console.error("Error fetching users:", error);
                    setError("Impossible de récupérer les utilisateurs. Veuillez réessayer plus tard.");
                }
            };
            fetchUsers();
        }
    }, [show, database]);

    const sanitizeForFirebasePath = (str) => {
        return str.replace(/[.#$[\/ \]]/g, '_');
    };

    const sendMigrationNotification = async (source, destination, count) => {
        const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
        const payload = {
            embeds: [{
                title: "Migration des données utilisateur",
                description: `Migration réussie de ${count} rapports de **${source}** vers **${destination}**.**Ceci est une notification de test.**`,
                color: 0x00ff00, // Green
                timestamp: new Date().toISOString(),
            }]
        };
        await sendDiscordNotification(webhookURL, payload, "Migration des données utilisateur", null);
    };

    const handleSanitizeAllUsernames = async () => {
        if (!window.confirm("Êtes-vous sûr de vouloir nettoyer tous les noms d'utilisateur ? Cette opération supprimera les espaces et les tirets bas multiples. Il s'agit d'une opération unique et irréversible.")) {
            return;
        }

        const savedReportsRef = ref(database, 'savedReports');
        try {
            const snapshot = await get(savedReportsRef);
            if (!snapshot.exists()) {
                showNotification("Aucun rapport enregistré trouvé à nettoyer.", "info");
                return;
            }

            const allReports = snapshot.val();
            const updates = {};
            let sanitizedCount = 0;

            for (const userName in allReports) {
                const sanitizedUserName = comprehensiveSanitize(userName);
                if (userName !== sanitizedUserName) {
                    const oldUserData = allReports[userName];
                    const newUserData = allReports[sanitizedUserName] || {};

                    for (const reportId in oldUserData) {
                        if (!newUserData[reportId]) {
                            newUserData[reportId] = oldUserData[reportId];
                        }
                    }

                    updates[`savedReports/${sanitizedUserName}`] = newUserData;
                    updates[`savedReports/${userName}`] = null;
                    sanitizedCount++;
                }
            }

            if (sanitizedCount > 0) {
                await update(ref(database), updates);
                showNotification(`Nettoyage réussi de ${sanitizedCount} noms d'utilisateur.`, "success");
            } else {
                showNotification("Aucun nom d'utilisateur trouvé nécessitant un nettoyage.", "info");
            }

            const newSnapshot = await get(savedReportsRef);
            if (newSnapshot.exists()) {
                setUsers(Object.keys(newSnapshot.val()));
            } else {
                setUsers([]);
            }

        } catch (error) {
            console.error("Error sanitizing all usernames:", error);
            showNotification(`Erreur lors du nettoyage des noms d'utilisateur : ${error.message}`, "error");
        }
    };

    const handleMigrateAllUsernames = async () => {
        if (!window.confirm("Êtes-vous sûr de vouloir migrer tous les noms d'utilisateur avec des espaces pour utiliser des tirets bas ? Il s'agit d'une opération unique et irréversible.")) {
            return;
        }
    
        const savedReportsRef = ref(database, 'savedReports');
        try {
            const snapshot = await get(savedReportsRef);
            if (!snapshot.exists()) {
                showNotification("Aucun rapport enregistré trouvé à migrer.", "info");
                return;
            }
    
            const allReports = snapshot.val();
            const updates = {};
            let migratedCount = 0;
    
            for (const userName in allReports) {
                if (userName.includes(' ')) {
                    const newUserName = userName.replace(/ /g, '_');
                    const oldUserData = allReports[userName];
                    const newUserData = allReports[newUserName] || {};
    
                    // Merge old data into new data, avoiding overwrites
                    for (const reportId in oldUserData) {
                        if (!newUserData[reportId]) {
                            newUserData[reportId] = oldUserData[reportId];
                        }
                    }
    
                    updates[`savedReports/${newUserName}`] = newUserData;
                    updates[`savedReports/${userName}`] = null; // Mark for deletion
                    migratedCount++;
                }
            }
    
            if (migratedCount > 0) {
                await update(ref(database), updates);
                showNotification(`Migration réussie de ${migratedCount} noms d'utilisateur.`, "success");
            } else {
                showNotification("Aucun nom d'utilisateur avec des espaces trouvé à migrer.", "info");
            }
    
            // Refresh users in the dropdown
            const newSnapshot = await get(savedReportsRef);
            if (newSnapshot.exists()) {
                setUsers(Object.keys(newSnapshot.val()));
            } else {
                setUsers([]);
            }
    
        } catch (error) {
            console.error("Error migrating all usernames:", error);
            showNotification(`Erreur lors de la migration des noms d'utilisateur : ${error.message}`, "error");
        }
    };

    const handleMigrate = async () => {
        if (!sourceUser || !destinationUser || !confirm) {
            setError("Veuillez sélectionner les deux utilisateurs et confirmer la migration.");
            return;
        }

        if (sourceUser === destinationUser) {
            setError("Les utilisateurs source et destination ne peuvent pas être les mêmes.");
            return;
        }

        setError('');

        const sourceUserRef = ref(database, `savedReports/${sourceUser}`);
        const destinationUserRef = ref(database, `savedReports/${destinationUser}`);
        const backupDate = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
        const sanitizedDestinationUser = sanitizeForFirebasePath(destinationUser);
        const backupRef = ref(database, `migrationBackups/${sanitizedDestinationUser}_${backupDate}`);
        let destinationBackup = null;

        try {
            const sourceSnapshot = await get(sourceUserRef);
            if (!sourceSnapshot.exists()) {
                showNotification("L'utilisateur source n'a pas de données à migrer.", "warning");
                return;
            }

            const destinationSnapshot = await get(destinationUserRef);
            if (destinationSnapshot.exists()) {
                destinationBackup = destinationSnapshot.val();
                await set(backupRef, destinationBackup);
            }

            const sourceReports = sourceSnapshot.val();
            const destinationReports = destinationBackup || {};
            const conflictedReports = [];
            let migratedCount = 0;

            Object.keys(sourceReports).forEach(key => {
                if (destinationReports[key]) {
                    conflictedReports.push(key);
                } else {
                    destinationReports[key] = sourceReports[key];
                    migratedCount++;
                }
            });

            await set(destinationUserRef, destinationReports);
            await remove(sourceUserRef);

            if (conflictedReports.length > 0) {
                showNotification(`Migration terminée, mais ${conflictedReports.length} rapports n'ont pas été migrés en raison de conflits.`, "warning");
            } else {
                showNotification("Données utilisateur migrées avec succès.", "success");
            }
            
            if (migratedCount > 0) {
                await sendMigrationNotification(sourceUser, destinationUser, migratedCount);
            }

            onHide();

        } catch (error) {
            console.error("Error migrating data:", error);
            showNotification(`Erreur lors de la migration des données : ${error.message}`, "error");

            if (destinationBackup) {
                await set(destinationUserRef, destinationBackup);
                showNotification("La migration a échoué. Les données originales de l'utilisateur de destination ont été restaurées.", "info");
            }
        }
    };

    return (
        <Modal show={show} onHide={onHide} className="user-management-modal">
            <Modal.Header closeButton>
                <Modal.Title>Gestion des utilisateurs</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <p>Migration des rapports enregistrés d'un utilisateur à un autre.</p>
                <Form>
                    <Form.Group className="mb-3">
                        <Form.Label>Sélectionnez l'utilisateur source</Form.Label>
                        <Form.Control as="select" value={sourceUser} onChange={e => setSourceUser(e.target.value)}>
                            <option value="">Sélectionnez un utilisateur</option>
                            {users.map(user => <option key={user} value={user}>{user}</option>)}
                        </Form.Control>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Sélectionnez l'utilisateur de destination</Form.Label>
                        <Form.Control as="select" value={destinationUser} onChange={e => setDestinationUser(e.target.value)}>
                            <option value="">Sélectionnez un utilisateur</option>
                            {users.map(user => <option key={user} value={user}>{user}</option>)}
                        </Form.Control>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicCheckbox">
                        <Form.Check type="checkbox" label="Je confirme que je souhaite migrer les données." checked={confirm} onChange={e => setConfirm(e.target.checked)} />
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Fermer
                </Button>
                <Button variant="success" onClick={handleSanitizeAllUsernames}>
                    Nettoyer tous les noms d'utilisateur
                </Button>
                <Button variant="warning" onClick={handleMigrateAllUsernames}>
                    Migrer tous les noms d'utilisateur
                </Button>
                <Button variant="primary" onClick={handleMigrate} disabled={!sourceUser || !destinationUser || !confirm}>
                    Migrer les données
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default UserManagementModal;