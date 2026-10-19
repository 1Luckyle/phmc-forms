// src/components/EmailChangeFlow.js
//
// Changement d'adresse Eyefind Mail en deux étapes, partagé entre « Mon profil » (la personne
// change SA propre adresse) et la fiche du personnel du panneau admin (targetUid = le compte visé).
//   1. saisie de la nouvelle adresse -> un code à 6 chiffres lui est envoyé ;
//   2. saisie du code -> le serveur applique le changement (compte de connexion + fiche).
// Rien n'est modifié tant que le code n'a pas été validé (pas de changement au hasard ni
// d'usurpation). Les adresses hors Eyefind Mail (ancienne connexion par mot de passe) sont en
// lecture seule : les changer casserait la connexion de la personne.
import React, { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { EYEFIND_MAIL_SIGNUP_URL, isEyefindAddress, requestStaffEmailChange, confirmStaffEmailChange } from '../utils/eyefindMail';

const EmailChangeFlow = ({ currentEmail, targetUid = null, onChanged }) => {
    const [step, setStep] = useState('idle'); // idle | edit | code
    const [newEmail, setNewEmail] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const editable = isEyefindAddress(currentEmail);

    const reset = () => { setStep('idle'); setNewEmail(''); setCode(''); setError(''); };

    const sendCode = async () => {
        setError('');
        setSuccess('');
        const candidate = newEmail.trim();
        if (!isEyefindAddress(candidate)) {
            setError('Adresse invalide (format attendu : prenomnom@mail.eyefind.fr).');
            return;
        }
        setBusy(true);
        const result = await requestStaffEmailChange(candidate, targetUid);
        setBusy(false);
        if (!result.ok) { setError(result.message); return; }
        setStep('code');
    };

    const confirm = async () => {
        setError('');
        if (!/^\d{6}$/.test(code.trim())) { setError('Le code comporte 6 chiffres.'); return; }
        setBusy(true);
        const result = await confirmStaffEmailChange(code.trim(), targetUid);
        setBusy(false);
        if (!result.ok) { setError(result.message); return; }
        setSuccess(`Adresse modifiée : ${result.email}`);
        reset();
        if (onChanged) onChanged(result.email);
    };

    return (
        <div>
            <Form.Label>E-mail (Eyefind Mail)</Form.Label>
            <div className="d-flex gap-2 align-items-center">
                <Form.Control value={currentEmail || ''} disabled />
                {editable && step === 'idle' && (
                    <Button variant="outline-primary" size="sm" onClick={() => { setSuccess(''); setStep('edit'); }} style={{ whiteSpace: 'nowrap' }}>
                        <i className="fas fa-pen me-1"></i>Modifier
                    </Button>
                )}
            </div>
            {!editable && (
                <Form.Text className="text-muted">
                    Cette adresse est votre identifiant de connexion historique (hors Eyefind Mail) : elle ne peut pas être modifiée ici.
                </Form.Text>
            )}
            {success && <Alert variant="success" className="mt-2 mb-0 py-2">{success}</Alert>}

            {editable && step === 'edit' && (
                <div className="mt-2">
                    <Form.Control
                        type="email"
                        placeholder="prenomnom@mail.eyefind.fr"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        disabled={busy}
                    />
                    <Form.Text className="text-muted">
                        Un code de vérification sera envoyé à cette nouvelle adresse. Pas encore d'adresse ?{' '}
                        <a href={EYEFIND_MAIL_SIGNUP_URL} target="_blank" rel="noopener noreferrer">Créez-la sur Eyefind Mail</a>.
                    </Form.Text>
                    <div className="d-flex gap-2 mt-2">
                        <Button size="sm" onClick={sendCode} disabled={busy || !newEmail.trim()}>
                            {busy ? <Spinner size="sm" animation="border" /> : 'Envoyer le code'}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={reset} disabled={busy}>Annuler</Button>
                    </div>
                </div>
            )}

            {editable && step === 'code' && (
                <div className="mt-2">
                    <Alert variant="info" className="py-2">
                        Un code a été envoyé à <strong>{newEmail.trim()}</strong> (valable 15 minutes).
                        {targetUid ? ' Demandez-le à la personne concernée.' : ' Consultez votre messagerie Eyefind Mail.'}
                    </Alert>
                    <Form.Control
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Code à 6 chiffres"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        disabled={busy}
                    />
                    <div className="d-flex gap-2 mt-2">
                        <Button size="sm" variant="success" onClick={confirm} disabled={busy || code.length !== 6}>
                            {busy ? <Spinner size="sm" animation="border" /> : 'Valider le changement'}
                        </Button>
                        <Button size="sm" variant="outline-secondary" onClick={sendCode} disabled={busy}>Renvoyer un code</Button>
                        <Button size="sm" variant="secondary" onClick={reset} disabled={busy}>Annuler</Button>
                    </div>
                </div>
            )}

            {error && <Alert variant="danger" className="mt-2 mb-0 py-2">{error}</Alert>}
        </div>
    );
};

export default EmailChangeFlow;
