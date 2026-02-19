// src/components/Auth/PasswordResetHandler.js
import React, { useState, useEffect } from 'react';
import { Button, Form, Alert } from 'react-bootstrap';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../firebase';

const PasswordResetHandler = () => {
    const [oobCode, setOobCode] = useState(null);
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState('loading'); // loading | ready | success | error | invalid
    const [error, setError] = useState('');

    useEffect(() => {
        // Firebase can pass params in the hash fragment OR as regular query params
        // e.g. #/reset-password?oobCode=XXX  OR  ?mode=resetPassword&oobCode=XXX
        const hashPart = window.location.hash; // #/reset-password?oobCode=XXX
        const searchPart = window.location.search; // ?mode=resetPassword&oobCode=XXX

        let code = null;

        // Try hash query string first (custom action URL flow)
        if (hashPart.includes('?')) {
            const hashQuery = new URLSearchParams(hashPart.split('?')[1]);
            code = hashQuery.get('oobCode');
        }

        // Fallback: regular query string (Firebase default flow)
        if (!code && searchPart) {
            const searchQuery = new URLSearchParams(searchPart);
            code = searchQuery.get('oobCode');
        }

        if (!code) {
            setStatus('invalid');
            return;
        }

        setOobCode(code);

        verifyPasswordResetCode(auth, code)
            .then((emailFromCode) => {
                setEmail(emailFromCode);
                setStatus('ready');
            })
            .catch(() => {
                setStatus('invalid');
            });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!newPassword || !confirmPassword) {
            setError('Veuillez remplir tous les champs.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            setError('Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.');
            return;
        }

        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            setStatus('success');
        } catch (err) {
            if (err.code === 'auth/expired-action-code') {
                setError('Ce lien a expiré. Veuillez demander un nouveau lien de réinitialisation.');
            } else if (err.code === 'auth/invalid-action-code') {
                setError('Ce lien est invalide ou a déjà été utilisé.');
            } else if (err.code === 'auth/weak-password') {
                setError('Mot de passe trop faible.');
            } else {
                setError(err.message);
            }
        }
    };

    const containerStyle = {
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    };

    const cardStyle = {
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '10px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        color: '#c9d1d9',
    };

    const inputStyle = {
        backgroundColor: '#0d1117',
        color: '#c9d1d9',
        border: '1px solid #30363d',
        marginBottom: '15px',
    };

    if (status === 'loading') {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{ textAlign: 'center' }}>
                        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#4a9eff', marginBottom: '15px' }}></i>
                        <p>Vérification du lien...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{ textAlign: 'center' }}>
                        <i className="fas fa-times-circle" style={{ fontSize: '2.5rem', color: '#dc3545', marginBottom: '15px' }}></i>
                        <h4>Lien invalide ou expiré</h4>
                        <p style={{ color: '#8b949e', marginBottom: '25px' }}>
                            Ce lien de réinitialisation est invalide ou a déjà été utilisé.
                        </p>
                        <Button
                            variant="primary"
                            onClick={() => { window.location.hash = '/'; }}
                        >
                            Retour à l'accueil
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{ textAlign: 'center' }}>
                        <i className="fas fa-check-circle" style={{ fontSize: '2.5rem', color: '#28a745', marginBottom: '15px' }}></i>
                        <h4>Mot de passe réinitialisé !</h4>
                        <p style={{ color: '#8b949e', marginBottom: '25px' }}>
                            Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.
                        </p>
                        <Button
                            variant="success"
                            onClick={() => { window.location.hash = '/'; }}
                        >
                            Aller à la connexion
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <i className="fas fa-key" style={{ fontSize: '2rem', color: '#4a9eff', marginBottom: '10px' }}></i>
                    <h4>Nouveau mot de passe</h4>
                    {email && (
                        <p style={{ color: '#8b949e', fontSize: '0.9em' }}>
                            Pour le compte : <strong style={{ color: '#c9d1d9' }}>{email}</strong>
                        </p>
                    )}
                </div>

                {error && (
                    <Alert variant="danger" onClose={() => setError('')} dismissible>
                        {error}
                    </Alert>
                )}

                <div style={{ marginBottom: '15px', padding: '8px 12px', backgroundColor: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: '5px', fontSize: '0.82em', color: '#ffc107' }}>
                    <i className="fas fa-shield-alt" style={{ marginRight: '6px' }}></i>
                    Minimum 8 caractères, une majuscule, un chiffre et un caractère spécial.
                </div>

                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>Nouveau mot de passe</Form.Label>
                        <Form.Control
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            style={inputStyle}
                            autoComplete="new-password"
                        />
                    </Form.Group>
                    <Form.Group className="mb-4">
                        <Form.Label>Confirmer le mot de passe</Form.Label>
                        <Form.Control
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            style={inputStyle}
                            autoComplete="new-password"
                        />
                    </Form.Group>
                    <Button variant="primary" type="submit" style={{ width: '100%' }}>
                        <i className="fas fa-save" style={{ marginRight: '8px' }}></i>
                        Enregistrer le nouveau mot de passe
                    </Button>
                </Form>
            </div>
        </div>
    );
};

export default PasswordResetHandler;
