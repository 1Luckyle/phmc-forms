// src/contexts/EmployeeAuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, database } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';

const EmployeeAuthContext = createContext(null);

export const EmployeeAuthProvider = ({ children }) => {
    const [currentEmployee, setCurrentEmployee] = useState(null);
    const [employeeProfile, setEmployeeProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

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
                                setCurrentEmployee(user);
                                setIsLoading(false);
                                return;
                            }
                        }

                        // Aucun profil employé trouvé
                        setEmployeeProfile(null);
                    }
                    
                    setCurrentEmployee(user);
                } catch (error) {
                    console.error('Error loading employee profile:', error);
                    setEmployeeProfile(null);
                }
            } else {
                setCurrentEmployee(null);
                setEmployeeProfile(null);
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
            setIsAdmin(false);
        } catch (error) {
            console.error('Error logging out:', error);
            throw error;
        }
    };

    const value = {
        currentEmployee,
        employeeProfile,
        isLoading,
        isAdmin,
        requestEmployeeAccount,
        createEmployeeAccount,
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
