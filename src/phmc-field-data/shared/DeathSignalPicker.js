// src/phmc-field-data/shared/DeathSignalPicker.js
//
// En tête de « Services de Médecine Légale » : « Partir d'un décès signalé ». Les décès signalés par les soignants (urgences, opération) qui n'ont pas encore de rapport de décès se choisissent ici, et
// préremplissent le rapport (identité, ID, date et heure, cause, nature, synopsis). Le lien avec la fiche repose sur sa clé (deathSignalKey) : l'enregistrement du rapport la marque « traitée ».
import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { Form } from 'react-bootstrap';
import { darkSelectStyles } from './selectStyles';
import { loadDeathSignals, deathSignalSummary, deathSignalToDmecForm } from '../../utils/deathSignals';

const DeathSignalPicker = ({ formData, setFormData }) => {
    const [signals, setSignals] = useState([]);
    useEffect(() => {
        let cancelled = false;
        loadDeathSignals().then((all) => { if (!cancelled) setSignals(all.filter((signal) => signal.statut === 'a_traiter')); }).catch(() => {});
        return () => { cancelled = true; };
    }, []);
    if (!signals.length && !formData.deathSignalKey) return null;
    const options = signals.map((signal) => ({ value: signal.key, label: deathSignalSummary(signal), signal }));
    const current = options.find((option) => option.value === formData.deathSignalKey) || null;
    return (
        <div style={{ marginBottom: '0.8rem' }} data-no-tip="1">
            <Form.Label>Partir d'un décès signalé par les soignants</Form.Label>
            <Select
                options={options} value={current} isClearable styles={darkSelectStyles} className="form-control p-0" placeholder="Choisir un décès signalé (préremplit le rapport)…"
                noOptionsMessage={() => 'Aucun décès à traiter'}
                onChange={(option) => setFormData((prev) => (option ? { ...prev, ...deathSignalToDmecForm(option.signal), deathSignalKey: option.value } : { ...prev, deathSignalKey: '' }))}
            />
            {formData.deathSignalKey && <span className="helper-text">Le rapport est lié à ce décès signalé : il sera marqué « traité » à l'enregistrement.</span>}
        </div>
    );
};

export default DeathSignalPicker;
