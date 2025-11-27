// c:\Users\cross\Documents\GitHub\phmc-forms\src\components\Admin\EditBingoPhrasesModal.js
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, set } from 'firebase/database';
import * as Sentry from "@sentry/react";

const EditBingoPhrasesModal = ({ show, onHide, showNotification, commitInfo, sendAdminActionWebhook, adminUserEmail, bingoType }) => {
    const [phrasesText, setPhrasesText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchPhrases = useCallback(async () => {
        if (!bingoType?.path) {
            console.error("[EditBingoPhrasesModal] fetchPhrases: No bingoType or path provided.");
            setError("Impossible de charger les phrases : aucun type de bingo sélectionné.");
            setIsLoading(false);
            return;
        }
        const masterPhrasesRef = ref(database, `bingo/phrases/${bingoType.path}`);

        console.log(`[EditBingoPhrasesModal] fetchPhrases: Starting fetch for ${bingoType.name}...`);
        setIsLoading(true);
        setError('');
        try {
            const snapshot = await get(masterPhrasesRef);
            console.log(`[EditBingoPhrasesModal] fetchPhrases: Firebase get() call resolved for ${bingoType.name}.`);

            if (snapshot.exists()) {
                const phrasesFromDb = snapshot.val();
                console.log(`[EditBingoPhrasesModal] fetchPhrases: Data exists for ${bingoType.name}.`, phrasesFromDb);

                const phraseArray = Array.isArray(phrasesFromDb)
                    ? phrasesFromDb
                    : (typeof phrasesFromDb === 'object' && phrasesFromDb !== null)
                        ? Object.values(phrasesFromDb).map(p => (typeof p === 'object' ? p.phrase : p)).filter(Boolean)
                        : [];

                setPhrasesText(phraseArray.filter(p => p).join('\n'));
                console.log(`[EditBingoPhrasesModal] fetchPhrases: Phrases set for ${bingoType.name}.`);
            } else {
                setPhrasesText('');
                showNotification(`Aucune phrase principale trouvée pour ${bingoType.name}. Vous pouvez les ajouter ici.`, "info-circle");
                console.log(`[EditBingoPhrasesModal] fetchPhrases: No data found for ${bingoType.name}.`);
            }
        } catch (err) {
            console.error(`[EditBingoPhrasesModal] fetchPhrases: Error during fetch for ${bingoType.name}:`, err);
            setError("Impossible de charger les phrases : " + err.message);
            showNotification("Impossible de charger les phrases.", "error");
            Sentry.captureException(err, { extra: { context: `EditBingoPhrasesModal Fetch for ${bingoType?.name}` } });
        } finally {
            setIsLoading(false);
            console.log(`[EditBingoPhrasesModal] fetchPhrases: Finished fetch for ${bingoType.name}. isLoading set to false.`);
        }
    }, [bingoType, showNotification]);

    // MODIFIED: This useEffect hook is now corrected.
    // It will re-run and fetch phrases whenever the modal is shown OR when the bingoType prop changes.
    useEffect(() => {
        if (show && bingoType) {
            fetchPhrases();
        } else if (!show) {
            // When the modal is hidden, reset its state for the next time it opens.
            setIsLoading(true);
            setPhrasesText('');
            setError('');
            setIsSaving(false);
        }
    }, [show, bingoType, fetchPhrases]); // Dependencies ensure this runs at the right times.

    const handleSavePhrases = async () => {
        if (!bingoType?.path) {
            setError("Impossible de sauvegarder les phrases : aucun type de bingo sélectionné.");
            showNotification("Impossible de sauvegarder : aucun type de bingo sélectionné.", "error");
            return;
        }
        const masterPhrasesRef = ref(database, `bingo/phrases/${bingoType.path}`);

        setIsSaving(true);
        setError('');
        try {
            const newPhrasesArray = phrasesText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            if (newPhrasesArray.length < 24) {
                setError("Vous devez avoir au moins 24 phrases uniques pour une carte de bingo complète.");
                showNotification("Pas assez de phrases (minimum 24 requis).", "warning");
                setIsSaving(false);
                return;
            }

            await set(masterPhrasesRef, newPhrasesArray);
            showNotification(`Phrases principales de ${bingoType.name} mises à jour avec succès !`, "check-circle");
            
            if (sendAdminActionWebhook && adminUserEmail) {
                sendAdminActionWebhook(
                    adminUserEmail,
                    `Phrases principales de bingo ${bingoType.name} modifiées`,
                    `Mis à jour ${newPhrasesArray.length} phrases.`,
                    `Phrases principales de bingo (${bingoType.name})`
                );
            }
            onHide();
        } catch (err) {
            console.error("Error saving master phrases:", err);
            setError("Impossible de sauvegarder les phrases : " + err.message);
            showNotification("Impossible de sauvegarder les phrases.", "error");
            Sentry.captureException(err, { extra: { context: `EditBingoPhrasesModal Save for ${bingoType?.name}` } });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="lg"
            dialogClassName="bingo-modal-dialog"
        >
            <Modal.Header closeButton closeVariant="white">
                <Modal.Title>Modifier les phrases principales de bingo {bingoType?.name || ''}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {isLoading ? (
                    <div className="text-center"><Spinner animation="border" /> Chargement des phrases...</div>
                ) : (
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Une phrase par ligne. Minimum 24 phrases requises.</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={15}
                                value={phrasesText}
                                onChange={(e) => setPhrasesText(e.target.value)}
                                placeholder="Entrez vos phrases de bingo ici, une par ligne."
                                disabled={isSaving}
                                className="bingo-phrases-textarea"
                            />
                        </Form.Group>
                        {error && <p className="text-danger">{error}</p>}
                    </Form>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={isSaving}>
                    Annuler
                </Button>
                <Button variant="primary" onClick={handleSavePhrases} disabled={isSaving || isLoading}>
                    {isSaving ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer les phrases'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default EditBingoPhrasesModal;
