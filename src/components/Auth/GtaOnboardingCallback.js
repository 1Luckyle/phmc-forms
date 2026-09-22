// src/components/Auth/GtaOnboardingCallback.js
//
// Callback OAuth GTA World dédié à la création de compte (onboarding).
// Contrairement à GtaLogin/GtaCallback (connexion admin), ce callback ne connecte
// personne : il échange le code contre le profil GTAW (personnages inclus), stocke
// le résultat dans sessionStorage, puis renvoie l'utilisateur à la racine de l'app
// où OnboardingModal reprend automatiquement à l'étape de sélection du personnage.
import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Sentry from "@sentry/react";

const GtaOnboardingCallback = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // React StrictMode (dev) peut exécuter l'effet deux fois ; le code d'autorisation
    // OAuth est à usage unique, donc on ne traite le callback qu'une seule fois.
    const hasProcessedRef = useRef(false);

    useEffect(() => {
        const handleCallback = async () => {
            if (hasProcessedRef.current) return;
            hasProcessedRef.current = true;

            const finish = (result) => {
                try {
                    sessionStorage.setItem('gtaw-onboarding-result', JSON.stringify(result));
                } catch (err) {
                    console.error('Failed to store GTA World onboarding result:', err);
                }
                navigate('/');
            };

            try {
                const searchParams = new URLSearchParams(location.search);
                const code = searchParams.get('code');
                const error = searchParams.get('error');
                const error_description = searchParams.get('error_description');

                if (error) {
                    const errorMsg = error_description || error;
                    console.error('OAuth Error:', error, error_description);
                    Sentry.captureMessage('OAuth Authorization Error (onboarding)', {
                        level: 'error',
                        extra: { error, error_description }
                    });
                    finish({ error: errorMsg });
                    return;
                }

                if (!code) {
                    const errorMsg = 'Aucun code d\'autorisation reçu';
                    console.error(errorMsg);
                    Sentry.captureMessage(errorMsg, { level: 'error' });
                    finish({ error: errorMsg });
                    return;
                }

                const functionUrl = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/exchangeAuthCodeForToken';
                const baseUrl = process.env.REACT_APP_GTAWORLD_OAUTH_BASE_URL || 'https://ucp-fr.gta.world';
                const tokenUrl = `${baseUrl}/oauth/token`;
                const redirectUri = window.location.origin + '/phmc-forms/#/auth/gta/onboarding-callback';

                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, redirectUri, tokenUrl }),
                });

                const responseText = await response.text();
                let data;
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    throw new Error(`Réponse JSON invalide du serveur. Reçue : ${responseText.substring(0, 100)}...`);
                }

                if (!response.ok) {
                    const errorMessage = data.error || data.message || 'Erreur inconnue lors de l\'échange du jeton';
                    throw new Error(errorMessage);
                }

                const characters = data?.user?.user?.character || [];
                const gtawUserId = data?.user?.user?.id ?? null;
                const gtawUsername = data?.user?.user?.username ?? null;

                finish({
                    characters,
                    unavailableCharacterIds: data.unavailableCharacterIds || [],
                    gtawUserId,
                    gtawUsername,
                });
            } catch (err) {
                console.error('GTA World onboarding callback error:', err);
                Sentry.captureException(err, { extra: { context: 'GTA World Onboarding Callback' } });
                finish({ error: err.message || 'Une erreur inconnue est survenue' });
            }
        };

        handleCallback();
    }, [location, navigate]);

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <div className="text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Connexion à GTA World...</span>
                </div>
                <p className="mt-3">Connexion à GTA World, veuillez patienter...</p>
            </div>
        </div>
    );
};

export default GtaOnboardingCallback;
