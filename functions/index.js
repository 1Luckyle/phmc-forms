import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import fetch from "node-fetch";
import { onRequest } from "firebase-functions/v2/https";
import cors from 'cors';

// Initialize Firebase Admin SDK
// L'URL de la Realtime Database est fournie explicitement : sans elle,
// admin.database() doit l'auto-détecter via un appel réseau (metadata server),
// ce qui échoue en local pendant l'étape d'analyse statique de `firebase deploy`
// (le processus Node local n'a pas toujours accès à ce service) et fait échouer
// tout le déploiement avec "Cannot determine backend specification. Timeout
// after 10000." En production (runtime Cloud Functions), cet appel réseau
// fonctionne, donc le bug ne s'y voyait pas — d'où l'URL en dur ici plutôt
// qu'un correctif runtime-only.
if (admin.apps.length === 0) {
    admin.initializeApp({
        databaseURL: 'https://phmcfr-forms-default-rtdb.europe-west1.firebasedatabase.app'
    });
}
const db = admin.database();

// Set global options for all v2 functions in this file.
// serviceAccount : les fonctions Cloud Functions 2ᵉ génération tournent par
// défaut sous le compte de service Compute Engine par défaut
// (<PROJECT_NUMBER>-compute@developer.gserviceaccount.com), qui n'a pas
// nécessairement accès à la Realtime Database ou à la signature de jetons
// (symptôme observé : "FIREBASE WARNING: Provided authentication credentials
// ... are invalid" en boucle, puis timeout/504). On utilise donc explicitement
// le compte de service dédié à l'Admin SDK Firebase, qui a déjà tous les rôles
// nécessaires (RTDB Admin, Auth Admin, Créateur de jetons du compte de
// service...), plutôt que d'accumuler des rôles au coup par coup sur le
// compte par défaut.
setGlobalOptions({
    region: "europe-west1",
    serviceAccount: "firebase-adminsdk-fbsvc@phmcfr-forms.iam.gserviceaccount.com"
});

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
    const webhookURL = process.env.DISCORD_WEBHOOK_URL || process.env.ADMIN_ACTION_WEBHOOK_URL;
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

// Secrets Google Secret Manager requis par exchangeGtawAuthCode (client OAuth
// GTA World). Firebase Functions v2 exige que CHAQUE fonction qui lit un secret
// via process.env le déclare explicitement ici — sans ça, `firebase deploy` ne
// lie pas le secret au service Cloud Run de cette fonction, même si le secret
// existe déjà dans le projet (d'où l'erreur « Les identifiants client OAuth ne
// sont pas configurés » sur une fonction qui vient d'être ajoutée).
// GTAWORLD_OAUTH_BASE_URL n'est PAS dans cette liste : ce n'est pas un secret
// existant dans Secret Manager (juste une variable optionnelle avec une valeur
// par défaut dans le code), et déclarer un secret inexistant fait échouer le
// déploiement.
const GTAW_OAUTH_SECRETS = ['GTAWORLD_CLIENT_ID', 'GTAWORLD_CLIENT_SECRET'];

// --- Delete User Account Function ---
// Allows admin to delete a Firebase Auth account by UID or email
export const deleteUserAccount = onRequest(async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));

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

    const data = req.body.data || req.body;
    const { uid, email } = data || {};

    try {
        // Verify the caller is an admin
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // Check if caller is in adminUsers list
        const adminSnapshot = await db.ref('adminUsers').once('value');
        if (!adminSnapshot.exists()) {
            res.status(403).json({ error: 'No admin list found' });
            return;
        }
        const adminUsers = adminSnapshot.val();
        const adminList = Array.isArray(adminUsers) ? adminUsers : Object.values(adminUsers || {});
        const isAdmin = adminList.some(a => 
            a === decodedToken.email || a === decodedToken.uid ||
            (typeof a === 'object' && (a.email === decodedToken.email || a.uid === decodedToken.uid))
        );
        if (!isAdmin) {
            res.status(403).json({ error: 'Caller is not an admin' });
            return;
        }

        // Delete user by UID or lookup by email
        let targetUid = uid;
        if (!targetUid && email) {
            const userRecord = await admin.auth().getUserByEmail(email);
            targetUid = userRecord.uid;
        }

        if (!targetUid) {
            res.status(400).json({ error: 'Missing uid or email' });
            return;
        }

        await admin.auth().deleteUser(targetUid);
        console.log(`Deleted Firebase Auth user: ${targetUid}`);
        res.status(200).json({ success: true, deletedUid: targetUid });
    } catch (error) {
        console.error('Error deleting user:', error);
        if (error.code === 'auth/user-not-found') {
            // User doesn't exist in Auth - consider it a success (already deleted)
            res.status(200).json({ success: true, note: 'User not found in Auth (already deleted)' });
            return;
        }
        res.status(500).json({ error: error.message });
    }
});

// Échange un code d'autorisation OAuth GTA World contre le token d'accès puis le
// profil utilisateur GTAW. Partagé entre exchangeAuthCodeForToken (onboarding) et
// gtawEmployeeLogin (connexion) pour ne pas dupliquer la logique d'appel à l'UCP.
// En cas d'échec, lève une erreur portant { status, body } prête à être renvoyée
// telle quelle par l'appelant, pour préserver les réponses HTTP existantes.
const exchangeGtawAuthCode = async ({ code, redirectUri, tokenUrl }) => {
    const clientId = process.env.GTAW_CLIENT_ID || process.env.GTAWORLD_CLIENT_ID;
    const clientSecret = process.env.GTAW_CLIENT_SECRET || process.env.GTAWORLD_CLIENT_SECRET;

    if (!code) {
        console.error('Missing code parameter');
        throw { status: 400, body: { error: 'invalid-argument', message: 'La fonction doit être appelée avec l\'argument « code ».' } };
    }

    if (!redirectUri) {
        console.error('Missing redirectUri parameter');
        throw { status: 400, body: { error: 'invalid-argument', message: 'La fonction doit être appelée avec l\'argument « redirectUri ».' } };
    }

    if (!clientId || !clientSecret) {
        console.error('Missing client credentials');
        throw { status: 500, body: { error: 'internal', message: 'Les identifiants client OAuth ne sont pas configurés.' } };
    }

    console.log('OAuth credentials loaded:', { clientId: clientId ? '✓ loaded' : '✗ missing', clientSecret: clientSecret ? '✓ loaded' : '✗ missing' });

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
        throw { status: 400, body: { error: 'Échec de la récupération du token', status: tokenResponse.status, details: tokenText.substring(0, 500) } };
    }
    let tokenData;
    try {
        tokenData = JSON.parse(tokenText);
    } catch (parseError) {
        console.error('Failed to parse token response as JSON:', parseError);
        throw { status: 500, body: { error: 'Échec du parsing du token', details: parseError.message } };
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
        throw { status: 400, body: { error: 'Échec de la récupération des données utilisateur', details: userData } };
    }
    try {
        userData = JSON.parse(userText);
    } catch (err) {
        console.error('Failed to parse user response JSON:', err);
        throw { status: 500, body: { error: 'Erreur de parsing des données utilisateur', details: err.message } };
    }

    if (!userResponse.ok) {
        throw { status: 400, body: { error: 'Échec de la récupération des données utilisateur', details: userData } };
    }

    return { tokenData, userData, baseUrl };
};

export const exchangeAuthCodeForToken = onRequest({ secrets: GTAW_OAUTH_SECRETS }, async (req, res) => {
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

    try {
        const { tokenData, userData, baseUrl } = await exchangeGtawAuthCode({ code, redirectUri, tokenUrl });

        // Le système de formulaires est réservé au personnel du PHMC (Pillbox Hill
        // Medical Center, faction id 364 sur GTA World — le DMEC en fait partie) :
        // on ne garde donc, parmi les personnages GTAW de l'utilisateur, que ceux
        // membres de cette faction. Si l'appel à /api/factions échoue, on fait
        // échouer toute la requête plutôt que de risquer de laisser passer un
        // personnage non membre (ou de bloquer tout le monde en filtrant à vide).
        const PHMC_FACTION_ID = 364;
        const allCharacters = userData?.user?.character || [];
        if (Array.isArray(allCharacters) && allCharacters.length > 0) {
            const factionsResponse = await fetch(`${baseUrl}/api/factions`, {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Accept': 'application/json',
                },
            });

            if (!factionsResponse.ok) {
                console.error('Failed to fetch GTAW factions:', factionsResponse.status);
                throw { status: 502, body: { error: 'factions-fetch-failed', message: 'Impossible de vérifier votre appartenance à la faction PHMC sur GTA World. Réessayez plus tard.' } };
            }

            let factionsData;
            try {
                factionsData = await factionsResponse.json();
            } catch (parseError) {
                console.error('Failed to parse GTAW factions response:', parseError);
                throw { status: 502, body: { error: 'factions-fetch-failed', message: 'Impossible de vérifier votre appartenance à la faction PHMC sur GTA World. Réessayez plus tard.' } };
            }

            const factionsMap = factionsData?.data || {};
            userData.user.character = allCharacters.filter((c) => {
                const info = factionsMap[String(c.id)];
                return info && Number(info.faction) === PHMC_FACTION_ID;
            });
        }

        // Détermine, parmi les personnages GTAW de l'utilisateur, lesquels sont déjà
        // liés à un compte existant (staff/phmc, staff/coroner) ou à une demande de
        // compte en attente (pendingAccountRequests), afin que le sélecteur de
        // personnage côté client puisse les désactiver. Utilise l'Admin SDK, donc
        // aucune règle de la Realtime Database n'a besoin d'être ouverte pour ça.
        let unavailableCharacterIds = [];
        try {
            const characters = userData?.user?.character || [];
            if (Array.isArray(characters) && characters.length > 0) {
                const characterIds = new Set(characters.map((c) => String(c.id)));

                const toArray = (val) => {
                    if (!val) return [];
                    return Array.isArray(val) ? val : Object.values(val);
                };

                const [phmcSnap, coronerSnap, pendingSnap] = await Promise.all([
                    db.ref('staff/phmc').once('value'),
                    db.ref('staff/coroner').once('value'),
                    db.ref('pendingAccountRequests').once('value'),
                ]);

                const usedIds = new Set();
                for (const entry of [...toArray(phmcSnap.val()), ...toArray(coronerSnap.val())]) {
                    if (entry && entry.gtawCharacterId != null) usedIds.add(String(entry.gtawCharacterId));
                }
                for (const entry of toArray(pendingSnap.val())) {
                    if (entry && entry.status === 'pending' && entry.gtawCharacterId != null) {
                        usedIds.add(String(entry.gtawCharacterId));
                    }
                }

                unavailableCharacterIds = [...characterIds].filter((id) => usedIds.has(id));
            }
        } catch (availabilityError) {
            console.error('Error computing GTAW character availability:', availabilityError);
            // Non bloquant : si cette vérification échoue, on renvoie simplement une
            // liste vide plutôt que de faire échouer toute la connexion GTAW.
        }

        res.status(200).json({ token: tokenData, user: userData, unavailableCharacterIds });
    } catch (error) {
        if (error && error.status && error.body) {
            res.status(error.status).json(error.body);
            return;
        }
        console.error("Error exchanging auth code:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
            error: 'internal',
            message: 'Une erreur interne est survenue lors de l\'échange du token',
            details: error.message
        });
    }
});

// --- GTA World Employee Login Function ---
// Connecte un employé existant via son personnage GTA World, sans email ni mot
// de passe. Ne fonctionne que si le compte a été créé via l'onboarding GTAW
// (voir OnboardingModal.js) et donc lié à un gtawUserId lors de l'approbation
// (voir PendingAccountRequests.handleApprove).
//
// Le gtawUserId n'est JAMAIS accepté depuis le client : il est dérivé côté
// serveur à partir du code d'autorisation OAuth, pour empêcher qu'un client ne
// forge une connexion sur le compte de quelqu'un d'autre en envoyant un
// gtawUserId arbitraire.
export const gtawEmployeeLogin = onRequest({ secrets: GTAW_OAUTH_SECRETS }, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));

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

    const data = req.body.data || req.body;
    const { code, redirectUri, tokenUrl } = data || {};

    try {
        const { userData } = await exchangeGtawAuthCode({ code, redirectUri, tokenUrl });
        const gtawUserId = userData?.user?.id ?? null;

        if (gtawUserId == null) {
            res.status(400).json({ error: 'invalid-user', message: 'Impossible de récupérer votre identifiant GTA World.' });
            return;
        }

        const toArray = (val) => {
            if (!val) return [];
            return Array.isArray(val) ? val : Object.values(val);
        };

        const [phmcSnap, coronerSnap] = await Promise.all([
            db.ref('staff/phmc').once('value'),
            db.ref('staff/coroner').once('value'),
        ]);

        const phmcMatch = toArray(phmcSnap.val()).find((e) => e && e.gtawUserId != null && String(e.gtawUserId) === String(gtawUserId));
        const coronerMatch = !phmcMatch
            ? toArray(coronerSnap.val()).find((e) => e && e.gtawUserId != null && String(e.gtawUserId) === String(gtawUserId))
            : null;
        const match = phmcMatch || coronerMatch;

        if (!match || !match.uid) {
            res.status(404).json({
                error: 'not-linked',
                message: 'Aucun compte PHMC-FR n\'est lié à ce personnage GTA World. Créez votre compte en vous connectant avec GTA World depuis l\'écran de création de compte.'
            });
            return;
        }

        const customToken = await admin.auth().createCustomToken(match.uid, { gtawLogin: true });
        res.status(200).json({ customToken, employeeType: phmcMatch ? 'phmc' : 'coroner' });
    } catch (error) {
        if (error && error.status && error.body) {
            res.status(error.status).json(error.body);
            return;
        }
        console.error('Error during GTA World employee login:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'internal',
            message: 'Une erreur interne est survenue lors de la connexion avec GTA World.',
            details: error.message
        });
    }
});

// --- GTA World Employee Account Creation (no password) ---
// Utilisée par PendingAccountRequests.handleApprove lorsqu'une demande de
// compte a été créée via GTA World (identité déjà vérifiée par le personnage
// choisi) : l'employé n'a pas défini de mot de passe, puisqu'il se connectera
// uniquement via gtawEmployeeLogin. Le SDK client Firebase Auth exige un mot de
// passe pour createUserWithEmailAndPassword, donc ce compte doit être créé côté
// serveur avec l'Admin SDK (admin.auth().createUser), qui n'a pas cette
// contrainte : le compte résultant n'a tout simplement aucune méthode de
// connexion par mot de passe.
export const createGtawEmployeeAccount = onRequest({}, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));

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

    const data = req.body.data || req.body;
    const { email } = data || {};

    if (!email) {
        res.status(400).json({ error: 'invalid-argument', message: 'La fonction doit être appelée avec l\'argument « email ».' });
        return;
    }

    try {
        const userRecord = await admin.auth().createUser({ email });
        res.status(200).json({ uid: userRecord.uid });
    } catch (error) {
        if (error.code === 'auth/email-already-exists') {
            res.status(409).json({ error: 'email-already-exists', message: 'Cet email est déjà utilisé.' });
            return;
        }
        console.error('Error creating GTA World employee account:', error);
        res.status(500).json({
            error: 'internal',
            message: 'Une erreur interne est survenue lors de la création du compte.',
            details: error.message
        });
    }
});