import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import * as Sentry from '@sentry/react';
import { MyCreationPanel } from './MyCreationPanel';
import { SIGNATURE_STYLES, buildSignatureText, renderSignatureDataUrl } from '../utils/signatureRenderer';
import { CREATION_KINDS, saveUserCreation, removeUserCreation } from '../utils/userCreations';
import { copyToClipboard } from './notificationService';
import './MyCreations.css';

// Polices manuscrites embarquées (utilisées par le canvas de signatureRenderer).
import './SignatureFonts.css';

// Onglet « Signature » : une seule signature par personne, au format « Dr. Prénom Nom ».
// `patientID` + `civilian` : compte Civil — nom sans « Dr. », et la signature est aussi enregistrée à l'ID patient (formulaires AMA).
const SignatureCreator = ({ uid, defaultName, creation, onCreationChange, uploadImageDetailed, showNotification, patientID = '', civilian = false }) => {
    const [name, setName] = useState(defaultName || '');
    const [styleKey, setStyleKey] = useState(SIGNATURE_STYLES[0].key);
    const [previews, setPreviews] = useState({});
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => { setName(defaultName || ''); }, [defaultName]);

    const text = buildSignatureText(name, { doctor: !civilian });
    const showForm = !creation || editing;

    // Aperçu de chaque style (recalculé quand le texte change).
    useEffect(() => {
        if (!showForm || !text) { setPreviews({}); return undefined; }
        let cancelled = false;
        (async () => {
            const next = {};
            for (const style of SIGNATURE_STYLES) {
                next[style.key] = await renderSignatureDataUrl(text, style.key);
            }
            if (!cancelled) setPreviews(next);
        })();
        return () => { cancelled = true; };
    }, [text, showForm]);

    const handleCreate = async () => {
        if (!uid) { showNotification('Connectez-vous pour créer votre signature.', 'warning'); return; }
        if (!text) { showNotification('Saisissez votre nom pour créer la signature.', 'warning'); return; }
        if (creation && !window.confirm('Vous avez déjà une signature. La nouvelle va REMPLACER l\'ancienne (qui ne sera plus associée à votre compte). Continuer ?')) return;

        setBusy(true);
        try {
            showNotification('Création de la signature...', 'upload');
            const dataUrl = await renderSignatureDataUrl(text, styleKey);
            const uploaded = await uploadImageDetailed(dataUrl);
            const { saved } = await saveUserCreation(uid, CREATION_KINDS.signature, {
                url: uploaded.url, deleteUrl: uploaded.deleteUrl, text, style: styleKey,
            }, { patientID: civilian ? patientID : '', actorName: name });
            onCreationChange(saved);
            setEditing(false);
            showNotification('Signature enregistrée.', 'save');
            await copyToClipboard(uploaded.url, showNotification, 'Lien de la signature copié dans le presse-papiers !');
        } catch (error) {
            console.error('Signature creation failed:', error);
            Sentry.captureException(error, { extra: { context: 'Signature creation' } });
            showNotification(`Échec de la création de la signature : ${(error.message || '').substring(0, 100)}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Supprimer votre signature ? Elle ne sera plus associée à votre compte.')) return;
        setBusy(true);
        try {
            await removeUserCreation(uid, CREATION_KINDS.signature, { patientID: civilian ? patientID : '' });
            onCreationChange(null);
            setEditing(false);
            showNotification('Signature supprimée (l\'image sera retirée d\'ImgBB par un administrateur).', 'save');
        } catch (error) {
            showNotification(`Suppression impossible : ${(error.message || '').substring(0, 100)}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="signature-creator">
            {creation && !editing && (
                <MyCreationPanel
                    title="Votre signature"
                    creation={creation}
                    transparent
                    busy={busy}
                    onCopy={() => copyToClipboard(creation.url, showNotification, 'Lien de la signature copié dans le presse-papiers !')}
                    onChange={() => setEditing(true)}
                    onDelete={handleDelete}
                />
            )}

            {showForm && (
                <>
                    {creation && (
                        <p style={{ color: '#ffc107', fontSize: '0.9em' }}>
                            <i className="fas fa-exclamation-triangle"></i> Créer une nouvelle signature remplacera l'actuelle.
                        </p>
                    )}
                    <Form.Label>{civilian ? 'Votre nom' : 'Nom du médecin'}</Form.Label>
                    <Form.Control
                        className="mb-2"
                        type="text"
                        placeholder="Prénom Nom"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <div className="signature-style-list">
                        {SIGNATURE_STYLES.map((style) => (
                            <button
                                type="button"
                                key={style.key}
                                className={`signature-style-option${styleKey === style.key ? ' selected' : ''}`}
                                onClick={() => setStyleKey(style.key)}
                            >
                                <strong style={{ minWidth: 70 }}>{style.label}</strong>
                                {previews[style.key] ? <img src={previews[style.key]} alt={`Aperçu ${style.label}`} /> : <em>Saisissez un nom…</em>}
                            </button>
                        ))}
                    </div>
                    <Button className="w-100" onClick={handleCreate} disabled={busy || !text}>
                        {busy ? 'Création...' : (creation ? 'Remplacer ma signature' : 'Créer ma signature')}
                    </Button>
                    {creation && (
                        <Button className="w-100 mt-2" variant="outline-secondary" onClick={() => setEditing(false)} disabled={busy}>
                            Annuler
                        </Button>
                    )}
                </>
            )}
            <p style={{ fontSize: '0.8em', opacity: 0.75, marginTop: 10 }}>
                {civilian
                    ? "Cette signature est la vôtre pour tous vos documents (par exemple un formulaire de refus de soins signé avec le personnel) : si une signature a déjà été créée à votre nom, vous la retrouvez ici."
                    : 'Cette signature est proposée automatiquement dans les formulaires qui demandent une image de signature.'}
            </p>
        </div>
    );
};

export default SignatureCreator;
