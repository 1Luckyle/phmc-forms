// src/contexts/EmployeeAuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, database } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';

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
    const isCivilian = !isAdmin && !employeeProfile && !!civilianProfile;

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
     * @param {string} password - Mot de passe (stocké temporairement haché)
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
                password: password,
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
    const generatePatientID = async () => {
        const civiliansRef = ref(database, 'civilians');
        const snapshot = await get(civiliansRef);
        const existingIds = new Set();
        if (snapshot.exists()) {
            Object.values(snapshot.val()).forEach((civilian) => {
                if (civilian && civilian.patientID) existingIds.add(civilian.patientID);
            });
        }

        let patientID;
        do {
            const digits = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
            patientID = `PHMC-${digits}`;
        } while (existingIds.has(patientID));

        return patientID;
    };

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
                body: JSON.stringify({ email }),
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
            const patientID = gtawCharacterId != null ? `PHMC-${gtawCharacterId}` : await generatePatientID();
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

    // Identité « personnel » unifiée : fiche de l'employé connecté, ou fiche
    // staff d'un admin. C'est LE nom sous lequel les rapports sont rangés
    // (savedReports/{nom}) — jamais l'e-mail.
    const staffProfile = employeeProfile || adminStaffProfile;
    const staffName = staffProfile
        ? (staffProfile.name
            || (staffProfile.firstName && staffProfile.lastName ? `${staffProfile.firstName} ${staffProfile.lastName}` : null))
        : null;
    // Le formulaire AMA est réservé aux médecins (personnel PHMC) et aux admins.
    const isPhmcStaff = staffProfile?.type === 'phmc';
    const canUseAma = isAdmin || isPhmcStaff;

    const value = {
        currentEmployee,
        employeeProfile,
        staffProfile,
        staffName,
        isPhmcStaff,
        canUseAma,
        civilianProfile,
        isCivilian,
        isLoading,
        isAdmin,
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
