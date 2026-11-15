import React, { useEffect, useState } from 'react';
import { Form, Button, ButtonGroup } from 'react-bootstrap';
import { ageOn } from '../../utils/flightCertificate';
import { todayIso } from '../../utils/appointmentDate';
import { usePatientDossier } from '../../utils/dossierLookup';
import { changedBackgroundFields, backgroundAdditions, BACKGROUND_FIELD_LABELS } from '../../utils/careFormRules';
import { HISTORY_PRESETS } from '../../constants/historyPresets';
import PresetTextField from './PresetTextField';

export const PATIENT_GENDER_OPTIONS = [
    { value: 'Male', label: 'Masculin' },
    { value: 'Female', label: 'Féminin' },
    { value: 'Other', label: 'Autre / Non précisé' },
];

/**
 * Bloc « Contexte patient » commun aux formulaires cliniques : ce qu'un
 * soignant a besoin de savoir avant d'interpréter le reste du dossier.
 * Garde la même présentation et les mêmes noms de champs partout (les valeurs
 * saisies suivent donc le patient d'un formulaire à l'autre).
 *
 * La date de naissance remplace la saisie de l'âge : l'âge (à la date du rendez-vous) se calcule
 * tout seul (`patientAgeYears`), et les deux figurent dans le rapport. Quand la date de naissance
 * n'est pas connue, un bouton permet de saisir directement l'âge.
 *
 * Allergies, antécédents et traitements habituels : listes de choix (plusieurs choix possibles) + texte libre, comme dans le Dossier Médical
 * Avancé. Ils s'ajoutent à ce qui est repris du dossier du patient, et c'est ce texte que lit l'assistant Pilou pour adapter ses propositions.
 *
 * `showHistory` : false pour les formulaires qui ont déjà leurs propres champs
 * d'antécédents/allergies/traitements (évaluation physique, psychiatrie).
 */
const PatientContextFields = ({ formData, setFormData, handleChange, showHistory = true, allergiesRequired = true, title = 'Contexte patient' }) => {
    // Mode de saisie : date de naissance (l'âge se calcule) ou âge seul (date de naissance inconnue).
    const [ageOnly, setAgeOnly] = useState(() => !formData.patientDateOfBirth && String(formData.patientAgeYears || '').trim() !== '');
    // Un rapport rechargé ou un dossier repris qui apporte une date de naissance ramène à la saisie par date.
    useEffect(() => { if (formData.patientDateOfBirth) setAgeOnly(false); }, [formData.patientDateOfBirth]);

    const computedAge = ageOn(formData.patientDateOfBirth, formData.date);
    const ageText = computedAge !== null && computedAge >= 0 ? String(computedAge) : '';
    useEffect(() => {
        if (!setFormData || !formData.patientDateOfBirth) return;
        if (ageText !== String(formData.patientAgeYears || '')) setFormData((prev) => (String(prev.patientAgeYears || '') === ageText ? prev : { ...prev, patientAgeYears: ageText }));
    }, [ageText, formData.patientDateOfBirth, formData.patientAgeYears, setFormData]);

    // Bascule : vers « âge seul », la date de naissance est retirée (l'âge calculé reste, modifiable) ; vers « date de naissance », l'âge saisi à la main est retiré.
    const chooseMode = (nextAgeOnly) => {
        if (nextAgeOnly === ageOnly) return;
        setAgeOnly(nextAgeOnly);
        setFormData((prev) => (nextAgeOnly ? { ...prev, patientDateOfBirth: '' } : { ...prev, patientAgeYears: '' }));
    };

    // Allergies, antécédents et traitements corrigés par rapport au dossier : la mention « mis à jour lors de cette consultation » est ajoutée au rapport.
    const { status, donnees } = usePatientDossier(formData.patientID);
    const changedLabels = showHistory && status === 'found' ? changedBackgroundFields(donnees, formData).map((field) => BACKGROUND_FIELD_LABELS[field]) : [];
    const changedKey = changedLabels.join('|');
    // Éléments saisis qui manquent au dossier : ajoutés au dossier à l'enregistrement (le soignant peut le refuser). Tous les formulaires qui affichent ces champs posent la demande (voir BACKGROUND_UPDATE_VERSIONS).
    const additions = showHistory && status === 'found' ? backgroundAdditions(donnees, formData) : {};
    const addedLabels = Object.keys(additions).map((field) => BACKGROUND_FIELD_LABELS[field]);
    const settled = status === 'found' || status === 'missing';
    useEffect(() => {
        if (!setFormData || !showHistory || !settled) return;
        const current = Array.isArray(formData.patientBackgroundUpdated) ? formData.patientBackgroundUpdated.join('|') : '';
        if (current !== changedKey) setFormData((prev) => ({ ...prev, patientBackgroundUpdated: changedKey ? changedKey.split('|') : [] }));
    }, [changedKey, settled, showHistory, formData.patientBackgroundUpdated, setFormData]);

    return (
        <>
            <Form.Label className="form-section-title">{title}</Form.Label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Form.Label className="mb-1">{ageOnly ? 'Âge' : 'Date de naissance'}</Form.Label>
                        <ButtonGroup size="sm" className="mb-1" aria-label="Saisir la date de naissance ou l'âge" data-no-tip="1">
                            <Button type="button" variant={ageOnly ? 'outline-secondary' : 'secondary'} active={!ageOnly} onClick={() => chooseMode(false)} title="Saisir la date de naissance : l'âge se calcule tout seul">Date de naissance</Button>
                            <Button type="button" variant={ageOnly ? 'secondary' : 'outline-secondary'} active={ageOnly} onClick={() => chooseMode(true)} title="Date de naissance inconnue : saisir seulement l'âge">Âge</Button>
                        </ButtonGroup>
                    </div>
                    {ageOnly
                        ? <Form.Control type="number" inputMode="numeric" min="0" max="120" step="1" name="patientAgeYears" value={formData.patientAgeYears || ''} onChange={handleChange} placeholder="Âge en années" className="form-control" />
                        : <Form.Control type="date" name="patientDateOfBirth" value={formData.patientDateOfBirth || ''} max={todayIso()} onChange={handleChange} className="form-control" />}
                </div>
                {!ageOnly && (
                    <div style={{ flex: '0 1 140px', minWidth: 0 }}>
                        <Form.Label>Âge</Form.Label>
                        <Form.Control type="text" readOnly disabled value={ageText ? `${ageText} ans` : ''} placeholder="Calculé" className="form-control" aria-label="Âge calculé à partir de la date de naissance" />
                    </div>
                )}
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <Form.Label>Sexe</Form.Label>
                    <Form.Select name="patientSex" value={formData.patientSex || ''} onChange={handleChange} className="form-control">
                        <option value="" disabled>Sexe du patient</option>
                        {PATIENT_GENDER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                </div>
            </div>
            {showHistory && (
                <>
                    <Form.Label>Allergies connues</Form.Label>
                    <div style={{ display: 'flex', marginBottom: '0.6rem' }}>
                        <PresetTextField
                            name="patientAllergies" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientAllergies}
                            placeholder={allergiesRequired ? 'Allergies connues (écrire « Aucune connue » si aucune)' : 'Allergies connues'}
                        />
                    </div>
                    <Form.Label>Antécédents médicaux / maladies chroniques</Form.Label>
                    <div style={{ display: 'flex', marginBottom: '0.6rem' }}>
                        <PresetTextField name="patientChronicDiseases" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientChronicDiseases} placeholder="Antécédents médicaux / maladies chroniques" />
                    </div>
                    <Form.Label>Traitements habituels du patient</Form.Label>
                    <div style={{ display: 'flex', marginBottom: '0.6rem' }}>
                        <PresetTextField name="patientCurrentMedicine" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientCurrentMedicine} placeholder="Traitements habituels du patient" />
                    </div>
                    {changedLabels.length > 0 && (
                        <span className="helper-text" data-no-tip="1">Modifié(s) par rapport au dossier ({changedLabels.join(', ')}) : la mention « mis à jour lors de cette consultation » sera ajoutée au rapport.</span>
                    )}
                    {addedLabels.length > 0 && (
                        <Form.Check
                            type="checkbox" id="patientBackgroundSync" className="mt-1 small" data-no-tip="1"
                            label={`Ajouter aussi au dossier du patient (${addedLabels.join(', ')}) : seuls les éléments manquants sont ajoutés, rien n'est retiré ni corrigé.`}
                            checked={formData.patientBackgroundSync !== 'No'}
                            onChange={(event) => setFormData((prev) => ({ ...prev, patientBackgroundSync: event.target.checked ? 'Yes' : 'No' }))}
                        />
                    )}
                </>
            )}
        </>
    );
};

export default PatientContextFields;
