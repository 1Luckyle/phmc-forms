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
import { getRoleInfo, familyOfMember } from '../constants/ranks';

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

// Libellé lisible d'un profil simulé.
export const describeViewAs = (view) => {
    if (!view) return 'Administrateur (vous)';
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
    const isCareStaff = !!staffProfile && familyOfMember(staffProfile, staffProfile.type) === 'soignant';
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
        currentEmployee, employeeProfile, isAdmin, isRecruiter, isContractCandidate,
        isCivilian, staffName, canUseAma, canManageRecruitment,
    } = identity;
    const isStaffMember = !isCivilian && !!staffName;
    return {
        myProfile: isStaffMember,
        myContracts: isStaffMember || !!isContractCandidate || !!isRecruiter,
        myPatientFile: isStaffMember,
        savedReports: !!currentEmployee,
        patientDossier: !isCivilian && !!(currentEmployee || isAdmin),
        recruitment: !!canManageRecruitment,
        ama: !!canUseAma,
        businessCard: !!(isAdmin || employeeProfile || isRecruiter),
    };
};

export const TOOL_ACCESS_LABELS = {
    myProfile: 'Mon profil',
    myContracts: 'Mes contrats',
    myPatientFile: 'Mon dossier patient',
    savedReports: 'Rapports enregistrés',
    patientDossier: 'Dossier Patient',
    recruitment: 'Gestion du recrutement',
    ama: 'EMS Contre Avis Médical',
    businessCard: 'Carte de visite & signature',
};
