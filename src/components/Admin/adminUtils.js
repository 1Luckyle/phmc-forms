import * as Sentry from "@sentry/react";
import { logAdminAction } from '../../utils/activityLog';

export const sendDiscordNotification = async (webhookURL, payload, context, notifyFunc) => {
    if (!webhookURL) {
        console.error(`Discord webhook URL not configured for ${context}.`);
        Sentry.captureMessage(`Discord webhook URL is missing for ${context} submission.`, 'error');
        if (notifyFunc) notifyFunc('Erreur de configuration : Impossible d’envoyer le message.', 'exclamation-triangle');
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
            if (notifyFunc) notifyFunc(`Échec de l'envoi de l'embed à ${context}. Statut : ${response.status}`, 'exclamation-triangle');
            return false;
        } else {
            if (notifyFunc) notifyFunc('Notification Discord envoyée avec succès !', 'check-circle');
            return true;
        }
    } catch (error) {
        console.error(`Error sending ${context} webhook embed:`, error);
        Sentry.captureException(error, { extra: { context: `${context} Webhook Embed Submission Fetch` } });
        if (notifyFunc) notifyFunc(`Une erreur réseau est survenue lors de l'envoi à ${context}. Veuillez réessayer.`, 'exclamation-triangle');
        return false;
    }
};
// Journal des actions d'administration/recrutement sur Discord (même format que celui du
// panneau admin). `actorLabel` : « Admin » ou « Recruteur » selon qui agit.
export const sendAdminActionWebhook = async (actorEmail, action, details, categoryName = null, actorLabel = 'Admin') => {
    // Le journal d'activité du site est la trace officielle ; Discord n'est plus qu'un doublon facultatif.
    logAdminAction({ email: actorEmail, action, details, categoryName, actorLabel });
    const webhookURL = process.env.REACT_APP_ADMIN_ACTION_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DEV_WEBHOOK;
    if (!webhookURL) {
        return;
    }
    let timeZone = 'N/A';
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* ignoré */ }
    const lines = [`**Action:** ${action || 'Action Inconnue'}`, `**${actorLabel}:** ${actorEmail || 'Inconnu'}`];
    if (categoryName) lines.push(`**Catégorie:** ${categoryName}`);
    const embed = {
        title: 'Action Admin Enregistrée',
        color: 0xFFA500,
        description: lines.join('\n'),
        fields: [{ name: 'Détails', value: `\`\`\`${String(details || '').substring(0, 1000)}\`\`\``, inline: false }],
        timestamp: new Date().toISOString(),
        footer: { text: `PHMC-FR Tools | ${timeZone}` },
    };
    try {
        await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
        });
    } catch (error) {
        console.error('Error sending admin action webhook:', error);
        Sentry.captureException(error, { extra: { context: 'Admin Action Webhook (recruitment)' } });
    }
};
