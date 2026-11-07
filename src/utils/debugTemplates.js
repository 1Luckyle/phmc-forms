// src/utils/debugTemplates.js
//
// Gabarits de test pour le bouton « Remplir (debug) » (voir DebugContext /
// DebugFillButton). Un gabarit par version de formulaire (formDefinitions.js) :
// getDebugTemplate(version, ctx) renvoie l'objet partiel à fusionner dans
// formData. Rien n'est envoyé ni sauvegardé : c'est un simple pré-remplissage
// local pour tester les formulaires et les permissions de chaque rôle.
//
// Les listes déroulantes dépendent de selectOptions (Firebase) : on choisit
// donc de VRAIES valeurs d'options (h.opt / h.some) pour que react-select et
// les <select> les affichent, avec une valeur de repli si la liste est vide.

import { buildEmployerSummaryBBCode } from './employerSummary';
import { getCategoryPositions } from '../constants/recruitment';
import { HISTORY_PRESETS, aggregatePresetText } from '../constants/historyPresets';
import { DEATH_CAUSE_PRESETS } from '../constants/deathPresets';
import { toFrenchGender } from './patientIdentity';
import { FLIGHT_CERT_CLASSES, examResultKey } from './flightCertificate';

const pad = (n) => String(n).padStart(2, '0');

// Même normalisation que optionize() dans MainApp.js.
const toOptionList = (arr) => {
    const list = Array.isArray(arr) ? arr : (arr && typeof arr === 'object' ? Object.values(arr) : []);
    return list.map((item) => {
        if (item && typeof item === 'object' && 'value' in item) {
            return { value: String(item.value), label: String(item.label ?? item.value) };
        }
        if (typeof item === 'string' || typeof item === 'number') {
            return { value: String(item), label: String(item) };
        }
        if (item && typeof item === 'object') {
            const label = String(item.label ?? item.name ?? item.title ?? '');
            return { value: String(item.value ?? item.id ?? label), label };
        }
        return { value: '', label: '' };
    }).filter((o) => o.value !== '');
};

// Valeurs qui exigent un champ "Autre" supplémentaire, ou qui masquent des
// sections du formulaire : on les évite tant qu'une autre option existe.
const AVOID_VALUES = new Set(['Other', 'NoneRequired', 'None']);

const buildHelpers = (ctx = {}) => {
    const {
        selectOptions = {},
        formData = {},
        civilianProfile = null,
        phmcOptions = [],
        coronerOptions = [],
        unrestrictedPhmcOptions = [],
        unrestrictedCoronerOptions = [],
    } = ctx;

    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const utcDateTime = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
    const utcTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
    const daysFromToday = (delta) => {
        const d = new Date(now.getTime() + delta * 86400000);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const list = (key) => toOptionList(selectOptions[key]);
    const preferred = (key) => {
        const all = list(key);
        const good = all.filter((o) => !AVOID_VALUES.has(o.value));
        return good.length > 0 ? good : all;
    };

    // Valeur de la i-ème option de selectOptions[key] (sinon repli).
    const opt = (key, index = 0, fallback = '') => {
        const options = preferred(key);
        if (options.length === 0) return fallback;
        return options[Math.min(index, options.length - 1)].value;
    };
    // Variante "libellé" (DeathRecord stocke le libellé comme valeur).
    const optLabel = (key, index = 0, fallback = '') => {
        const options = preferred(key);
        if (options.length === 0) return fallback;
        return options[Math.min(index, options.length - 1)].label;
    };
    // Valeur précise d'une liste si elle existe (ex. 'Yes' pour déclencher un champ
    // conditionnel), sinon la première option.
    const optIs = (key, wanted, fallback = wanted) => {
        const options = list(key);
        if (options.length === 0) return fallback;
        return options.some((o) => o.value === wanted) ? wanted : options[0].value;
    };
    // Plusieurs valeurs distinctes pour un multi-select.
    const some = (key, count = 2, fallback = []) => {
        const options = preferred(key);
        if (options.length === 0) return fallback;
        return options.slice(0, count).map((o) => o.value);
    };
    const every = (key, fallback = []) => {
        const options = preferred(key);
        return options.length === 0 ? fallback : options.map((o) => o.value);
    };

    // --- Identité du personnel (respecte la restriction "employé connecté") ---
    const keepOrFirst = (options, current) => {
        if (current && options.some((o) => o.value === current)) {
            return options.find((o) => o.value === current);
        }
        return options[0] || null;
    };
    const phmcPick = keepOrFirst(phmcOptions, formData.phmcEmployee);
    const phmc = phmcPick
        ? {
            phmcEmployee: phmcPick.value,
            phmcEmployeeLastName: phmcPick.lastName || '',
            lastName: phmcPick.lastName || '',
        }
        : {};
    const coronerPick = keepOrFirst(coronerOptions, formData.coronerEmployee);
    const coroner = coronerPick
        ? {
            coronerEmployee: coronerPick.value,
            coronerBadge: coronerPick.badge ?? '',
            coronerRank: coronerPick.rank ?? '',
            coronerDiscord: coronerPick.discord ?? '',
        }
        : {};
    // Chef médecin légiste (liste non restreinte) : un autre nom que l'auteur si possible.
    const chiefPick = unrestrictedCoronerOptions.find((o) => o.value !== coroner.coronerEmployee)
        || unrestrictedCoronerOptions[0] || null;
    const chief = chiefPick
        ? {
            chiefCoronerEmployee: chiefPick.value,
            chiefCoronerBadge: chiefPick.badge ?? '',
            chiefCoronerRank: chiefPick.rank ?? '',
            chiefCoronerDiscord: chiefPick.discord ?? '',
        }
        : {};
    const extraStaff = (count = 2) => unrestrictedPhmcOptions
        .filter((o) => o.value !== phmc.phmcEmployee)
        .slice(0, count)
        .map((o) => o.value);

    // --- Identité du patient : celle du civil connecté si c'en est un ---
    const civil = civilianProfile || null;
    const civilFullName = civil
        ? [civil.firstName, civil.middleName, civil.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
        : '';
    const dobValue = civil?.dateOfBirth || '1990-05-17';
    const dobDate = new Date(dobValue);
    let ageYears = Number.isNaN(dobDate.getTime()) ? 35 : now.getFullYear() - dobDate.getFullYear();
    if (!Number.isNaN(dobDate.getTime())
        && (now.getMonth() < dobDate.getMonth() || (now.getMonth() === dobDate.getMonth() && now.getDate() < dobDate.getDate()))) {
        ageYears -= 1;
    }
    const patient = {
        ageYears: String(Math.max(0, ageYears)),
        // Valeurs du sélecteur « Sexe du patient » : Male / Female / Other.
        sex: ['Male', 'Female', 'Other'].includes(civil?.gender) ? civil.gender : 'Male',
        firstName: civil?.firstName || 'Jean',
        middleName: civil ? (civil.middleName || '') : 'Michel',
        lastName: civil?.lastName || 'Testard',
        fullName: civilFullName || 'Jean Michel Testard',
        id: civil?.patientID || 'PHMC-99999',
        dob: dobValue,
        gender: toFrenchGender(civil?.gender) || 'Homme',
        address: civil?.address || '1234 Vinewood Blvd, Los Santos',
        zip: civil?.zip || '90001',
        phone: civil?.phone || '555-0142',
        email: civil?.email || 'jean.testard@eyefind.info',
        discord: civil?.discord || 'jean.testard',
    };

    // Alternance A, B, A, B... dans l'ordre des champs du gabarit.
    let imageIndex = 0;
    const img = () => TEST_IMAGES[imageIndex++ % TEST_IMAGES.length];
    const imgs = (count = 2) => Array.from({ length: count }, img).join(', ');

    return {
        selectOptions, formData, civil,
        img, imgs,
        today, utcDateTime, utcTime, daysFromToday,
        opt, optIs, optLabel, some, every, list,
        phmc, coroner, chief, extraStaff,
        patient,
    };
};

// ───────────────────────── Blocs réutilisables ─────────────────────────

const LOREM_SHORT = "[TEST] Texte de démonstration généré par le mode debug.";
const LOREM_LONG = "[TEST] Texte de démonstration généré par le mode debug. Il remplit entièrement ce champ afin de vérifier la mise en page, la génération du BBCode et les permissions, sans avoir à tout saisir à la main.";

// Captures de test : les champs d'images utilisent ces deux URL en alternance
// (h.img() / h.imgs(n)), pour vérifier l'affichage de plusieurs images.
const TEST_IMAGES = [
    'https://i.ibb.co/yFLRmDc8/image.png',
    'https://i.ibb.co/gZTnynjz/image.png',
];

const vitals = (h) => ({
    temperature: h.opt('temperature'),
    heartRate: h.opt('heartRate'),
    breathing: h.opt('breathing'),
    bloodPressure: h.opt('bloodPressure'),
});

// Champ d'historique à choix par défaut (voir PresetTextField) : `count` choix cochés + un texte libre, et le texte regroupé que lit le rapport.
const presetFill = (key, count = 2, free = '', source = HISTORY_PRESETS[key]) => {
    const picked = (source || []).filter((item) => !/^aucun/i.test(item)).slice(0, count);
    return { [key]: aggregatePresetText(picked, free), [`${key}Presets`]: picked, [`${key}Free`]: free };
};

// Défunt de démonstration : nom en trois parties (le nom complet est recomposé par le formulaire).
const decedentParts = (first = 'Pierre', middle = '', last = 'Défunt') => ({
    decedentFirstName: first, decedentMiddleName: middle, decedentLastName: last, decedentName: [first, middle, last].filter(Boolean).join(' '),
});

// Titre cohérent avec l'âge : « Mineur » est imposé sous 18 ans et interdit au-delà.
const patientTitleFor = (h) => (Number(h.patient.ageYears) < 18 ? 'Mineur' : h.optIs('patientTitle', 'Mr', 'Mr'));
const patientTitleNewFor = (h) => (Number(h.patient.ageYears) < 18 ? 'Mstr' : h.optIs('patientTitleNew', 'Mrs', 'Mrs'));

const patientBasic = (h) => ({
    patientTitle: patientTitleFor(h),
    patientName: h.patient.fullName,
    patientFirstName: h.patient.firstName,
    patientMiddleName: h.patient.middleName,
    patientLastName: h.patient.lastName,
    patientID: h.patient.id,
    patientDateOfBirth: h.patient.dob,
    patientAddress: h.patient.address,
    patientZIP: h.patient.zip,
    patientGender: h.patient.gender,
    patientRace: 'Caucasien(ne)',
    patientPH: h.patient.phone,
    patientEmail: h.patient.email,
    patientDiscord: h.patient.discord,
    patientEmergencyContact: 'Marie Testard',
    patientEmergencyContactRelation: 'Épouse',
    patientEmergencyContactNumber: '555-0199',
    patientEmergencyContactDiscord: 'marie.testard',
    patientBloodType: h.opt('patientBloodType', 0, 'O+'),
    ...presetFill('patientAllergies', 2, 'Allergie légère aux piqûres de guêpe.'),
    ...presetFill('patientCurrentMedicine', 2),
    ...presetFill('patientChronicDiseases', 2),
    ...presetFill('patientNotes', 1, LOREM_SHORT),
});

const patientAdvancedExtras = (h) => ({
    ...presetFill('patientMental', 2),
    ...presetFill('patientTherapy', 1),
    ...presetFill('patientTriggers', 2),
    ...presetFill('patientSupport', 2),
    ...presetFill('patientHarm', 1),
    ...presetFill('patientFam', 2),
    ...presetFill('patientGenetic', 2),
    ...presetFill('patientFamSocial', 1),
    maritalStatus: h.opt('maritalStatus', 0, 'Marié(e)'),
    numberChildren: h.opt('numberChildren', 0, '2'),
    ...presetFill('patientReligion', 1),
    financialStatus: h.opt('financialStatus', 0, 'Stable'),
    ...presetFill('patientSmoker', 1),
    ...presetFill('patientAlcohol', 1),
    ...presetFill('patientDrugs', 1),
    ...presetFill('patientExercise', 1),
    ...presetFill('patientDiet', 1),
    ...presetFill('patientSleep', 1),
    ...presetFill('patientSexLife', 1),
    ...presetFill('patientJobRisks', 1),
    ...presetFill('patientHazards', 1),
    patientOther: 'Aucune autre information.',
    dnr: h.opt('dnr'),
    attorney: h.opt('attorney'),
    dnrOrder: h.opt('dnrOrder'),
    dnrOther: 'Aucune directive particulière.',
    attorneyFirstName: 'Marie', attorneyMiddleName: 'Claire', attorneyLastName: 'Testard', attorneyName: 'Marie Claire Testard',
    attorneyRelation: 'Épouse',
    attorneyPH: '555-0199',
});

// Bloc « Contexte patient » commun aux formulaires cliniques (PatientContextFields).
const patientContext = (h) => ({
    patientAgeYears: h.patient.ageYears,
    patientSex: h.patient.sex,
    patientAllergies: 'Pénicilline',
    patientChronicDiseases: 'Hypertension artérielle',
    patientCurrentMedicine: 'Ramipril 5 mg le matin',
});

const consultBase = (h) => ({
    ...h.phmc,
    ...patientContext(h),
    phmcRank: h.opt('phmcRank'),
    patientName: h.patient.fullName,
    patientID: h.patient.id,
    date: h.today,
    patientChiefComplaint: 'Douleur thoracique depuis deux heures.',
    patientDiagnosis: 'Contusion thoracique sans fracture.',
    patientSecondaryDiagnosis: 'Stress aigu.',
    patientMedicine: 'Paracétamol 1 g, repos.',
    patientProcedure: 'Examen clinique, radiographie thoracique.',
    ...vitals(h),
    bloodOxy: h.opt('bloodOxy'),
    findings: h.opt('findings'),
    lungs: h.opt('lungs'),
    pupils: h.opt('pupils'),
    wounds: h.opt('wounds'),
    ecg: h.opt('ecg'),
    sono: h.opt('sono'),
    lab: h.some('lab', 2),
    admission: h.opt('admission'),
    followup: h.opt('followup'),
    scenePhotos: h.img(),
});

const recruitmentBase = (h) => ({
    applicantTitleAndFullName: `M. ${h.patient.fullName}`,
    genderMale: true,
    genderFemale: false,
    genderOther: false,
    applicantGenderOtherText: '',
    applicantAddress: h.patient.address,
    applicantPhone: h.patient.phone,
    applicantEmail: h.patient.email,
    locationPHMC: true,
    locationPBC: false,
    applicantMedicalConditions: 'Aucune condition médicale particulière.',
    citizenUS: true,
    citizenPermanent: false,
    citizenNone: false,
    eduHighSchool: true,
    eduCertificate: false,
    eduDiploma: false,
    eduAssociate: false,
    eduBachelor: true,
    eduMaster: false,
    eduDoctorate: false,
    applicantSchoolName: 'Université de San Andreas',
    applicantEnrollmentTerm: '2012 - 2016',
    applicantMajor: 'Sciences de la santé',
    applicantLanguages: 'Français, Anglais',
    applicantPrevEmployment: 'Los Santos General Hospital (2017 - 2023)',
    applicantPrevDuties: 'Accueil et prise en charge des patients, suivi des dossiers médicaux.',
    applicantPrevDismissalReason: 'Démission pour évolution de carrière.',
    applicantMotivationLetter: `${LOREM_LONG}\n\nJe souhaite rejoindre le PHMC pour mettre mes compétences au service des patients.`,
    oocUcpName: 'JeanTestard',
    oocDiscord: 'jean.testard',
    oocTimezone: 'GMT+1',
    oocMedicalExperience: 'Trois ans d\'expérience médicale en jeu.',
    oocForumName: 'JeanTestard',
});

// Copie de `obj` sans certaines clés (un formulaire qui n'a pas tel champ ne doit pas le recevoir).
const without = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
const NO_LOCATION = ['locationPHMC', 'locationPBC'];

// Premier poste ouvert d'une liste de détails de poste (clé → { status }).
const openPosition = (details, optionValues = null) => {
    const entries = details && typeof details === 'object' ? details : {};
    const keys = optionValues && optionValues.length > 0 ? optionValues : Object.keys(entries);
    const open = keys.find((k) => entries[k]?.statut !== 'FERMÉ' && entries[k]?.status !== 'CLOSED');
    return open || keys[0] || '';
};

// ───────────────────────── Gabarits par version ─────────────────────────

const TEMPLATES = {
    // [Civil] Dossier Médical Avancé
    3: (h) => ({
        ...patientBasic(h),
        date: h.today,
        ...patientAdvancedExtras(h),
        payNow: false,
    }),

    // Services de Médecine Légale
    1: (h) => ({
        ...h.coroner,
        dateTime: h.utcDateTime,
        pronouncedTimeOfDeath: h.utcTime,
        department: h.opt('requestingAgenciesOptions'),
        showRequestingOfficerInput: true,
        requestingAgency: h.opt('requestingAgenciesOptions', 1),
        requestingOfficer: 'Officier John Doe',
        massFatality: false,
        ...decedentParts(),
        decedentOOC: 'test.debug',
        decedentAge: '42',
        decedentSex: 'Male',
        decedentHeight: '1,80 m',
        decedentWeight: '80 kg',
        decedentMarks: "Tatouage sur l'avant-bras gauche, cicatrice à l'abdomen.",
        patientID: h.patient.id,
        typeOfDeath: h.opt('typeOfDeathOptions'),
        placeOfDeath: '1234 Vinewood Blvd',
        placeOfDeathZip: h.patient.zip,
        mannerOfDeath: h.opt('mannerOfDeathOptions'),
        ...presetFill('probableCauseOfDeath', 2, '', DEATH_CAUSE_PRESETS),
        synopsis: LOREM_LONG,
        scenePhotos: h.imgs(2),
        additionalImages: h.img(),
        morgueStatus: 'false',
    }),

    // Rapport d'Autopsie
    4: (h) => ({
        ...h.coroner,
        ...h.chief,
        ...decedentParts(),
        decedentOOC: 'test.debug',
        patientID: h.patient.id,
        placeOfDeath: '1234 Vinewood Blvd',
        placeOfDeathZip: h.patient.zip,
        autopsyDate: h.today,
        autopsyTime: h.utcTime,
        decedentAge: '42',
        decedentSex: 'Male',
        decedentHeight: '1,80 m',
        decedentWeight: '80 kg',
        decedentMarks: "Tatouage sur l'avant-bras gauche, cicatrice à l'abdomen.",
        autopsyClothing: 'Jean bleu, t-shirt gris, baskets noires, montre au poignet gauche.',
        autopsyInternalExamination: 'Hémopéritoine abondant, lésion hépatique et pulmonaire gauche.',
        autopsyDeathCauses: ['Hémorragie interne', 'Choc hypovolémique'],
        deathType: 'Homicide',
        ...presetFill('causeOfDeath', 1, 'Multiples blessures par balle', DEATH_CAUSE_PRESETS),
        externalExamination: LOREM_LONG,
        autopsyAnatomicSummaryItems: ['Plaie thoracique gauche', 'Fracture de la 4e côte'],
        RadiologyResult: 'Projectile retenu dans le thorax.',
        autopsyAlbumUrl: h.img(),
        autopsyPhotosUnavailable: false,
        synopsis: LOREM_LONG,
    }),

    // Email DMEC
    2: (h) => ({
        ...h.coroner,
        // Numéro et e-mail viennent du profil du coroner (non modifiables dans le formulaire).
        coronerPHNumber: '555-0100',
        coronerEmail: 'coroner.test@phmc.health',
        requestingOfficer: 'Officier John Doe',
        department: h.opt('requestingAgenciesOptions'),
        ...decedentParts(),
        decedentOOC: 'test.debug',
        patientID: h.patient.id,
        deathReport: LOREM_SHORT,
        additionalReports: [LOREM_SHORT],
    }),

    // Certificat de Décès
    8: (h) => ({
        ...h.coroner,
        ...decedentParts(),
        patientID: h.patient.id,
        patientAge: '42',
        patientDateOfBirth: '1984-03-12',
        ...presetFill('probableCauseOfDeath', 2, '', DEATH_CAUSE_PRESETS),
        TimeofDeath: h.utcTime,
        dateofdeath: h.today,
        placeOfDeath: '1234 Vinewood Blvd',
        placeOfDeathZip: h.patient.zip,
        witnessFirstName: 'Marie',
        witnessMiddleName: '',
        witnessLastName: 'Témoin',
        witnessName: 'Marie Témoin',
        date: h.today,
    }),

    // Opération Chirurgicale
    5: (h) => ({
        ...h.phmc,
        ...patientContext(h),
        phmcRank: h.opt('phmcRank'),
        extraStaff: h.extraStaff(2),
        patientName: h.patient.fullName,
        patientID: h.patient.id,
        patientAddress: h.patient.address,
        date: h.today,
        patientSummaryConsultation: 'Patient adressé après une consultation pour une appendicite aiguë.',
        patientSummary: LOREM_LONG,
        surgeryProcedures: 'Appendicectomie par voie laparoscopique.',
        // Enquête chirurgicale
        surgeryPreOpDiagnosis: 'Appendicite aiguë non perforée.',
        surgeryAnesthesiaType: 'General',
        surgeryDuration: '90',
        surgeryBloodLoss: '150',
        patientConsentOption: h.optIs('patientConsent', 'Yes'),
        // « Yes » / « No » déclenchent les champs de précision correspondants.
        patientComplicationOptions: h.optIs('complications', 'Yes'),
        patientComplicationsYes: 'Saignement peropératoire maîtrisé par cautérisation.',
        procedureGoodOptions: h.optIs('procedureGood', 'No'),
        procedureGoodNo: 'Conversion en voie ouverte nécessaire, résultat attendu non atteint par laparoscopie.',
        surgeryPostOpInstructions: 'Repos 48 h, surveillance de la plaie, antalgiques si besoin.',
    }),

    // Évaluation Physique (PHMC + PBC)
    6: (h) => physEval(h),
    7: (h) => physEval(h),

    // Rapport de Tuerie/Accident de Masse
    11: (h) => ({
        ...h.coroner,
        dateTime: h.utcDateTime,
        placeOfDeath: 'Autoroute Del Perro',
        placeOfDeathZip: h.patient.zip,
        department: h.opt('requestingAgenciesOptions'),
        showRequestingOfficerInput: true,
        requestingAgency: h.opt('requestingAgenciesOptions', 1),
        requestingOfficer: 'Officier John Doe',
        synopsis: LOREM_LONG,
        evidenceLocker: 'false',
        evidenceLockerID: '',
        decedents: [1, 2].map((n) => ({
            ...decedentParts('Défunt', '', `Numéro${n}`),
            decedentOOC: `test.debug${n}`,
            patientID: '',
            dateTime: h.utcDateTime,
            pronouncedTimeOfDeath: h.utcDateTime,
            typeOfDeath: h.opt('typeOfDeathOptions'),
            placeOfDeath: 'Autoroute Del Perro',
            placeOfDeathZip: h.patient.zip,
            mannerOfDeath: h.opt('mannerOfDeathOptions'),
            synopsis: LOREM_SHORT,
            evidenceLocker: 'false',
            evidenceLockerID: '',
            ...presetFill('probableCauseOfDeath', 1, '', DEATH_CAUSE_PRESETS),
            scenePhotos: h.img(),
            additionalImages: '',
            morgueStatus: 'false',
            collapsed: false,
        })),
    }),

    // Consultation psychiatrique (PHMC + PBC)
    14: (h) => mentalHealth(h),
    16: (h) => mentalHealth(h),

    // Protocole d'Urgence
    19: (h) => {
        const imaging = h.some('Imaging', 1);
        return {
            ...consultBase(h),
            patientInjuryMechanism: 'Chute d\'un escabeau de deux mètres.',
            arrivalMode: 'EMS',
            arrivalTime: h.utcTime,
            painLevel: h.opt('painLevel'),
            Imaging: imaging,
            XrayResults: imaging.includes('XRay') ? h.some('XrayResults', 1) : [],
            ctResults: imaging.includes('CTScan') ? h.some('ctResults', 1) : [],
            mriResults: imaging.includes('MRI') ? h.some('mriResults', 1) : [],
            ultrasoundResults: imaging.includes('Ultrasound') ? h.some('ultrasoundResults', 1) : [],
            prescriptionImage: h.img(),
        };
    },

    // Consultation Générale (PHMC)
    20: (h) => ({
        ...consultBase(h),
        assignedDepartment: h.opt('assignedDepartment'),
    }),
    // Consultation Générale (PBC)
    21: (h) => ({
        ...consultBase(h),
        paletoClinicDepartment: h.opt('paletoClinicDepartment'),
        assignedDepartment: h.opt('assignedDepartment'),
        patientNotes: LOREM_SHORT,
    }),

    // Note de Service (PHMC)
    22: (h) => ({
        ...h.phmc,
        date: h.today,
        patientName: h.patient.fullName,
        patientID: h.patient.id,
        departmentLarge: h.opt('departmentLarge'),
        patientNotes: LOREM_LONG,
    }),
    // Note de Service (PBC)
    23: (h) => ({
        ...h.phmc,
        date: h.today,
        patientName: h.patient.fullName,
        patientID: h.patient.id,
        departmentLarge: h.opt('paletoClinicDepartment'),
        patientNotes: LOREM_LONG,
    }),

    // [Civil] Formulaire de Libération Médicale
    24: (h) => ({
        ...h.phmc,
        patientTitle: patientTitleFor(h),
        patientFirstName: h.patient.firstName,
        patientMiddleName: h.patient.middleName,
        patientLastName: h.patient.lastName,
        patientID: h.patient.id,
        patientGender: h.patient.gender,
        patientPH: h.patient.phone,
        patientDateOfBirth: h.patient.dob,
        patientAddress: h.patient.address,
        patientZIP: h.patient.zip,
        patientEmail: h.patient.email,
        MedicalRecordsRelease: h.some('MedicalRecordsRelease', 2, ['ERVisit', 'HospitalStay']),
        CarePurposeMedicalInformationRelease: h.opt('PurposeMedicalInformationRelease'),
        PurposeMedicalInformationReleaseFormat: h.opt('PurposeMedicalInformationReleaseFormat'),
        StupidDateFrom: h.daysFromToday(-365),
        StupidDateTo: h.today,
        SubmitDate: h.today,
        // Pas de paiement Fleeca déclenché par le remplissage automatique.
        payNow: false,
    }),

    // [Civil] Dossier Médical Basique
    25: (h) => ({
        ...patientBasic(h),
        date: h.today,
        payNow: false,
    }),

    // [Civil] Mise à Jour du Dossier Médical
    26: (h) => ({
        // La mise à jour n'a ni titre, ni date de naissance, ni genre, ni ethnicité « actuels » : ils sont dans la section « nouvelles informations ».
        ...without(patientBasic(h), ['patientTitle', 'patientDateOfBirth', 'patientGender', 'patientRace']),
        ...patientAdvancedExtras(h),
        // Dans la mise à jour, le champ `date` est la DATE DE NAISSANCE du patient (pas la date du jour).
        date: h.patient.dob,
        UpdateMedicalFile: h.every('UpdateMedicalFile', [
            'GeneralInformation', 'MentalHealth', 'EmergencyContact', 'Medical History',
            'FamilyHistory', 'SocialInformation', 'Lifestyle', 'AdvancedDirectives',
        ]),
        // MedicalUpdate stocke le titre actuel sous patientTitleOptions.
        patientTitleOptions: patientTitleFor(h),
        patientTitleNew: patientTitleNewFor(h),
        patientNameNew: 'Jeanne Marie Testard',
        patientFirstNameNew: 'Jeanne',
        patientMiddleNameNew: 'Marie',
        patientLastNameNew: 'Testard',
        patientDateOfBirthNew: h.patient.dob,
        patientAddressNew: '5678 Rockford Hills',
        patientZIPNew: h.patient.zip,
        patientPHNew: '555-0177',
        patientDiscordNew: 'jeanne.testard',
        patientGenderNew: 'Femme',
        patientRaceNew: 'Autre',
        payNow: false,
    }),

    // PHMC Email Interne
    27: (h) => ({
        ...h.phmc,
        internalEmailSubject: "[TEST] Objet de l'email interne",
        internalEmailRecipient: 'Direction du PHMC',
        internalEmailBody: LOREM_LONG,
        internalEmailSignatureImage: h.img(),
        internalEmailSenderTitle: 'Médecin',
        internalEmailSenderDepartment: 'Médecine interne',
    }),

    // Évaluation Psychologique (PHMC + PBC)
    28: (h) => shrink(h),
    29: (h) => shrink(h),

    // Certificat de Maladie
    35: (h) => ({
        ...h.phmc,
        emailPurpose: 'Sickness Note',
        emailRecipient: 'Direction des Ressources Humaines',
        patientName: h.patient.fullName,
        patientID: h.patient.id,
        dateOfVisit: h.today,
        sicknessStartDate: h.today,
        sicknessEndDate: h.daysFromToday(5),
        reasonForSickness: 'Grippe saisonnière avec forte fièvre.',
        illnessCondition: 'Repos complet recommandé.',
        confirmationPurpose: 'Justificatif pour l\'employeur.',
        attachedReportSummary: buildEmployerSummaryBBCode('consult', {
            facility: 'Centre médical Pillbox Hill', date: h.today.split('-').reverse().join('/'), admission: 'Non', followup: 'Recommandé',
        }),
        phmcEmployeeSignatureImage: h.img(),
        SubmitDate: h.today,
    }),

    // Rapport Public de Décès
    37: (h) => ({
        ...h.coroner,
        chiefMedicalExaminer: h.chief.chiefCoronerEmployee || h.coroner.coronerEmployee || '',
        deathRecordType: 'Identified',
        caseNumber: '2026-0042',
        ...decedentParts(),
        decedentOOC: 'test.debug',
        patientID: h.patient.id,
        dateOfDeath: h.today,
        caseStatus: 'Ouvert',
        bodyStatus: 'Prêt à être remis',
        sex: 'Masculin',
        ethnicity: 'Caucasien(ne)',
        placeOfDeath: '1234 Vinewood Blvd',
        placeOfDeathZip: h.patient.zip,
        age: '42',
        manner: 'Homicide',
        hairColor: 'Bruns',
        eyeColor: 'Bleus',
        weight: '80 kg',
        height: '1m80',
        tattoos: 'Aucun',
        jewelry: 'Aucun',
        comments: LOREM_SHORT,
        ...presetFill('causesOfDeath', 2, '', DEATH_CAUSE_PRESETS),
        otherSignificantConditions: 'Aucune.',
    }),

    // Candidatures
    // Certificat d'aptitude médicale au vol (classe 1 : tous les examens, conclusion « Apte »)
    41: (h) => ({
        ...h.phmc,
        flightCertClass: 'Class1',
        flightCertCategories: ['Avion', 'Hélicoptère'],
        patientName: h.patient.fullName,
        patientID: h.patient.id,
        patientDateOfBirth: h.patient.dob,
        date: h.today,
        ...Object.fromEntries(FLIGHT_CERT_CLASSES.Class1.exams.map((exam) => [examResultKey(exam), 'Conforme'])),
        flightCert_vision_value: '10/10 corrigée',
        flightCert_bloodPressure_value: '120/80 mmHg, 68 bpm',
        flightCertConclusion: 'Apte',
        flightCertNote: LOREM_SHORT,
    }),

    50: (h) => ({
        ...recruitmentBase(h),
        recruitmentPosition: openPosition(getCategoryPositions(h.selectOptions, 'medecine')),
        applicantDOB: h.patient.dob,
        applicantBirthPlace: 'Los Santos, San Andreas',
    }),
    51: (h) => ({
        ...recruitmentBase(h),
        recruitmentPosition: openPosition(
            getCategoryPositions(h.selectOptions, 'psychologie')
        ),
        applicantDOBAndPlace: `${h.patient.dob} à Los Santos`,
    }),
    52: (h) => ({
        ...without(recruitmentBase(h), [...NO_LOCATION, 'oocMedicalExperience']),
        recruitmentPosition: openPosition(getCategoryPositions(h.selectOptions, 'administration')),
        applicantDOBAndPlace: `${h.patient.dob} à Los Santos`,
    }),
    53: (h) => ({
        ...recruitmentBase(h),
        recruitmentPosition: openPosition(getCategoryPositions(h.selectOptions, 'soinsInfirmiers')),
        applicantDOBAndPlace: `${h.patient.dob} à Los Santos`,
    }),
    54: (h) => ({
        ...without(recruitmentBase(h), NO_LOCATION),
        recruitmentPosition: openPosition(getCategoryPositions(h.selectOptions, 'medecineLegale')),
        applicantDOBAndPlace: `${h.patient.dob} à Los Santos`,
    }),
    55: (h) => ({
        ...without(recruitmentBase(h), NO_LOCATION),
        recruitmentPosition: openPosition(getCategoryPositions(h.selectOptions, 'paramedical')),
        applicantDOBAndPlace: `${h.patient.dob} à Los Santos`,
        emsLicenseLink: h.img(),
        emsPartTimeReason: LOREM_SHORT,
        oocOtherCharLicenseProof: 'N/A',
        dfpSanFireLink: 'N/A',
        dfpPhmcLink: 'N/A',
        dfpLegalFactionLink: 'N/A',
    }),
};

// ───────────────────── Gabarits partagés entre versions ─────────────────────

function physEval(h) {
    return {
        ...h.phmc,
        ...patientContext(h),
        phmcRank: h.opt('phmcRank'),
        patientName: h.patient.fullName,
        patientID: h.patient.id,
        date: h.today,
        patientHeight: '1m80',
        patientWeight: '80 kg',
        BodyMassIndex: h.opt('BodyMassIndex'),
        ...vitals(h),
        patientJob: h.opt('patientJob'),
        patientJobRisks: h.opt('patientJobRisks'),
        patientAllergies: 'Pénicilline',
        patientAllergiesRisk: h.opt('patientAllergiesRisk'),
        patientMedicine: 'Aucun',
        patientMedicineRegular: h.opt('patientMedicineRegular'),
        patientOther: h.opt('patientOther'),
        predisposition: h.opt('predisposition'),
        careerRisks: 'Aucun risque particulier.',
        patientcareerNo: '',
        patientCareer: 'Médecin',
        patientImpairments: 'Aucun',
        patientSummary: LOREM_LONG,
    };
}

function mentalHealth(h) {
    return {
        ...h.phmc,
        ...patientContext(h),
        phmcRank: h.opt('phmcRank'),
        patientName: h.patient.fullName,
        patientID: h.patient.id,
        date: h.today,
        patientChiefComplaint: 'Anxiété et troubles du sommeil.',
        patientNotes: LOREM_LONG,
        patientDiagnosis: 'Trouble anxieux généralisé.',
        patientMedicine: 'Aucun traitement médicamenteux.',
        patientProcedure: 'Entretien clinique, suivi hebdomadaire.',
        admission: h.opt('admission'),
        followup: h.opt('followup'),
    };
}

function shrink(h) {
    return {
        ...h.phmc,
        ...patientContext(h),
        phmcRank: h.opt('phmcRank'),
        patientName: h.patient.fullName,
        patientID: h.patient.id,
        date: h.today,
        patientChiefComplaint: 'Anxiété persistante depuis plusieurs semaines.',
        patientVisitReason: 'Consultation de suivi à la demande du patient.',
        patientSymptoms: 'Insomnie, irritabilité, difficultés de concentration.',
        patientTriggers: 'Stress professionnel.',
        patientStress: 'Niveau de stress élevé au travail.',
        Appearance: h.opt('Appearance'),
        Behavior: h.opt('Behavior'),
        Speech: h.opt('Speech'),
        Mood: h.opt('Mood'),
        Affect: h.opt('Affect'),
        ThoughtProcess: h.opt('ThoughtProcess'),
        ThoughtContent: h.opt('ThoughtContent'),
        Insight: h.opt('Insight'),
        Cognition: h.opt('Cognition'),
        Risk: h.opt('Risk'),
        patientTreatment: 'Aucun traitement antérieur.',
        patientMedicalRecord: 'Aucun antécédent notable.',
        patientFamily: 'Pas d\'antécédent psychiatrique familial.',
        patientJobRisks: 'Charge de travail importante.',
        patientCondition: 'Stable.',
        patientChronicDiseases: 'Aucune',
        patientAllergies: 'Pénicilline',
        patientDrugs: 'Aucune',
        patientDrugsUsage: 'Aucun usage déclaré.',
        patientMental: 'Pas d\'hospitalisation psychiatrique antérieure.',
        patientFam: 'Famille présente et soutenante.',
        patientJob: 'Employé de bureau',
        patientRelationship: 'En couple, relation stable.',
        patientLegal: 'Aucun problème judiciaire.',
        patientRiskAssessment: 'Risque faible.',
        patientFindings: LOREM_LONG,
        patientDiagnosis: 'Trouble anxieux généralisé.',
        admission: h.opt('admission'),
        patientTreatmentPlan: 'Thérapie cognitivo-comportementale hebdomadaire.',
        patientTherapyMedicine: 'Aucun médicament pour le moment.',
        followup: h.opt('followup'),
        patientTreatmentMedicine: 'Aucun',
        patientTherapy: 'Thérapie de soutien.',
        patientFollowUp: 'Revoir dans deux semaines.',
        patientSafety: 'Plan de sécurité discuté avec le patient.',
    };
}

// ───────────────────────────── API publique ─────────────────────────────

export const hasDebugTemplate = (version) => Object.prototype.hasOwnProperty.call(TEMPLATES, version);

// Renvoie l'objet partiel à fusionner dans formData, ou null si la version n'a
// pas de gabarit (ex. panneau de contrôle admin).
export const getDebugTemplate = (version, ctx) => {
    const build = TEMPLATES[version];
    if (!build) return null;
    return build(buildHelpers(ctx));
};

// Exposé pour les modales (création de compte, demandes, etc.) qui ont leur
// propre état local et construisent leurs propres valeurs de test.
export const getDebugHelpers = (ctx) => buildHelpers(ctx);
export { LOREM_SHORT, LOREM_LONG };
