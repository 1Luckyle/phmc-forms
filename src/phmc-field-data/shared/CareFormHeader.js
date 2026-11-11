// src/phmc-field-data/shared/CareFormHeader.js
//
// En-tête COMMUN des formulaires du personnel soignant (opération, évaluations, consultations, protocole d'urgence, certificats) : « Patient et rendez-vous » puis « Identifiants de
// l'employé ». Même placement et même comportement partout :
//   • ID patient d'abord : dès qu'il est saisi, le nom, la date de naissance, le sexe et le fond médical sont repris du DOSSIER du patient (hooks/useDossierPrefill.js). Sans dossier,
//     les champs restent vides (saisie à la main) et un encadré invite à faire créer le dossier ;
//   • nom du patient en trois champs (prénom, deuxième prénom, nom), le nom complet se recompose tout seul ;
//   • date du rendez-vous : jamais dans le passé (utils/appointmentDate.js) ;
//   • employé : on ne peut choisir que soi-même (un administrateur choisit n'importe quel SOIGNANT). Pas de « fonction » à choisir : le rôle suit l'employé, et le rapport est signé
//     du prénom et du nom de la personne qui le remplit.
import React from 'react';
import { Form } from 'react-bootstrap';
import usePatientNameParts from '../../hooks/usePatientNameParts';
import { usePatientDossier } from '../../utils/dossierLookup';
import { todayIso } from '../../utils/appointmentDate';
import PhmcEmployeeSelect from './PhmcEmployeeSelect';

const rowStyle = { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '0.6rem' };
const cell = (basis) => ({ flex: `1 1 ${basis}px`, minWidth: 0 });

// Encadré sous l'ID patient : dossier repris, ou invitation à le créer.
export const DossierNotice = ({ patientID }) => {
    const { status } = usePatientDossier(patientID);
    if (status === 'found') {
        return <div className="helper-text" data-no-tip="1" style={{ marginBottom: '0.6rem' }}><i className="fas fa-notes-medical me-1"></i>Informations reprises du dossier du patient (vous pouvez les corriger ici).</div>;
    }
    if (status === 'missing') {
        return (
            <div data-no-tip="1" style={{ border: '1px solid #d29922', borderRadius: 6, padding: '8px 12px', marginBottom: '0.6rem', background: 'rgba(210, 153, 34, 0.08)', fontSize: '0.85rem' }}>
                <i className="fas fa-circle-info me-2"></i>
                Ce patient n'a pas encore de <strong>dossier médical</strong> : son identité, sa date de naissance et ses antécédents ne peuvent pas être repris automatiquement. Saisissez-les à la main,
                et invitez-le à remplir son <strong>Dossier Médical Basique</strong> (ou Avancé) pour que ses prochains rapports soient préremplis.
            </div>
        );
    }
    return null;
};

// ID patient + nom en trois champs (le nom complet `patientName` est recomposé par usePatientNameParts).
export const PatientIdentityFields = ({ formData, setFormData, handleChange, idPlaceholder = 'ID Patient (ex. PHMC-2752) : relie le rapport à son dossier' }) => {
    usePatientNameParts(formData, setFormData, { full: 'patientName', first: 'patientFirstName', middle: 'patientMiddleName', last: 'patientLastName' });
    return (
        <>
            <div style={rowStyle}>
                <div style={cell(260)}>
                    <Form.Label>ID du patient</Form.Label>
                    <Form.Control type="text" name="patientID" value={formData.patientID || ''} onChange={handleChange} placeholder={idPlaceholder} className="form-control" />
                </div>
            </div>
            <DossierNotice patientID={formData.patientID} />
            <div style={rowStyle}>
                <div style={cell(160)}><Form.Control type="text" name="patientFirstName" value={formData.patientFirstName || ''} onChange={handleChange} placeholder="Prénom du patient" className="form-control" /></div>
                <div style={cell(160)}><Form.Control type="text" name="patientMiddleName" value={formData.patientMiddleName || ''} onChange={handleChange} placeholder="Deuxième prénom" className="form-control" /></div>
                <div style={cell(160)}><Form.Control type="text" name="patientLastName" value={formData.patientLastName || ''} onChange={handleChange} placeholder="Nom de famille" className="form-control" /></div>
            </div>
        </>
    );
};

// Date du rendez-vous / de la consultation : le sélecteur refuse le passé (min), et la saisie au clavier aussi (voir MainApp.handleChange).
export const AppointmentDateField = ({ formData, handleChange, name = 'date', label = 'Date du rendez-vous' }) => (
    <div style={{ marginBottom: '0.6rem' }}>
        <Form.Label>{label}</Form.Label>
        <Form.Control type="date" name={name} value={formData[name] || ''} min={todayIso()} onChange={handleChange} className="form-control" />
    </div>
);

// Employé : soi-même (liste verrouillée) ; un administrateur choisit un soignant.
export const CareEmployeeField = ({ formData, setFormData, options, label = "Identifiants de l'employé", name = 'phmcEmployee', placeholder = 'Sélectionner un soignant. (Vous pouvez taper pour rechercher!)', rankField = 'phmcRank' }) => (
    <PhmcEmployeeSelect name={name} label={label} options={options} formData={formData} setFormData={setFormData} careOnly placeholder={placeholder} rankField={rankField} />
);

const CareFormHeader = ({ formData, setFormData, handleChange, phmcGroupedOptions, sectionTitle = 'Patient et rendez-vous', dateLabel = 'Date du rendez-vous', dateName = 'date' }) => (
    <>
        <Form.Label className="form-section-title">{sectionTitle}</Form.Label>
        <PatientIdentityFields formData={formData} setFormData={setFormData} handleChange={handleChange} />
        <AppointmentDateField formData={formData} handleChange={handleChange} name={dateName} label={dateLabel} />
        <CareEmployeeField formData={formData} setFormData={setFormData} options={phmcGroupedOptions} />
    </>
);

export default CareFormHeader;
