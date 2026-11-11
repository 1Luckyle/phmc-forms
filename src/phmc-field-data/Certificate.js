// src/phmc-field-data/Certificate.js
import React from 'react';
import TemporaryIdPicker from './shared/TemporaryIdPicker';
import { Form } from 'react-bootstrap';
import CoronerSelect from './shared/CoronerSelect';
import NameFields from './shared/NameFields';
import PlaceWithCity from './shared/PlaceWithCity';
import PresetTextField from './shared/PresetTextField';
import { DEATH_CAUSE_PRESETS } from '../constants/deathPresets';

const DECEDENT_FIELDS = { full: 'decedentName', first: 'decedentFirstName', middle: 'decedentMiddleName', last: 'decedentLastName', title: 'decedentTitle' };
const WITNESS_FIELDS = { full: 'witnessName', first: 'witnessFirstName', middle: 'witnessMiddleName', last: 'witnessLastName', title: 'witnessTitle' };

const Certificate = ({
    formData,
    handleChange,
    setFormData,
    coronerGroupedOptions,
    handleSelectChange,
    currentUtcTime, // Assuming you want to display current time for date/time fields
}) => {
    return (
        <>
            <Form.Label className="form-section-title">Médecin légiste</Form.Label>
            <CoronerSelect options={coronerGroupedOptions} formData={formData} handleSelectChange={handleSelectChange} label="Coroner délivrant le certificat" />

            <Form.Label className="form-section-title">Défunt</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <NameFields
                    formData={formData} setFormData={setFormData} handleChange={handleChange} fields={DECEDENT_FIELDS}
                    placeholders={{ first: 'Prénom du défunt', middle: 'Deuxième prénom', last: 'Nom de famille' }}
                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text" name="patientID" value={formData.patientID || ''} onChange={handleChange}
                    placeholder="ID Patient (le défunt n'était peut-être pas patient du PHMC)" className="form-control"
                />
            </div>
            <TemporaryIdPicker formData={formData} setFormData={setFormData} />
            <Form.Label>Âge du défunt | Date de naissance (si disponible)</Form.Label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <Form.Control
                    type="number"
                    name="patientAge"
                    value={formData.patientAge}
                    onChange={handleChange}
                    placeholder="Âge du défunt"
                    className="form-control"
                />
                <Form.Control
                    type="date"
                    name="patientDateOfBirth"
                    value={formData.patientDateOfBirth}
                    onChange={handleChange}
                    placeholder="Date de naissance du défunt"
                    className="form-control"
                />
            </div>

            <Form.Label className="form-section-title">Décès</Form.Label>
            <PresetTextField
                name="probableCauseOfDeath" formData={formData} setFormData={setFormData} presets={DEATH_CAUSE_PRESETS}
                placeholder="Autres précisions sur la cause probable du décès" selectPlaceholder="Cause probable du décès (plusieurs choix possibles)…"
            />
            <Form.Label>Heure du décès | Date du décès</Form.Label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <Form.Control
                    type="time"
                    name="TimeofDeath"
                    value={formData.TimeofDeath}
                    onChange={handleChange}
                    placeholder="Heure du décès"
                    className="form-control"
                />
                <Form.Control
                    type="date"
                    name="dateofdeath"
                    value={formData.dateofdeath}
                    onChange={handleChange}
                    placeholder="Date du décès"
                    className="form-control"
                />
            </div>
            <Form.Label>Lieu du décès</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <PlaceWithCity formData={formData} setFormData={setFormData} handleChange={handleChange} addressName="placeOfDeath" zipName="placeOfDeathZip" placeholder="Lieu du décès (Numéro, Étage, Rue)" />
            </div>

            <Form.Label className="form-section-title">Témoin et délivrance</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <NameFields
                    formData={formData} setFormData={setFormData} handleChange={handleChange} fields={WITNESS_FIELDS}
                    placeholders={{ first: 'Prénom du témoin', middle: 'Deuxième prénom du témoin', last: 'Nom de famille du témoin' }}
                />
            </div>
            <Form.Control
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                placeholder="Date de délivrance du certificat"
                className="form-control"
                style={{ marginTop: '10px' }}
            />
            <span style={{ fontSize: '0.8em', color: '#9aa7b4', marginLeft: '10px' }}>
                (Heure actuelle du serveur: {currentUtcTime})
            </span>
        </>
    );
};

export default Certificate;
