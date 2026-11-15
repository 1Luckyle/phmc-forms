// src/phmc-field-data/shared/BirthOrAgeFields.js
//
// Date de naissance OU âge, sur une même ligne : la bascule (« Date de naissance » / « Âge ») tient lieu d'étiquette. Avec la date de naissance, l'âge se calcule tout seul (à `refDate`) et se range
// dans `ageName` ; quand la date est inconnue, on saisit directement l'âge. `children` : colonnes ajoutées sur la même ligne (ex. le sexe), alignées sur le bas des champs.
// Partagé par le « Contexte patient » des formulaires de soins, le certificat de décès et le certificat de vol (pas par les dossiers civils ni les candidatures).
import React, { useEffect, useState } from 'react';
import { Form, Button, ButtonGroup } from 'react-bootstrap';
import { ageOn } from '../../utils/flightCertificate';
import { todayIso } from '../../utils/appointmentDate';

const BirthOrAgeFields = ({
    formData, setFormData, handleChange, dobName = 'patientDateOfBirth', ageName = 'patientAgeYears', refDate, agePlaceholder = 'Âge en années',
    computedAgeLabel = 'Âge calculé à partir de la date de naissance', marginBottom = '0.6rem', children,
}) => {
    // Mode de saisie : date de naissance (l'âge se calcule) ou âge seul (date de naissance inconnue).
    const dob = formData[dobName];
    const age = formData[ageName];
    const [ageOnly, setAgeOnly] = useState(() => !dob && String(age || '').trim() !== '');
    // Un rapport rechargé ou un dossier repris qui apporte une date de naissance ramène à la saisie par date.
    useEffect(() => { if (dob) setAgeOnly(false); }, [dob]);

    const computedAge = ageOn(dob, refDate !== undefined ? refDate : formData.date);
    const ageText = computedAge !== null && computedAge >= 0 ? String(computedAge) : '';
    useEffect(() => {
        if (!setFormData || !dob) return;
        if (ageText !== String(age || '')) setFormData((prev) => (String(prev[ageName] || '') === ageText ? prev : { ...prev, [ageName]: ageText }));
    }, [ageText, dob, age, ageName, setFormData]);

    // Bascule : vers « âge seul », la date de naissance est retirée (l'âge calculé reste, modifiable) ; vers « date de naissance », l'âge saisi à la main est retiré.
    const chooseMode = (nextAgeOnly) => {
        if (nextAgeOnly === ageOnly) return;
        setAgeOnly(nextAgeOnly);
        setFormData((prev) => (nextAgeOnly ? { ...prev, [dobName]: '' } : { ...prev, [ageName]: '' }));
    };

    return (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom }}>
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <ButtonGroup size="sm" aria-label="Saisir la date de naissance ou l'âge" data-no-tip="1">
                        <Button type="button" variant={ageOnly ? 'outline-secondary' : 'secondary'} active={!ageOnly} onClick={() => chooseMode(false)} title="Saisir la date de naissance : l'âge se calcule tout seul">Date de naissance</Button>
                        <Button type="button" variant={ageOnly ? 'secondary' : 'outline-secondary'} active={ageOnly} onClick={() => chooseMode(true)} title="Date de naissance inconnue : saisir seulement l'âge">Âge</Button>
                    </ButtonGroup>
                </div>
                {ageOnly
                    ? <Form.Control type="number" inputMode="numeric" min="0" max="120" step="1" name={ageName} value={age || ''} onChange={handleChange} placeholder={agePlaceholder} className="form-control" />
                    : <Form.Control type="date" name={dobName} value={dob || ''} max={todayIso()} onChange={handleChange} className="form-control" />}
            </div>
            {!ageOnly && (
                <div style={{ flex: '0 1 140px', minWidth: 0 }}>
                    <Form.Label>Âge</Form.Label>
                    <Form.Control type="text" readOnly disabled value={ageText ? `${ageText} ans` : ''} placeholder="Calculé" className="form-control" aria-label={computedAgeLabel} />
                </div>
            )}
            {children}
        </div>
    );
};

export default BirthOrAgeFields;
