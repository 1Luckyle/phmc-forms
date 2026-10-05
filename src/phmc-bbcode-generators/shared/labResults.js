import { LEGACY_LAB_KEYS } from '../../constants/clinicalOptions';

const box = (selected, key) => `[cb${selected.includes(key) ? 'c' : ''}]`;

/**
 * Section « Labo » du BBCode : les sept cases historiques (inchangées), plus
 * une ligne « Autres résultats » pour tous les résultats ajoutés depuis, dont
 * la valeur est déjà un texte français lisible.
 */
export const buildLabBBCode = (formData) => {
    const selected = Array.isArray(formData.lab) ? formData.lab : [];
    const legacyLine = `[table][tr][td][center]Labo: ${box(selected, 'WNL')} DLN  ${box(selected, 'Anemia')} Anémie ${box(selected, 'Inflammation/Infection')} Inflammation/Infection ${box(selected, 'Dysfunction')} Dysfonctionnement/Trouble ${box(selected, 'ElectrolyteImbalance')} Déséquilibre électrolytique ${box(selected, 'Infarct')} Infarctus/Embolie ${box(selected, 'Tumor')} Tumeur [/center][/table]`;

    const others = selected.filter((value) => !LEGACY_LAB_KEYS.includes(value));
    if (others.length === 0) return legacyLine;
    return `${legacyLine}\n[table][tr][td][center]Autres résultats de laboratoire: ${others.join(', ')}[/center][/table]`;
};
