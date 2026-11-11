// src/utils/appointmentDate.js
//
// Date de rendez-vous / de consultation des formulaires du personnel soignant : on ne peut PAS la mettre dans le passé (ni avec le sélecteur, ni en tapant ou en collant la date).
// Un rapport déjà enregistré dont la date est passée se rouvre et se modifie sans que cette date soit rejetée : la règle ne s'applique qu'à ce qu'on saisit.
// Module pur (testé dans appointmentDate.test.js).

// Formulaires dont le champ `date` est la date du rendez-vous (opération, évaluations, consultations, protocole d'urgence, certificat de vol).
export const APPOINTMENT_DATE_VERSIONS = [5, 6, 7, 14, 16, 19, 20, 21, 28, 29, 41];
// Certificat de maladie : sa « date de consultation » est le champ dateOfVisit.
export const APPOINTMENT_DATE_FIELD = (version) => (Number(version) === 35 ? 'dateOfVisit' : 'date');
export const hasAppointmentDate = (version) => APPOINTMENT_DATE_VERSIONS.includes(Number(version)) || Number(version) === 35;

const pad = (n) => String(n).padStart(2, '0');
// Aujourd'hui au format AAAA-MM-JJ, à l'heure LOCALE de la personne (pas UTC : sinon, le soir, « aujourd'hui » serait déjà demain ou hier).
export const todayIso = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export const isPastDate = (value, now = new Date()) => /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) && String(value).slice(0, 10) < todayIso(now);

// true si la modification (champ, valeur) doit être refusée pour ce formulaire.
export const isRejectedAppointmentChange = (version, name, value, now = new Date()) => hasAppointmentDate(version) && name === APPOINTMENT_DATE_FIELD(version) && isPastDate(value, now);

export const APPOINTMENT_PAST_MESSAGE = 'La date du rendez-vous ne peut pas être dans le passé.';
