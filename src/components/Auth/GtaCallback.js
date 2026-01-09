import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
// We no longer use the Firebase httpsCallable API here because the
// underlying Cloud Function `exchangeAuthCodeForToken` is an
// HTTP-triggered function (onRequest). Using httpsCallable requires
// an onCall function and expects a `data` field in the response. To
// avoid the "Response is missing data field" error, we call the
// HTTP endpoint directly via fetch.
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
                    // The Cloud Function `exchangeAuthCodeForToken` is deployed as an
                    // HTTP-triggered function (onRequest). We call it directly via
                    // fetch to avoid the `httpsCallable` requirement for a data field.
                    const functionUrl = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/exchangeAuthCodeForToken';
                    // Determine the token endpoint. Prefer an explicit base URL if provided via
                    // environment variables, otherwise default to the French UCP domain.
                    const baseUrl = process.env.REACT_APP_GTAWORLD_OAUTH_BASE_URL || 'https://ucp-fr.gta.world';
                    const tokenUrl = `${baseUrl}/oauth/token`;
                    console.log('Calling token exchange via fetch with:', {
                        code: code.substring(0, 10) + '...',
                        redirectUri: window.location.origin + '/phmc-forms/#/auth/gta/callback',
                        tokenUrl
                    });
                    const response = await fetch(functionUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            code,
                            redirectUri: window.location.origin + '/phmc-forms/#/auth/gta/callback',
                            tokenUrl,
                        }),
                    });
                    const responseText = await response.text();
                    let data;
                    try {
                        data = JSON.parse(responseText);
                    } catch (parseError) {
                        throw new Error(`Réponse JSON invalide du serveur. Reçue : ${responseText.substring(0, 100)}...`);
                    }
                    console.log('Token exchange response:', data);
                    if (response.ok) {
                        // Call the login function with the full response (contains token and user)
                        await login(data);
                        navigate('/admin');
                    } else {
                        // The server responded with an error; include details if available
                        const errorMessage = data.error || data.message || 'Erreur inconnue lors de l\'échange du jeton';
                        throw new Error(errorMessage);
                    }
                } catch (error) {
                    console.error('Token exchange error:', error);
                    // Capture the exception in Sentry with additional context
                    Sentry.captureException(error, {
                        extra: {
                            context: 'OAuth Token Exchange via fetch',
                            message: error.message,
                        },
                    });
                    // Set a user-friendly error message based on the error
                    const errorMessage = error.message || "Échec de l'authentification";
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