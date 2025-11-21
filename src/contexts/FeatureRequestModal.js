import React from 'react';
import { Form, Button } from 'react-bootstrap';
import './FeatureRequestModal.css';
import * as Sentry from "@sentry/react";
import { useNotification } from './NotificationContext';

const FeatureRequestModal = ({
    show,
    onClose,
    featureRequest,
    setFeatureRequest,
    discordName,
    setDiscordName,
    isBbcodeRequest,
    setIsBbcodeRequest,
    bbcodeTitleRequest,
    setBbcodeTitleRequest,
    bbcodeRequestText,
    setBbcodeRequestText,
    bbCodeVersion,
    commitInfo,
    setShowFeatureRequestModal
}) => {
    const { showNotification } = useNotification();

    const handleFeatureRequestSubmit = async () => {
        const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;

        if (!webhookURL) {
            console.error('Discord webhook URL not configured for feature requests.');
            Sentry.captureMessage('Discord webhook URL is missing for feature request submission.', 'error');
            showNotification('Erreur de configuration : Impossible d’envoyer la requête. Veuillez contacter l’administrateur.', 'exclamation-triangle');
            return;
        }

        // Validations
        if (!featureRequest.trim() && (!isBbcodeRequest || !bbcodeRequestText.trim())) {
            showNotification('Veuillez saisir votre rapport de bug/demande de fonctionnalité ou les détails du BBCode.', 'warning');
            return;
        }
        if (!discordName.trim()) {
            showNotification('Veuillez saisir votre nom Discord.', 'warning');
            return;
        }
        if (isBbcodeRequest && !bbcodeTitleRequest.trim()) {
            showNotification('Veuillez saisir un titre pour votre demande de format BBCode.', 'warning');
            return;
        }
        // If it's a BBCode request, the BBCode text itself is now also required for file attachment
        if (isBbcodeRequest && !bbcodeRequestText.trim()) {
            showNotification('Veuillez saisir le BBCode pour votre nouvelle demande de format.', 'warning');
            return;
        }

        const debugInfo = {
            bbCodeVersion: bbCodeVersion,
            userAgent: navigator.userAgent,
        };

        const MAX_FIELD_LENGTH = 1000;
        const requestChunks = [];
        let currentChunk = "";
        const mainRequestDetails = featureRequest || (isBbcodeRequest ? "Voir le fichier BBCode pour les détails." : "Aucun détail fourni.");

        mainRequestDetails.split('\n').forEach(line => {
            if (currentChunk.length + line.length + 1 > MAX_FIELD_LENGTH) {
                requestChunks.push(currentChunk);
                currentChunk = line;
            } else {
                currentChunk += (currentChunk ? '\n' : '') + line;
            }
        });
        if (currentChunk) {
            requestChunks.push(currentChunk);
        }

        // Base fields for the embed
        const baseEmbedFields = [
            { name: "Soumis par", value: discordName || "N/A", inline: true },
            { name: "Type de demande", value: isBbcodeRequest ? "Nouveau format BBCode" : "Bug/Fonctionnalité", inline: true },
        ];

        if (isBbcodeRequest) {
            baseEmbedFields.push({ name: "Titre proposé pour le BBCode", value: bbcodeTitleRequest || "N/A", inline: false });
        }

        let firstMessageBody;
        let firstMessageHeaders = { 'Content-Type': 'application/json' }; // Default for JSON payload

        // --- MODIFICATION START ---
        const requestDetailsFieldName = `Détails de la demande${requestChunks.length > 1 ? ` (Partie 1 sur ${requestChunks.length})` : ''}`;
        // --- MODIFICATION END ---

        if (isBbcodeRequest && bbcodeRequestText.trim()) {
            const bbcodeFile = new File([new Blob([bbcodeRequestText], { type: 'text/plain;charset=utf-8' })], 'requested_bbcode.txt');
            const formDataForFile = new FormData();

            const fieldsForFileEmbed = [
                ...baseEmbedFields,
                { name: "BBCode demandé", value: "Voir le fichier joint 'requested_bbcode.txt'", inline: false },
                { name: requestDetailsFieldName, value: requestChunks[0] || "Aucun détail fourni.", inline: false },
                { name: "Informations de débogage", value: `\n${JSON.stringify(debugInfo, null, 2)}\n`, inline: false }
            ];

            const embedPayloadForFile = {
                title: "📝 Rapport de bug / Demande de fonctionnalité",
                color: 0x3498DB,
                fields: fieldsForFileEmbed,
                timestamp: new Date().toISOString(),
                footer: { text: `Soumis via l'outil PHMC-FR Tools - v${commitInfo.sha || 'N/A'}` }
            };

            formDataForFile.append('payload_json', JSON.stringify({
                content: `Retour d'information / Rapport de bug (Partie 1${requestChunks.length > 1 ? ` sur ${requestChunks.length}` : ''})`,
                embeds: [embedPayloadForFile]
            }));
            formDataForFile.append('file1', bbcodeFile); // 'file1' is a common key for Discord attachments

            firstMessageBody = formDataForFile;
            firstMessageHeaders = {}; // Browser sets Content-Type for FormData, so remove explicit header
        } else {
            // Standard JSON payload (not a BBCode request, or BBCode text is empty)
            const fieldsForJsonEmbed = [
                ...baseEmbedFields,
                { name: requestDetailsFieldName, value: requestChunks[0] || "Aucun détail fourni.", inline: false },
                { name: "Informations de débogage", value: `\n${JSON.stringify(debugInfo, null, 2)}\n`, inline: false }
            ];

            const firstEmbedData = {
                title: "📝 Rapport de bug / Demande de fonctionnalité",
                color: 0x3498DB,
                fields: fieldsForJsonEmbed,
                timestamp: new Date().toISOString(),
                footer: { text: `Soumis via l'outil PHMC-FR Tools - v${commitInfo.sha || 'N/A'}` }
            };
            firstMessageBody = JSON.stringify({
                content: `Retour d'information / Rapport de bug (Partie 1${requestChunks.length > 1 ? ` sur ${requestChunks.length}` : ''})`,
                embeds: [firstEmbedData]
            });
        }

        let allWebhooksSentSuccessfully = true;

        try {
            // Send the first message (either FormData with file or JSON)
            const firstResponse = await fetch(webhookURL, {
                method: 'POST',
                headers: firstMessageHeaders,
                body: firstMessageBody,
            });

            if (!firstResponse.ok) {
                allWebhooksSentSuccessfully = false;
                const errorText = await firstResponse.text();
                console.error(`Failed to send message (Part 1) to Discord webhook. Status: ${firstResponse.status} ${firstResponse.statusText}`, errorText);
                Sentry.captureMessage(`Discord webhook failed for feature request (Part 1): ${firstResponse.status}`, {
                    level: 'error',
                    extra: { statusText: firstResponse.statusText, responseBody: errorText }
                });
            }

            // Send subsequent chunks for long "Request Details" (always JSON)
            if (allWebhooksSentSuccessfully && requestChunks.length > 1) {
                for (let i = 1; i < requestChunks.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1200)); // Delay

                    const subsequentEmbedData = {
                        title: `📝 Détails de la demande de bug/fonctionnalité (Partie ${i + 1} sur ${requestChunks.length})`,
                        description: requestChunks[i],
                        color: 0x3498DB,
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: `Soumis par : ${discordName || "N/A"} | l'outil PHMC-FR Tools - v${commitInfo.sha || 'N/A'}`
                        }
                    };
                    const subsequentResponse = await fetch(webhookURL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }, // Subsequent parts are always JSON
                        body: JSON.stringify({
                            content: `Retour d'information / Rapport de bug (Partie ${i + 1} sur ${requestChunks.length})`,
                            embeds: [subsequentEmbedData]
                        }),
                    });

                    if (!subsequentResponse.ok) {
                        allWebhooksSentSuccessfully = false;
                        const errorText = await subsequentResponse.text();
                        console.error(`Failed to send message (Part ${i + 1}) to Discord webhook. Status: ${subsequentResponse.status} ${subsequentResponse.statusText}`, errorText);
                        Sentry.captureMessage(`Discord webhook failed for feature request (Part ${i + 1}): ${subsequentResponse.status}`, {
                            level: 'error',
                            extra: { statusText: subsequentResponse.statusText, responseBody: errorText }
                        });
                        break;
                    }
                }
            }

            if (allWebhooksSentSuccessfully) {
                showNotification("Merci pour votre retour ! Je vais m'en occuper bientôt.", 'check-circle');
                setShowFeatureRequestModal(false);
                setFeatureRequest('');
                setDiscordName('');
                setIsBbcodeRequest(false);
                setBbcodeTitleRequest('');
                setBbcodeRequestText('');
            } else {
                showNotification(`Partiellement soumis ou échec. Veuillez vérifier la console ou réessayer.`, 'exclamation-triangle');
            }

        } catch (error) {
            console.error('Error submitting feature request:', error);
            Sentry.captureException(error, { extra: { context: 'Feature Request Submission Fetch' } });
            showNotification("Une erreur réseau s'est produite. Veuillez réessayer.", 'exclamation-triangle');
        }
    };

    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay feature-request-modal" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">Rapport de bug / Demande de fonctionnalité / BBCode</h5>
                    <button type="button" className="close" onClick={onClose}>
                        <span>&times;</span>
                    </button>
                </div>
                <div className="modal-body">
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Check
                                type="checkbox"
                                id="isBbcodeRequestCheckbox"
                                label="Demandez-vous qu'un nouveau format BBCode soit ajouté ?"
                                checked={isBbcodeRequest}
                                onChange={(e) => setIsBbcodeRequest(e.target.checked)}
                            />
                        </Form.Group>
                        {isBbcodeRequest && (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label>Titre proposé pour le format BBCode</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={bbcodeTitleRequest}
                                        onChange={(e) => setBbcodeTitleRequest(e.target.value)}
                                        placeholder="Entrez un titre pour le nouveau format BBCode"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>BBCode</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={6}
                                        value={bbcodeRequestText}
                                        onChange={(e) => setBbcodeRequestText(e.target.value)}
                                        placeholder="Collez ou tapez le BBCode pour le nouveau format ici..."
                                    />
                                </Form.Group>
                            </>
                        )}
                        <Form.Group className="mb-3">
                            <Form.Label>Détails de la demande</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={isBbcodeRequest ? 3 : 8}
                                value={featureRequest}
                                onChange={(e) => setFeatureRequest(e.target.value)}
                                placeholder={isBbcodeRequest
                                    ? "Fournissez ici tout contexte ou explication supplémentaire pour votre demande de BBCode."
                                    : "Si vous avez trouvé un bug, veuillez fournir autant d'informations que possible (les images sont également très utiles !). Si vous demandez une fonctionnalité, veuillez fournir une description détaillée de la fonctionnalité que vous souhaitez voir."
                                }
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Votre nom / ID Discord</Form.Label>
                            <Form.Control
                                type="text"
                                name="discordName"
                                value={discordName}
                                onChange={(e) => setDiscordName(e.target.value)}
                                placeholder="Entrez votre nom / ID Discord"
                            />
                        </Form.Group>
                    </Form>
                </div>
                <div className="modal-footer">
                    <Button variant="primary" onClick={handleFeatureRequestSubmit}>
                        Soumettre
                    </Button>
                    <Button variant="secondary" onClick={onClose}>
                        Annuler
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default FeatureRequestModal;