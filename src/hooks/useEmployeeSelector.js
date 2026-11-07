// src/hooks/useEmployeeSelector.js
import { useMemo } from 'react';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { getEmployeeDisplayName } from '../utils/employeeName';

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

        // Un employé connecté ne retrouve QUE lui-même (même s'il cumule plusieurs rôles : la liste dont il fait partie ne lui propose que lui).
        const own = phmcArray.find(emp => emp.uid === currentEmployee.uid);
        if (own) return [own];

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

        // Un employé connecté ne retrouve QUE lui-même.
        const own = coronerArray.find(emp => emp.uid === currentEmployee.uid);
        if (own) return [own];

        return [];
    }, [coronerList, employeeProfile, currentEmployee, isAdmin, applyRestriction]);

    return {
        filteredPhmcList,
        filteredCoronerList,
        isRestricted: !isAdmin && !!currentEmployee,
        currentEmployeeName: employeeProfile
            ? (getEmployeeDisplayName(employeeProfile) || null)
            : null,
        currentEmployeeType: employeeProfile?.type || null
    };
};
