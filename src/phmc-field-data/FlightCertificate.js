import React from 'react';
import { Form, InputGroup, Alert } from 'react-bootstrap';
import { PatientIdentityFields, AppointmentDateField, CareEmployeeField } from './shared/CareFormHeader';
import { todayIso } from '../utils/appointmentDate';
import {
    FLIGHT_CERT_CLASSES, FLIGHT_CERT_CATEGORIES, FLIGHT_CERT_EXAMS, FLIGHT_CERT_RESULTS, FLIGHT_CERT_CONCLUSIONS,
    getFlightCertClass, examResultKey, examValueKey, validityMonthsFor, validUntil, ageOn,
} from '../utils/flightCertificate';

const FlightCertificate = ({ formData, handleChange, setFormData, phmcGroupedOptions }) => {
    const cls = getFlightCertClass(formData.flightCertClass);
    const categories = Array.isArray(formData.flightCertCategories) ? formData.flightCertCategories : [];

    const toggleCategory = (category) => {
        setFormData((prev) => {
            const current = Array.isArray(prev.flightCertCategories) ? prev.flightCertCategories : [];
            return { ...prev, flightCertCategories: current.includes(category) ? current.filter((c) => c !== category) : [...current, category] };
        });
    };

    const months = validityMonthsFor(formData.flightCertClass, formData.patientDateOfBirth, formData.date);
    const until = validUntil(formData.date, months);
    const age = ageOn(formData.patientDateOfBirth, formData.date);

    return (
        <>
            <Form.Label className="form-section-title">Certificat</Form.Label>
            <Form.Group className="mb-3">
                <Form.Label>Classe du certificat *</Form.Label>
                <Form.Select name="flightCertClass" value={formData.flightCertClass || ''} onChange={handleChange} className="form-control" required>
                    <option value="" disabled>Choisir la classe…</option>
                    {Object.values(FLIGHT_CERT_CLASSES).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Form.Select>
                {cls && <span className="helper-text">{cls.audience}</span>}
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Catégorie(s) de vol * (art. 400 du Code de l'Aviation)</Form.Label>
                <div className="d-flex flex-wrap gap-3">
                    {FLIGHT_CERT_CATEGORIES.map((category) => (
                        <Form.Check
                            key={category} type="checkbox" id={`flight-cat-${category}`} label={category}
                            checked={categories.includes(category)} onChange={() => toggleCategory(category)}
                        />
                    ))}
                </div>
            </Form.Group>

            <Form.Label className="form-section-title">Patient et examen</Form.Label>
            <PatientIdentityFields formData={formData} setFormData={setFormData} handleChange={handleChange} />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <Form.Label>Date de naissance du patient</Form.Label>
                    <Form.Control type="date" name="patientDateOfBirth" value={formData.patientDateOfBirth || ''} max={todayIso()} onChange={handleChange} className="form-control" />
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <AppointmentDateField formData={formData} handleChange={handleChange} label="Date de l'examen *" />
                </div>
            </div>

            {cls && (
                <>
                    <Form.Label className="form-section-title">Examens de la classe</Form.Label>
                    {cls.exams.map((exam) => {
                        const info = FLIGHT_CERT_EXAMS[exam];
                        return (
                            <Form.Group className="mb-3" key={exam}>
                                <Form.Label>{info.label} *</Form.Label>
                                <InputGroup>
                                    <Form.Select name={examResultKey(exam)} value={formData[examResultKey(exam)] || ''} onChange={handleChange} className="form-control" required>
                                        <option value="" disabled>Résultat…</option>
                                        {FLIGHT_CERT_RESULTS.map((result) => <option key={result} value={result}>{result}</option>)}
                                    </Form.Select>
                                    {info.valueLabel && (
                                        <Form.Control
                                            type="text" name={examValueKey(exam)} value={formData[examValueKey(exam)] || ''} onChange={handleChange}
                                            placeholder={info.valuePlaceholder} aria-label={info.valueLabel}
                                        />
                                    )}
                                </InputGroup>
                                <span className="helper-text">Critère : {info.criterion}.</span>
                            </Form.Group>
                        );
                    })}
                </>
            )}

            <Form.Label className="form-section-title">Conclusion</Form.Label>
            <Form.Group className="mb-3">
                <Form.Label>Conclusion *</Form.Label>
                <Form.Select name="flightCertConclusion" value={formData.flightCertConclusion || ''} onChange={handleChange} className="form-control" required>
                    <option value="" disabled>Choisir la conclusion…</option>
                    {FLIGHT_CERT_CONCLUSIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Form.Select>
            </Form.Group>

            {formData.flightCertConclusion === 'Apte avec restrictions' && (
                <Form.Group className="mb-3">
                    <Form.Label>Restrictions *</Form.Label>
                    <Form.Control as="textarea" rows={2} name="flightCertRestrictions" value={formData.flightCertRestrictions || ''} onChange={handleChange} placeholder="ex. Port de verres correcteurs obligatoire ; vol de jour uniquement" className="form-control" required />
                </Form.Group>
            )}

            <Form.Group className="mb-3">
                <Form.Label>Observations (facultatif — jamais de diagnostic)</Form.Label>
                <Form.Control as="textarea" rows={2} name="flightCertNote" value={formData.flightCertNote || ''} onChange={handleChange} placeholder="Information utile à l'autorité aéronautique, sans donnée médicale détaillée" className="form-control" />
            </Form.Group>

            {cls && months && (
                <Alert variant="info" className="py-2 small">
                    <strong>Validité :</strong> {months} mois{age !== null && age >= 40 ? ' (durée réduite : patient de 40 ans ou plus)' : ''}
                    {until && formData.flightCertConclusion !== 'Inapte' ? <> — valable jusqu'au <strong>{until.split('-').reverse().join('/')}</strong></> : null}.
                    {' '}Classe 1 : 12 mois (6 mois dès 40 ans) · Classe 2 : 24 mois (12 mois dès 40 ans).
                </Alert>
            )}

            <Form.Label className="form-section-title">Médecin signataire</Form.Label>
            <CareEmployeeField formData={formData} setFormData={setFormData} options={phmcGroupedOptions} label="Identifiants de l'employé *" />
            <span className="helper-text">Le certificat est signé par la personne qui le remplit : sa signature, son nom et son rôle figurent au bas du document.</span>
        </>
    );
};

export default FlightCertificate;
