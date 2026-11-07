// src/phmc-field-data/shared/PhmcEmployeeSelect.js
//
// « Identifiants de l'employé » des formulaires du personnel PHMC : un employé ne peut choisir QUE lui-même (il est sélectionné d'office et la liste est
// verrouillée) ; un administrateur peut choisir n'importe qui. Équivalent de CoronerSelect pour la liste du personnel hospitalier : la personne est
// retrouvée par son nom de compte (staffName), ou c'est la seule de la liste quand la page l'a déjà restreinte (voir hooks/useEmployeeSelector.js).
import React, { useEffect } from 'react';
import Select from 'react-select';
import { Form } from 'react-bootstrap';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { darkSelectStyles } from './selectStyles';

const norm = (value) => String(value || '').trim().toLowerCase();

const PhmcEmployeeSelect = ({
    name = 'phmcEmployee', label = '', options = [], formData, setFormData, placeholder = 'Sélectionner un médecin. (Vous pouvez taper pour rechercher!)',
}) => {
    const { staffName, isAdmin } = useEmployeeAuth();
    const flat = options.flatMap((group) => group.options);
    const mine = flat.find((option) => staffName && norm(option.value) === norm(staffName)) || null;
    const own = !isAdmin ? (mine || (flat.length === 1 ? flat[0] : null)) : null;
    const current = flat.find((option) => option.value === formData[name]) || null;

    const choose = (option) => setFormData((prev) => ({
        ...prev, [name]: option ? option.value : '', phmcEmployeeLastName: option ? (option.lastName || '') : '', lastName: option ? (option.lastName || '') : '',
    }));

    useEffect(() => {
        if (own && formData[name] !== own.value) choose(own);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [own && own.value, formData[name]]);

    return (
        <>
            {label && <Form.Label>{label}</Form.Label>}
            <Select
                name={name}
                value={current}
                onChange={choose}
                options={options}
                isClearable={!own}
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

export default PhmcEmployeeSelect;
