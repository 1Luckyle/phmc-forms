// src/components/EstablishmentPicker.js
//
// Choix de l'établissement qui émet un document administratif (contrat, accord, AMA) : PHMC ou clinique de Paleto Bay (PBC). Le sélecteur DISPARAÎT quand
// les formulaires PBC sont désactivés (panneau admin → Affichage) : le document est alors toujours un document du PHMC. Voir constants/establishments.js.
import React from 'react';
import { Form } from 'react-bootstrap';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { ESTABLISHMENTS } from '../constants/establishments';

const EstablishmentPicker = ({ value, onChange, disabled = false, label = 'Établissement', help = '', name = 'etablissement' }) => {
    const { pbcEnabled } = useSiteConfig();
    if (!pbcEnabled) return null;
    const current = value === 'pbc' ? 'pbc' : 'phmc';
    return (
        <Form.Group className="mb-3 establishment-picker" data-no-mark>
            <Form.Label>{label}</Form.Label>
            <div className="d-flex flex-wrap gap-3" role="radiogroup" aria-label={label}>
                {Object.values(ESTABLISHMENTS).map((establishment) => (
                    <Form.Check
                        key={establishment.key} type="radio" inline className="me-0"
                        id={`${name}-${establishment.key}`} name={name} disabled={disabled}
                        label={<><strong>{establishment.label}</strong> <span className="text-muted small">{establishment.key === 'pbc' ? 'Clinique de Paleto Bay' : 'Pillbox Hill Medical Center'}</span></>}
                        checked={current === establishment.key}
                        onChange={() => onChange(establishment.key)}
                    />
                ))}
            </div>
            {help && <Form.Text className="text-muted">{help}</Form.Text>}
        </Form.Group>
    );
};

export default EstablishmentPicker;
