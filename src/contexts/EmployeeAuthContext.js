// src/contexts/EmployeeAuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, database } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, get, set, onValue } from 'firebase/database';
import { canonicalPatientId } from '../utils/patientId';
import { getViewAs, saveViewAs, buildSimulatedIdentity, deriveIdentity } from '../utils/viewAs';
import { setActivityActor, logActivity } from '../utils/activityLog';
import { clearDeletedMark } from '../utils/deletedAccounts';
import { adoptArchivedRecords } from '../utils/adoptArchives';

const CREATE_GTAW_CIVILIAN_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/createGtawCivilianAccount';

const EmployeeAuthContext = createContext(null);

export const EmployeeAuthProvider = ({ children }) => {
    const [currentEmployee, setCurrentEmployee] = useState(null);
    const [employeeProfile, setEmployeeProfile] = useState(null);
    const [civilianProfile, setCivilianProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    // Fiche du personnel (PHMC/DMEC) d'un compte ADMIN. employeeProfile reste
    // volontairement null pour un admin (voir la branche userIsAdmin plus bas),
    // mais un admin qui est aussi médecin a quand même une fiche dans
    // staff/phmc|coroner : sans elle, ses rapports/copies étaient rangés sous
    // son adresse e-mail au lieu de son nom.
    const [adminStaffProfile, setAdminStaffProfile] = useState(null);
    // « Visualiser en tant que » (panneau admin → Debug) : profil simulé, mémorisé dans le navigateur. Il n'est
    // honoré que si le VRAI compte est administrateur (voir plus bas).
    const [viewAs, setViewAsState] = useState(() => getViewAs());
    const setViewAs = (view) => {
        saveViewAs(view);
        setViewAsState(view);
    };
    useEffect(() => {
        const onStorage = () => setViewAsState(getViewAs());
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Le profil n'est lu qu'à la connexion : après une auto-édition (téléphone, Discord, e-mail
    // depuis « Mon profil »), on fusionne les champs modifiés dans l'état local pour que
    // l'interface les reflète sans devoir se reconnecter.
    const updateLocalStaffProfile = (patch) => {
        setEmployeeProfile((prev) => (prev ? { ...prev, ...patch } : prev));
        setAdminStaffProfile((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setIsLoading(true);
            
            if (user) {
                try {
                    // Vérifier si l'utilisateur est un admin
                    const adminListRef = ref(database, 'adminUsers');
                    const adminSnapshot = await get(adminListRef);
                    let userIsAdmin = false;
                    
                    if (adminSnapshot.exists()) {
                        const adminList = adminSnapshot.val();
                        userIsAdmin = Array.isArray(adminList) 
                            ? adminList.some(admin => admin === user.email || admin === user.uid)
                            : Object.values(adminList).some(admin => admin === user.email || admin === user.uid);
                    }
                    
                    setIsAdmin(userIsAdmin);

                    // Si ce n'est pas un admin, charger le profil employé
                    if (!userIsAdmin) {
                        // Rechercher dans les employés PHMC
                        const phmcRef = ref(database, 'staff/phmc');
                        const phmcSnapshot = await get(phmcRef);
                        
                        if (phmcSnapshot.exists()) {
                            const phmcData = phmcSnapshot.val();
                            const phmcArray = Array.isArray(phmcData) ? phmcData : Object.values(phmcData);
                            const employeeData = phmcArray.find(emp => emp.uid === user.uid);
                            
                            if (employeeData) {
                                setEmployeeProfile({ ...employeeData, type: 'phmc' });
                                setCivilianProfile(null);
                                setCurrentEmployee(user);
                                setIsLoading(false);
                                return;
                            }
                        }

                        // Rechercher dans les employés Coroner
                        const coronerRef = ref(database, 'staff/coroner');
                        const coronerSnapshot = await get(coronerRef);
                        
                        if (coronerSnapshot.exists()) {
                            const coronerData = coronerSnapshot.val();
                            const coronerArray = Array.isArray(coronerData) ? coronerData : Object.values(coronerData);
                            const employeeData = coronerArray.find(emp => emp.uid === user.uid);

                            if (employeeData) {
                                setEmployeeProfile({ ...employeeData, type: 'coroner' });
                                setCivilianProfile(null);
                                setCurrentEmployee(user);
                                setIsLoading(false);
                                return;
                            }
                        }

                        // Aucun profil employé trouvé : rechercher un profil Civil
                        setEmployeeProfile(null);

                        const civilianRef = ref(database, `civilians/${user.uid}`);
                        const civilianSnapshot = await get(civilianRef);
                        setCivilianProfile(civilianSnapshot.exists() ? civilianSnapshot.val() : null);
                    } else {
                        setCivilianProfile(null);
                        // Retrouve la fiche du personnel de cet admin (uid, sinon e-mail).
                        let matchedStaff = null;
                        try {
                            const email = (user.email || '').toLowerCase();
                            for (const [listName, type] of [['staff/phmc', 'phmc'], ['staff/coroner', 'coroner']]) {
                                const staffSnapshot = await get(ref(database, listName));
                                if (!staffSnapshot.exists()) continue;
                                const staffData = staffSnapshot.val();
                                const staffArray = Array.isArray(staffData) ? staffData : Object.values(staffData);
                                const found = staffArray.find((emp) => emp && (
                                    (emp.uid && emp.uid === user.uid)
                                    || (email && (emp.email || '').toLowerCase() === email)
                                ));
                                if (found) {
                                    matchedStaff = { ...found, type };
                                    break;
                                }
                            }
                        } catch (staffError) {
                            console.warn('Could not resolve admin staff profile:', staffError);
                        }
                        setAdminStaffProfile(matchedStaff);
                    }

                    setCurrentEmployee(user);
                } catch (error) {
                    console.error('Error loading employee profile:', error);
                    setEmployeeProfile(null);
                    setCivilianProfile(null);
                }
            } else {
                setCurrentEmployee(null);
                setEmployeeProfile(null);
                setCivilianProfile(null);
                setAdminStaffProfile(null);
                setIsAdmin(false);
            }

            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    /**
     * Créer une demande d'approbation de compte employé
     * @param {Object} employeeData - Données de l'employé
     * @param {string} email - Email pour Firebase Auth
     * @param {string} password - Ignoré : le mot de passe n'est JAMAIS enregistré (défini par e-mail à l'approbation)
     * @param {boolean} isCoroner - Type d'employé
     */
    const requestEmployeeAccount = async (employeeData, email, password, isCoroner) => {
        try {
            // Clé basée sur l'email (remplace les caractères interdits dans les chemins Firebase)
            // Cela sert aussi de déduplication naturelle : même email = même clé.
            const emailKey = email.replace(/[.#$[\]]/g, '_');
            const requestRef = ref(database, `pendingAccountRequests/${emailKey}`);

            // Créer la demande
            const requestData = {
                ...employeeData,
                email: email,
                isCoroner: isCoroner,
                requestedAt: new Date().toISOString(),
                status: 'pending'
            };

            // Écriture directe par clé — ne nécessite pas de lecture préalable.
            // Les règles DB autorisent l'écriture publique sur pendingAccountRequests.
            await set(requestRef, requestData);

            return { success: true, message: 'Votre demande de compte a été envoyée aux administrateurs pour approbation.' };
        } catch (error) {
            console.error('Error requesting employee account:', error);
            throw error;
        }
    };

    /**
     * Créer un compte employé avec Firebase Auth (utilisé uniquement par les admins après approbation)
     * @param {Object} employeeData - Données de l'employé
     * @param {string} email - Email pour Firebase Auth
     * @param {string} password - Mot de passe
     * @param {boolean} isCoroner - Type d'employé
     */
    const createEmployeeAccount = async (employeeData, email, password, isCoroner) => {
        try {
            // Créer le compte Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Ajouter l'UID Firebase aux données de l'employé
            const employeeWithUID = {
                ...employeeData,
                uid: user.uid,
                email: email,
                createdAt: new Date().toISOString()
            };

            // Enregistrer dans la base de données
            const listRef = ref(database, isCoroner ? 'staff/coroner' : 'staff/phmc');
            const snapshot = await get(listRef);
            const currentStaff = snapshot.exists() ? snapshot.val() : [];
            
            // Vérifier les doublons par nom
            const staffArray = Array.isArray(currentStaff) ? currentStaff : Object.values(currentStaff);
            const isDuplicate = staffArray.some(member => 
                member.name.toLowerCase() === employeeData.name.toLowerCase()
            );
            
            if (isDuplicate) {
                // Supprimer le compte Firebase si le nom existe déjà
                await user.delete();
                throw new Error(`Le membre du personnel avec le nom "${employeeData.name}" existe déjà.`);
            }

            // Ajouter à la liste
            const newStaffArray = Array.isArray(currentStaff) ? [...currentStaff, employeeWithUID] : [...Object.values(currentStaff), employeeWithUID];
            await set(listRef, newStaffArray);

            // Mettre à jour le profil local
            setEmployeeProfile({ ...employeeWithUID, type: isCoroner ? 'coroner' : 'phmc' });

            return { success: true, user, employeeData: employeeWithUID };
        } catch (error) {
            console.error('Error creating employee account:', error);
            throw error;
        }
    };

    /**
     * Génère un ID patient de secours (PHMC-XXXXX aléatoire), utilisé
     * uniquement si un personnage GTA World n'a pas pu être déterminé pour ce
     * civil — cas normalement impossible depuis le retrait de la création
     * manuelle, mais gardé comme filet de sécurité. Dans le cas normal, l'ID
     * patient est directement dérivé du personnage GTA World (voir
     * createCivilianAccountFromGtaw), pas généré aléatoirement : même
     * convention que le badge d'un employé créé via GTAW.
     */
    // La génération d'ID patient (et la détection de collision) est désormais faite CÔTÉ SERVEUR par
    // createGtawCivilianAccount, qui renvoie le patientID : le client n'a plus besoin de lire tout le
    // nœud civilians, ce qui permet de fermer sa lecture globale (voir database.rules.json).

    /**
     * Créer un compte Civil à partir d'une identité GTA World déjà vérifiée
     * (voir CivilianAuthPanel.js / GtawCharacterPicker.js) : pas de mot de
     * passe, connexion uniquement via GTA World par la suite — même principe
     * que createGtawEmployeeAccount côté Personnel/DMEC, mais en libre-service
     * (pas d'approbation admin), d'où le customToken renvoyé directement par
     * createGtawCivilianAccount pour éviter un second aller-retour OAuth.
     * @param {Object} civilianData - Identité/contact du civil (sans champ de santé)
     * @param {string} email - Email pour Firebase Auth
     * @param {number|string|null} gtawCharacterId - Id du personnage GTA World
     * @param {number|string|null} gtawUserId - Id du compte GTA World
     */
    const createCivilianAccountFromGtaw = async (civilianData, email, gtawCharacterId, gtawUserId) => {
        try {
            const response = await fetch(CREATE_GTAW_CIVILIAN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, gtawCharacterId }),
            });
            const data = await response.json();

            if (!response.ok || !data.customToken) {
                throw new Error(data.message || data.error || 'Erreur lors de la création du compte.');
            }

            const userCredential = await signInWithCustomToken(auth, data.customToken);
            const user = userCredential.user;

            // L'ID patient est directement dérivé du personnage GTA World
            // (même principe que le badge d'un employé créé via GTAW — voir
            // OnboardingModal.js), pour que ce soit un identifiant stable que
            // le civil connaît déjà, plutôt qu'un code arbitraire à retenir.
            const patientID = data.patientID || (gtawCharacterId != null ? `PHMC-${gtawCharacterId}` : null);
            if (!patientID) throw new Error('Impossible de générer un identifiant patient. Réessayez.');
            const civilianWithID = {
                ...civilianData,
                uid: user.uid,
                email,
                patientID,
                gtawCharacterId: gtawCharacterId ?? null,
                gtawUserId: gtawUserId ?? null,
                createdAt: new Date().toISOString()
            };

            await set(ref(database, `civilians/${user.uid}`), civilianWithID);
            clearDeletedMark(civilianWithID.patientID);

            setCivilianProfile(civilianWithID);
            setEmployeeProfile(null);

            return { success: true, user, civilianData: civilianWithID };
        } catch (error) {
            console.error('Error creating civilian account via GTA World:', error);
            throw error;
        }
    };

    /**
     * Connexion employé
     * @param {string} email - Email
     * @param {string} password - Mot de passe
     */
    const loginEmployee = async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('Error logging in:', error);
            throw error;
        }
    };

    /**
     * Déconnexion
     */
    const logoutEmployee = async () => {
        try {
            await signOut(auth);
            setCurrentEmployee(null);
            setEmployeeProfile(null);
            setCivilianProfile(null);
            setAdminStaffProfile(null);
            setIsAdmin(false);
        } catch (error) {
            console.error('Error logging out:', error);
            throw error;
        }
    };

    // Rôle « recruteur » : un compte Civil (mêmes accès qu'un civil) + un drapeau
    // recruteurs/{uid} (ancien nom : recruiterUIDs) posé par un admin, qui donne en plus l'onglet Recrutement de la
    // boîte à outils. Un recruteur reste donc `isCivilian`.
    const [isRecruiter, setIsRecruiter] = useState(false);
    const uid = currentEmployee?.uid || null;
    useEffect(() => {
        if (!uid) {
            setIsRecruiter(false);
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                // Nœud français d'abord, ancien nœud en repli (tant que la migration n'a pas été faite).
                const [newSnap, oldSnap] = await Promise.all([
                    get(ref(database, `recruteurs/${uid}`)),
                    get(ref(database, `recruiterUIDs/${uid}`)).catch(() => null),
                ]);
                if (!cancelled) setIsRecruiter(newSnap.val() === true || oldSnap?.val() === true);
            } catch (error) {
                if (!cancelled) setIsRecruiter(false);
            }
        })();
        return () => { cancelled = true; };
    }, [uid]);
    // Rôle facultatif « en attente de signature de contrat » (candidatsContrat/{uid}), posé par un
    // recruteur sur le compte Civil d'un candidat accepté. En direct (onValue) : le candidat voit
    // « Mes contrats » apparaître sans avoir à se reconnecter.
    const [isContractCandidate, setIsContractCandidate] = useState(false);
    // Statut de recrutement interne (évolution interne) : accordé par le recrutement, il rouvre les candidatures à un employé.
    const [hasInternalRecruitment, setHasInternalRecruitment] = useState(false);
    useEffect(() => {
        if (!uid) { setHasInternalRecruitment(false); return undefined; }
        return onValue(ref(database, `statutsMobilite/${uid}`), (snapshot) => setHasInternalRecruitment(snapshot.exists()), () => setHasInternalRecruitment(false));
    }, [uid]);
    useEffect(() => {
        if (!uid) {
            setIsContractCandidate(false);
            return undefined;
        }
        // Nouveau nœud français et ancien nœud (avant migration) : l'un OU l'autre suffit.
        let inNew = false;
        let inOld = false;
        const refresh = () => setIsContractCandidate(inNew || inOld);
        const unsubscribeNew = onValue(ref(database, `candidatsContrat/${uid}`), (snapshot) => { inNew = snapshot.exists(); refresh(); }, () => { inNew = false; refresh(); });
        const unsubscribeOld = onValue(ref(database, `contractCandidates/${uid}`), (snapshot) => { inOld = snapshot.exists(); refresh(); }, () => { inOld = false; refresh(); });
        return () => { unsubscribeNew(); unsubscribeOld(); };
    }, [uid]);
    // Identité EFFECTIVE : la vraie, ou le profil simulé par un admin (« visualiser en tant que »). Tout ce que
    // l'application consulte (droits, menu, formulaires) passe par elle ; l'accès Firebase, lui, reste celui du
    // vrai compte.
    const simulation = isAdmin && viewAs ? buildSimulatedIdentity(viewAs, currentEmployee) : null;
    const effective = simulation || { currentEmployee, employeeProfile, civilianProfile, adminStaffProfile, isAdmin, isRecruiter, isContractCandidate };
    // Identité « personnel » unifiée : fiche de l'employé connecté, ou fiche staff d'un admin. C'est LE nom
    // sous lequel les rapports sont rangés (savedReports/{nom}) — jamais l'e-mail. Le formulaire AMA est
    // réservé au personnel soignant du PHMC et aux admins ; la gestion du recrutement aux admins et recruteurs.
    const derived = deriveIdentity(effective);
    const { staffProfile } = derived;

    // ID patient de la personne connectée : celui de son profil Civil ; pour le personnel,
    // PHMC-{ID employé} — l'ID employé est le numéro de badge (les chiffres après le préfixe, qui
    // est aussi l'ID du personnage GTA World pour les comptes créés via GTA World). Cet ID est
    // unique et lié à l'UCP : il n'est modifiable par personne depuis l'interface.
    const staffBadgeDigits = String(staffProfile?.badge || '').includes('-')
        ? String(staffProfile.badge).split('-').slice(1).join('')
        : String(staffProfile?.badge || '').replace(/\D/g, '');
    const myPatientID = canonicalPatientId(
        effective.civilianProfile?.patientID
        || (staffProfile?.gtawCharacterId != null ? `PHMC-${staffProfile.gtawCharacterId}` : '')
        || (staffBadgeDigits ? `PHMC-${staffBadgeDigits}` : '')
    );

    // Journal d'activité : identité RÉELLE de la personne connectée (jamais le profil simulé par « visualiser en tant
    // que »), et une ligne « connexion » par session de navigateur.
    const realStaff = employeeProfile || adminStaffProfile;
    const realName = realStaff
        ? (realStaff.name || (realStaff.firstName && realStaff.lastName ? `${realStaff.firstName} ${realStaff.lastName}` : ''))
        : (civilianProfile?.name || civilianProfile?.fullName
            || (civilianProfile?.firstName && civilianProfile?.lastName ? `${civilianProfile.firstName} ${civilianProfile.lastName}` : ''));
    const realRole = isAdmin ? 'Admin' : realStaff ? (realStaff.category || realStaff.rank || 'Personnel') : civilianProfile ? 'Civil' : '';
    useEffect(() => {
        if (isLoading || !auth.currentUser) return;
        const user = auth.currentUser;
        setActivityActor({ name: realName || user.email || '', role: realRole, admin: isAdmin, email: user.email || undefined });
        try {
            const sessionKey = `activityLogin:${user.uid}`;
            if (sessionStorage.getItem(sessionKey)) return;
            sessionStorage.setItem(sessionKey, '1');
            adoptArchivedRecords();
            logActivity({ category: 'auth', action: 'login', summary: `Connexion de ${realName || user.email || 'un utilisateur'}`, details: realRole ? `Rôle : ${realRole}` : undefined });
        } catch (e) { /* stockage indisponible : on ne journalise simplement pas la connexion */ }
    }, [isLoading, realName, realRole, isAdmin]);

    const value = {
        isRecruiter: effective.isRecruiter,
        isContractCandidate: effective.isContractCandidate,
        hasInternalRecruitment,
        canManageRecruitment: derived.canManageRecruitment,
        myPatientID,
        currentEmployee: effective.currentEmployee,
        employeeProfile: effective.employeeProfile,
        staffProfile,
        updateLocalStaffProfile,
        staffName: derived.staffName,
        isPhmcStaff: derived.isPhmcStaff,
        canUseAma: derived.canUseAma,
        civilianProfile: effective.civilianProfile,
        isCivilian: derived.isCivilian,
        isLoading,
        isAdmin: effective.isAdmin,
        // Simulation « visualiser en tant que » : profil actif (null = aucune), son réglage, et les valeurs réelles.
        viewAs: simulation ? viewAs : null,
        setViewAs,
        realIsAdmin: isAdmin,
        realCurrentEmployee: currentEmployee,
        requestEmployeeAccount,
        createEmployeeAccount,
        createCivilianAccountFromGtaw,
        loginEmployee,
        logoutEmployee
    };

    return (
        <EmployeeAuthContext.Provider value={value}>
            {children}
        </EmployeeAuthContext.Provider>
    );
};

export const useEmployeeAuth = () => {
    const context = useContext(EmployeeAuthContext);
    if (!context) {
        throw new Error('useEmployeeAuth must be used within an EmployeeAuthProvider');
    }
    return context;
};
