import React, { createContext, useContext, useState, useCallback } from 'react';
import * as Sentry from "@sentry/react";
import { useWebhooks } from '../hooks/useWebhooks';
import { useImageUpload } from '../hooks/useImageUpload';
import { useNotifications } from './NotificationContext';

const WebhookContext = createContext();

export const useWebhook = () => {
    const context = useContext(WebhookContext);
    if (!context) {
        throw new Error('useWebhook must be used within a WebhookProvider');
    }
    return context;
};

export const WebhookProvider = ({ children, commitInfo }) => {
    const [webhookTitle, setWebhookTitle] = useState('');
    const [webhookMessage, setWebhookMessage] = useState('');
    const [mediaUrls, setMediaUrls] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const { showNotification } = useNotifications();

    const { handlePhmcWebhookSubmit, handleWebhookSubmit } = useWebhooks({}, commitInfo, showNotification);
    const { handleImageUpload: uploadImage } = useImageUpload(showNotification);

    const handleLocalImageUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            const uploadedUrls = await uploadImage(event);
            if (uploadedUrls && uploadedUrls.length > 0) {
                setMediaUrls(prevUrls => [...prevUrls, ...uploadedUrls]);
                showNotification(`${uploadedUrls.length} image(s) téléchargée(s) avec succès!`, 'check-circle');
            } else {
                showNotification('Image téléchargée, aucune URL retournée.', 'warning');
            }
        } catch (error) {
            console.error('Error during image upload in WebhookManager:', error);
            Sentry.captureException(error, { extra: { context: 'WebhookManager handleLocalImageUpload' } });
            showNotification('Une erreur inattendue est survenue lors du téléchargement.', 'exclamation-circle');
        } finally {
            setIsUploading(false);
            if (event.target) {
                event.target.value = null;
            }
        }
    };

    const addMediaUrl = (url) => {
        const urlToAdd = url.trim();
        if (!urlToAdd) {
            showNotification('Veuillez entrer une URL.', 'warning');
            return;
        }
        if (!urlToAdd.startsWith('http://') && !urlToAdd.startsWith('https://')) {
            showNotification("Format d'URL invalide. Doit commencer par http:// ou https://", 'warning');
            return;
        }
        if (mediaUrls.includes(urlToAdd)) {
            showNotification("Cette URL a déjà été ajoutée.", 'info-circle');
            return;
        }
        setMediaUrls(prevUrls => [...prevUrls, urlToAdd]);
        showNotification("URL ajoutée avec succès !", 'check-circle');
    };

    const clearMedia = () => {
        setMediaUrls([]);
    };

    const prepareWebhookData = useCallback(() => {
        const title = webhookTitle.trim();
        const message = webhookMessage.trim();
        if (!title && !message && mediaUrls.length === 0) {
            showNotification('Veuillez entrer un titre, un message ou ajouter des médias (image/URL).', 'warning');
            return null;
        }
        if (title.length > 256) {
            showNotification("Le titre de l'embed ne peut pas dépasser 256 caractères.", 'warning');
            return null;
        }
        let description = message || '';
        let firstImageUrlForEmbed = null;
        for (const url of mediaUrls) {
            if (/".(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co')) {
                firstImageUrlForEmbed = url;
                break;
            }
        }
        const footerText = `PHMC Form Generator - v${commitInfo?.sha || 'N/A'}`;
        if (description.length > 4096) {
            showNotification('Embed body (message content) cannot exceed 4096 characters.', 'warning');
            return null;
        }
        const embedFields = [
            { name: "Lien du générateur de formulaire", value: "https://1luckyle.github.io", inline: false },
            { name: "Lien alternatif du générateur de formulaires", value: "https://1luckyle.github.io/phmc-forms/", inline: false }
        ];

        const embed = {
            title: title || "PHMC Notification du Générateur de Formulaires",
            url: "https://1luckyle.github.io/phmc-forms/",
            description: description.trim() || undefined,
            color: 0x7289DA,
            timestamp: new Date().toISOString(),
            image: firstImageUrlForEmbed ? { url: firstImageUrlForEmbed } : undefined,
            fields: embedFields,
            footer: {
                text: footerText
            }
        };

        if (!message && !title && mediaUrls.length > 0) {
            embed.description = `Médias soumis via le Générateur de Formulaires PHMC - v${commitInfo?.sha || 'N/A'}`;
            embed.description += '\n\n**Médias:**\n';
            mediaUrls.forEach((url, index) => {
                const type = url.includes('streamable.com') ? 'Vidéo' : (/".(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co')) ? 'Image' : 'Lien';
                embed.description += `- ${type} ${index + 1}: ${url}\n`;
            });
            if (embed.description.length > 4096) {
                showNotification('Le corps de l\'embed (y compris les liens médias) ne peut pas dépasser 4096 caractères.', 'warning');
                return null;
            }
        }

        return {
            username: "PHMC",
            avatar_url: 'https://i.ibb.co/0pgw9hHm/phmc.png',
            embeds: [embed],
        };
    }, [webhookTitle, webhookMessage, mediaUrls, commitInfo, showNotification]);

    const sendWebhook = (type) => {
        const payload = prepareWebhookData();
        if (payload) {
            if (type === 'primary') {
                handleWebhookSubmit(payload);
            } else if (type === 'secondary') {
                handlePhmcWebhookSubmit(payload);
            }
        }
    };

    const value = {
        webhookTitle,
        setWebhookTitle,
        webhookMessage,
        setWebhookMessage,
        mediaUrls,
        addMediaUrl,
        clearMedia,
        handleLocalImageUpload,
        isUploading,
        sendWebhook,
    };

    return (
        <WebhookContext.Provider value={value}>
            {children}
        </WebhookContext.Provider>
    );
};
