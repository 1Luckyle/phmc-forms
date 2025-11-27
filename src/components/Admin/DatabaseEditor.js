import React, { useState } from 'react';
import { Button, Form, Spinner, Card, Alert } from 'react-bootstrap';
import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';

const DatabaseEditor = ({ showNotification }) => {
    const [path, setPath] = useState('/agencies');
    const [jsonData, setJsonData] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFetch = async () => {
        if (!path) {
            showNotification('Veuillez saisir un chemin d\'accès à la base de données.', 'warning');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const dbRef = ref(database, path);
            const snapshot = await get(dbRef);
            if (snapshot.exists()) {
                setJsonData(JSON.stringify(snapshot.val(), null, 2));
            } else {
                setJsonData('');
                showNotification('Aucune donnée à ce chemin.', 'info');
            }
        } catch (e) {
            setError(e.message);
            showNotification(`Erreur lors de la récupération des données : ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!path) {
            showNotification('Veuillez saisir un chemin d\'accès à la base de données.', 'warning');
            return;
        }
        let dataToSave;
        try {
            dataToSave = JSON.parse(jsonData);
        } catch (e) {
            setError('Format JSON invalide.');
            showNotification('Format JSON invalide. Veuillez le corriger avant de sauvegarder.', 'error');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const dbRef = ref(database, path);
            await set(dbRef, dataToSave);
            showNotification('Données sauvegardées avec succès !', 'check-circle');
        } catch (e) {
            setError(e.message);
            showNotification(`Erreur lors de la sauvegarde des données : ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <Card.Header>Éditeur de la base de données Firebase Realtime</Card.Header>
            <Card.Body>
                <Form.Group className="mb-3">
                    <Form.Label>Chemin de la base de données</Form.Label>
                    <Form.Control
                        type="text"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="ex., /agencies/LSSD"
                    />
                </Form.Group>
                <Button onClick={handleFetch} disabled={isLoading} className="me-2">
                    {isLoading ? <Spinner as="span" animation="border" size="sm" /> : 'Récupérer les données'}
                </Button>
                <hr />
                <Form.Group className="mb-3">
                    <Form.Label>Données JSON</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={20}
                        value={jsonData}
                        onChange={(e) => setJsonData(e.target.value)}
                        placeholder="Les données JSON apparaîtront ici..."
                    />
                </Form.Group>
                {error && <Alert variant="danger">{error}</Alert>}
                <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer les données'}
                </Button>
            </Card.Body>
        </Card>
    );
};

export default DatabaseEditor;
