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
    const patient = {
        firstName: civil?.firstName || 'Jean',
        middleName: civil ? (civil.middleName || '') : 'Michel',
        lastName: civil?.lastName || 'Testard',
        fullName: civilFullName || 'Jean Michel Testard',
        id: civil?.patientID || 'PHMC-99999',
        dob: civil?.dateOfBirth || '1990-05-17',
        gender: civil?.gender || 'Masculin',
        address: civil?.address || '1234 Vinewood Blvd, Los Santos',
        zip: civil?.zip || '90001',
        phone: civil?.phone || '555-0142',
        email: civil?.email || 'jean.testard@eyefind.info',
        discord: civil?.discord || 'jean.testard',
    };

    return {
        selectOptions, formData, civil,
        today, utcDateTime, utcTime, daysFromToday,
        opt, optLabel, some, every, list,
        phmc, coroner, chief, extraStaff,
        patient,
    };
};

// ───────────────────────── Blocs réutilisables ─────────────────────────

const LOREM_SHORT = "[TEST] Texte de démonstration généré par le mode debug.";
const LOREM_LONG = "[TEST] Texte de démonstration généré par le mode debug. Il remplit entièrement ce champ afin de vérifier la mise en page, la génération du BBCode et les permissions, sans avoir à tout saisir à la main.";
const IMG_A = 'https://i.imgur.com/debugTestA.png';
const IMG_B = 'https://i.imgur.com/debugTestB.png';

const vitals = (h) => ({
    temperature: h.opt('temperature'),
    heartRate: h.opt('heartRate'),
    breathing: h.opt('breathing'),
    bloodPressure: h.opt('bloodPressure'),
});

const patientBasic = (h) => ({
    patientTitle: h.opt('patientTitle', 0, 'M.'),
    patientName: h.patient.fullName,
    patientID: h.patient.id,
    patientDateOfBirth: h.patient.dob,
    patientAddress: h.patient.address,
    patientGender: h.patient.gender,
    patientRace: 'Caucasien',
    patientPH: h.patient.phone,
    patientEmail: h.patient.email,
    patientDiscord: h.patient.discord,
    patientEmergencyContact: 'Marie Testard',
    patientEmergencyContactRelation: 'Épouse',
    patientEmergencyContactNumber: '555-0199',
    patientEmergencyContactDiscord: 'marie.testard',
    patientBloodType: h.opt('patientBloodType', 0, 'O+'),
    patientAllergies: 'Pénicilline',
    patientCurrentMedicine: 'Aucun traitement en cours',
    patientChronicDiseases: 'Aucune',
    patientNotes: LOREM_LONG,
});

const patientAdvancedExtras = (h) => ({
    patientMental: 'Aucun antécédent psychiatrique connu.',
    patientTherapy: 'Aucune thérapie en cours.',
    patientTriggers: 'Aucun déclencheur identifié.',
    patientSupport: 'Entourage familial présent et soutenant.',
    patientHarm: 'Aucune idée suicidaire ou autodestructrice.',
    patientFam: 'Père : hypertension. Mère : diabète de type 2.',
    patientGenetic: 'Aucune maladie génétique connue.',
    patientFamSocial: 'Vit avec son épouse, deux enfants.',
    maritalStatus: h.opt('maritalStatus', 0, 'Marié(e)'),
    numberChildren: h.opt('numberChildren', 0, '2'),
    patientReligion: 'Aucune',
    financialStatus: h.opt('financialStatus', 0, 'Stable'),
    patientSmoker: 'Non-fumeur',
    patientAlcohol: 'Occasionnel',
    patientDrugs: 'Aucune',
    patientExercise: '2 à 3 fois par semaine',
    patientDiet: 'Équilibrée',
    patientSleep: '7 heures par nuit',
    patientSexLife: 'Active, sans particularité',
    patientJobRisks: 'Aucun risque professionnel notable',
    patientHazards: 'Aucun',
    patientOther: 'Aucune autre information.',
    dnr: h.opt('dnr'),
    attorney: h.opt('attorney'),
    dnrOrder: h.opt('dnrOrder'),
    dnrOther: 'Aucune directive particulière.',
    attorneyName: 'Marie Testard',
    attorneyRelation: 'Épouse',
    attorneyPH: '555-0199',
});

const consultBase = (h) => ({
    ...h.phmc,
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
    scenePhotos: IMG_A,
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
    oocForumName: 'JeanTestard',
    oocDiscord: 'jean.testard',
    oocTimezone: 'GMT+1',
    oocMedicalExperience: 'Trois ans d\'expérience médicale en jeu.',
    oocAdminRecordLink: 'https://example.com/admin-record',
    oocStatsLink: 'https://example.com/stats',
    charBackground: LOREM_LONG,
});

// Premier poste ouvert d'une liste de détails de poste (clé → { status }).
const openPosition = (details, optionValues = null) => {
    const entries = details && typeof details === 'object' ? details : {};
    const keys = optionValues && optionValues.length > 0 ? optionValues : Object.keys(entries);
    const open = keys.find((k) => entries[k]?.status !== 'CLOSED');
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
        showRequestingOfficerInput: true,
        department: h.opt('requestingAgenciesOptions'),
        requestingOfficer: 'Officier John Doe, LSSD',
        massFatality: false,
        decedentName: 'Pierre Défunt',
        decedentOOC: 'Test Debug',
        patientID: h.patient.id,
        typeOfDeath: h.opt('typeOfDeathOptions'),
        placeOfDeath: '1234 Vinewood Blvd, Los Santos',
        mannerOfDeath: h.opt('mannerOfDeathOptions'),
        probableCauseOfDeath: 'Multiples blessures par balle',
        synopsis: LOREM_LONG,
        scenePhotos: `${IMG_A}, ${IMG_B}`,
        additionalImages: IMG_B,
        morgueStatus: 'false',
    }),

    // Rapport d'Autopsie
    4: (h) => ({
        ...h.coroner,
        ...h.chief,
        decedentName: 'Pierre Défunt',
        decedentOOC: 'Test Debug',
        patientID: h.patient.id,
        autopsyDate: h.today,
        autopsyTime: h.utcTime,
        autopsyDeathCauses: ['Hémorragie interne', 'Choc hypovolémique'],
        deathType: 'Homicide',
        causeOfDeath: 'Multiples blessures par balle',
        externalExamination: LOREM_LONG,
        autopsyAnatomicSummaryItems: ['Plaie thoracique gauche', 'Fracture de la 4e côte'],
        RadiologyResult: 'Projectile retenu dans le thorax.',
        autopsyAlbumUrl: IMG_A,
        autopsyPhotosUnavailable: false,
        synopsis: LOREM_LONG,
    }),

    // Email DMEC
    2: (h) => ({
        ...h.coroner,
        coronerPHNumber: '555-0100',
        requestingOfficer: 'Officier John Doe',
        department: h.opt('requestingAgenciesOptions'),
        decedentName: 'Pierre Défunt',
        decedentOOC: 'Test Debug',
        deathReport: 'https://example.com/forum/viewtopic.php?t=1234',
        additionalReports: ['https://example.com/forum/viewtopic.php?t=1235'],
    }),

    // Certificat de Décès
    8: (h) => ({
        ...h.coroner,
        decedentName: 'Pierre Défunt',
        decedentOOC: 'Test Debug',
        patientAge: '42',
        patientDateOfBirth: '1984-03-12',
        probableCauseOfDeath: 'Hémorragie interne',
        TimeofDeath: h.utcTime,
        dateofdeath: h.today,
        witnessName: 'Marie Témoin',
        date: h.today,
    }),

    // Opération Chirurgicale
    5: (h) => ({
        ...h.phmc,
        phmcRank: h.opt('phmcRank'),
        extraStaff: h.extraStaff(2),
        patientName: h.patient.fullName,
        patientID: h.patient.id,
        patientAddress: h.patient.address,
        date: h.today,
        patientSummaryConsultation: 'Patient adressé après une consultation pour une appendicite aiguë.',
        patientSummary: LOREM_LONG,
        surgeryProcedures: 'Appendicectomie par voie laparoscopique.',
        patientConsentOption: h.opt('patientConsent'),
        patientComplicationOptions: h.opt('complications'),
        procedureGoodOptions: h.opt('procedureGood'),
    }),

    // Évaluation Physique (PHMC + PBC)
    6: (h) => physEval(h),
    7: (h) => physEval(h),

    // Rapport de Tuerie/Accident de Masse
    11: (h) => ({
        ...h.coroner,
        dateTime: h.utcDateTime,
        placeOfDeath: 'Autoroute Del Perro, Los Santos',
        showRequestingOfficerInput: true,
        department: h.opt('requestingAgenciesOptions'),
        requestingOfficer: 'Officier John Doe, LSSD',
        synopsis: LOREM_LONG,
        evidenceLocker: 'false',
        evidenceLockerID: '',
        decedents: [1, 2].map((n) => ({
            decedentName: `Défunt Numéro${n}`,
            decedentOOC: `Test Debug ${n}`,
            patientID: '',
            dateTime: h.utcDateTime,
            pronouncedTimeOfDeath: h.utcDateTime,
            department: h.opt('requestingAgenciesOptions'),
            requestingOfficer: 'Officier John Doe, LSSD',
            typeOfDeath: h.opt('typeOfDeathOptions'),
            placeOfDeath: 'Autoroute Del Perro, Los Santos',
            mannerOfDeath: h.opt('mannerOfDeathOptions'),
            synopsis: LOREM_SHORT,
            evidenceLocker: 'false',
            evidenceLockerID: '',
            probableCauseOfDeath: 'Traumatisme crânien',
            scenePhotos: IMG_A,
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
            painLevel: h.opt('painLevel'),
            Imaging: imaging,
            XrayResults: imaging.includes('XRay') ? h.some('XrayResults', 1) : [],
            ctResults: imaging.includes('CTScan') ? h.some('ctResults', 1) : [],
            mriResults: imaging.includes('MRI') ? h.some('mriResults', 1) : [],
            ultrasoundResults: imaging.includes('Ultrasound') ? h.some('ultrasoundResults', 1) : [],
            prescriptionImage: IMG_B,
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
        patientTitle: h.opt('patientTitle', 0, 'M.'),
        patientFirstName: h.patient.firstName,
        patientMiddleName: h.patient.middleName,
        patientLastName: h.patient.lastName,
        patientID: h.patient.id,
        patientGender: h.patient.gender,
        patientPH: h.patient.phone,
        patientPhoneType: h.opt('patientPhone'),
        patientDateOfBirth: h.patient.dob,
        patientAddress: h.patient.address,
        patientZIP: h.patient.zip,
        patientEmail: h.patient.email,
        MedicalRecordsRelease: h.some('MedicalRecordsRelease', 2),
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
        ...patientBasic(h),
        ...patientAdvancedExtras(h),
        date: h.today,
        UpdateMedicalFile: h.every('UpdateMedicalFile', [
            'GeneralInformation', 'MentalHealth', 'EmergencyContact', 'Medical History',
            'FamilyHistory', 'SocialInformation', 'Lifestyle', 'AdvancedDirectives',
        ]),
        // MedicalUpdate stocke le titre actuel sous patientTitleOptions.
        patientTitleOptions: h.opt('patientTitle', 0, 'M.'),
        patientTitleNew: h.opt('patientTitleNew', 0, 'Mme'),
        patientNameNew: 'Jeanne Testard',
        patientDateOfBirthNew: h.patient.dob,
        patientAddressNew: '5678 Rockford Hills, Los Santos',
        patientPHNew: '555-0177',
        patientDiscordNew: 'jeanne.testard',
        patientGenderNew: 'Féminin',
        patientRaceNew: 'Caucasienne',
        payNow: false,
    }),

    // PHMC Email Interne
    27: (h) => ({
        ...h.phmc,
        patientNotes: 'Objet de test — email interne',
        decedentName: 'Pierre Défunt',
        decedentOOC: 'Test Debug',
        synopsis: LOREM_LONG,
        patientCareer: 'Médecin',
        scenePhotos: IMG_A,
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
        dateOfVisit: h.today,
        sicknessStartDate: h.today,
        sicknessEndDate: h.daysFromToday(5),
        reasonForSickness: 'Grippe saisonnière avec forte fièvre.',
        illnessCondition: 'Repos complet recommandé.',
        confirmationPurpose: 'Justificatif pour l\'employeur.',
        attachedReportSummary: LOREM_SHORT,
        phmcEmployeeSignatureImage: IMG_A,
        SubmitDate: h.today,
    }),

    // Rapport Public de Décès
    37: (h) => ({
        ...h.coroner,
        chiefMedicalExaminer: h.chief.chiefCoronerEmployee || h.coroner.coronerEmployee || '',
        deathRecordType: h.optLabel('deathRecordType', 0, 'Identified'),
        deathReportPostId: 'https://example.com/forum/viewtopic.php?t=1234',
        caseNumber: '1234',
        decedentName: 'Pierre Défunt',
        decedentOOC: 'Test Debug',
        patientID: h.patient.id,
        dateOfDeath: h.today,
        caseStatus: h.optLabel('caseStatusOptions', 0, 'Ouvert'),
        bodyStatus: h.optLabel('bodyStatusOptions', 0, 'Non libéré'),
        sex: h.optLabel('gender', 0, 'Masculin'),
        ethnicity: 'Caucasien',
        placeOfDeath: '1234 Vinewood Blvd, Los Santos',
        age: '42',
        manner: h.optLabel('mannerOfDeathOptions', 0, 'Homicide'),
        hairColor: 'Brun',
        eyeColor: 'Bleus',
        weight: '80 kg',
        height: '1m80',
        tattoos: 'Aucun',
        jewelry: 'Aucun',
        comments: LOREM_SHORT,
        causeA: 'Hémorragie interne',
        causeB: 'Plaie par balle',
        causeC: 'Agression armée',
        causeD: 'N/A',
        otherSignificantConditions: 'Aucune.',
    }),

    // Candidatures
    50: (h) => ({
        ...recruitmentBase(h),
        recruitmentPosition: openPosition(h.selectOptions.physicianRecruitmentDetails),
        applicantDOB: h.patient.dob,
        applicantBirthPlace: 'Los Santos, San Andreas',
    }),
    51: (h) => ({
        ...recruitmentBase(h),
        recruitmentPosition: openPosition(
            h.selectOptions.psychPositionDetailsData,
            h.list('psychRecruitmentPositions').map((o) => o.value)
        ),
        applicantDOBAndPlace: `${h.patient.dob} à Los Santos`,
    }),
    52: (h) => ({
        ...recruitmentBase(h),
        recruitmentPosition: openPosition(h.selectOptions.adminPositionDetailsData),
        applicantDOBAndPlace: `${h.patient.dob} à Los Santos`,
    }),
    53: (h) => ({
        ...recruitmentBase(h),
        recruitmentPosition: openPosition(h.selectOptions.nursePositionDetailsData),
        applicantDOBAndPlace: `${h.patient.dob} à Los Santos`,
    }),
    54: (h) => ({
        ...recruitmentBase(h),
        recruitmentPosition: openPosition(h.selectOptions.coronerPositionDetailsData),
        applicantDOBAndPlace: `${h.patient.dob} à Los Santos`,
    }),
    55: (h) => ({
        ...recruitmentBase(h),
        recruitmentPosition: openPosition(h.selectOptions.emsPositionDetailsData),
        applicantDOBAndPlace: `${h.patient.dob} à Los Santos`,
        emsLicenseLink: 'https://example.com/ems-license.png',
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
