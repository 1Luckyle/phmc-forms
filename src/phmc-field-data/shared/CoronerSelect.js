// src/phmc-field-data/shared/CoronerSelect.js
//
// « Identifiants de l'employé » des formulaires de médecine légale : un membre du DMEC ne peut choisir QUE lui-même (la liste ne contient que lui et il
// est sélectionné d'office, liste verrouillée) ; un administrateur peut choisir n'importe qui. `options` est la liste restreinte fournie par la page
// (voir hooks/useEmployeeSelector.js) ; pour un champ « examinateur en chef », passer la liste non restreinte avec `restricted={false}`.
import React, { useEffect } from 'react';
import Select from 'react-select';
import { Form } from 'react-bootstrap';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { darkSelectStyles } from './selectStyles';

const CoronerSelect = ({
    name = 'coronerEmployee', label = "Identifiants de l'employé", options = [], formData, handleSelectChange,
    placeholder = 'Sélectionner un coroner. (Vous pouvez taper pour rechercher!)', restricted = true, isClearable = true,
}) => {
    const { isAdmin } = useEmployeeAuth();
    const flat = options.flatMap((group) => group.options);
    // Employé non administrateur dont la liste ne contient que lui : il est sélectionné d'office et ne peut pas en changer.
    const own = restricted && !isAdmin && flat.length === 1 ? flat[0] : null;
    const current = flat.find((option) => option.value === formData[name]) || null;

    useEffect(() => {
        if (own && formData[name] !== own.value) handleSelectChange(own, { name });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [own, formData[name]]);

    return (
        <>
            {label && <Form.Label>{label}</Form.Label>}
            <Select
                name={name}
                value={current}
                onChange={(selected) => handleSelectChange(selected, { name })}
                options={options}
                isClearable={isClearable && !own}
                isDisabled={!!own}
                placeholder={placeholder}
                className="form-control"
                styles={{
                    ...darkSelectStyles,
                    group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
                    groupHeading: (base) => ({ ...base, color: '#9aa7b4', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 }),
                }}
            />
            {own && <span className="helper-text">Vous êtes connecté(e) : votre identité est utilisée automatiquement et ne peut pas être changée ici.</span>}
        </>
    );
};

export default CoronerSelect;
