// src/hooks/useReportIndexStatus.js
//
// État d'indexation des rapports d'une liste (« Rapports enregistrés ») dans le dossier de leur patient : partagé avec le patient ou non,
// qui en a une copie. C'est le MÊME enregistrement que « Dossier Patient » (patientRecords/{ID patient}/{clé}), donc les deux écrans se
// voient : un rapport déjà partagé ou déjà copié par le médecin n'est plus proposé nulle part. Réservé au personnel (lecture du dossier).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from '../utils/patientId';

// refreshToken : à incrémenter après un partage / une copie pour relire l'état.
const useReportIndexStatus = (reports, enabled = true, refreshToken = 0) => {
    const [byPatient, setByPatient] = useState({});

    const patientKey = useMemo(() => {
        if (!enabled) return '';
        const ids = new Set();
        (reports || []).forEach((report) => { if (report?.patientID) ids.add(canonicalPatientId(report.patientID)); });
        return [...ids].filter(Boolean).sort().join('|');
    }, [reports, enabled]);

    useEffect(() => {
        const ids = patientKey.split('|').filter(Boolean);
        if (ids.length === 0) return undefined;
        let cancelled = false;
        ids.forEach(async (id) => {
            try {
                const snap = await get(ref(database, `patientRecords/${id}`));
                if (!cancelled) setByPatient((prev) => ({ ...prev, [id]: snap.val() || {} }));
            } catch (error) {
                console.warn('Index du dossier illisible pour', id, error?.message || error);
            }
        });
        return () => { cancelled = true; };
    }, [patientKey, refreshToken]);

    // { visibility, copiedBy, copiedFrom, ownerDeleted } ou null si le rapport n'est pas (encore) indexé.
    const statusOf = useCallback((report) => {
        if (!report?.patientID) return null;
        const entries = byPatient[canonicalPatientId(report.patientID)];
        return entries?.[report.key || report.indexKey] || null;
    }, [byPatient]);

    return { statusOf };
};

export default useReportIndexStatus;
