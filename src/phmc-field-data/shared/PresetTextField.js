// src/phmc-field-data/shared/PresetTextField.js
//
// Champ d'historique avec CHOIX PAR DÉFAUT, en UN SEUL champ : on choisit dans la liste autant de choix qu'on veut, et on peut aussi ÉCRIRE directement dans le champ pour ajouter ou préciser
// ce que la liste ne propose pas (Entrée, ou simplement quitter le champ : le texte écrit devient une étiquette comme les autres). Le résultat est le texte regroupé « choix 1 ; choix 2 ; texte
// écrit », enregistré dans le champ lui-même (`name`) : le reste de l'application (rapport BBCode, titre, recherche) lit ce champ comme avant. Les étiquettes sont gardées à part
// (`{name}Presets`) pour pouvoir être modifiées ensuite ; `{name}Free` n'est plus saisi (il reste vide) mais un rapport enregistré avec l'ancien texte libre le retrouve comme étiquette.
// Un rapport enregistré avant l'arrivée des choix (texte seul) se rouvre avec son texte découpé en étiquettes.
import React, { useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import { darkSelectStyles } from './selectStyles';
import { aggregatePresetText, HISTORY_FIELD_META, historyPlaceholder } from '../../constants/historyPresets';

export { aggregatePresetText };

// « Aucun(e) … » exclut les autres choix, et inversement.
const isNone = (label) => /^aucun/i.test(String(label || ''));

// Étiquettes à afficher d'après les données : choix enregistrés + ancien texte libre ; à défaut, le texte regroupé du champ (ancien rapport, dossier repris), coupé sur « ; ».
export const itemsOf = (formData, name) => {
    const stored = Array.isArray(formData?.[`${name}Presets`]) ? formData[`${name}Presets`] : [];
    const split = (text) => String(text || '').split(/\s*;\s*/).map((part) => part.trim()).filter(Boolean);
    const free = split(formData?.[`${name}Free`]).filter((part) => !stored.includes(part));
    if (stored.length || free.length) return [...stored, ...free];
    return split(formData?.[name]);
};

const PresetTextField = ({ name, formData, setFormData, presets = [], placeholder: placeholderProp, selectPlaceholder: selectPlaceholderProp }) => {
    // Pour les champs d'historique, le texte d'aide et le mode de choix viennent de HISTORY_FIELD_META (un champ à choix unique n'accepte qu'une réponse).
    const meta = HISTORY_FIELD_META[name] || {};
    const single = meta.mode === 'single';
    const groups = meta.groups || [];
    const hint = placeholderProp || historyPlaceholder(name);
    // Champ d'historique sans texte d'aide propre : un titre court au-dessus (« Tabac »), et dans le champ seulement « Choisir ou écrire… » (l'aide détaillée reste dans l'info-bulle).
    const label = !placeholderProp && !selectPlaceholderProp ? meta.label : undefined;
    const placeholder = selectPlaceholderProp
        || (label ? 'Choisir ou écrire…' : (hint ? `${hint} — choisir ou écrire` : 'Choisir ou écrire…'));
    const presetsKey = `${name}Presets`;
    const freeKey = `${name}Free`;
    const items = itemsOf(formData, name);
    const [input, setInput] = useState('');

    const update = (next) => setFormData((prev) => ({ ...prev, [presetsKey]: next, [freeKey]: '', [name]: aggregatePresetText(next, '') }));

    const apply = (values) => {
        let next = values;
        const lastAdded = values.find((value) => !items.includes(value));
        if (lastAdded && single) next = [lastAdded];
        else if (lastAdded && isNone(lastAdded)) next = [lastAdded];
        else if (lastAdded) {
            next = values.filter((value) => !isNone(value));
            // Un choix retire ceux de son groupe d'exclusion (ex. « Active » remplace « Inactive »).
            const group = groups.find((list) => list.includes(lastAdded));
            if (group) next = next.filter((value) => value === lastAdded || !group.includes(value));
        }
        update(next);
    };

    // Le texte écrit puis laissé en plan (clic ailleurs, changement de champ) devient une étiquette : rien n'est perdu.
    const commitInput = () => {
        const text = input.trim();
        setInput('');
        if (text && !items.includes(text)) apply([...items, text]);
    };

    return (
        <div className="preset-field">
            {label && <div className="preset-field-label">{label}</div>}
            <CreatableSelect
                isMulti
                name={name}
                closeMenuOnSelect={single}
                value={items.map((value) => ({ label: value, value }))}
                onChange={(options) => apply((options || []).map((option) => option.value))}
                options={presets.map((preset) => ({ label: preset, value: preset }))}
                inputValue={input}
                onInputChange={(value, { action }) => { if (action === 'input-change') setInput(value); else if (action === 'set-value' || action === 'input-blur') setInput(''); }}
                onBlur={commitInput}
                placeholder={placeholder}
                formatCreateLabel={(text) => `Ajouter « ${text} »`}
                noOptionsMessage={() => 'Aucun choix : écrivez votre texte pour l\'ajouter'}
                styles={{ ...darkSelectStyles, container: (base) => ({ ...base, width: '100%' }) }}
                className="preset-select"
                aria-label={hint || placeholder}
            />
        </div>
    );
};

export default PresetTextField;
