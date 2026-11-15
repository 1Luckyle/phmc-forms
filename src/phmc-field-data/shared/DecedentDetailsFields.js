import React from 'react';
import { Form } from 'react-bootstrap';
import BirthOrAgeFields from './BirthOrAgeFields';

// Genre à l'état civil : donnée médicale, tirée de l'anatomie (masculin ou féminin) ; une ancienne valeur « Indéterminé » reste affichée jusqu'à ce qu'on la remplace.
export const DECEDENT_SEX_OPTIONS = [
    { value: 'Male', label: 'Masculin' },
    { value: 'Female', label: 'Féminin' },
];

/**
 * Description physique du défunt, commune à la médecine légale et à l'autopsie.
 * Tous les champs sont optionnels : le défunt est souvent non identifié (John
 * ou Jane Doe), donc l'âge est une estimation et rien n'est exigé.
 *
 * Les clés (decedentAge, decedentSex…) sont volontairement distinctes de
 * patientAge/patientSex (formulaires cliniques) et de age/sex (rapport public
 * de décès) pour qu'aucune valeur ne passe d'un formulaire à l'autre.
 *
 * Date de naissance OU âge (bascule) : avec la date, l'âge se calcule tout seul à `refDate` (date de l'enquête ou de l'autopsie).
 * `showMeasures` : taille et poids, utiles surtout à l'autopsie.
 */
const DecedentDetailsFields = ({ formData, setFormData, handleChange, refDate, showMeasures = false }) => (
    <>
        <Form.Label className="form-section-title">Description du défunt</Form.Label>
        <BirthOrAgeFields
            formData={formData} setFormData={setFormData} handleChange={handleChange} dobName="decedentDateOfBirth" ageName="decedentAge" refDate={refDate}
            agePlaceholder="Âge (estimé si inconnu)" computedAgeLabel="Âge du défunt calculé à partir de sa date de naissance"
        >
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <Form.Label>Genre à l'état civil</Form.Label>
                <Form.Select name="decedentSex" value={formData.decedentSex || ''} onChange={handleChange} className="form-control">
                    <option value="">Genre à l'état civil du défunt</option>
                    {formData.decedentSex === 'Undetermined' && <option value="Undetermined">Indéterminé (ancienne saisie : à remplacer)</option>}
                    {DECEDENT_SEX_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
            </div>
            {showMeasures && (
                <>
                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                        <Form.Label>Taille</Form.Label>
                        <Form.Control type="text" name="decedentHeight" value={formData.decedentHeight || ''} onChange={handleChange} placeholder="Taille (ex. 1,80 m)" className="form-control" />
                    </div>
                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                        <Form.Label>Poids</Form.Label>
                        <Form.Control type="text" name="decedentWeight" value={formData.decedentWeight || ''} onChange={handleChange} placeholder="Poids (ex. 80 kg)" className="form-control" />
                    </div>
                </>
            )}
        </BirthOrAgeFields>
        <Form.Control
            as="textarea"
            rows={2}
            name="decedentMarks"
            value={formData.decedentMarks || ''}
            onChange={handleChange}
            placeholder="Signes particuliers : tatouages, cicatrices, bijoux, piercings, marques de naissance…"
            className="form-control"
        />
    </>
);

export default DecedentDetailsFields;
