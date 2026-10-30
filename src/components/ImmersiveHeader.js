// src/components/ImmersiveHeader.js
//
// En-tête « immersif » (alternative à l'en-tête de remerciements, choisie dans Boîte à Outils → Application) :
//   • identité et adresse de l'hôpital ;
//   • horloge du serveur en temps réel : heure du serveur (UTC) | heure locale de l'appareil, par exemple
//     « Serveur : 2026-10-24 16:03:33 UTC | Local : 18:03:33 » ;
//   • météo du serveur, découpée en trois zones qui reprennent la météo réelle de leur équivalent californien :
//     Los Santos → Los Angeles, Sandy Shores → Desert Shores, Paleto Bay → Morro Bay. Elle est présentée comme
//     l'application météo du téléphone du jeu : température du moment, conditions, maximum / minimum du jour,
//     prévisions horaires puis sur 3 jours.
// La météo vient d'Open-Meteo (gratuit, sans clé, appelé depuis le navigateur : aucun coût Firebase) et est gardée
// 10 minutes dans le navigateur pour ne pas multiplier les appels.
//
// DÉCALAGE HORAIRE : les développeurs du serveur indiquent appliquer un décalage fixe de 6 h entre l'heure du jeu et la météo
// en direct de Los Angeles. On prend donc la météo de Los Angeles prévue 6 h après l'instant présent (les relevés faits dans le jeu
// collaient mieux à +5/+6 h qu'à +7 h, l'écart réel avec Los Angeles). Le décalage est FIXE (il ne suit pas le changement d'heure
// de Los Angeles) ; pour le modifier, changer GAME_WEATHER_SHIFT_HOURS. Les températures sont interpolées entre deux heures de prévision.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import phmcLogo from '../assets/phmc.png';
import { PHMC_PHONE, PHMC_DISCORD_URL } from '../constants/contact';
import './ImmersiveHeader.css';

const HOSPITAL_NAME = 'Pillbox Hill Medical Center';
const HOSPITAL_ADDRESS = '76 Strawberry Avenue, Pillbox Hill, Los Santos';

export const WEATHER_ZONES = [
    { key: 'los-santos', label: 'Los Santos', real: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
    { key: 'sandy-shores', label: 'Sandy Shores', real: 'Desert Shores', latitude: 33.43, longitude: -115.88 },
    { key: 'paleto-bay', label: 'Paleto Bay', real: 'Morro Bay', latitude: 35.3658, longitude: -120.8499 },
];

// Codes météo WMO (Open-Meteo) → libellé français et pictogramme (jour, nuit).
const WEATHER_CODES = {
    0: ['Ensoleillé', '☀️', '🌙'], 1: ['Plutôt dégagé', '🌤️', '🌙'], 2: ['Partiellement nuageux', '⛅', '☁️'], 3: ['Couvert', '☁️'],
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

const CACHE_KEY = 'immersiveHeaderWeather_v4';
const CACHE_TTL_MS = 10 * 60 * 1000;
const HOURS_AFTER_NOW = 5;

const readCache = () => {
    try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        return cached && cached.payload ? cached : null;
    } catch (error) { return null; }
};

const buildUrl = () => {
    const latitudes = WEATHER_ZONES.map((zone) => zone.latitude).join(',');
    const longitudes = WEATHER_ZONES.map((zone) => zone.longitude).join(',');
    // Heures en UTC (instants sans ambiguïté) : de la veille à 4 jours, pour couvrir « maintenant + 7 h » et 3 journées
    // californiennes complètes.
    return 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${latitudes}&longitude=${longitudes}`
        + '&hourly=temperature_2m,weather_code,wind_speed_10m,is_day'
        + '&past_days=1&forecast_days=4&timezone=UTC&wind_speed_unit=kmh';
};

const pad = (value) => String(value).padStart(2, '0');
const LA_TIME_ZONE = 'America/Los_Angeles';

// Décalage fixe appliqué par le jeu entre son horloge et la météo de Los Angeles (voir l'en-tête du fichier).
export const GAME_WEATHER_SHIFT_HOURS = 6;
const GAME_WEATHER_SHIFT_MS = GAME_WEATHER_SHIFT_HOURS * 60 * 60 * 1000;

const laDateKey = (instant) => new Intl.DateTimeFormat('en-CA', { timeZone: LA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
const laHour = (instant) => Number(new Intl.DateTimeFormat('en-US', { timeZone: LA_TIME_ZONE, hourCycle: 'h23', hour: '2-digit' }).format(new Date(instant)));

const dayLabel = (instant, index) => {
    if (index === 0) return "Aujourd'hui";
    return new Date(instant).toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' });
};

// Valeur interpolée linéairement entre les deux heures de prévision qui encadrent `instant` (null hors des données).
const interpolate = (times, values, instant) => {
    for (let i = 0; i < times.length - 1; i += 1) {
        if (times[i] <= instant && instant < times[i + 1]) {
            const ratio = (instant - times[i]) / (times[i + 1] - times[i]);
            return values[i] + (values[i + 1] - values[i]) * ratio;
        }
    }
    return null;
};
const hourIndexAt = (times, instant) => {
    let found = -1;
    times.forEach((time, i) => { if (time <= instant) found = i; });
    return found;
};

// Charge brute Open-Meteo → un objet par zone, calculé à l'instant `now` (« maintenant », les heures suivantes et les jours
// avancent seuls, sans nouvel appel réseau).
//   → [{ zone, now: { temperature, label, icon, wind }, max, min, hourly: [{ label, temperature, icon }],
//        days: [{ label, icon, min, max }] } | { zone, now: null }]
export const parseZones = (payload, now = Date.now()) => {
    const list = Array.isArray(payload) ? payload : [payload];
    // Instant de Los Angeles dont on affiche la météo : maintenant + le décalage du jeu.
    const target = now + GAME_WEATHER_SHIFT_MS;
    return WEATHER_ZONES.map((zone, index) => {
        const data = list[index];
        if (!data || !data.hourly) return { zone, now: null, hourly: [], days: [] };
        const times = data.hourly.time.map((value) => Date.parse(`${value}Z`));

        const at = (instant) => {
            const temperature = interpolate(times, data.hourly.temperature_2m, instant);
            const i = hourIndexAt(times, instant);
            if (temperature == null || i < 0) return null;
            const weather = describeWeather(data.hourly.weather_code[i], data.hourly.is_day?.[i] ?? 1);
            const wind = interpolate(times, data.hourly.wind_speed_10m, instant);
            return { temperature: Math.round(temperature), label: weather.label, icon: weather.icon, wind: Math.round(wind ?? 0) };
        };

        const current = at(target);
        if (!current) return { zone, now: null, hourly: [], days: [] };

        // Prévisions horaires : « Maint. » puis les heures suivantes, étiquetées en HEURE SERVEUR (l'heure d'horloge est la même).
        const hourly = [{ label: 'Maint.', temperature: current.temperature, icon: current.icon }];
        for (let k = 1; k <= HOURS_AFTER_NOW; k += 1) {
            const entry = at(target + k * 60 * 60 * 1000);
            if (!entry) break;
            hourly.push({ label: pad(new Date(now + k * 60 * 60 * 1000).getUTCHours()), temperature: entry.temperature, icon: entry.icon });
        }

        // 3 jours : chaque jour du serveur correspond à la journée californienne de même date (minimum / maximum de la journée).
        const byDay = new Map();
        times.forEach((time, i) => {
            const key = laDateKey(time);
            if (!byDay.has(key)) byDay.set(key, []);
            byDay.get(key).push({ time, temperature: data.hourly.temperature_2m[i], code: data.hourly.weather_code[i] });
        });
        const days = [0, 1, 2].map((offset) => {
            const key = laDateKey(target + offset * 24 * 60 * 60 * 1000);
            const entries = byDay.get(key) || [];
            if (entries.length === 0) return null;
            const temperatures = entries.map((entry) => entry.temperature);
            const afternoon = entries.find((entry) => laHour(entry.time) === 14) || entries[Math.floor(entries.length / 2)];
            return {
                label: dayLabel(now + offset * 24 * 60 * 60 * 1000, offset),
                icon: describeWeather(afternoon.code, 1).icon,
                min: Math.round(Math.min(...temperatures)),
                max: Math.round(Math.max(...temperatures)),
            };
        }).filter(Boolean);

        return { zone, now: current, max: days[0]?.max, min: days[0]?.min, hourly, days };
    });
};

const useZoneWeather = () => {
    const [state, setState] = useState(() => {
        const cached = readCache();
        return { payload: cached ? cached.payload : null, fetchedAt: cached ? cached.fetchedAt : 0, error: false };
    });
    // Recalcule « maintenant / +1 h… » chaque minute à partir des données déjà reçues.
    const [tick, setTick] = useState(0);

    const refresh = useCallback(async (force = false) => {
        const cached = readCache();
        if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;
        try {
            const response = await fetch(buildUrl());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const fetchedAt = Date.now();
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt, payload })); } catch (error) { /* stockage indisponible */ }
            setState({ payload, fetchedAt, error: false });
        } catch (error) {
            console.warn('Météo indisponible :', error);
            setState((previous) => ({ ...previous, error: true }));
        }
    }, []);

    useEffect(() => {
        refresh();
        const timer = setInterval(() => refresh(), CACHE_TTL_MS);
        const minuteTimer = setInterval(() => setTick((value) => value + 1), 60 * 1000);
        return () => { clearInterval(timer); clearInterval(minuteTimer); };
    }, [refresh]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const zones = useMemo(() => (state.payload ? parseZones(state.payload, Date.now()) : null), [state.payload, tick]);
    return { zones, fetchedAt: state.fetchedAt, error: state.error, refresh };
};

const formatUtcDateTime = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
const formatLocalTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

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
                        <div className="immersive-contact">
                            <span><i className="fas fa-phone"></i> {PHMC_PHONE}</span>
                            <a href={PHMC_DISCORD_URL} target="_blank" rel="noopener noreferrer" title="Ouvrir le portail de contact du PHMC FR (Discord)"><i className="fab fa-discord"></i> Portail de contact</a>
                        </div>
                    </div>
                </div>
                <ServerClock />
            </div>

            <div className="immersive-weather">
                {zones ? zones.map((entry) => (
                    <div key={entry.zone.key} className="immersive-zone" title={`${entry.zone.real} (Californie)`}>
                        <div className="immersive-zone-name">{entry.zone.label}</div>
                        {entry.now ? (
                            <>
                                <div className="immersive-zone-now">
                                    <span className="immersive-zone-icon">{entry.now.icon}</span>
                                    <span className="immersive-zone-temp">{entry.now.temperature}°</span>
                                    <span className="immersive-zone-label">{entry.now.label}</span>
                                </div>
                                <div className="immersive-zone-label">Max. {entry.max}° · Min. {entry.min}° · {entry.now.wind} km/h</div>
                                {showForecast && (
                                    <>
                                        <div className="immersive-section-title"><i className="fas fa-clock"></i> Prévisions horaires <span>(heures serveur)</span></div>
                                        <ul className="immersive-hourly">
                                            {entry.hourly.map((hour, index) => (
                                                <li key={`${hour.label}-${index}`}>
                                                    <span className="immersive-hour-label">{hour.label}</span>
                                                    <span>{hour.icon}</span>
                                                    <span className="immersive-hour-temp">{hour.temperature}°</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="immersive-section-title"><i className="fas fa-calendar-days"></i> Prévisions sur 3 jours</div>
                                        <ul className="immersive-days">
                                            {entry.days.map((day) => (
                                                <li key={day.label}>
                                                    <span className="immersive-day-label">{day.label}</span>
                                                    <span>{day.icon}</span>
                                                    <span className="immersive-day-min">{day.min}°</span>
                                                    <span className="immersive-day-max">{day.max}°</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
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
                    <i className={`fas fa-chevron-${showForecast ? 'up' : 'down'}`}></i> {showForecast ? 'Masquer les prévisions' : 'Voir les prévisions'}
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
