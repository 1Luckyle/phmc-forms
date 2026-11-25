// src/clinical/gameplay.js
//
// Transposition du SYSTÈME DE SANTÉ EN JEU (GTA World, mise à jour de novembre 2026 : forum-fr.gta.world, sujet « Système de santé ») dans le vocabulaire des
// rapports. Le jeu parle en PV et en commandes (hors RP) ; les rapports restent en RP : gravité clinique, hémorragie, gestes, convalescence, heures de prise.
//   • gravité d'une blessure : légère, modérée, grave, critique (balle à la tête ou au cou, lame au cou : critique) ;
//   • effets : boiterie, course impossible, visée qui tremble (membres) → attelle pour un membre blessé à partir de « modérée » ;
//   • hémorragie (balle ou lame) : arrêtée par un garrot ou un pansement ;
//   • convalescence : pas de course pendant 20 minutes après une sortie d'hôpital ou une blessure grave ;
//   • ordonnance : 1 à 6 prises par jour à heures fixes, 1 à 30 jours, 30 unités au plus ; rendez-vous de suivi dans les 14 jours.
// Fonctions pures (pas d'import du moteur : engine.js et les générateurs l'importent).

// ───────────── Gravité des blessures ─────────────
export const INJURY_GRADES = [
    { value: 'Light', label: 'Légère', rank: 1 },
    { value: 'Moderate', label: 'Modérée', rank: 2 },
    { value: 'Severe', label: 'Grave', rank: 3 },
    { value: 'Critical', label: 'Critique', rank: 4 },
];
const GRADE_BY_VALUE = Object.fromEntries(INJURY_GRADES.map((grade) => [grade.value, grade]));
export const gradeLabel = (value) => GRADE_BY_VALUE[value]?.label || '';
export const gradeRank = (value) => GRADE_BY_VALUE[value]?.rank || 0;

// Zones du corps (clinical/injuries.js) regroupées comme dans le jeu : tête, cou, torse, abdomen, bras, jambe.
const HEAD = ['cuir_chevelu', 'front', 'visage', 'oeil', 'oreille', 'nez', 'bouche', 'machoire'];
const NECK = ['cou'];
export const UPPER_LIMB = ['epaule', 'bras', 'coude', 'avant_bras', 'poignet', 'main', 'doigts'];
export const LOWER_LIMB = ['cuisse', 'genou', 'jambe', 'cheville', 'pied', 'orteils'];
export const isHeadOrNeck = (region) => HEAD.includes(region) || NECK.includes(region);
export const isLimb = (region) => UPPER_LIMB.includes(region) || LOWER_LIMB.includes(region);

const VEST_PRECISION = 'Impact arrêté par le gilet pare-balles';
export const GUNSHOT_VEST_PRECISION = VEST_PRECISION;
const has = (row, ...labels) => (Array.isArray(row?.precisions) ? row.precisions : []).some((precision) => labels.includes(precision));
const multiple = (row) => row?.count && row.count !== '1';

/**
 * Gravité PROPOSÉE d'une ligne de blessure (motif + zone + précisions), selon les règles du jeu :
 * balle à la tête ou au cou, lame au cou → critique ; balle, ou plusieurs coups sur une zone touchée par balle → grave ; impact arrêté par le gilet → légère.
 */
export const suggestedGrade = (conditionId, row = {}) => {
    const region = row.region || '';
    switch (conditionId) {
        case 'plaie_arme_feu':
            if (has(row, VEST_PRECISION)) return 'Light';
            if (isHeadOrNeck(region)) return 'Critical';
            if (row.trajectory === 'Graze' && !multiple(row)) return 'Moderate';
            return 'Severe';
        case 'plaie_arme_blanche':
            if (NECK.includes(region)) return 'Critical';
            return multiple(row) || has(row, 'Plaie pénétrante', 'Atteinte vasculaire suspectée') ? 'Severe' : 'Moderate';
        case 'brulure':
            if (has(row, '3e degré', '2e degré profond', 'Circonférentielle')) return 'Severe';
            return has(row, '1er degré') ? 'Light' : 'Moderate';
        case 'trauma_cranien':
            return has(row, 'Perte de connaissance', 'Embarrure suspectée') ? 'Severe' : 'Moderate';
        case 'fracture_ouverte':
        case 'polytraumatisme':
            return 'Severe';
        case 'fracture_fermee':
            return has(row, 'Déplacée', 'Comminutive', 'Pouls distal absent') ? 'Severe' : 'Moderate';
        case 'entorse_luxation':
            return has(row, 'Déformation', 'Appui impossible') ? 'Moderate' : 'Light';
        case 'plaie_superficielle':
            return 'Light';
        case 'plaie_profonde':
            return NECK.includes(region) ? 'Severe' : 'Moderate';
        case 'trauma_thoracique':
        case 'trauma_abdominal':
            return has(row, 'Plaie pénétrante', 'Volet costal', 'Défense abdominale') ? 'Severe' : 'Moderate';
        case 'hemorragie_externe':
            return has(row, 'Artériel (pulsatile)') ? 'Severe' : 'Moderate';
        default:
            return '';
    }
};

/** Gravité retenue d'une ligne : celle choisie par le soignant, sinon celle proposée. */
export const gradeOfRow = (row) => (GRADE_BY_VALUE[row?.grade] ? row.grade : suggestedGrade(row?.conditionId, row));

const rowsOf = (formData) => (Array.isArray(formData?.injuryDetails) ? formData.injuryDetails : [])
    .filter((row) => row && row.conditionId && (Array.isArray(formData?.clinicalConditions) ? formData.clinicalConditions.includes(row.conditionId) : true));

/** Gravité la plus élevée des blessures renseignées ('' si aucune). */
export const worstGrade = (formData) => rowsOf(formData).map(gradeOfRow).reduce((worst, grade) => (gradeRank(grade) > gradeRank(worst) ? grade : worst), '');

// ───────────── Hémorragie ─────────────
export const BLEEDING_STATES = [
    { value: 'None', label: 'Aucune hémorragie' },
    { value: 'Active', label: 'Hémorragie active' },
    { value: 'Controlled', label: 'Hémorragie contrôlée' },
];
export const BLEEDING_CONTROLS = [
    { value: 'Tourniquet', label: 'Garrot' },
    { value: 'Dressing', label: 'Pansement compressif / hémostatique' },
    { value: 'Bandage', label: 'Bandage' },
    { value: 'SelfCompression', label: 'Compression par le patient' },
    { value: 'Spontaneous', label: 'Arrêt spontané' },
];
const BLEEDING_PRECISIONS = ['Saignement actif'];
/** Hémorragie active : déclarée, ou précisée sur une blessure (« Saignement actif ») sans être déclarée contrôlée. */
export const hasActiveBleeding = (formData) => formData?.bleedingState === 'Active'
    || (formData?.bleedingState !== 'Controlled' && formData?.bleedingState !== 'None' && rowsOf(formData).some((row) => has(row, ...BLEEDING_PRECISIONS)));

// ───────────── Gestes et convalescence ─────────────
const REGION_WORD = { epaule: 'épaule', bras: 'bras', coude: 'coude', avant_bras: 'avant-bras', poignet: 'poignet', main: 'main', doigts: 'doigts', cuisse: 'cuisse', genou: 'genou', jambe: 'jambe', cheville: 'cheville', pied: 'pied', orteils: 'orteils' };
const SIDE_WORD = { Right: 'droit(e)', Left: 'gauche', Both: 'des deux côtés' };
const limbPhrase = (row) => `${REGION_WORD[row.region] || row.region}${SIDE_WORD[row.side] ? ` ${SIDE_WORD[row.side]}` : ''}`;

/** Membres blessés à partir de « modérée » (le jeu y fait boiter ou trembler la visée) : à immobiliser par une attelle. */
export const limbsToSplint = (formData) => [...new Set(rowsOf(formData).filter((row) => isLimb(row.region) && gradeRank(gradeOfRow(row)) >= 2).map(limbPhrase))];

/** Convalescence (pas de course pendant 20 minutes) : blessure grave ou critique, ou sortie d'une hospitalisation. */
export const CONVALESCENCE_MINUTES = 20;
const HOSPITAL_DESTINATIONS = ['Ward', 'OperatingRoom', 'RecoveryRoom'];
export const needsConvalescence = (formData) => formData?.careDeceased !== 'Yes'
    && (gradeRank(worstGrade(formData)) >= 3 || HOSPITAL_DESTINATIONS.includes(formData?.dischargeDestination));
export const CONVALESCENCE_TEXT = `Convalescence : ni course ni effort soutenu pendant les ${CONVALESCENCE_MINUTES} minutes qui suivent la sortie ; reprise progressive de la marche.`;

/** Gestes proposés par Pilou d'après la gravité et l'hémorragie (texte de la procédure). */
export const gameplayCareSteps = (formData) => {
    const steps = [];
    if (hasActiveBleeding(formData)) {
        const limbBleeding = rowsOf(formData).some((row) => isLimb(row.region) && has(row, ...BLEEDING_PRECISIONS));
        steps.push(limbBleeding
            ? 'Arrêt de l\'hémorragie : garrot à la racine du membre (heure de pose notée), puis pansement compressif.'
            : 'Arrêt de l\'hémorragie : compression directe et pansement compressif hémostatique.');
    }
    const limbs = limbsToSplint(formData);
    if (limbs.length) steps.push(`Immobilisation par attelle : ${limbs.join(', ')}.`);
    if (worstGrade(formData) === 'Critical') steps.push('Blessure critique (tête ou cou) : urgence vitale, prise en charge immédiate en salle de déchocage.');
    return steps;
};

/** Soins systématiques proposés en plus de ceux des motifs (constants/careFormOptions.js : ROUTINE_CARE). */
export const gameplayRoutineCare = (formData) => {
    const care = [];
    if (hasActiveBleeding(formData)) care.push(rowsOf(formData).some((row) => isLimb(row.region) && has(row, ...BLEEDING_PRECISIONS)) ? 'Tourniquet' : 'HemostaticDressing');
    if (limbsToSplint(formData).length) care.push('Splint');
    return care;
};

// ───────────── Ordonnances (heures de prise du jeu) ─────────────
// Heures de prise de l'application Santé, selon le nombre de prises par jour.
export const INTAKE_HOURS = {
    1: ['9 h'],
    2: ['9 h', '21 h'],
    3: ['8 h', '14 h', '20 h'],
    4: ['8 h', '12 h', '16 h', '20 h'],
    5: ['8 h', '11 h', '14 h', '17 h', '20 h'],
    6: ['8 h', '10 h 30', '13 h', '15 h 30', '18 h', '20 h 30'],
};
export const PRESCRIPTION_LIMITS = { maxPerDay: 6, maxDays: 30, maxQuantity: 30 };
const joinFr = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`);

/** « à 8 h, 14 h et 20 h » pour 3 prises par jour ; '' au-delà de 6 prises. */
export const intakeHoursPhrase = (count) => {
    const hours = INTAKE_HOURS[Math.max(1, Number(count) || 1)];
    return hours ? `à ${joinFr(hours)}` : '';
};

/** Nombre d'unités délivrées sur la durée (prises par jour × jours) ; 0 si la durée n'est pas indiquée. */
export const prescriptionQuantity = (entry) => {
    const days = Math.floor(Number(entry?.days)) || 0;
    return days > 0 ? Math.max(1, Number(entry?.count) || 1) * days : 0;
};

/** Contrôles propres à l'ordonnance délivrée en pharmacie : 6 prises par jour, 30 jours et 30 unités au plus. */
export const prescriptionLimitMessages = (entry) => {
    if (!entry?.prescribed) return [];
    const messages = [];
    const count = Math.max(1, Number(entry.count) || 1);
    const days = Math.floor(Number(entry.days)) || 0;
    if (count > PRESCRIPTION_LIMITS.maxPerDay) messages.push({ level: 'warn', text: `Ordonnance : ${PRESCRIPTION_LIMITS.maxPerDay} prises par jour au plus (heures de prise de 8 h à 20 h 30).` });
    if (days > PRESCRIPTION_LIMITS.maxDays) messages.push({ level: 'warn', text: `Ordonnance : ${PRESCRIPTION_LIMITS.maxDays} jours au plus ; prévoir un renouvellement pour la suite.` });
    const quantity = prescriptionQuantity(entry);
    if (quantity > PRESCRIPTION_LIMITS.maxQuantity) messages.push({ level: 'info', text: `${quantity} unités sur la durée : une ordonnance en délivre ${PRESCRIPTION_LIMITS.maxQuantity} au plus, prévoir un renouvellement.` });
    return messages;
};

// ───────────── Rendez-vous de suivi ─────────────
export const FOLLOWUP_MAX_DAYS = 14;
// Suivi « recommandé » ou « procédure élective » : un rendez-vous se programme (le suivi « au besoin » n'en a pas).
export const FOLLOWUP_WITH_APPOINTMENT = ['Recommended', 'Electiveprocedure'];
export const needsFollowupAppointment = (formData) => formData?.careDeceased !== 'Yes' && FOLLOWUP_WITH_APPOINTMENT.includes(formData?.followup);
