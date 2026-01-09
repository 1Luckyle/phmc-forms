import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as Sentry from "@sentry/react";

const GtaCallback = () => {
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const searchParams = new URLSearchParams(location.search);
                const code = searchParams.get('code');
                const error = searchParams.get('error');
                const error_description = searchParams.get('error_description');

                // Handle OAuth errors
                if (error) {
                    const errorMsg = error_description || error;
                    console.error('OAuth Error:', error, error_description);
                    Sentry.captureMessage('OAuth Authorization Error', {
                        level: 'error',
                        extra: { error, error_description }
                    });
                    setError(errorMsg);
                    setIsProcessing(false);
                    return;
                }

                // Handle missing code
                if (!code) {
                    const errorMsg = 'No authorization code received';
                    console.error(errorMsg);
                    Sentry.captureMessage(errorMsg, { level: 'error' });
                    setError(errorMsg);
                    setIsProcessing(false);
                    return;
                }

                // Check if this is a token exchange test
                const isExchangeInProgress = sessionStorage.getItem('oauth-exchange-in-progress');
                if (isExchangeInProgress) {
                    sessionStorage.removeItem('oauth-exchange-in-progress');
                    sessionStorage.setItem('oauth-exchange-code', code);
                    navigate('/admin');
                    return;
                }

                // Handle actual authentication
                try {
                    const functions = getFunctions(undefined, 'europe-west1');
                    const exchangeAuthCodeForToken = httpsCallable(functions, 'exchangeAuthCodeForToken');
                    
                    console.log('Calling token exchange with:', { 
                        code: code.substring(0, 10) + '...', 
                        redirectUri: window.location.origin + '/phmc-forms/#/auth/gta/callback' 
                    });
                    
                    // Determine the base URL for the GTA World OAuth endpoints.  If the environment
                    // variable `REACT_APP_GTAWORLD_OAUTH_BASE_URL` is set, use it; otherwise
                    // default to the French UCP domain for backwards compatibility.  Pass
                    // the token endpoint to the Cloud Function so that the backend can
                    // select the correct domain.
                    const baseUrl = process.env.REACT_APP_GTAWORLD_OAUTH_BASE_URL || 'https://ucp-fr.gta.world';
                    const tokenUrl = `${baseUrl}/oauth/token`;

                    const result = await exchangeAuthCodeForToken({ 
                        code, 
                        redirectUri: window.location.origin + '/phmc-forms/#/auth/gta/callback',
                        tokenUrl
                    });
                    
                    console.log('Token exchange result:', result);
                    
                    if (result.data) {
                        await login(result.data);
                        navigate('/admin');
                    } else {
                        throw new Error('No user data received from token exchange');
                    }
                } catch (error) {
                    console.error('Token exchange error:', error);
                    console.error('Error code:', error.code);
                    console.error('Error message:', error.message);
                    console.error('Error details:', error.details);
                    
                    Sentry.captureException(error, {
                        extra: { 
                            context: 'OAuth Token Exchange',
                            errorCode: error.code,
                            errorDetails: error.details
                        }
                    });
                    
                    let errorMessage = "Échec de l'authentification";
                    if (error.code === 'invalid-argument') {
                        errorMessage = 'Paramètres de requête invalides. Veuillez réessayer.';
                    } else if (error.code === 'internal') {
                        errorMessage = 'Erreur de configuration du serveur. Veuillez contacter le support.';
                    } else if (error.message) {
                        errorMessage = error.message;
                    }
                    
                    setError(errorMessage);
                    setIsProcessing(false);
                }
            } catch (error) {
                console.error('OAuth callback error:', error);
                Sentry.captureException(error, {
                    extra: { context: 'OAuth Callback Handler' }
                });
                setError(error.message || 'Une erreur inconnue est survenue');
                setIsProcessing(false);
            }
        };

        handleCallback();
    }, [location, login, navigate]);

    if (error) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
                <div className="text-center">
                    <div className="alert alert-danger" role="alert">
                        <h4 className="alert-heading">Erreur d'authentification</h4>
                        <p>{error}</p>
                        <hr />
                        <button 
                            className="btn btn-primary" 
                            onClick={() => navigate('/admin')}
                        >
                            Retour au panneau d'administration
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <div className="text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Traitement de l'authentification...</span>
                </div>
                <p className="mt-3">Traitement de l'authentification, veuillez patienter...</p>
            </div>
        </div>
    );
};

export default GtaCallback;