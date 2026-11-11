// src/hooks/useDossierPrefill.js
//
// Pré-remplit le formulaire courant à partir du dossier du patient dont l'ID est saisi (le sien pour un compte Civil, celui qu'on tape pour le personnel). Une fois par
// formulaire et par patient ; un champ déjà rempli n'est jamais écrasé. Règles : utils/dossierPrefill.js.
import { useEffect, useRef } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { canonicalPatientId } from '../utils/patientId';
import { VERSION_FIELDS } from '../constants/formFieldCatalog';
import { dossierPrefillPatch, candidaturePrefillPatch } from '../utils/dossierPrefill';
import { lookupDossier, isLookupId } from '../utils/dossierLookup';

const useDossierPrefill = (bbCodeVersion, formData, setFormData) => {
    const done = useRef(new Set());
    // Ce que ce pré-remplissage a écrit pour le patient précédent (champ → valeur) : si l'ID change, ces valeurs-là (et elles seules, si la personne ne les a pas retouchées) sont retirées
    // avant de reprendre le dossier du nouveau patient, au lieu de rester collées sur le mauvais patient.
    const applied = useRef(new Map());
    const patientNode = canonicalPatientId(formData?.patientID);

    useEffect(() => {
        if (!patientNode || !isLookupId(patientNode) || !setFormData) return undefined;
        const marker = `${bbCodeVersion}|${patientNode}`;
        if (done.current.has(marker)) return undefined;
        let cancelled = false;
        const timer = setTimeout(async () => {
            const { status, donnees } = await lookupDossier(patientNode);
            if (cancelled || status === 'denied') return; // dossier illisible (droits) : pas de pré-remplissage
            done.current.add(marker);
            const previouslyApplied = new Map(applied.current);
            const knownFields = Object.keys(VERSION_FIELDS[bbCodeVersion] || {});
            setFormData((prev) => {
                const base = { ...prev };
                previouslyApplied.forEach((value, field) => { if (base[field] === value) base[field] = ''; });
                const patch = status === 'found' ? dossierPrefillPatch(bbCodeVersion, donnees, base, knownFields) : {};
                applied.current = new Map(Object.entries(patch));
                const changed = previouslyApplied.size > 0 || Object.keys(patch).length > 0;
                return changed ? { ...base, ...patch } : prev;
            });
        }, 800);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [bbCodeVersion, patientNode, setFormData]);
};

export default useDossierPrefill;

// Candidatures : identité du compte + dossier de la personne connectée (jamais celui d'un autre). `enabled` : le formulaire courant est une candidature.
export const useCandidaturePrefill = ({ enabled, version, patientID, identity, formData, setFormData }) => {
    const done = useRef(new Set());
    const marker = `${version}|${canonicalPatientId(patientID)}`;
    useEffect(() => {
        if (!enabled || !identity || !setFormData || done.current.has(marker)) return undefined;
        let cancelled = false;
        const timer = setTimeout(async () => {
            let donnees = {};
            try {
                const node = canonicalPatientId(patientID);
                if (node) { const snap = await get(ref(database, `dossiersPatients/${node}/donnees`)); if (snap.exists()) donnees = snap.val(); }
            } catch (error) { /* dossier illisible : l'identité du compte suffit */ }
            if (cancelled) return;
            done.current.add(marker);
            setFormData((prev) => {
                const patch = candidaturePrefillPatch(identity, donnees, prev);
                return Object.keys(patch).length ? { ...prev, ...patch } : prev;
            });
        }, 1200);
        return () => { cancelled = true; clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, marker, !!identity]);
};
