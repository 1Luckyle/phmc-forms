// src/components/Admin/RenameRoleKeyModal.js
import React, { useState, useEffect } from 'react';
import { Modal as BootstrapModal, Button, Form, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, set, remove } from "firebase/database";
import { getActiveStore, positionsPath } from '../../utils/recruitmentStore';
import { toStoredPosition, toLegacyPosition } from '../../constants/recruitment';
import * as Sentry from "@sentry/react";

// Modal Styles (can be shared or defined per modal)
const modalOverlayStyle = { /* ... (same as RoleModal) ... */ };
const modalContentStyle = { /* ... (same as RoleModal) ... */ };
const modalHeaderStyle = { /* ... (same as RoleModal) ... */ };
const modalTitleStyle = { /* ... (same as RoleModal) ... */ };
const modalBodyStyle = { /* ... (same as RoleModal) ... */ };
const modalFooterStyle = { /* ... (same as RoleModal) ... */ };
const closeButtonStyle = { /* ... (same as RoleModal) ... */ };


const RenameRoleKeyModal = ({
    show,
    onHide,
    category, // Catégorie de recrutement (constants/recruitment.js)
    currentRoleKey,
    currentRoleData,
    showInAppNotification,
    onKeyRenamed, // Callback to refresh data in parent
    sendAdminActionWebhook, // Function to log admin actions
    adminUserEmail
}) => {
    const [newKey, setNewKey] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (show) {
            setNewKey(''); // Reset new key input when modal opens
            setError('');
        }
    }, [show]);

    const handleNewKeyChange = (e) => {
        // Les clés de postes sont des noms français lisibles (espaces et accents permis) : on retire seulement
        // les caractères interdits par Firebase.
        const sanitizedValue = e.target.value.replace(/[.#$[\]/]/g, '');
        setNewKey(sanitizedValue);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!newKey.trim()) {
            setError('La nouvelle clé ne peut pas être vide.');
            if (showInAppNotification) showInAppNotification('La nouvelle clé ne peut pas être vide.', 'warning');
            return;
        }
        if (newKey === currentRoleKey) {
            setError('La nouvelle clé doit être différente de l\'actuelle.');
            if (showInAppNotification) showInAppNotification('La nouvelle clé ne peut pas être identique à l\'actuelle.', 'info');
            return;
        }

        setIsProcessing(true);

        const store = await getActiveStore(category);
        const basePath = positionsPath(category, store);
        const oldPath = `${basePath}/${currentRoleKey}`;
        const newPath = `${basePath}/${newKey}`;

        try {
            // 1. Check if the new key already exists
            const newKeyRef = ref(database, newPath);
            const snapshot = await get(newKeyRef);
            if (snapshot.exists()) {
                setError(`La clé "${newKey}" existe déjà dans cette catégorie. Veuillez choisir une clé différente.`);
                if (showInAppNotification) showInAppNotification(`La clé "${newKey}" existe déjà.`, 'error');
                setIsProcessing(false);
                return;
            }

            // 2. Copy data to the new key
            await set(ref(database, newPath), store === 'nouveau'
                ? toStoredPosition(currentRoleData)
                : toLegacyPosition(currentRoleData, category.legacyGroup));

            // 3. Delete the old key
            await remove(ref(database, oldPath));

            if (showInAppNotification) showInAppNotification(`La clé de rôle "${currentRoleKey}" a été renommée avec succès en "${newKey}".`, 'check-circle');

            if (sendAdminActionWebhook && adminUserEmail) {
                sendAdminActionWebhook(
                    adminUserEmail,
                    "Clé de rôle renommée",
                    `Catégorie : ${category.label}\nAncienne clé : ${currentRoleKey}\nNouvelle clé : ${newKey}\nNom du poste : ${currentRoleData.nom || 'N/A'}`,
                    category.label
                );
            }

            if (onKeyRenamed) {
                onKeyRenamed(); // Trigger data refresh in parent
            }
            onHide(); // Close modal
        } catch (dbError) {
            setError(`Échec du renommage de la clé : ${dbError.message}`);
            if (showInAppNotification) showInAppNotification(`FÉchec du renommage de la clé. ${dbError.message}`, "error");
            Sentry.captureException(dbError, {
                extra: { context: 'RenameRoleKeyModal Firebase Ops', oldPath, newPath }
            });
        } finally {
            setIsProcessing(false);
        }
    };

    if (!show) return null;

    return (
        <div style={modalOverlayStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <BootstrapModal.Header style={modalHeaderStyle} closeButton={false}> {/* Remove default closeButton if using custom */}
                    <BootstrapModal.Title style={modalTitleStyle}>Renommer la clé du poste : {currentRoleData?.nom || currentRoleKey}</BootstrapModal.Title>
                    <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                </BootstrapModal.Header>
                <BootstrapModal.Body style={modalBodyStyle}>
                    <p>Clé actuelle : <strong>{currentRoleKey}</strong></p>
                    <p className="text-warning small">Les candidatures déjà déposées gardent l'ancienne clé comme référence du poste.</p>
                    <p className="text-warning small">
                        Attention : Renommer la clé modifie son identifiant dans la base de données.
                        Il s'agit d'un changement technique et n'affecte pas le nom du poste visible par les utilisateurs.
                        Assurez-vous que la nouvelle clé est unique et ne contient pas de caractères invalides pour Firebase (., $, #, [, ], /).
                    </p>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Nouvelle clé de rôle *</Form.Label>
                            <Form.Control
                                type="text"
                                value={newKey}
                                onChange={handleNewKeyChange}
                                required
                                placeholder="Nouvelle clé unique (sans . # $ [ ] /)"
                                disabled={isProcessing}
                            />
                            <Form.Text className="text-muted">
                                Les caractères invalides pour Firebase sont supprimés automatiquement.
                            </Form.Text>
                        </Form.Group>
                        {error && <p className="text-danger mt-2 mb-0">{error}</p>}
                    </Form>
                </BootstrapModal.Body>
                <BootstrapModal.Footer style={modalFooterStyle}>
                    <Button variant="secondary" onClick={onHide} disabled={isProcessing}>
                        Annuler
                    </Button>
                    <Button
                        variant="warning" // Use warning color for potentially impactful action
                        onClick={handleSubmit}
                        disabled={isProcessing || !newKey.trim() || newKey === currentRoleKey}
                    >
                        {isProcessing ? <Spinner as="span" animation="border" size="sm" /> : 'Renommer la clé'}
                    </Button>
                </BootstrapModal.Footer>
            </div>
        </div>
    );
};

export default RenameRoleKeyModal;
