// src/components/PhraseRequestModal.js
import React, { useState } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { database } from '../firebase';
import { ref, push, serverTimestamp } from 'firebase/database';
import * as Sentry from "@sentry/react";

const PhraseRequestModal = ({ show, onHide, showNotification, selectedEmployee, selectedBingoType, sendPhraseRequestWebhook }) => {
    const [phraseText, setPhraseText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setError('');
        if (!phraseText.trim()) {
            setError('La phrase ne peut pas être vide.');
            showNotification('Phrase ne peut pas être vide.', 'warning');
            return;
        }

        // Check if a bingo type is selected before allowing a request
        if (!selectedBingoType) {
            setError('Veuillez sélectionner un type de Bingo avant de demander une phrase (ER, EMS, Coroner).');
            showNotification('Veuillez sélectionner un type de Bingo d\'abord.', 'warning');
            return;
        }

        setIsSubmitting(true);
        const phraseRequestsRef = ref(database, 'bingo/phraseRequests');

        try {
            const trimmedPhrase = phraseText.trim();
            const requesterName = selectedEmployee ? selectedEmployee.value : 'Anonymous';
            const bingoTypeName = selectedBingoType.name || 'Unknown';

            await push(phraseRequestsRef, {
                phrase: trimmedPhrase,
                requestedBy: requesterName,
                timestamp: serverTimestamp(),
                status: 'pending',
                bingoType: bingoTypeName
            });

            // NEW: Call the webhook for the phrase request
            if (sendPhraseRequestWebhook) {

                sendPhraseRequestWebhook({
                    requester: requesterName,
                    phrase: trimmedPhrase,
                    bingoType: bingoTypeName,
                });

            }

            showNotification('Phrase demandée soumise avec succès!', 'check-circle');
            setPhraseText('');
        } catch (err) {
            console.error("Error submitting phrase request:", err);
            setError("Échec de la soumission de la demande: " + err.message);
            showNotification('Échec de la soumission de la demande de phrase.', 'error');
            Sentry.captureException(err, { extra: { context: 'PhraseRequestModal Submit' } });
        } finally {
            setIsSubmitting(false);
            onHide();
        }
    };

    React.useEffect(() => {
        if (!show) {
            setPhraseText('');
            setIsSubmitting(false);
            setError('');
        }
    }, [show]);

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="md"
            dialogClassName="bingo-modal-dialog"
        >
            <Modal.Header closeButton closeVariant="white">
                <Modal.Title>Demander une nouvelle phrase de bingo</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form.Group className="mb-3">
                    <Form.Label>Entrer votre idée de phrase</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        value={phraseText}
                        onChange={(e) => setPhraseText(e.target.value)}
                        placeholder="Saisissez ici votre idée de phrase (ex. « Le patient demande à être conduit à la cafétéria »)."
                        disabled={isSubmitting}
                        className="bingo-phrases-textarea"
                    />
                    <Form.Text className="text-muted">
                       Cette phrase sera examinée par un administrateur avant d'être ajoutée à la liste principale.
                        {selectedBingoType && ` Elle sera considérée pour le Bingo ${selectedBingoType.name}.`}
                    </Form.Text>
                </Form.Group>
                {error && <p className="text-danger">{error}</p>}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={isSubmitting}>
                    Annuler
                </Button>
                <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !phraseText.trim()}>
                    {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : 'Soumettre la demande'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default PhraseRequestModal;
