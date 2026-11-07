import React, { useEffect, useMemo } from 'react';
import { Form, InputGroup, Button, Alert } from 'react-bootstrap';
import Select from 'react-select';
import ImagePreview from '../components/ImagePreview';
import { getCachedSignatureUrl } from '../utils/userCreations';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import {
    FLIGHT_CERT_CLASSES, FLIGHT_CERT_CATEGORIES, FLIGHT_CERT_EXAMS, FLIGHT_CERT_RESULTS, FLIGHT_CERT_CONCLUSIONS,
    getFlightCertClass, examResultKey, examValueKey, validityMonthsFor, validUntil, ageOn, validateFlightCertificate,
} from '../utils/flightCertificate';

const selectStyles = {
    control: (base) => ({ ...base, backgroundColor: '#16202c', color: '#eeeeeeb0', borderColor: '#30363d', '&:hover': { borderColor: '#30363d' } }),
    menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
    singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
    input: (base) => ({ ...base, color: '#eeeeeeb0' }),
    placeholder: (base) => ({ ...base, color: '#eeeeeeb0' }),
};

const FlightCertificate = ({ formData, handleChange, setFormData, phmcGroupedOptions, handleSelectChange, showNotification }) => {
    const { staffName, isAdmin } = useEmployeeAuth();
    const notify = showNotification || (() => {});
    const cls = getFlightCertClass(formData.flightCertClass);
    const categories = Array.isArray(formData.flightCertCategories) ? formData.flightCertCategories : [];

    const allOptions = useMemo(() => (phmcGroupedOptions || []).flatMap((group) => group.options), [phmcGroupedOptions]);
    // Le certificat est signé par SOI-MÊME : le signataire est imposé (un administrateur peut en choisir un autre).
    const myOption = useMemo(
        () => allOptions.find((option) => staffName && String(option.value || '').trim().toLowerCase() === String(staffName).trim().toLowerCase()) || null,
        [allOptions, staffName],
    );
    const lockedToMe = !!myOption && !isAdmin;

    useEffect(() => {
        if (lockedToMe && formData.phmcEmployee !== myOption.value) {
            setFormData((prev) => ({ ...prev, phmcEmployee: myOption.value, lastName: myOption.lastName || '', phmcRank: myOption.rank || '' }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lockedToMe, myOption, formData.phmcEmployee]);

    // Le grade imprimé suit TOUJOURS le signataire sélectionné.
    useEffect(() => {
        const rank = allOptions.find((option) => option.value === formData.phmcEmployee)?.rank || '';
        if ((formData.phmcRank || '') !== rank) setFormData((prev) => ({ ...prev, phmcRank: rank }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.phmcEmployee, allOptions]);

    // Ma signature (Carte de visite → Signature) : préremplie si le champ est vide.
    useEffect(() => {
        const mySignature = getCachedSignatureUrl();
        if (mySignature && !formData.phmcEmployeeSignatureImage) {
            setFormData((prev) => (prev.phmcEmployeeSignatureImage ? prev : { ...prev, phmcEmployeeSignatureImage: mySignature }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleCategory = (category) => {
        setFormData((prev) => {
            const current = Array.isArray(prev.flightCertCategories) ? prev.flightCertCategories : [];
            return { ...prev, flightCertCategories: current.includes(category) ? current.filter((c) => c !== category) : [...current, category] };
        });
    };

    const months = validityMonthsFor(formData.flightCertClass, formData.patientDateOfBirth, formData.date);
    const until = validUntil(formData.date, months);
    const age = ageOn(formData.patientDateOfBirth, formData.date);
    const problems = validateFlightCertificate(formData);

    const applyMySignature = () => {
        const mySignature = getCachedSignatureUrl();
        if (!mySignature) { notify('Vous n\'avez pas encore de signature : créez-la dans la boîte à outils → Carte de visite → onglet Signature.', 'warning'); return; }
        setFormData((prev) => ({ ...prev, phmcEmployeeSignatureImage: mySignature }));
    };

    return (
        <>

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

            <Form.Group className="mb-3">
                <Form.Label>Nom du patient *</Form.Label>
                <Form.Control type="text" name="patientName" value={formData.patientName || ''} onChange={handleChange} placeholder="Prénom (Deuxième Prénom) & Nom du patient" className="form-control" required />
            </Form.Group>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Group className="mb-3" style={{ flex: 1 }}>
                    <Form.Label>ID du patient</Form.Label>
                    <Form.Control type="text" name="patientID" value={formData.patientID || ''} onChange={handleChange} placeholder="ex. PHMC-2752" className="form-control" />
                </Form.Group>
                <Form.Group className="mb-3" style={{ flex: 1 }}>
                    <Form.Label>Date de naissance du patient</Form.Label>
                    <Form.Control type="date" name="patientDateOfBirth" value={formData.patientDateOfBirth || ''} onChange={handleChange} className="form-control" />
                </Form.Group>
                <Form.Group className="mb-3" style={{ flex: 1 }}>
                    <Form.Label>Date de l'examen *</Form.Label>
                    <Form.Control type="date" name="date" value={formData.date || ''} onChange={handleChange} className="form-control" required />
                </Form.Group>
            </div>

            {cls && (
                <>
                    <h6 className="mt-2">Examens de la classe</h6>
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

            <Form.Group className="mb-3">
                <Form.Label>Médecin signataire *</Form.Label>
                <Select
                    name="phmcEmployee"
                    value={allOptions.find((option) => option.value === formData.phmcEmployee) || null}
                    onChange={(selectedOption, actionMeta) => handleSelectChange(selectedOption, actionMeta)}
                    options={phmcGroupedOptions}
                    isClearable={!lockedToMe}
                    isDisabled={lockedToMe}
                    placeholder="Sélectionner un soignant. (Vous pouvez taper pour rechercher!)"
                    className="form-control"
                    styles={selectStyles}
                />
                {lockedToMe && <span className="helper-text">Le certificat est signé par vous : le signataire est imposé.</span>}
            </Form.Group>

            <Form.Group className="mb-3 upload-container">
                <Form.Label>Image de signature</Form.Label>
                <InputGroup>
                    <Form.Control as="textarea" rows={2} name="phmcEmployeeSignatureImage" value={formData.phmcEmployeeSignatureImage || ''} onChange={handleChange} placeholder="Image de signature" className="form-control" />
                    <Button variant="outline-primary" onClick={applyMySignature} title="Utiliser la signature créée dans Carte de visite → Signature">
                        <i className="fas fa-signature"></i> Ma signature
                    </Button>
                </InputGroup>
                <ImagePreview imageUrls={formData.phmcEmployeeSignatureImage} />
            </Form.Group>

            {problems.length > 0 && (
                <Alert variant="warning" className="py-2 small">
                    <strong>À compléter avant d'enregistrer :</strong>
                    <ul className="mb-0">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
                </Alert>
            )}
        </>
    );
};

export default FlightCertificate;
