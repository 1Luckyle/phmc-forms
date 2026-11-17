// src/components/Contracts/ScheduleField.js
//
// Sélecteur d'horaires d'un contrat : des plages « jours + heure de début + heure de fin » (un bouton par jour de la semaine), autant de plages que nécessaire, et une précision libre
// (astreintes, rotation…). La valeur du champ reste un TEXTE lisible dans le contrat (utils/contractSchedule.js) : un ancien texte libre est conservé comme précision.
import React, { useEffect, useRef, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { DAYS, DAY_INITIALS, composeSchedule, parseSchedule } from '../../utils/contractSchedule';

const newPlage = () => ({ days: [], from: '08:00', to: '16:00' });

const ScheduleField = ({ name, value, onChange, disabled = false, help }) => {
    const [state, setState] = useState(() => {
        const parsed = parseSchedule(value);
        return { plages: parsed.plages, note: parsed.note };
    });
    // Dernier texte produit par ce composant : une valeur qui change AILLEURS (autre document chargé, type changé) recharge les plages, pas celle qu'on vient d'écrire.
    const lastEmitted = useRef(value || '');

    useEffect(() => {
        if ((value || '') === lastEmitted.current) return;
        lastEmitted.current = value || '';
        setState(parseSchedule(value));
    }, [value]);

    const update = (next) => {
        setState(next);
        const text = composeSchedule(next);
        lastEmitted.current = text;
        onChange(text);
    };
    const setPlage = (index, patch) => update({ ...state, plages: state.plages.map((plage, i) => (i === index ? { ...plage, ...patch } : plage)) });
    const toggleDay = (index, day) => {
        const plage = state.plages[index];
        setPlage(index, { days: plage.days.includes(day) ? plage.days.filter((d) => d !== day) : [...plage.days, day].sort((a, b) => a - b) });
    };

    return (
        <div className="contract-schedule" data-guide={help || 'Choisissez les jours et les heures de chaque plage ; ajoutez une plage par rythme différent.'}>
            {state.plages.map((plage, index) => (
                <div key={index} className="contract-schedule-plage">
                    <div className="contract-schedule-days" role="group" aria-label={`Jours de la plage ${index + 1}`}>
                        {DAYS.map((day, d) => (
                            <button
                                key={day} type="button" disabled={disabled} className={plage.days.includes(d) ? 'on' : ''} aria-pressed={plage.days.includes(d)} title={day}
                                aria-label={day} onClick={() => toggleDay(index, d)}
                            >{DAY_INITIALS[d]}</button>
                        ))}
                    </div>
                    <div className="contract-schedule-times">
                        <Form.Control type="time" size="sm" aria-label={`Début de la plage ${index + 1}`} value={plage.from} disabled={disabled} onChange={(e) => setPlage(index, { from: e.target.value })} style={{ colorScheme: 'dark' }} />
                        <span aria-hidden="true">→</span>
                        <Form.Control type="time" size="sm" aria-label={`Fin de la plage ${index + 1}`} value={plage.to} disabled={disabled} onChange={(e) => setPlage(index, { to: e.target.value })} style={{ colorScheme: 'dark' }} />
                        <Button variant="outline-danger" size="sm" disabled={disabled} onClick={() => update({ ...state, plages: state.plages.filter((_, i) => i !== index) })} aria-label={`Retirer la plage ${index + 1}`} title="Retirer cette plage"><i className="fas fa-xmark"></i></Button>
                    </div>
                </div>
            ))}
            <div className="contract-schedule-actions">
                <Button variant="outline-primary" size="sm" disabled={disabled} onClick={() => update({ ...state, plages: [...state.plages, newPlage()] })}><i className="fas fa-plus me-1"></i>Ajouter une plage horaire</Button>
            </div>
            <Form.Control
                type="text" size="sm" className="mt-2" name={name ? `${name}Precision` : undefined} placeholder="Précision : astreintes, rotation, week-ends…" aria-label="Précision sur les horaires" maxLength={300}
                value={state.note} disabled={disabled} onChange={(e) => update({ ...state, note: e.target.value })}
            />
        </div>
    );
};

export default ScheduleField;
