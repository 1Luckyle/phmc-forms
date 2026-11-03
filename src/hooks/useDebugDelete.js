// src/hooks/useDebugDelete.js
//
// Vrai pour un ADMIN quand l'interrupteur Debug « Autoriser la suppression » est activé : les boutons « Supprimer (debug) » des nouveaux
// formulaires apparaissent alors (voir utils/debugDelete.js).
import { useDebug } from '../contexts/DebugContext';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';

const useDebugDelete = () => {
    const { debugDeleteApplicationsEnabled } = useDebug();
    const { isAdmin } = useEmployeeAuth();
    return !!isAdmin && !!debugDeleteApplicationsEnabled;
};

export default useDebugDelete;
