import { useCallback } from 'react';
import * as Sentry from "@sentry/react";
import { analytics } from '../firebase';
import { logEvent } from 'firebase/analytics';
import { database } from '../firebase';
import { ref, set, push } from 'firebase/database';
import { submitCctvRequest } from '../utils/cctvRequests';
import { logActivity } from '../utils/activityLog';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';

export const useWebhooks = (formData, commitInfo, showNotification) => {
    const { myPatientID } = useEmployeeAuth();
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

        logActivity({
            category: 'divers',
            action: type === 'rare' ? 'easter_egg_rare' : 'easter_egg',
            summary: embedDescription.split('**').join(''),
            severity: 'success',
        });

        // Doublon Discord facultatif : sans URL configurée, la ligne du journal suffit.
        const webhookUrl = process.env.REACT_APP_DEV_WEBHOOK;
        if (!webhookUrl) return;

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

        // La demande est enregistrée dans le site (cctvRequests) : l'administration du PHMC la traite depuis le menu
        // « Vidéosurveillance » et le demandeur suit les réponses dans « Mes demandes ».
        const result = await submitCctvRequest({
            title: `${cctvData.location ? cctvData.location.split('\n')[0] : 'Lieu non précisé'} — ${cctvData.department || 'Service non précisé'}`,
            discord: cctvData.discordUsername,
            patientID: myPatientID,
            summary: { agent: cctvData.officer, departement: cctvData.department, lieu: cctvData.location },
            fields: [
                { label: "Grade de l'officier requérant", value: cctvData.rank },
                { label: 'Officier requérant', value: cctvData.officer },
                { label: "Numéro de téléphone de l'officier", value: cctvData.officerPH },
                { label: 'Département requérant', value: cctvData.department },
                { label: "Nom d'utilisateur Discord", value: cctvData.discordUsername },
                { label: "Date/heure de l'incident", value: cctvData.incidentDateTime },
                { label: 'Raison de la demande', value: cctvData.requestReason },
                { label: 'Emplacement de la vidéosurveillance', value: cctvData.location },
                { label: 'Description des événements', value: cctvData.description },
                { label: 'Notes hors jeu', value: cctvData.oocNotes },
            ],
        });

        if (result.ok) {
            showNotification("Requête de vidéosurveillance enregistrée. Vous verrez la réponse de l'administration dans « Mes demandes ».", 'check-circle');
            return true;
        }
        Sentry.captureMessage('CCTV request could not be saved', { level: 'error', extra: { reason: result.reason, error: result.error?.message } });
        showNotification(result.reason === 'not-signed-in'
            ? 'Connectez-vous à votre compte pour envoyer une demande de vidéosurveillance.'
            : "Échec de l'enregistrement de la requête de vidéosurveillance. Réessayez dans un instant.", result.reason === 'not-signed-in' ? 'warning' : 'error');
        return false;
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
