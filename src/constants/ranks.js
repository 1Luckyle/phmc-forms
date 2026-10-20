// src/constants/ranks.js
//
// Référentiel des FAMILLES et des RÔLES du personnel — tout en français, y compris dans la base :
// la valeur stockée dans `rank` / `category` d'une fiche est le libellé français du rôle, rédigé de
// façon NEUTRE (ex. « Infirmier(ère) », « Médecin Titulaire »). Les anciennes valeurs anglaises (« Registered Nurse »…) sont
// reconnues via LEGACY_RANK_MAP / normalizeRank() tant que la migration (panneau admin →
// Utilisateurs → Outils → « Rôles en français ») n'a pas été lancée.
//
// Deux grandes familles de comptes :
//   • Civil (compte Civil pur, hors de ce fichier) ;
//   • Personnel, lui-même découpé en 4 « familles » (champ `pole` de la fiche) :
//       PHMC · Soignant | PHMC · Administration & Direction | PHMC · Polyvalent | DMEC · Médecine légale
//     Les 3 familles PHMC vivent dans la liste staff/phmc, DMEC dans staff/coroner.
// Le droit « Recruteur » n'est PAS un rôle : c'est une case indépendante (recruiterUIDs) qu'un membre
// de n'importe quelle famille peut avoir ; « Chargé de Recrutement » n'en est que le rôle par défaut.
//
// Chaque rôle appartient à UNE famille : la famille d'une fiche se déduit donc de son rôle.
// Le préfixe de badge des rôles déjà existants est conservé (MD, RN, NP…) pour ne casser aucun ID.

export const STAFF_FAMILIES = {
    soignant: {
        key: 'soignant', service: 'phmc', label: 'PHMC · Soignant', short: 'Soignant', badge: 'primary',
        description: 'Médecins, infirmiers, paramédicaux et autres professions de santé',
    },
    administration: {
        key: 'administration', service: 'phmc', label: 'PHMC · Administration & Direction', short: 'Administration', badge: 'warning',
        description: 'Direction, administration, ressources humaines et recrutement',
    },
    polyvalent: {
        key: 'polyvalent', service: 'phmc', label: 'PHMC · Polyvalent', short: 'Polyvalent', badge: 'secondary',
        description: 'Logistique, sécurité, agents de maîtrise et des services hospitaliers',
    },
    dmec: {
        key: 'dmec', service: 'coroner', label: 'DMEC · Médecine légale', short: 'DMEC', badge: 'dark',
        description: 'Département de médecine légale',
    },
};

// Famille par défaut selon la liste (service) quand une fiche n'a ni `pole` ni rôle reconnu.
export const DEFAULT_FAMILY_OF_SERVICE = { phmc: 'soignant', coroner: 'dmec' };

// Rôles, du plus élevé au moins élevé dans chaque filière. `filiere` regroupe les rôles à l'affichage.
export const ROLES = [
    // ── PHMC · Soignant ──
    { value: 'Chef de Service', badgePrefix: 'CS', pole: 'soignant', filiere: 'Encadrement', needsServiceDirige: true },
    { value: 'Médecin Titulaire', badgePrefix: 'MD', pole: 'soignant', filiere: 'Médecine', doctor: true },
    { value: 'Psychiatre', badgePrefix: 'PY', pole: 'soignant', filiere: 'Médecine', doctor: true },
    { value: 'Assistant(e) Médecin', badgePrefix: 'AMD', pole: 'soignant', filiere: 'Médecine' },
    { value: 'Chirurgien(ne)', badgePrefix: 'SG', pole: 'soignant', filiere: 'Médecine', doctor: true },
    { value: 'Docteur Junior', badgePrefix: 'DJ', pole: 'soignant', filiere: 'Médecine', doctor: true },
    { value: 'Interne en Médecine', badgePrefix: 'IN', pole: 'soignant', filiere: 'Médecine' },
    { value: 'Externe / Étudiant(e) en Médecine', badgePrefix: 'SI', pole: 'soignant', filiere: 'Médecine' },
    { value: 'Infirmier(ère) en Pratique Avancée', badgePrefix: 'NP', pole: 'soignant', filiere: 'Infirmier' },
    { value: 'Infirmier(ère)', badgePrefix: 'RN', pole: 'soignant', filiere: 'Infirmier' },
    { value: 'Aide Soignant(e)', badgePrefix: 'NI', pole: 'soignant', filiere: 'Infirmier' },
    { value: 'Externe / Étudiant(e) Infirmier(ère)', badgePrefix: 'SN', pole: 'soignant', filiere: 'Infirmier' },
    { value: 'Paramedic', badgePrefix: 'PM', pole: 'soignant', filiere: 'Paramédical' },
    { value: 'Technicien(ne) Ambulancier(ère) (EMT)', badgePrefix: 'EMT', pole: 'soignant', filiere: 'Paramédical' },
    { value: 'Externe / Étudiant(e) Paramédical(e)', badgePrefix: 'EP', pole: 'soignant', filiere: 'Paramédical' },
    { value: 'Psychologue', badgePrefix: 'PS', pole: 'soignant', filiere: 'Autres professions de santé' },
    { value: 'Pharmacien(ne)', badgePrefix: 'PH', pole: 'soignant', filiere: 'Autres professions de santé' },
    { value: 'Kinésithérapeute', badgePrefix: 'PT', pole: 'soignant', filiere: 'Autres professions de santé' },
    { value: 'Dentiste', badgePrefix: 'DT', pole: 'soignant', filiere: 'Autres professions de santé' },
    // ── PHMC · Administration & Direction ──
    { value: 'Directeur(trice)', badgePrefix: 'DIR', pole: 'administration', filiere: 'Direction' },
    { value: 'Assistant(e) de Direction', badgePrefix: 'AD', pole: 'administration', filiere: 'Direction' },
    { value: 'Personnel Administratif', badgePrefix: 'PA', pole: 'administration', filiere: 'Administration' },
    { value: 'Chargé(e) de Recrutement', badgePrefix: 'RH', pole: 'administration', filiere: 'Administration' },
    // ── PHMC · Polyvalent ──
    { value: 'Agent Maîtrise', badgePrefix: 'AM', pole: 'polyvalent', filiere: 'Personnel non soignant' },
    { value: 'Personnel Polyvalent', badgePrefix: 'PP', pole: 'polyvalent', filiere: 'Personnel non soignant' },
    // ── DMEC · Médecine légale ──
    { value: 'Médecin Légiste', badgePrefix: 'ME', pole: 'dmec', filiere: 'Médecine légale', doctor: true },
    { value: 'Enquêteur(trice) Médico-Légal(e)', badgePrefix: 'IV', pole: 'dmec', filiere: 'Médecine légale' },
    { value: 'Interne Médico-Légal(e)', badgePrefix: 'IN', pole: 'dmec', filiere: 'Médecine légale' },
    { value: 'Stagiaire Médico-Légal(e)', badgePrefix: 'TF', pole: 'dmec', filiere: 'Médecine légale' },
].map((role) => ({ ...role, label: role.value }));

// Anciennes valeurs (anglicismes) -> rôle français. Utilisé à la lecture (rien ne casse avant la
// migration) et par l'outil de migration. `ambiguous` : le rôle d'origine n'a pas d'équivalent
// certain, la migration le signale pour vérification.
export const LEGACY_RANK_MAP = {
    'Student Nurse': { to: 'Externe / Étudiant(e) Infirmier(ère)' },
    'Nurse': { to: 'Aide Soignant(e)', ambiguous: true },                 // ancien « Interne Infirmier(ère) »
    'Registered Nurse': { to: 'Infirmier(ère)' },
    'NP': { to: 'Infirmier(ère) en Pratique Avancée' },
    'SubIntern': { to: 'Externe / Étudiant(e) en Médecine' },
    'Intern': { to: 'Interne en Médecine' },
    'Physician': { to: 'Médecin Titulaire', ambiguous: true },          // ou « Docteur Junior »
    'Surgeon': { to: 'Chirurgien(ne)' },
    'Pharmacist': { to: 'Pharmacien(ne)' },
    'Physical Therapist': { to: 'Kinésithérapeute' },
    'Psych': { to: 'Psychologue' },
    'Trainee Forensic Attendant': { to: 'Stagiaire Médico-Légal(e)' },
    'Coroner Internship': { to: 'Interne Médico-Légal(e)' },
    'Coroner Investigator': { to: 'Enquêteur(trice) Médico-Légal(e)' },
    'Medical Examiner': { to: 'Médecin Légiste' },
};

// Valeur française d'un rôle (identité si déjà française ou inconnue).
// Premières formes françaises (avant le passage au neutre) : reconnues aussi, la migration les met à jour.
Object.assign(LEGACY_RANK_MAP, {
    'Chirurgien': { to: 'Chirurgien(ne)' },
    'Externe / Étudiant en Médecine': { to: 'Externe / Étudiant(e) en Médecine' },
    'Infirmier en Pratique Avancée': { to: 'Infirmier(ère) en Pratique Avancée' },
    'Infirmier': { to: 'Infirmier(ère)' },
    'Aide Soignant': { to: 'Aide Soignant(e)' },
    'Externe / Étudiant Infirmier': { to: 'Externe / Étudiant(e) Infirmier(ère)' },
    'Technicien Ambulancier (EMT)': { to: 'Technicien(ne) Ambulancier(ère) (EMT)' },
    'Externe / Étudiant Paramédical': { to: 'Externe / Étudiant(e) Paramédical(e)' },
    'Pharmacien': { to: 'Pharmacien(ne)' },
    'Directrice': { to: 'Directeur(trice)' },
    'Assistante de Direction': { to: 'Assistant(e) de Direction' },
    'Chargé de Recrutement': { to: 'Chargé(e) de Recrutement' },
    'Enquêteur Médico-Légal': { to: 'Enquêteur(trice) Médico-Légal(e)' },
    'Interne Médico-Légal': { to: 'Interne Médico-Légal(e)' },
    'Stagiaire Médico-Légal': { to: 'Stagiaire Médico-Légal(e)' },
});

export const normalizeRank = (value) => LEGACY_RANK_MAP[value]?.to || value;

export const ROLE_BY_VALUE = Object.fromEntries(ROLES.map((role) => [role.value, role]));
export const getRoleInfo = (value) => ROLE_BY_VALUE[normalizeRank(value)] || null;

// Listes à plat par liste du personnel (staff/phmc, staff/coroner), pour les sélecteurs existants.
// Même forme qu'avant ({ label, value, badgePrefix }) + pole / filiere.
export const PHMC_RANKS = ROLES.filter((role) => role.pole !== 'dmec');
export const CORONER_RANKS = ROLES.filter((role) => role.pole === 'dmec');

// Rôle proposé par défaut à la création.
export const DEFAULT_PHMC_RANK = 'Personnel Polyvalent';
export const DEFAULT_CORONER_RANK = 'Stagiaire Médico-Légal(e)';
// Rôle donné par défaut à un recruteur promu au rang de personnel.
export const RECRUITER_DEFAULT_RANK = 'Chargé(e) de Recrutement';

// Famille d'une fiche : déduite de son rôle (le champ `pole` n'en est qu'une copie, utilisée si le rôle est inconnu), sinon de la liste.
export const familyOfMember = (member, service) => {
    const fromRole = getRoleInfo(member?.rank || member?.category)?.pole;
    if (fromRole) return fromRole;
    if (member?.pole && STAFF_FAMILIES[member.pole]) return member.pole;
    return DEFAULT_FAMILY_OF_SERVICE[service] || 'soignant';
};

// CUMUL de rôles : une fiche a un rôle principal (`rank`, qui fixe aussi le préfixe de badge) et peut avoir des rôles
// SUPPLÉMENTAIRES (`extraRanks`), de n'importe quelle famille — ex. Médecin Titulaire + Directeur(trice), ou un
// membre du DMEC avec un rôle d'administration. Valeurs normalisées, sans doublon ni rôle principal, rôles connus seulement.
export const cleanExtraRanks = (extraRanks, mainRank) => {
    const main = normalizeRank(mainRank);
    const list = Array.isArray(extraRanks) ? extraRanks : Object.values(extraRanks || {});
    return [...new Set(list.map(normalizeRank))].filter((value) => value !== main && ROLE_BY_VALUE[value]);
};

export const extraRanksOf = (member) => cleanExtraRanks(member?.extraRanks, member?.rank || member?.category);

// Toutes les familles d'une fiche : celle du rôle principal d'abord, puis celles des rôles supplémentaires.
export const familiesOfMember = (member, service) => {
    const families = [familyOfMember(member, service)];
    extraRanksOf(member).forEach((value) => {
        const family = getRoleInfo(value)?.pole;
        if (family && !families.includes(family)) families.push(family);
    });
    return families;
};

export const familyOfRank = (rank, service) => getRoleInfo(rank)?.pole || DEFAULT_FAMILY_OF_SERVICE[service] || 'soignant';

// Rôles d'une famille groupés par filière : [{ filiere, roles: [...] }] (ordre du référentiel).
export const rolesByFiliere = (familyKey) => {
    const groups = [];
    ROLES.filter((role) => role.pole === familyKey).forEach((role) => {
        let group = groups.find((entry) => entry.filiere === role.filiere);
        if (!group) { group = { filiere: role.filiere, roles: [] }; groups.push(group); }
        group.roles.push(role);
    });
    return groups;
};

// Ordre hiérarchique (pour trier les listes : famille, puis rôle du plus élevé au moins élevé).
const FAMILY_ORDER = ['soignant', 'administration', 'polyvalent', 'dmec'];
export const sortKeyOfRank = (rank, service) => {
    const role = getRoleInfo(rank);
    const family = role?.pole || DEFAULT_FAMILY_OF_SERVICE[service] || 'soignant';
    return FAMILY_ORDER.indexOf(family) * 1000 + (role ? ROLES.indexOf(role) : 999);
};

// Propositions pour « service dirigé » d'un Chef de Service (champ libre : on peut aussi écrire autre chose).
export const SERVICE_DIRIGE_SUGGESTIONS = [
    'Urgences', 'Médecine Interne', 'Chirurgie', 'Bloc Opératoire', 'Soins Intensifs / Réanimation',
    'Pédiatrie', 'Maternité / Gynécologie', 'Psychiatrie', 'Psychologie', 'Cardiologie', 'Gériatrie',
    'Radiologie / Imagerie', 'Laboratoire', 'Pharmacie', 'Soins Infirmiers', 'Secours / Paramédical (EMS)',
];

// Grades pour lesquels un titre (Dr./Pr.) peut être ajouté devant le prénom.
export const DOCTOR_RANKS = ROLES.filter((role) => role.doctor).map((role) => role.value);

export const TITLE_PREFIXES = ["Dr.", "Pr."];

// Ajoute/retire le titre directement dans le champ prénom lui-même (pas de
// champ séparé à gérer côté BBCode/affichage) : on retire d'abord tout titre
// déjà présent avant d'appliquer le nouveau, pour éviter "Dr. Pr. Nom".
export const applyTitlePrefix = (firstName, title) => {
  const stripped = (firstName || '').replace(/^(Dr\.|Pr\.)\s+/, '');
  return title ? `${title} ${stripped}`.trim() : stripped;
};

// Retourne le titre actuellement présent dans le prénom ("Dr.", "Pr." ou null).
export const getTitlePrefix = (firstName) => {
  const match = /^(Dr\.|Pr\.)\s+/.exec(firstName || '');
  return match ? match[1] : null;
};
