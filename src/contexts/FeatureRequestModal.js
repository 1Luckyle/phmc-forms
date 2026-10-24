import React from 'react';
import { Form, Button } from 'react-bootstrap';
import './FeatureRequestModal.css';
import '../components/DarkUi.css';
import * as Sentry from "@sentry/react";
import { useNotification } from './NotificationContext';
import DebugFillButton from '../components/DebugFillButton';
import { submitSiteRequest } from '../utils/siteRequests';

// Deux versions du même formulaire :
//   • mode « bug »     : rapport de bug (comptes connectés) ;
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

        // La demande est enregistrée dans le site (siteRequests) : l'équipe la retrouve dans le panneau admin →
        // « Demandes du site », avec un statut de suivi. Plus de dépendance à Discord.
        const type = isFormRequest ? 'form' : isFeature ? 'feature' : 'bug';
        const summary = (featureRequest || bbcodeTitleRequest || '').split(/\r?\n/)[0].trim();
        const result = await submitSiteRequest({
            type,
            title: isFormRequest ? bbcodeTitleRequest : (summary || kindLabel),
            by: { name: discordName, discord: discordName },
            fields: [
                { label: 'Soumis par (Discord)', value: discordName },
                { label: 'Type de demande', value: kindLabel },
                ...(isFormRequest ? [{ label: 'Titre proposé pour le formulaire', value: bbcodeTitleRequest }] : []),
                { label: isFeature ? 'Détails de la demande' : 'Détails du bug', value: featureRequest },
                ...(isFormRequest ? [{ label: looksLikeHtml(bbcodeRequestText) ? 'HTML demandé' : 'BBCode demandé', value: bbcodeRequestText }] : []),
                { label: 'Version du formulaire ouvert', value: String(bbCodeVersion ?? '') },
                { label: 'Page', value: `${window.location.pathname}${window.location.hash || ''}` },
                { label: 'Version du site', value: commitInfo?.sha },
                { label: 'Navigateur', value: navigator.userAgent },
            ],
        });

        if (!result.ok) {
            Sentry.captureMessage('Feature/bug request could not be saved', { level: 'error', extra: { reason: result.reason, error: result.error?.message } });
            showNotification(result.reason === 'not-signed-in'
                ? "Connectez-vous à votre compte pour envoyer votre retour : il est enregistré à votre nom pour que l'équipe puisse vous répondre."
                : "L'envoi a échoué. Réessayez dans un instant.", result.reason === 'not-signed-in' ? 'warning' : 'exclamation-triangle');
            return;
        }

        showNotification("Merci pour votre retour ! Il est bien enregistré, l'équipe va s'en occuper.", 'check-circle');
        setShowFeatureRequestModal(false);
        setFeatureRequest('');
        setDiscordName('');
        setIsBbcodeRequest(false);
        setBbcodeTitleRequest('');
        setBbcodeRequestText('');
    };

    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay feature-request-modal dark-ui" onClick={onClose}>
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
                                        ? "Décrivez la fonctionnalité souhaitée avec le plus de précision possible : à quoi elle servirait, où vous l'imagineriez dans l'outil. Pour illustrer, collez le lien (URL) d'une image."
                                        : "Décrivez le bug : ce que vous faisiez, ce qui s'est passé, ce que vous attendiez. Plus il y a d'informations, mieux c'est. Pour joindre une image, collez son lien (URL), par exemple depuis imgBB."
                                }
                            />
                        </Form.Group>
                        <Form.Text className="text-muted d-block mb-3" style={{ marginTop: '-0.5rem' }}>
                            <i className="fas fa-image me-1"></i>Les images se joignent <strong>par lien (URL)</strong> : collez l'adresse de l'image dans votre message (hébergée par exemple sur imgBB). Les fichiers ne peuvent pas être envoyés ici.
                        </Form.Text>
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
