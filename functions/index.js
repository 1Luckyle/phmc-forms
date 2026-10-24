import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import fetch from "node-fetch";
import { onRequest } from "firebase-functions/v2/https";
import cors from 'cors';
import crypto from 'crypto';

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

// Journal d'activité (RTDB activityLogs, lu dans le panneau admin → « Journal d'activité »). Écriture via le SDK
// admin : les règles ne s'appliquent pas. Ne lève jamais : un échec de journal ne doit pas casser la fonction.
const logServerActivity = async ({ category = 'systeme', action, summary, details, severity = 'info', target, actorName = 'Serveur' }) => {
    try {
        const entry = {
            ts: Date.now(),
            cat: category,
            act: String(action || summary).slice(0, 80),
            msg: String(summary).slice(0, 400),
            sev: severity,
            by: { uid: 'server', name: actorName, role: 'Cloud Function', admin: false },
            src: 'server',
            env: 'cloud-functions',
        };
        if (details) entry.det = String(details).slice(0, 3000);
        if (target) entry.tgt = String(target).slice(0, 160);
        await db.ref('activityLogs').push(entry);
    } catch (error) {
        console.warn('Journal d\'activité : écriture serveur impossible.', error && error.message);
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
    await logServerActivity({
        category: 'systeme', action: 'daily_tasks', summary: 'Tâches quotidiennes exécutées (réinitialisation du bingo, nettoyage des demandes de phrases)',
        details: `Bingo :\n${bingoDetails.trim() || 'aucune action'}\n\nDemandes de phrases :\n${deletionDetails.trim() || 'aucune action'}`,
        severity: /❌/.test(`${bingoDetails}${deletionDetails}`) ? 'warning' : 'info',
    });

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
    // 'employee' (par défaut) = flux personnel PHMC/DMEC existant, inchangé
    // (filtre faction 364). 'civilian' = nouveau flux compte Civil : aucun
    // filtre de faction, un civil peut être n'importe quel personnage GTAW.
    const flowMode = data?.flowMode === 'civilian' ? 'civilian' : 'employee';

    try {
        const { tokenData, userData, baseUrl } = await exchangeGtawAuthCode({ code, redirectUri, tokenUrl });

        // Le système de formulaires employé est réservé au personnel du PHMC
        // (Pillbox Hill Medical Center, faction id 364 sur GTA World — le DMEC en
        // fait partie) : on ne garde donc, parmi les personnages GTAW de
        // l'utilisateur, que ceux membres de cette faction. Si l'appel à
        // /api/factions échoue, on fait échouer toute la requête plutôt que de
        // risquer de laisser passer un personnage non membre (ou de bloquer tout
        // le monde en filtrant à vide). Le flux Civil n'a pas cette contrainte :
        // n'importe quel personnage GTAW peut créer un compte Civil.
        const PHMC_FACTION_ID = 364;
        if (flowMode === 'employee') {
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
        }

        // Détermine, parmi les personnages GTAW de l'utilisateur, lesquels sont déjà
        // liés à un compte existant (staff/phmc, staff/coroner, et — en flux Civil —
        // civilians) ou à une demande de compte en attente (pendingAccountRequests),
        // afin que le sélecteur de personnage « intelligent » côté client sache pour
        // chacun s'il doit proposer une connexion ou une création de compte. Utilise
        // l'Admin SDK, donc aucune règle de la Realtime Database n'a besoin d'être
        // ouverte pour ça.
        //
        // Pour chaque personnage déjà lié à un compte réel (pas juste une demande en
        // attente, qui n'a pas encore de compte Firebase Auth), on prépare directement
        // un jeton de connexion Firebase (gtawResolutions[id].customToken) : le code
        // d'autorisation OAuth étant à usage unique, il est déjà consommé à ce stade
        // et le sélecteur de personnage ne peut pas relancer un second échange rien
        // que pour se connecter au personnage choisi. Le jeton est untilisable que
        // par le compte auquel il a été émis, et ce compte a été déterminé côté
        // serveur (pas depuis une entrée cliente) : émettre un jeton pour chaque
        // personnage déjà enregistré, même ceux qui ne seront pas choisis, n'ouvre
        // donc aucune brèche.
        let unavailableCharacterIds = [];
        let gtawResolutions = {};
        try {
            const characters = userData?.user?.character || [];
            if (Array.isArray(characters) && characters.length > 0) {
                const characterIds = new Set(characters.map((c) => String(c.id)));

                const toArray = (val) => {
                    if (!val) return [];
                    return Array.isArray(val) ? val : Object.values(val);
                };

                const [phmcSnap, coronerSnap, pendingSnap, civiliansSnap] = await Promise.all([
                    db.ref('staff/phmc').once('value'),
                    db.ref('staff/coroner').once('value'),
                    db.ref('pendingAccountRequests').once('value'),
                    flowMode === 'civilian' ? db.ref('civilians').once('value') : Promise.resolve(null),
                ]);

                const registryByCharId = new Map();
                for (const entry of toArray(phmcSnap.val())) {
                    if (entry && entry.gtawCharacterId != null && entry.uid) {
                        registryByCharId.set(String(entry.gtawCharacterId), { uid: entry.uid, accountType: 'phmc' });
                    }
                }
                for (const entry of toArray(coronerSnap.val())) {
                    if (entry && entry.gtawCharacterId != null && entry.uid) {
                        registryByCharId.set(String(entry.gtawCharacterId), { uid: entry.uid, accountType: 'coroner' });
                    }
                }
                if (flowMode === 'civilian' && civiliansSnap) {
                    for (const entry of toArray(civiliansSnap.val())) {
                        if (entry && entry.gtawCharacterId != null && entry.uid) {
                            registryByCharId.set(String(entry.gtawCharacterId), { uid: entry.uid, accountType: 'civilian' });
                        }
                    }
                }

                const pendingIds = new Set();
                for (const entry of toArray(pendingSnap.val())) {
                    if (entry && entry.status === 'pending' && entry.gtawCharacterId != null) {
                        pendingIds.add(String(entry.gtawCharacterId));
                    }
                }

                const usedIds = new Set([...registryByCharId.keys(), ...pendingIds]);
                unavailableCharacterIds = [...characterIds].filter((id) => usedIds.has(id));

                for (const id of characterIds) {
                    const registryEntry = registryByCharId.get(id);
                    if (registryEntry) {
                        const customToken = await admin.auth().createCustomToken(registryEntry.uid, { gtawLogin: true });
                        gtawResolutions[id] = { registered: true, accountType: registryEntry.accountType, customToken };
                    } else if (pendingIds.has(id)) {
                        gtawResolutions[id] = { registered: false, pending: true };
                    } else {
                        gtawResolutions[id] = { registered: false };
                    }
                }
            }
        } catch (availabilityError) {
            console.error('Error computing GTAW character availability:', availabilityError);
            // Non bloquant : si cette vérification échoue, on renvoie simplement une
            // liste vide plutôt que de faire échouer toute la connexion GTAW.
        }

        res.status(200).json({ token: tokenData, user: userData, unavailableCharacterIds, gtawResolutions });
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
    // gtawCharacterId : personnage précis choisi côté client (sélecteur intelligent,
    // voir Lot 2 du plan Civil). Optionnel pour préserver la compatibilité tant que
    // le client n'envoie pas encore ce champ : dans ce cas on retombe sur l'ancien
    // comportement (recherche par gtawUserId, le compte GTAW entier). Une fois
    // fourni, on recherche PRÉCISÉMENT ce personnage — nécessaire car un même
    // compte GTAW peut désormais avoir un personnage employé ET un personnage civil,
    // donc gtawUserId seul ne suffit plus à désambiguïser.
    const { code, redirectUri, tokenUrl, gtawCharacterId } = data || {};

    try {
        const { userData } = await exchangeGtawAuthCode({ code, redirectUri, tokenUrl });
        const gtawUserId = userData?.user?.id ?? null;

        if (gtawUserId == null) {
            res.status(400).json({ error: 'invalid-user', message: 'Impossible de récupérer votre identifiant GTA World.' });
            return;
        }

        // Le personnage précis doit appartenir au compte GTAW authentifié : on ne
        // fait jamais confiance à un gtawCharacterId envoyé par le client sans le
        // recouper avec les personnages réellement renvoyés par l'UCP pour ce code
        // d'autorisation, pour empêcher qu'un client ne forge une connexion sur le
        // personnage de quelqu'un d'autre.
        if (gtawCharacterId != null) {
            const ownedCharacterIds = new Set((userData?.user?.character || []).map((c) => String(c.id)));
            if (!ownedCharacterIds.has(String(gtawCharacterId))) {
                res.status(403).json({ error: 'character-not-owned', message: 'Ce personnage n\'appartient pas à votre compte GTA World.' });
                return;
            }
        }

        const toArray = (val) => {
            if (!val) return [];
            return Array.isArray(val) ? val : Object.values(val);
        };

        const [phmcSnap, coronerSnap, civiliansSnap] = await Promise.all([
            db.ref('staff/phmc').once('value'),
            db.ref('staff/coroner').once('value'),
            db.ref('civilians').once('value'),
        ]);

        const matchesIdentity = (e) => {
            if (!e) return false;
            if (gtawCharacterId != null) {
                return e.gtawCharacterId != null && String(e.gtawCharacterId) === String(gtawCharacterId);
            }
            return e.gtawUserId != null && String(e.gtawUserId) === String(gtawUserId);
        };

        const phmcMatch = toArray(phmcSnap.val()).find(matchesIdentity);
        const coronerMatch = !phmcMatch ? toArray(coronerSnap.val()).find(matchesIdentity) : null;
        const match = phmcMatch || coronerMatch;

        // Comptes Civils (recruteurs compris) de ce compte GTAW : par personnage précis si le client le
        // fournit, sinon par gtawUserId ou par l'un des personnages réellement renvoyés par l'UCP.
        const ownedIds = new Set((userData?.user?.character || []).map((c) => String(c.id)));
        const civilMatches = toArray(civiliansSnap.val()).filter((e) => {
            if (!e || !e.uid) return false;
            if (gtawCharacterId != null) return e.gtawCharacterId != null && String(e.gtawCharacterId) === String(gtawCharacterId);
            return (e.gtawUserId != null && String(e.gtawUserId) === String(gtawUserId))
                || (e.gtawCharacterId != null && ownedIds.has(String(e.gtawCharacterId)));
        });

        // Candidats dédoublonnés par uid (un Civil converti en Personnel garde le même uid).
        const candidates = [];
        const pushCandidate = (uid, accountType, label) => {
            if (uid && !candidates.some((c) => c.uid === uid)) candidates.push({ uid, accountType, label });
        };
        if (match) {
            pushCandidate(match.uid, phmcMatch ? 'phmc' : 'coroner',
                match.name || [match.firstName, match.lastName].filter(Boolean).join(' '));
        }
        for (const civil of civilMatches) {
            pushCandidate(civil.uid, 'civilian', [civil.firstName, civil.lastName].filter(Boolean).join(' ') || civil.email || '');
        }

        if (candidates.length > 1) {
            // Plusieurs comptes pour ce compte GTAW (ex. un personnage employé + un personnage civil) : le
            // code OAuth est à usage unique, on renvoie donc un jeton prêt à l'emploi par compte (tous
            // appartiennent au compte GTAW qui vient de s'authentifier) et le client fait choisir.
            const choices = [];
            for (const candidate of candidates) {
                const token = await admin.auth().createCustomToken(candidate.uid, { gtawLogin: true });
                choices.push({ customToken: token, accountType: candidate.accountType, label: candidate.label });
            }
            res.status(200).json({ choices });
            return;
        }
        if (candidates.length === 1 && candidates[0].accountType === 'civilian') {
            const civilToken = await admin.auth().createCustomToken(candidates[0].uid, { gtawLogin: true });
            res.status(200).json({ customToken: civilToken, employeeType: 'civilian' });
            return;
        }

        if (!match || !match.uid) {
            res.status(404).json({
                error: 'not-linked',
                message: 'Aucun compte PHMC-FR n\'est lié à ce personnage GTA World. Créez d\'abord votre compte avec le Guide de Configuration.'
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

// --- GTA World Civilian Account Creation (no password) ---
// Équivalent civil de createGtawEmployeeAccount, mais sans étape d'approbation
// admin : un compte Civil est en libre-service (n'importe quel joueur peut en
// créer un), contrairement à un compte Personnel/DMEC qui doit être validé.
// Renvoie directement un customToken pour que le client puisse se connecter
// et écrire son profil dans civilians/{uid} (autorisé par database.rules.json,
// qui exige auth.uid === $uid) sans repasser par une deuxième redirection OAuth.
export const createGtawCivilianAccount = onRequest({}, async (req, res) => {
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
        // L'adresse Eyefind Mail doit avoir été vérifiée (code reçu par mail,
        // voir sendEmailVerificationCode/verifyEmailCode) avant de pouvoir créer
        // le compte — filet de sécurité côté serveur : le client ne peut pas se
        // contenter de sauter l'étape de vérification dans l'interface.
        const emailKey = sanitizeEmailKey(email);
        const verificationSnap = await db.ref(`emailVerifications/${emailKey}`).once('value');
        const verification = verificationSnap.exists() ? verificationSnap.val() : null;
        if (!verification || !verification.verified || (verification.email || '').toLowerCase() !== email.toLowerCase()) {
            res.status(403).json({ error: 'email-not-verified', message: 'Cette adresse email n\'a pas été vérifiée. Veuillez d\'abord valider le code reçu par mail.' });
            return;
        }

        let userRecord;
        try {
            userRecord = await admin.auth().createUser({ email });
        } catch (createError) {
            if (createError.code !== 'auth/email-already-exists') {
                throw createError;
            }
            // Un compte Auth avec cet email existe déjà — mais s'il n'a JAMAIS
            // abouti à un vrai profil Civil (civilians/{uid}), c'est un résidu
            // orphelin d'une tentative précédente interrompue après la création
            // Auth mais avant l'écriture RTDB (coupure réseau, règle de
            // permission manquante côté client, etc.) : sans ce nettoyage, cet
            // email resterait bloqué indéfiniment, sans aucun moyen de
            // réessayer. On ne supprime JAMAIS un compte qui a un profil
            // civilians/{uid} réel.
            const existingUser = await admin.auth().getUserByEmail(email);
            const civiliansSnap = await db.ref('civilians').orderByChild('email').equalTo(email).once('value');
            if (civiliansSnap.exists()) {
                throw createError; // vrai compte existant, pas un résidu — on ne touche à rien
            }
            console.warn(`Nettoyage d'un compte Civil orphelin (${existingUser.uid}) pour ${email} avant recréation.`);
            await admin.auth().deleteUser(existingUser.uid);
            userRecord = await admin.auth().createUser({ email });
        }

        const customToken = await admin.auth().createCustomToken(userRecord.uid, { gtawLogin: true });
        // Le code de vérification a rempli son rôle, inutile de le conserver.
        await db.ref(`emailVerifications/${emailKey}`).remove();
        res.status(200).json({ uid: userRecord.uid, customToken });
    } catch (error) {
        if (error.code === 'auth/email-already-exists') {
            res.status(409).json({ error: 'email-already-exists', message: 'Cet email est déjà utilisé.' });
            return;
        }
        console.error('Error creating GTA World civilian account:', error);
        res.status(500).json({
            error: 'internal',
            message: 'Une erreur interne est survenue lors de la création du compte.',
            details: error.message
        });
    }
});

// --- Fleeca Payment Gateway (v2) ---
// Remplace les liens de paiement manuels (« connectez-vous à Fleeca et payez
// le compte X, puis collez une capture d'écran comme preuve ») par de vrais
// paiements créés via l'API marchand Fleeca : le staff clique sur un lien de
// paiement réel, et le statut (payé/échoué) revient tout seul via un webhook
// signé, sans dépendre d'une capture d'écran potentiellement falsifiable.
const FLEECA_API_BASE = 'https://fleeca.gta.world/api';
const FLEECA_SECRETS = ['FLEECA_API_KEY'];

// Crée un lien de paiement Fleeca pour le montant demandé et enregistre un
// suivi initial dans fleecaPayments/{payment_id} (mis à jour ensuite par
// fleecaWebhook). Mode 1 = paiement réel (voir doc Fleeca pour le mode 0,
// bac à sable, réservé aux tests).
export const createFleecaPayment = onRequest({ secrets: FLEECA_SECRETS }, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));

    res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const apiKey = process.env.FLEECA_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'internal', message: 'La clé API Fleeca n\'est pas configurée.' });
        return;
    }

    const data = req.body.data || req.body;
    const { description } = data || {};
    const amountNum = Number(data?.amount);

    if (!Number.isInteger(amountNum) || amountNum < 1 || amountNum > 99999999) {
        res.status(400).json({ error: 'invalid-argument', message: 'Le montant doit être un nombre entier entre 1 et 99 999 999.' });
        return;
    }

    try {
        const fleecaResponse = await fetch(`${FLEECA_API_BASE}/v2/payment`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                amount: amountNum,
                mode: 1,
                description: (description || '').toString().slice(0, 255) || undefined,
            }),
        });

        const fleecaText = await fleecaResponse.text();
        let fleecaData;
        try {
            fleecaData = JSON.parse(fleecaText);
        } catch (parseError) {
            console.error('Fleeca payment response is not JSON:', fleecaText.substring(0, 500));
            res.status(502).json({ error: 'fleeca-invalid-response', message: 'Réponse invalide de Fleeca.' });
            return;
        }

        if (!fleecaResponse.ok || !fleecaData.payment_id || !fleecaData.payment_link) {
            console.error('Fleeca payment creation failed:', fleecaResponse.status, fleecaData);
            res.status(fleecaResponse.status || 502).json({
                error: 'fleeca-payment-failed',
                message: fleecaData.message || 'Échec de la création du paiement Fleeca.',
            });
            return;
        }

        await db.ref(`fleecaPayments/${fleecaData.payment_id}`).set({
            status: 'awaiting_payment',
            amount: amountNum,
            description: description || '',
            paymentLink: fleecaData.payment_link,
            createdAt: admin.database.ServerValue.TIMESTAMP,
            updatedAt: admin.database.ServerValue.TIMESTAMP,
        });

        res.status(201).json({ payment_id: fleecaData.payment_id, payment_link: fleecaData.payment_link });
    } catch (error) {
        console.error('Error creating Fleeca payment:', error);
        res.status(500).json({ error: 'internal', message: 'Une erreur interne est survenue lors de la création du paiement.' });
    }
});

// Webhook serveur-à-serveur appelé par Fleeca après traitement d'un paiement
// (URL de callback configurée dans le Merchant Center). Ne passe PAS par
// corsHandler : c'est un appel serveur-à-serveur, pas une requête de
// navigateur — l'authenticité est garantie par la signature HMAC ci-dessous,
// pas par l'origine de la requête.
// Déclare aussi EYEFIND_API_KEY (en dur, pas via la constante EYEFIND_SECRETS
// définie plus bas dans ce fichier — une référence ici s'évaluerait avant sa
// déclaration) : ce webhook envoie un reçu de paiement par mail Eyefind.
export const fleecaWebhook = onRequest({ secrets: [...FLEECA_SECRETS, 'EYEFIND_API_KEY'] }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }

    const apiKey = process.env.FLEECA_API_KEY;
    if (!apiKey) {
        console.error('Fleeca webhook received but FLEECA_API_KEY is not configured.');
        res.status(500).send('Not configured');
        return;
    }

    // req.rawBody (fourni par le runtime Cloud Functions) contient les octets
    // exacts du corps de la requête : indispensable pour recalculer le HMAC à
    // l'identique de ce que Fleeca a signé (une ré-sérialisation de req.body en
    // JSON pourrait différer par l'ordre des clés ou les espaces et invalider
    // la comparaison).
    const rawBody = req.rawBody;
    const signatureHeader = req.get('X-Fleeca-Signature') || '';
    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', apiKey).update(rawBody).digest('hex');

    const signatureValid = signatureHeader.length === expectedSignature.length
        && crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));

    if (!signatureValid) {
        console.error('Invalid Fleeca webhook signature.');
        res.status(403).send('Invalid signature');
        return;
    }

    const payload = req.body;
    const paymentId = payload?.payment_id;
    if (!paymentId) {
        res.status(400).send('Missing payment_id');
        return;
    }

    try {
        await db.ref(`fleecaPayments/${paymentId}`).update({
            status: payload.status || 'pending',
            payerRouting: payload.payer_routing || null,
            payerName: payload.payer_name || null,
            statusReason: payload.status_reason || null,
            paidAt: payload.paid_at || null,
            updatedAt: admin.database.ServerValue.TIMESTAMP,
        });

        // Factures patient couvertes par ce paiement (voir createInvoicePayment) : réglées côté serveur.
        try {
            const paymentSnap = await db.ref(`fleecaPayments/${paymentId}`).once('value');
            await settleInvoicesOfPayment(paymentId, paymentSnap.val());
        } catch (invoiceError) {
            console.warn(`Failed to settle invoices for payment ${paymentId}:`, invoiceError);
        }

        // Reçu de paiement par mail Eyefind, en best-effort : une erreur ici
        // (ex. adresse introuvable si le nom ne suit pas exactement la
        // convention prénom.nom) ne doit jamais faire échouer la confirmation
        // du paiement auprès de Fleeca, qui réessaierait sinon inutilement le
        // webhook.
        if (payload.status === 'payment_successful' && payload.payer_name) {
            try {
                const eyefindApiKey = process.env.EYEFIND_API_KEY;
                const [payerFirstName, ...payerLastNameParts] = String(payload.payer_name).trim().split(/\s+/);
                const payerLastName = payerLastNameParts.join(' ');
                const payerAddress = deriveEyefindAddress(payerFirstName, payerLastName);
                if (eyefindApiKey && payerAddress) {
                    const amount = Number(payload.amount || 0).toLocaleString('fr-FR');
                    await sendEyefindMailInternal({
                        apiKey: eyefindApiKey,
                        to: payerAddress,
                        subject: 'Reçu de paiement - Pillbox Hill Medical Center',
                        body: `Bonjour ${payload.payer_name},\n\nNous confirmons la réception de votre paiement de ${amount}$ (${payload.description || 'services PHMC'}) via Fleeca.\n\nRéférence du paiement : ${paymentId}\n\nCordialement,\nPillbox Hill Medical Center`,
                        html: `<p>Bonjour ${payload.payer_name},</p><p>Nous confirmons la réception de votre paiement de <b>${amount}$</b> (${payload.description || 'services PHMC'}) via Fleeca.</p><p>Référence du paiement : ${paymentId}</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
                    });
                }
            } catch (mailError) {
                console.warn(`Failed to send Eyefind Mail receipt for payment ${paymentId}:`, mailError);
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Error processing Fleeca webhook:', error);
        res.status(500).send('Internal error');
    }
});

// Repli manuel de réconciliation (recommandé par la doc Fleeca en complément
// du webhook, qui peut échouer côté réseau) : interroge directement l'état du
// paiement auprès de Fleeca et met à jour notre copie locale en conséquence.
export const getFleecaPaymentStatus = onRequest({ secrets: FLEECA_SECRETS }, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));

    res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const apiKey = process.env.FLEECA_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'internal', message: 'La clé API Fleeca n\'est pas configurée.' });
        return;
    }

    const data = req.body.data || req.body;
    const paymentId = data?.payment_id;
    if (!paymentId) {
        res.status(400).json({ error: 'invalid-argument', message: 'La fonction doit être appelée avec l\'argument « payment_id ».' });
        return;
    }

    try {
        const fleecaResponse = await fetch(`${FLEECA_API_BASE}/v2/payments/${encodeURIComponent(paymentId)}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
            },
        });

        const fleecaText = await fleecaResponse.text();
        let fleecaData;
        try {
            fleecaData = JSON.parse(fleecaText);
        } catch (parseError) {
            res.status(502).json({ error: 'fleeca-invalid-response', message: 'Réponse invalide de Fleeca.' });
            return;
        }

        if (!fleecaResponse.ok || !fleecaData.data) {
            res.status(fleecaResponse.status || 502).json({
                error: 'fleeca-status-fetch-failed',
                message: fleecaData.message || 'Impossible de récupérer le statut du paiement.',
            });
            return;
        }

        const payment = fleecaData.data;
        await db.ref(`fleecaPayments/${paymentId}`).update({
            status: payment.status || 'pending',
            payerRouting: payment.payer_routing || null,
            payerName: payment.payer_name || null,
            paidAt: payment.paid_at || null,
            updatedAt: admin.database.ServerValue.TIMESTAMP,
        });

        try {
            const paymentSnap = await db.ref(`fleecaPayments/${paymentId}`).once('value');
            await settleInvoicesOfPayment(paymentId, paymentSnap.val());
        } catch (invoiceError) {
            console.warn(`Failed to settle invoices for payment ${paymentId}:`, invoiceError);
        }

        res.status(200).json({ status: payment.status, payerName: payment.payer_name || null, paidAt: payment.paid_at || null });
    } catch (error) {
        console.error('Error fetching Fleeca payment status:', error);
        res.status(500).json({ error: 'internal', message: 'Une erreur interne est survenue.' });
    }
});

// --- Eyefind Mail (messagerie RP interne au serveur) ---
// Comme pour Fleeca, la clé API reste exclusivement côté serveur (Secret
// Manager) : le navigateur ne parle qu'à cette Cloud Function, jamais
// directement à eyefind.fr — l'API Eyefind Mail est explicitement réservée à
// un usage serveur-à-serveur (voir la doc fournie par le staff du serveur).
const EYEFIND_API_URL = 'https://eyefind.fr/bot-api/mail/send';
const EYEFIND_SECRETS = ['EYEFIND_API_KEY'];

// Habillage visuel (logo + carte stylée + pied de page) appliqué
// automatiquement à TOUT mail Eyefind ayant un corps HTML (voir
// sendEyefindMailInternal plus bas) — un seul endroit à maintenir plutôt que
// de le répéter dans chaque appelant (PendingAccountRequests.js,
// EmployeeModal.js, MainApp.js, le reçu de paiement, etc.). i.imgur.com fait
// partie des domaines d'images autorisés par le nettoyeur HTML d'Eyefind
// Mail. Styles en ligne (pas de <style>/classe) car la plupart des clients
// mail ignorent ou suppriment les feuilles de style externes/internes.
const PHMC_LOGO_URL = 'https://i.imgur.com/oB47nCI.png';
const PHMC_SITE_URL = 'https://1luckyle.github.io/phmc-forms/';

// Les liens du contenu reçoivent la couleur du thème (le bleu par défaut des clients mail est illisible sur fond sombre).
const styleEmailLinks = (html) => String(html).replace(/<a\s+(?![^>]*\bstyle=)/gi, '<a style="color:#58a6ff;text-decoration:underline;" ');

// Mail sans corps HTML : on en fabrique un à partir du texte (paragraphes + retours à la ligne), pour que TOUS les mails
// aient la même présentation.
const textToEmailHtml = (text) => String(text || '')
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

const wrapEmailHtml = (rawHtml) => {
    const html = styleEmailLinks(rawHtml);
    return `
<div style="background-color:#0d1117;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background-color:#161b22;border-radius:10px;overflow:hidden;border:1px solid #30363d;">
    <tr>
      <td style="background-color:#010409;padding:24px;text-align:center;border-bottom:3px solid #2ea043;">
        <img src="${PHMC_LOGO_URL}" alt="Pillbox Hill Medical Center" style="max-width:180px;height:auto;" />
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px;color:#c9d1d9;font-size:15px;line-height:1.6;">
        ${html}
      </td>
    </tr>
    <tr>
      <td style="background-color:#010409;padding:16px 32px;text-align:center;color:#6e7681;font-size:12px;border-top:1px solid #30363d;">
        Pillbox Hill Medical Center — 76 Strawberry Ave, Los Santos<br />
        Cet email est envoyé automatiquement par l'outil PHMC-FR, merci de ne pas y répondre directement.<br />
        <a href="${PHMC_SITE_URL}" style="display:inline-block;margin-top:8px;color:#58a6ff;text-decoration:underline;font-weight:bold;">Ouvrir l'outil PHMC-FR</a>
      </td>
    </tr>
  </table>
</div>`;
};

// Adresse Eyefind Mail d'un joueur : convention prenomnom@mail.eyefind.fr
// (prénom et nom concaténés, sans séparateur — ex: rosecallahan@mail.eyefind.fr).
// Purement dérivée du nom (pas de champ dédié à stocker) : normalise les
// accents/apostrophes/espaces à l'intérieur de chaque partie du nom. Peut se
// tromper sur des noms composés inhabituels — les appelants doivent traiter
// un éventuel "recipient_not_found" comme non bloquant (voir sendReceiptMail
// plus bas), jamais faire échouer l'action principale à cause d'un mail.
//
// La regex des marques diacritiques combinantes est construite via les codes
// numériques (0x0300-0x036F) plutôt qu'un échappement \u dans le code source,
// pour éviter tout risque de caractère combinant littéral mal interprété
// selon l'encodage de l'éditeur/terminal.
const COMBINING_MARKS_REGEX = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g');

const slugifyNamePart = (part) => (part || '')
    .normalize('NFD').replace(COMBINING_MARKS_REGEX, '') // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ''); // ne garde que lettres/chiffres

const deriveEyefindAddress = (firstName, lastName) => {
    const f = slugifyNamePart(firstName);
    const l = slugifyNamePart(lastName);
    if (!f || !l) return null;
    return `${f}${l}@mail.eyefind.fr`;
};

// Clé RTDB dérivée d'un email (mêmes caractères interdits que côté client dans
// EmployeeAuthContext.js/PendingAccountRequests.js) — utilisée pour indexer
// emailVerifications/{emailKey} par adresse plutôt que par uid, puisque la
// vérification a lieu AVANT la création du compte Firebase Auth (pas encore
// d'uid à ce stade).
const sanitizeEmailKey = (email) => (email || '').toLowerCase().trim().replace(/[.#$[\]]/g, '_');

// Logique d'envoi partagée entre la Cloud Function publique sendEyefindMail
// et les envois internes (ex. reçu de paiement depuis fleecaWebhook), pour
// éviter un aller-retour HTTP inutile vers soi-même.
const sendEyefindMailInternal = async ({ apiKey, to, subject, body, html }) => {
    const eyefindResponse = await fetch(EYEFIND_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        // wrapEmailHtml habille automatiquement tout corps HTML fourni (logo +
        // carte stylée + pied de page) — les appelants n'ont qu'à fournir leur
        // contenu propre (quelques <p> / <b>), jamais le template complet.
        body: JSON.stringify({ to, subject, body, html: wrapEmailHtml(html || textToEmailHtml(body)) }),
    });

    const eyefindText = await eyefindResponse.text();
    let eyefindData;
    try {
        eyefindData = JSON.parse(eyefindText);
    } catch (parseError) {
        throw { status: 502, body: { error: 'eyefind-invalid-response', message: 'Réponse invalide d\'Eyefind Mail.' } };
    }

    if (!eyefindResponse.ok || !eyefindData.ok) {
        throw {
            status: eyefindResponse.status || 502,
            body: { error: eyefindData.error || 'eyefind-send-failed', message: eyefindData.message || 'Échec de l\'envoi du mail Eyefind.' },
        };
    }

    return eyefindData;
};

// Point d'entrée appelé par le client pour tous les mails Eyefind (compte
// approuvé, promotion, retrait, rapport enregistré par un admin...). Le
// contenu (sujet/corps) est composé côté client (voir src/utils/eyefindMail.js)
// puis simplement transmis ici avec la clé API.
export const sendEyefindMail = onRequest({ secrets: EYEFIND_SECRETS }, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));

    res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const apiKey = process.env.EYEFIND_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'internal', message: 'La clé API Eyefind Mail n\'est pas configurée.' });
        return;
    }

    const data = req.body.data || req.body;
    const { to, subject, body, html } = data || {};

    if (!to || !subject || !body) {
        res.status(400).json({ error: 'invalid-argument', message: 'Les champs « to », « subject » et « body » sont obligatoires.' });
        return;
    }

    try {
        const result = await sendEyefindMailInternal({ apiKey, to, subject, body, html });
        res.status(200).json({ message_id: result.message_id, warnings: result.warnings || [] });
    } catch (error) {
        if (error && error.status && error.body) {
            // Erreurs attendues de l'API (destinataire inexistant, doublon,
            // limite de débit...) : on les relaie telles quelles, pas une 500.
            res.status(error.status).json(error.body);
            return;
        }
        console.error('Error sending Eyefind Mail:', error);
        res.status(500).json({ error: 'internal', message: 'Une erreur interne est survenue lors de l\'envoi du mail.' });
    }
});

// --- Vérification d'adresse Eyefind Mail (obligatoire avant un compte Civil) ---
// Un civil doit prouver qu'il contrôle réellement l'adresse Eyefind Mail
// (format prenomnom@mail.eyefind.fr, créée sur https://eyefind.fr/mail.php)
// qu'il indique avant de pouvoir terminer son inscription : on lui envoie un
// code à 6 chiffres valable 15 minutes, qu'il doit ressaisir. Indexé par email
// (pas par uid) car aucun compte Firebase Auth n'existe encore à ce stade.
const EMAIL_VERIFICATION_TTL_MS = 15 * 60 * 1000;
const EYEFIND_ADDRESS_REGEX = /^[^\s@]+@mail\.eyefind\.fr$/i;

export const sendEmailVerificationCode = onRequest({ secrets: EYEFIND_SECRETS }, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));

    res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const apiKey = process.env.EYEFIND_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'internal', message: 'La clé API Eyefind Mail n\'est pas configurée.' });
        return;
    }

    const data = req.body.data || req.body;
    const email = (data?.email || '').trim();
    if (!email || !EYEFIND_ADDRESS_REGEX.test(email)) {
        res.status(400).json({ error: 'invalid-argument', message: 'Adresse Eyefind Mail invalide (format attendu : prenomnom@mail.eyefind.fr).' });
        return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const emailKey = sanitizeEmailKey(email);

    try {
        await db.ref(`emailVerifications/${emailKey}`).set({
            email,
            code,
            verified: false,
            createdAt: Date.now(),
            expiresAt: Date.now() + EMAIL_VERIFICATION_TTL_MS,
        });

        await sendEyefindMailInternal({
            apiKey,
            to: email,
            subject: 'Code de vérification - PHMC',
            body: `Votre code de vérification pour créer votre compte Civil PHMC-FR est : ${code}\n\nCe code expire dans 15 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
            html: `<p>Votre code de vérification pour créer votre compte Civil PHMC-FR est :</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#2ea043;">${code}</p><p>Ce code expire dans 15 minutes.</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
        });

        res.status(200).json({ success: true });
    } catch (error) {
        if (error && error.status && error.body) {
            res.status(error.status).json(error.body);
            return;
        }
        console.error('Error sending email verification code:', error);
        res.status(500).json({ error: 'internal', message: 'Une erreur interne est survenue lors de l\'envoi du code.' });
    }
});

export const verifyEmailCode = onRequest({}, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));

    res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
    const email = (data?.email || '').trim();
    const code = (data?.code || '').trim();
    if (!email || !code) {
        res.status(400).json({ error: 'invalid-argument', message: 'Email et code sont obligatoires.' });
        return;
    }

    const emailKey = sanitizeEmailKey(email);
    try {
        const snap = await db.ref(`emailVerifications/${emailKey}`).once('value');
        if (!snap.exists()) {
            res.status(404).json({ error: 'not-found', message: 'Aucune demande de vérification pour cet email. Redemandez un code.' });
            return;
        }
        const record = snap.val();
        if (Date.now() > record.expiresAt) {
            res.status(410).json({ error: 'expired', message: 'Ce code a expiré. Redemandez-en un nouveau.' });
            return;
        }
        if (String(record.code) !== code) {
            res.status(400).json({ error: 'invalid-code', message: 'Code incorrect.' });
            return;
        }

        await db.ref(`emailVerifications/${emailKey}`).update({ verified: true, verifiedAt: Date.now() });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error verifying email code:', error);
        res.status(500).json({ error: 'internal', message: 'Une erreur interne est survenue lors de la vérification.' });
    }
});

// --- Changement d'adresse Eyefind Mail d'un membre du personnel ---
// Un membre du personnel (sur SA fiche) ou un admin (sur n'importe quelle fiche) peut changer
// l'adresse Eyefind Mail liée à un compte, mais le changement n'est appliqué qu'après saisie d'un
// code à 6 chiffres envoyé à la NOUVELLE adresse : on prouve ainsi que la personne contrôle bien
// cette boîte (pas de changement au hasard, pas d'usurpation, pas d'adresse inexistante).
//
// Contrairement à emailVerifications (indexé par email, avant la création du compte), la demande
// est ici liée à l'uid du compte ciblé : emailChangeRequests/{uid}. Un code ne peut donc servir
// qu'à ce compte, expire au bout de 15 min et est bloqué après 5 essais ratés.
//
// Seules les adresses @mail.eyefind.fr sont modifiables : une fiche dont l'adresse est un
// ancien e-mail de connexion par mot de passe (Gmail…) est refusée, car changer cette adresse
// casserait la connexion de la personne.
const EMAIL_CHANGE_TTL_MS = 15 * 60 * 1000;
const EMAIL_CHANGE_MAX_ATTEMPTS = 5;
const EMAIL_CHANGE_MIN_INTERVAL_MS = 60 * 1000;

const setJsonCors = (req, res) => {
    res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

// Identifie l'appelant via son jeton Firebase et résout le compte visé : lui-même par défaut, un
// autre compte seulement s'il est admin (adminUIDs, même source de vérité que database.rules.json).
// Répond directement (401/403) et retourne null en cas d'échec.
const resolveStaffEmailChangeTarget = async (req, res, requestedUid) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized', message: 'Connexion requise.' });
        return null;
    }
    let decoded;
    try {
        decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch (error) {
        res.status(401).json({ error: 'unauthorized', message: 'Session invalide, reconnectez-vous.' });
        return null;
    }
    const targetUid = requestedUid || decoded.uid;
    if (targetUid !== decoded.uid) {
        const adminSnap = await db.ref(`adminUIDs/${decoded.uid}`).once('value');
        if (adminSnap.val() !== true) {
            res.status(403).json({ error: 'forbidden', message: 'Vous ne pouvez modifier que votre propre adresse.' });
            return null;
        }
    }
    return { callerUid: decoded.uid, targetUid };
};

// Retrouve l'enregistrement qui porte l'adresse d'un compte : { path, entry } — la fiche du
// personnel (staff/phmc/{clé}) en priorité, sinon le profil Civil (civilians/{uid}).
// Les listes du personnel peuvent être des tableaux OU des objets à clés poussées.
const findStaffEntryByUid = async (uid) => {
    for (const listName of ['staff/phmc', 'staff/coroner']) {
        const snap = await db.ref(listName).once('value');
        if (!snap.exists()) continue;
        const value = snap.val();
        const entries = Array.isArray(value) ? value.map((entry, index) => [String(index), entry]) : Object.entries(value);
        const found = entries.find(([, entry]) => entry && entry.uid === uid);
        if (found) return { path: `${listName}/${found[0]}`, entry: found[1] };
    }
    const civilianSnap = await db.ref(`civilians/${uid}`).once('value');
    if (civilianSnap.exists()) return { path: `civilians/${uid}`, entry: civilianSnap.val() };
    return null;
};

const authEmailExists = async (email) => {
    try {
        await admin.auth().getUserByEmail(email);
        return true;
    } catch (error) {
        if (error.code === 'auth/user-not-found') return false;
        throw error;
    }
};

export const requestStaffEmailChange = onRequest({ secrets: EYEFIND_SECRETS }, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));
    setJsonCors(req, res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const apiKey = process.env.EYEFIND_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'internal', message: 'La clé API Eyefind Mail n\'est pas configurée.' });
        return;
    }

    const data = req.body.data || req.body;
    const newEmail = (data?.newEmail || '').trim();
    if (!EYEFIND_ADDRESS_REGEX.test(newEmail)) {
        res.status(400).json({ error: 'invalid-argument', message: 'Adresse Eyefind Mail invalide (format attendu : prenomnom@mail.eyefind.fr).' });
        return;
    }

    try {
        const target = await resolveStaffEmailChangeTarget(req, res, data?.targetUid);
        if (!target) return;
        const { callerUid, targetUid } = target;

        const staff = await findStaffEntryByUid(targetUid);
        if (!staff) {
            res.status(404).json({ error: 'not-found', message: 'Aucune fiche ou aucun profil lié à ce compte.' });
            return;
        }
        const currentEmail = (staff.entry.email || '').trim();
        if (!EYEFIND_ADDRESS_REGEX.test(currentEmail)) {
            res.status(403).json({ error: 'legacy-email', message: 'Ce compte utilise un ancien e-mail de connexion (hors Eyefind Mail) : son adresse ne peut pas être modifiée ici.' });
            return;
        }
        if (currentEmail.toLowerCase() === newEmail.toLowerCase()) {
            res.status(400).json({ error: 'same-email', message: 'C\'est déjà l\'adresse actuelle.' });
            return;
        }
        if (await authEmailExists(newEmail)) {
            res.status(409).json({ error: 'email-already-exists', message: 'Cette adresse est déjà utilisée par un autre compte.' });
            return;
        }

        const requestRef = db.ref(`emailChangeRequests/${targetUid}`);
        const previous = (await requestRef.once('value')).val();
        if (previous && Date.now() - previous.createdAt < EMAIL_CHANGE_MIN_INTERVAL_MS) {
            res.status(429).json({ error: 'too-many-requests', message: 'Un code vient d\'être envoyé. Patientez une minute avant d\'en redemander un.' });
            return;
        }

        const code = String(crypto.randomInt(100000, 1000000));
        // Envoi AVANT l'enregistrement : si l'adresse n'existe pas (recipient_not_found), aucune
        // demande n'est créée et l'erreur est relayée telle quelle au client.
        await sendEyefindMailInternal({
            apiKey,
            to: newEmail,
            subject: 'Code de vérification - changement d\'adresse PHMC',
            body: `Votre code de vérification pour changer l'adresse de votre compte PHMC-FR est : ${code}\n\nCe code expire dans 15 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
            html: `<p>Votre code de vérification pour changer l'adresse de votre compte PHMC-FR est :</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#2ea043;">${code}</p><p>Ce code expire dans 15 minutes.</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
        });
        await requestRef.set({
            newEmail,
            code,
            attempts: 0,
            requestedBy: callerUid,
            createdAt: Date.now(),
            expiresAt: Date.now() + EMAIL_CHANGE_TTL_MS,
        });
        res.status(200).json({ success: true });
    } catch (error) {
        if (error && error.status && error.body) {
            res.status(error.status).json(error.body);
            return;
        }
        console.error('Error requesting staff email change:', error);
        res.status(500).json({ error: 'internal', message: 'Une erreur interne est survenue lors de l\'envoi du code.' });
    }
});

export const confirmStaffEmailChange = onRequest({ secrets: EYEFIND_SECRETS }, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));
    setJsonCors(req, res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const data = req.body.data || req.body;
    const code = String(data?.code || '').trim();
    if (!code) {
        res.status(400).json({ error: 'invalid-argument', message: 'Le code est obligatoire.' });
        return;
    }

    try {
        const target = await resolveStaffEmailChangeTarget(req, res, data?.targetUid);
        if (!target) return;
        const { targetUid } = target;

        const requestRef = db.ref(`emailChangeRequests/${targetUid}`);
        const request = (await requestRef.once('value')).val();
        if (!request) {
            res.status(404).json({ error: 'not-found', message: 'Aucune demande de changement en cours. Redemandez un code.' });
            return;
        }
        if (Date.now() > request.expiresAt) {
            await requestRef.remove();
            res.status(410).json({ error: 'expired', message: 'Ce code a expiré. Redemandez-en un nouveau.' });
            return;
        }
        if ((request.attempts || 0) >= EMAIL_CHANGE_MAX_ATTEMPTS) {
            await requestRef.remove();
            res.status(429).json({ error: 'too-many-attempts', message: 'Trop d\'essais incorrects. Redemandez un nouveau code.' });
            return;
        }
        if (String(request.code) !== code) {
            await requestRef.update({ attempts: (request.attempts || 0) + 1 });
            res.status(400).json({ error: 'invalid-code', message: 'Code incorrect.' });
            return;
        }

        const staff = await findStaffEntryByUid(targetUid);
        if (!staff) {
            res.status(404).json({ error: 'not-found', message: 'Aucune fiche ou aucun profil lié à ce compte.' });
            return;
        }
        const oldEmail = (staff.entry.email || '').trim();
        const newEmail = request.newEmail;
        // Contrôle refait au moment d'appliquer : la fiche a pu changer depuis la demande.
        if (!EYEFIND_ADDRESS_REGEX.test(oldEmail)) {
            res.status(403).json({ error: 'legacy-email', message: 'Ce compte utilise un ancien e-mail de connexion : son adresse ne peut pas être modifiée ici.' });
            return;
        }
        if (await authEmailExists(newEmail)) {
            await requestRef.remove();
            res.status(409).json({ error: 'email-already-exists', message: 'Cette adresse est déjà utilisée par un autre compte.' });
            return;
        }

        // Compte de connexion d'abord, puis fiche : si l'écriture de la fiche échoue, on remet
        // l'ancienne adresse pour ne jamais laisser la fiche et le compte désynchronisés.
        await admin.auth().updateUser(targetUid, { email: newEmail });
        try {
            await db.ref(staff.path).update({ email: newEmail });
        } catch (dbError) {
            await admin.auth().updateUser(targetUid, { email: oldEmail }).catch((revertError) => console.error('Revert of Auth email failed:', revertError));
            throw dbError;
        }

        // Profils annexes qui reprennent la même adresse (ex. Civil converti en Personnel, liste admin legacy).
        const civilianEmailRef = db.ref(`civilians/${targetUid}/email`);
        if ((await civilianEmailRef.once('value')).exists()) await civilianEmailRef.set(newEmail);
        const adminUsersSnap = await db.ref('adminUsers').once('value');
        if (adminUsersSnap.exists()) {
            const adminValue = adminUsersSnap.val();
            const adminEntries = Array.isArray(adminValue) ? adminValue.map((v, i) => [String(i), v]) : Object.entries(adminValue);
            for (const [key, value] of adminEntries) {
                if (typeof value === 'string' && value.toLowerCase() === oldEmail.toLowerCase()) {
                    await db.ref(`adminUsers/${key}`).set(newEmail);
                }
            }
        }

        await requestRef.remove();

        // Prévient l'ancienne adresse (alerte anti-usurpation) — jamais bloquant.
        try {
            const apiKey = process.env.EYEFIND_API_KEY;
            if (apiKey) {
                await sendEyefindMailInternal({
                    apiKey,
                    to: oldEmail,
                    subject: 'Adresse de votre compte PHMC modifiée',
                    body: `L'adresse de votre compte PHMC-FR a été remplacée par ${newEmail}.\n\nSi vous n'êtes pas à l'origine de ce changement, contactez immédiatement un administrateur.`,
                    html: `<p>L'adresse de votre compte PHMC-FR a été remplacée par <b>${newEmail}</b>.</p><p>Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement un administrateur.</p>`,
                });
            }
        } catch (mailError) {
            console.warn('Could not notify old address of email change:', mailError && mailError.body ? mailError.body : mailError);
        }

        res.status(200).json({ success: true, email: newEmail });
    } catch (error) {
        if (error && error.code === 'auth/email-already-exists') {
            res.status(409).json({ error: 'email-already-exists', message: 'Cette adresse est déjà utilisée par un autre compte.' });
            return;
        }
        console.error('Error confirming staff email change:', error);
        res.status(500).json({ error: 'internal', message: 'Une erreur interne est survenue lors du changement d\'adresse.' });
    }
});

// --- Factures patient (paiement des rapports médicaux civils) ---
// facturesPatients/{ID patient}/{clé du rapport} : voir src/utils/patientInvoices.js. Le statut « paye »
// n'est écrit que d'ici (webhook Fleeca / contrôle de statut), jamais par le navigateur.
// facturesEnAttente/{ID patient}/{clé} : file des factures à payer, parcourue par les deux fonctions
// planifiées (mails groupés + rappel quotidien) pour ne pas lire tout l'historique.
const INVOICE_SITE_URL = PHMC_SITE_URL;
const INVOICE_MAIL_BATCH_DELAY_MS = 5 * 60 * 1000;        // regroupement : on attend 5 min après la dernière facture
const INVOICE_REMINDER_MIN_INTERVAL_MS = 20 * 60 * 60 * 1000; // un rappel au plus par jour
const INVOICE_MAIL_MAX_FAILURES = 5;

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatInvoiceMoney = (amount) => `${Number(amount || 0).toLocaleString('fr-FR')} $`;

// Règle les factures couvertes par un paiement Fleeca confirmé (celles listées dans
// fleecaPayments/{id}/factures, créées par createInvoicePayment).
const settleInvoicesOfPayment = async (paymentId, payment) => {
    if (!payment || payment.status !== 'payment_successful') return 0;
    const covered = payment.factures || {};
    const updates = {};
    const paidAt = payment.paidAt ? new Date(payment.paidAt).getTime() || Date.now() : Date.now();
    Object.entries(covered).forEach(([invoiceId, patientNode]) => {
        updates[`facturesPatients/${patientNode}/${invoiceId}/statut`] = 'paye';
        updates[`facturesPatients/${patientNode}/${invoiceId}/payeLe`] = paidAt;
        updates[`facturesPatients/${patientNode}/${invoiceId}/paiementId`] = paymentId;
        updates[`facturesEnAttente/${patientNode}/${invoiceId}`] = null;
    });
    if (Object.keys(updates).length > 0) await db.ref().update(updates);
    if (Object.keys(covered).length > 0) {
        const loggedRef = db.ref(`fleecaPayments/${paymentId}/paiementJournalise`);
        const alreadyLogged = (await loggedRef.once('value')).val();
        if (!alreadyLogged) {
            await loggedRef.set(true);
            const patients = [...new Set(Object.values(covered))];
            await logServerActivity({
                category: 'facturation', action: 'invoices_paid', severity: 'success',
                summary: `Paiement reçu : ${Object.keys(covered).length} facture(s) réglée(s) (${patients.join(', ')})`,
                details: `Paiement Fleeca : ${paymentId}${payment.amount ? `\nMontant : ${payment.amount} $` : ''}`, target: patients[0],
            });
        }
    }
    return Object.keys(covered).length;
};

const verifyCallerToken = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized', message: 'Connexion requise.' });
        return null;
    }
    try {
        return await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch (error) {
        res.status(401).json({ error: 'unauthorized', message: 'Session invalide, reconnectez-vous.' });
        return null;
    }
};

// Crée UN lien de paiement Fleeca pour une ou plusieurs factures d'un patient. Le montant est recalculé
// ici d'après les factures enregistrées (jamais envoyé par le navigateur). Si les mêmes factures ont déjà
// un lien en attente, il est réutilisé (évite deux liens ouverts pour la même dette).
export const createInvoicePayment = onRequest({ secrets: FLEECA_SECRETS }, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));
    setJsonCors(req, res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const apiKey = process.env.FLEECA_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'internal', message: 'La clé API Fleeca n\'est pas configurée.' });
        return;
    }
    const caller = await verifyCallerToken(req, res);
    if (!caller) return;

    const data = req.body.data || req.body;
    const patientNode = String(data?.patientID || '').trim();
    const invoiceIds = Array.isArray(data?.invoiceIds) ? [...new Set(data.invoiceIds.map(String))] : [];
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(patientNode) || invoiceIds.length === 0 || invoiceIds.length > 50) {
        res.status(400).json({ error: 'invalid-argument', message: 'ID patient ou factures invalides.' });
        return;
    }

    try {
        const due = [];
        for (const invoiceId of invoiceIds) {
            const snap = await db.ref(`facturesPatients/${patientNode}/${invoiceId}`).once('value');
            const invoice = snap.val();
            if (!invoice || invoice.statut !== 'a_payer') continue;
            // Déjà payée via un lien créé depuis le formulaire ? On la règle au lieu de la refacturer.
            if (invoice.paiementId) {
                const paymentSnap = await db.ref(`fleecaPayments/${invoice.paiementId}`).once('value');
                const payment = paymentSnap.val();
                if (payment && payment.status === 'payment_successful' && Number(payment.amount) >= Number(invoice.montant || 0)) {
                    await db.ref().update({
                        [`facturesPatients/${patientNode}/${invoiceId}/statut`]: 'paye',
                        [`facturesPatients/${patientNode}/${invoiceId}/payeLe`]: Date.now(),
                        [`facturesEnAttente/${patientNode}/${invoiceId}`]: null,
                    });
                    continue;
                }
            }
            due.push({ id: invoiceId, invoice });
        }
        if (due.length === 0) {
            res.status(409).json({ error: 'nothing-due', message: 'Aucune de ces factures n\'est à payer (déjà réglées ?).' });
            return;
        }

        const total = due.reduce((sum, { invoice }) => sum + Number(invoice.montant || 0), 0);
        if (!Number.isInteger(total) || total < 1 || total > 99999999) {
            res.status(400).json({ error: 'invalid-amount', message: 'Montant total invalide.' });
            return;
        }

        // Réutilise le lien en attente si toutes les factures partagent le même et que rien n'a changé.
        const sharedPaymentId = due[0].invoice.paiementId;
        if (sharedPaymentId && due.every(({ invoice }) => invoice.paiementId === sharedPaymentId)) {
            const existingSnap = await db.ref(`fleecaPayments/${sharedPaymentId}`).once('value');
            const existing = existingSnap.val();
            const coveredIds = Object.keys(existing?.factures || {}).sort().join('|');
            if (existing && existing.status === 'awaiting_payment' && existing.paymentLink
                && Number(existing.amount) === total && coveredIds === due.map(({ id }) => id).sort().join('|')) {
                res.status(200).json({ payment_id: sharedPaymentId, payment_link: existing.paymentLink, amount: total, reused: true });
                return;
            }
        }

        const patientName = due[0].invoice.patientNom || patientNode;
        const description = (due.length === 1
            ? `Facture PHMC - ${due[0].invoice.titre || due[0].id}`
            : `Factures PHMC (${due.length}) - ${patientName}`).slice(0, 255);

        const fleecaResponse = await fetch(`${FLEECA_API_BASE}/v2/payment`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ amount: total, mode: 1, description }),
        });
        const fleecaText = await fleecaResponse.text();
        let fleecaData;
        try {
            fleecaData = JSON.parse(fleecaText);
        } catch (parseError) {
            console.error('Fleeca invoice payment response is not JSON:', fleecaText.substring(0, 500));
            res.status(502).json({ error: 'fleeca-invalid-response', message: 'Réponse invalide de Fleeca.' });
            return;
        }
        if (!fleecaResponse.ok || !fleecaData.payment_id || !fleecaData.payment_link) {
            console.error('Fleeca invoice payment creation failed:', fleecaResponse.status, fleecaData);
            res.status(fleecaResponse.status || 502).json({
                error: 'fleeca-payment-failed',
                message: fleecaData.message || 'Échec de la création du paiement Fleeca.',
            });
            return;
        }

        const covered = {};
        const updates = {};
        due.forEach(({ id }) => {
            covered[id] = patientNode;
            updates[`facturesPatients/${patientNode}/${id}/paiementId`] = fleecaData.payment_id;
            updates[`facturesPatients/${patientNode}/${id}/lienPaiement`] = fleecaData.payment_link;
        });
        updates[`fleecaPayments/${fleecaData.payment_id}`] = {
            status: 'awaiting_payment',
            amount: total,
            description,
            paymentLink: fleecaData.payment_link,
            patientID: patientNode,
            factures: covered,
            createdAt: admin.database.ServerValue.TIMESTAMP,
            updatedAt: admin.database.ServerValue.TIMESTAMP,
        };
        await db.ref().update(updates);
        await logServerActivity({
            category: 'facturation', action: 'invoice_payment_link',
            summary: `Lien de paiement créé pour le patient ${patientNode} (${Object.keys(covered).length} facture(s), ${total} $)`,
            details: `Paiement : ${fleecaData.payment_id}`, target: patientNode, actorName: caller.name || caller.email || 'Patient',
        });

        res.status(201).json({ payment_id: fleecaData.payment_id, payment_link: fleecaData.payment_link, amount: total });
    } catch (error) {
        console.error('Error creating invoice payment:', error);
        res.status(500).json({ error: 'internal', message: 'Une erreur interne est survenue lors de la création du paiement.' });
    }
});

// Adresse Eyefind d'une facture : l'e-mail saisi dans le formulaire s'il a la bonne forme, sinon
// dérivée du nom du patient (prénom + nom), comme pour le reçu de paiement.
const invoiceRecipientOf = (invoice) => {
    const email = String(invoice?.patientEmail || '').trim();
    if (EYEFIND_ADDRESS_REGEX.test(email)) return email;
    const [first, ...rest] = String(invoice?.patientNom || '').trim().split(/\s+/);
    return deriveEyefindAddress(first, rest.join(' '));
};

const sendInvoiceMail = async ({ apiKey, to, patientName, invoices, reminder }) => {
    const total = invoices.reduce((sum, invoice) => sum + Number(invoice.montant || 0), 0);
    const lines = invoices.map((invoice) => `- ${invoice.titre || 'Rapport médical'} : ${formatInvoiceMoney(invoice.montant)}`).join('\n');
    const htmlLines = invoices.map((invoice) => `<li>${escapeHtml(invoice.titre || 'Rapport médical')} — <b>${formatInvoiceMoney(invoice.montant)}</b></li>`).join('');
    const intro = reminder
        ? 'Un petit rappel : les rapports médicaux suivants établis à votre nom sont toujours à régler.'
        : 'Des rapports médicaux ont été établis à votre nom et sont à régler.';
    const subject = reminder
        ? `Rappel : ${invoices.length} paiement(s) en attente - Pillbox Hill Medical Center`
        : `${invoices.length} paiement(s) à effectuer - Pillbox Hill Medical Center`;
    await sendEyefindMailInternal({
        apiKey,
        to,
        subject,
        body: `Bonjour ${patientName || ''},\n\n${intro}\n\n${lines}\n\nTotal à payer : ${formatInvoiceMoney(total)}\n\nConnectez-vous à l'outil PHMC-FR (${INVOICE_SITE_URL}) : une fenêtre vous propose de payer chaque rapport ou tout d'un coup via Fleeca. Vous retrouvez aussi vos factures dans votre dossier patient.\n\nCordialement,\nPillbox Hill Medical Center`,
        html: `<p>Bonjour ${escapeHtml(patientName || '')},</p><p>${intro}</p><ul>${htmlLines}</ul><p>Total à payer : <b>${formatInvoiceMoney(total)}</b></p><p>Connectez-vous à <a href="${INVOICE_SITE_URL}">l'outil PHMC-FR</a> : une fenêtre vous propose de payer chaque rapport ou tout d'un coup via Fleeca. Vous retrouvez aussi vos factures dans votre dossier patient.</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
    });
};

// Lit la file des factures à payer et regroupe par patient : [{ patientNode, items: [{ id, invoice }] }].
// Nettoie au passage les entrées orphelines ou déjà réglées (paiement Fleeca confirmé).
const collectPendingInvoices = async () => {
    const queueSnap = await db.ref('facturesEnAttente').once('value');
    const queue = queueSnap.val() || {};
    const groups = [];
    const cleanup = {};
    for (const [patientNode, ids] of Object.entries(queue)) {
        const items = [];
        for (const invoiceId of Object.keys(ids || {})) {
            const snap = await db.ref(`facturesPatients/${patientNode}/${invoiceId}`).once('value');
            const invoice = snap.val();
            if (!invoice || invoice.statut !== 'a_payer') { cleanup[`facturesEnAttente/${patientNode}/${invoiceId}`] = null; continue; }
            if (invoice.paiementId) {
                const paymentSnap = await db.ref(`fleecaPayments/${invoice.paiementId}`).once('value');
                const payment = paymentSnap.val();
                if (payment && payment.status === 'payment_successful' && Number(payment.amount) >= Number(invoice.montant || 0)) {
                    cleanup[`facturesPatients/${patientNode}/${invoiceId}/statut`] = 'paye';
                    cleanup[`facturesPatients/${patientNode}/${invoiceId}/payeLe`] = Date.now();
                    cleanup[`facturesEnAttente/${patientNode}/${invoiceId}`] = null;
                    continue;
                }
            }
            items.push({ id: invoiceId, invoice });
        }
        if (items.length > 0) groups.push({ patientNode, items });
    }
    if (Object.keys(cleanup).length > 0) await db.ref().update(cleanup);
    return groups;
};

// Mails groupés : toutes les 5 minutes, un seul mail par patient pour les factures encore jamais
// notifiées, une fois la dernière d'entre elles vieille de 5 minutes (le temps qu'un médecin enchaîne
// plusieurs rapports pour le même patient).
export const invoiceMailBatcher = onSchedule({
    schedule: 'every 5 minutes',
    timeZone: 'UTC',
    secrets: ['EYEFIND_API_KEY'],
}, async () => {
    const apiKey = process.env.EYEFIND_API_KEY;
    if (!apiKey) { console.error('invoiceMailBatcher: EYEFIND_API_KEY manquante.'); return; }
    const now = Date.now();
    const groups = await collectPendingInvoices();
    for (const { patientNode, items } of groups) {
        const unsent = items.filter(({ invoice }) => !invoice.mailEnvoyeLe);
        if (unsent.length === 0) continue;
        if (unsent.some(({ invoice }) => now - Number(invoice.creeLe || 0) < INVOICE_MAIL_BATCH_DELAY_MS)) continue; // regroupement en cours
        const newest = [...unsent].sort((a, b) => Number(b.invoice.creeLe || 0) - Number(a.invoice.creeLe || 0))[0].invoice;
        const to = invoiceRecipientOf(newest);
        const updates = {};
        if (!to) {
            // Aucune adresse exploitable : inutile de réessayer, la notification à la connexion reste.
            unsent.forEach(({ id }) => { updates[`facturesPatients/${patientNode}/${id}/mailEnvoyeLe`] = now; updates[`facturesPatients/${patientNode}/${id}/mailErreur`] = 'adresse-introuvable'; });
            await db.ref().update(updates);
            continue;
        }
        try {
            // Le mail liste TOUTES les factures dues du patient (pas seulement les nouvelles) : un seul récapitulatif.
            await sendInvoiceMail({ apiKey, to, patientName: newest.patientNom, invoices: items.map(({ invoice }) => invoice), reminder: false });
            unsent.forEach(({ id }) => { updates[`facturesPatients/${patientNode}/${id}/mailEnvoyeLe`] = now; });
            await logServerActivity({ category: 'facturation', action: 'invoice_mail', summary: `Mail de facturation envoyé (patient ${patientNode}, ${items.length} facture(s))`, target: patientNode });
        } catch (error) {
            await logServerActivity({ category: 'facturation', action: 'invoice_mail_failed', severity: 'warning', summary: `Échec du mail de facturation (patient ${patientNode})`, details: String(error && (error.body || error.message) || error), target: patientNode });
            console.warn(`invoiceMailBatcher: échec d'envoi pour ${patientNode}:`, error && error.body ? error.body : error);
            unsent.forEach(({ id, invoice }) => {
                const failures = Number(invoice.mailEchecs || 0) + 1;
                updates[`facturesPatients/${patientNode}/${id}/mailEchecs`] = failures;
                if (failures >= INVOICE_MAIL_MAX_FAILURES) {
                    updates[`facturesPatients/${patientNode}/${id}/mailEnvoyeLe`] = now;
                    updates[`facturesPatients/${patientNode}/${id}/mailErreur`] = 'echecs-repetes';
                }
            });
        }
        if (Object.keys(updates).length > 0) await db.ref().update(updates);
    }
});

// Rappel quotidien (18 h, heure de Paris) : un mail groupé par patient qui a encore des factures à payer
// déjà notifiées. Au plus un rappel toutes les ~20 h par patient.
export const invoiceDailyReminder = onSchedule({
    schedule: 'every day 18:00',
    timeZone: 'Europe/Paris',
    secrets: ['EYEFIND_API_KEY'],
}, async () => {
    const apiKey = process.env.EYEFIND_API_KEY;
    if (!apiKey) { console.error('invoiceDailyReminder: EYEFIND_API_KEY manquante.'); return; }
    const now = Date.now();
    const groups = await collectPendingInvoices();
    for (const { patientNode, items } of groups) {
        const notified = items.filter(({ invoice }) => invoice.mailEnvoyeLe && !invoice.mailErreur);
        if (notified.length === 0) continue;
        const lastContact = Math.max(...notified.map(({ invoice }) => Number(invoice.dernierRappelLe || invoice.mailEnvoyeLe || 0)));
        if (now - lastContact < INVOICE_REMINDER_MIN_INTERVAL_MS) continue;
        const newest = [...notified].sort((a, b) => Number(b.invoice.creeLe || 0) - Number(a.invoice.creeLe || 0))[0].invoice;
        const to = invoiceRecipientOf(newest);
        if (!to) continue;
        try {
            await sendInvoiceMail({ apiKey, to, patientName: newest.patientNom, invoices: items.map(({ invoice }) => invoice), reminder: true });
            const updates = {};
            items.forEach(({ id }) => { updates[`facturesPatients/${patientNode}/${id}/dernierRappelLe`] = now; });
            await db.ref().update(updates);
            await logServerActivity({ category: 'facturation', action: 'invoice_reminder', summary: `Rappel de paiement envoyé (patient ${patientNode}, ${items.length} facture(s))`, target: patientNode });
        } catch (error) {
            console.warn(`invoiceDailyReminder: échec d'envoi pour ${patientNode}:`, error && error.body ? error.body : error);
        }
    }
});

// ─── Vidéosurveillance (CCTV) : droit de gestion ───────────────────────────────────────────────────────────
// Les demandes CCTV (cctvRequests) sont lues et traitées par l'ADMINISTRATION du PHMC (Directeur(trice),
// Assistant(e) de Direction, Personnel Administratif — rôle principal OU supplémentaire) et par les admins ;
// chacun lit ses propres demandes. Les règles Firebase ne peuvent pas lire le rôle d'une fiche à partir de
// l'uid : cette fonction le fait côté serveur et tient à jour le drapeau cctvGestionnaires/{uid}, que les
// règles testent. Le navigateur l'appelle à la connexion et à l'ouverture du menu (le drapeau se corrige seul
// si le rôle change).
const CCTV_MANAGER_ROLES = new Set([
    'directeur(trice)', 'directrice', 'directeur', 'director',
    'assistant(e) de direction', 'assistante de direction', 'assistant de direction',
    'personnel administratif',
]);

const hasCctvManagerRole = (member) => {
    const extra = member && member.extraRanks
        ? (Array.isArray(member.extraRanks) ? member.extraRanks : Object.values(member.extraRanks))
        : [];
    return [member && member.rank, member && member.category, ...extra]
        .some((role) => CCTV_MANAGER_ROLES.has(String(role || '').trim().toLowerCase()));
};

export const syncCctvAccess = onRequest({}, async (req, res) => {
    await new Promise((resolve) => corsHandler(req, res, resolve));
    setJsonCors(req, res);
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const caller = await verifyCallerToken(req, res);
    if (!caller) return;

    try {
        const adminSnap = await db.ref(`adminUIDs/${caller.uid}`).once('value');
        let manager = adminSnap.val() === true;
        if (!manager) {
            // Seul le personnel PHMC (staff/phmc) compte : le DMEC n'a pas ce rôle d'administration… sauf rôle cumulé.
            for (const list of ['phmc', 'coroner']) {
                const snap = await db.ref(`staff/${list}`).once('value');
                const members = Object.values(snap.val() || {});
                if (members.some((member) => member && member.uid === caller.uid && hasCctvManagerRole(member))) { manager = true; break; }
            }
        }
        const flagRef = db.ref(`cctvGestionnaires/${caller.uid}`);
        const current = (await flagRef.once('value')).val() === true;
        if (manager && !current) await flagRef.set(true);
        if (!manager && current) await flagRef.remove();
        res.status(200).json({ manager });
    } catch (error) {
        console.error('Error syncing CCTV access:', error);
        res.status(500).json({ error: 'internal', message: 'Impossible de vérifier vos droits.' });
    }
});
