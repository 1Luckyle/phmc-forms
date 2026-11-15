import React, { useEffect } from 'react';
import { Form } from 'react-bootstrap';
import BirthOrAgeFields from './BirthOrAgeFields';
import { usePatientDossier } from '../../utils/dossierLookup';
import { changedBackgroundFields, backgroundAdditions, BACKGROUND_FIELD_LABELS } from '../../utils/careFormRules';
import { HISTORY_PRESETS } from '../../constants/historyPresets';
import PresetTextField from './PresetTextField';
import { frDayOf } from '../../utils/activePrescriptions';

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
    // Ordonnances en cours du patient (autres rapports, voir hooks/useActivePrescriptions.js) : comptées avec les traitements habituels jusqu'à leur date de fin, sans entrer dans le dossier.
    const activeRx = Array.isArray(formData.patientActivePrescriptions) ? formData.patientActivePrescriptions : [];
    const removedRx = Array.isArray(formData.patientActivePrescriptionsOff) ? formData.patientActivePrescriptionsOff : [];
    const removeRx = (medId) => setFormData((prev) => ({ ...prev, patientActivePrescriptionsOff: [...new Set([...(prev.patientActivePrescriptionsOff || []), medId])], patientActivePrescriptions: (prev.patientActivePrescriptions || []).filter((item) => item.medId !== medId) }));
    const restoreRx = () => setFormData((prev) => ({ ...prev, patientActivePrescriptionsOff: [] }));

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
            {/* Date de naissance ou âge (bascule), puis le sexe, sur la même ligne : voir BirthOrAgeFields. */}
            <BirthOrAgeFields formData={formData} setFormData={setFormData} handleChange={handleChange}>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                    <Form.Label>Sexe</Form.Label>
                    <Form.Select name="patientSex" value={formData.patientSex || ''} onChange={handleChange} className="form-control">
                        <option value="" disabled>Sexe du patient</option>
                        {PATIENT_GENDER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                </div>
            </BirthOrAgeFields>
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
                    {(activeRx.length > 0 || removedRx.length > 0) && (
                        <div style={{ margin: '-0.2rem 0 0.6rem' }} data-no-tip="1">
                            {activeRx.length > 0 && (
                                <>
                                    <div className="helper-text">Ordonnances en cours : comptées avec les traitements habituels (rapport et contrôles de l'assistant) jusqu'à leur date de fin. Elles n'entrent pas dans le dossier du patient.</div>
                                    <div className="d-flex flex-wrap gap-2 mt-1">
                                        {activeRx.map((item) => (
                                            <span key={item.medId} className="badge" style={{ background: 'rgba(210, 153, 34, 0.18)', border: '1px solid #d29922', color: '#e3b341', fontWeight: 500, whiteSpace: 'normal', textAlign: 'left' }} title={item.report ? `Ordonnance du rapport : ${item.report}` : undefined}>
                                                <i className="fas fa-file-prescription me-1"></i>{item.name}{item.posology ? ` · ${item.posology}` : ''} · jusqu'au {frDayOf(item.end)}
                                                <button type="button" className="btn btn-sm p-0 ms-2" style={{ color: 'inherit', lineHeight: 1 }} onClick={() => removeRx(item.medId)} aria-label={`Retirer ${item.name} (le patient ne le prend plus)`} title="Le patient ne prend plus ce médicament : le retirer de la liste">×</button>
                                            </span>
                                        ))}
                                    </div>
                                </>
                            )}
                            {removedRx.length > 0 && <button type="button" className="btn btn-link btn-sm p-0 mt-1" onClick={restoreRx}>Rétablir les ordonnances retirées ({removedRx.length})</button>}
                        </div>
                    )}
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
