// src/utils/applicationForm.js
//
// Formulaires de CANDIDATURE (50 à 55) : listes de choix, fuseaux horaires, expériences professionnelles, nom composé, et reprise des anciennes candidatures
// (réponses enregistrées avant la refonte : cases à cocher, champs en texte libre) vers les champs actuels. Module pur, sans React ni Firebase.
//
// Champs actuels (liste complète : APPLICATION_FIELDS) :
//   identité        applicantTitle, applicantFirstName, applicantMiddleName, applicantLastName (→ applicantTitleAndFullName composé), applicantDOB (+ âge calculé),
//                   applicantAddress, applicantZIP (+ applicantZIPCity), applicantPhone, applicantEmail, applicantLocation, applicantCitizenship
//   formation       applicantEducationLevel, applicantSchoolName, applicantEnrollmentStart / End / Ongoing, applicantMajor, applicantLanguages (liste)
//   expérience      applicantJobs (liste d'emplois), applicantNoExperience (pour TOUS les formulaires, autres rôles EMS compris)
//   licences        applicantLicenses (liste de captures d'écran, adresses https) ; autres rôles EMS : emsPartTimeReason
//   hors RP         oocDiscord, oocTimezone, oocMedicalExperience ; paramédicaux : oocOtherCharLicenseProof, dfpSanFireLink, dfpPhmcLink, dfpLegalFactionLink
import { ageOn, parseBirthDate } from './minors';
import { titleLabel, joinFullName, splitFullName } from './patientIdentity';

export const EDUCATION_LEVELS = [
    'Diplôme d’Études Secondaires (High School Diploma)',
    'Certificat (Sous-licence ou Professionnel/Technique)',
    'Diplôme (Sous-licence ou Professionnel/Technique)',
    'Diplôme d’Associé (Associate Degree)',
    'Licence/Baccalauréat (Bachelor’s Degree)',
    'Master (Master’s Degree)',
    'Doctorat (PhD)',
];

export const CITIZENSHIP_OPTIONS = [
    'Citoyen des États-Unis',
    'Résident permanent étranger (demande de citoyenneté américaine en cours)',
    'Aucune de ces situations',
];

export const LOCATION_OPTIONS = [
    { value: 'PHMC', label: 'Pillbox Hill Medical Center (Los Santos)' },
    { value: 'PBC', label: 'Clinique PHMC de Paleto Bay (Paleto Bay)' },
];
export const locationLabel = (value) => (LOCATION_OPTIONS.find((option) => option.value === value) || LOCATION_OPTIONS[0]).label;

// Choix par défaut proposés (la saisie libre reste possible).
export const MAJOR_PRESETS = [
    'Médecine générale', 'Chirurgie', 'Soins infirmiers', 'Médecine d’urgence', 'Psychologie', 'Psychiatrie', 'Pharmacie', 'Biologie', 'Biochimie', 'Chimie',
    'Santé publique', 'Kinésithérapie', 'Radiologie / imagerie médicale', 'Médecine légale', 'Sciences forensiques', 'Secourisme / paramédical',
    'Administration / gestion', 'Comptabilité / finance', 'Droit', 'Ressources humaines', 'Informatique', 'Communication', 'Aucun domaine particulier',
];
export const NO_OTHER_LANGUAGE = 'Aucune autre langue';
export const LANGUAGE_PRESETS = [
    NO_OTHER_LANGUAGE, 'Anglais', 'Français', 'Espagnol', 'Allemand', 'Italien', 'Portugais', 'Russe', 'Arabe', 'Mandarin', 'Japonais', 'Coréen', 'Langue des signes',
];

// ───────────── Fuseaux horaires ─────────────

const FALLBACK_ZONES = [
    'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Halifax', 'America/Sao_Paulo',
    'Atlantic/Reykjavik', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Brussels', 'Europe/Zurich', 'Europe/Athens',
    'Europe/Moscow', 'Africa/Casablanca', 'Africa/Algiers', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo',
    'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

export const timezoneNames = () => {
    try {
        if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
            const list = Intl.supportedValuesOf('timeZone');
            if (Array.isArray(list) && list.length > 0) return list.includes('UTC') ? list : [...list, 'UTC'];
        }
    } catch (error) { /* navigateur ancien : liste de secours */ }
    return FALLBACK_ZONES;
};

// Décalage actuel d'un fuseau, au format « UTC+01:00 » (heure d'été comprise) ; '' si le navigateur ne connaît pas ce fuseau.
export const utcOffsetLabel = (zone, date = new Date()) => {
    for (const style of ['longOffset', 'shortOffset']) {
        try {
            const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: style }).formatToParts(date).find((entry) => entry.type === 'timeZoneName');
            const raw = String(part?.value || '');
            if (!raw) continue;
            if (raw === 'GMT' || raw === 'UTC') return 'UTC+00:00';
            const match = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(raw);
            if (match) return `UTC${match[1]}${match[2].padStart(2, '0')}:${match[3] || '00'}`;
        } catch (error) { /* essai suivant */ }
    }
    return '';
};

// « Europe/Paris » → « Europe / Paris (UTC+01:00) » ; un nom inconnu reste tel quel.
export const timezoneLabel = (zone, date = new Date()) => {
    const name = String(zone || '').trim();
    if (!name) return '';
    const offset = utcOffsetLabel(name, date);
    return `${name.replace(/_/g, ' ').replace(/\//g, ' / ')}${offset ? ` (${offset})` : ''}`;
};

export const timezoneOptions = (date = new Date()) => timezoneNames().map((zone) => ({ value: zone, label: timezoneLabel(zone, date) }));

// Le fuseau du navigateur : proposé en un clic, jamais imposé.
export const browserTimezone = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (error) { return ''; }
};

// ───────────── Expérience professionnelle ─────────────

export const MAX_JOBS = 8;
export const MAX_LICENSES = 6;
export const licensesOf = (data) => (Array.isArray(data?.applicantLicenses) ? data.applicantLicenses.filter((url) => /^https:\/\/\S+$/i.test(String(url || ''))) : []);
export const emptyJob = () => ({ company: '', role: '', start: '', left: false, end: '', duties: '', leaveReason: '' });
export const jobsOf = (data) => (Array.isArray(data?.applicantJobs) ? data.applicantJobs : []);

// Anomalies d'un emploi (messages courts, numérotés par l'appelant). Les dates sont des « AAAA-MM-JJ ».
export const jobProblems = (job) => {
    const problems = [];
    const text = (value) => String(value ?? '').trim();
    if (!text(job?.company)) problems.push("nom de l'entreprise");
    if (!text(job?.role)) problems.push('rôle occupé');
    if (!text(job?.start)) problems.push('date de début');
    if (!text(job?.duties)) problems.push('responsabilités');
    if (job?.left) {
        if (!text(job?.end)) problems.push('date de fin');
        else if (text(job?.start) && text(job.end) < text(job.start)) problems.push('date de fin postérieure au début');
    }
    return problems;
};

// « 03/2019 → 11/2022 », « depuis 03/2019 » : période d'un emploi pour l'aperçu.
const frDay = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
};
export const frDate = frDay;
export const jobPeriod = (job) => {
    if (!job?.start) return '';
    return job.left && job.end ? `du ${frDay(job.start)} au ${frDay(job.end)}` : `depuis le ${frDay(job.start)}`;
};
export const enrollmentPeriod = (data) => {
    if (!data?.applicantEnrollmentStart) return '';
    if (data.applicantEnrollmentOngoing) return `depuis le ${frDay(data.applicantEnrollmentStart)} (études en cours)`;
    return data.applicantEnrollmentEnd ? `du ${frDay(data.applicantEnrollmentStart)} au ${frDay(data.applicantEnrollmentEnd)}` : `depuis le ${frDay(data.applicantEnrollmentStart)}`;
};

// ───────────── Identité ─────────────

export const applicantFullName = (data) => joinFullName(data?.applicantFirstName, data?.applicantMiddleName, data?.applicantLastName);
// « Mme Jane Doe » : titre + nom complet, tel qu'il sert de titre au rapport, de nom du candidat et d'intitulé dans le recrutement.
export const applicantDisplayName = (data) => [titleLabel(data?.applicantTitle), applicantFullName(data)].filter(Boolean).join(' ').trim();
export const applicantAge = (data) => ageOn(data?.applicantDOB);

// Tous les champs de saisie d'une candidature (brouillon conservé sur l'appareil, champs enregistrés avec la candidature).
export const APPLICATION_FIELDS = [
    'recruitmentPosition', 'applicantTitle', 'applicantFirstName', 'applicantMiddleName', 'applicantLastName', 'applicantTitleAndFullName', 'applicantDOB',
    'applicantAddress', 'applicantZIP', 'applicantZIPCity', 'applicantPhone', 'applicantEmail', 'applicantLocation', 'applicantCitizenship',
    'applicantEducationLevel', 'applicantSchoolName', 'applicantEnrollmentStart', 'applicantEnrollmentEnd', 'applicantEnrollmentOngoing', 'applicantMajor', 'applicantLanguages',
    'applicantJobs', 'applicantNoExperience', 'applicantLicenses', 'emsPartTimeReason',
    'oocDiscord', 'oocTimezone', 'oocMedicalExperience', 'oocOtherCharLicenseProof', 'dfpSanFireLink', 'dfpPhmcLink', 'dfpLegalFactionLink',
];

// ───────────── Anciennes candidatures ─────────────

// Champs supprimés ou remplacés lors de la refonte : retirés des réponses reprises.
const LEGACY_FIELDS = [
    'genderMale', 'genderFemale', 'genderOther', 'applicantGenderOtherText', 'applicantBirthPlace', 'applicantDOBAndPlace', 'locationPHMC', 'locationPBC',
    'applicantMedicalConditions', 'citizenUS', 'citizenPermanent', 'citizenNone', 'eduHighSchool', 'eduCertificate', 'eduDiploma', 'eduAssociate', 'eduBachelor',
    'eduMaster', 'eduDoctorate', 'applicantEnrollmentTerm', 'applicantPrevEmployment', 'applicantPrevDuties', 'applicantPrevDismissalReason', 'applicantMotivationLetter',
    'oocUcpName', 'oocForumName', 'oocOtherFactionDfpLfm', 'emsLicenseLink',
];
const NAME_TITLES = { 'm.': 'Mr', mr: 'Mr', monsieur: 'Mr', mme: 'Mrs', mrs: 'Mrs', madame: 'Mrs', mlle: 'Miss', miss: 'Miss', ms: 'Ms', maître: 'Mstr', mineur: 'Mineur' };
const isNothing = (value) => { const v = String(value ?? '').trim().toLowerCase(); return !v || v === 'n/a' || v === 'na' || v === 'aucun' || v === 'aucune' || v === 'non'; };
const empty = (value) => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

/**
 * Réponses d'une candidature enregistrée AVANT la refonte → champs actuels (rien n'est écrasé : un champ déjà renseigné est conservé).
 * Idempotent : appliquée à des réponses déjà à jour, elle les rend telles quelles.
 */
export const migrateApplicationData = (source) => {
    const old = source && typeof source === 'object' ? source : {};
    const data = { ...old };

    // Nom : « Mme Jane Marie Doe » → titre + prénom / deuxième prénom / nom.
    if (empty(data.applicantFirstName) && empty(data.applicantLastName) && !empty(data.applicantTitleAndFullName)) {
        const words = String(data.applicantTitleAndFullName).trim().split(/\s+/);
        const maybe = NAME_TITLES[String(words[0]).toLowerCase()];
        if (maybe) { if (empty(data.applicantTitle)) data.applicantTitle = maybe; words.shift(); }
        const parts = splitFullName(words.join(' '));
        data.applicantFirstName = parts.first; data.applicantMiddleName = parts.middle; data.applicantLastName = parts.last;
    }
    // Date de naissance : champ unique, ou « jj/mm/aaaa à Ville ».
    if (empty(data.applicantDOB) && !empty(data.applicantDOBAndPlace)) {
        const match = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(String(data.applicantDOBAndPlace));
        const date = match ? parseBirthDate(`${match[1]}/${match[2]}/${match[3]}`) : null;
        if (date) data.applicantDOB = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    if (empty(data.applicantLocation)) data.applicantLocation = old.locationPBC && !old.locationPHMC ? 'PBC' : 'PHMC';
    if (empty(data.applicantCitizenship)) {
        if (old.citizenUS) data.applicantCitizenship = CITIZENSHIP_OPTIONS[0];
        else if (old.citizenPermanent) data.applicantCitizenship = CITIZENSHIP_OPTIONS[1];
        else if (old.citizenNone) data.applicantCitizenship = CITIZENSHIP_OPTIONS[2];
    }
    if (empty(data.applicantEducationLevel)) {
        const byField = { eduDoctorate: 6, eduMaster: 5, eduBachelor: 4, eduAssociate: 3, eduDiploma: 2, eduCertificate: 1, eduHighSchool: 0 };
        const found = Object.keys(byField).find((field) => old[field]);
        if (found) data.applicantEducationLevel = EDUCATION_LEVELS[byField[found]];
    }
    // Période de scolarité « jj/mm/aaaa à jj/mm/aaaa » → deux dates, quand elles sont lisibles.
    if (empty(data.applicantEnrollmentStart) && !empty(data.applicantEnrollmentTerm)) {
        const dates = [...String(data.applicantEnrollmentTerm).matchAll(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/g)]
            .map((m) => parseBirthDate(`${m[1]}/${m[2]}/${m[3]}`)).filter(Boolean)
            .map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        if (dates[0]) data.applicantEnrollmentStart = dates[0];
        if (dates[1]) data.applicantEnrollmentEnd = dates[1];
    }
    if (typeof data.applicantLanguages === 'string') {
        data.applicantLanguages = isNothing(data.applicantLanguages) ? [NO_OTHER_LANGUAGE] : data.applicantLanguages.split(/[,;/]+|\s+et\s+/i).map((l) => l.trim()).filter(Boolean);
    }
    // Emploi précédent (texte libre) → un emploi à compléter ; « N/A » → aucune expérience.
    if (empty(data.applicantJobs) && Object.prototype.hasOwnProperty.call(old, 'applicantPrevEmployment')) {
        if (isNothing(old.applicantPrevEmployment)) { if (empty(data.applicantNoExperience)) data.applicantNoExperience = true; }
        else data.applicantJobs = [{ ...emptyJob(), company: String(old.applicantPrevEmployment).trim(), duties: isNothing(old.applicantPrevDuties) ? '' : String(old.applicantPrevDuties).trim(), leaveReason: isNothing(old.applicantPrevDismissalReason) ? '' : String(old.applicantPrevDismissalReason).trim() }];
    }
    // Ancien lien de licence (paramédical) → première capture de la rubrique « Licences ».
    if (empty(data.applicantLicenses)) data.applicantLicenses = /^https:\/\/\S+$/i.test(String(old.emsLicenseLink || '').trim()) ? [String(old.emsLicenseLink).trim()] : [];
    // Fuseau : seulement un vrai nom de fuseau est conservé (l'ancien texte libre « EST », « UTC+1 » ne l'est pas).
    if (!empty(data.oocTimezone) && !timezoneNames().includes(data.oocTimezone)) data.oocTimezone = '';
    if (Object.keys(old).length > 0) data.applicantTitleAndFullName = applicantDisplayName(data) || data.applicantTitleAndFullName || '';

    LEGACY_FIELDS.forEach((field) => { delete data[field]; });
    return data;
};
