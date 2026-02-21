// src/hooks/useEmployeeSelector.js
import { useMemo } from 'react';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';

// Utility function to ensure a value is an array
const ensureArray = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);

/**
 * Hook pour filtrer les listes d'employés selon l'utilisateur connecté
 * Si un employé est connecté, retourne seulement cet employé
 * Sinon, retourne la liste complète
 * @param {Array} phmcList - Liste des employés PHMC
 * @param {Array} coronerList - Liste des coroners
 * @param {boolean} applyRestriction - Si false, retourne toujours la liste complète (pour extraStaff, chiefCoronerEmployee)
 */
export const useEmployeeSelector = (phmcList = [], coronerList = [], applyRestriction = true) => {
    const { employeeProfile, currentEmployee, isAdmin } = useEmployeeAuth();

    const filteredPhmcList = useMemo(() => {
        const phmcArray = ensureArray(phmcList);
        
        // Si applyRestriction est false, toujours retourner la liste complète
        if (!applyRestriction) {
            return phmcArray;
        }
        
        // Si admin, montrer tous les employés PHMC
        if (isAdmin) {
            return phmcArray;
        }
        
        // Si pas connecté, ne montrer personne (mode visiteur restreint)
        if (!currentEmployee) {
            return [];
        }

        // Si employé PHMC connecté, montrer seulement cet employé
        if (employeeProfile && employeeProfile.type === 'phmc') {
            const currentEmployeeData = phmcArray.find(emp => emp.uid === currentEmployee.uid);
            return currentEmployeeData ? [currentEmployeeData] : [];
        }

        // Si employé Coroner connecté, ne pas montrer d'employés PHMC
        if (employeeProfile && employeeProfile.type === 'coroner') {
            return [];
        }

        return [];
    }, [phmcList, employeeProfile, currentEmployee, isAdmin, applyRestriction]);

    const filteredCoronerList = useMemo(() => {
        const coronerArray = ensureArray(coronerList);
        
        // Si applyRestriction est false, toujours retourner la liste complète
        if (!applyRestriction) {
            return coronerArray;
        }
        
        // Si admin, montrer tous les coroners
        if (isAdmin) {
            return coronerArray;
        }
        
        // Si pas connecté, ne montrer personne (mode visiteur restreint)
        if (!currentEmployee) {
            return [];
        }

        // Si employé Coroner connecté, montrer seulement cet employé
        if (employeeProfile && employeeProfile.type === 'coroner') {
            const currentEmployeeData = coronerArray.find(emp => emp.uid === currentEmployee.uid);
            return currentEmployeeData ? [currentEmployeeData] : [];
        }

        // Si employé PHMC connecté, ne pas montrer de coroners
        if (employeeProfile && employeeProfile.type === 'phmc') {
            return [];
        }

        return [];
    }, [coronerList, employeeProfile, currentEmployee, isAdmin, applyRestriction]);

    return {
        filteredPhmcList,
        filteredCoronerList,
        isRestricted: !isAdmin && !!currentEmployee,
        currentEmployeeName: employeeProfile
            ? (employeeProfile.firstName && employeeProfile.lastName
                ? `${employeeProfile.firstName} ${employeeProfile.lastName}`
                : (employeeProfile.name && employeeProfile.lastName
                    ? `${employeeProfile.name} ${employeeProfile.lastName}`
                    : employeeProfile.name || null))
            : null,
        currentEmployeeType: employeeProfile?.type || null
    };
};
