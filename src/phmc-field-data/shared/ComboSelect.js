// src/phmc-field-data/shared/ComboSelect.js
//
// Liste de choix par défaut OU saisie libre dans la même case (ex. ethnicité du patient) : on choisit dans la liste ou on tape sa propre valeur.
// La valeur enregistrée est le texte (celui de la liste ou celui qu'on a saisi).
import React from 'react';
import CreatableSelect from 'react-select/creatable';
import { darkSelectStyles } from './selectStyles';

const ComboSelect = ({ name, value, onChange, options = [], placeholder = 'Choisir ou écrire…', isClearable = true }) => {
    const current = value ? { label: value, value } : null;
    return (
        <CreatableSelect
            name={name}
            value={current}
            onChange={(option) => onChange(option ? option.value : '')}
            options={options.map((item) => ({ label: item, value: item }))}
            placeholder={placeholder}
            isClearable={isClearable}
            formatCreateLabel={(input) => `Utiliser « ${input} »`}
            noOptionsMessage={() => 'Aucun choix : écrivez votre valeur'}
            styles={{ ...darkSelectStyles, container: (base) => ({ ...base, width: '100%' }) }}
        />
    );
};

export default ComboSelect;
