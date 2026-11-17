// src/utils/contractSchedule.js
//
// Horaires d'un contrat : un sélecteur (jours + heures de début et de fin, autant de plages que nécessaire) qui compose le MÊME texte qu'avant, lisible dans le contrat :
//   « Lundi au vendredi : 08h00 – 16h00 ; Samedi : 10h00 – 14h00 ; astreintes le week-end »
// Les plages sont des segments « jours : début – fin » séparés par « ; » ; tout autre segment (ou un ancien texte libre) est conservé tel quel comme PRÉCISION. Module pur.
export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const DAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const SEPARATOR = ' ; ';
const lower = (text) => String(text).toLowerCase();
const DAY_INDEX = Object.fromEntries(DAYS.map((day, index) => [lower(day), index]));
const hours = (time) => String(time).replace(':', 'h');
const SEGMENT = /^(.+?) : (\d{1,2})h(\d{2}) – (\d{1,2})h(\d{2})$/;
const pad = (n) => String(n).padStart(2, '0');

const validTime = (time) => /^\d{1,2}:\d{2}$/.test(String(time || ''));

/** [0, 1, 2, 4] → « Lundi au mercredi, vendredi » : trois jours de suite ou plus se résument en « X au Y ». */
export const composeDays = (indexes) => {
    const sorted = [...new Set(indexes)].filter((i) => i >= 0 && i < 7).sort((a, b) => a - b);
    const parts = [];
    for (let i = 0; i < sorted.length;) {
        let end = i;
        while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
        if (end - i >= 2) parts.push(`${DAYS[sorted[i]]} au ${lower(DAYS[sorted[end]])}`);
        else for (let k = i; k <= end; k += 1) parts.push(DAYS[sorted[k]]);
        i = end + 1;
    }
    return parts.map((part, index) => (index === 0 ? part : part.charAt(0).toLowerCase() + part.slice(1))).join(', ');
};

/** Contraire de composeDays : « Lundi au mercredi, vendredi » → [0, 1, 2, 4] ; null si le texte n'est pas une liste de jours. */
export const parseDays = (text) => {
    const result = [];
    for (const token of String(text).split(',').map((item) => item.trim()).filter(Boolean)) {
        const range = /^(\S+) au (\S+)$/i.exec(token);
        if (range) {
            const from = DAY_INDEX[lower(range[1])];
            const to = DAY_INDEX[lower(range[2])];
            if (from === undefined || to === undefined || to < from) return null;
            for (let i = from; i <= to; i += 1) result.push(i);
        } else {
            const index = DAY_INDEX[lower(token)];
            if (index === undefined) return null;
            result.push(index);
        }
    }
    return result.length ? [...new Set(result)].sort((a, b) => a - b) : null;
};

/** Plage { days, from, to } → « Lundi au vendredi : 08h00 – 16h00 » ; '' si la plage est incomplète (aucun jour, heure manquante). */
export const composePlage = (plage) => (plage && plage.days && plage.days.length && validTime(plage.from) && validTime(plage.to)
    ? `${composeDays(plage.days)} : ${hours(plage.from)} – ${hours(plage.to)}` : '');

/** { plages, note } → texte du contrat. */
export const composeSchedule = ({ plages = [], note = '' } = {}) => [...plages.map(composePlage), String(note || '').trim()].filter(Boolean).join(SEPARATOR);

/** Texte enregistré → { plages: [{ days, from, to }], note } ; ce qui n'est pas une plage reconnue va dans la précision. */
export const parseSchedule = (text) => {
    const plages = [];
    const notes = [];
    String(text ?? '').split(SEPARATOR).map((segment) => segment.trim()).filter(Boolean).forEach((segment) => {
        const match = SEGMENT.exec(segment);
        const days = match ? parseDays(match[1]) : null;
        if (match && days) plages.push({ days, from: `${pad(match[2])}:${match[3]}`, to: `${pad(match[4])}:${match[5]}` });
        else notes.push(segment);
    });
    return { plages, note: notes.join(SEPARATOR) };
};
