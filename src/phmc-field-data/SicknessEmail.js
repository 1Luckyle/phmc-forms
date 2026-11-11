import React, { useState } from 'react';
import { Form, InputGroup, Button, Alert } from 'react-bootstrap';
import { prepareAttachedReport, ACCEPTED_REPORT_VERSIONS, ACCEPTED_REPORT_LABELS } from '../utils/employerSummary';
import { PatientIdentityFields, AppointmentDateField, CareEmployeeField } from './shared/CareFormHeader';
import {
    CERTIFICATE_TYPE_LIST, EXIT_OPTIONS, FITNESS_OPTIONS, certificateType, needsField, inclusiveDays, ittLabel,
} from '../utils/medicalCertificates';

const SicknessEmail = ({
    formData,
    handleChange,
    setFormData,
    phmcGroupedOptions,
    onAttachReportSummaryRequest,
    showNotification
}) => {
    // Le consentement du patient doit être confirmé avant de joindre un rapport.
    const [consentConfirmed, setConsentConfirmed] = useState(false);
    const notify = showNotification || (() => {});
    const type = certificateType(formData.emailPurpose);
    const has = (field) => needsField(formData.emailPurpose, field);
    const days = inclusiveDays(formData.sicknessStartDate, formData.sicknessEndDate);
    const dateField = (name, label, extra = {}) => (
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <Form.Label>{label}</Form.Label>
            <Form.Control type="date" name={name} value={formData[name] || ''} onChange={handleChange} className="form-control" {...extra} />
        </div>
    );
    const row = { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '0.6rem' };

    // Vérifie qu'un contenu est bien un rapport ACCEPTÉ (d'après ses titres), du bon patient, puis
    // le remplace par son résumé simplifié. Retourne true si le rapport a été joint.
    const acceptReport = (bbCode) => {
        const result = prepareAttachedReport(bbCode, { patientName: formData.patientName });
        if (!result.ok) {
            notify(result.reason, 'warning', 8000);
            return false;
        }
        setFormData((prev) => ({ ...prev, attachedReportSummary: result.summary }));
        notify(`Rapport reconnu (${result.kindLabel}) : joint sous forme de résumé simplifié, sans les détails médicaux.`, 'check-circle', 7000);
        return true;
    };

    // Le résumé ne se tape pas : on peut seulement le coller (vérifié) ou le vider.
    const handleAttachedSummaryPaste = (event) => {
        event.preventDefault();
        if (!consentConfirmed) {
            notify("Confirmez d'abord le consentement du patient avant de joindre un rapport.", 'warning');
            return;
        }
        acceptReport(event.clipboardData.getData('text'));
    };
    const handleAttachedSummaryChange = (event) => {
        if (!event.target.value.trim()) {
            setFormData((prev) => ({ ...prev, attachedReportSummary: '' }));
        }
        // Toute autre modification manuelle est ignorée (la valeur reste celle du résumé vérifié).
    };

    return (
        <>
            <Form.Label className="form-section-title">Type de courrier</Form.Label>
            <Form.Group className="mb-3">
                <Form.Label>Objet du courrier</Form.Label>
                <Form.Select name="emailPurpose" value={formData.emailPurpose || ''} onChange={handleChange} className="form-control">
                    <option value="" disabled>Sélectionner le type de courrier</option>
                    {CERTIFICATE_TYPE_LIST.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Form.Select>
                {type && <span className="helper-text">{type.hint}</span>}
            </Form.Group>

            <Form.Label className="form-section-title">Destinataire et patient</Form.Label>
            <Form.Group className="mb-3">
                <Form.Label>Nom du destinataire</Form.Label>
                <Form.Control type="text" name="emailRecipient" value={formData.emailRecipient || ''} onChange={handleChange} placeholder="ex: Employeur, École, Assurance, Individu" className="form-control" />
            </Form.Group>
            <PatientIdentityFields formData={formData} setFormData={setFormData} handleChange={handleChange} />
            <span className="helper-text">L'ID patient classe le certificat dans le bon dossier. Laissez-le vide si inconnu, mais vérifiez qu'il correspond bien à ce patient.</span>

            <Form.Label className="form-section-title">Consultation et période</Form.Label>
            <AppointmentDateField formData={formData} handleChange={handleChange} name="dateOfVisit" label="Date de consultation du patient au PHMC" />

            {has('attendanceTimes') && (
                <div style={row}>
                    {dateField('attendanceFrom', 'Arrivée (heure)', { type: 'time' })}
                    {dateField('attendanceTo', 'Départ (heure)', { type: 'time' })}
                </div>
            )}
            {has('previousEnd') && <div style={row}>{dateField('previousEndDate', "Fin de l'arrêt précédent")}</div>}
            {has('period') && (
                <>
                    <div style={row}>
                        {dateField('sicknessStartDate', has('previousEnd') ? 'Début de la prolongation' : 'Date de début')}
                        {dateField('sicknessEndDate', has('previousEnd') ? 'Fin de la prolongation' : 'Date de fin', { min: formData.sicknessStartDate || undefined })}
                    </div>
                    {has('itt') && (
                        <div className="helper-text" data-no-tip="1" style={{ marginBottom: '0.6rem' }}>
                            ITT calculée : <strong>{days ? ittLabel(days) : 'renseignez les deux dates'}</strong> (jour de début et de fin compris).
                        </div>
                    )}
                </>
            )}
            {has('exit') && (
                <Form.Group className="mb-3">
                    <Form.Label>Sorties</Form.Label>
                    <Form.Select name="certificateExit" value={formData.certificateExit || ''} onChange={handleChange} className="form-control">
                        <option value="" disabled>Sorties autorisées ?</option>
                        {EXIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </Form.Select>
                </Form.Group>
            )}
            {has('returnDate') && <div style={row}>{dateField('returnDate', 'Reprise du travail le')}</div>}
            {has('activity') && (
                <Form.Group className="mb-3">
                    <Form.Label>Activité concernée</Form.Label>
                    <Form.Control type="text" name="fitnessActivity" value={formData.fitnessActivity || ''} onChange={handleChange} placeholder="ex: Sport en salle, formation de secourisme, stage" className="form-control" />
                </Form.Group>
            )}
            {has('fitness') && (
                <Form.Group className="mb-3">
                    <Form.Label>Conclusion</Form.Label>
                    <Form.Select name="fitnessConclusion" value={formData.fitnessConclusion || ''} onChange={handleChange} className="form-control">
                        <option value="" disabled>Choisir la conclusion…</option>
                        {FITNESS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </Form.Select>
                </Form.Group>
            )}
            {(has('restrictions') || formData.certificateExit === 'Sorties autorisées avec restrictions' || formData.fitnessConclusion === 'Apte avec restrictions') && (
                <Form.Group className="mb-3">
                    <Form.Label>{has('restrictions') ? 'Aménagements recommandés (facultatif)' : 'Restrictions'}</Form.Label>
                    <Form.Control as="textarea" rows={2} name="certificateRestrictions" value={formData.certificateRestrictions || ''} onChange={handleChange} placeholder="ex: Sorties de 10 h à 12 h seulement ; pas de port de charges lourdes" className="form-control" />
                </Form.Group>
            )}
            {has('reason') && (
                <Form.Group className="mb-3">
                    <Form.Label>Raison (brève, sans détail médical)</Form.Label>
                    <Form.Control as="textarea" rows={2} name="reasonForSickness" value={formData.reasonForSickness || ''} onChange={handleChange} placeholder="ex: Grippe, blessure mineure, fatigue" className="form-control" />
                </Form.Group>
            )}
            {has('condition') && (
                <>
                    <Form.Group className="mb-3">
                        <Form.Label>Maladie/Condition diagnostiquée</Form.Label>
                        <Form.Control type="text" name="illnessCondition" value={formData.illnessCondition || ''} onChange={handleChange} placeholder="ex: Angine streptococcique, Bras fracturé, Trouble anxieux" className="form-control" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Objet de la confirmation</Form.Label>
                        <Form.Control type="text" name="confirmationPurpose" value={formData.confirmationPurpose || ''} onChange={handleChange} placeholder="ex: Pour dossiers d'emploi, présence scolaire, réclamation d'assurance" className="form-control" />
                    </Form.Group>
                </>
            )}

            <Form.Label className="form-section-title">Rapport médical joint</Form.Label>
            {/* Rapport joint : seuls certains rapports sont acceptés, et ils sont toujours SIMPLIFIÉS
                (le certificat est destiné à un tiers : employeur, école, assurance…). */}
            <Form.Group className="mb-3">
                <Form.Label>Rapport médical joint (résumé simplifié)</Form.Label>
                <Alert variant="info" className="py-2 small">
                    <strong>Rapports acceptés :</strong> {ACCEPTED_REPORT_LABELS.join(' · ')}. Tout autre rapport ou texte est refusé.
                    <br />
                    <strong>Le rapport est simplifié :</strong> ce certificat est destiné à un tiers (employeur, école…) à qui l'on ne doit pas
                    transmettre d'informations médicales détaillées. Le rapport n'est donc <u>pas</u> joint en entier : seuls sont conservés le
                    type de prise en charge, l'établissement, la date et — pour les urgences et les consultations générales — l'hospitalisation
                    et le suivi. Le diagnostic, les traitements, les résultats d'examens, les antécédents et tout détail psychiatrique ou
                    psychologique sont retirés. Le document l'indique au destinataire.
                </Alert>
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        rows={6}
                        name="attachedReportSummary"
                        value={formData.attachedReportSummary || ''}
                        onChange={handleAttachedSummaryChange}
                        onPaste={handleAttachedSummaryPaste}
                        placeholder={
                            consentConfirmed
                                ? "Collez ici le BBCode d'un rapport accepté (ou utilisez « Joindre un rapport ») : il sera vérifié puis remplacé par son résumé simplifié."
                                : "Cliquez sur « Confirmer le consentement » pour activer la pièce jointe de rapports. VOUS DEVEZ OBTENIR LE CONSENTEMENT DU PATIENT AVANT DE JOINDRE UN RAPPORT !"
                        }
                    />
                    {!consentConfirmed ? (
                        <Button variant="warning" onClick={() => setConsentConfirmed(true)}>
                            <i className="fas fa-check-circle"></i> Confirmer le consentement
                        </Button>
                    ) : (
                        <Button
                            variant="info"
                            onClick={() => onAttachReportSummaryRequest((reportData) => {
                                // Exécuté quand un rapport est choisi dans « Rapports enregistrés ».
                                // Retourner false = rapport refusé (rien n'est joint).
                                if (!ACCEPTED_REPORT_VERSIONS.includes(Number(reportData.bbCodeVersion))) {
                                    notify(`Ce rapport n'est pas accepté pour un certificat. Rapports acceptés : ${ACCEPTED_REPORT_LABELS.join(', ')}.`, 'warning', 8000);
                                    return false;
                                }
                                return acceptReport(reportData.bbCode);
                            })}
                        >
                            <i className="fas fa-paperclip"></i> Joindre un rapport
                        </Button>
                    )}
                </InputGroup>
                {formData.attachedReportSummary ? (
                    <div className="small text-success mt-1">
                        <i className="fas fa-check-circle"></i> Résumé simplifié joint (informations générales uniquement).{' '}
                        <Button variant="link" size="sm" className="p-0 align-baseline"
                            onClick={() => setFormData((prev) => ({ ...prev, attachedReportSummary: '' }))}>
                            Retirer le rapport joint
                        </Button>
                    </div>
                ) : null}
                <span className="helper-text">
                    D'abord, confirmez que vous avez le consentement du patient. Ensuite, collez un rapport accepté ou cliquez sur « Joindre un rapport » :
                    seul un résumé simplifié est conservé et imprimé dans le certificat. Il n'est pas possible de modifier ce résumé à la main.
                </span>
            </Form.Group>

            <Form.Label className="form-section-title">Expéditeur</Form.Label>
            <CareEmployeeField formData={formData} setFormData={setFormData} options={phmcGroupedOptions} label="Employé PHMC envoyant le courrier" />
            <span className="helper-text">Le courrier est signé par la personne qui le remplit : sa signature, son nom et son rôle figurent au bas du document (la signature est créée automatiquement à l'enregistrement si vous n'en avez pas).</span>
        </>
    );
};

export default SicknessEmail;
