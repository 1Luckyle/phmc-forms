import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import fetch from "node-fetch";
import { onRequest } from "firebase-functions/v2/https";
import cors from 'cors';

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.database();

// Set global options for all v2 functions in this file
setGlobalOptions({ region: "europe-west1" }); // Deploy to Europe region

// --- Helper Functions ---

const getShuffledPhrases = (phrases) => {
    if (!Array.isArray(phrases) || phrases.length === 0) return [];
    const array = [...phrases];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const sendWebhook = async (payload) => {
    // --- MODIFICATION: Use process.env to access the secret/environment variable
    const webhookURL = process.env.ADMIN_ACTION_WEBHOOK_URL;
    if (!webhookURL) {
        // --- MODIFICATION: Updated warning message
        console.warn("Webhook URL not found. Please set the ADMIN_ACTION_WEBHOOK_URL secret for this function.");
        return;
    }
    try {
        await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error("Error sending webhook from Cloud Function:", error);
    }
};

const scheduleDeletion = async (request) => {
    const requestId = request.id;
    const processedAt = new Date(request.processedAt);
    const now = new Date();
    const timeDiff = now.getTime() - processedAt.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

    let isDeletable = false;

    if (request.status.startsWith('Denied') && daysDiff >= 2) {
        isDeletable = true;
    } else if (request.status === 'approved' && daysDiff >= 1) {
        isDeletable = true;
    }

    if (isDeletable) {
        const requestRef = db.ref(`bingo/phraseRequests/${requestId}`);
        try {
            await requestRef.remove();
            console.log(`Successfully deleted request ${requestId}`);

             const embed = {
                 title: "Demande de phrase de bingo supprimée (Programmée)",
                 description: `ID de la demande : ${requestId} supprimée automatiquement.`,
                 fields: [
                     { name: "Statut", value: request.status, inline: true },
                     { name: "Demandé par", value: request.requestedBy, inline: true },
                     { name: "Phrase", value: request.phrase, inline: false },
                 ],
                 timestamp: new Date().toISOString(),
                 footer: { text: "PHMC-FR Tools - Nettoyage programmé" }
             };
             await sendWebhook({ embeds: [embed] });

        } catch (error) {
            console.error(`Error deleting request ${requestId}:`, error);
            // Consider logging this error to Sentry
        }
    }
};

// --- Scheduled Cloud Function (v2) ---

// Use ESM 'export' syntax instead of 'exports.dailyTaskHandler ='
export const dailyTaskHandler = onSchedule({
    schedule: "every day 09:00",
    timeZone: "UTC",
    // --- MODIFICATION: Add the 'secrets' option to grant access to the webhook URL
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (event) => {
    console.log(`Running daily task handler. Event ID: ${event.id}`);

    // --- Bingo Reset Logic ---
    const BINGO_TYPES = [
        { id: 'er', name: 'Emergency Room', path: 'ER' },
        { id: 'ems', name: 'EMS', path: 'EMS' },
        { id: 'coroner', name: 'Coroner', path: 'Coroner' }
    ];

    const bingoResults = { success: [], noCard: [], notEnoughPhrases: [], errors: [] };

    await db.ref('bingo/meta').update({ lastAutoRegenTimestamp: admin.database.ServerValue.TIMESTAMP });

    await Promise.all(BINGO_TYPES.map(async (bingoType) => {
        const cardPhrasesRef = db.ref(`bingo/cards/${bingoType.path}/phrases`);
        const masterPhrasesRef = db.ref(`bingo/phrases/${bingoType.path}`);
        const activityLogRef = db.ref(`bingo/logs/${bingoType.path}/activityLog`);

        try {
            const cardSnapshot = await cardPhrasesRef.once('value');
            if (!cardSnapshot.exists()) {
                bingoResults.noCard.push(bingoType.name);
                return;
            }

            const masterSnapshot = await masterPhrasesRef.once('value');
            if (!masterSnapshot.exists()) {
                bingoResults.notEnoughPhrases.push(`${bingoType.name} (no master list)`);
                return;
            }

            const masterPhrasesData = masterSnapshot.val();
            // --- IMPROVEMENT: More robustly handle object-or-array data structures from Firebase.
            const masterPhrases = Array.isArray(masterPhrasesData)
                ? masterPhrasesData.filter(Boolean)
                : (typeof masterPhrasesData === 'object' && masterPhrasesData !== null)
                    ? Object.values(masterPhrasesData).map(p => (typeof p === 'object' ? p.phrase : p)).filter(Boolean)
                    : [];

            if (masterPhrases.length < 24) {
                bingoResults.notEnoughPhrases.push(`${bingoType.name} (${masterPhrases.length}/24)`);
                return;
            }

            const shuffledPhrases = getShuffledPhrases(masterPhrases).slice(0, 24);
            await cardPhrasesRef.set(shuffledPhrases);
            await activityLogRef.remove();
            bingoResults.success.push(bingoType.name);

        } catch (error) {
            console.error(`Error processing ${bingoType.name}:`, error);
            bingoResults.errors.push(`${bingoType.name}: ${error.message}`);
        }
    }));

    let bingoDetails = '';
    if (bingoResults.success.length > 0) bingoDetails += `✅ Régénéré : ${bingoResults.success.join(', ')}\n`;
    if (bingoResults.noCard.length > 0) bingoDetails += `➖ Ignoré (Désactivé) : ${bingoResults.noCard.join(', ')}\n`;
    if (bingoResults.notEnoughPhrases.length > 0) bingoDetails += `⚠️ Ignoré (Pas assez de phrases) : ${bingoResults.notEnoughPhrases.join(', ')}\n`;
    if (bingoResults.errors.length > 0) bingoDetails += `❌ Erreurs : ${bingoResults.errors.join(', ')}\n`;

    // --- Phrase Request Deletion Logic ---
    const requestsRef = db.ref('bingo/phraseRequests');
    let deletionDetails = '';
    try {
        const snapshot = await requestsRef.once('value');
        if (snapshot.exists()) {
            const requests = snapshot.val();
            let deletionCount = 0;

            // Collect deletion promises
            const deletionPromises = Object.entries(requests)
                .map(([key, value]) => {
                    const request = { id: key, ...value };
                    if (request.status !== 'pending' && request.processedAt) {
                        return scheduleDeletion(request).then(() => {
                            deletionCount++; // Increment only on successful deletion
                        });
                    }
                    return null;
                })
                .filter(Boolean);

            await Promise.all(deletionPromises);
            deletionDetails = `✅ ${deletionCount} demandes de phrases supprimées avec succès.\n`;

        } else {
            deletionDetails = '➖ Aucune demande de phrase trouvée à supprimer.\n';
        }
    } catch (error) {
        console.error('Error during deletion scheduling:', error);
        deletionDetails = `❌ Erreur lors de la suppression des demandes de phrases : ${error.message}\n`;
    }

    const embed = {
        title: "Gestionnaire de tâches quotidiennes",
        color: 0x1E90FF,
        fields: [
            { name: "Statut de réinitialisation du Bingo", value: `\`\`\n${bingoDetails.trim() || "Aucune action de bingo effectuée."}\n\`\`\n`, inline: false },
            { name: "Suppression des demandes de phrases", value: `\`\`\n${deletionDetails.trim() || "Aucune action de demande de phrase effectuée."}\n\`\`\n`, inline: false },
        ],
        timestamp: new Date(event.timestamp).toUTCString(),
        footer: { text: "PHMC-Fr Tools - Fonction Cloud Planifiée (v2)" }
    };

    await sendWebhook({ embeds: [embed] });

    console.log('Gestionnaire de tâches quotidiennes terminé avec succès.');

    return null;
});

// --- OAuth Token Exchange Function ---

const corsHandler = cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3000/phmc-forms',
        'https://1luckyle.github.io',
        'https://1luckyle.github.io/phmc-forms',
    ],
    methods: ['POST', 'OPTIONS'],
    credentials: true
});

export const exchangeAuthCodeForToken = onRequest({ secrets: ["GTAWORLD_CLIENT_ID", "GTAWORLD_CLIENT_SECRET"] }, async (req, res) => {
    // Handle CORS
    await new Promise((resolve) => corsHandler(req, res, resolve));

    // Set CORS headers explicitly for all responses
    res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Handle data from both httpsCallable (req.body.data) and direct fetch (req.body)
    const data = req.body.data || req.body;

    console.log('Received request data:', JSON.stringify(data, null, 2));

    const { code, redirectUri, tokenUrl } = data || {};
    const clientId = process.env.GTAWORLD_CLIENT_ID;
    const clientSecret = process.env.GTAWORLD_CLIENT_SECRET;

    // Validate required arguments
    if (!code) {
        console.error('Missing code parameter');
        res.status(400).json({ error: 'invalid-argument', message: 'La fonction doit être appelée avec l\'argument « code ».' });
        return;
    }

    if (!redirectUri) {
        console.error('Missing redirectUri parameter');
        res.status(400).json({ error: 'invalid-argument', message: 'La fonction doit être appelée avec l\'argument « redirectUri ».' });
        return;
    }

    if (!clientId || !clientSecret) {
        console.error('Missing client credentials');
        res.status(500).json({ error: 'internal', message: 'Les identifiants client OAuth ne sont pas configurés.' });
        return;
    }

    console.log('OAuth credentials loaded:', { clientId: clientId ? '✓ loaded' : '✗ missing', clientSecret: clientSecret ? '✓ loaded' : '✗ missing' });

    try {
        // Determine the base URL from tokenUrl or environment
        let baseUrl;
        if (tokenUrl) {
            try {
                // Extract the origin from the provided tokenUrl
                baseUrl = new URL(tokenUrl).origin;
            } catch (e) {
                console.warn('Invalid tokenUrl provided, ignoring:', tokenUrl);
            }
        }
        /*
         * Determine the base domain for the OAuth and API calls.  If the client
         * provides a tokenUrl, extract its origin.  Otherwise use the
         * `GTAWORLD_OAUTH_BASE_URL` secret when defined, or fall back to the
         * French UCP domain.  The French domain (`ucp-fr.gta.world`) is the one
         * documented for OAuth flows in the PHMC-FR context.
         */
        baseUrl = baseUrl || process.env.GTAWORLD_OAUTH_BASE_URL || 'https://ucp-fr.gta.world';
        // Construct the endpoints using the resolved baseUrl. tokenUrl, if provided,
        // overrides only the token endpoint.  Note: the user endpoint does not
        // include a version segment on UCP-FR.
        const tokenEndpoint = tokenUrl || `${baseUrl}/oauth/token`;
        const userEndpoint = `${baseUrl}/api/user`;

        // Exchange auth code for access token
        const requestBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code: code,
        });

        console.log('Sending token request to GTAW with:', {
            grant_type: 'authorization_code',
            client_id: clientId ? clientId.substring(0, 5) + '...' : 'missing',
            client_secret: clientSecret ? clientSecret.substring(0, 5) + '...' : 'missing',
            redirect_uri: redirectUri,
            code: code.substring(0, 10) + '...',
            tokenEndpoint
        });

        const tokenResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: requestBody,
        });

        const tokenText = await tokenResponse.text();
        const tokenContentType = tokenResponse.headers.get('content-type') || '';
        if (!tokenContentType.includes('application/json')) {
            console.error('Token response is not JSON:', {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                contentType: tokenContentType,
                bodySnippet: tokenText.substring(0, 500),
            });
            res.status(400).json({ error: 'Échec de la récupération du token', status: tokenResponse.status, details: tokenText.substring(0, 500) });
            return;
        }
        let tokenData;
        try {
            tokenData = JSON.parse(tokenText);
        } catch (parseError) {
            console.error('Failed to parse token response as JSON:', parseError);
            res.status(500).json({ error: 'Échec du parsing du token', details: parseError.message });
            return;
        }

        // Fetch user profile
        // Some endpoints may serve HTML by default unless an Accept header is provided.
        // We explicitly request JSON to ensure the API returns a JSON response rather than an HTML page.
        const userResponse = await fetch(userEndpoint, {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/json',
            },
        });
        const userText = await userResponse.text();
        const userContentType = userResponse.headers.get('content-type') || '';
        let userData;
        if (!userContentType.includes('application/json')) {
            console.error('User endpoint response is not JSON:', {
                status: userResponse.status,
                statusText: userResponse.statusText,
                contentType: userContentType,
                bodySnippet: userText.substring(0, 500),
            });
            userData = userText.substring(0, 500);
            res.status(400).json({ error: 'Échec de la récupération des données utilisateur', details: userData });
            return;
        }
        try {
            userData = JSON.parse(userText);
        } catch (err) {
            console.error('Failed to parse user response JSON:', err);
            res.status(500).json({ error: 'Erreur de parsing des données utilisateur', details: err.message });
            return;
        }

        if (!userResponse.ok) {
            res.status(400).json({ error: 'Échec de la récupération des données utilisateur', details: userData });
            return;
        }

        res.status(200).json({ token: tokenData, user: userData });
    } catch (error) {
        console.error("Error exchanging auth code:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
            error: 'internal',
            message: 'Une erreur interne est survenue lors de l\'échange du token',
            details: error.message
        });
    }
});