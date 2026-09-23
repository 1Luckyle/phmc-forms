// src/components/Auth/GtaCallback.js
//
// Callback OAuth GTA World UNIQUE. Le client OAuth GTA World n'autorise qu'une
// seule URL de callback (https://1luckyle.github.io/phmc-forms/#/auth/gta/callback),
// donc TOUS les flux GTAW (onboarding, connexion employé, connexion admin,
// ajout d'employé par un admin) passent par ce composant, qui lit le flux
// mémorisé dans sessionStorage (voir utils/gtawOAuth.js) avant la redirection
// pour savoir quoi faire du code d'autorisation reçu, et où renvoyer
// l'utilisateur ensuite.
import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import * as Sentry from "@sentry/react";
import { auth } from '../../firebase';
import { GTAW_OAUTH_FLOW_KEY, getGtawRedirectUri } from '../../utils/gtawOAuth';

const EXCHANGE_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/exchangeAuthCodeForToken';
const LOGIN_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/gtawEmployeeLogin';

const GtaCallback = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // React StrictMode (dev) peut exécuter l'effet deux fois ; le code d'autorisation
    // OAuth est à usage unique, donc on ne traite le callback qu'une seule fois.
    const hasProcessedRef = useRef(false);

    useEffect(() => {
        const handleCallback = async () => {
            if (hasProcessedRef.current) return;
            hasProcessedRef.current = true;

            let flow = null;
            try {
                const raw = sessionStorage.getItem(GTAW_OAUTH_FLOW_KEY);
                sessionStorage.removeItem(GTAW_OAUTH_FLOW_KEY);
                flow = raw ? JSON.parse(raw) : null;
            } catch (err) {
                console.warn('Failed to parse GTA World OAuth flow:', err);
            }
            const flowType = flow?.type || 'onboarding';

            // Chaque flux a sa propre clé sessionStorage de résultat (consommée par le
            // composant qui a démarré la redirection) et sa route de retour.
            const finish = (result) => {
                if (flowType === 'employee-login') {
                    if (result?.error) {
                        try { sessionStorage.setItem('gtaw-login-result', JSON.stringify(result)); }
                        catch (err) { console.error('Failed to store GTA World login result:', err); }
                    }
                    navigate('/');
                    return;
                }
                if (flowType === 'admin-login') {
                    if (result?.error) {
                        try { sessionStorage.setItem('gtaw-login-result', JSON.stringify(result)); }
                        catch (err) { console.error('Failed to store GTA World login result:', err); }
                    }
                    // Toujours renvoyer vers /admin : ProtectedRoute renvoie automatiquement
                    // vers /login si la connexion a échoué (utilisateur toujours non authentifié),
                    // où le message d'erreur ci-dessus sera affiché.
                    navigate('/admin');
                    return;
                }
                if (flowType === 'admin-add') {
                    try { sessionStorage.setItem('gtaw-admin-add-result', JSON.stringify(result)); }
                    catch (err) { console.error('Failed to store GTA World admin-add result:', err); }
                    navigate('/');
                    return;
                }
                // 'onboarding' (par défaut)
                try { sessionStorage.setItem('gtaw-onboarding-result', JSON.stringify(result)); }
                catch (err) { console.error('Failed to store GTA World onboarding result:', err); }
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
                    Sentry.captureMessage('OAuth Authorization Error', {
                        level: 'error',
                        extra: { error, error_description, flowType }
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

                const baseUrl = process.env.REACT_APP_GTAWORLD_OAUTH_BASE_URL || 'https://ucp-fr.gta.world';
                const tokenUrl = `${baseUrl}/oauth/token`;
                const redirectUri = getGtawRedirectUri();

                if (flowType === 'employee-login' || flowType === 'admin-login') {
                    // Ces flux connectent directement l'utilisateur (pas de sélection de
                    // personnage) : le backend retrouve le compte lié au gtawUserId et
                    // renvoie un jeton Firebase personnalisé.
                    const response = await fetch(LOGIN_URL, {
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

                    if (!response.ok || !data.customToken) {
                        const errorMessage = data.message || data.error || 'Erreur inconnue lors de la connexion avec GTA World';
                        finish({ error: errorMessage });
                        return;
                    }

                    await signInWithCustomToken(auth, data.customToken);
                    finish({ success: true });
                    return;
                }

                // 'onboarding' et 'admin-add' : on a seulement besoin de la liste des
                // personnages GTAW pour que l'utilisateur en choisisse un.
                const response = await fetch(EXCHANGE_URL, {
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
                    employeeType: flow?.employeeType,
                });
            } catch (err) {
                console.error('GTA World OAuth callback error:', err);
                Sentry.captureException(err, { extra: { context: 'GTA World OAuth Callback', flowType } });
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

export default GtaCallback;
