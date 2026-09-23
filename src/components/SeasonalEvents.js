import React from 'react';
// New Imports for Events
import christmas from '../assets/christmas.png';
import easter from '../assets/easteregg.png';
import phmcEaster from '../assets/easter.png';
import halloween from '../assets/halloween-rip.png';
import Default from '../assets/Generic.png';
import HalloweenEffect from './HalloweenEffect';
import AmbientSeasonalEffect from './AmbientSeasonalEffect';
import Snowfall from 'react-snowfall';

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

// Calendrier des saisons/évènements de l'année. Les images PHMC dédiées
// n'existent que pour Noël, Pâques et Halloween (voir seasonalImages
// ci-dessus) ; les autres périodes gardent l'image générique mais reçoivent
// un effet de particules ambiant (voir seasonalEvents ci-dessous) pour qu'il
// se passe toujours quelque chose, quelle que soit la date. L'ordre des
// vérifications compte : chaque période est traitée du plus spécifique
// (jours précis) au plus large, pour ne jamais se faire écraser par une
// plage plus large qui la contiendrait.
function getSeason() {
    const now = new Date();
    const month = now.getMonth(); // 0 = janvier ... 11 = décembre
    const day = now.getDate();

    // Halloween (1er au 31 octobre)
    if (month === 9) {
        return "Halloween";
    }
    // Poisson d'avril (1er-2 avril)
    if (month === 3 && day >= 1 && day <= 2) {
        return "AprilFools";
    }
    // Pâques (3-30 avril)
    if (month === 3 && day >= 3 && day <= 30) {
        return "Easter";
    }
    // Noël (1er décembre au 1er janvier)
    if ((month === 11 && day >= 1) || (month === 0 && day <= 1)) {
        return "Christmas";
    }
    // Nouvel An (2-6 janvier)
    if (month === 0 && day >= 2 && day <= 6) {
        return "NewYear";
    }
    // Saint-Patrick (15-17 mars)
    if (month === 2 && day >= 15 && day <= 17) {
        return "StPatrick";
    }
    // Saint-Valentin (10-14 février)
    if (month === 1 && day >= 10 && day <= 14) {
        return "Valentine";
    }
    // Hiver (reste de janvier, février, début mars)
    if (month === 0 || month === 1 || (month === 2 && day <= 14)) {
        return "Winter";
    }
    // Printemps (mi-mars à mai, hors Poisson d'avril/Pâques déjà couverts)
    if ((month === 2 && day >= 18) || month === 4) {
        return "Spring";
    }
    // Été (juin à août)
    if (month === 5 || month === 6 || month === 7) {
        return "Summer";
    }
    // Automne / rentrée (septembre, novembre — octobre est Halloween)
    if (month === 8 || month === 10) {
        return "Autumn";
    }

    return "Default"; // Filet de sécurité, ne devrait normalement jamais être atteint
}

function seasonalEvents({ imageType, season: seasonOverride }) {
    const season = seasonOverride || getSeason();
    const imageSource = seasonalImages[imageType]?.[season] || seasonalImages[imageType]?.Default;


    let className = '';
    let effect = null;
    //console.log(imageSource, className, season); // Debugging line to check values

    if (season === "AprilFools") {
        className = 'april-fools';
    } else if (season === "Easter") {
        className = 'easter-bounce';
    } else if (season === "Halloween") {
        effect = <HalloweenEffect />;
    } else if (season === "Christmas") {
        effect = <Snowfall snowflakeCount={75} />;
    } else if (season === "NewYear") {
        effect = <AmbientSeasonalEffect emoji="🎉" count={40} size={26} radius={[8, 18]} />;
    } else if (season === "Valentine") {
        effect = <AmbientSeasonalEffect emoji="❤️" count={35} size={24} radius={[8, 16]} />;
    } else if (season === "StPatrick") {
        effect = <AmbientSeasonalEffect emoji="☘️" count={35} size={26} radius={[8, 18]} />;
    } else if (season === "Winter") {
        effect = <Snowfall snowflakeCount={40} />;
    } else if (season === "Spring") {
        effect = <AmbientSeasonalEffect emoji="🌸" count={30} size={24} radius={[8, 16]} />;
    } else if (season === "Summer") {
        effect = <AmbientSeasonalEffect emoji="☀️" count={15} size={28} radius={[10, 20]} />;
    } else if (season === "Autumn") {
        effect = <AmbientSeasonalEffect emoji="🍁" count={35} size={26} radius={[8, 18]} />;
    }

    return { imageSource, className, season, effect };
}
export default seasonalEvents;