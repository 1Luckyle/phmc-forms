import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import * as Sentry from "@sentry/react";
import BusinessCardImage from '../assets/business-card.png';
import { copyToClipboard } from '../components/notificationService';
import DebugFillButton from './DebugFillButton';
import SignatureCreator from './SignatureCreator';
import { MyCreationPanel } from './MyCreationPanel';
import { CREATION_KINDS, loadUserCreations, saveUserCreation, removeUserCreation } from '../utils/userCreations';
import { logActivity } from '../utils/activityLog';
import './MyCreations.css';

const BusinessCardModal = ({ show, onHide, showNotification, commitInfo, handleImageUpload, uploadImageDetailed, uid, defaultName }) => {
    const [name, setName] = useState('');
    const [rank, setRank] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [imageUrl, setImageUrl] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    // Chaque personne a UNE carte et UNE signature (userCreations/{uid}).
    const [tab, setTab] = useState('card');
    const [creations, setCreations] = useState({ businessCard: null, signature: null });
    const [editingCard, setEditingCard] = useState(false);

    const nameRef = useRef(null);
    const rankRef = useRef(null);
    const departmentRef = useRef(null);

    const webhookQueue = useRef([]);
    const isWebhookProcessing = useRef(false);
    const lastWebhookCallTimestamp = useRef(0);
    const webhookRateLimitDelay = 1100;

    useEffect(() => {
        if (show) {
            setName(localStorage.getItem('name') || '');
            setRank(localStorage.getItem('rank') || '');
            setPhoneNumber(localStorage.getItem('phoneNumber') || '');
            setEmail(localStorage.getItem('businessCardEmail') || '');
            setImageUrl(null);
            setEditingCard(false);
            if (uid) {
                loadUserCreations(uid)
                    .then(setCreations)
                    .catch((error) => console.error('Chargement de mes créations impossible :', error));
            }
        }
    }, [show, uid]);

    const handleNameChange = (e) => setName(e.target.value);
    const handleRankChange = (e) => setRank(e.target.value);
    const handlePhoneNumberChange = (e) => setPhoneNumber(e.target.value);
    const handleEmailChange = (e) => setEmail(e.target.value);
    // Ligne imprimée sur la carte : « 40152169 - email@blabla.fr » (l'e-mail est facultatif).
    const contactLine = [phoneNumber.trim(), email.trim()].filter(Boolean).join(' - ');
    // Mode debug : données de test.
    const handleDebugFill = () => {
        setName('Jean Testard');
        setRank('Médecin Résident');
        setPhoneNumber('555-0142');
        setEmail('jean.testard@mail.eyefind.fr');
    };

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
                console.error('Failed to send Discord webhook (Business Card):', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData,
                    payload: message
                });
                Sentry.captureMessage("Discord Webhook Send Failure (Business Card)", {
                    extra: {
                        status: response.status,
                        statusText: response.statusText,
                        responseBody: errorData,
                        webhookPayload: JSON.stringify(message),
                        embedCount: message.embeds?.length,
                        firstEmbed: message.embeds?.[0]
                    },
                    level: "error"
                });
            } else {
                console.log('Discord webhook sent successfully');
                lastWebhookCallTimestamp.current = Date.now();
            }
        } catch (error) {
            console.error('Error sending Discord webhook (Business Card):', error);
            Sentry.captureException(error, { extra: { context: 'Discord Webhook Send Function (Business Card)' } });
        } finally {
            isWebhookProcessing.current = false;
            if (webhookQueue.current.length > 0) {
                setTimeout(processWebhookQueue, 0);
            }
        }
    }, []);

    const sendDiscordWebhook = useCallback(async (cardName, cardRank, cardPhoneNumber, generatedImageUrl, errorMessage = null, cardEmail = '') => {
        // Journal d'activité (sans téléphone ni e-mail) ; l'envoi Discord ci-dessous est facultatif.
        logActivity({
            category: 'rapports',
            action: errorMessage ? 'business_card_failed' : 'business_card_created',
            summary: errorMessage ? `Échec de la création d'une carte de visite : ${cardName || 'sans nom'}` : `Carte de visite créée : ${cardName || 'sans nom'}`,
            details: errorMessage ? String(errorMessage).slice(0, 1000) : (cardRank ? `Grade : ${cardRank}` : undefined),
            severity: errorMessage ? 'error' : 'success',
            target: cardName || undefined,
        });
        const webhookURL = null;
        if (!webhookURL) {
            return;
        }

        const embed = {
            title: "Alerte création de cartes de visite !",
            description: "Une nouvelle carte de visite a été générée.",
            color: errorMessage ? 0xFF0000 : 0x00FF00, // Red for error, Green for success
            fields: [
                { name: "Nom de l'employé", value: cardName || "N/A", inline: true },
                { name: "Grade de l'employé", value: cardRank || "N/A", inline: true },
                { name: "Numéro de téléphone", value: cardPhoneNumber || "N/A", inline: true },
                { name: "E-mail", value: cardEmail || "N/A", inline: true }
            ],
            footer: {
                text: `l'outil PHMC-FR Tools | gh-pages ${commitInfo?.sha?.substring(0, 7) || 'N/A'}`
            },
            timestamp: new Date().toISOString()
        };

        // Add error message if present
        if (errorMessage) {
            embed.fields.push({
                name: "Error",
                value: errorMessage.substring(0, 1000),
                inline: false
            });
        }

        // Handle image URL
        const imageUrlString = typeof generatedImageUrl === 'string' ? generatedImageUrl : String(generatedImageUrl || '');
        
        if (imageUrlString && (imageUrlString.startsWith('http://') || imageUrlString.startsWith('https://'))) {
            embed.image = { url: imageUrlString };
            embed.fields.push({
                name: "Statut de l'image",
                value: "Téléchargée et attachée avec succès.",
                inline: false
            });
        } else if (!errorMessage) {
            console.log('Invalid image URL:', { generatedImageUrl, type: typeof generatedImageUrl });
            embed.fields.push({
                name: "Statut de l'image",
                value: `Image téléchargée, mais le lien est invalide ou manquant. Reçu : ${imageUrlString.substring(0, 100)}`,
                inline: false
            });
        } else {
            embed.fields.push({
                name: "Statut de l'image",
                value: "Échec du téléchargement de l'image.",
                inline: false
            });
        }
        
        const message = { embeds: [embed] };
        webhookQueue.current.push({ webhookURL, message });
        if (!isWebhookProcessing.current) {
            processWebhookQueue();
        }
    }, [commitInfo, processWebhookQueue]);

    const nameOverlayStyle = {
        position: 'absolute', top: '23.44%', left: '2.75%', color: 'black',
        fontSize: '35px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap',
        fontFamily: 'LufgaMedium, Arial, sans-serif'
    };

    const rankOverlayStyle = {
        position: 'absolute', top: '31.92%', left: '3.31%', color: '#cb1212',
        fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap',
        fontFamily: 'LufgaMedium, Arial, sans-serif'
    };

    const phoneNumberOverlayStyle = {
        position: 'absolute', top: '53.03%', left: '12.06%', color: 'black',
        fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap',
        fontFamily: 'LufgaMedium, Arial, sans-serif'
    };


    const handleSave = useCallback(async () => {
        if (creations.businessCard && !window.confirm('Vous avez déjà une carte de visite. La nouvelle va REMPLACER l\'ancienne (qui ne sera plus associée à votre compte). Continuer ?')) {
            return;
        }
        setIsSaving(true);
        showNotification('Traitement de la carte de visite...', 'upload');

        localStorage.setItem('name', name);
        localStorage.setItem('rank', rank);
        localStorage.setItem('phoneNumber', phoneNumber);
        localStorage.setItem('businessCardEmail', email);

        const cardImageActualWidth = 750;
        const cardImageActualHeight = 440;



        const canvas = document.createElement('canvas');
        canvas.width = cardImageActualWidth;
        canvas.height = cardImageActualHeight;
        const ctx = canvas.getContext('2d');

        const loadImage = (src) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = (err) => {
                    console.error("Failed to load base image for canvas:", err);
                    reject(new Error("Échec du chargement de l'image de base."));
                };
                img.src = src;
            });
        };

        try {
            const baseImage = await loadImage(BusinessCardImage);
            if (document.fonts && typeof document.fonts.ready === 'function') {
                await document.fonts.ready;
            }

            ctx.drawImage(baseImage, 0, 0, cardImageActualWidth, cardImageActualHeight);
            ctx.textBaseline = 'top';

            const nameX = cardImageActualWidth * (parseFloat(nameOverlayStyle.left) / 100);
            const nameY = cardImageActualHeight * (parseFloat(nameOverlayStyle.top) / 100);
            const nameFontSize = parseInt(nameOverlayStyle.fontSize);
            ctx.fillStyle = nameOverlayStyle.color;
            ctx.font = `${nameFontSize}px ${nameOverlayStyle.fontFamily || 'sans-serif'}`;
            ctx.fillText(name, nameX, nameY);

            const rankX = cardImageActualWidth * (parseFloat(rankOverlayStyle.left) / 100);
            const rankY = cardImageActualHeight * (parseFloat(rankOverlayStyle.top) / 100);
            const rankFontSize = parseInt(rankOverlayStyle.fontSize);
            ctx.fillStyle = rankOverlayStyle.color;
            ctx.font = `${rankFontSize}px ${rankOverlayStyle.fontFamily || 'sans-serif'}`;
            ctx.fillText(rank, rankX, rankY);

            const phoneX = cardImageActualWidth * (parseFloat(phoneNumberOverlayStyle.left) / 100);
            const phoneY = cardImageActualHeight * (parseFloat(phoneNumberOverlayStyle.top) / 100);
            const phoneFontSize = parseInt(phoneNumberOverlayStyle.fontSize);
            ctx.fillStyle = phoneNumberOverlayStyle.color;
            ctx.font = `${phoneFontSize}px ${phoneNumberOverlayStyle.fontFamily || 'sans-serif'}`;
            ctx.fillText(contactLine, phoneX, phoneY);

            const dataUrl = canvas.toDataURL('image/png');
            
            showNotification('Uploading...', 'upload');
            if (!uploadImageDetailed) {
                throw new Error('upload failed: fonction de téléchargement indisponible.');
            }
            const uploaded = await uploadImageDetailed(dataUrl);
            const link = uploaded.url;
            console.log('Image upload result:', { link, type: typeof link });

            setImageUrl(link);
            if (uid) {
                const { saved } = await saveUserCreation(uid, CREATION_KINDS.card, {
                    url: link, deleteUrl: uploaded.deleteUrl, name, rank, phone: phoneNumber, email,
                });
                setCreations((current) => ({ ...current, businessCard: saved }));
                setEditingCard(false);
            }
            showNotification(`Carte de visite enregistrée et téléchargée : ${link}`, 'save');
            
            sendDiscordWebhook(name, rank, phoneNumber, link, null, email);

            await copyToClipboard(link, showNotification, 'Lien de l\'image copié dans le presse-papiers !');
        } catch (error) {
            console.error('Error in Business Card handleSave:', error);
            let errorContext = 'Erreur lors de la génération de la carte de visite';
            let detailedMessage = error.message || String(error);

            if (detailedMessage.includes('upload failed')) errorContext = 'Échec du téléchargement';
            else if (detailedMessage.includes('Failed to load base image')) errorContext = 'Échec du chargement de l\'image de base';
            else errorContext = 'Échec de la génération de l\'image';
            
            showNotification(`${errorContext}: ${detailedMessage.substring(0, 200)}`, 'error');
            Sentry.captureException(error, { extra: { context: 'Business Card Save', name, rank, detailedMessage } });
            
            sendDiscordWebhook(name, rank, phoneNumber, null, `${errorContext}: ${detailedMessage}`, email);
        } finally {
            setIsSaving(false);
        }
    }, [name, rank, phoneNumber, email, contactLine, showNotification, uploadImageDetailed, uid, creations.businessCard, sendDiscordWebhook, commitInfo, nameOverlayStyle, rankOverlayStyle, phoneNumberOverlayStyle]);


    if (!show) {
        return null;
    }

    const showCardPanel = !!creations.businessCard && !editingCard;
    const shownLink = imageUrl || (showCardPanel ? creations.businessCard.url : null);

    const handleDeleteCard = async () => {
        if (!window.confirm('Supprimer votre carte de visite ? Elle ne sera plus associée à votre compte.')) return;
        try {
            await removeUserCreation(uid, CREATION_KINDS.card);
            setCreations((current) => ({ ...current, businessCard: null }));
            setEditingCard(false);
            setImageUrl(null);
            showNotification('Carte de visite supprimée (l\'image sera retirée d\'ImgBB par un administrateur).', 'save');
        } catch (error) {
            showNotification(`Suppression impossible : ${(error.message || '').substring(0, 100)}`, 'error');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="agency-selector-modal business-card-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h4>Carte de visite &amp; signature</h4>
                    <Button
                        variant="secondary"
                        className="close"
                        onClick={onHide}
                        aria-label="Close business card modal"
                    >
                        <i className="fas fa-times"></i>
                    </Button>
                </div>
                <p style={{ color: '#8b949e', fontSize: '0.85em', margin: '0 0 10px' }}>
                    Créez ici votre <strong>carte de visite</strong> et votre <strong>signature</strong> (onglet « Signature », utilisée dans les emails et les contrats).
                </p>
                <div className="creation-tabs">
                    <button type="button" className={tab === 'card' ? 'active' : ''} onClick={() => setTab('card')}>
                        <i className="fas fa-id-card"></i> Carte de visite
                    </button>
                    <button type="button" className={tab === 'signature' ? 'active' : ''} onClick={() => setTab('signature')}>
                        <i className="fas fa-signature"></i> Signature
                    </button>
                </div>

                {tab === 'signature' ? (
                    <SignatureCreator
                        uid={uid}
                        defaultName={defaultName || name}
                        creation={creations.signature}
                        onCreationChange={(signature) => setCreations((current) => ({ ...current, signature }))}
                        uploadImageDetailed={uploadImageDetailed}
                        showNotification={showNotification}
                    />
                ) : (
                    <>
                        <div className="business-card-content">
                            {showCardPanel && (
                                <MyCreationPanel
                                    title="Votre carte de visite"
                                    creation={creations.businessCard}
                                    onCopy={() => copyToClipboard(creations.businessCard.url, showNotification, 'Lien de l\'image copié dans le presse-papiers !')}
                                    onChange={() => setEditingCard(true)}
                                    onDelete={handleDeleteCard}
                                />
                            )}
                            {shownLink && (
                                <div className="image-link-container">
                                    {!showCardPanel && (
                                        <p>
                                            <strong>Lien de l'image : </strong>
                                            <a href={shownLink} target="_blank" rel="noopener noreferrer">
                                                {shownLink}
                                            </a>
                                        </p>
                                    )}
                                    Instructions !
                                    <br />
                                    1) /note [identifiant de l'élément de note vierge dans votre inventaire] [quantité] [nom pour les cartes]
                                    <br />
                                    2) /note [identifiant du nouvel élément de note dans votre inventaire] [quantité] [contenu] [URL depuis ImgBB]
                                </div>
                            )}
                            {!showCardPanel && (
                                <>
                                    {creations.businessCard && (
                                        <p style={{ color: '#ffc107', fontSize: '0.9em' }}>
                                            <i className="fas fa-exclamation-triangle"></i> Enregistrer une nouvelle carte remplacera l'actuelle.
                                        </p>
                                    )}
                    <div 
                        className="business-card-image-container" 
                        style={{
                            position: 'relative', 
                            width: '100%', 
                            maxWidth: '800px',
                            margin: '0 auto 1rem auto'
                        }}
                    >
                        <img
                            src={BusinessCardImage}
                            alt="Business Card Preview"
                            style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid #ccc' }}
                        />
                        <div
                            className="name-overlay"
                            ref={nameRef}
                            style={nameOverlayStyle}
                        >
                            {name}
                        </div>
                        <div
                            className="rank-overlay"
                            ref={rankRef}
                            style={rankOverlayStyle}
                        >
                            {rank}
                        </div>
                        <div
                            className="phone-number-overlay"
                            ref={departmentRef}
                            style={phoneNumberOverlayStyle}
                        >
                            {contactLine}
                        </div>
                    </div>
                    <div className="business-card-input-fields" style={{ marginTop: '1rem' }}>
                        <Form.Control className="mb-2" type="text" placeholder="Nom" value={name} onChange={handleNameChange} />
                        <Form.Control className="mb-2" type="text" placeholder="Grade" value={rank} onChange={handleRankChange} />
                        <Form.Control className="mb-2" type="text" placeholder="Numéro de téléphone" value={phoneNumber} onChange={handlePhoneNumberChange} />
                        <Form.Control className="mb-2" type="email" placeholder="Adresse e-mail (imprimée après le numéro)" value={email} onChange={handleEmailChange} />
                    </div>
                                </>
                            )}
                        </div>
                        {!showCardPanel && (
                            <>
                                <DebugFillButton onFill={handleDebugFill} disabled={isSaving} className="mt-3 w-100" />
                                <Button className="mt-3 w-100" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? 'Enregistrement...' : (creations.businessCard ? 'Remplacer ma carte de visite' : 'Enregistrer et télécharger la carte de visite')}
                                </Button>
                                {creations.businessCard && (
                                    <Button className="mt-2 w-100" variant="outline-secondary" onClick={() => setEditingCard(false)} disabled={isSaving}>
                                        Annuler
                                    </Button>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default BusinessCardModal;
