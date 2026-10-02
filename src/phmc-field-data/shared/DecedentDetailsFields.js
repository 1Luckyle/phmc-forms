import React from 'react';
import { Form } from 'react-bootstrap';

export const DECEDENT_SEX_OPTIONS = [
    { value: 'Male', label: 'Masculin' },
    { value: 'Female', label: 'Féminin' },
    { value: 'Undetermined', label: 'Indéterminé' },
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
 * `showMeasures` : taille et poids, utiles surtout à l'autopsie.
 */
const DecedentDetailsFields = ({ formData, handleChange, showMeasures = false }) => (
    <>
        <Form.Label className="form-section-title">Description du défunt</Form.Label>
        <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                type="text"
                inputMode="numeric"
                name="decedentAge"
                value={formData.decedentAge || ''}
                onChange={handleChange}
                placeholder="Âge (estimé si inconnu) (optionnel)"
                className="form-control"
            />
            <Form.Select
                name="decedentSex"
                value={formData.decedentSex || ''}
                onChange={handleChange}
                className="form-control"
            >
                <option value="">Sexe du défunt (optionnel)</option>
                {DECEDENT_SEX_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
            {showMeasures && (
                <>
                    <Form.Control
                        type="text"
                        name="decedentHeight"
                        value={formData.decedentHeight || ''}
                        onChange={handleChange}
                        placeholder="Taille (ex. 1,80 m) (optionnel)"
                        className="form-control"
                    />
                    <Form.Control
                        type="text"
                        name="decedentWeight"
                        value={formData.decedentWeight || ''}
                        onChange={handleChange}
                        placeholder="Poids (ex. 80 kg) (optionnel)"
                        className="form-control"
                    />
                </>
            )}
        </div>
        <Form.Control
            as="textarea"
            rows={2}
            name="decedentMarks"
            value={formData.decedentMarks || ''}
            onChange={handleChange}
            placeholder="Signes particuliers : tatouages, cicatrices, bijoux, piercings, marques de naissance… (optionnel)"
            className="form-control"
        />
    </>
);

export default DecedentDetailsFields;
