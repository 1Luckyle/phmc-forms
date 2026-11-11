// src/phmc-bbcode-generators/shared/bodyMeasures.js
//
// « 75 kg / 178 cm » : poids et taille du dossier médical, avec leurs unités (une valeur illisible est reprise telle que saisie).
import { parseWeightKg, parseHeightCm } from '../../clinical/engine';

const raw = (value) => String(value ?? '').trim();

export const bodyMeasuresText = (weight, height, empty = 'Non renseigné') => {
    const kg = parseWeightKg(weight);
    const cm = parseHeightCm(height);
    const parts = [
        kg ? `${String(kg).replace('.', ',')} kg` : raw(weight),
        cm ? `${cm} cm` : raw(height),
    ].filter(Boolean);
    return parts.length ? parts.join(' / ') : empty;
};
