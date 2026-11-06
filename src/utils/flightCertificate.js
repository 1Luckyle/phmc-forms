// src/utils/flightCertificate.js
//
// Certificat d'aptitude médicale au vol (formulaire 41), réservé aux personnels soignants.
//
// Le Code de l'Aviation de San Andreas (art. 400-407) définit les licences par catégorie d'aéronef (avion, hélicoptère, hydravion) mais ne fixe
// AUCUN certificat médical : celui-ci s'inspire du modèle réel (FAA / EASA, qui distinguent plusieurs classes de certificat médical) et le ramène à DEUX classes.
// Les critères ci-dessous sont donc des choix du PHMC, pas une règle du serveur : ils se modifient ici, à un seul endroit.

export const FLIGHT_CERT_CLASSES = {
    Class1: {
        value: 'Class1',
        label: 'Classe 1 — Pilote professionnel / service public',
        short: 'Classe 1',
        audience: 'Pilotes employés par un service de secours ou une institution publique (art. 404 du Code de l\'Aviation), transport rémunéré, instructeurs et examinateurs.',
        validityMonths: 12,       // moins de 40 ans
        validityMonthsSenior: 6,  // 40 ans et plus
        // Examens exigés pour cette classe (clé du champ -> libellé).
        exams: ['vision', 'colorVision', 'hearing', 'bloodPressure', 'cardio', 'neuro', 'mental', 'substances'],
    },
    Class2: {
        value: 'Class2',
        label: 'Classe 2 — Pilote privé / loisir / élève-pilote',
        short: 'Classe 2',
        audience: 'Pilotes privés, vol de loisir, titulaires d\'une licence d\'élève-pilote (art. 401), sans mission professionnelle.',
        validityMonths: 24,
        validityMonthsSenior: 12,
        exams: ['vision', 'colorVision', 'hearing', 'bloodPressure', 'substances'],
    },
};

export const FLIGHT_CERT_CATEGORIES = ['Avion', 'Hélicoptère', 'Hydravion']; // art. 400

export const FLIGHT_CERT_EXAMS = {
    vision: { label: 'Vue (acuité visuelle)', criterion: 'Acuité suffisante, avec ou sans correction', valueLabel: 'Acuité mesurée (facultatif)', valuePlaceholder: 'ex. 10/10 corrigée' },
    colorVision: { label: 'Vision des couleurs', criterion: 'Distingue les signaux lumineux et les couleurs aéronautiques' },
    hearing: { label: 'Audition', criterion: 'Perçoit la voix et les communications radio' },
    bloodPressure: { label: 'Tension artérielle et fréquence cardiaque', criterion: 'Valeurs compatibles avec le vol', valueLabel: 'Valeurs mesurées (facultatif)', valuePlaceholder: 'ex. 120/80 mmHg — 72 bpm' },
    cardio: { label: 'Cardiovasculaire (ECG)', criterion: 'Aucun trouble du rythme ou de la conduction incompatible avec le vol' },
    neuro: { label: 'Neurologique et équilibre', criterion: 'Aucun trouble de la conscience, de la coordination ou de l\'équilibre' },
    mental: { label: 'Santé mentale (entretien)', criterion: 'Aucun trouble incompatible avec la sécurité du vol' },
    substances: { label: 'Alcool et substances', criterion: 'Aucune consommation incompatible avec le vol (art. 251 du Code de l\'Aviation)' },
};

export const FLIGHT_CERT_RESULTS = ['Conforme', 'Non conforme'];
export const FLIGHT_CERT_CONCLUSIONS = ['Apte', 'Apte avec restrictions', 'Inapte'];

export const getFlightCertClass = (value) => FLIGHT_CERT_CLASSES[value] || null;

// Âge en années entières à une date donnée (dates ISO AAAA-MM-JJ) ; null si la naissance est inconnue.
export const ageOn = (birthDate, onDate) => {
    const birth = /^\d{4}-\d{2}-\d{2}/.test(birthDate || '') ? new Date(`${String(birthDate).slice(0, 10)}T00:00:00`) : null;
    const at = /^\d{4}-\d{2}-\d{2}/.test(onDate || '') ? new Date(`${String(onDate).slice(0, 10)}T00:00:00`) : new Date();
    if (!birth || Number.isNaN(birth.getTime()) || Number.isNaN(at.getTime())) return null;
    let age = at.getFullYear() - birth.getFullYear();
    const beforeBirthday = at.getMonth() < birth.getMonth() || (at.getMonth() === birth.getMonth() && at.getDate() < birth.getDate());
    if (beforeBirthday) age -= 1;
    return age;
};

// Durée de validité (en mois) d'une classe pour ce patient : plus courte à partir de 40 ans.
export const validityMonthsFor = (classValue, birthDate, examDate) => {
    const cls = getFlightCertClass(classValue);
    if (!cls) return null;
    const age = ageOn(birthDate, examDate);
    return age !== null && age >= 40 ? cls.validityMonthsSenior : cls.validityMonths;
};

// Date de fin de validité (AAAA-MM-JJ), par ajout de mois calendaires à la date de l'examen ; '' si inconnue.
export const validUntil = (examDate, months) => {
    if (!months || !/^\d{4}-\d{2}-\d{2}/.test(examDate || '')) return '';
    const [year, month, day] = String(examDate).slice(0, 10).split('-').map(Number);
    const target = new Date(year, month - 1 + months, day);
    // 31 janvier + 1 mois => on reste dans le mois voulu (28/29 février) au lieu de déborder sur mars.
    if (target.getDate() !== day) target.setDate(0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
};

// Clé de champ du résultat d'un examen dans formData.
export const examResultKey = (exam) => `flightCert_${exam}`;
export const examValueKey = (exam) => `flightCert_${exam}_value`;

// Contrôle de cohérence avant enregistrement : retourne la liste des problèmes (vide = valide).
export const validateFlightCertificate = (formData) => {
    const f = formData || {};
    const problems = [];
    const cls = getFlightCertClass(f.flightCertClass);
    if (!cls) problems.push('Choisissez la classe du certificat.');
    if (!Array.isArray(f.flightCertCategories) || f.flightCertCategories.length === 0) problems.push('Choisissez au moins une catégorie de vol (avion, hélicoptère, hydravion).');
    if (!String(f.patientName || '').trim()) problems.push('Indiquez le nom du patient.');
    if (!f.date) problems.push('Indiquez la date de l\'examen.');
    if (cls) {
        const missing = cls.exams.filter((exam) => !f[examResultKey(exam)]);
        if (missing.length) problems.push(`Renseignez le résultat de : ${missing.map((exam) => FLIGHT_CERT_EXAMS[exam].label).join(', ')}.`);
        const failed = cls.exams.some((exam) => f[examResultKey(exam)] === 'Non conforme');
        if (failed && f.flightCertConclusion === 'Apte') problems.push('Un examen est « non conforme » : la conclusion ne peut pas être « Apte » sans restriction.');
        if (!failed && f.flightCertConclusion === 'Inapte' && !String(f.flightCertNote || '').trim()) problems.push('Une conclusion « Inapte » alors que tous les examens sont conformes doit être expliquée dans les observations.');
    }
    if (!f.flightCertConclusion) problems.push('Choisissez la conclusion (apte, apte avec restrictions, inapte).');
    if (f.flightCertConclusion === 'Apte avec restrictions' && !String(f.flightCertRestrictions || '').trim()) problems.push('Précisez les restrictions.');
    return problems;
};
