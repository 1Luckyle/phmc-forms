import React, { createContext, useContext, useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { setLockdownActive } from '../utils/lockdownGuard';
import { isLocalHostname } from '../utils/siteUrl';

const LockdownContext = createContext();


export const useLockdown = () => {
    const context = useContext(LockdownContext);
    if (!context) {
        throw new Error('useLockdown must be used within a LockdownProvider');
    }
    return context;
};

export const LockdownProvider = ({ children }) => {
    const [lockdownConfig, setLockdownConfig] = useState({
        enabled: false,
        notification: '',
        dialog: '',
        affectedDeployments: []
    });
    const [currentDeployment, setCurrentDeployment] = useState('');
    const [showDialog, setShowDialog] = useState(false);

    // Detect current deployment
    useEffect(() => {
        // « Site en ligne » (domaine personnalisé ou ancienne adresse GitHub Pages) ou « local » (serveur de développement) : on se fie au nom d'hôte,
        // pas à l'adresse complète, sinon un changement de domaine ferait passer le site en ligne pour du local (et le confinement ne s'y appliquerait plus).
        setCurrentDeployment(isLocalHostname() ? 'local' : 'github-pages');
    }, []);

    // Subscribe to lockdown config changes
    useEffect(() => {
        const lockdownRef = ref(database, 'adminSettings/lockdownConfig');
        const unsubscribe = onValue(lockdownRef, (snapshot) => {
            const lockdownData = snapshot.val();
            // Ensure we have valid data with defaults
            const normalizedData = {
                enabled: false,
                notification: '',
                dialog: '',
                affectedDeployments: []
            };

            if (lockdownData) {
                normalizedData.enabled = Boolean(lockdownData.enabled);
                normalizedData.notification = lockdownData.notification || '';
                normalizedData.dialog = lockdownData.dialog || '';
                normalizedData.affectedDeployments = Array.isArray(lockdownData.affectedDeployments) 
                    ? lockdownData.affectedDeployments 
                    : [];
            }

            setLockdownConfig(normalizedData);

            // Show dialog if lockdown is enabled and affects this deployment
            const isAffected = normalizedData.enabled && (
                normalizedData.affectedDeployments.includes('all') || normalizedData.affectedDeployments.includes('tous') ||
                normalizedData.affectedDeployments.includes(currentDeployment)
            );

            // Set dialog visibility based on affected status
            setShowDialog(isAffected);
        });

        return () => unsubscribe();
    }, [currentDeployment]);

    const hideDialog = () => {
        setShowDialog(false);
    };

    const isLockdownActive = Boolean(lockdownConfig.enabled) && Array.isArray(lockdownConfig.affectedDeployments) && (
        lockdownConfig.affectedDeployments.includes('all') || lockdownConfig.affectedDeployments.includes('tous') ||
        lockdownConfig.affectedDeployments.includes(currentDeployment)
    );

    // Même état pour les fonctions d'écriture hors React (utils/lockdownGuard.js).
    useEffect(() => { setLockdownActive(isLockdownActive); }, [isLockdownActive]);

    return (
        <LockdownContext.Provider value={{
            lockdownConfig,
            currentDeployment,
            showDialog,
            hideDialog,
            isLockdownActive
        }}>
            {children}
        </LockdownContext.Provider>
    );
};