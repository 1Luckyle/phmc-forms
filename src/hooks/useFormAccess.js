// src/hooks/useFormAccess.js
//
// Accès aux formulaires de la personne connectée (ou du profil simulé par un admin) : voir utils/formAccess.js.
import { useMemo } from 'react';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { getFormAccess } from '../utils/formAccess';
import { formDefinitions } from '../formDefinitions';

const useFormAccess = () => {
    const { isAdmin, isCivilian, staffProfile } = useEmployeeAuth();
    return useMemo(() => {
        const access = getFormAccess({ isAdmin, isCivilian, staffProfile });
        return {
            kind: access.kind,
            canAccess: (version) => access.canAccess(version),
            // Un groupe de formulaires (« PHMC », « PHMC Recruitment ») a-t-il au moins un formulaire accessible ?
            groupHasForms: (group) => formDefinitions.some((form) => form.group === group && access.canAccess(form.version)),
        };
    }, [isAdmin, isCivilian, staffProfile]);
};

export default useFormAccess;
