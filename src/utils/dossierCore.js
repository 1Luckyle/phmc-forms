// src/utils/dossierCore.js
//
// Règles du DOSSIER PATIENT, en fonctions pures (aucune dépendance) : le site et les Cloud Functions s'en servent à l'identique. Copié dans
// functions/dossierCore.js par « npm run sync:dossier » (les fonctions ne peuvent pas importer depuis src/).
//
// Principe : le dossier d'un patient (dossiersPatients/{ID}) est rempli par UN formulaire initial, « Dossier Médical Basique » (25) OU « Dossier Médical
// Avancé » (3), puis complété par autant de « Mise à jour du dossier » (26) que nécessaire (l'historique). Un formulaire n'alimente le dossier que lorsque :
//   • il est PAYÉ (ou gratuit : exemption, mineur, jeton, mise à jour de simples coordonnées) ;
//   • et que 15 minutes se sont écoulées depuis le paiement (depuis l'enregistrement s'il est gratuit) : c'est le délai pour se corriger. Dans ce délai le
//     patient peut modifier ou supprimer son formulaire ; supprimé, il n'alimente rien et un JETON gratuit (même formulaire) est rendu s'il était payé.
//   • les mises à jour qui ne touchent que le nom, les prénoms, le téléphone, Discord et l'adresse sont gratuites et s'appliquent tout de suite.
// Un formulaire créé par le PERSONNEL pour un patient reste en brouillon tant que le patient n'a pas payé ; le patient ne le modifie ni ne le supprime, mais
// peut signaler une erreur après paiement : il reçoit alors un jeton gratuit de mise à jour.

export const DOSSIER_WINDOW_MS = 15 * 60 * 1000;

export const BASIC_VERSION = 25;
export const ADVANCED_VERSION = 3;
export const UPDATE_VERSION = 26;
export const INITIAL_VERSIONS = [BASIC_VERSION, ADVANCED_VERSION];
export const DOSSIER_VERSIONS = [BASIC_VERSION, ADVANCED_VERSION, UPDATE_VERSION];
export const KIND_BY_VERSION = { 25: 'basique', 3: 'avance', 26: 'maj' };
export const VERSION_BY_KIND = { basique: 25, avance: 3, maj: 26 };

export const isDossierVersion = (version) => DOSSIER_VERSIONS.includes(Number(version));
export const isInitialVersion = (version) => INITIAL_VERSIONS.includes(Number(version));
export const dossierKindOf = (version) => KIND_BY_VERSION[Number(version)] || null;

// ───────────── Champs du dossier (noms de champs du Dossier Médical Avancé) ─────────────

// Coordonnées modifiables SANS payer (profil ou mise à jour) : nom, prénoms, téléphone, Discord, adresse (ville et code postal compris).
export const FREE_FIELDS = ['patientFirstName', 'patientMiddleName', 'patientLastName', 'patientPH', 'patientDiscord', 'patientAddress', 'patientZIP', 'patientZIPCity'];
// Identité qui ne change que par un formulaire payé (le titre suit la date de naissance : mineur ou non).
export const PAID_IDENTITY_FIELDS = ['patientTitle', 'patientDateOfBirth', 'patientGender', 'patientRace'];
export const IDENTITY_FIELDS = [...FREE_FIELDS, ...PAID_IDENTITY_FIELDS];
export const EMAIL_FIELD = 'patientEmail'; // ne se change que dans « Mon profil » (jamais par un formulaire)

export const EMERGENCY_FIELDS = [
    'patientEmergencyContact', 'patientEmergencyContactTitle', 'patientEmergencyContactFirstName', 'patientEmergencyContactMiddleName',
    'patientEmergencyContactLastName', 'patientEmergencyContactRelation', 'patientEmergencyContactNumber', 'patientEmergencyContactDiscord',
];
export const MEDICAL_FIELDS = ['patientBloodType', 'patientAllergies', 'patientCurrentMedicine', 'patientChronicDiseases', 'patientNotes'];
export const MENTAL_FIELDS = ['patientMental', 'patientTherapy', 'patientTriggers', 'patientSupport', 'patientHarm'];
export const FAMILY_FIELDS = ['patientFam', 'patientGenetic', 'patientFamSocial'];
export const SOCIAL_FIELDS = ['maritalStatus', 'numberChildren', 'patientReligion', 'financialStatus'];
export const LIFESTYLE_FIELDS = ['patientSmoker', 'patientAlcohol', 'patientDrugs', 'patientExercise', 'patientDiet', 'patientSleep', 'patientSexLife', 'patientJobRisks', 'patientHazards', 'patientOther'];
export const DIRECTIVE_FIELDS = [
    'dnr', 'dnrOrder', 'dnrOther', 'attorney', 'attorneyName', 'attorneyTitle', 'attorneyFirstName', 'attorneyMiddleName', 'attorneyLastName', 'attorneyRelation', 'attorneyPH',
];

// Ce que contient chaque formulaire initial : le basique n'a que l'identité, le contact d'urgence et le résumé médical ; l'avancé a tout.
export const BASIC_FIELDS = [...IDENTITY_FIELDS, ...EMERGENCY_FIELDS, ...MEDICAL_FIELDS];
export const ADVANCED_FIELDS = [...IDENTITY_FIELDS, ...EMERGENCY_FIELDS, ...MEDICAL_FIELDS, ...MENTAL_FIELDS, ...FAMILY_FIELDS, ...SOCIAL_FIELDS, ...LIFESTYLE_FIELDS, ...DIRECTIVE_FIELDS];
export const ALL_DOSSIER_FIELDS = ADVANCED_FIELDS;

// Sections d'une mise à jour (valeur de « UpdateMedicalFile ») -> champs qu'elles portent.
export const SECTION_FIELDS = {
    GeneralInformation: IDENTITY_FIELDS,
    EmergencyContact: EMERGENCY_FIELDS,
    'Medical History': MEDICAL_FIELDS, MedicalHistory: MEDICAL_FIELDS,
    MentalHealth: MENTAL_FIELDS,
    FamilyHistory: FAMILY_FIELDS, FamilyMedicalHistory: FAMILY_FIELDS,
    SocialInformation: SOCIAL_FIELDS,
    Lifestyle: LIFESTYLE_FIELDS, LifestyleInformation: LIFESTYLE_FIELDS,
    AdvancedDirectives: DIRECTIVE_FIELDS,
};

// Dans une mise à jour, les informations générales nouvelles portent le suffixe « New ».
export const NEW_KEY = {
    patientTitle: 'patientTitleNew', patientFirstName: 'patientFirstNameNew', patientMiddleName: 'patientMiddleNameNew', patientLastName: 'patientLastNameNew',
    patientDateOfBirth: 'patientDateOfBirthNew', patientAddress: 'patientAddressNew', patientZIP: 'patientZIPNew', patientZIPCity: 'patientZIPNewCity',
    patientGender: 'patientGenderNew', patientRace: 'patientRaceNew', patientPH: 'patientPHNew', patientDiscord: 'patientDiscordNew',
};

const filled = (value) => (Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '');
const isArray = (value) => Array.isArray(value);

// Sections choisies d'une mise à jour.
export const updateSections = (data) => (isArray(data?.UpdateMedicalFile) ? data.UpdateMedicalFile : []).filter((section) => SECTION_FIELDS[section]);

// Valeurs que le formulaire apporte au dossier : { values: { champ: valeur }, paidIdentityTouched: bool }.
//   Formulaire initial : tout champ renseigné (un champ laissé vide n'efface jamais le dossier).
//   Mise à jour : les champs des sections choisies, y compris ceux que le patient a vidés (il corrige son dossier).
export const extractDossierValues = (version, data = {}) => {
    const number = Number(version);
    const values = {};
    if (number === BASIC_VERSION || number === ADVANCED_VERSION) {
        (number === BASIC_VERSION ? BASIC_FIELDS : ADVANCED_FIELDS).forEach((key) => { if (filled(data[key])) values[key] = data[key]; });
    } else if (number === UPDATE_VERSION) {
        updateSections(data).forEach((section) => {
            SECTION_FIELDS[section].forEach((key) => {
                const source = section === 'GeneralInformation' ? NEW_KEY[key] : key;
                if (source && Object.prototype.hasOwnProperty.call(data, source) && data[source] !== undefined && data[source] !== null) values[key] = data[source];
            });
        });
    }
    const paidIdentityTouched = PAID_IDENTITY_FIELDS.some((key) => number === UPDATE_VERSION && key in values && filled(values[key]));
    return { values, paidIdentityTouched };
};

// Une mise à jour GRATUITE : uniquement les informations générales, sans identité payante (date de naissance, genre, origine, titre).
export const isContactOnlyUpdate = (data = {}) => {
    const sections = updateSections(data);
    if (sections.length !== 1 || sections[0] !== 'GeneralInformation') return false;
    return !extractDossierValues(UPDATE_VERSION, data).paidIdentityTouched;
};

// Champs d'identité du dossier -> profil du compte (civilians/{uid}) : le profil garde la même identité que le dossier (beaucoup de code la lit).
export const PROFILE_FIELD_OF = {
    patientFirstName: 'firstName', patientMiddleName: 'middleName', patientLastName: 'lastName', patientDateOfBirth: 'dateOfBirth', patientGender: 'gender',
    patientAddress: 'address', patientZIP: 'zip', patientPH: 'phone', patientDiscord: 'discord',
};
export const profilePatch = (values = {}) => {
    const patch = {};
    Object.entries(PROFILE_FIELD_OF).forEach(([field, profileKey]) => { if (field in values) patch[profileKey] = values[field] === undefined ? '' : values[field]; });
    return patch;
};

// ───────────── Délais et phases d'un formulaire ─────────────

// invoice : { statut: 'a_payer' | 'paye' | 'sans_paiement', payeLe } ou null (pas de facture : formulaire gratuit).
// Retourne { phase, startAt, lockAt }.
//   'brouillon'  : à payer, rien n'est appliqué, le patient (créateur) peut tout modifier et supprimer ;
//   'fenetre'    : payé ou gratuit depuis moins de 15 minutes : modifiable et supprimable par son créateur, pas encore appliqué ;
//   'verrouille' : 15 minutes écoulées : appliqué au dossier, plus modifiable ni supprimable (sauf par un administrateur).
export const formPhase = ({ createdAt, invoice, immediate = false }, now = Date.now()) => {
    const status = invoice ? invoice.statut : 'sans_paiement';
    if (status === 'a_payer') return { phase: 'brouillon', startAt: null, lockAt: null };
    const startAt = status === 'paye' ? (Number(invoice.payeLe) || Number(createdAt) || now) : (Number(createdAt) || now);
    const lockAt = immediate ? startAt : startAt + DOSSIER_WINDOW_MS;
    return { phase: now >= lockAt ? 'verrouille' : 'fenetre', startAt, lockAt };
};

// ───────────── Accès aux formulaires du dossier ─────────────

// forms : formulaires de dossier ENCORE EXISTANTS du patient : [{ key, version, createur: 'patient' | 'personnel', phase }].
// dossier : le dossier persistant ({ initial }) ou null. Retourne ce que le patient (ou le personnel pour lui) peut ouvrir.
export const dossierAccess = ({ forms = [], dossier = null }) => {
    const initialForm = forms.find((form) => isInitialVersion(form.version)) || null;
    const initialised = !!dossier?.initial || (!!initialForm && initialForm.phase === 'verrouille');
    return {
        initialised,
        initialForm,
        // Aucun dossier initial (ni en brouillon, ni en cours, ni appliqué) : on choisit basique OU avancé.
        canCreateBasic: !initialForm && !dossier?.initial,
        canCreateAdvanced: !initialForm && !dossier?.initial,
        // La mise à jour n'existe qu'une fois le dossier initial appliqué.
        canCreateUpdate: initialised,
    };
};

// Le formulaire peut-il être modifié / supprimé par cette personne ? actor : { role: 'patient' | 'personnel' | 'admin', isCreator }.
export const canModifyForm = (form, actor) => {
    if (actor.role === 'admin') return { edit: true, remove: true };
    if (form.phase === 'verrouille') return { edit: false, remove: false };
    if (form.createur === 'patient') return actor.role === 'patient' ? { edit: true, remove: true } : { edit: false, remove: false };
    // Créé par le personnel : brouillon modifiable et supprimable par son créateur ; le patient n'y touche pas. Pour un patient SANS COMPTE (formulaire gratuit,
    // personne à qui envoyer une facture), le créateur dispose du même délai de 15 minutes.
    if (actor.role === 'personnel' && actor.isCreator && (form.phase === 'brouillon' || (form.sansCompte === true && form.phase === 'fenetre'))) return { edit: true, remove: true };
    return { edit: false, remove: false };
};

// ───────────── Jetons gratuits ─────────────

export const emptyTokens = () => ({ basique: 0, avance: 0, maj: 0 });
export const hasToken = (tokens, version) => Number(tokens?.[dossierKindOf(version)] || 0) > 0;

// Quand le formulaire supprimé dans le délai rend un jeton : s'il avait été PAYÉ (ou lui-même gratuit par jeton), par son patient, avant d'être appliqué.
export const refundsToken = ({ createur, invoice, usedToken }) => createur === 'patient' && (usedToken === true || (!!invoice && invoice.statut === 'paye'));
