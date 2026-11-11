// src/clinical/apply.js
//
// Passage des suggestions de l'assistant clinique aux champs du formulaire. Rien n'est jamais appliqué sans action du soignant, et par défaut un champ déjà rempli n'est pas écrasé.
import { entryText } from './engine';

const isEmpty = (value) => (Array.isArray(value) ? value.length === 0 : value === undefined || value === null || String(value).trim() === '');

// Sections applicables séparément (libellé du bouton → champs touchés).
export const SECTIONS = [
    { key: 'vitals', label: 'Constantes vitales', hint: 'Valeurs mesurées et catégories (température, pouls, respiration, tension).' },
    { key: 'anamnesis', label: 'Plainte et gravité', hint: 'Plainte principale, mécanisme et indice de gravité d\'urgence.' },
    { key: 'findings', label: 'Constatations', hint: 'État général, poumons, pupilles, blessures, ECG, échographie.' },
    { key: 'diagnosis', label: 'Diagnostic', hint: 'Diagnostic principal et secondaire.' },
    { key: 'procedure', label: 'Procédure et soins', hint: 'Procédures, imagerie à demander et soins systématiques.' },
    { key: 'meds', label: 'Médicaments', hint: 'Ajoute les médicaments proposés à la liste ci-dessous (doses calculées pour ce patient).' },
    { key: 'outcome', label: 'Orientation', hint: 'Admission, suivi et orientation de sortie.' },
];

/** Champs simples (hors médicaments) que chaque section écrit : { champ: valeur }. */
export const sectionPatch = (key, s) => {
    const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !isEmpty(v)));
    switch (key) {
        case 'vitals': return { ...s.vitals.fields, ...s.vitals.categories };
        case 'anamnesis': return clean({ patientChiefComplaint: s.text.complaint, patientInjuryMechanism: s.text.mechanism, painLevel: s.igu });
        case 'findings': return clean(s.findings);
        case 'diagnosis': return clean({ patientDiagnosis: s.text.diagnosis, patientSecondaryDiagnosis: s.text.secondary || 'Aucun' });
        case 'procedure': return clean({ patientProcedure: s.text.procedure, Imaging: s.imaging, routineCare: s.routineCare });
        case 'outcome': return clean({ admission: s.admission, followup: s.followup, dischargeDestination: s.destination });
        default: return {};
    }
};

/**
 * Applique un patch à l'état du formulaire : un champ non vide n'est pas touché (sauf `overwrite`). Les textes de procédure s'ajoutent à la suite de ce qui est déjà écrit.
 */
export const applyPatch = (prev, patch, overwrite = false) => {
    const next = { ...prev };
    Object.entries(patch).forEach(([field, value]) => {
        const current = prev[field];
        if (field === 'patientProcedure' && !isEmpty(current) && !overwrite) {
            if (!String(current).includes(String(value).split('\n')[0])) next[field] = `${String(current).trim()}\n\n${value}`;
            return;
        }
        if (overwrite || isEmpty(current)) next[field] = value;
    });
    return next;
};

/** Ajoute les médicaments suggérés (sans doublon de médicament + voie) ; `overwrite` remplace toute la liste. */
export const applyMeds = (prev, meds, overwrite = false) => {
    const current = Array.isArray(prev.clinicalMeds) ? prev.clinicalMeds : [];
    const incoming = meds.map(({ forCondition, ...entry }) => entry);
    if (overwrite) return { ...prev, clinicalMeds: incoming };
    const added = incoming.filter((entry) => !current.some((c) => c.medId === entry.medId && c.regimenId === entry.regimenId));
    return { ...prev, clinicalMeds: [...current, ...added] };
};

/** Tout appliquer d'un coup. */
export const applyAll = (prev, suggestions, overwrite = false) => {
    let next = prev;
    SECTIONS.forEach(({ key }) => {
        next = key === 'meds' ? applyMeds(next, suggestions.meds, overwrite) : applyPatch(next, sectionPatch(key, suggestions), overwrite);
    });
    return next;
};

/** Lignes imprimées « Médicaments administrés » (vide si rien). */
export const clinicalMedLines = (formData) => (Array.isArray(formData.clinicalMeds) ? formData.clinicalMeds : []).map(entryText).filter(Boolean);
