// src/phmc-field-data/shared/NameFields.js
//
// Nom d'une personne en TROIS champs (prénom, deuxième prénom, nom de famille), précédés de son TITRE (liste M., Mme, Mlle…), à placer dans une rangée
// flex. Le nom complet (`fields.full`) est recomposé tout seul pour le titre du rapport et le BBCode (voir hooks/usePatientNameParts.js) ; le titre n'y entre pas.
// `fields` : { full, first, middle, last, title } = noms des champs du formulaire (sans `title`, pas de liste de titre).
// `guard` : (facultatif) règle du titre « Mineur » liée à une date de naissance (hooks/useMinorTitleGuard.js). Sans date de naissance à vérifier
// (contact d'urgence, mandataire, défunt…), on ne passe rien : le choix du titre est libre.
import React from 'react';
import { Form } from 'react-bootstrap';
import usePatientNameParts from '../../hooks/usePatientNameParts';
import useTitleOptions from '../../hooks/useTitleOptions';
import { SimpleSelect } from './PatientGeneralInfo';

const NameFields = ({ formData, setFormData, handleChange, fields, placeholders = {}, disabled = false, guard }) => {
    usePatientNameParts(formData, setFormData, fields);
    const titleOptions = useTitleOptions();
    const input = (name, placeholder) => (
        <Form.Control type="text" name={name} value={formData[name] || ''} onChange={handleChange} placeholder={placeholder} className="form-control" disabled={disabled} />
    );
    return (
        <>
            {fields.title && (
                <SimpleSelect
                    name={fields.title} value={formData[fields.title]} onChange={handleChange} placeholder={placeholders.title || 'Titre'}
                    style={{ flex: '0 0 150px', minWidth: '130px' }} disabled={disabled || !!guard?.locked} title={guard?.hint}
                    options={titleOptions.map((option) => ({ value: option.value, label: guard ? guard.label(option) : option.label, disabled: guard ? guard.isDisabled(option) : false }))}
                />
            )}
            {input(fields.first, placeholders.first || 'Prénom')}
            {input(fields.middle, placeholders.middle || 'Deuxième prénom')}
            {input(fields.last, placeholders.last || 'Nom de famille')}
        </>
    );
};

export default NameFields;
