// src/utils/debugSeasonDate.js
//
// Date simulée pour TESTER les effets de saison (panneau admin → Debug → « Tester les effets de
// saison »). Stockée uniquement dans le navigateur de l'admin (localStorage) : rien n'est écrit
// dans Firebase et les autres utilisateurs ne sont jamais concernés. Tant qu'une date est simulée,
// les effets de saison, l'infobulle du header et le calendrier de la santé s'y réfèrent, et le
// header affiche un badge pour revenir à la date réelle.
const KEY = 'debugSeasonDate';
const FORMAT = /^\d{4}-\d{2}-\d{2}$/;

const read = () => {
    try { return localStorage.getItem(KEY); } catch (error) { return null; }
};

// Date simulée au format AAAA-MM-JJ, ou null si on utilise la date réelle.
export const getSimulatedDateString = () => {
    const value = read();
    return value && FORMAT.test(value) ? value : null;
};

export const setSimulatedDate = (dateString) => {
    try {
        if (dateString && FORMAT.test(dateString)) localStorage.setItem(KEY, dateString);
        else localStorage.removeItem(KEY);
    } catch (error) { /* stockage indisponible : sans conséquence */ }
};

export const clearSimulatedDate = () => setSimulatedDate(null);

// Date à utiliser partout pour les effets de saison : la date simulée (midi) ou la date réelle.
export const getEffectiveDate = () => {
    const value = getSimulatedDateString();
    if (value) {
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day, 12);
        if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
};

export const toDateString = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
