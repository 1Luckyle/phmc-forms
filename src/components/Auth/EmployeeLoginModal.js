// src/components/Auth/EmployeeLoginModal.js
import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';

const EmployeeLoginModal = ({ show, onHide, onSuccess }) => {
    const { loginEmployee } = useEmployeeAuth();
    const [loginData, setLoginData] = useState({ email: '', password: '' });
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError] = useState('');
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    const handleChange = (e) => {
        setLoginData({
            ...loginData,
            [e.target.name]: e.target.value
        });
        setError(''); // Clear error when user types
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!loginData.email || !loginData.password) {
            setError('Veuillez remplir tous les champs.');
            return;
        }
        
        setIsLoggingIn(true);
        setError('');
        
        try {
            await loginEmployee(loginData.email, loginData.password);
            
            // Reset form
            setLoginData({ email: '', password: '' });
            
            // Call success callback
            if (onSuccess) {
                onSuccess();
            }
            
            // Close modal
            onHide();
        } catch (error) {
            console.error('Error during login:', error);
            let errorMessage = 'Erreur lors de la connexion.';
            
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                errorMessage = 'Email ou mot de passe incorrect.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Email invalide.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Trop de tentatives. Réessayez plus tard.';
            } else if (error.code === 'auth/invalid-credential') {
                errorMessage = 'Identifiants invalides.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setError(errorMessage);
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleClose = () => {
        setLoginData({ email: '', password: '' });
        setError('');
        setResetEmailSent(false);
        onHide();
    };

    const handlePasswordReset = async () => {
        if (!loginData.email) {
            setError('Veuillez entrer votre adresse email pour réinitialiser le mot de passe.');
            return;
        }

        setIsResettingPassword(true);
        setError('');

        try {
            const isProd = window.location.hostname !== 'localhost';
            const appBase = isProd
                ? 'https://1luckyle.github.io/phmc-forms/'
                : `${window.location.origin}/phmc-forms/`;
            const actionCodeSettings = {
                url: `${appBase}#/reset-password`,
                handleCodeInApp: false,
            };
            await sendPasswordResetEmail(auth, loginData.email, actionCodeSettings);
            setResetEmailSent(true);
            setError('');
        } catch (error) {
            console.error('Error sending password reset email:', error);
            let errorMessage = 'Erreur lors de l\'envoi de l\'email de réinitialisation.';
            
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'Aucun compte trouvé avec cette adresse email.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Adresse email invalide.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Trop de tentatives. Réessayez plus tard.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            setError(errorMessage);
        } finally {
            setIsResettingPassword(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton style={{ backgroundColor: '#1a1a1a', color: '#fff', borderBottom: '1px solid #444' }}>
                <Modal.Title>
                    <i className="fas fa-sign-in-alt" style={{ marginRight: '10px' }}></i>
                    Connexion Employé
                </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>
                {error && (
                    <Alert variant="danger" onClose={() => setError('')} dismissible>
                        {error}
                    </Alert>
                )}
                
                {resetEmailSent && (
                    <Alert variant="success" onClose={() => setResetEmailSent(false)} dismissible>
                        <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i>
                        Un email de réinitialisation de mot de passe a été envoyé à <strong>{loginData.email}</strong>.
                        Vérifiez votre boîte de réception et vos spams.
                    </Alert>
                )}
                
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                            type="email"
                            name="email"
                            value={loginData.email}
                            onChange={handleChange}
                            placeholder="votre.email@exemple.com"
                            autoComplete="email"
                            style={{
                                backgroundColor: '#1a1a1a',
                                color: '#fff',
                                border: '1px solid #444'
                            }}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Mot de passe</Form.Label>
                        <Form.Control
                            type="password"
                            name="password"
                            value={loginData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            style={{
                                backgroundColor: '#1a1a1a',
                                color: '#fff',
                                border: '1px solid #444'
                            }}
                        />
                    </Form.Group>

                    <div style={{ marginBottom: '15px', textAlign: 'right' }}>
                        <Button 
                            variant="link" 
                            onClick={handlePasswordReset}
                            disabled={isResettingPassword || !loginData.email}
                            style={{ 
                                color: '#4a9eff', 
                                textDecoration: 'none',
                                padding: 0,
                                fontSize: '0.9em'
                            }}
                        >
                            {isResettingPassword ? (
                                <>
                                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>
                                    Envoi en cours...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-key" style={{ marginRight: '5px' }}></i>
                                    Mot de passe oublié ?
                                </>
                            )}
                        </Button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                        <Button variant="secondary" onClick={handleClose} disabled={isLoggingIn}>
                            Annuler
                        </Button>
                        <Button 
                            variant="primary" 
                            type="submit" 
                            disabled={isLoggingIn}
                        >
                            {isLoggingIn ? (
                                <>
                                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>
                                    Connexion en cours...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-sign-in-alt" style={{ marginRight: '5px' }}></i>
                                    Se connecter
                                </>
                            )}
                        </Button>
                    </div>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

export default EmployeeLoginModal;
