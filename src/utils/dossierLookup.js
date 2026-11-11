// src/utils/dossierLookup.js
//
// Lecture (avec petit cache) du dossier APPLIQUÉ d'un patient (dossiersPatients/{ID}/donnees), partagée par le pré-remplissage des formulaires et par l'encart « dossier patient » :
// une seule lecture par patient et par minute, même si plusieurs composants la demandent.
//   lookupDossier('PHMC-2752') → { status: 'found' | 'missing' | 'denied', donnees }
import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from './patientId';

const TTL_MS = 60 * 1000;
const cache = new Map(); // nœud → { at, result } | { at, promise }

export const isLookupId = (node) => /^PHMC-\d{3,}$/.test(String(node || ''));

export const forgetDossierLookup = (patientID) => { cache.delete(canonicalPatientId(patientID)); };

export const lookupDossier = (patientID) => {
    const node = canonicalPatientId(patientID);
    if (!isLookupId(node)) return Promise.resolve({ status: 'idle', donnees: null });
    const hit = cache.get(node);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
    const promise = get(ref(database, `dossiersPatients/${node}/donnees`))
        .then((snap) => (snap.exists() ? { status: 'found', donnees: snap.val() } : { status: 'missing', donnees: null }))
        .catch(() => ({ status: 'denied', donnees: null }));
    cache.set(node, { at: Date.now(), promise });
    return promise;
};

// Hook : état du dossier du patient dont l'ID est saisi (avec un court délai pour ne pas lire à chaque touche).
export const usePatientDossier = (patientID) => {
    const node = canonicalPatientId(patientID);
    const [state, setState] = useState({ node: '', status: 'idle', donnees: null });
    useEffect(() => {
        if (!isLookupId(node)) { setState({ node: '', status: 'idle', donnees: null }); return undefined; }
        let cancelled = false;
        setState((previous) => (previous.node === node ? previous : { node, status: 'loading', donnees: null }));
        const timer = setTimeout(() => {
            lookupDossier(node).then((result) => { if (!cancelled) setState({ node, ...result }); });
        }, 500);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [node]);
    return state;
};
