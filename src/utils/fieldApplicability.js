// src/utils/fieldApplicability.js
//
// Champs CONDITIONNELS : certains champs d'un formulaire n'apparaissent que dans certains cas (ex. « Représentant légal » seulement pour un patient de
// moins de 18 ans). Un champ obligatoire qui ne s'affiche pas ne doit JAMAIS bloquer l'enregistrement : la validation (utils/formValidation.js) l'ignore
// tant que sa condition n'est pas remplie, et la page d'administration « Champs obligatoires » indique la condition à côté du champ.
//
// À TENIR À JOUR : quand on ajoute un champ qui n'apparaît que sous condition dans un formulaire, on déclare ici sa condition (la même que celle du JSX),
// en plus de constants/formFieldCatalog.js + constants/fieldInfo.js. Un test (fieldApplicability.test.js) vérifie que chaque champ cité existe au catalogue.
//
// Les champs verrouillés « titre » et « facturation » (voir formRulesCore.js) ne sont jamais conditionnels : ils restent exigés dans tous les cas.
import { lockedReasonOf } from './formRulesCore';
import { needsField } from './medicalCertificates';
import { isMinorPatient } from './minors';
import { getFlightCertClass } from './flightCertificate';

const rule = (text, when) => ({ text, when });

const filled = (value) => (Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.trim().length > 0 : !!value);
const isYes = (value) => value === 'Yes' || value === true || value === 'true';
const includesAny = (list, ...wanted) => Array.isArray(list) && list.some((item) => wanted.includes(item));

// ───────────── Blocs communs ─────────────

// Motif d'adressage « Autre » : précision à écrire.
const REFERRAL = { referralOther: rule('le motif d\'adressage est « Autre »', (d) => d.referralReason === 'Other') };
const CARE_FORMS_WITH_REFERRAL = [5, 6, 7, 14, 16, 19, 20, 21, 28, 29];

// Patient décédé pendant la prise en charge (urgences, opération) : le bloc « Décès du patient » s'ouvre, et les suites (admission, suivi, ordonnance…) se ferment.
const DECEASED = rule('le patient est déclaré décédé', (d) => d.careDeceased === 'Yes');
const ALIVE = rule('le patient n\'est pas déclaré décédé', (d) => d.careDeceased !== 'Yes');
const CARE_DEATH_FIELDS = ['careDeathTime', 'careDeathCause', 'careDeathManner', 'careDeathResuscitation', 'careDeathResuscitationNote', 'careDeathFamily', 'careDeathBody'];

// Demandeur (forces de l'ordre) du rapport de décès : la case « demande d'un officier » ouvre les champs.
const REQUESTING_OFFICER = {
    requestingOfficer: rule('la case « demande d\'un officier » est cochée', (d) => isYes(d.showRequestingOfficerInput)),
    requestingAgency: rule('la case « demande d\'un officier » est cochée', (d) => isYes(d.showRequestingOfficerInput)),
};
const AUTHORITY_REF = { requestingAuthorityRef: rule('une autorité requérante est choisie', (d) => filled(d.requestingAuthority)) };

// Directives anticipées (dossier avancé et mise à jour) : le mandataire n'est demandé que s'il y en a un.
const ATTORNEY_YES = rule('un mandataire est désigné (« Oui »)', (d) => d.attorney === 'Yes');
const ATTORNEY_FIELDS = {
    attorneyName: ATTORNEY_YES, attorneyFirstName: ATTORNEY_YES, attorneyMiddleName: ATTORNEY_YES, attorneyLastName: ATTORNEY_YES, attorneyTitle: ATTORNEY_YES,
    attorneyRelation: ATTORNEY_YES, attorneyPH: ATTORNEY_YES,
};
const DNR_OTHER = rule('l\'ordre de non-réanimation est « Autre »', (d) => d.dnr === 'other');

// Mise à jour du dossier médical : chaque rubrique cochée ouvre ses champs.
const UPDATE_SECTIONS = {
    AdvancedDirectives: ['attorney', 'attorneyName', 'attorneyFirstName', 'attorneyMiddleName', 'attorneyLastName', 'attorneyTitle', 'attorneyRelation', 'attorneyPH', 'dnr', 'dnrOrder', 'dnrOther'],
    SocialInformation: ['maritalStatus', 'numberChildren', 'patientReligion', 'financialStatus'],
    Lifestyle: ['patientSmoker', 'patientAlcohol', 'patientDrugs', 'patientExercise', 'patientDiet', 'patientSleep', 'patientSexLife', 'patientJobRisks', 'patientHazards', 'patientOther'],
    'Medical History': ['patientBloodType', 'patientWeight', 'patientHeight', 'patientAllergies', 'patientCurrentMedicine', 'patientChronicDiseases', 'patientNotes'],
    FamilyHistory: ['patientFam', 'patientGenetic', 'patientFamSocial'],
    MentalHealth: ['patientMental', 'patientTherapy', 'patientTriggers', 'patientSupport', 'patientHarm'],
    EmergencyContact: ['patientEmergencyContact', 'patientEmergencyContactTitle', 'patientEmergencyContactFirstName', 'patientEmergencyContactMiddleName', 'patientEmergencyContactLastName', 'patientEmergencyContactRelation', 'patientEmergencyContactNumber', 'patientEmergencyContactDiscord'],
    GeneralInformation: ['patientTitleNew', 'patientFirstNameNew', 'patientMiddleNameNew', 'patientLastNameNew', 'patientDateOfBirthNew', 'patientAddressNew', 'patientZIPNew', 'patientZIPNewCity', 'patientGenderNew', 'patientRaceNew', 'patientPHNew', 'patientDiscordNew'],
};
const SECTION_LABELS = {
    AdvancedDirectives: 'Directives anticipées', SocialInformation: 'Informations sociales', Lifestyle: 'Mode de vie', 'Medical History': 'Historique médical',
    FamilyHistory: 'Antécédents familiaux', MentalHealth: 'Santé mentale', EmergencyContact: 'Contact d\'urgence', GeneralInformation: 'Informations générales',
};
const hasSection = (data, section) => includesAny(data.UpdateMedicalFile, section, section.replace(/\s+/g, ''));
const updateRules = () => {
    const rules = {};
    Object.entries(UPDATE_SECTIONS).forEach(([section, fields]) => {
        fields.forEach((field) => {
            rules[field] = rule(`la rubrique « ${SECTION_LABELS[section]} » est cochée`, (d) => hasSection(d, section));
        });
    });
    // Mandataire : en plus, seulement s'il y en a un.
    Object.keys(ATTORNEY_FIELDS).forEach((field) => {
        if (field === 'attorney') return;
        rules[field] = rule('la rubrique « Directives anticipées » est cochée et un mandataire est désigné', (d) => hasSection(d, 'AdvancedDirectives') && d.attorney === 'Yes');
    });
    rules.dnrOther = rule('la rubrique « Directives anticipées » est cochée et l\'ordre est « Autre »', (d) => hasSection(d, 'AdvancedDirectives') && d.dnr === 'other');
    return rules;
};

// Certificat de maladie : les champs suivent le type de courrier (voir utils/medicalCertificates.js).
const certificateRule = (text, ...needs) => rule(text, (d) => needs.some((need) => needsField(d.emailPurpose, need)));
const SICKNESS_RULES = {
    sicknessStartDate: certificateRule('le type de courrier demande une période', 'period'),
    sicknessEndDate: certificateRule('le type de courrier demande une période', 'period'),
    previousEndDate: certificateRule('le courrier est une prolongation d\'arrêt', 'previousEnd'),
    returnDate: certificateRule('le courrier est une reprise du travail', 'returnDate'),
    attendanceFrom: certificateRule('le courrier est un certificat de présence', 'attendanceTimes'),
    attendanceTo: certificateRule('le courrier est un certificat de présence', 'attendanceTimes'),
    certificateExit: certificateRule('le courrier est un arrêt de travail ou une prolongation', 'exit'),
    certificateRestrictions: rule('le courrier est une reprise du travail, ou les sorties / l\'aptitude sont « avec restrictions »',
        (d) => needsField(d.emailPurpose, 'restrictions') || d.certificateExit === 'Sorties autorisées avec restrictions' || d.fitnessConclusion === 'Apte avec restrictions'),
    fitnessActivity: certificateRule('le courrier est un certificat d\'aptitude', 'activity'),
    fitnessConclusion: certificateRule('le courrier est un certificat d\'aptitude', 'fitness'),
    reasonForSickness: certificateRule('le type de courrier demande un motif', 'reason'),
    illnessCondition: certificateRule('le courrier est une confirmation de maladie', 'condition'),
    confirmationPurpose: certificateRule('le courrier est une confirmation de maladie', 'purpose'),
};

// Certificat de vol : un examen n'est demandé que s'il fait partie de la classe choisie.
const FLIGHT_EXAMS = ['vision', 'colorVision', 'hearing', 'bloodPressure', 'cardio', 'neuro', 'mental', 'substances'];
const flightRules = () => {
    const rules = { flightCertRestrictions: rule('la conclusion est « Apte avec restrictions »', (d) => d.flightCertConclusion === 'Apte avec restrictions'), flightCertCategories: rule('une classe est choisie', (d) => filled(d.flightCertClass)) };
    FLIGHT_EXAMS.forEach((exam) => {
        const test = (d) => { const cls = getFlightCertClass(d.flightCertClass); return !!cls && cls.exams.includes(exam); };
        rules[`flightCert_${exam}`] = rule('l\'examen fait partie de la classe choisie', test);
        // Seuls la vue et la tension ont une valeur mesurée (facultative) à saisir.
        if (['vision', 'bloodPressure'].includes(exam)) rules[`flightCert_${exam}_value`] = rule('l\'examen fait partie de la classe choisie', test);
    });
    return rules;
};

// Rapport public de décès : les champs dépendent du type de défunt (identifié / non identifié).
const RECORD_TYPE_SET = rule('le type de défunt est choisi', (d) => filled(d.deathRecordType));
const UNIDENTIFIED = rule('le défunt est « Non identifié »', (d) => d.deathRecordType === 'Unidentified');
const IDENTIFIED = rule('le défunt est « Identifié »', (d) => filled(d.deathRecordType) && d.deathRecordType !== 'Unidentified');

const ONGOING_STUDIES = rule('les études ne sont pas « en cours »', (d) => !d.applicantEnrollmentOngoing);

// ───────────── Table : { version: { champ: { text, when } } } ─────────────
export const FIELD_CONDITIONS = {
    1: {
        decedentAttributes: rule('le type de décès est « Character Kill »', (d) => d.typeOfDeath === 'CK' || d.typeOfDeath === 'Character Kill'),
        evidenceLockerID: rule('la case « casier de preuves » est cochée', (d) => d.evidenceLocker === 'true' || d.evidenceLocker === true),
        ...REQUESTING_OFFICER, ...AUTHORITY_REF,
    },
    3: { ...ATTORNEY_FIELDS, dnrOther: DNR_OTHER },
    4: { ...AUTHORITY_REF },
    5: {
        ...Object.fromEntries(CARE_DEATH_FIELDS.map((field) => [field, DECEASED])),
        patientComplicationsYes: rule('une complication est signalée (« Oui »)', (d) => d.patientComplicationOptions === 'Yes'),
        procedureGoodNo: rule('la procédure n\'a pas abouti (« Non »)', (d) => d.procedureGoodOptions === 'No'),
        postOpExams: ALIVE, postOpMonitoring: ALIVE, surgeryPostOpInstructions: ALIVE, patientAddress: ALIVE,
    },
    6: {
        aptitudeRestrictions: rule('la conclusion est « Apte avec restrictions »', (d) => d.aptitudeConclusion === 'Apte avec restrictions'),
        aptitudeValidityMonths: rule('une conclusion d\'aptitude est choisie (autre que « Inapte »)', (d) => filled(d.aptitudeConclusion) && d.aptitudeConclusion !== 'Inapte'),
        careerRisks: rule('le métier est jugé à risques (« Oui »)', (d) => d.patientJobRisks === 'Yes'),
        patientCareer: rule('le patient a un emploi (« Oui »)', (d) => d.patientJob === 'Yes'),
        patientcareerNo: rule('le patient n\'a pas d\'emploi (« Non »)', (d) => d.patientJob === 'No'),
        patientImpairments: rule('le patient a d\'autres troubles (« Oui »)', (d) => d.patientOther === 'Yes'),
        patientMedicine: rule('le patient prend un traitement régulier (« Oui »)', (d) => d.patientMedicineRegular === 'Yes'),
        patientAllergies: rule('un risque d\'allergie est signalé (« Oui »)', (d) => d.patientAllergiesRisk === 'Yes'),
        vaccinationNote: rule('la vaccination n\'est pas à jour (« Non »)', (d) => d.vaccinationState === 'No'),
    },
    11: { ...REQUESTING_OFFICER },
    19: {
        ...Object.fromEntries(CARE_DEATH_FIELDS.map((field) => [field, DECEASED])),
        admission: ALIVE, followup: ALIVE, patientMedicine: ALIVE, routineCare: ALIVE, dischargeDestination: ALIVE,
        transferTo: rule('le patient n\'est pas décédé et l\'orientation de sortie est un transfert', (d) => d.careDeceased !== 'Yes' && d.dischargeDestination === 'Transfer'),
        CombinedImagingResults: rule('un examen d\'imagerie est demandé', (d) => filled(d.Imaging) && !includesAny(d.Imaging, 'NoneRequired')),
    },
    20: {
        orientedServiceOther: rule('le service orienté est « Autre »', (d) => d.orientedService === 'Other'),
        workStoppageDays: rule('un arrêt de travail est prescrit (« Oui »)', (d) => d.workStoppage === 'Yes'),
    },
    21: {
        orientedServiceOther: rule('le service orienté est « Autre »', (d) => d.orientedService === 'Other'),
        workStoppageDays: rule('un arrêt de travail est prescrit (« Oui »)', (d) => d.workStoppage === 'Yes'),
    },
    24: {
        guardianName: rule('le patient a moins de 18 ans et n\'est pas émancipé', (d) => isMinorPatient({ birthDate: d.patientDateOfBirth, titleIsMinor: d.patientTitle === 'Mineur' }) && !d.patientEmancipated),
        guardianRelation: rule('le patient a moins de 18 ans et n\'est pas émancipé', (d) => isMinorPatient({ birthDate: d.patientDateOfBirth, titleIsMinor: d.patientTitle === 'Mineur' }) && !d.patientEmancipated),
        patientEmancipated: rule('le patient a moins de 18 ans', (d) => isMinorPatient({ birthDate: d.patientDateOfBirth, titleIsMinor: d.patientTitle === 'Mineur' })),
        patientMedInfoReleaseOther: rule('le motif de la divulgation est « Autre »', (d) => d.CarePurposeMedicalInformationRelease === 'Other'),
        patientMedInfoFormatOther: rule('le format de remise est « Autre »', (d) => d.PurposeMedicalInformationReleaseFormat === 'Other'),
        MedicalRecordsReleaseOther: rule('l\'élément « Autre » est coché dans le dossier à divulguer', (d) => includesAny(d.MedicalRecordsRelease, 'Other')),
    },
    26: updateRules(),
    35: SICKNESS_RULES,
    37: {
        caseNumber: RECORD_TYPE_SET, caseStatus: RECORD_TYPE_SET, bodyStatus: RECORD_TYPE_SET, sex: RECORD_TYPE_SET, ethnicity: RECORD_TYPE_SET, age: RECORD_TYPE_SET,
        dateOfDeath: RECORD_TYPE_SET, manner: RECORD_TYPE_SET, causesOfDeath: RECORD_TYPE_SET, chiefMedicalExaminer: RECORD_TYPE_SET, coronerEmployee: RECORD_TYPE_SET,
        patientID: IDENTIFIED, otherSignificantConditions: IDENTIFIED,
        hairColor: UNIDENTIFIED, eyeColor: UNIDENTIFIED, weight: UNIDENTIFIED, height: UNIDENTIFIED, tattoos: UNIDENTIFIED, jewelry: UNIDENTIFIED, comments: UNIDENTIFIED,
    },
    41: flightRules(),
    // Candidatures : la date de fin de scolarité n'existe que si les études ne sont pas « en cours ».
    50: { applicantEnrollmentEnd: ONGOING_STUDIES },
    51: { applicantEnrollmentEnd: ONGOING_STUDIES },
    52: { applicantEnrollmentEnd: ONGOING_STUDIES },
    53: { applicantEnrollmentEnd: ONGOING_STUDIES },
    54: { applicantEnrollmentEnd: ONGOING_STUDIES },
    55: { applicantEnrollmentEnd: ONGOING_STUDIES },
};
CARE_FORMS_WITH_REFERRAL.forEach((version) => { FIELD_CONDITIONS[version] = { ...REFERRAL, ...(FIELD_CONDITIONS[version] || {}) }; });
// Le formulaire 7 est la version PBC du 6 : mêmes conditions.
FIELD_CONDITIONS[7] = { ...FIELD_CONDITIONS[6], ...REFERRAL };

/** Condition d'affichage d'un champ ({ text, when }) ou null s'il s'affiche toujours. */
export const conditionOf = (version, field) => FIELD_CONDITIONS[Number(version)]?.[field] || null;

/** Texte « affiché seulement si … » pour la page d'administration, ou '' pour un champ toujours affiché. */
export const conditionTextOf = (version, field) => {
    if (lockedReasonOf(version, field) === 'title' || lockedReasonOf(version, field) === 'billing') return '';
    const condition = conditionOf(version, field);
    return condition ? condition.text : '';
};

/**
 * Le champ s'affiche-t-il (donc peut-il être renseigné) avec ces données ? Un champ sans condition s'affiche toujours. Les champs verrouillés
 * « titre » et « facturation » sont toujours demandés. `data` : les valeurs du formulaire.
 */
export const isFieldApplicable = (version, field, data = {}) => {
    const lock = lockedReasonOf(version, field);
    if (lock === 'title' || lock === 'billing') return true;
    const condition = conditionOf(version, field);
    if (!condition) return true;
    try { return !!condition.when(data || {}); } catch (error) { return true; }
};
