// src/hooks/usePatientNameParts.js
//
// Le nom du patient se saisit en trois champs (prénom, deuxième prénom, nom) mais le reste de l'application (titre du rapport, BBCode, recherche
// de dossier, remplissage depuis le profil) lit un nom COMPLET. Ce hook garde les deux synchronisés :
//   • quand un des trois champs change, le nom complet est recalculé ;
//   • quand le nom complet est rempli de l'extérieur sans les trois champs (brouillon ou rapport enregistré avant le découpage, remplissage
//     automatique depuis un profil), il est découpé dans les trois champs.
import { useEffect, useRef } from 'react';
import { splitFullName, joinFullName } from '../utils/patientIdentity';

const usePatientNameParts = (formData, setFormData, { full = 'patientName', first = 'patientFirstName', middle = 'patientMiddleName', last = 'patientLastName' } = {}) => {
    const composedOf = (data) => joinFullName(data?.[first], data?.[middle], data?.[last]);
    const lastComposed = useRef(composedOf(formData));
    const fullName = formData?.[full] || '';
    const composed = composedOf(formData);

    useEffect(() => {
        if (!full) return;
        if (composed === lastComposed.current && fullName !== composed) {
            // Nom complet modifié de l'extérieur : on le découpe (sauf s'il est vide, auquel cas les trois champs se vident aussi).
            const parts = splitFullName(fullName);
            lastComposed.current = joinFullName(parts.first, parts.middle, parts.last);
            setFormData((prev) => ({ ...prev, [first]: parts.first, [middle]: parts.middle, [last]: parts.last }));
        } else if (composed !== fullName) {
            lastComposed.current = composed;
            setFormData((prev) => (joinFullName(prev?.[first], prev?.[middle], prev?.[last]) === composed ? { ...prev, [full]: composed } : prev));
        } else {
            lastComposed.current = composed;
        }
    }, [composed, fullName, full, first, middle, last, setFormData]);
};

export default usePatientNameParts;
