import React, { useEffect, useMemo, useRef } from 'react';
import { Form, Alert } from 'react-bootstrap';
import Select from 'react-select';
import PatientContextFields from './shared/PatientContextFields';
import { PatientIdentityFields, AppointmentDateField, CareEmployeeField } from './shared/CareFormHeader';
import { ReferralFields, SurgeryCharacterFields, PostOpFields } from './shared/CareExtraFields';
import SurgeryAssistant from './shared/SurgeryAssistant';
import { careStaffOnly } from './shared/PhmcEmployeeSelect';
import { darkSelectStyles } from './shared/selectStyles';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';

const ANESTHESIA_TYPE_OPTIONS = [
    { value: 'General', label: 'Anesthésie générale' },
    { value: 'Regional', label: 'Anesthésie locorégionale / péridurale' },
    { value: 'Local', label: 'Anesthésie locale' },
    { value: 'Sedation', label: 'Sédation' },
    { value: 'None', label: 'Aucune anesthésie' },
];

const SURGEON_ROLE = 'Chirurgien(ne)';

// Équipe chirurgicale. La personne qui remplit le rapport (« signataire », sélectionnée d'office, un administrateur choisit un soignant) le SIGNE :
//   • si elle est chirurgien(ne), elle est le chirurgien principal ;
//   • sinon (par exemple un(e) interne qui remplit le rapport à la place du chirurgien), elle est placée dans le personnel présent, et le chirurgien principal se choisit dans la liste :
//     une copie du rapport lui est adressée (notification, puis « Récupérer une copie » dans Dossier Patient).
// Chirurgien et personnel présent ne se choisissent que parmi le personnel soignant.
const Surgical = ({
            formData,
            handleChange,
            phmcGroupedOptions,
            unrestrictedPhmcGroupedOptions,
            setFormData,
            patientConsent,
            complications,
            procedureGood,
        }) => {
    const { isAdmin } = useEmployeeAuth();
    const careOptions = useMemo(() => careStaffOnly(unrestrictedPhmcGroupedOptions), [unrestrictedPhmcGroupedOptions]);
    const careFlat = useMemo(() => careOptions.flatMap((group) => group.options), [careOptions]);
    // Le chirurgien principal se choisit parmi les CHIRURGIENS seulement (pas tout le personnel soignant).
    const surgeonOptions = useMemo(() => careOptions
        .map((group) => ({ ...group, options: group.options.filter((option) => Array.isArray(option.roles) && option.roles.includes(SURGEON_ROLE)) }))
        .filter((group) => group.options.length > 0), [careOptions]);
    const signerPool = useMemo(() => (isAdmin ? careStaffOnly(phmcGroupedOptions) : phmcGroupedOptions || []).flatMap((group) => group.options), [isAdmin, phmcGroupedOptions]);
    const signer = formData.phmcEmployee || '';
    const signerOption = signerPool.find((option) => option.value === signer) || null;
    const signerIsSurgeon = !!signerOption && Array.isArray(signerOption.roles) && signerOption.roles.includes(SURGEON_ROLE);
    const extraStaff = Array.isArray(formData.extraStaff) ? formData.extraStaff : [];
    const autoAdded = useRef('');

    // Signataire chirurgien : il est le chirurgien principal. Sinon, il rejoint le personnel présent (et celui qu'on avait ajouté d'office pour un signataire précédent en est retiré).
    useEffect(() => {
        if (!signer) return;
        setFormData((prev) => {
            let next = prev;
            const current = Array.isArray(prev.extraStaff) ? prev.extraStaff : [];
            if (autoAdded.current && autoAdded.current !== signer && current.includes(autoAdded.current)) {
                next = { ...next, extraStaff: current.filter((name) => name !== autoAdded.current) };
            }
            if (signerIsSurgeon) {
                if (next.surgeonEmployee !== signer) next = { ...next, surgeonEmployee: signer };
                autoAdded.current = '';
            } else {
                const list = Array.isArray(next.extraStaff) ? next.extraStaff : [];
                if (!list.includes(signer)) next = { ...next, extraStaff: [...list, signer] };
                if (next.surgeonEmployee === signer) next = { ...next, surgeonEmployee: '' };
                autoAdded.current = signer;
            }
            return next;
        });
    }, [signer, signerIsSurgeon, setFormData]);

    const surgeonValue = careFlat.find((option) => option.value === formData.surgeonEmployee) || (formData.surgeonEmployee ? { value: formData.surgeonEmployee, label: formData.surgeonEmployee } : null);

    return (
    <>
    <Form.Label className="form-section-title">Patient et rendez-vous</Form.Label>
    <PatientIdentityFields formData={formData} setFormData={setFormData} handleChange={handleChange} />
    <AppointmentDateField formData={formData} handleChange={handleChange} withTime />
    <ReferralFields formData={formData} setFormData={setFormData} handleChange={handleChange} unrestrictedPhmcGroupedOptions={unrestrictedPhmcGroupedOptions} />

    <PatientContextFields formData={formData} setFormData={setFormData} handleChange={handleChange} />

    <Form.Label className="form-section-title">Équipe chirurgicale</Form.Label>
    <CareEmployeeField formData={formData} setFormData={setFormData} options={phmcGroupedOptions} label="Identifiants de l'employé (il signe le rapport)" />

    <Form.Label className="mt-2">Chirurgien principal</Form.Label>
    <Select
        name="surgeonEmployee"
        value={surgeonValue}
        onChange={(selectedOption) => setFormData((prev) => ({ ...prev, surgeonEmployee: selectedOption ? selectedOption.value : '' }))}
        options={surgeonOptions}
        noOptionsMessage={() => 'Aucun chirurgien dans la liste du personnel'}
        isClearable={!signerIsSurgeon}
        isDisabled={signerIsSurgeon}
        placeholder="Sélectionner un chirurgien. (Vous pouvez taper pour rechercher!)"
        className="form-control"
        styles={darkSelectStyles}
    />
    {signerIsSurgeon
        ? <span className="helper-text">Vous êtes chirurgien(ne) : vous êtes le chirurgien principal et vous signez le rapport.</span>
        : <span className="helper-text">Seuls les chirurgiens sont proposés.</span>}
    {signer && !signerIsSurgeon && (
        <Alert variant="info" className="py-2 small mt-2 mb-2" data-no-tip="1">
            Vous n'êtes pas chirurgien(ne) : vous signez ce rapport et êtes ajouté(e) d'office au personnel présent. Une copie sera adressée au chirurgien choisi ci-dessus
            (il la récupère depuis « Dossier Patient » : renseignez donc l'ID du patient).
        </Alert>
    )}

    <Form.Label className="mt-2">Personnel présent</Form.Label>
    <Select
        isMulti
        name="extraStaff"
        options={careOptions.map((group) => ({ label: group.label, options: group.options.map((option) => ({ value: option.value, label: option.label })) }))}
        value={extraStaff.map((staff) => ({ value: staff, label: staff }))}
        onChange={(selectedOptions) => {
            const selectedValues = selectedOptions ? selectedOptions.map((option) => option.value) : [];
            // Le signataire non chirurgien reste dans le personnel présent : on ne peut pas le retirer.
            if (signer && !signerIsSurgeon && !selectedValues.includes(signer)) selectedValues.push(signer);
            handleChange({ target: { name: 'extraStaff', value: selectedValues } });
        }}
        className="form-control"
        placeholder="Entrer le personnel présent (( Laisser vide si aucun )) "
        styles={darkSelectStyles}
    />
    <span className="helper-text" data-no-tip="1">Chaque personne ajoutée est mentionnée dans le rapport et reçoit une notification qui l'invite à en récupérer une copie (renseignez l'ID du patient).</span>
    <SurgeryAssistant formData={formData} setFormData={setFormData} handleChange={handleChange} />

    <Form.Label className="form-section-title">Enquête chirurgicale</Form.Label>
    <SurgeryCharacterFields formData={formData} handleChange={handleChange} />
        <Form.Control
            as="textarea"
            rows={2}
            name="surgeryPreOpDiagnosis"
            value={formData.surgeryPreOpDiagnosis || ''}
            onChange={handleChange}
            placeholder="Diagnostic pré-opératoire / indication de l'intervention"
            className="form-control"
        />
        <Form.Control
            type="text"
            name="surgeryProcedures"
            value={formData.surgeryProcedures}
            onChange={handleChange}
            placeholder="Nom de la procédure"
        />
        <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Select
                name="surgeryAnesthesiaType"
                value={formData.surgeryAnesthesiaType || ''}
                onChange={handleChange}
                className="form-control"
            >
                <option value="" disabled>Type d'anesthésie</option>
                {ANESTHESIA_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
            <Form.Control
                type="text"
                inputMode="numeric"
                name="surgeryDuration"
                value={formData.surgeryDuration || ''}
                onChange={handleChange}
                placeholder="Durée de l'intervention (minutes)"
                className="form-control"
            />
            <Form.Control
                type="text"
                inputMode="numeric"
                name="surgeryBloodLoss"
                value={formData.surgeryBloodLoss || ''}
                onChange={handleChange}
                placeholder="Pertes sanguines estimées (mL)"
                className="form-control"
            />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
        <Form.Select
        name="patientConsentOption"
        value={formData.patientConsentOption}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                patientConsentOption: selectedType,
                patientConsentYes: selectedType === 'Yes' ? prev.patientConsentYes : '',
                patientConsentNo: selectedType === 'No' ? prev.patientConsentNo : '',
            }));
        }}
        className="form-control"
    >
        <option value="" disabled>Patient consentant?</option>
        {patientConsent.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>        
    <Form.Select
        name="patientComplicationOptions"
        value={formData.patientComplicationOptions}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                patientComplicationOptions: selectedType,
                patientComplicationsYes: selectedType === 'Yes' ? prev.patientComplicationsYes : '',
                patientComplicationsNo: selectedType === 'No' ? prev.patientComplicationsNo : '',
            }));
        }}
        className="form-control"
    >
        <option value="" disabled>Complications chirurgicales?</option>
        {complications.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>
    <Form.Select
        name="procedureGoodOptions"
        value={formData.procedureGoodOptions}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                procedureGoodOptions: selectedType,
                procedureGoodYes: selectedType === 'Yes' ? prev.procedureGoodYes : '',
                procedureGoodNo: selectedType === 'No' ? prev.procedureGoodNo : '',
            }));
        }}
        className="form-control"
    >
        <option value="" disabled>Procédure réussie?</option>
        {procedureGood.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>
    </div>
        {formData.patientComplicationOptions === 'Yes' && (
            <Form.Control
                as="textarea"
                rows={2}
                name="patientComplicationsYes"
                value={formData.patientComplicationsYes || ''}
                onChange={handleChange}
                placeholder="Décrire les complications survenues et leur prise en charge"
                className="form-control"
            />
        )}
        {formData.procedureGoodOptions === 'No' && (
            <Form.Control
                as="textarea"
                rows={2}
                name="procedureGoodNo"
                value={formData.procedureGoodNo || ''}
                onChange={handleChange}
                placeholder="Expliquer pourquoi la procédure n'a pas abouti au résultat souhaité"
                className="form-control"
            />
        )}

        <Form.Label className="form-section-title">Rapport post-anesthésie</Form.Label>
        <Form.Control
            as="textarea"
            name="patientSummaryConsultation"
            value={formData.patientSummaryConsultation}
            onChange={handleChange}
            placeholder="Type et dosage d'anesthésie administrée"
            rows="2"
            className="form-control"
        />
        <Form.Control
            as="textarea"
            name="patientAddress"
            value={formData.patientAddress}
            onChange={handleChange}
            rows="2"
            className="form-control"
            placeholder="Détails de l'anesthésie post-opératoire (réveil, surveillance)"
        />

        <PostOpFields formData={formData} handleChange={handleChange} />

        <Form.Label className="form-section-title">Résumé de la procédure et suites</Form.Label>
        <Form.Control
            as="textarea"
            name="patientSummary"
            value={formData.patientSummary}
            onChange={handleChange}
            rows="4"
            className="form-control"
            placeholder="Résumé de la procédure chirurgicale"
        />
        <Form.Control
            as="textarea"
            rows={2}
            name="surgeryPostOpInstructions"
            value={formData.surgeryPostOpInstructions || ''}
            onChange={handleChange}
            placeholder="Consignes post-opératoires, traitements prescrits et suivi prévu"
            className="form-control"
        />
</>
    );
};

export default Surgical; // Export with PascalCase name
