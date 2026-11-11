// src/utils/formValidation.js
//
// Conditions qui autorisent (ou non) l'enregistrement d'un formulaire et l'envoi d'une candidature, en un seul
// endroit (module pur, sans Firebase ni React). Deux niveaux :
//   • erreurs   : bloquent l'enregistrement ;
//   • avertissements : demandent confirmation (« Enregistrer quand même ? »), pour les cas légitimes mais rares.
//
// RAPPORTS (validateReport)
//   - les champs obligatoires viennent de utils/formRulesCore.js : le minimum du code (au moins tout ce qui sert à fabriquer le TITRE du
//     rapport, voir utils/reportTitle.js) + les réglages du back-office (Admin → Champs obligatoires) ;
//   - dossiers médicaux Civils (3, 24, 25, 26) : ID patient, e-mail valide (il sert à envoyer les factures),
//     et pour la divulgation / la mise à jour au moins un élément choisi (sinon rien à faire ni à facturer) ;
//   - un Civil ne peut enregistrer un dossier que sous SON ID patient (jamais dans le dossier de quelqu'un d'autre) ;
//   - dates plausibles : ni dans le futur (au-delà de demain), ni avant 1900 ;
//   - ID patient absent ou de forme inhabituelle sur un formulaire de soin → avertissement : le rapport ne serait pas
//     rattaché au dossier du patient.
//
// CANDIDATURES (validateApplication)
//   - brouillon : il suffit d'avoir choisi un poste (sinon rien ne permet d'identifier la candidature) ;
//   - envoi : poste choisi ET encore ouvert, TOUT le formulaire rempli sans exception (aucune longueur minimale),
//     e-mail / téléphone / date de naissance de forme valide, et pas de réenvoi pendant qu'un entretien est en cours.
import { canonicalPatientId } from './patientId';
import {
    CATEGORY_BY_BBCODE_VERSION, getCategoryPositions, isPositionClosed, matchesPosition,
} from '../constants/recruitment';
import { guardianErrors, isMinorPatient, isMinorTitle, ageOn, MAJORITY_AGE } from './minors';
import { requiredFieldsOf, isRelaxed, getFormOverrides } from './formRulesCore';
import { getFieldInfo } from '../constants/fieldInfo';
import { VERSION_FIELDS } from '../constants/formFieldCatalog';
import { validateFlightCertificate } from './flightCertificate';
import { validateMedicalCertificate } from './medicalCertificates';
import { validateCareExtras } from './careFormRules';
import { clinicalWarnings } from '../clinical/engine';

const filled = (value) => (typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : !!value);
const text = (value) => String(value ?? '').trim();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (value) => EMAIL_REGEX.test(text(value));
// Numéro de téléphone RP : au moins 3 chiffres (formats « 555-0142 », « 5550142 », « 555 0142 »…).
export const isValidPhone = (value) => (text(value).match(/\d/g) || []).length >= 3 && /^[\d\s().+-]+$/.test(text(value));
// ID patient reconnaissable : « 2752 », « PHMC-2752 », « phmc 2752 ».
export const looksLikePatientId = (value) => /^(PHMC[-_ ]?)?\d{3,7}$/i.test(text(value));

const parseDate = (value) => {
    const date = new Date(text(value));
    return Number.isNaN(date.getTime()) ? null : date;
};
const DAY_MS = 24 * 60 * 60 * 1000;
const isFutureDate = (date, graceDays = 1) => date.getTime() > Date.now() + graceDays * DAY_MS;
const isImplausiblyOld = (date) => date.getFullYear() < 1900;

// ───────────────────────────── Rapports ─────────────────────────────

// Formulaires de soin : un patient est concerné (donc un ID patient est attendu).
export const CARE_FORM_VERSIONS = [3, 5, 6, 7, 14, 16, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29, 35, 41];
// Dossiers médicaux Civils (facturés).
export const CIVIL_MEDICAL_VERSIONS = [3, 24, 25, 26];

const fieldLabel = (version, field) => getFieldInfo(version, field, VERSION_FIELDS[version]?.[field]).label;

// → { errors: [message], warnings: [message] }
export const validateReport = (bbCodeVersion, formData = {}, { isCivilian = false, civilianPatientId = '' } = {}) => {
    const version = Number(bbCodeVersion);
    const errors = [];
    const warnings = [];
    const data = formData || {};

    requiredFieldsOf(version).forEach((field) => {
        // Rapport public de décès d'un défunt NON IDENTIFIÉ : son Discord (HRP) est forcément inconnu.
        if (version === 37 && field === 'decedentOOC' && data.deathRecordType === 'Unidentified') return;
        if (!filled(data[field])) errors.push(`${fieldLabel(version, field)} : champ obligatoire.`);
    });

    // Cas particuliers (champs qui ne se résument pas à « rempli / vide »).
    if (version === 35 && !filled(data.date) && !filled(data.dateOfVisit)) errors.push('Date de consultation : champ obligatoire.');
    // Champs ajoutés aux formulaires de soins : conduite à tenir, contrainte, transfert, durée d'arrêt… (utils/careFormRules.js).
    validateCareExtras(version, data).forEach((problem) => errors.push(problem));
    // Assistant clinique du protocole d'urgence : prescriptions incohérentes (dose, allergie, traitement en cours…) → avertissements, jamais bloquants.
    if ([5, 19, 20, 21].includes(version)) clinicalWarnings(data).forEach((warning) => warnings.push(warning));
    // Certificat de maladie : les champs demandés dépendent du type de courrier (utils/medicalCertificates.js).
    if (version === 35) validateMedicalCertificate(data).forEach((problem) => errors.push(problem));
    // Certificat de vol : classe, catégories, résultat de chaque examen de la classe, conclusion cohérente avec les examens (voir utils/flightCertificate.js).
    if (version === 41) validateFlightCertificate(data).forEach((problem) => errors.push(problem));
    if (version === 24 && !filled(data.patientFirstName) && !filled(data.patientLastName)) {
        errors.push('Prénom ou nom du patient : champ obligatoire.');
    }
    if (version === 11) {
        const decedents = Array.isArray(data.decedents) ? data.decedents : [];
        if (decedents.length === 0) errors.push('Ajoutez au moins un défunt au rapport.');
        else if (!filled(decedents[0]?.decedentName)) errors.push('Le premier défunt doit avoir un nom.');
    }
    if (version === 2 && !filled(data.decedentName) && !filled(data.decedentOOC) && !filled(data.reportDecedentNames) && !filled(data.reportDecedentOOC)) {
        errors.push('Nom IC ou OOC du défunt : au moins un des deux est obligatoire.');
    }
    if (version === 24 && !(Array.isArray(data.MedicalRecordsRelease) && data.MedicalRecordsRelease.length > 0)) {
        errors.push('Sélectionnez au moins un élément du dossier médical à divulguer.');
    }
    // Titre « Mineur » incompatible avec la date de naissance.
    if (CIVIL_MEDICAL_VERSIONS.includes(version)) {
        const title = data.patientTitle ?? data.patientTitleOptions;
        const age = ageOn(version === 26 ? data.date : data.patientDateOfBirth);
        if (isMinorTitle(title) && (age === null || age >= MAJORITY_AGE)) {
            errors.push('Titre « Mineur » : la date de naissance doit indiquer un patient de moins de 18 ans.');
        }
        // Et inversement : un patient de moins de 18 ans a obligatoirement le titre « Mineur ».
        if (age !== null && age < MAJORITY_AGE && !isMinorTitle(title)) {
            errors.push('Titre : un patient de moins de 18 ans a obligatoirement le titre « Mineur ».');
        }
    }
    // Mise à jour du dossier : le nouveau titre suit la nouvelle date de naissance (à défaut, la date actuelle).
    if (version === 26 && filled(data.patientTitleNew)) {
        const age = ageOn(data.patientDateOfBirthNew) ?? ageOn(data.date);
        if (isMinorTitle(data.patientTitleNew) && (age === null || age >= MAJORITY_AGE)) {
            errors.push('Nouveau titre « Maître (Enfant <18 ans) » : la date de naissance doit indiquer un patient de moins de 18 ans.');
        } else if (!isMinorTitle(data.patientTitleNew) && age !== null && age < MAJORITY_AGE) {
            errors.push('Nouveau titre : un patient de moins de 18 ans a obligatoirement le titre « Maître (Enfant <18 ans) ».');
        }
    }
    // Patient mineur : l'autorisation de divulgation est signée par son représentant légal (sauf mineur émancipé).
    if (version === 24) {
        guardianErrors({
            minor: isMinorPatient({ birthDate: data.patientDateOfBirth, titleIsMinor: data.patientTitle === 'Mineur' }),
            emancipated: !!data.patientEmancipated,
            guardianName: data.guardianName,
            guardianRelation: data.guardianRelation,
        }).forEach((message) => errors.push(message));
    }
    if (version === 26 && !(Array.isArray(data.UpdateMedicalFile) && data.UpdateMedicalFile.length > 0)) {
        errors.push('Sélectionnez au moins un élément du dossier médical à mettre à jour.');
    }

    // Dates plausibles : jamais dans le futur, y compris la date de rendez-vous des formulaires du personnel soignant (refusée aussi à la saisie, voir utils/appointmentDate.js).
    if (filled(data.date)) {
        const date = parseDate(data.date);
        if (date && isFutureDate(date)) errors.push('Date : elle ne peut pas être dans le futur.');
        else if (date && isImplausiblyOld(date)) errors.push('Date : année invalide.');
    }
    if (filled(data.patientDateOfBirth)) {
        const date = parseDate(data.patientDateOfBirth);
        if (date && isFutureDate(date, 0)) errors.push('Date de naissance : elle ne peut pas être dans le futur.');
        else if (date && isImplausiblyOld(date)) errors.push('Date de naissance : année invalide.');
    }

    // E-mail du patient : sert à lui écrire (factures, copies) sur les dossiers médicaux Civils.
    if (CIVIL_MEDICAL_VERSIONS.includes(version) && filled(data.patientEmail) && !isValidEmail(data.patientEmail)) {
        errors.push("E-mail du patient : format invalide (ex. prenomnom@mail.eyefind.fr).");
    }

    // ID patient.
    if (CARE_FORM_VERSIONS.includes(version)) {
        if (!filled(data.patientID)) {
            // ID patient obligatoire pour ce formulaire (champ obligatoire ci-dessus) : pas d'avertissement en plus.
            if (!CIVIL_MEDICAL_VERSIONS.includes(version) && !requiredFieldsOf(version).includes('patientID')) {
                warnings.push("Aucun ID patient : le rapport ne sera pas rattaché au dossier du patient (il restera uniquement dans vos rapports enregistrés).");
            }
        } else if (!looksLikePatientId(data.patientID)) {
            warnings.push(`L'ID patient « ${text(data.patientID)} » n'a pas la forme habituelle (ex. PHMC-2752 ou 2752).`);
        }
    }

    // Opération remplie par quelqu'un d'autre que le chirurgien : la copie qui lui est adressée se récupère dans le dossier du patient, donc il faut un ID patient.
    if (version === 5 && filled(data.surgeonEmployee) && filled(data.phmcEmployee) && data.surgeonEmployee !== data.phmcEmployee && !filled(data.patientID)) {
        warnings.push("Sans ID patient, le chirurgien choisi ne pourra pas récupérer la copie du rapport (elle passe par le dossier du patient).");
    }

    // Un Civil n'enregistre un dossier que sous son propre ID : jamais dans le dossier de quelqu'un d'autre.
    if (isCivilian && CIVIL_MEDICAL_VERSIONS.includes(version) && filled(data.patientID) && civilianPatientId
        && canonicalPatientId(data.patientID) !== canonicalPatientId(civilianPatientId)) {
        errors.push(`L'ID patient doit être le vôtre (${canonicalPatientId(civilianPatientId)}) : un compte Civil ne peut enregistrer que son propre dossier.`);
    }

    return { errors, warnings };
};

// ───────────────────────────── Candidatures ─────────────────────────────

const ANY_GENDER = ['genderMale', 'genderFemale', 'genderOther'];
const ANY_EDUCATION = ['eduHighSchool', 'eduCertificate', 'eduDiploma', 'eduAssociate', 'eduBachelor', 'eduMaster', 'eduDoctorate'];
const ANY_CITIZENSHIP = ['citizenUS', 'citizenPermanent', 'citizenNone'];

// Variantes par formulaire de candidature (reprennent ce que chaque formulaire marque déjà comme obligatoire).
// `ems: true` : sections réservées aux paramédics / EMT (emploi, lettre, expérience) ; les autres rôles EMS ont
// à la place licence, motivation, preuve de licence sur un autre personnage et preuves de DFP.
const APPLICATION_PROFILES = {
    50: { dob: 'split', location: true, health: true, education: true, employment: true, experience: true, motivation: true },
    51: { dob: 'combined', location: 'orHealth', health: false, education: true, employment: true, experience: true, motivation: true },
    52: { dob: 'combined', health: true, education: true, employment: true, experience: false, motivation: true },
    53: { dob: 'combined', health: true, education: true, employment: true, experience: true, motivation: true },
    54: { dob: 'combined', health: true, education: true, employment: true, experience: true, motivation: true },
    55: { dob: 'combined', health: true, education: true, employment: 'ems', experience: 'ems', motivation: 'ems', ems: true },
};

const isParamedic = (positions, key) => matchesPosition(positions, key, { roles: ['Paramedic'], keys: ['Paramedic'] });
const isEmt = (positions, key) => matchesPosition(positions, key, { roles: ['Technicien(ne) Ambulancier(ère) (EMT)'], keys: ['EMT', 'Technicien(ne) Ambulancier(ère) (EMT)'] });

// → { errors: [message], warnings: [message] }
//   mode : 'draft' | 'submit' ; existing : candidature déjà enregistrée (ou null) ; selectOptions : pour lire l'état
//   ouvert/fermé du poste.
export const validateApplication = (bbCodeVersion, formData = {}, { mode = 'submit', existing = null, selectOptions = null } = {}) => {
    const version = Number(bbCodeVersion);
    const errors = [];
    const warnings = [];
    const data = formData || {};
    const profile = APPLICATION_PROFILES[version];
    if (!profile) return { errors, warnings };

    // Brouillon : seul le poste est indispensable.
    if (!filled(data.recruitmentPosition)) {
        errors.push('Choisissez le poste visé : sans poste, la candidature ne peut pas être enregistrée.');
        return { errors, warnings };
    }
    if (mode === 'draft') return { errors, warnings };

    const category = CATEGORY_BY_BBCODE_VERSION[version];
    const positions = category && selectOptions ? getCategoryPositions(selectOptions, category.key) : {};
    const position = positions[data.recruitmentPosition];

    // Poste fermé : on n'envoie pas (le brouillon reste possible).
    if (position && isPositionClosed(position)) {
        errors.push(`Les candidatures pour « ${position.nom || data.recruitmentPosition} » sont fermées.`);
    }
    // Entretien en cours : un renvoi remettrait la candidature à « envoyée ».
    if (existing && ['en_examen', 'entretien_programme', 'entretien_effectue'].includes(existing.statut)) {
        errors.push("Cette candidature est en cours de traitement (examen, entretien programmé ou effectué) : elle ne peut plus être renvoyée. Contactez le recrutement depuis « Mon dossier candidat ».");
    }

    // Champs que le back-office a rendus facultatifs (jamais ceux qui composent le titre) : ignorés ici. Ceux qu'il a rendus obligatoires en plus
    // sont exigés après les vérifications du code.
    const checked = new Set();
    const need = (field, label) => {
        checked.add(field);
        if (isRelaxed(version, field)) return;
        if (!filled(data[field])) errors.push(`${label} : champ obligatoire.`);
    };
    const needOne = (fields, label) => {
        fields.forEach((field) => checked.add(field));
        if (fields.every((field) => isRelaxed(version, field))) return;
        if (!fields.some((field) => filled(data[field]))) errors.push(`${label} : faites un choix.`);
    };

    // 1. Informations personnelles
    need('applicantTitleAndFullName', 'Titre et nom complet');
    needOne(ANY_GENDER, 'Genre');
    if (filled(data.genderOther)) need('applicantGenderOtherText', 'Genre (précision « Autre »)');
    if (profile.dob === 'split') {
        need('applicantDOB', 'Date de naissance');
        need('applicantBirthPlace', 'Lieu de naissance');
    } else {
        need('applicantDOBAndPlace', 'Date et lieu de naissance');
    }
    need('applicantAddress', 'Adresse');
    need('applicantPhone', 'Téléphone');
    need('applicantEmail', 'E-mail');
    if (profile.location === true) needOne(['locationPHMC', 'locationPBC'], 'Site visé (PHMC ou PBC)');
    if (profile.location === 'orHealth') {
        const hasLocation = filled(data.locationPHMC) || filled(data.locationPBC);
        const hasHealth = filled(data.applicantMedicalConditions) && ANY_CITIZENSHIP.some((field) => filled(data[field]));
        if (!hasLocation && !hasHealth) errors.push('Site visé (PHMC ou PBC) : faites un choix.');
    }
    if (profile.health) {
        need('applicantMedicalConditions', 'Problèmes de santé (ou N/A)');
        needOne(ANY_CITIZENSHIP, 'Citoyenneté');
    }

    // 2. Formation, 3. Emploi
    if (profile.education) {
        needOne(ANY_EDUCATION, "Niveau d'études");
        need('applicantSchoolName', "Nom de l'établissement");
        need('applicantEnrollmentTerm', "Période d'inscription");
        need('applicantMajor', 'Domaine / spécialité');
        need('applicantLanguages', 'Langues parlées');
    }
    // EMS : emploi, lettre et expérience pour paramédics / EMT ; licence, motivation, autre personnage et DFP pour les autres rôles.
    const emsFull = profile.ems ? (isParamedic(positions, data.recruitmentPosition) || isEmt(positions, data.recruitmentPosition)) : null;
    if (profile.employment === true || (profile.employment === 'ems' && emsFull)) {
        need('applicantPrevEmployment', 'Emploi précédent');
        need('applicantPrevDuties', 'Responsabilités');
        need('applicantPrevDismissalReason', 'Motif de départ');
    }
    if (profile.ems && !emsFull) {
        need('emsLicenseLink', "Licence de technicien médical d'urgence");
        need('emsPartTimeReason', 'Motivation pour le programme à temps partiel');
    }
    if (profile.motivation === true || (profile.motivation === 'ems' && emsFull)) {
        need('applicantMotivationLetter', 'Lettre de motivation');
    }

    // Informations hors RP
    need('oocUcpName', "Nom d'utilisateur UCP");
    need('oocDiscord', 'Nom Discord');
    need('oocTimezone', 'Fuseau horaire');
    if (profile.experience === true || (profile.experience === 'ems' && emsFull)) {
        need('oocMedicalExperience', 'Expérience médicale réelle ou RP médical passé');
    }
    if (profile.ems && !emsFull) {
        need('oocOtherCharLicenseProof', 'Licence BLS/ALS sur un autre personnage (ou N/A)');
        need('dfpSanFireLink', 'Preuve de DFP SAN FIRE (ou N/A)');
        need('dfpPhmcLink', 'Preuve de DFP PHMC (ou N/A)');
        need('dfpLegalFactionLink', 'Preuve de DFP Legal Faction Management (ou N/A)');
    }

    Object.entries(getFormOverrides()[version] || {}).forEach(([field, state]) => {
        if (state === true && !checked.has(field)) need(field, fieldLabel(version, field));
    });

    need('oocForumName', 'Nom de compte du forum GTA:W');
    // Formes valides
    if (filled(data.applicantEmail) && !isValidEmail(data.applicantEmail)) errors.push('E-mail : format invalide (ex. prenomnom@mail.eyefind.fr).');
    if (filled(data.applicantPhone) && !isValidPhone(data.applicantPhone)) errors.push('Téléphone : numéro invalide (chiffres, espaces ou tirets).');
    if (profile.dob === 'split' && filled(data.applicantDOB)) {
        const date = parseDate(data.applicantDOB);
        if (date && (isFutureDate(date, 0) || isImplausiblyOld(date))) errors.push('Date de naissance : date invalide.');
    }

    return { errors, warnings };
};

// ───────────────────────────── Affichage ─────────────────────────────

// Message unique pour une notification : les premiers problèmes, puis « … et N autre(s) ».
export const formatIssues = (issues, { max = 6, title = '' } = {}) => {
    const shown = issues.slice(0, max).map((issue) => `• ${issue}`).join('\n');
    const more = issues.length > max ? `\n… et ${issues.length - max} autre(s).` : '';
    return `${title ? `${title}\n` : ''}${shown}${more}`;
};
