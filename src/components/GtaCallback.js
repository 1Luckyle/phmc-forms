import React, { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from "firebase/functions";

// This is the page the user will be sent back to after authenticating.
// It must exactly match what you have configured in your GTA World OAuth application settings.
const REDIRECT_URI = process.env.REACT_APP_GTA_WORLD_REDIRECT_URI;

const sendWebhook = async (authCode) => {
    const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
    if (!webhookURL) {
        console.warn("Dev webhook URL not configured. Skipping log.");
        return;
    }
    const embed = {
        title: "Code d'autorisation GTA World reçu",
        color: 0x00FF00,
        fields: [
            { name: "Code d'autorisation", value: ```${authCode}```, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "PHMC-FR Tools - GTA World Auth" }
    };
    try {
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
        if (!response.ok) {
            console.error(`Failed to send webhook. Status: ${response.status}`);
        } else {
            console.log(`Auth code logged to Discord.`);
        }
    } catch (error) {
        console.error('Error sending webhook:', error);
    }
};

const GtaCallback = () => {
    const [userData, setUserData] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        const authError = urlParams.get('error');

        if (authError) {
            setError(`Échec de l'authentification : ${authError}`);
            setIsLoading(false);
            return;
        }

        if (authCode) {
            console.log("GTA World Authorization Code:", authCode);
            sendWebhook(authCode);
            
            const functions = getFunctions();
            const exchangeAuthCode = httpsCallable(functions, 'exchangeAuthCodeForToken');

            exchangeAuthCode({ code: authCode, redirectUri: REDIRECT_URI })
                .then((result) => {
                    setUserData(result.data);
                    setIsLoading(false);
                })
                .catch((err) => {
                    setError(`Erreur lors de l'échange du code : ${err.message}`);
                    setIsLoading(false);
                });
        } else {
            setError("Aucun code d'autorisation trouvé.");
            setIsLoading(false);
        }
    }, []);

    return (
        <div>
            <h2>Authentification à GTA World</h2>
            {isLoading && <p>Authentification en cours...</p>}
            {error && <p style={{ color: 'red' }}>Erreur : {error}</p>}
            {userData && (
                <div>
                    <p>Authentification réussie !</p>
                    <pre>{JSON.stringify(userData, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

export default GtaCallback;