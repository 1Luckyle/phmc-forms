// src/hooks/useActivePrescriptions.js
//
// Pose dans le formulaire de soins (formData.patientActivePrescriptions) les ORDONNANCES EN COURS du patient dont l'ID est saisi, à la date du rapport (voir utils/activePrescriptions.js).
// Relancé quand l'ID, la date ou la liste des ordonnances retirées (formData.patientActivePrescriptionsOff) change. Au mieux : une lecture refusée laisse la liste telle quelle.
import { useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from '../utils/patientId';
import { isLookupId } from '../utils/dossierLookup';
import { activePrescriptions, prescriptionItemsOf } from '../utils/activePrescriptions';
import { todayIso } from '../utils/appointmentDate';

// Formulaires qui montrent le contexte patient complet (allergies, antécédents, traitements habituels) : les ordonnances en cours s'y ajoutent aux traitements.
export const CARE_RX_VERSIONS = [5, 14, 16, 19, 20, 21];

const TTL_MS = 30 * 1000;
const cache = new Map(); // nœud → { at, promise }
const loadIndex = (node) => {
    const hit = cache.get(node);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
    const promise = get(ref(database, `patientRecords/${node}`)).then((snapshot) => snapshot.val() || {}).catch(() => null);
    cache.set(node, { at: Date.now(), promise });
    return promise;
};
export const forgetActivePrescriptions = (patientID) => { cache.delete(canonicalPatientId(patientID)); };

const useActivePrescriptions = (version, formData, setFormData, currentTitle = '') => {
    const enabled = CARE_RX_VERSIONS.includes(Number(version));
    const node = canonicalPatientId(formData && formData.patientID);
    const asOf = /^\d{4}-\d{2}-\d{2}/.test(String((formData && formData.date) || '')) ? String(formData.date).slice(0, 10) : todayIso();
    const offKey = JSON.stringify((formData && formData.patientActivePrescriptionsOff) || []);
    // Ordonnance du rapport en cours de rédaction : jamais comptée comme « ordonnance en cours » (voir activePrescriptions).
    const ownKey = JSON.stringify(prescriptionItemsOf(formData));

    useEffect(() => {
        if (!enabled || !setFormData) return undefined;
        let cancelled = false;
        const apply = (list) => setFormData((prev) => (JSON.stringify(prev.patientActivePrescriptions || []) === JSON.stringify(list) ? prev : { ...prev, patientActivePrescriptions: list }));
        if (!isLookupId(node)) { apply([]); return undefined; }
        loadIndex(node).then((entries) => {
            if (cancelled || !entries) return;
            apply(activePrescriptions(entries, { asOf, excludeTitle: currentTitle, ownItems: JSON.parse(ownKey), off: JSON.parse(offKey) }));
        });
        return () => { cancelled = true; };
    }, [enabled, node, asOf, currentTitle, offKey, ownKey, setFormData]);
};

export default useActivePrescriptions;
