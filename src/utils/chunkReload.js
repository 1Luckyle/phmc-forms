// Après un déploiement, un onglet resté ouvert (ou un index.html en cache) réclame encore des fichiers de l'ancienne
// version (« 6465.44ff285c.chunk.js ») qui n'existent plus : le chargement paresseux d'un formulaire échoue
// (ChunkLoadError). La seule vraie réparation est de recharger la page pour récupérer la nouvelle version.

const RELOAD_KEY = 'phmc:chunk-reload-at';
const RELOAD_COOLDOWN_MS = 60 * 1000;

export const isChunkLoadError = (error) => {
    if (!error) return false;
    const text = `${error.name || ''} ${error.message || error}`;
    return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(text);
};

// Recharge la page une seule fois par minute (évite une boucle si le serveur est réellement indisponible).
// Renvoie true quand un rechargement a été déclenché.
export const reloadOnceForNewVersion = (now = Date.now()) => {
    try {
        const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
        if (last && now - last < RELOAD_COOLDOWN_MS) return false;
        window.sessionStorage.setItem(RELOAD_KEY, String(now));
    } catch (e) {
        return false; // stockage inaccessible : mieux vaut afficher le message que risquer une boucle
    }
    window.location.reload();
    return true;
};
