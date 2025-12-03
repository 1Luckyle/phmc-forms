import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import * as Sentry from "@sentry/react";
import EMSAMAImage from '../assets/EMSAMA.png';
import { copyToClipboard } from './notificationService';

import './EmsAmaModal.css';

const EmsAmaModal = ({ show, onHide, showNotification, commitInfo, handleImageUpload }) => {
    const [patientSignature, setPatientSignature] = useState('');
    const [date, setDate] = useState('');
    const [guardianSignature, setGuardianSignature] = useState('');
    const [paramedicSignature, setParamedicSignature] = useState('');
    const [imageUrl, setImageUrl] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewVisible, setIsPreviewVisible] = useState(true);

    const patientSignaturePreviewRef = useRef(null);
    const datePreviewRef = useRef(null);
    const guardianSignaturePreviewRef = useRef(null);
    const paramedicSignaturePreviewRef = useRef(null);
    const amaCardPreviewRef = useRef(null);

    const webhookQueue = useRef([]);
    const isWebhookProcessing = useRef(false);
    const lastWebhookCallTimestamp = useRef(0);
    const webhookRateLimitDelay = 1100;

    useEffect(() => {
        if (show) {
            setPatientSignature(localStorage.getItem('emsAmaPatientSignature') || '');
            setDate(localStorage.getItem('emsAmaDate') || '');
            setGuardianSignature(localStorage.getItem('emsAmaGuardianSignature') || '');
            setParamedicSignature(localStorage.getItem('emsAmaParamedicSignature') || '');
            setImageUrl(null);
        }
    }, [show]);

    const handlePatientSignatureChange = (e) => setPatientSignature(e.target.value);
    const handleDateChange = (e) => setDate(e.target.value);
    const handleGuardianSignatureChange = (e) => setGuardianSignature(e.target.value);
    const handleParamedicSignatureChange = (e) => setParamedicSignature(e.target.value);

    const processWebhookQueue = useCallback(async () => {
        if (webhookQueue.current.length === 0 || isWebhookProcessing.current) {
            return;
        }
        isWebhookProcessing.current = true;
        const now = Date.now();
        const timeSinceLastCall = now - lastWebhookCallTimestamp.current;

        if (timeSinceLastCall < webhookRateLimitDelay) {
            const delay = webhookRateLimitDelay - timeSinceLastCall;
            setTimeout(() => {
                isWebhookProcessing.current = false;
                processWebhookQueue();
            }, delay);
            return;
        }

        const { webhookURL, message } = webhookQueue.current.shift();

        try {
            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });
            if (!response.ok) {
                const errorData = await response.text();
                console.error('Failed to send Discord webhook (AMA):', response.status, response.statusText, errorData);
                Sentry.captureMessage("Discord Webhook Send Failure (AMA)", {
                    extra: { status: response.status, statusText: response.statusText, responseBody: errorData },
                    level: "error"
                });
            } else {
                lastWebhookCallTimestamp.current = Date.now();
            }
        } catch (error) {
            console.error('Error sending Discord webhook (AMA):', error);
            Sentry.captureException(error, { extra: { context: 'Discord Webhook Send Function (AMA)' } });
        } finally {
            isWebhookProcessing.current = false;
            if (webhookQueue.current.length > 0) {
                setTimeout(processWebhookQueue, 0);
            }
        }
    }, []);

    const sendDiscordWebhook = useCallback(async (patientSig, formDate, guardianSig, paramedicSig, generatedImageUrl, errorMessage = null) => {
        const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
        if (!webhookURL) {
            console.warn('Discord webhook URL is not set for AMA.');
            Sentry.captureMessage("Discord Webhook URL not set (AMA)", { level: "warning" });
            return;
        }

        const embed = {
            title: "Alerte création de formulaire EMS AMA !",
            description: "Un nouveau formulaire EMS AMA a été généré.",
            color: errorMessage ? 0xFF0000 : 0x00FF00,
            fields: [
                { name: "Signature du patient", value: patientSig || "N/A", inline: true },
                { name: "Date", value: formDate || "N/A", inline: true },
                { name: "Signature du tuteur", value: guardianSig || "N/A", inline: true },
                { name: "Signature du paramédic", value: paramedicSig || "N/A", inline: true },
                errorMessage ? { name: "Erreur", value: ```${errorMessage.substring(0, 1000)}```, inline: false } : null
            ].filter(field => field !== null),
            footer: {
                text: `l'outil PHMC-FR Tools | gh-pages ${commitInfo?.sha?.substring(0, 7) || 'N/A'}`
            },
            timestamp: new Date().toISOString()
        };

        if (generatedImageUrl) {
            embed.image = { url: generatedImageUrl };
        } else if (!errorMessage) {
            embed.fields.push({ name: "Statut de l'image", value: "Image téléchargée, mais le lien est manquant.", inline: false });
        } else {
            embed.fields.push({ name: "Statut de l'image", value: "Échec du téléchargement de l'image.", inline: false });
        }

        const message = { embeds: [embed] };
        webhookQueue.current.push({ webhookURL, message });
        if (!isWebhookProcessing.current) {
            processWebhookQueue();
        }
    }, [commitInfo, processWebhookQueue]);

    const patientSignatureOverlayStyle = {
        position: 'absolute', top: '73%', left: '12%', color: 'black',
        fontSize: '20px', fontFamily: 'LufgaBold, Arial, sans-serif', whiteSpace: 'nowrap'
    };
    const dateOverlayStyle = {
        position: 'absolute', top: '83%', left: '12%', color: 'black',
        fontSize: '20px', fontFamily: 'LufgaBold, Arial, sans-serif', whiteSpace: 'nowrap'
    };
    const guardianSignatureOverlayStyle = {
        position: 'absolute', top: '73%', left: '60%', color: 'black',
        fontSize: '20px', fontFamily: 'LufgaBold, Arial, sans-serif', whiteSpace: 'nowrap'
    };
    const paramedicSignatureOverlayStyle = {
        position: 'absolute', top: '83%', left: '60%', color: 'black',
        fontSize: '20px', fontFamily: 'LufgaBold, Arial, sans-serif', whiteSpace: 'nowrap'
    };


    const handleSave = useCallback(async () => {
        setIsSaving(true);
        showNotification('Traitement du formulaire AMA...', 'upload');

        localStorage.setItem('emsAmaPatientSignature', patientSignature);
        localStorage.setItem('emsAmaDate', date);
        localStorage.setItem('emsAmaGuardianSignature', guardianSignature);
        localStorage.setItem('emsAmaParamedicSignature', paramedicSignature);

        const amaImageActualWidth = 1000;
        const amaImageActualHeight = 1414;

        const canvas = document.createElement('canvas');
        canvas.width = amaImageActualWidth;
        canvas.height = amaImageActualHeight;
        const ctx = canvas.getContext('2d');

        const loadImage = (src) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = (err) => {
                    console.error("Failed to load base AMA image for canvas:", err);
                    Sentry.captureException(err, { extra: { context: 'AMA loadImage', imgSrc: src } });
                    reject(new Error("Impossible de charger l'image AMA de base."));
                };
                img.src = src;
            });
        };
        
        try {
            const baseImage = await loadImage(EMSAMAImage);
            
            if (document.fonts && typeof document.fonts.ready === 'function') {
                await document.fonts.ready;
                console.log("Fonts ready for AMA canvas.");
            } else {
                console.warn("document.fonts.ready not available. Text rendering might be inconsistent.");
            }

            ctx.drawImage(baseImage, 0, 0, amaImageActualWidth, amaImageActualHeight);
            ctx.textBaseline = 'top';

            const patientSigX = amaImageActualWidth * (parseFloat(patientSignatureOverlayStyle.left) / 100);
            const patientSigY = amaImageActualHeight * (parseFloat(patientSignatureOverlayStyle.top) / 100);
            const patientSigFontSize = parseInt(patientSignatureOverlayStyle.fontSize);
            ctx.fillStyle = patientSignatureOverlayStyle.color;
            ctx.font = `${patientSigFontSize}px ${patientSignatureOverlayStyle.fontFamily}`
            ctx.fillText(patientSignature, patientSigX, patientSigY);

            const dateX = amaImageActualWidth * (parseFloat(dateOverlayStyle.left) / 100);
            const dateY = amaImageActualHeight * (parseFloat(dateOverlayStyle.top) / 100);
            const dateFontSize = parseInt(dateOverlayStyle.fontSize);
            ctx.fillStyle = dateOverlayStyle.color;
            ctx.font = `${dateFontSize}px ${dateOverlayStyle.fontFamily}`
            ctx.fillText(date, dateX, dateY);

            const guardianSigX = amaImageActualWidth * (parseFloat(guardianSignatureOverlayStyle.left) / 100);
            const guardianSigY = amaImageActualHeight * (parseFloat(guardianSignatureOverlayStyle.top) / 100);
            const guardianSigFontSize = parseInt(guardianSignatureOverlayStyle.fontSize);
            ctx.fillStyle = guardianSignatureOverlayStyle.color;
            ctx.font = `${guardianSigFontSize}px ${guardianSignatureOverlayStyle.fontFamily}`
            ctx.fillText(guardianSignature, guardianSigX, guardianSigY);

            const paramedicSigX = amaImageActualWidth * (parseFloat(paramedicSignatureOverlayStyle.left) / 100);
            const paramedicSigY = amaImageActualHeight * (parseFloat(paramedicSignatureOverlayStyle.top) / 100);
            const paramedicSigFontSize = parseInt(paramedicSignatureOverlayStyle.fontSize);
            ctx.fillStyle = paramedicSignatureOverlayStyle.color;
            ctx.font = `${paramedicSigFontSize}px ${paramedicSignatureOverlayStyle.fontFamily}`
            ctx.fillText(paramedicSignature, paramedicSigX, paramedicSigY);

            const dataUrl = canvas.toDataURL('image/png');

            showNotification('Téléchargement en cours...', 'upload');
            const link = await handleImageUpload(dataUrl);
            setImageUrl(link);
            showNotification(`Formulaire AMA enregistré et téléchargé : ${link}`, 'save');
            sendDiscordWebhook(patientSignature, date, guardianSignature, paramedicSignature, link);

            await copyToClipboard(link, showNotification, 'Lien de l\'image copié dans le presse-papiers !');
        } catch (error) {
            console.error('Error in AMA handleSave:', error);
            let errorContext = 'Erreur lors de la génération du formulaire AMA';
            let detailedMessage = error.message || String(error);

            if (detailedMessage.includes('upload failed')) errorContext = 'Échec du téléchargement';
            else if (detailedMessage.includes('Failed to load base AMA image')) errorContext = 'Échec du chargement de l\'image AMA de base';
            else errorContext = 'Échec de la génération de l\'image';
            
            showNotification(`${errorContext}: ${detailedMessage.substring(0,100)}...`, 'error');
            Sentry.captureException(error, { extra: { context: 'EMS AMA Save', patientSignature, date, detailedMessage } });
            sendDiscordWebhook(patientSignature, date, guardianSignature, paramedicSignature, null, `${errorContext}: ${detailedMessage}`);
        } finally {
            setIsSaving(false);
        }
    }, [
        patientSignature, date, guardianSignature, paramedicSignature,
        showNotification, handleImageUpload, sendDiscordWebhook, commitInfo,
        patientSignatureOverlayStyle, dateOverlayStyle, guardianSignatureOverlayStyle, paramedicSignatureOverlayStyle
    ]);


    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="agency-selector-modal ems-ama-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h4>EMS - Contre Avis Médical (AMA)</h4>
                    <Button
                        variant="secondary"
                        className="close"
                        onClick={onHide}
                        aria-label="Fermer la fenêtre modale EMS AMA"
                    >
                        <i className="fas fa-times"></i>
                    </Button>
                </div>
                <div className="ems-ama-modal-body">
                    {imageUrl && (
                        <div className="imgur-link-container">
                            <p>
                                <strong>Lien de l'image : </strong>
                                <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                                    {imageUrl}
                                </a>
                            </p>
                            Instructions !
                            <br />
                            1) /note [identifiant de l'élément de note vierge dans votre inventaire] [quantité] [nom pour les cartes]
                            <br />
                            2) /note [identifiant du nouvel élément de note dans votre inventaire] [quantité] [contenu] [URL depuis ImgBB]
                        </div>
                    )}

                    <Button
                        variant="outline-info"
                        onClick={() => setIsPreviewVisible(!isPreviewVisible)}
                        className="mb-3 w-100"
                    >
                        {isPreviewVisible ? 'Masquer l\'aperçu du formulaire' : 'Afficher l\'aperçu du formulaire'}
                    </Button>

                    {isPreviewVisible && (
                        <div 
                            className="business-card-image-container" // Re-use class if styles are similar
                            ref={amaCardPreviewRef} 
                            style={{
                                position: 'relative', 
                                width: '100%', 
                                maxWidth: '800px', // Adjust as needed for AMA form aspect ratio
                                margin: '0 auto 1rem auto' 
                            }}
                        >
                            <img
                                src={EMSAMAImage}
                                alt="Aperçu du formulaire EMS AMA"
                                style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid #ccc' }}
                            />
                            <div
                                ref={patientSignaturePreviewRef}
                                style={patientSignatureOverlayStyle} // Use defined style object
                            >
                                {patientSignature}
                            </div>
                            <div
                                ref={datePreviewRef}
                                style={dateOverlayStyle} // Use defined style object
                            >
                                {date}
                            </div>
                            <div
                                ref={guardianSignaturePreviewRef}
                                style={guardianSignatureOverlayStyle} // Use defined style object
                            >
                                {guardianSignature}
                            </div>
                            <div
                                ref={paramedicSignaturePreviewRef}
                                style={paramedicSignatureOverlayStyle} // Use defined style object
                            >
                                {paramedicSignature}
                            </div>
                        </div>
                    )}

                    <div className="business-card-input-fields"> {/* Re-use class if styles are similar */}
                        <Form.Group className="mb-2 ems-ama-input-group">
                            <Form.Label>Signature du patient (nom)</Form.Label>
                            <Form.Control size="sm" type="text" placeholder="Entrer le nom complet du patient" value={patientSignature} onChange={handlePatientSignatureChange} />
                        </Form.Group>
                        <Form.Group className="mb-2 ems-ama-input-group">
                            <Form.Label>Date</Form.Label>
                            <Form.Control size="sm" type="text" placeholder="JJ/MM/AAAA / XX:XX" value={date} onChange={handleDateChange} />
                        </Form.Group>
                        <Form.Group className="mb-2 ems-ama-input-group">
                            <Form.Label>Signature du tuteur (nom, si applicable)</Form.Label>
                            <Form.Control size="sm" type="text" placeholder="Entrer le nom complet du tuteur" value={guardianSignature} onChange={handleGuardianSignatureChange} />
                        </Form.Group>
                        <Form.Group className="mb-2 ems-ama-input-group">
                            <Form.Label>Signature du paramédic (nom)</Form.Label>
                            <Form.Control size="sm" type="text" placeholder="Entrer votre nom complet" value={paramedicSignature} onChange={handleParamedicSignatureChange} />
                        </Form.Group>
                    </div>
                </div>
                <Button className="ems-ama-save-button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Enregistrement...' : 'Enregistrer et téléverser le formulaire AMA'}
                </Button>
            </div>
        </div>
    );
};

export default EmsAmaModal;
