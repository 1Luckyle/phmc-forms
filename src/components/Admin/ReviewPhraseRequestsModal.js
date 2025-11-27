// src/components/Admin/ReviewPhraseRequestsModal.js
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, ListGroup, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, get, update, set, remove } from 'firebase/database'; // Import remove
import * as Sentry from "@sentry/react";

const BINGO_TYPES = [
    { id: 'er', name: 'Emergency Room', path: 'ER' },
    { id: 'ems', name: 'EMS', path: 'EMS' },
    { id: 'coroner', name: 'Coroner', path: 'Coroner' }
];

const ReviewPhraseRequestsModal = ({ show, onHide, showNotification, sendAdminActionWebhook, adminUserEmail }) => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(null);

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        const requestsRef = ref(database, 'bingo/phraseRequests');
        try {
            const snapshot = await get(requestsRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                let pendingRequests = Object.entries(data)
                    .map(([key, value]) => ({ id: key, ...value }))
                    .filter(req => req.status === 'pending')
                    .sort((a, b) => a.timestamp - b.timestamp);

                
                setRequests(pendingRequests);
            } else {
                setRequests([]);
            }
        } catch (error) {
            console.error("Error fetching phrase requests:", error);
            showNotification("Échec du chargement des requêtes de phrases.", "error");
            Sentry.captureException(error, { extra: { context: 'ReviewPhraseRequestsModal Fetch' } });
        } finally {
            setIsLoading(false);
        }
    }, [showNotification]);


    const deleteRequest = async (requestId) => {
        const requestRef = ref(database, `bingo/phraseRequests/${requestId}`);
        try {
            // 1. Get the request data BEFORE deleting it (for webhook info)
            const snapshot = await get(requestRef);
            const requestData = snapshot.val();  // Store the data to use in the webhook

            // 2. Delete the request
            await remove(requestRef);
            console.log(`Deleted request ${requestId}`);

            // 3. Send the webhook notification AFTER successful deletion
            if (sendAdminActionWebhook && requestData) { // Check if webhook function exists and we have data
                sendAdminActionWebhook(
                    adminUserEmail,
                    "Demande de phrase de bingo programmée supprimée", // New Action Name
                    `ID de la requête : ${requestId}\nPhrase: "${requestData.phrase}"\nStatut: ${requestData.status}\nDemandé par: ${requestData.requestedBy}\nType de bingo: ${requestData.bingoType || 'général'}`,
                    "Demandes de phrases de bingo (Nettoyage)" // New Category or adjust as needed
                );
            }

            // 4. Optionally, refresh the requests list after deletion
            fetchRequests(); 
        } catch (error) {
            console.error(`Error deleting request ${requestId}:`, error);
            Sentry.captureException(error, { extra: { context: 'ReviewPhraseRequestsModal Delete' } });
        }
    };


    useEffect(() => {
        if (show) {
            fetchRequests();
        }
    }, [show, fetchRequests]);

    const handleApprove = async (request) => {
        setIsProcessing(request.id);

        const bingoTypeObject = BINGO_TYPES.find(type => type.name === request.bingoType);

        if (!bingoTypeObject) {
            showNotification(`Erreur : type de bingo inconnu "${request.bingoType}" pour l'approbation de la phrase.`, 'error');
            console.error(`Could not find a matching bingo type for name: ${request.bingoType}`);
            await handleDeny(request, 'Denied (Invalid Type)');
            setIsProcessing(null);
            return;
        }

        const masterPhrasesRef = ref(database, `bingo/phrases/${bingoTypeObject.path}`);
        const requestRef = ref(database, `bingo/phraseRequests/${request.id}`);

        try {
            const masterSnapshot = await get(masterPhrasesRef);
            const masterPhrasesData = masterSnapshot.val();
            const currentPhrases = masterSnapshot.exists()
                ? (Array.isArray(masterPhrasesData)
                    ? masterPhrasesData
                    : (typeof masterPhrasesData === 'object' && masterPhrasesData !== null)
                        ? Object.values(masterPhrasesData).map(p => (typeof p === 'object' ? p.phrase : p)).filter(Boolean)
                        : [])
                : [];

            // Split the phrase into multiple phrases by line breaks
            const phrasesToApprove = request.phrase.split('\n').map(phrase => phrase.trim()).filter(phrase => phrase);

            // Check for duplicates before adding any phrases
            for (const phrase of phrasesToApprove) {
                if (currentPhrases.some(p => p.toLowerCase() === phrase.toLowerCase())) {
                    showNotification(`La phrase "${phrase}" existe déjà dans la liste ${bingoTypeObject.name}. Requête refusée.`, 'warning');
                    await handleDeny(request, 'Denied (Duplicate)');
                    return;
                }
            }


        let updatedPhrases = [...currentPhrases, ...phrasesToApprove];
        updatedPhrases = updatedPhrases.filter(phrase => phrase !== undefined && phrase !== null && phrase !== ""); // CRITICAL FIX

        await set(masterPhrasesRef, updatedPhrases);


            await update(requestRef, { status: 'approved', processedBy: adminUserEmail, processedAt: new Date().toISOString() });

            showNotification(`Phrase(s) ajoutée(s) à la liste ${bingoTypeObject.name} !`, 'check-circle');

            if (sendAdminActionWebhook) {
                const phraseList = phrasesToApprove.map(phrase => `"${phrase}"`).join('\n'); // Create a list of phrases
                sendAdminActionWebhook(
                    adminUserEmail,
                    "Demande de phrase de bingo approuvée",
                    `Phrases:\n${phraseList}\nDemandé par: ${request.requestedBy}\nPour le bingo: ${request.bingoType || 'énéral'}`,
                    "Demandes de phrases de bingo"
                );
            }
            fetchRequests();
        } catch (error) {
            console.error("Error approving phrase:", error);
            showNotification("Phrase non approuvée.", "error");
            Sentry.captureException(error, { extra: { context: 'ReviewPhraseRequestsModal Approve' } });
        } finally {
            setIsProcessing(null);
        }
    };

    const handleDeny = async (request, reason = 'Denied') => {
        setIsProcessing(request.id);
        const requestRef = ref(database, `bingo/phraseRequests/${request.id}`);
        try {
            await update(requestRef, { status: reason, processedBy: adminUserEmail, processedAt: new Date().toISOString() });
            showNotification(`La demande de phrase(s) a été refusée.`, 'info-circle');

            if (sendAdminActionWebhook) {
                sendAdminActionWebhook(
                    adminUserEmail,
                    "Demande de phrase de bingo refusée",
                    `Phrase: "${request.phrase}"\nDemandé par: ${request.requestedBy}\nPour le bingo: ${request.bingoType || 'énéral'}\nRaison: ${reason}`,
                    "Demandes de phrases de bingo"
                );
            }
            fetchRequests();
        } catch (error) {
            console.error("Error denying phrase:", error);
            showNotification("N'a pas réussi à nier la phrase.", "error");
            Sentry.captureException(error, { extra: { context: 'ReviewPhraseRequestsModal Deny' } });
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <Modal show={show} onHide={onHide} size="lg" dialogClassName="bingo-modal-dialog">
            <Modal.Header closeButton closeVariant="white">
                <Modal.Title>Examiner les phrases de bingo en attente</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ overflowY: 'auto' }}> {/* ADDED SCROLL BAR */}
                {isLoading ? (
                    <div className="text-center"><Spinner animation="border" /> Chargement des demandes...</div>
                ) : requests.length > 0 ? (
                    <ListGroup variant="flush">
                        {requests.map(req => (
                            <ListGroup.Item key={req.id} className="d-flex justify-content-between align-items-center bg-transparent text-light">
                                <div>
                                    <p className="mb-0"><strong>Phrase(s):</strong></p>
                                    {req.phrase.split('\n').map((phrase, index) => (
                                        <p key={index} className="mb-1">
                                            "{phrase.trim()}"
                                        </p>
                                    ))}
                                    {req.bingoType && (
                                        <p className="mb-1" style={{ color: '#0dcaf0' }}>
                                            <small>Pour: <strong>{req.bingoType} Bingo</strong></small>
                                        </p>
                                    )}
                                    <small className="text-muted">
                                        Demandé par: {req.requestedBy} le {new Date(req.timestamp).toLocaleString()}
                                    </small>
                                </div>
                                <div>
                                    {isProcessing === req.id ? (
                                        <Spinner animation="border" size="sm" />
                                    ) : (
                                        <>
                                            <Button variant="outline-success" size="sm" className="me-2" onClick={() => handleApprove(req)}>
                                                Approuver
                                            </Button>
                                            <Button variant="outline-danger" size="sm" onClick={() => handleDeny(req)}>
                                                Refuser
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                ) : (
                    <p className="text-center text-muted">Aucune demande de phrase en attente.</p>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Fermer
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ReviewPhraseRequestsModal;
