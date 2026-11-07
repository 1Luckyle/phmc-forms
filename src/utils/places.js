// src/utils/places.js
//
// Lieu = adresse (texte) + ville choisie dans la liste des villes tenue par les admins (le code postal est enregistré, la ville s'en déduit : voir utils/cities.js).
import { getCitiesSnapshot, cityOfZip } from './cities';

// « 1234 Vinewood Blvd, Mission Row (90001) » ; chaque partie est omise si absente.
export const placeWithCity = (address, zip) => {
    const street = String(address || '').trim();
    const code = String(zip || '').trim();
    const city = code ? cityOfZip(getCitiesSnapshot(), code) : null;
    const cityText = city ? `${city.nom} (${code})` : code;
    return [street, cityText].filter(Boolean).join(', ');
};
