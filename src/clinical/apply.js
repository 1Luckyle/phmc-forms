// src/clinical/apply.js
//
// Passage des suggestions de l'assistant clinique aux champs du formulaire. Rien n'est jamais appliqué sans action du soignant, et par défaut un champ déjà rempli n'est pas écrasé.
import { entryText } from './engine';
import { addMinutes, examKeyOfImaging } from './context';

const isEmpty = (value) => (Array.isArray(value) ? value.length === 0 : value === undefined || value === null || String(value).trim() === '');

// Sections applicables séparément (libellé du bouton → champs touchés). `modes` : formulaires concernés (tous si absent).
export const SECTIONS = [
    { key: 'patient', label: 'Patient', hint: 'Complète les champs vides du patient : date de naissance et âge plausibles, sexe, allergies, antécédents et traitements habituels. Ne remplace jamais ce qui est saisi.' },
    { key: 'vitals', label: 'Constantes vitales', hint: 'Valeurs mesurées et catégories (température, pouls, respiration, tension, oxygène sanguin).' },
    { key: 'arrival', label: 'Arrivée', modes: ['emergency'], hint: "Mode d'arrivée, heure d'arrivée et heure de prise en charge." },
    { key: 'anamnesis', label: 'Plainte et gravité', hint: 'Plainte principale, mécanisme et indice de gravité d\'urgence.' },
    { key: 'findings', label: 'Constatations', hint: 'État général, poumons, pupilles, blessures, ECG, échographie (sans particularité quand le motif ne précise rien).' },
    { key: 'exams', label: 'Examens', hint: 'Imagerie et résultats probables, résultats de laboratoire (en consultation : examens à prescrire).' },
    { key: 'diagnosis', label: 'Diagnostic', hint: 'Diagnostic principal et secondaire.' },
    { key: 'procedure', label: 'Procédure et soins', hint: 'Procédures et soins systématiques.' },
    { key: 'meds', label: 'Médicaments', hint: 'Ajoute les médicaments proposés à la liste ci-dessous (doses calculées pour ce patient).' },
    { key: 'outcome', label: 'Orientation', hint: 'Admission, suivi, orientation de sortie et conseils.' },
];
export const sectionsFor = (mode) => SECTIONS.filter((section) => !section.modes || section.modes.includes(mode));

// Imagerie suggérée → examens à prescrire de la consultation générale (constants/careFormOptions.js : EXAMS_ORDERED).
const EXAM_OF_IMAGING = { XRay: 'Xray', CTScan: 'Ct', MRI: 'Mri', Ultrasound: 'Ultrasound' };

/**
 * Champs simples (hors médicaments) que chaque section écrit : { champ: valeur }.
 * mode 'emergency' : protocole d'urgence ; 'consult' : consultation générale (pas d'indice de gravité, d'imagerie réalisée, de soins systématiques ni d'orientation de sortie ; les examens à faire sont prescrits).
 * extra : { now: 'HH:MM', appointmentTime, bloodOxy } — valeurs connues au moment du clic (heure, liste de l'oxygène sanguin).
 */
export const sectionPatch = (key, s, mode = 'emergency', extra = {}) => {
    const consult = mode === 'consult';
    const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !isEmpty(v)));
    switch (key) {
        case 'patient': return clean(s.patientPatch || {});
        case 'vitals': return clean({ ...s.vitals.fields, ...s.vitals.categories, bloodOxy: extra.bloodOxy });
        case 'arrival': {
            const arrival = extra.appointmentTime || extra.now || '';
            return clean({ arrivalMode: s.arrivalMode, arrivalTime: arrival, careStartTime: addMinutes(arrival, s.severity.index >= 2 ? 2 : 10) });
        }
        case 'anamnesis': return clean(consult ? { patientChiefComplaint: s.text.complaint } : { patientChiefComplaint: s.text.complaint, patientInjuryMechanism: s.text.mechanism, painLevel: s.igu });
        case 'findings': return clean(s.findings);
        case 'exams': {
            if (consult) {
                const ordered = [...new Set([...s.imaging.map((type) => EXAM_OF_IMAGING[type]).filter(Boolean), ...((s.exams.lab || []).length ? ['Blood'] : [])])];
                return clean({ examsOrdered: ordered });
            }
            // Les résultats d'imagerie ne sont posés que pour les types d'imagerie suggérés.
            const results = Object.fromEntries(s.imaging.map((type) => [examKeyOfImaging[type], s.exams[examKeyOfImaging[type]]]).filter(([k, v]) => k && v));
            return clean({ Imaging: s.imaging, ...results, lab: s.exams.lab });
        }
        case 'diagnosis': return clean({ patientDiagnosis: s.text.diagnosis, patientSecondaryDiagnosis: s.text.secondary || 'Aucun' });
        case 'procedure': return clean(consult ? { patientProcedure: s.text.procedure } : { patientProcedure: s.text.procedure, routineCare: s.routineCare });
        case 'outcome': return clean(consult ? { admission: s.admission, followup: s.followup } : { admission: s.admission, followup: s.followup, dischargeDestination: s.destination, patientMedicine: s.text.advice });
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

/** Applique UNE section. Le patient (identité, antécédents) n'est jamais remplacé, même avec `overwrite` : seuls ses champs vides sont complétés. */
export const applySection = (prev, key, suggestions, { overwrite = false, mode = 'emergency', extra = {} } = {}) => (
    key === 'meds' ? applyMeds(prev, suggestions.meds, overwrite) : applyPatch(prev, sectionPatch(key, suggestions, mode, extra), overwrite && key !== 'patient')
);

/** Tout appliquer d'un coup. */
export const applyAll = (prev, suggestions, overwrite = false, mode = 'emergency', extra = {}) => (
    sectionsFor(mode).reduce((next, { key }) => applySection(next, key, suggestions, { overwrite, mode, extra }), prev)
);

/** Lignes imprimées « Médicaments administrés » (vide si rien). */
export const clinicalMedLines = (formData) => (Array.isArray(formData.clinicalMeds) ? formData.clinicalMeds : []).map(entryText).filter(Boolean);
