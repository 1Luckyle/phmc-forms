// src/utils/places.js
//
// Lieu = adresse (texte) + ville choisie dans la liste des villes tenue par les admins (le code postal est enregistré, la ville s'en déduit : voir utils/cities.js).
import { getCitiesSnapshot, cityOfZip } from './cities';

// « 1234 Vinewood Blvd, Mission Row (90001) » ; chaque partie est omise si absente.
// `cityName` : nom saisi à la main pour une ville absente de la liste (« Autre ») ; il prime sur le nom de la liste.
export const placeWithCity = (address, zip, cityName = '') => {
    const street = String(address || '').trim();
    const code = String(zip || '').trim();
    const typed = String(cityName || '').trim();
    const city = code ? cityOfZip(getCitiesSnapshot(), code) : null;
    const name = typed || (city ? city.nom : '');
    const cityText = name ? (code ? `${name} (${code})` : name) : code;
    return [street, cityText].filter(Boolean).join(', ');
};
