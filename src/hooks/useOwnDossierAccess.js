// src/hooks/useOwnDossierAccess.js
//
// Quels formulaires du dossier patient (Basique 25, Avancé 3, Mise à jour 26) la personne connectée peut-elle ouvrir pour SON propre dossier ? Sert à ne proposer, dans les
// listes de formulaires d'un compte Civil, que ce qui est possible : sans dossier, Basique ou Avancé ; avec un dossier, uniquement la Mise à jour (règles : utils/dossierCore.js).
// Tant que le dossier n'est pas lu, rien n'est masqué (l'enregistrement refuse de toute façon ce qui n'est pas permis).
import { useEffect, useState } from 'react';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { loadDossierContext } from '../utils/dossierPatient';

const useOwnDossierAccess = (enabled = true) => {
    const { myPatientID } = useEmployeeAuth();
    const [access, setAccess] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setAccess(null);
        if (!enabled || !myPatientID) return undefined;
        loadDossierContext(myPatientID).then((context) => { if (!cancelled) setAccess(context.access); }).catch(() => {});
        return () => { cancelled = true; };
    }, [enabled, myPatientID]);

    // Retourne true quand la personne peut CRÉER ce formulaire du dossier (ou quand la question ne se pose pas).
    const canOpenDossierForm = (version) => {
        if (!access) return true;
        if (Number(version) === 26) return access.canCreateUpdate;
        if (Number(version) === 25 || Number(version) === 3) return access.canCreateBasic;
        return true;
    };
    return { access, canOpenDossierForm };
};

export default useOwnDossierAccess;
