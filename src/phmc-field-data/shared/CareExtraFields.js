// src/phmc-field-data/shared/CareExtraFields.js
//
// Champs ajoutés aux formulaires du personnel soignant (listes de choix : constants/careFormOptions.js ; règles : utils/careFormRules.js ; BBCode : phmc-bbcode-generators/shared/careExtras.js).
// Chaque bloc est un composant à poser dans le formulaire concerné.
import React, { useEffect, useMemo } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { SimpleSelect } from './PatientGeneralInfo';
import EmergencyContactFields from './EmergencyContactFields';
import { careStaffOnly } from './PhmcEmployeeSelect';
import { darkSelectStyles } from './selectStyles';
import { usePatientDossier } from '../../utils/dossierLookup';
import { emergencyContactChanges, aptitudeValidUntil, minutesBetween, durationLabel } from '../../utils/careFormRules';
import {
    REFERRAL_REASONS, SURGERY_CHARACTERS, ASA_CLASSES, POST_OP_MONITORING, EVAL_REASONS, APTITUDE_CONCLUSIONS, APTITUDE_VALIDITY_MONTHS, DEFAULT_APTITUDE_MONTHS, VACCINATION_STATES,
    RISK_LEVELS, RISK_ACTIONS, INVOLUNTARY_HOLDS, ARRIVAL_MODES, DISCHARGE_DESTINATIONS, ROUTINE_CARE, ORIENTED_SERVICES, EXAMS_ORDERED, RISK_NEEDING_ACTION,
    DEATH_MANNERS, DEATH_RESUSCITATION, DEATH_FAMILY, DEATH_BODY,
} from '../../constants/careFormOptions';
import { buildDeathSuggestion } from '../../clinical/death';
import { applyPatch } from '../../clinical/apply';
import { currentTime } from '../../clinical/context';
import { ASSISTANT_LABEL } from '../../clinical/assistantName';

const row = { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '0.6rem' };
const cell = (basis = 200) => ({ flex: `1 1 ${basis}px`, minWidth: 0 });
const frDate = (iso) => String(iso || '').split('-').reverse().join('/');

const Field = ({ label, basis, children, hint }) => (
    <div style={cell(basis)}>
        {label && <Form.Label>{label}</Form.Label>}
        {children}
        {hint && <span className="helper-text">{hint}</span>}
    </div>
);

const Choice = ({ name, formData, handleChange, options, placeholder }) => (
    <SimpleSelect name={name} value={formData[name]} onChange={handleChange} options={options} placeholder={placeholder} />
);

// Choix multiple stocké en tableau de valeurs.
const MultiChoice = ({ name, formData, setFormData, options, placeholder }) => {
    const values = Array.isArray(formData[name]) ? formData[name] : [];
    return (
        <Select
            isMulti name={name} options={options} styles={darkSelectStyles} placeholder={placeholder} className="form-control"
            value={values.map((value) => options.find((option) => option.value === value) || { value, label: value })}
            onChange={(selected) => setFormData((prev) => ({ ...prev, [name]: (selected || []).map((option) => option.value) }))}
        />
    );
};

// ── Commun : heure du rendez-vous, adressage, médecin adressant, accompagnant ──
export const ReferralFields = ({ formData, setFormData, handleChange, unrestrictedPhmcGroupedOptions }) => {
    const careOptions = useMemo(() => careStaffOnly(unrestrictedPhmcGroupedOptions).map((group) => ({ label: group.label, options: group.options.map((option) => ({ value: option.value, label: option.label })) })), [unrestrictedPhmcGroupedOptions]);
    const doctor = formData.referringDoctor ? { value: formData.referringDoctor, label: formData.referringDoctor } : null;
    return (
        <>
            <div style={row}>
                <Field label="Motif d'adressage" basis={260}><Choice name="referralReason" formData={formData} handleChange={handleChange} options={REFERRAL_REASONS} placeholder="Comment le patient arrive-t-il ?" /></Field>
                {formData.referralReason === 'Other' && (
                    <Field label="Précisez" basis={200}><Form.Control type="text" name="referralOther" value={formData.referralOther || ''} onChange={handleChange} placeholder="Motif d'adressage" className="form-control" /></Field>
                )}
                <Field label="Médecin adressant (facultatif)" basis={260}>
                    <CreatableSelect
                        isClearable options={careOptions} value={doctor} styles={darkSelectStyles} className="form-control"
                        placeholder="Soignant du PHMC, ou saisir un nom extérieur"
                        formatCreateLabel={(input) => `Utiliser « ${input} »`} noOptionsMessage={() => 'Saisissez un nom'}
                        onChange={(option) => setFormData((prev) => ({ ...prev, referringDoctor: option ? option.value : '' }))}
                    />
                </Field>
            </div>
            <div style={row}>
                <Field label="Accompagnant (facultatif)" basis={260}><Form.Control type="text" name="companionName" value={formData.companionName || ''} onChange={handleChange} placeholder="Nom de la personne qui accompagne le patient" className="form-control" /></Field>
                <Field label="Lien avec le patient" basis={200}><Form.Control type="text" name="companionRelation" value={formData.companionRelation || ''} onChange={handleChange} placeholder="ex. Épouse, ami, policier" className="form-control" /></Field>
            </div>
        </>
    );
};

// ── Opération chirurgicale ──
export const SurgeryCharacterFields = ({ formData, handleChange }) => (
    <div style={row}>
        <Field label="Caractère de l'intervention" basis={220}><Choice name="surgeryCharacter" formData={formData} handleChange={handleChange} options={SURGERY_CHARACTERS} placeholder="Programmée, urgente ou différée" /></Field>
        <Field label="Classification ASA (risque anesthésique)" basis={260}><Choice name="surgeryAsa" formData={formData} handleChange={handleChange} options={ASA_CLASSES} placeholder="ASA 1 à 5" /></Field>
    </div>
);
export const PostOpFields = ({ formData, handleChange }) => (
    <>
        <Form.Label className="form-section-title">Surveillance post-opératoire</Form.Label>
        <div style={row}>
            <Field label="Lieu de surveillance" basis={260}><Choice name="postOpMonitoring" formData={formData} handleChange={handleChange} options={POST_OP_MONITORING} placeholder="Réveil, soins intensifs, chambre…" /></Field>
        </div>
        <Form.Control as="textarea" rows={2} name="postOpExams" value={formData.postOpExams || ''} onChange={handleChange} placeholder="Examens post-opératoires demandés ou réalisés (imagerie de contrôle, bilan sanguin…)" className="form-control" />
    </>
);

// ── Évaluation physique : conclusion d'aptitude ──
export const AptitudeFields = ({ formData, setFormData, handleChange }) => {
    const until = aptitudeValidUntil(formData);
    const inapt = formData.aptitudeConclusion === 'Inapte';
    // Durée de validité par défaut dès qu'une conclusion « apte » est choisie.
    useEffect(() => {
        if (formData.aptitudeConclusion && !inapt && !formData.aptitudeValidityMonths) setFormData((prev) => ({ ...prev, aptitudeValidityMonths: String(DEFAULT_APTITUDE_MONTHS) }));
    }, [formData.aptitudeConclusion, inapt, formData.aptitudeValidityMonths, setFormData]);
    return (
        <>
            <Form.Label className="form-section-title">Conclusion d'aptitude</Form.Label>
            <div style={row}>
                <Field label="Motif de l'évaluation" basis={220}><Choice name="evalReason" formData={formData} handleChange={handleChange} options={EVAL_REASONS} placeholder="Embauche, renouvellement ou reprise" /></Field>
                <Field label="Conclusion" basis={220}><Choice name="aptitudeConclusion" formData={formData} handleChange={handleChange} options={APTITUDE_CONCLUSIONS} placeholder="Apte, apte avec restrictions, inapte" /></Field>
                {formData.aptitudeConclusion && !inapt && (
                    <Field label="Durée de validité" basis={160} hint={until ? `Valable jusqu'au ${frDate(until)}.` : 'Renseignez la date de l\'évaluation.'}>
                        <Choice name="aptitudeValidityMonths" formData={formData} handleChange={handleChange} options={APTITUDE_VALIDITY_MONTHS.map((months) => ({ value: String(months), label: `${months} mois` }))} placeholder="Durée" />
                    </Field>
                )}
            </div>
            {formData.aptitudeConclusion === 'Apte avec restrictions' && (
                <Form.Control as="textarea" rows={2} name="aptitudeRestrictions" value={formData.aptitudeRestrictions || ''} onChange={handleChange} placeholder="Restrictions (ex. pas de travail en hauteur, port de verres correcteurs)" className="form-control" />
            )}
            <div style={{ ...row, marginTop: '0.6rem' }}>
                <Field label="Acuité visuelle (facultatif)" basis={200}><Form.Control type="text" name="visualAcuity" value={formData.visualAcuity || ''} onChange={handleChange} placeholder="ex. 10/10 corrigée" className="form-control" /></Field>
                <Field label="Audition (facultatif)" basis={200}><Form.Control type="text" name="hearingValue" value={formData.hearingValue || ''} onChange={handleChange} placeholder="ex. Normale, déficit léger à droite" className="form-control" /></Field>
                <Field label="Vaccinations" basis={200}><Choice name="vaccinationState" formData={formData} handleChange={handleChange} options={VACCINATION_STATES} placeholder="À jour ?" /></Field>
            </div>
            {formData.vaccinationState === 'No' && (
                <Form.Control type="text" name="vaccinationNote" value={formData.vaccinationNote || ''} onChange={handleChange} placeholder="Vaccinations manquantes" className="form-control" />
            )}
        </>
    );
};

// ── Santé mentale : risque, conduite à tenir, hospitalisation sous contrainte ──
export const RiskFields = ({ formData, handleChange }) => {
    const needsAction = RISK_NEEDING_ACTION.includes(formData.riskSuicide) || RISK_NEEDING_ACTION.includes(formData.riskDanger);
    return (
        <>
            <Form.Label className="form-section-title">Évaluation du risque et conduite à tenir</Form.Label>
            <div style={row}>
                <Field label="Risque suicidaire" basis={200}><Choice name="riskSuicide" formData={formData} handleChange={handleChange} options={RISK_LEVELS} placeholder="Niveau de risque" /></Field>
                <Field label="Dangerosité (pour autrui)" basis={200}><Choice name="riskDanger" formData={formData} handleChange={handleChange} options={RISK_LEVELS} placeholder="Niveau de risque" /></Field>
            </div>
            <div style={row}>
                <Field label={`Conduite à tenir${needsAction ? ' *' : ''}`} basis={260}><Choice name="riskAction" formData={formData} handleChange={handleChange} options={RISK_ACTIONS} placeholder="Conduite à tenir" /></Field>
                <Field label="Hospitalisation sous contrainte" basis={260}><Choice name="involuntaryHold" formData={formData} handleChange={handleChange} options={INVOLUNTARY_HOLDS} placeholder="Non, ou fondement de la contrainte" /></Field>
            </div>
            <Form.Control type="text" name="riskActionNote" value={formData.riskActionNote || ''} onChange={handleChange} placeholder="Précisions sur la conduite à tenir (facultatif)" className="form-control" />
        </>
    );
};

// Contact d'urgence : repris du dossier du patient ; modifié ici, il met à jour le dossier à l'enregistrement (voir utils/emergencyContactUpdates.js).
export const EmergencyContactSection = ({ formData, setFormData, handleChange }) => {
    const { status, donnees } = usePatientDossier(formData.patientID);
    const changes = status === 'found' ? emergencyContactChanges(donnees, formData) : {};
    return (
        <>
            <Form.Label className="form-section-title">Contact d'urgence</Form.Label>
            <EmergencyContactFields formData={formData} setFormData={setFormData} handleChange={handleChange} />
            {status === 'found' && (
                <div className="helper-text" data-no-tip="1" style={{ marginTop: '0.4rem' }}>
                    {Object.keys(changes).length > 0
                        ? <><i className="fas fa-rotate me-1"></i>Le contact d'urgence a été modifié : le <strong>dossier du patient sera mis à jour</strong> à l'enregistrement.</>
                        : "Contact d'urgence repris du dossier du patient : si vous le modifiez ici, le dossier sera mis à jour à l'enregistrement."}
                </div>
            )}
            {status === 'missing' && <div className="helper-text" data-no-tip="1" style={{ marginTop: '0.4rem' }}>Pas de dossier pour ce patient : le contact d'urgence figure seulement dans ce rapport.</div>}
        </>
    );
};

// ── Protocole d'urgence ──
export const ARRIVAL_MODE_CHOICES = ARRIVAL_MODES;
export const EmergencyTimingFields = ({ formData, handleChange }) => {
    const minutes = minutesBetween(formData.careStartTime, formData.careEndTime);
    return (
        <>
            <Form.Label className="form-section-title">Temps de prise en charge</Form.Label>
            <div style={row}>
                <Field label="Heure de prise en charge" basis={180}><Form.Control type="time" name="careStartTime" value={formData.careStartTime || ''} onChange={handleChange} className="form-control" /></Field>
                <Field label="Heure de fin d'intervention" basis={180} hint="Quand le soignant a terminé avec le patient (avant son départ en salle de réveil, box, hospitalisation ou à domicile).">
                    <Form.Control type="time" name="careEndTime" value={formData.careEndTime || ''} onChange={handleChange} className="form-control" />
                </Field>
                {minutes !== null && <Field label="Durée" basis={120}><Form.Control type="text" readOnly disabled value={durationLabel(minutes)} className="form-control" /></Field>}
            </div>
        </>
    );
};
export const EmergencyDischargeFields = ({ formData, setFormData, handleChange }) => (
    <>
        <Form.Label className="form-section-title">Sortie et soins systématiques</Form.Label>
        <div style={row}>
            {formData.careDeceased !== 'Yes' && <Field label="Orientation de sortie" basis={260}><Choice name="dischargeDestination" formData={formData} handleChange={handleChange} options={DISCHARGE_DESTINATIONS} placeholder="Où va le patient ?" /></Field>}
            {formData.dischargeDestination === 'Transfer' && (
                <Field label="Établissement de transfert" basis={240}><Form.Control type="text" name="transferTo" value={formData.transferTo || ''} onChange={handleChange} placeholder="Établissement" className="form-control" /></Field>
            )}
        </div>
        <Form.Label>Soins systématiques réalisés</Form.Label>
        <MultiChoice name="routineCare" formData={formData} setFormData={setFormData} options={ROUTINE_CARE} placeholder="Antitétanique, antalgie, pansement… (choix multiple)" />
    </>
);

// ── Consultation générale ──
export const ConsultExtraFields = ({ formData, setFormData, handleChange, onPrefillSickLeave }) => (
    <>
        <Form.Label className="form-section-title">Orientation, examens et arrêt de travail</Form.Label>
        <div style={row}>
            <Field label="Service orienté après consultation" basis={260}><Choice name="orientedService" formData={formData} handleChange={handleChange} options={ORIENTED_SERVICES} placeholder="Service d'orientation" /></Field>
            {formData.orientedService === 'Other' && <Field label="Précisez" basis={200}><Form.Control type="text" name="orientedServiceOther" value={formData.orientedServiceOther || ''} onChange={handleChange} placeholder="Service" className="form-control" /></Field>}
        </div>
        <Form.Label>Examens complémentaires prescrits (à réaliser)</Form.Label>
        <MultiChoice name="examsOrdered" formData={formData} setFormData={setFormData} options={EXAMS_ORDERED} placeholder="Radiographie, bilan sanguin… (choix multiple)" />
        <Form.Control type="text" name="examsOrderedNote" value={formData.examsOrderedNote || ''} onChange={handleChange} placeholder="Précisions sur les examens (facultatif)" className="form-control mt-2" />
        <div style={{ ...row, marginTop: '0.6rem', alignItems: 'flex-end' }}>
            <Field label="Arrêt de travail délivré ?" basis={200}>
                <SimpleSelect name="workStoppage" value={formData.workStoppage} onChange={handleChange} options={[{ value: 'No', label: 'Non' }, { value: 'Yes', label: 'Oui' }]} placeholder="Oui ou non" />
            </Field>
            {formData.workStoppage === 'Yes' && (
                <>
                    <Field label="Durée (jours)" basis={140}><Form.Control type="number" min="1" max="365" name="workStoppageDays" value={formData.workStoppageDays || ''} onChange={handleChange} className="form-control" /></Field>
                    {onPrefillSickLeave && (
                        <div style={{ flex: '0 0 auto' }}>
                            <Button variant="outline-primary" onClick={onPrefillSickLeave} title="Ouvre le Certificat de Maladie avec le patient, la date et la durée de l'arrêt déjà remplis">
                                <i className="fas fa-file-medical me-1"></i>Préremplir le Certificat de Maladie
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    </>
);

// ── Décès du patient (protocole d'urgence, opération) ──
// L'interrupteur « patient décédé » est posé dans l'assistant Pilou (DeathSwitch) : Pilou en tient compte dans sa rédaction du rapport (ni orientation, ni ordonnance, ni suites) et peut préremplir le décès. Les champs du décès
// (heure, cause, circonstances, réanimation, famille, destination du corps) n'apparaissent dans le formulaire (DeathFields) que lorsque le patient est décédé. Aux urgences, l'orientation de sortie passe d'office à « Décès ».
export const setDeceased = (setFormData, kind, checked) => setFormData((prev) => {
    const next = { ...prev, careDeceased: checked ? 'Yes' : '' };
    if (kind === 'emergency') {
        if (checked) next.dischargeDestination = 'Death';
        else if (prev.dischargeDestination === 'Death') next.dischargeDestination = '';
    }
    return next;
});

export const DeathSwitch = ({ formData, setFormData, kind = 'emergency' }) => {
    const deceased = formData.careDeceased === 'Yes';
    return (
        <div style={{ margin: '0.4rem 0 0.8rem' }} data-no-tip="1">
            <Form.Check
                type="switch" id="careDeceased" checked={deceased} onChange={(e) => setDeceased(setFormData, kind, e.target.checked)}
                label={kind === 'surgery' ? "Le patient est décédé pendant l'intervention" : 'Le patient est décédé pendant la prise en charge'}
            />
            {deceased && <span className="helper-text">{ASSISTANT_LABEL} en tient compte : plus d'orientation, d'ordonnance ni de suites dans le rapport, et il prépare le décès (section « Décès du patient » plus bas).</span>}
        </div>
    );
};

export const DeathFields = ({ formData, setFormData, handleChange, kind = 'emergency' }) => {
    const deceased = formData.careDeceased === 'Yes';
    const suggest = () => setFormData((prev) => applyPatch(prev, buildDeathSuggestion({ kind, formData: prev, now: currentTime() })));
    if (!deceased) return null;
    return (
        <>
            <Form.Label className="form-section-title">Décès du patient</Form.Label>
                <div style={{ border: '1px solid #b62324', borderRadius: 8, padding: '0.7rem 0.8rem', marginTop: 8, background: '#1a0f12' }} data-no-tip="1">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                        <span className="small text-muted">Renseignez le décès : il figure en évidence dans le rapport et dans l'historique des soins du dossier.</span>
                        <Button size="sm" variant="outline-primary" onClick={suggest} title="Complète les champs vides d'après les motifs ou les interventions choisis (tout reste modifiable)">
                            <i className="fas fa-wand-magic-sparkles me-1"></i>Préremplir avec {ASSISTANT_LABEL}
                        </Button>
                    </div>
                    <div style={row}>
                        <Field label="Heure du décès" basis={140}><Form.Control type="time" name="careDeathTime" value={formData.careDeathTime || ''} onChange={handleChange} className="form-control" /></Field>
                        <Field label="Circonstances" basis={260}><Choice name="careDeathManner" formData={formData} handleChange={handleChange} options={DEATH_MANNERS} placeholder="Nature du décès" /></Field>
                        <Field label="Destination du corps" basis={240}><Choice name="careDeathBody" formData={formData} handleChange={handleChange} options={DEATH_BODY} placeholder="Où est conduit le corps ?" /></Field>
                    </div>
                    <Form.Label>Cause et circonstances du décès</Form.Label>
                    <Form.Control as="textarea" rows={2} name="careDeathCause" value={formData.careDeathCause || ''} onChange={handleChange} placeholder="Cause du décès et ce qui l'a précédé" className="form-control" />
                    <div style={{ ...row, marginTop: '0.6rem' }}>
                        <Field label="Réanimation" basis={300}><Choice name="careDeathResuscitation" formData={formData} handleChange={handleChange} options={DEATH_RESUSCITATION} placeholder="Réanimation tentée ?" /></Field>
                        <Field label="Famille" basis={240}><Choice name="careDeathFamily" formData={formData} handleChange={handleChange} options={DEATH_FAMILY} placeholder="Proche prévenu ?" /></Field>
                    </div>
                    <Form.Control as="textarea" rows={2} name="careDeathResuscitationNote" value={formData.careDeathResuscitationNote || ''} onChange={handleChange} placeholder="Déroulé de la réanimation : manœuvres, médicaments, durée (facultatif)" className="form-control" />
                </div>
        </>
    );
};
