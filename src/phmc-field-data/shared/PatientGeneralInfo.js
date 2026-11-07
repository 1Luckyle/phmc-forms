// src/phmc-field-data/shared/PatientGeneralInfo.js
//
// Bloc « Informations générales » commun aux dossiers patient (Basique, Avancé, Mise à jour) : ID patient d'abord, puis titre et nom en trois champs,
// date de naissance, genre et ethnicité (listes avec choix par défaut), adresse, téléphone (avec son type), e-mail et Discord.
// `fields` associe chaque rôle au NOM du champ du formulaire ; un rôle absent n'est pas affiché (ex. pas de genre dans l'en-tête d'une mise à jour).
//   { id, title, full, first, middle, last, dob, gender, race, address, phone, email, discord }
import React, { useEffect } from 'react';
import { Form } from 'react-bootstrap';
import usePatientNameParts from '../../hooks/usePatientNameParts';
import ZipCityField from '../../components/ZipCityField';
import ComboSelect from './ComboSelect';
import { GENDER_OPTIONS, ETHNICITY_OPTIONS, toFrenchGender } from '../../utils/patientIdentity';

const Row = ({ children, first = false }) => <div style={{ display: 'flex', gap: '10px', marginTop: first ? 0 : '1rem', flexWrap: 'wrap' }}>{children}</div>;

// Liste de choix simple : la valeur actuelle reste visible même si elle n'est pas dans la liste (ancien rapport).
export const SimpleSelect = ({ name, value, onChange, options, placeholder, disabled = false, title, style }) => {
    const items = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
    const known = !value || items.some((item) => item.value === value);
    return (
        <Form.Select name={name} value={value || ''} onChange={onChange} className="form-control" disabled={disabled} title={title} style={style}>
            <option value="" disabled>{placeholder}</option>
            {!known && <option value={value}>{value}</option>}
            {items.map((item) => <option key={item.value} value={item.value} disabled={item.disabled}>{item.label}</option>)}
        </Form.Select>
    );
};

const PatientGeneralInfo = ({ formData, setFormData, handleChange, fields, patientTitleOptions = [], guard }) => {
    usePatientNameParts(formData, setFormData, { full: fields.full, first: fields.first, middle: fields.middle, last: fields.last });
    // Anciennes valeurs du genre (« Male », « Female »…) → libellés français de la liste.
    const genderValue = fields.gender ? formData[fields.gender] : '';
    useEffect(() => {
        if (!fields.gender || !genderValue) return;
        const french = toFrenchGender(genderValue);
        if (french !== genderValue) setFormData((prev) => ({ ...prev, [fields.gender]: french }));
    }, [fields.gender, genderValue, setFormData]);
    const set = (name) => (value) => setFormData((prev) => ({ ...prev, [name]: value }));
    const text = (name, placeholder, extra = {}) => (
        <Form.Control type="text" name={name} value={formData[name] || ''} onChange={handleChange} placeholder={placeholder} className="form-control" {...extra} />
    );

    return (
        <>
            {fields.id && <Row first>{text(fields.id, 'ID Patient')}</Row>}
            <Row first={!fields.id}>
                <SimpleSelect
                    name={fields.title} value={formData[fields.title]} onChange={handleChange} placeholder="Titre" style={{ flex: '0 0 150px', minWidth: '130px' }}
                    options={patientTitleOptions.map((option) => ({ value: option.value, label: guard ? guard.label(option) : option.label, disabled: guard ? guard.isDisabled(option) : false }))}
                    disabled={guard?.locked} title={guard?.hint}
                />
                {text(fields.first, 'Prénom')}
                {text(fields.middle, 'Deuxième prénom')}
                {text(fields.last, 'Nom de famille')}
            </Row>
            <Row>
                <Form.Control type="date" name={fields.dob} value={formData[fields.dob] || ''} onChange={handleChange} placeholder="Date de naissance" className="form-control" />
                {fields.gender && (
                    <SimpleSelect name={fields.gender} value={formData[fields.gender]} onChange={handleChange} options={GENDER_OPTIONS} placeholder="Genre à l'état civil du patient" />
                )}
                {fields.race && (
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <ComboSelect name={fields.race} value={formData[fields.race] || ''} onChange={set(fields.race)} options={ETHNICITY_OPTIONS} placeholder="Ethnicité du patient" />
                    </div>
                )}
            </Row>
            <Row>
                {text(fields.address, 'Adresse (Numéro, Étage, Rue)')}
                {fields.zip && (
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <ZipCityField zip={formData[fields.zip] || ''} onZipChange={(zip) => setFormData((prev) => ({ ...prev, [fields.zip]: zip }))} placeholder="Code postal" />
                    </div>
                )}
            </Row>
            <Row>
                {text(fields.phone, 'Numéro de téléphone du patient')}
                {fields.email && <Form.Control type="email" name={fields.email} value={formData[fields.email] || ''} onChange={handleChange} placeholder="Adresse email (ex: prenomnom@mail.eyefind.fr)" className="form-control" />}
                {fields.discord && text(fields.discord, '(( Pseudo Discord du patient ))')}
            </Row>
        </>
    );
};

export default PatientGeneralInfo;
