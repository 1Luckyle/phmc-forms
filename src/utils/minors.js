// src/utils/minors.js
//
// Patients mineurs : un consentement ou un refus de soins ne peut pas être signé seul par un patient de moins de 18 ans. C'est son représentant légal
// (parent ou tuteur) qui signe, sauf mineur émancipé. Module pur, partagé par les formulaires (divulgation du dossier, AMA) et par la validation.
export const MAJORITY_AGE = 18;

export const GUARDIAN_RELATIONS = ['Mère', 'Père', 'Tuteur légal', 'Tutrice légale', 'Autre titulaire de l\'autorité parentale'];

// « AAAA-MM-JJ » (champ date) ou « JJ/MM/AAAA » (saisie libre) → Date locale ; null si illisible.
export const parseBirthDate = (value) => {
    const raw = String(value ?? '').trim();
    let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    let year; let month; let day;
    if (match) [, year, month, day] = match;
    else {
        match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw);
        if (!match) return null;
        [, day, month, year] = match;
    }
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) || date.getMonth() !== Number(month) - 1 ? null : date;
};

// Âge en années révolues à la date `now` ; null si la date de naissance est illisible ou dans le futur.
export const ageOn = (birthDate, now = Date.now()) => {
    const birth = parseBirthDate(birthDate);
    if (!birth) return null;
    const today = new Date(now);
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
    return age < 0 ? null : age;
};

// Le titre « Mineur <18 ans » (valeur « Mineur » dans la liste des titres) a-t-il été choisi ?
export const isMinorTitle = (value) => String(value ?? '').trim().toLowerCase() === 'mineur';

// Le patient est-il mineur ? `titleIsMinor` : le titre « Mineur » a été choisi sur le formulaire.
export const isMinorPatient = ({ birthDate = '', titleIsMinor = false, now } = {}) => {
    if (titleIsMinor) return true;
    const age = ageOn(birthDate, now);
    return age !== null && age < MAJORITY_AGE;
};

// Un représentant légal est exigé pour un mineur non émancipé. → liste de messages d'erreur (vide si tout est en ordre).
export const guardianErrors = ({ minor, emancipated = false, guardianName = '', guardianRelation = '' }) => {
    if (!minor || emancipated) return [];
    const errors = [];
    if (!String(guardianName).trim()) errors.push('Représentant légal : le nom est obligatoire pour un patient mineur.');
    if (!String(guardianRelation).trim()) errors.push('Représentant légal : précisez le lien avec le patient (parent, tuteur…).');
    return errors;
};
