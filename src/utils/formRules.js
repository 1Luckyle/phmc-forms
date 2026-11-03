// src/utils/formRules.js
//
// Réglages « champs obligatoires » du back-office : lecture en direct (adminSettings/champsObligatoires, lecture publique, écriture admin) et
// écriture depuis Admin → Champs obligatoires. La logique (valeurs par défaut, verrous, résolution) est dans utils/formRulesCore.js.
import { useEffect, useState } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { database } from '../firebase';
import { setFormOverrides, getFormOverrides, subscribeFormOverrides, isDefaultRequired, lockedReasonOf } from './formRulesCore';

export const FORM_RULES_PATH = 'adminSettings/champsObligatoires';

let started = false;
export const startFormRulesSync = () => {
    if (started) return;
    started = true;
    onValue(ref(database, FORM_RULES_PATH), (snapshot) => setFormOverrides(snapshot.val()), () => { /* lecture impossible : valeurs par défaut du code */ });
};

// Redessine le composant quand un réglage change ; renvoie les réglages en vigueur.
export const useFormRules = () => {
    const [, setTick] = useState(0);
    useEffect(() => {
        startFormRulesSync();
        return subscribeFormOverrides(() => setTick((tick) => tick + 1));
    }, []);
    return getFormOverrides();
};

// Enregistre l'état voulu d'un champ. Si cet état est celui par défaut, le réglage est supprimé (rien à stocker).
export const saveFieldRequirement = async (version, field, required) => {
    if (lockedReasonOf(version, field)) throw new Error('Ce champ est verrouillé : il reste obligatoire.');
    const target = ref(database, `${FORM_RULES_PATH}/${Number(version)}/${field}`);
    if (required === isDefaultRequired(version, field)) await remove(target);
    else await set(target, !!required);
};

// Remet un formulaire aux valeurs par défaut du code.
export const resetFormRequirements = (version) => remove(ref(database, `${FORM_RULES_PATH}/${Number(version)}`));
