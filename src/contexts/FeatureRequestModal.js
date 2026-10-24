import React from 'react';
import { Form, Button } from 'react-bootstrap';
import './FeatureRequestModal.css';
import * as Sentry from "@sentry/react";
import { useNotification } from './NotificationContext';
import DebugFillButton from '../components/DebugFillButton';

// Deux versions du même formulaire :
//   • mode « bug »     : rapport de bug (ouvert à tous, connectés ou non) ;
//   • mode « feature » : demande de fonctionnalité (comptes connectés), avec en plus la possibilité de proposer un
//     NOUVEAU FORMULAIRE en collant son BBCode ou son HTML (toujours accepté, que l'accès au BBCode soit activé ou non).
const looksLikeHtml = (text) => /<\/?[a-z][\s\S]*>/i.test(text || '');

const FeatureRequestModal = ({
    show,
    onClose,
    mode = 'bug',
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
    const isFeature = mode === 'feature';
    // Proposer un nouveau formulaire n'existe que dans la demande de fonctionnalité.
    const isFormRequest = isFeature && isBbcodeRequest;
    const kindLabel = isFeature ? (isFormRequest ? 'Nouveau formulaire' : 'Fonctionnalité') : 'Bug';

    const handleFeatureRequestSubmit = async () => {
        const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;

        if (!webhookURL) {
            console.error('Discord webhook URL not configured for feature requests.');
            Sentry.captureMessage('Discord webhook URL is missing for feature request submission.', 'error');
            showNotification('Erreur de configuration : Impossible d’envoyer la requête. Veuillez contacter l’administrateur.', 'exclamation-triangle');
            return;
        }

        // Validations
        if (!featureRequest.trim() && (!isFormRequest || !bbcodeRequestText.trim())) {
            showNotification(isFeature
                ? 'Veuillez décrire la fonctionnalité souhaitée (ou fournir le BBCode / HTML du formulaire).'
                : 'Veuillez décrire le bug rencontré.', 'warning');
            return;
        }
        if (!discordName.trim()) {
            showNotification('Veuillez saisir votre nom Discord.', 'warning');
            return;
        }
        if (isFormRequest && !bbcodeTitleRequest.trim()) {
            showNotification('Veuillez saisir un titre pour le nouveau formulaire.', 'warning');
            return;
        }
        // Un nouveau formulaire : son contenu (BBCode ou HTML) est joint à la demande en fichier.
        if (isFormRequest && !bbcodeRequestText.trim()) {
            showNotification('Veuillez saisir le BBCode ou le HTML du nouveau formulaire.', 'warning');
            return;
        }

        const debugInfo = {
            bbCodeVersion: bbCodeVersion,
            userAgent: navigator.userAgent,
        };

        const MAX_FIELD_LENGTH = 1000;
        const requestChunks = [];
        let currentChunk = "";
        const mainRequestDetails = featureRequest || (isFormRequest ? "Voir le fichier joint pour les détails." : "Aucun détail fourni.");

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

        const embedTitle = isFeature ? '💡 Demande de fonctionnalité' : '🐞 Rapport de bug';
        const contentLabel = isFeature ? 'Demande de fonctionnalité' : 'Rapport de bug';

        // Base fields for the embed
        const baseEmbedFields = [
            { name: "Soumis par", value: discordName || "N/A", inline: true },
            { name: "Type de demande", value: kindLabel, inline: true },
        ];

        if (isFormRequest) {
            baseEmbedFields.push({ name: "Titre proposé pour le formulaire", value: bbcodeTitleRequest || "N/A", inline: false });
        }

        let firstMessageBody;
        let firstMessageHeaders = { 'Content-Type': 'application/json' }; // Default for JSON payload

        const requestDetailsFieldName = `Détails de la demande${requestChunks.length > 1 ? ` (Partie 1 sur ${requestChunks.length})` : ''}`;

        if (isFormRequest && bbcodeRequestText.trim()) {
            const isHtml = looksLikeHtml(bbcodeRequestText);
            const fileName = isHtml ? 'formulaire_demande.html' : 'formulaire_demande.txt';
            const formFile = new File([new Blob([bbcodeRequestText], { type: isHtml ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' })], fileName);
            const formDataForFile = new FormData();

            const fieldsForFileEmbed = [
                ...baseEmbedFields,
                { name: isHtml ? 'HTML demandé' : 'BBCode demandé', value: `Voir le fichier joint '${fileName}'`, inline: false },
                { name: requestDetailsFieldName, value: requestChunks[0] || "Aucun détail fourni.", inline: false },
                { name: "Informations de débogage", value: `\n${JSON.stringify(debugInfo, null, 2)}\n`, inline: false }
            ];

            const embedPayloadForFile = {
                title: embedTitle,
                color: 0x3498DB,
                fields: fieldsForFileEmbed,
                timestamp: new Date().toISOString(),
                footer: { text: `Soumis via l'outil PHMC-FR Tools - v${commitInfo.sha || 'N/A'}` }
            };

            formDataForFile.append('payload_json', JSON.stringify({
                content: `${contentLabel} (Partie 1${requestChunks.length > 1 ? ` sur ${requestChunks.length}` : ''})`,
                embeds: [embedPayloadForFile]
            }));
            formDataForFile.append('file1', formFile); // 'file1' is a common key for Discord attachments

            firstMessageBody = formDataForFile;
            firstMessageHeaders = {}; // Browser sets Content-Type for FormData, so remove explicit header
        } else {
            // Standard JSON payload
            const fieldsForJsonEmbed = [
                ...baseEmbedFields,
                { name: requestDetailsFieldName, value: requestChunks[0] || "Aucun détail fourni.", inline: false },
                { name: "Informations de débogage", value: `\n${JSON.stringify(debugInfo, null, 2)}\n`, inline: false }
            ];

            const firstEmbedData = {
                title: embedTitle,
                color: 0x3498DB,
                fields: fieldsForJsonEmbed,
                timestamp: new Date().toISOString(),
                footer: { text: `Soumis via l'outil PHMC-FR Tools - v${commitInfo.sha || 'N/A'}` }
            };
            firstMessageBody = JSON.stringify({
                content: `${contentLabel} (Partie 1${requestChunks.length > 1 ? ` sur ${requestChunks.length}` : ''})`,
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
                        title: `${embedTitle} — détails (Partie ${i + 1} sur ${requestChunks.length})`,
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
                            content: `${contentLabel} (Partie ${i + 1} sur ${requestChunks.length})`,
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
                    <h5 className="modal-title">
                        <i className={`fas ${isFeature ? 'fa-lightbulb' : 'fa-bug'}`} style={{ marginRight: '8px' }}></i>
                        {isFeature ? 'Demande de fonctionnalité' : 'Rapport de bug'}
                    </h5>
                    <button type="button" className="close" onClick={onClose}>
                        <span>&times;</span>
                    </button>
                </div>
                <div className="modal-body">
                    <Form>
                        {isFeature && (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Check
                                        type="checkbox"
                                        id="isBbcodeRequestCheckbox"
                                        label="Demandez-vous qu'un nouveau formulaire soit ajouté ?"
                                        checked={isBbcodeRequest}
                                        onChange={(e) => setIsBbcodeRequest(e.target.checked)}
                                    />
                                </Form.Group>
                                {isBbcodeRequest && (
                                    <>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Titre proposé pour le formulaire</Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={bbcodeTitleRequest}
                                                onChange={(e) => setBbcodeTitleRequest(e.target.value)}
                                                placeholder="Entrez un titre pour le nouveau formulaire"
                                            />
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>BBCode ou HTML du formulaire</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={6}
                                                value={bbcodeRequestText}
                                                onChange={(e) => setBbcodeRequestText(e.target.value)}
                                                placeholder="Collez ou tapez ici le BBCode ou le HTML du nouveau formulaire…"
                                            />
                                            <Form.Text className="text-muted">Les deux formats sont acceptés.</Form.Text>
                                        </Form.Group>
                                    </>
                                )}
                            </>
                        )}
                        <Form.Group className="mb-3">
                            <Form.Label>{isFeature ? 'Détails de la demande' : 'Détails du bug'}</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={isFormRequest ? 3 : 8}
                                value={featureRequest}
                                onChange={(e) => setFeatureRequest(e.target.value)}
                                placeholder={isFormRequest
                                    ? "Fournissez ici tout contexte ou explication supplémentaire pour votre demande de formulaire."
                                    : isFeature
                                        ? "Décrivez la fonctionnalité souhaitée avec le plus de précision possible : à quoi elle servirait, où vous l'imagineriez dans l'outil."
                                        : "Décrivez le bug : ce que vous faisiez, ce qui s'est passé, ce que vous attendiez. Plus il y a d'informations, mieux c'est (les images sont également très utiles !)."
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
                    <DebugFillButton
                        style={{ marginRight: 'auto' }}
                        onFill={() => {
                            setIsBbcodeRequest(isFeature);
                            setBbcodeTitleRequest('[TEST] Nouveau formulaire de test');
                            setBbcodeRequestText('[b]Titre de test[/b]\n[list]\n[*] Élément de test\n[/list]');
                            setFeatureRequest(isFeature ? '[TEST] Demande générée par le mode debug.' : '[TEST] Bug généré par le mode debug.');
                            setDiscordName('testeur.debug');
                        }}
                    />
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
