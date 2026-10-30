// src/utils/viewAs.js
//
// « Visualiser en tant que… » (panneau admin → Debug), à la manière de Discord : un administrateur
// choisit un profil (visiteur, civil, candidat en attente de contrat, un rôle du personnel, avec ou sans
// droit Recruteur) et l'INTERFACE s'affiche comme pour ce profil — menu de la Boîte à outils, boutons,
// formulaires réservés.
//
// Limites (à garder en tête) :
//   • c'est une simulation d'AFFICHAGE : les règles Firebase restent celles du vrai compte admin, donc
//     un refus « permission denied » réel pour ce rôle ne peut pas être reproduit ici ;
//   • l'enregistrement de rapports est désactivé pendant la simulation (voir MainApp) pour ne rien
//     écrire au nom d'un faux profil ;
//   • la simulation ne vit que dans le navigateur de l'admin (localStorage) et n'est honorée que si le
//     vrai compte est administrateur.
import { getRoleInfo, familiesOfMember, canManageFireSafety, canManageDiscipline } from '../constants/ranks';
import { getFormAccess, summarizeFormAccess } from './formAccess';

const KEY = 'debugViewAs';

export const getViewAs = () => {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const view = JSON.parse(raw);
        return view && ['visitor', 'civil', 'staff'].includes(view.kind) ? view : null;
    } catch (error) {
        return null;
    }
};

export const saveViewAs = (view) => {
    try {
        if (view) localStorage.setItem(KEY, JSON.stringify(view));
        else localStorage.removeItem(KEY);
    } catch (error) { /* stockage indisponible : sans conséquence */ }
};

export const sameView = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

// ───────────── Personnages (profils précis plutôt que rôles génériques) ─────────────
// Une vue peut porter un `character` (identifiant du personnage), un `label` et un `profile` : la fiche utilisée
// pour construire l'identité simulée à la place du profil générique « Simulation ».

// Patient de test des gabarits « Remplir (debug) » (voir utils/debugTemplates.js) : Civil PHMC-99999.
export const TEST_PATIENT_CHARACTER = 'patient-test';
export const TEST_PATIENT_VIEW = {
    kind: 'civil',
    character: TEST_PATIENT_CHARACTER,
    label: 'Jean Michel Testard',
    profile: {
        firstName: 'Jean', middleName: 'Michel', lastName: 'Testard', patientID: 'PHMC-99999',
        dateOfBirth: '1990-05-17', gender: 'Male', address: '1234 Vinewood Blvd, Los Santos', zip: '90001',
        phone: '555-0142', email: 'jean.testard@eyefind.info', discord: 'jean.testard',
    },
};

// Personnel nommé : Edmund Messina (DMEC). Sa fiche réelle est lue dans la base au moment du choix (voir
// DebugViewAs) ; s'il est introuvable, on invente un profil de médecin légiste à son nom.
export const EDMUND_CHARACTER = 'edmund-messina';
export const EDMUND_MATCH = { first: 'edmund', last: 'messina' };

// Vue « personnel » à partir d'une fiche réelle (loadStaffMembers) — `recruiter` : a-t-il le droit Recruteur.
export const buildStaffCharacterView = ({ character, member, recruiter }) => {
    const rank = member.rank || member.category;
    const role = getRoleInfo(rank);
    return {
        kind: 'staff',
        character,
        label: member.displayName || member.name,
        rank,
        recruiter: !!recruiter,
        profile: {
            name: member.name, firstName: member.firstName, lastName: member.lastName,
            rank, category: member.category || rank, pole: member.pole || role?.pole,
            badge: member.badge, type: member.service || (role?.pole === 'dmec' ? 'coroner' : 'phmc'),
            extraRanks: member.extraRanks || [], serviceDirige: member.serviceDirige || null,
            phone: member.phone || null, gtawCharacterId: member.gtawCharacterId ?? null,
        },
    };
};

// Profil inventé quand la fiche réelle n'existe pas (ou n'est pas lisible).
export const buildInventedEdmundView = () => buildStaffCharacterView({
    character: EDMUND_CHARACTER,
    member: {
        name: 'Edmund Messina', firstName: 'Edmund', lastName: 'Messina', displayName: 'Edmund Messina (profil inventé)',
        rank: 'Médecin Légiste', badge: 'TF-00001', service: 'coroner',
    },
});

// Libellé lisible d'un profil simulé.
export const describeViewAs = (view) => {
    if (!view) return 'Administrateur (vous)';
    if (view.character && view.label) {
        if (view.kind === 'civil') return `${view.label} (${view.profile?.patientID || 'Civil'})`;
        return `${view.label} — ${view.rank}${view.recruiter ? ' + droit Recruteur' : ''}`;
    }
    if (view.kind === 'visitor') return 'Visiteur non connecté';
    if (view.kind === 'civil') return view.candidate ? 'Civil — candidat en attente de contrat' : 'Civil';
    return `${view.rank}${view.recruiter ? ' + droit Recruteur' : ''}`;
};

// Identité fictive correspondant au profil simulé (même forme que celle du contexte d'authentification).
export const buildSimulatedIdentity = (view, realUser) => {
    const base = {
        currentEmployee: realUser || null,
        employeeProfile: null,
        civilianProfile: null,
        adminStaffProfile: null,
        isAdmin: false,
        isRecruiter: false,
        isContractCandidate: false,
    };
    if (view.kind === 'visitor') return { ...base, currentEmployee: null };
    if (view.kind === 'civil') {
        return {
            ...base,
            isContractCandidate: !!view.candidate,
            civilianProfile: {
                uid: realUser?.uid, email: realUser?.email, firstName: 'Simulation', lastName: 'Civil', patientID: 'PHMC-00000',
                // Personnage précis (ex. patient de test PHMC-99999) : sa fiche remplace le profil générique,
                // sauf l'identité de connexion qui reste celle du vrai compte admin (rien n'est écrit en son nom).
                ...(view.profile || {}),
            },
        };
    }
    const role = getRoleInfo(view.rank);
    const service = role?.pole === 'dmec' ? 'coroner' : 'phmc';
    return {
        ...base,
        isRecruiter: !!view.recruiter,
        employeeProfile: {
            uid: realUser?.uid, email: realUser?.email, type: service,
            name: 'Simulation Test', firstName: 'Simulation', lastName: 'Test',
            rank: view.rank, category: view.rank, pole: role?.pole, badge: `${role?.badgePrefix || 'XX'}-00000`,
            // Personnage précis (ex. Edmund Messina) : sa fiche remplace le profil générique.
            // (uid et e-mail restent ceux du vrai compte admin : le profil n'en contient pas.)
            ...(view.profile || {}),
        },
    };
};

// Valeurs dérivées d'une identité (partagées par le contexte d'authentification et l'aperçu admin).
export const deriveIdentity = ({ employeeProfile, civilianProfile, adminStaffProfile, isAdmin, isRecruiter }) => {
    const isCivilian = !isAdmin && !employeeProfile && !!civilianProfile;
    const staffProfile = employeeProfile || adminStaffProfile;
    const staffName = staffProfile
        ? (staffProfile.name
            || (staffProfile.firstName && staffProfile.lastName ? `${staffProfile.firstName} ${staffProfile.lastName}` : null))
        : null;
    const isPhmcStaff = staffProfile?.type === 'phmc';
    // Personnel SOIGNANT : famille « PHMC · Soignant » (médecins, infirmiers, paramédicaux, autres professions de
    // santé). Ni l'administration, ni le polyvalent, ni le DMEC n'en font partie.
    // Avec le cumul de rôles, il suffit que l'UNE des familles de la personne soit soignante.
    const isCareStaff = !!staffProfile && familiesOfMember(staffProfile, staffProfile.type).includes('soignant');
    return {
        isCivilian,
        staffProfile,
        staffName,
        isPhmcStaff,
        // Le formulaire AMA est réservé au personnel soignant du PHMC (et aux admins).
        canUseAma: isAdmin || isCareStaff,
        // Gestion du recrutement et des contrats : admins + recruteurs.
        canManageRecruitment: isAdmin || isRecruiter,
    };
};

// Ce que voit un profil dans la Boîte à outils et autour. UNE seule définition : le menu de MainApp et la
// matrice de l'aperçu admin s'appuient dessus, pour qu'ils ne puissent pas diverger.
export const getToolAccess = (identity) => {
    const {
        currentEmployee, employeeProfile, isAdmin, isRecruiter, isContractCandidate, hasAdminDocuments,
        isCivilian, staffName, canUseAma, canManageRecruitment, staffProfile,
    } = identity;
    const isStaffMember = !isCivilian && !!staffName;
    // Familles de la fiche : le Dossier Patient (dossiers médicaux de tous les patients) est réservé au personnel
    // soignant et au DMEC ; l'administration et le polyvalent n'y ont pas accès.
    const families = staffProfile ? familiesOfMember(staffProfile, staffProfile.type) : [];
    const careOrDmec = families.includes('soignant') || families.includes('dmec');
    const forms = summarizeFormAccess(getFormAccess({ isAdmin, isCivilian, staffProfile }));
    return {
        ...forms,
        myProfile: isStaffMember,
        myContracts: isStaffMember || !!isContractCandidate || !!isRecruiter || !!hasAdminDocuments,
        myPatientFile: isStaffMember,
        // Le Bingo est réservé au personnel (une fiche du personnel) : ni visiteurs, ni Civils, ni candidats.
        bingo: isStaffMember,
        savedReports: !!currentEmployee,
        patientDossier: !isCivilian && !!(isAdmin || (currentEmployee && (!staffProfile || careOrDmec))),
        recruitment: !!canManageRecruitment,
        // Annuaire (consultation seule) : le personnel et les admins.
        directory: isStaffMember || !!isAdmin,
        // Demandes des forces de l'ordre (aide-mémoire + registre) : tout le personnel, puisque n'importe qui peut être interpellé par un agent.
        lawEnforcement: isStaffMember || !!isAdmin,
        // Signaler un problème de sécurité incendie (registre des admins) : tout le personnel.
        fireReport: isStaffMember || !!isAdmin,
        // Gestion de la sécurité incendie (registre, non-conformités, exercices) : admins, Direction et personnel administratif.
        fireManage: !!isAdmin || (isStaffMember && canManageFireSafety(staffProfile)),
        // Documents disciplinaires (convocations, sanctions, fins de contrat) : admins, Direction et personnel administratif, pas les recruteurs.
        disciplineManage: !!isAdmin || (isStaffMember && canManageDiscipline(staffProfile)),
        ama: !!canUseAma,
        // Carte de visite : personnel, admins et recruteurs. Un candidat en attente de contrat peut créer sa SIGNATURE
        // (depuis « Mes documents administratifs ») mais pas sa carte de visite.
        businessCard: !!(isAdmin || employeeProfile || isRecruiter),
        signature: !!(isAdmin || employeeProfile || isRecruiter || isContractCandidate || isCivilian),
    };
};

export const TOOL_ACCESS_LABELS = {
    myProfile: 'Mon profil',
    myContracts: 'Mes documents administratifs',
    myPatientFile: 'Mon dossier patient',
    bingo: 'Bingo',
    savedReports: 'Rapports enregistrés',
    patientDossier: 'Dossier Patient',
    recruitment: 'Gestion du recrutement',
    directory: "Annuaire & plan de l'hôpital (consultation seule)",
    lawEnforcement: "Demandes des forces de l'ordre",
    fireReport: 'Signaler un problème incendie',
    fireManage: 'Gestion de la sécurité incendie',
    disciplineManage: 'Documents disciplinaires',
    ama: 'EMS Contre Avis Médical',
    businessCard: 'Créer sa carte de visite',
    signature: 'Créer sa signature',
    formsMedical: 'Formulaires médicaux (soins)',
    formsDmec: 'Formulaires DMEC (médecine légale)',
    formsShared: 'Note de Service & PHMC Email Interne',
    formsCivilian: 'Dossiers médicaux Civil & candidatures',
};
