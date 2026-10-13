import React from 'react';
import { Button } from 'react-bootstrap';
import './MyCreations.css';

// Affiche la création enregistrée de l'utilisateur (carte de visite ou signature) avec ses actions :
// copier le lien, modifier (retour au bouton de création) et supprimer.
export const MyCreationPanel = ({ title, creation, transparent, busy, onCopy, onChange, onDelete }) => {
    if (!creation) return null;
    const date = creation.createdAt ? new Date(creation.createdAt).toLocaleString('fr-FR') : '';
    return (
        <div className="my-creation-panel">
            <div className="my-creation-title">{title}</div>
            <div className={`my-creation-preview${transparent ? ' transparent-bg' : ''}`}>
                <img src={creation.url} alt={title} />
            </div>
            <div className="my-creation-link">
                <a href={creation.url} target="_blank" rel="noopener noreferrer">{creation.url}</a>
                {date && <small>Créée le {date}</small>}
            </div>
            <div className="my-creation-actions">
                <Button variant="outline-light" size="sm" onClick={onCopy} disabled={busy}>
                    <i className="fas fa-copy"></i> Copier le lien
                </Button>
                <Button variant="outline-primary" size="sm" onClick={onChange} disabled={busy}>
                    <i className="fas fa-pen"></i> Modifier
                </Button>
                <Button variant="outline-danger" size="sm" onClick={onDelete} disabled={busy}>
                    <i className="fas fa-trash"></i> Supprimer
                </Button>
            </div>
        </div>
    );
};

// ImgBB n'a pas d'API de suppression : après avoir retiré l'image côté application, on propose
// d'ouvrir la page de suppression d'ImgBB (lien direct, jamais bloqué comme une fenêtre auto-ouverte).
export const ImgbbDeleteNotice = ({ deleteUrl, onDismiss }) => {
    if (!deleteUrl) return null;
    return (
        <div className="imgbb-delete-notice">
            <span>
                L'ancienne image n'est plus associée à votre compte. Pour la supprimer aussi d'ImgBB, ouvrez la page de
                suppression puis confirmez.
            </span>
            <div>
                <a className="btn btn-sm btn-outline-warning" href={deleteUrl} target="_blank" rel="noopener noreferrer" onClick={onDismiss}>
                    <i className="fas fa-external-link-alt"></i> Page de suppression ImgBB
                </a>
                <Button size="sm" variant="link" onClick={onDismiss}>Ignorer</Button>
            </div>
        </div>
    );
};
