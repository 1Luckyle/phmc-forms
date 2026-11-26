// src/components/Auth/DiscordCallback.js
//
// Retour de Discord (version classique du site) : route #/auth/discord/callback, atteinte via captureDiscordRedirect (utils/discordOAuth.js).
// Vérifie le « state », échange le code (discordExchange), puis selon le parcours mémorisé :
//   • 'login' (bouton « Se connecter ») : un seul compte → connexion directe ; plusieurs → choix (MainApp) ; aucun → guide de configuration ;
//   • 'onboarding' (guide de configuration) : le résultat est rangé pour DiscordAccountPanel, et le guide se rouvre à la bonne étape.
import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../firebase';
import {
    takeDiscordFlow, postJson, getDiscordRedirectUri, DISCORD_URLS, DISCORD_RESULT_KEY, DISCORD_ONBOARDING_KEY, DISCORD_LOGIN_RESULT_KEY,
} from '../../utils/discordOAuth';

const store = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* stockage indisponible */ } };

const DiscordCallback = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // Le code Discord est à usage unique : l'effet ne doit le traiter qu'une fois (double exécution de React en développement).
    const done = useRef(false);

    useEffect(() => {
        if (done.current) return;
        done.current = true;
        const params = new URLSearchParams(location.search);
        const flow = takeDiscordFlow(params.get('state') || '');
        const fail = (message, type = flow?.type) => {
            if (type === 'onboarding') {
                store(DISCORD_RESULT_KEY, { error: message, flow });
                store(DISCORD_ONBOARDING_KEY, { userType: flow?.userType || null });
            } else {
                store(DISCORD_LOGIN_RESULT_KEY, { error: message });
            }
            navigate('/', { replace: true });
        };

        if (!flow) { fail('Connexion Discord interrompue ou expirée : recommencez.', 'login'); return; }
        if (params.get('error')) { fail(params.get('error') === 'access_denied' ? 'Connexion Discord annulée.' : `Discord a refusé la connexion (${params.get('error')}).`); return; }
        const code = params.get('code');
        if (!code) { fail('Aucun code reçu de Discord.'); return; }

        (async () => {
            try {
                const data = await postJson(DISCORD_URLS.exchange, { code, redirectUri: getDiscordRedirectUri() });
                const result = { ...data, flow };
                if (flow.type === 'login') {
                    const accounts = (data.characters || []).filter((character) => character.account);
                    if (accounts.length === 1) {
                        await signInWithCustomToken(auth, accounts[0].account.customToken);
                        navigate(flow.returnTo === '/admin' ? '/admin' : '/', { replace: true });
                        return;
                    }
                    if (accounts.length > 1) {
                        store(DISCORD_LOGIN_RESULT_KEY, {
                            choices: accounts.map((character) => ({
                                customToken: character.account.customToken,
                                accountType: character.account.type,
                                label: character.account.label || `${character.firstName} ${character.lastName}`.trim(),
                                detail: character.account.detail || character.patientID || '',
                            })),
                        });
                        navigate('/', { replace: true });
                        return;
                    }
                    // Aucun compte : le guide de configuration s'ouvre, Discord déjà reconnu (pas de second passage par Discord).
                    store(DISCORD_RESULT_KEY, result);
                    store(DISCORD_LOGIN_RESULT_KEY, { notLinked: true });
                    navigate('/', { replace: true });
                    return;
                }
                store(DISCORD_RESULT_KEY, result);
                store(DISCORD_ONBOARDING_KEY, { userType: flow.userType || null });
                navigate('/', { replace: true });
            } catch (error) {
                console.error('Connexion Discord :', error);
                fail(error.message || 'Connexion Discord impossible.');
            }
        })();
    }, [location, navigate]);

    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <div className="text-center">
                <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Connexion avec Discord…</span></div>
                <p className="mt-3">Connexion avec Discord, veuillez patienter…</p>
            </div>
        </div>
    );
};

export default DiscordCallback;
