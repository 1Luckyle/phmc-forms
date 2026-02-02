import { useCallback } from 'react';
import * as Sentry from "@sentry/react";
import { analytics } from '../firebase';
import { logEvent } from 'firebase/analytics';
import { database } from '../firebase';
import { ref, set, push } from 'firebase/database';

export const useWebhooks = (formData, commitInfo, showNotification) => {
    const logWebhookToFirebase = async (type, payload) => {
        const db = database;
        const logsRef = ref(db, 'webhook_logs');
        const newLogRef = push(logsRef);
        await set(newLogRef, {
            type,
            payload,
            timestamp: Date.now(),
        });
    };

    const sendEasterEggNotification = async (type = 'normal') => {
        const webhookUrl = process.env.REACT_APP_DEV_WEBHOOK;
        if (!webhookUrl) {
            console.error("Discord webhook URL is not configured.");
            return;
        }

        const userIdentifier = formData.coronerEmployee || formData.phmcEmployee || formData.patientName || formData.decedentName || 'Quelqu\'un';

        let embedTitle = "🎉 Easter Egg trouvé! 🎉";
        let embedDescription = `Hey! **${userIdentifier}** viens de trouver l'easter egg normal! 🥚`;
        let embedColor = 0x7289DA;
        let triggerSource = "Triggered during report save";

        if (type === 'rare') {
            embedTitle = "✨ Easter egg rare trouvé! ✨";
            embedDescription = `Wow! **${userIdentifier}** viens de déclencher l'easter egg rare à 1% ! 🥚🎉`;
            embedColor = 0xFFD700;
        }

        const isManualTrigger = window.location.hostname === 'localhost' && type === 'rare';
        if (isManualTrigger) {
            embedTitle += " (Déclenchement manuel)";
            embedDescription = `Debug: **${userIdentifier}** viens de déclencher manuellement l'easter egg rare! 🥚🎉`;
            triggerSource = "Déclenché via le bouton de débogage";
        }

        const embed = {
            title: embedTitle,
            description: embedDescription,
            color: embedColor,
            timestamp: new Date().toISOString(),
            footer: {
                text: `l'outil PHMC-FR Tools | ${triggerSource}`
            }
        };

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ embeds: [embed] }),
            });

            if (!response.ok) {
                console.error(`Error sending ${type} easter egg webhook: ${response.status} ${response.statusText}`);
            } else {
                console.log(`${type} easter egg notification sent successfully.`);
                await logWebhookToFirebase(type, { embeds: [embed] });
            }
        } catch (error) {
            console.error(`Failed to send ${type} easter egg webhook:`, error);
            Sentry.captureException(error, { extra: { context: `sendEasterEggNotification (${type})` } });
        }
    };

    const handleCctvWebhookSubmit = async (cctvData) => {
        Sentry.captureMessage('CCTV Request Submitted', {
            level: 'info',
            extra: {
                officer: cctvData.officer,
                department: cctvData.department,
                location: cctvData.location,
                reason: cctvData.requestReason,
                submitter: formData.coronerEmployee || formData.phmcEmployee || 'Utilisateur d\'application inconnu'
            },
            tags: {
                webhook_type: 'cctv_request',
                environment: process.env.NODE_ENV
            }
        });
        logEvent(analytics, 'cctv_request', {
            officer: cctvData.officer,
            department: cctvData.department,
            location: cctvData.location,
            reason: cctvData.requestReason,
            submitter: formData.coronerEmployee || formData.phmcEmployee || 'Utilisateur d\'application inconnu',
            environment: process.env.NODE_ENV
        });

        const phmcWebhookURL = process.env.REACT_APP_PHMC_DISCORD;
        const devWebhookURL = process.env.REACT_APP_DEV_WEBHOOK;
        const leoWebhookURL = process.env.REACT_APP_LEO_WEBHOOK_URL;

        if (!devWebhookURL) {
            showNotification('Aucune URL de webhook CCTV n\'est configurée.', 'error');
            Sentry.captureMessage('Neither DEV nor LEO webhook URLs are configured for CCTV.', 'error');
            return false;
        }

        const embed = {
            title: "📹 Demande d'images de vidéosurveillance",
            color: 0x007bff,
            fields: [
                { name: "Grade de l'officier requérant", value: cctvData.rank || "N/A", inline: true },
                { name: "Officier requérant", value: cctvData.officer || "N/A", inline: true },
                { name: "Numéro de téléphone de l'officier", value: cctvData.officerPH || "N/A", inline: true },
                { name: "Département requérant", value: cctvData.department || "N/A", inline: true },
                ...(cctvData.discordUsername ? [{ name: "Nom d'utilisateur Discord", value: cctvData.discordUsername, inline: true }] : []),
                { name: "Date/heure de l'incident", value: cctvData.incidentDateTime || "N/A", inline: true },
                { name: "Raison de la demande", value: cctvData.requestReason || "N/A", inline: false },
                { name: "Emplacement de la vidéosurveillance", value: cctvData.location || "N/A", inline: false },
                { name: "Description des événements", value: `\`\`\`${cctvData.description || "N/A"}\`\`\``, inline: false },
                ...(cctvData.oocNotes ? [{ name: "Notes hors jeu", value: `\`\`\`${cctvData.oocNotes}\`\`\``, inline: false }] : []),
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `PHMC-FR Tools - v${commitInfo.sha || 'N/A'}` }
        };

        const payload = JSON.stringify({
            username: "CCTV Bot",
            content: "Nouvelle demande de vidéosurveillance ! Alerte Directrice : <@&1422251503350972517> | Alerte Administration : <@&1422251789146787920>",
            embeds: [embed]
        });
        const webhookTargets = [];
        if (phmcWebhookURL) webhookTargets.push({ name: 'PHMC', url: phmcWebhookURL });
        if (devWebhookURL) webhookTargets.push({ name: 'Dev', url: devWebhookURL });
        if (leoWebhookURL) webhookTargets.push({ name: 'LEO', url: leoWebhookURL });

        const sendPromises = webhookTargets.map(target =>
            fetch(target.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            }).then(async response => {
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Requête de ${target.name} échouée avec le statut ${response.status} : ${errorText}`);
                }
                return { name: target.name, status: 'fulfilled' };
            })
        );

        const results = await Promise.allSettled(sendPromises);
        let successfulSends = 0;

        results.forEach((result, index) => {
            const targetName = webhookTargets[index].name;
            if (result.status === 'fulfilled') {
                console.log(`Successfully sent CCTV webhook to ${targetName}.`);
                successfulSends++;
            } else {
                console.error(`Failed to send CCTV webhook to ${targetName}:`, result.reason.message);
                Sentry.captureMessage(`CCTV Webhook to ${targetName} failed`, {
                    level: 'error',
                    extra: { reason: result.reason.message }
                });
            }
        });

        if (successfulSends === webhookTargets.length) {
            showNotification('Requête de vidéosurveillance envoyée avec succès!', "check-circle");
            return true;
        } else if (successfulSends > 0) {
            showNotification('Requête de vidéosurveillance envoyée, mais certaines destinations ont échoué.', "warning");
            return true;
        } else {
            showNotification('Échec de l\'envoi de la requête de vidéosurveillance à toutes les destinations.', "error");
            return false;
        }
    };

    const sendWebhookPayload = async (webhookURL, payload, successMessage, context, notifyFunc) => {
        if (!webhookURL) {
            console.error(`Discord webhook URL not configured for ${context}.`);
            Sentry.captureMessage(`Discord webhook URL is missing for ${context} submission.`, 'error');
            notifyFunc('Erreur de configuration : Impossible d\'envoyer le message.', 'exclamation-triangle');
            return false;
        }

        try {
            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to send ${context} webhook embed. Status: ${response.status} ${response.statusText}`, errorText);
                Sentry.captureMessage(`Discord webhook embed failed for ${context}: ${response.status}`, {
                    level: 'error',
                    extra: { statusText: response.statusText, responseBody: errorText }
                });
                notifyFunc(`Échec de l'envoi de l'intégration à ${context}. Statut : ${response.status}`, 'exclamation-triangle');
                return false;
            } else {
                notifyFunc(successMessage, 'check-circle');
                return true;
            }
        } catch (error) {
            console.error(`Error sending ${context} webhook embed:`, error);
            Sentry.captureException(error, { extra: { context: `${context} Webhook Embed Submission Fetch` } });
            notifyFunc(`Une erreur réseau est survenue lors de l'envoi à ${context}. Veuillez réessayer.`, 'exclamation-triangle');
            return false;
        }
    };

    const handlePhmcWebhookSubmit = async (payload) => {
        if (!payload) return;
        const webhookURL = process.env.REACT_APP_PHMC_DISCORD;
        await sendWebhookPayload(webhookURL, payload, 'Intégration webhook PHMC envoyée avec succès !', 'PHMC', showNotification);
    };

    const handleWebhookSubmit = async (payload) => {
        if (!payload) return;
        const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
        await sendWebhookPayload(webhookURL, payload, 'Intégration webhook Dev envoyée avec succès !', 'Dev', showNotification);
    };

    return {
        logWebhookToFirebase,
        sendEasterEggNotification,
        handleCctvWebhookSubmit,
        handlePhmcWebhookSubmit,
        handleWebhookSubmit,
    };
};
