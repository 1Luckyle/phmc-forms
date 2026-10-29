// src/hooks/useMinorTitleGuard.js
//
// Titre « Mineur <18 ans » des formulaires de dossier patient : il n'est sélectionnable que si la date de naissance indique bien moins de 18 ans.
// Si la date est ensuite modifiée pour un adulte, le titre « Mineur » est retiré.
// Utilisation : <option disabled={guard.isDisabled(option)}>{guard.label(option)}</option>
import { useEffect } from 'react';
import { ageOn, isMinorTitle, MAJORITY_AGE } from '../utils/minors';

const useMinorTitleGuard = (formData, setFormData, { titleField = 'patientTitle', dobField = 'patientDateOfBirth' } = {}) => {
    const age = ageOn(formData?.[dobField]);
    const allowed = age !== null && age < MAJORITY_AGE;
    const adult = age !== null && age >= MAJORITY_AGE;
    const title = formData?.[titleField];

    useEffect(() => {
        if (adult && isMinorTitle(title)) {
            setFormData((prev) => (isMinorTitle(prev?.[titleField]) ? { ...prev, [titleField]: '' } : prev));
        }
    }, [adult, title, titleField, setFormData]);

    return {
        isDisabled: (option) => isMinorTitle(option?.value) && !allowed,
        label: (option) => (isMinorTitle(option?.value) && !allowed
            ? `${option.label} (selon la date de naissance)`
            : option.label),
    };
};

export default useMinorTitleGuard;
