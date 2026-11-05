// src/hooks/useMinorTitleGuard.js
//
// Titre « Mineur <18 ans » des formulaires de dossier patient, lié à la date de naissance :
//   • moins de 18 ans : le titre « Mineur » est IMPOSÉ (il se met tout seul et la liste est verrouillée) ;
//   • 18 ans ou plus : « Mineur » n'est pas sélectionnable, et il est retiré si la date devient celle d'un adulte ;
//   • date absente ou illisible : « Mineur » n'est pas sélectionnable non plus (rien ne le justifie).
// Utilisation : <Form.Select disabled={guard.locked} title={guard.hint}> … <option disabled={guard.isDisabled(option)}>{guard.label(option)}</option>
import { useEffect } from 'react';
import { ageOn, isMinorTitle, MAJORITY_AGE } from '../utils/minors';

export const MINOR_TITLE_VALUE = 'Mineur';

// `minorValue` : valeur du titre de mineur dans la liste ; `fallbackDobField` : date de naissance à utiliser si `dobField` est vide ;
// `enabled` : false tant que le champ n'est pas affiché (rien n'est alors rempli automatiquement).
const useMinorTitleGuard = (formData, setFormData, {
    titleField = 'patientTitle', dobField = 'patientDateOfBirth', fallbackDobField = '', minorValue = MINOR_TITLE_VALUE, enabled = true,
} = {}) => {
    const age = ageOn(formData?.[dobField]) ?? (fallbackDobField ? ageOn(formData?.[fallbackDobField]) : null);
    const minor = age !== null && age < MAJORITY_AGE;
    const adult = age !== null && age >= MAJORITY_AGE;
    const title = formData?.[titleField];

    useEffect(() => {
        if (!enabled) return;
        if (minor && !isMinorTitle(title)) {
            setFormData((prev) => (isMinorTitle(prev?.[titleField]) ? prev : { ...prev, [titleField]: minorValue }));
        } else if (adult && isMinorTitle(title)) {
            setFormData((prev) => (isMinorTitle(prev?.[titleField]) ? { ...prev, [titleField]: '' } : prev));
        }
    }, [enabled, minor, adult, title, titleField, minorValue, setFormData]);

    return {
        // La liste est verrouillée tant que la date de naissance indique un mineur.
        locked: minor && enabled,
        hint: minor ? 'Patient de moins de 18 ans : le titre « Mineur » est obligatoire.' : undefined,
        isDisabled: (option) => (isMinorTitle(option?.value) ? !minor : minor),
        label: (option) => (isMinorTitle(option?.value) && !minor
            ? `${option.label} (selon la date de naissance)`
            : option.label),
    };
};

export default useMinorTitleGuard;
