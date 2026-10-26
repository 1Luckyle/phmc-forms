// src/constants/recruitment.js
//
// Référentiel CENTRAL du recrutement, en français, relié aux rôles du personnel (constants/ranks.js).
//
// Rappel des correspondances :
//   catégorie de recrutement  →  nœud de la base  →  famille(s) du personnel
//   Médecine                  →  selectOptions/postesMedecine         → PHMC Soignant
//   Psychologie & Psychiatrie →  selectOptions/postesPsychologie      → PHMC Soignant
//   Administration & Services →  selectOptions/postesAdministration   → PHMC Administration / Polyvalent
//   Soins infirmiers          →  selectOptions/postesSoinsInfirmiers  → PHMC Soignant
//   Paramédical (EMS)         →  selectOptions/postesParamedical      → PHMC Soignant
//   Médecine légale (DMEC)    →  selectOptions/postesMedecineLegale   → DMEC
//
// Chaque POSTE porte un champ `role` : le rôle du personnel obtenu à l'embauche. Il alimente ensuite
// la conversion d'un candidat accepté en membre du personnel et la rédaction de son contrat, pour que
// recrutement, gestion des utilisateurs et contrats parlent des mêmes rôles.
//
import { normalizeRank } from './ranks';

// Les anciennes données (nœuds et champs anglais : physicianRecruitmentDetails, displayName, status « OPEN »…)
// restent lues grâce aux normaliseurs ci-dessous tant que la migration (panneau admin → Utilisateurs →
// Outils → « Recrutement en français ») n'a pas été faite.

export const RECRUITMENT_CATEGORIES = [
    {
        key: 'medecine', label: 'Médecine', title: 'Postes Médicaux', bbCodeVersion: 50, family: 'soignant',
        node: 'postesMedecine', legacyNode: 'physicianRecruitmentDetails', legacyGroup: 'Physician', legacyKey: 'physician',
    },
    {
        key: 'psychologie', label: 'Psychologie & Psychiatrie', title: 'Postes Psychologue/Psychiatre', bbCodeVersion: 51, family: 'soignant',
        node: 'postesPsychologie', legacyNode: 'psychPositionDetailsData', legacyGroup: 'Psych', legacyKey: 'psych',
    },
    {
        key: 'administration', label: 'Administration & Services', title: 'Postes Administratifs', bbCodeVersion: 52, family: 'administration',
        node: 'postesAdministration', legacyNode: 'adminPositionDetailsData', legacyGroup: 'Admin', legacyKey: 'admin',
    },
    {
        key: 'soinsInfirmiers', label: 'Soins infirmiers', title: 'Postes Infirmiers', bbCodeVersion: 53, family: 'soignant',
        node: 'postesSoinsInfirmiers', legacyNode: 'nursePositionDetailsData', legacyGroup: 'Nurse', legacyKey: 'nursing',
    },
    {
        key: 'medecineLegale', label: 'Médecine légale (DMEC)', title: 'Postes DMEC', bbCodeVersion: 54, family: 'dmec',
        node: 'postesMedecineLegale', legacyNode: 'coronerPositionDetailsData', legacyGroup: 'Coroner', legacyKey: 'coroner',
    },
    {
        key: 'paramedical', label: 'Paramédical (EMS)', title: 'Postes EMS', bbCodeVersion: 55, family: 'soignant',
        node: 'postesParamedical', legacyNode: 'emsPositionDetailsData', legacyGroup: 'EMS', legacyKey: 'ems',
    },
];

export const CATEGORY_BY_KEY = Object.fromEntries(RECRUITMENT_CATEGORIES.map((category) => [category.key, category]));
export const CATEGORY_BY_BBCODE_VERSION = Object.fromEntries(RECRUITMENT_CATEGORIES.map((category) => [category.bbCodeVersion, category]));
export const CATEGORY_BY_LEGACY_KEY = Object.fromEntries(RECRUITMENT_CATEGORIES.map((category) => [category.legacyKey, category]));

// ───────────────────────────── Postes ─────────────────────────────
export const STATUT_OUVERT = 'OUVERT';
export const STATUT_FERME = 'FERMÉ';

// Ancien champ → nouveau champ d'un poste.
export const LEGACY_POSITION_FIELDS = {
    displayName: 'nom',
    group: 'groupe',
    status: 'statut',
    poc: 'contact',
    shortCode: 'codeCourt',
    url: 'lien',
    Overview: 'presentation',
    skill1: 'competence1',
    skill2: 'competence2',
    skill3: 'competence3',
    EduRequirement: 'diplome',
};

const pickText = (value) => (value === undefined || value === null ? '' : String(value));

// Poste au format FRANÇAIS, à partir d'une entrée de la base (ancienne ou nouvelle forme).
// `categoryKey` : catégorie à laquelle il appartient (le groupe stocké en base n'est qu'un rappel).
export const normalizePosition = (raw, categoryKey, key = null) => {
    const source = raw || {};
    const legacyStatus = source.status;
    const statut = source.statut
        ? (String(source.statut).toUpperCase().startsWith('F') ? STATUT_FERME : STATUT_OUVERT)
        : (legacyStatus === 'CLOSED' ? STATUT_FERME : (legacyStatus === 'OPEN' ? STATUT_OUVERT : ''));
    const read = (frenchField, legacyField) => pickText(source[frenchField] ?? source[legacyField]);
    return {
        cle: key,
        nom: read('nom', 'displayName') || key || '',
        groupe: categoryKey,
        statut,
        contact: read('contact', 'poc'),
        codeCourt: read('codeCourt', 'shortCode'),
        lien: read('lien', 'url'),
        presentation: read('presentation', 'Overview'),
        competence1: read('competence1', 'skill1'),
        competence2: read('competence2', 'skill2'),
        competence3: read('competence3', 'skill3'),
        diplome: read('diplome', 'EduRequirement'),
        // Rôle du personnel obtenu à l'embauche (valeur du référentiel ranks.js) ; vide tant qu'aucun n'est choisi.
        role: pickText(source.role),
    };
};

export const isPositionOpen = (position) => position?.statut === STATUT_OUVERT;
export const isPositionClosed = (position) => position?.statut === STATUT_FERME;

// Retour à l'ancien format (anglais), pour ÉCRIRE dans un nœud encore ancien (avant migration) sans le mélanger.
export const toLegacyPosition = (position, legacyGroup) => ({
    displayName: position.nom,
    group: legacyGroup,
    status: position.statut === STATUT_FERME ? 'CLOSED' : 'OPEN',
    poc: position.contact,
    shortCode: position.codeCourt,
    url: position.lien,
    Overview: position.presentation,
    skill1: position.competence1,
    skill2: position.competence2,
    skill3: position.competence3,
    EduRequirement: position.diplome,
    ...(position.role ? { role: position.role } : {}),
});

// Poste à écrire dans un nœud FRANÇAIS (sans champ `cle`, qui n'est que la clé du nœud).
export const toStoredPosition = (position) => {
    const { cle, ...rest } = position; // eslint-disable-line no-unused-vars
    return rest;
};

// Clé de nœud sûre pour Firebase à partir du nom français du poste.
export const makePositionKey = (name) => String(name || '').trim().replace(/[.#$[\]/]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

// ───────────────────────────── Candidatures ─────────────────────────────
// Statuts d'une candidature, en français (anciennes valeurs reconnues).
export const APPLICATION_STATUS = {
    brouillon: { label: 'Brouillon (non soumise)', legacy: 'saved' },
    soumise: { label: 'Candidature soumise', legacy: 'submitted' },
    en_examen: { label: "En cours d'examen", legacy: 'under_review' },
    entretien_programme: { label: 'Entretien programmé', legacy: 'interview_scheduled' },
    entretien_effectue: { label: 'Entretien effectué', legacy: 'interview_completed' },
    acceptee: { label: 'Acceptée', legacy: 'accepted' },
    refusee: { label: 'Refusée', legacy: 'refused' },
    retiree: { label: 'Retirée par le candidat', legacy: 'withdrawn' },
    en_pause: { label: 'En pause', legacy: 'paused' },
};
// Couleur de la pastille de chaque statut (interfaces de suivi, côté recrutement et côté candidat).
export const APPLICATION_STATUS_COLORS = {
    brouillon: '#8b949e', soumise: '#58a6ff', en_examen: '#a371f7', entretien_programme: '#d29922', entretien_effectue: '#db6d28',
    acceptee: '#3fb950', refusee: '#f85149', retiree: '#6e7681', en_pause: '#8b949e',
};
// Tant que la candidature est dans l'un de ces statuts, candidat et recruteur peuvent échanger (voir utils/applicationThreads.js).
// Le fil se ferme au refus, ou à la signature du contrat d'une candidature acceptée.
export const THREAD_OPEN_STATUSES = ['en_examen', 'entretien_programme', 'entretien_effectue', 'acceptee'];

// Motifs de refus proposés au recruteur (il peut aussi écrire le sien) : le candidat reçoit toujours une justification.
export const REFUSAL_REASONS = [
    'Dossier incomplet ou informations manquantes',
    'Profil ne correspondant pas au poste',
    'Expérience insuffisante pour ce poste',
    'Lettre de motivation insuffisante',
    "Entretien non concluant",
    "Poste déjà pourvu",
    "Candidature non conforme au règlement (RP/HRP)",
];

const LEGACY_APPLICATION_STATUS = Object.fromEntries(Object.entries(APPLICATION_STATUS).map(([key, value]) => [value.legacy, key]));
export const normalizeApplicationStatus = (value) => (APPLICATION_STATUS[value] ? value : (LEGACY_APPLICATION_STATUS[value] || value));
export const applicationStatusLabel = (value) => APPLICATION_STATUS[normalizeApplicationStatus(value)]?.label || value;

// Candidature au format FRANÇAIS (ancienne ou nouvelle forme en base). `id` : identifiant de la candidature.
export const normalizeApplication = (raw, id = null, uid = null) => {
    const source = raw || {};
    const history = source.historique || source.history || [];
    const list = Array.isArray(history) ? history : Object.values(history);
    return {
        id: id ?? source.id ?? null,
        candidatUid: source.candidatUid ?? source.applicantUid ?? uid,
        idPatient: source.idPatient ?? source.patientID ?? '',
        nomCandidat: source.nomCandidat ?? source.applicantName ?? '',
        poste: source.poste ?? source.position ?? '',
        interne: source.interne === true,     // candidature d'un employé (statut de recrutement interne)
        posteCle: source.posteCle ?? null,   // clé du poste (le champ `poste` porte son libellé depuis la v. française)
        versionBBCode: source.versionBBCode ?? source.bbCodeVersion ?? null,
        donnees: source.donnees ?? source.data ?? {},
        bbcode: source.bbcode ?? source.bbCode ?? '',
        statut: normalizeApplicationStatus(source.statut ?? source.status),
        refus: source.refus ?? null,                         // { motif, detail, parNom, le } : justification d'un refus
        priseEnChargePar: source.priseEnChargePar ?? null,   // { uid, nom, le } : recruteur qui examine la candidature
        dateEntretien: source.dateEntretien ?? source.interviewDateTime ?? null,
        creeLe: source.creeLe ?? source.createdAt ?? null,
        modifieLe: source.modifieLe ?? source.updatedAt ?? null,
        historique: list.map((entry) => ({
            statut: normalizeApplicationStatus(entry.statut ?? entry.status),
            horodatage: entry.horodatage ?? entry.timestamp ?? null,
        })),
    };
};

// Libellé affiché d'un poste : `value` peut être la CLÉ du poste (souvent anglaise : « Attending Physician ») ou déjà son
// nom ; on retrouve le poste dans la catégorie du formulaire (ou, à défaut, dans toutes) et on rend son `nom` français.
export const positionLabelFor = (selectOptions, versionBBCode, value) => {
    if (!value) return '';
    const own = CATEGORY_BY_BBCODE_VERSION[versionBBCode];
    const categories = own ? [own] : RECRUITMENT_CATEGORIES;
    for (const category of categories) {
        const positions = getCategoryPositions(selectOptions, category.key);
        const direct = positions[value];
        if (direct?.nom) return direct.nom;
        const byKey = Object.values(positions).find((position) => position.cle === value || position.nom === value);
        if (byKey?.nom) return byKey.nom;
    }
    return value;
};

// Candidature à écrire en base (champs français uniquement).
export const toStoredApplication = (application) => {
    const { id, ...rest } = application; // eslint-disable-line no-unused-vars
    return rest;
};

// ───────────────────────────── Lecture depuis selectOptions ─────────────────────────────
const hasEntries = (value) => !!value && typeof value === 'object' && Object.keys(value).length > 0;

// À partir de l'objet selectOptions déjà chargé par l'application : { [catégorie]: { [clé]: poste français } }.
// Par catégorie, dès que le nœud français contient des postes c'est lui qui fait foi, sinon l'ancien nœud anglais.
export const positionsFromSelectOptions = (selectOptions) => {
    const result = {};
    RECRUITMENT_CATEGORIES.forEach((category) => {
        const raw = hasEntries(selectOptions?.[category.node]) ? selectOptions[category.node] : (selectOptions?.[category.legacyNode] || {});
        result[category.key] = Object.fromEntries(
            Object.entries(raw).map(([key, value]) => [key, normalizePosition(value, category.key, key)])
        );
    });
    return result;
};

export const getCategoryPositions = (selectOptions, categoryKey) => positionsFromSelectOptions(selectOptions)[categoryKey] || {};

// Le poste `key` est-il l'un de ceux visés ? Un poste est reconnu par son RÔLE du personnel (champ `role`, durable
// même si on renomme le poste) ou, à défaut, par l'une de ses clés connues (anciennes clés anglaises comprises).
// Sert aux formulaires et générateurs de candidature dont la mise en page dépend du poste.
export const matchesPosition = (positionsMap, key, { roles = [], keys = [] }) => {
    if (!key) return false;
    if (keys.includes(key)) return true;
    const role = positionsMap?.[key]?.role;
    return !!role && roles.map(normalizeRank).includes(normalizeRank(role));
};
