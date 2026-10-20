import React from 'react';
// New Imports for Events
import christmas from '../assets/christmas.png';
import easter from '../assets/easteregg.png';
import phmcEaster from '../assets/easter.png';
import halloween from '../assets/halloween-rip.png';
import Default from '../assets/Generic.png';
import HalloweenEffect from './HalloweenEffect';
import HealthEventEffect from './HealthEventEffect';
import AmbientSeasonalEffect from './AmbientSeasonalEffect';
import ChocolateEggEffect from './ChocolateEggEffect';
import Snowfall from 'react-snowfall';
import { getEffectEvents } from '../data/awarenessEvents';
import { getEffectiveDate } from '../utils/debugSeasonDate';

const seasonalImages = {
    deathReport: {
        Christmas: christmas,
        AprilFools: easter,
        Easter: phmcEaster,
        Halloween: halloween,
        Default: Default, // Added Default
    },
    civilianPaperwork: {
        Christmas: christmas,
        AprilFools: easter,
        Easter: phmcEaster,
        Halloween: halloween,
        Default: Default, // Added Default
    },
};

// Les effets de saison suivent désormais le CALENDRIER DE LA SANTÉ (data/awarenessEvents.js).
// Ordre de priorité, du plus fort au plus faible :
//   1. Jours de fête précis (ci-dessous) : Halloween, Noël, Nouvel An, 1er avril, Saint-Valentin ;
//   2. événements de santé d'un jour ou d'une semaine (ex. 10 octobre, Santé mentale) ;
//   3. événements de santé d'un mois entier — s'il y en a plusieurs (septembre : Septembre en Or,
//      prostate, ovaire), leurs rubans tombent ensemble (voir HealthEventEffect) ;
//   4. rien de tout ça : l'ancien effet de saison sert de « fond » (Pâques en avril, Noël en
//      décembre, hiver en février, été en juin et août). Ces périodes creuses sont celles où le
//      calendrier de la santé n'a pas d'événement long.
// Saint-Patrick n'a plus d'effet : mars est couvert par Mars Bleu et l'endométriose.
const FESTIVE_DAYS = [
    { season: 'Halloween', matches: (month, day) => month === 9 && day === 31 },
    { season: 'Christmas', matches: (month, day) => month === 11 && (day === 24 || day === 25) },
    { season: 'NewYear', matches: (month, day) => (month === 11 && day === 31) || (month === 0 && day === 1) },
    { season: 'AprilFools', matches: (month, day) => month === 3 && day === 1 },
    { season: 'Valentine', matches: (month, day) => month === 1 && day === 14 },
];

// Effet de fond quand ni jour de fête ni événement de santé ne s'applique.
function getBackgroundSeason(month) { // 0 = janvier ... 11 = décembre
    if (month === 3) return 'Easter';
    if (month === 11) return 'Christmas';
    if (month === 0 || month === 1) return 'Winter';
    if (month === 2 || month === 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    return 'Autumn'; // septembre-novembre (en pratique couverts par un événement de santé)
}

// Saison retenue pour une date : { season, healthEvents }. `season` vaut 'HealthEvent' quand c'est
// le calendrier de la santé qui pilote l'effet (healthEvents = événements à afficher).
// Sans argument, la date est celle du jour — ou la date SIMULÉE depuis le panneau admin (Debug).
export function resolveSeason(date = getEffectiveDate()) {
    const month = date.getMonth();
    const day = date.getDate();

    const festive = FESTIVE_DAYS.find((entry) => entry.matches(month, day));
    if (festive) return { season: festive.season, healthEvents: [] };

    const { events } = getEffectEvents(date);
    if (events.length > 0) return { season: 'HealthEvent', healthEvents: events };

    return { season: getBackgroundSeason(month), healthEvents: [] };
}

function seasonalEvents({ imageType, season: seasonOverride }) {
    const resolved = seasonOverride ? { season: seasonOverride, healthEvents: [] } : resolveSeason();
    const { season, healthEvents } = resolved;
    const imageSource = seasonalImages[imageType]?.[season] || seasonalImages[imageType]?.Default;


    let className = '';
    let effect = null;

    // Nombre de particules volontairement modeste : au-delà d'une quarantaine
    // de flocons/éléments animés en simultané sur un canvas, on observe des
    // ralentissements sensibles sur les machines moins puissantes.
    if (season === "AprilFools") {
        className = 'april-fools';
        effect = <AmbientSeasonalEffect emojis={['🐟', '🐠']} count={22} size={26} radius={[8, 18]} />;
    } else if (season === "Easter") {
        className = 'easter-bounce';
        effect = <ChocolateEggEffect />;
    } else if (season === "Halloween") {
        effect = <HalloweenEffect />;
    } else if (season === "HealthEvent") {
        effect = <HealthEventEffect events={healthEvents} />;
    } else if (season === "Christmas") {
        effect = <Snowfall snowflakeCount={40} />;
    } else if (season === "NewYear") {
        effect = <AmbientSeasonalEffect emoji="🎉" count={22} size={26} radius={[8, 18]} />;
    } else if (season === "Valentine") {
        effect = <AmbientSeasonalEffect emoji="❤️" count={18} size={24} radius={[8, 16]} />;
    } else if (season === "Winter") {
        effect = <Snowfall snowflakeCount={22} />;
    } else if (season === "Spring") {
        effect = <AmbientSeasonalEffect emoji="🌸" count={18} size={24} radius={[8, 16]} />;
    } else if (season === "Summer") {
        effect = <AmbientSeasonalEffect emoji="☀️" count={10} size={28} radius={[10, 20]} />;
    } else if (season === "Autumn") {
        effect = <AmbientSeasonalEffect emoji="🍁" count={18} size={26} radius={[8, 18]} />;
    }

    return { imageSource, className, season, effect, healthEvents };
}
export default seasonalEvents;
