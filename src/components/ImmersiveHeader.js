// src/components/ImmersiveHeader.js
//
// En-tête « immersif » (alternative à l'en-tête de remerciements, choisie dans Boîte à Outils → Application) :
//   • identité et adresse de l'hôpital ;
//   • horloge du serveur en temps réel : heure du serveur (UTC) | heure locale de l'appareil, par exemple
//     « Serveur : 2026-10-24 16:03:33 UTC | Local : 18:03:33 » ;
//   • météo du serveur, découpée en trois zones qui reprennent la météo réelle de leur équivalent californien :
//     Los Santos → Los Angeles, Sandy Shores → Desert Shores, Paleto Bay → Morro Bay, avec les prévisions des
//     prochaines heures.
// La météo vient d'Open-Meteo (gratuit, sans clé, appelé depuis le navigateur : aucun coût Firebase) et est gardée
// 20 minutes dans le navigateur pour ne pas multiplier les appels.
import React, { useCallback, useEffect, useState } from 'react';
import phmcLogo from '../assets/phmc.png';
import './ImmersiveHeader.css';

const HOSPITAL_NAME = 'Pillbox Hill Medical Center';
const HOSPITAL_ADDRESS = '76 Strawberry Avenue, Pillbox Hill, Los Santos';

export const WEATHER_ZONES = [
    { key: 'los-santos', label: 'Los Santos', real: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
    { key: 'sandy-shores', label: 'Sandy Shores', real: 'Desert Shores', latitude: 33.43, longitude: -115.88 },
    { key: 'paleto-bay', label: 'Paleto Bay', real: 'Morro Bay', latitude: 35.3658, longitude: -120.8499 },
];

// Codes météo WMO (Open-Meteo) → libellé français et pictogramme.
const WEATHER_CODES = {
    0: ['Ciel dégagé', '☀️', '🌙'], 1: ['Plutôt dégagé', '🌤️', '🌙'], 2: ['Partiellement nuageux', '⛅', '☁️'], 3: ['Couvert', '☁️'],
    45: ['Brouillard', '🌫️'], 48: ['Brouillard givrant', '🌫️'],
    51: ['Bruine légère', '🌦️'], 53: ['Bruine', '🌦️'], 55: ['Bruine dense', '🌧️'], 56: ['Bruine verglaçante', '🌧️'], 57: ['Bruine verglaçante', '🌧️'],
    61: ['Pluie légère', '🌦️'], 63: ['Pluie', '🌧️'], 65: ['Forte pluie', '🌧️'], 66: ['Pluie verglaçante', '🌧️'], 67: ['Pluie verglaçante', '🌧️'],
    71: ['Faible neige', '🌨️'], 73: ['Neige', '🌨️'], 75: ['Forte neige', '❄️'], 77: ['Grésil', '🌨️'],
    80: ['Averses légères', '🌦️'], 81: ['Averses', '🌧️'], 82: ['Fortes averses', '⛈️'], 85: ['Averses de neige', '🌨️'], 86: ['Fortes averses de neige', '❄️'],
    95: ['Orage', '⛈️'], 96: ['Orage et grêle', '⛈️'], 99: ['Violent orage et grêle', '⛈️'],
};
const describeWeather = (code, isDay = 1) => {
    const entry = WEATHER_CODES[code] || ['Conditions inconnues', '❔'];
    return { label: entry[0], icon: isDay === 0 && entry[2] ? entry[2] : entry[1] };
};

const CACHE_KEY = 'immersiveHeaderWeather_v1';
const CACHE_TTL_MS = 20 * 60 * 1000;
const FORECAST_OFFSETS_HOURS = [3, 6, 9, 12];

const readCache = () => {
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        return cached && Array.isArray(cached.zones) ? cached : null;
    } catch (error) { return null; }
};

const buildUrl = () => {
    const latitudes = WEATHER_ZONES.map((zone) => zone.latitude).join(',');
    const longitudes = WEATHER_ZONES.map((zone) => zone.longitude).join(',');
    return 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${latitudes}&longitude=${longitudes}`
        + '&current=temperature_2m,weather_code,wind_speed_10m,is_day'
        + '&hourly=temperature_2m,weather_code,precipitation_probability'
        + '&forecast_days=2&timezone=UTC&wind_speed_unit=kmh';
};

// → [{ zone, current: { temperature, label, icon, wind }, forecast: [{ at, temperature, label, icon, rain }] }]
const parseZones = (payload) => {
    const list = Array.isArray(payload) ? payload : [payload];
    const now = Date.now();
    return WEATHER_ZONES.map((zone, index) => {
        const data = list[index];
        if (!data || !data.current) return { zone, current: null, forecast: [] };
        const times = (data.hourly?.time || []).map((value) => Date.parse(`${value}Z`));
        const currentHour = times.findIndex((time) => time >= now - 30 * 60 * 1000);
        const forecast = FORECAST_OFFSETS_HOURS.map((offset) => {
            const i = currentHour < 0 ? -1 : currentHour + offset;
            if (i < 0 || i >= times.length) return null;
            const weather = describeWeather(data.hourly.weather_code[i], 1);
            return {
                at: times[i], temperature: Math.round(data.hourly.temperature_2m[i]),
                label: weather.label, icon: weather.icon, rain: data.hourly.precipitation_probability?.[i] ?? null,
            };
        }).filter(Boolean);
        const weather = describeWeather(data.current.weather_code, data.current.is_day);
        return {
            zone,
            current: { temperature: Math.round(data.current.temperature_2m), label: weather.label, icon: weather.icon, wind: Math.round(data.current.wind_speed_10m) },
            forecast,
        };
    });
};

const useZoneWeather = () => {
    const [state, setState] = useState(() => {
        const cached = readCache();
        return { zones: cached ? cached.zones : null, fetchedAt: cached ? cached.fetchedAt : 0, error: false };
    });

    const refresh = useCallback(async (force = false) => {
        const cached = readCache();
        if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;
        try {
            const response = await fetch(buildUrl());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const zones = parseZones(await response.json());
            const fetchedAt = Date.now();
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt, zones })); } catch (error) { /* stockage indisponible */ }
            setState({ zones, fetchedAt, error: false });
        } catch (error) {
            console.warn('Météo indisponible :', error);
            setState((previous) => ({ ...previous, error: true }));
        }
    }, []);

    useEffect(() => {
        refresh();
        const timer = setInterval(() => refresh(), CACHE_TTL_MS);
        return () => clearInterval(timer);
    }, [refresh]);

    return { ...state, refresh };
};

const pad = (value) => String(value).padStart(2, '0');
const formatUtcDateTime = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
const formatLocalTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
const formatUtcHour = (timestamp) => `${pad(new Date(timestamp).getUTCHours())}h`;

// L'horloge a son propre composant : elle se met à jour chaque seconde sans refaire le reste de l'en-tête.
const ServerClock = () => {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="immersive-clock" title="Heure du serveur (UTC) et heure locale de votre appareil">
            <i className="fas fa-clock"></i>
            <span>
                <strong>Serveur :</strong> {formatUtcDateTime(now)} UTC <span className="immersive-clock-sep">|</span> <strong>Local :</strong> {formatLocalTime(now)}
            </span>
        </div>
    );
};

const ImmersiveHeader = () => {
    const { zones, error, refresh, fetchedAt } = useZoneWeather();
    const [showForecast, setShowForecast] = useState(false);

    return (
        <div className="immersive-header">
            <div className="immersive-top">
                <div className="immersive-identity">
                    <img src={phmcLogo} alt="" className="immersive-logo" />
                    <div>
                        <div className="immersive-name">{HOSPITAL_NAME}</div>
                        <div className="immersive-address"><i className="fas fa-location-dot"></i> {HOSPITAL_ADDRESS}</div>
                    </div>
                </div>
                <ServerClock />
            </div>

            <div className="immersive-weather">
                {zones ? zones.map(({ zone, current, forecast }) => (
                    <div key={zone.key} className="immersive-zone" title={`Météo réelle de ${zone.real} (Californie)`}>
                        <div className="immersive-zone-name">{zone.label}</div>
                        {current ? (
                            <>
                                <div className="immersive-zone-now">
                                    <span className="immersive-zone-icon">{current.icon}</span>
                                    <span className="immersive-zone-temp">{current.temperature}°C</span>
                                </div>
                                <div className="immersive-zone-label">{current.label} · {current.wind} km/h</div>
                                {showForecast && (
                                    <ul className="immersive-forecast">
                                        {forecast.map((entry) => (
                                            <li key={entry.at} title={entry.label}>
                                                <span>{formatUtcHour(entry.at)}</span> <span>{entry.icon}</span> <span>{entry.temperature}°</span>
                                                {entry.rain != null && entry.rain >= 20 && <span className="immersive-rain">{entry.rain}%</span>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        ) : <div className="immersive-zone-label">Indisponible</div>}
                    </div>
                )) : (
                    <div className="immersive-zone-label">{error ? 'Météo indisponible pour le moment.' : 'Chargement de la météo…'}</div>
                )}
            </div>

            <div className="immersive-footer">
                <button type="button" className="immersive-link" onClick={() => setShowForecast((previous) => !previous)}>
                    <i className={`fas fa-chevron-${showForecast ? 'up' : 'down'}`}></i> {showForecast ? 'Masquer les prévisions' : 'Voir les prévisions (heures serveur)'}
                </button>
                <button type="button" className="immersive-link" onClick={() => refresh(true)} title={fetchedAt ? `Dernière mise à jour : ${new Date(fetchedAt).toLocaleTimeString('fr-FR')}` : ''}>
                    <i className="fas fa-rotate"></i> Actualiser
                </button>
                <span className="immersive-credit">
                    Météo des trois zones basée sur Los Angeles, Desert Shores et Morro Bay · données <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a>
                </span>
            </div>
        </div>
    );
};

export default ImmersiveHeader;
