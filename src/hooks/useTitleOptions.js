// src/hooks/useTitleOptions.js
//
// Liste des titres (M., Mme, Mlle…) proposés à côté d'un nom en trois champs : celle tenue dans la base (selectOptions.patientTitle), la même que
// celle des dossiers patient ; à défaut (base pas encore chargée), la liste de secours de utils/patientIdentity.js.
import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { TITLE_LABELS } from '../utils/patientIdentity';

const FALLBACK = Object.entries(TITLE_LABELS).map(([value, label]) => ({ value, label }));

const useTitleOptions = () => {
    const { selectOptions } = useData();
    const raw = selectOptions?.patientTitle;
    return useMemo(() => {
        if (!Array.isArray(raw) || raw.length === 0) return FALLBACK;
        return raw.map((item) => {
            if (item && typeof item === 'object' && 'label' in item && 'value' in item) return item;
            const text = String(item && typeof item === 'object' ? (item.label ?? item.name ?? item.value ?? '') : item);
            return { value: text, label: text };
        });
    }, [raw]);
};

export default useTitleOptions;
