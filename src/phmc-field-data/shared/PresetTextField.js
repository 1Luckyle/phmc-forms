// src/phmc-field-data/shared/PresetTextField.js
//
// Champ d'historique avec CHOIX PAR DÉFAUT : on coche autant de choix qu'on veut dans la liste, et on peut ajouter du texte libre en plus (même si des
// choix sont déjà faits). Le résultat est le texte regroupé « choix 1 ; choix 2 ; texte libre », enregistré dans le champ lui-même (`name`) : le
// reste de l'application (rapport BBCode, titre, recherche) lit ce champ comme avant. Les choix et le texte libre sont gardés à part
// (`{name}Presets` et `{name}Free`) pour pouvoir être modifiés ensuite.
// Un rapport enregistré avant l'arrivée des choix (texte seul) se rouvre avec son texte dans la zone de texte libre.
import React from 'react';
import Select from 'react-select';
import { Form } from 'react-bootstrap';
import { darkSelectStyles } from './selectStyles';
import { aggregatePresetText, HISTORY_FIELD_META, historyPlaceholder } from '../../constants/historyPresets';

export { aggregatePresetText };

// « Aucun(e) … » exclut les autres choix, et inversement.
const isNone = (label) => /^aucun/i.test(String(label || ''));

const PresetTextField = ({ name, formData, setFormData, presets = [], placeholder: placeholderProp, rows = 2, selectPlaceholder: selectPlaceholderProp }) => {
    // Pour les champs d'historique, le texte d'aide et le mode de choix viennent de HISTORY_FIELD_META (un champ à choix unique n'accepte qu'une réponse).
    const meta = HISTORY_FIELD_META[name] || {};
    const single = meta.mode === 'single';
    const groups = meta.groups || [];
    const placeholder = placeholderProp || historyPlaceholder(name);
    const selectPlaceholder = selectPlaceholderProp || (single ? 'Choisir dans la liste…' : 'Choisir dans la liste (plusieurs choix possibles)…');
    const presetsKey = `${name}Presets`;
    const freeKey = `${name}Free`;
    const structured = formData?.[presetsKey] !== undefined || formData?.[freeKey] !== undefined;
    const selected = Array.isArray(formData?.[presetsKey]) ? formData[presetsKey] : [];
    const free = structured ? (formData?.[freeKey] || '') : (formData?.[name] || '');

    const update = (nextSelected, nextFree) => setFormData((prev) => ({
        ...prev, [presetsKey]: nextSelected, [freeKey]: nextFree, [name]: aggregatePresetText(nextSelected, nextFree),
    }));

    const handleSelect = (options) => {
        let values = (options || []).map((option) => option.value);
        const lastAdded = values.find((value) => !selected.includes(value));
        if (lastAdded && single) values = [lastAdded];
        else if (lastAdded && isNone(lastAdded)) values = [lastAdded];
        else if (lastAdded) {
            values = values.filter((value) => !isNone(value));
            // Un choix retire ceux de son groupe d'exclusion (ex. « Active » remplace « Inactive »).
            const group = groups.find((list) => list.includes(lastAdded));
            if (group) values = values.filter((value) => value === lastAdded || !group.includes(value));
        }
        update(values, free);
    };

    return (
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <Select
                isMulti
                name={name}
                closeMenuOnSelect={single}
                value={selected.map((value) => ({ label: value, value }))}
                onChange={handleSelect}
                options={presets.map((preset) => ({ label: preset, value: preset }))}
                placeholder={selectPlaceholder}
                noOptionsMessage={() => 'Aucun choix'}
                styles={{ ...darkSelectStyles, container: (base) => ({ ...base, width: '100%' }) }}
                className="preset-select"
                aria-label={placeholder}
            />
            <Form.Control
                as="textarea"
                rows={rows}
                name={freeKey}
                value={free}
                onChange={(event) => update(selected, event.target.value)}
                placeholder={placeholder}
                className="form-control"
                style={{ marginTop: '6px' }}
            />
        </div>
    );
};

export default PresetTextField;
