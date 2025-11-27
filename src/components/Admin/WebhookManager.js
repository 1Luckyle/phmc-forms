import React, { useState } from 'react';
import { useWebhook } from '../../contexts/WebhookProvider';
import '../WebhookModal.css'; // Reusing the CSS for now

const WebhookManager = () => {
    const {
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
    } = useWebhook();

    const [urlInput, setUrlInput] = useState('');

    const handleAddUrl = () => {
        addMediaUrl(urlInput);
        setUrlInput('');
    };

    const isImageUrl = (url) => {
        return /\.(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co');
    };

    const isStreamableUrl = (url) => {
        return url.includes('streamable.com');
    };

    const titlePlaceholder = "Mise à jour majeure / Mise à jour mineure / Correctif";
    const messagePlaceholder = "- Ajouté : \n- Corrigé : \n- Mis à jour : ";

    return (
        <div className="webhook-manager-container">
            <div className="webhook-form">
                <div className="webhook-form-group">
                    <label className="webhook-form-label" htmlFor="webhookEmbedTitle">Intégrer le titre</label>
                    <input
                        type="text"
                        id="webhookEmbedTitle"
                        className="webhook-form-control"
                        placeholder={titlePlaceholder}
                        value={webhookTitle}
                        onChange={(e) => setWebhookTitle(e.target.value)}
                        autoComplete="off"
                    />
                </div>
                <div className="webhook-form-group">
                    <label className="webhook-form-label" htmlFor="webhookMessageTextarea">Corps de l'intégration</label>
                    <textarea
                        id="webhookMessageTextarea"
                        className="webhook-form-control"
                        rows={4}
                        placeholder={messagePlaceholder}
                        value={webhookMessage}
                        onChange={(e) => setWebhookMessage(e.target.value)}
                        autoComplete="off"
                    />
                    <span className="webhook-form-text">
                        Prend en charge le Markdown de base. Les liens médias seront ajoutés automatiquement si seuls des médias sont fournis.
                    </span>
                </div>
                <div className="webhook-form-group">
                    <label className="webhook-form-label" htmlFor="webhookUrlInput">Ajouter une URL média (Image ou Streamable)</label>
                    <div className="webhook-input-group">
                        <input
                            type="url"
                            id="webhookUrlInput"
                            className="webhook-form-control"
                            placeholder="Collez l'URL de l'image ou de Streamable..."
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); }
                            }}
                            autoComplete="off"
                        />
                        <button type="button" className="webhook-button webhook-button-secondary" onClick={handleAddUrl}>
                            <i className="fas fa-plus"></i> Ajouter URL
                        </button>
                    </div>
                </div>
                <div className="webhook-form-group">
                    <label className="webhook-form-label">Télécharger l(es) image(s)</label>
                    <div className="webhook-input-group">
                        <button
                            type="button"
                            className={`webhook-button webhook-button-primary ${isUploading ? 'disabled' : ''}`}
                            disabled={isUploading}
                            onClick={() => document.getElementById('webhook-image-input-manager').click()}
                        >
                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                            {isUploading ? ' Téléchargement...' : ' Télécharger l(es) image(s)'}
                        </button>
                        <input
                            id="webhook-image-input-manager"
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleLocalImageUpload}
                        />
                    </div>
                    <span className="webhook-form-text">
                        Téléchargez une ou plusieurs images. Hébergé par ImgBB.
                    </span>
                </div>
                {mediaUrls.length > 0 && (
                    <div className="webhook-form-group">
                        <label className="webhook-form-label">Médias ajoutés ({mediaUrls.length})</label>
                        <div className="webhook-media-preview">
                            {mediaUrls.map((url, index) => (
                                <div key={index} className="webhook-media-item">
                                    {isImageUrl(url) ? (
                                        <img
                                            src={url}
                                            alt={`Preview ${index + 1}`}
                                            className="webhook-media-image"
                                            title={url}
                                            onClick={() => window.open(url, '_blank')}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    ) : isStreamableUrl(url) ? (
                                        <div
                                            className="webhook-media-link"
                                            title={url}
                                            onClick={() => window.open(url, '_blank')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <i className="fas fa-video webhook-media-icon"></i>
                                            <span>Lien Streamable</span>
                                        </div>
                                    ) : (
                                        <div
                                            className="webhook-media-link"
                                            title={url}
                                            onClick={() => window.open(url, '_blank')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <i className="fas fa-link webhook-media-icon"></i>
                                            <span>Lien externe</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="webhook-button webhook-button-secondary"
                            onClick={clearMedia}
                            title="Effacer tous les médias"
                        >
                            Effacer tous les médias ({mediaUrls.length})
                        </button>
                    </div>
                )}
            </div>
            <div className="webhook-footer">
                <div className="webhook-spacer"></div>
                <button
                    type="button"
                    className="webhook-button webhook-button-warning"
                    onClick={() => sendWebhook('primary')}
                    title={`Uses: ${process.env.REACT_APP_DEV_WEBHOOK}`}
                >
                    <i className="fas fa-vial"></i> Envoyer au webhook de développement
                </button>
                <button
                    type="button"
                    className="webhook-button webhook-button-primary"
                    onClick={() => sendWebhook('secondary')}
                    title={`Uses: ${process.env.REACT_APP_PHMC_DISCORD}`}
                >
                    <i className="fas fa-paper-plane"></i> Envoyer au webhook PHMC
                </button>
            </div>
        </div>
    );
};

export default WebhookManager;
