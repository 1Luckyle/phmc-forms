// src/utils/cities.js
//
// Liste des villes / quartiers avec leur code postal, pour que personne n'ait à apprendre les codes : le formulaire propose un menu de
// villes et en déduit le code postal. La liste est tenue par un admin (panneau admin → « Villes & codes postaux ») dans adminSettings/villes
// (lecture publique : elle sert aussi à l'inscription, avant connexion ; écriture admin). Tant qu'elle est vide, les formulaires gardent
// la saisie libre du code postal. Seul le code postal est enregistré sur les profils : la ville affichée en est déduite.
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

export const CITIES_PATH = 'adminSettings/villes';
export const MAX_CITIES = 500;

// Valeur de la base -> [{ nom, cp }] propre (entrées incomplètes écartées).
export const sanitizeCities = (raw) => {
    const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
    return list
        .map((entry) => ({ nom: String(entry?.nom || '').trim().slice(0, 80), cp: String(entry?.cp || '').trim().slice(0, 12) }))
        .filter((entry) => entry.nom && entry.cp);
};

// Texte « une ville par ligne » (Ville ; CP — séparateurs : ; , tabulation, ou le dernier mot si numérique) -> { cities, errors }.
export const parseCitiesText = (text) => {
    const cities = [];
    const errors = [];
    String(text || '').split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let nom = '';
        let cp = '';
        const separated = trimmed.split(/\s*[;\t]\s*|\s*,\s*(?=[^,]*$)/);
        if (separated.length >= 2) {
            cp = separated[separated.length - 1].trim();
            nom = separated.slice(0, -1).join(' ').trim();
        } else {
            const match = trimmed.match(/^(.*\S)\s+([A-Za-z0-9-]{2,12})$/);
            if (match) { nom = match[1].trim(); cp = match[2].trim(); }
        }
        if (!nom || !cp || !/^[A-Za-z0-9 -]{2,12}$/.test(cp)) { errors.push(`Ligne ${index + 1} : « ${trimmed} » (attendu : Ville ; Code postal)`); return; }
        if (cities.some((entry) => entry.nom.toLowerCase() === nom.toLowerCase())) { errors.push(`Ligne ${index + 1} : « ${nom} » est en double.`); return; }
        cities.push({ nom, cp });
    });
    return { cities: cities.slice(0, MAX_CITIES), errors };
};

export const citiesToText = (cities) => (cities || []).map((entry) => `${entry.nom} ; ${entry.cp}`).join('\n');

let current = [];
const listeners = new Set();
let started = false;

const start = () => {
    if (started) return;
    started = true;
    onValue(ref(database, CITIES_PATH), (snapshot) => {
        current = sanitizeCities(snapshot.exists() ? snapshot.val() : []);
        listeners.forEach((listener) => listener(current));
    }, () => {});
};

// Liste en vigueur, mise à jour en direct (un seul écouteur partagé).
export const useCities = () => {
    const [cities, setCities] = useState(current);
    useEffect(() => {
        start();
        listeners.add(setCities);
        setCities(current);
        return () => { listeners.delete(setCities); };
    }, []);
    return cities;
};

export const cityOfZip = (cities, zip) => {
    const wanted = String(zip || '').trim().toLowerCase();
    return wanted ? (cities || []).find((entry) => entry.cp.toLowerCase() === wanted) || null : null;
};
