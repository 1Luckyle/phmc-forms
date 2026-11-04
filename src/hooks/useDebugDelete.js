// src/hooks/useDebugDelete.js
//
// Vrai pour un ADMIN quand l'interrupteur Debug « Suppression des nouveaux formulaires » est activé (Admin → Debug) : les boutons « Supprimer (debug) » des nouveaux
// formulaires apparaissent alors (voir utils/debugDelete.js).
import { useDebug } from '../contexts/DebugContext';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';

const useDebugDelete = () => {
    const { debugDeleteFormsEnabled } = useDebug();
    const { isAdmin } = useEmployeeAuth();
    return !!isAdmin && !!debugDeleteFormsEnabled;
};

export default useDebugDelete;
