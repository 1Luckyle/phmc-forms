import React, { useEffect } from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';
import FleecaPaymentPanel from '../components/FleecaPaymentPanel';
import StaffBillingNotice from '../components/StaffBillingNotice';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { buildCivilianAutofillValues, applyCivilianAutofill } from '../utils/civilianAutofill';
import { getPrice, usePrices } from '../utils/pricing';
import useBillingRole from '../hooks/useBillingRole';
import ForMyselfBanner from '../components/ForMyselfBanner';
import useMinorTitleGuard from '../hooks/useMinorTitleGuard';
import { GUARDIAN_RELATIONS, ageOn, isMinorPatient } from '../utils/minors';
import PatientGeneralInfo from './shared/PatientGeneralInfo';
import { darkSelectStyles } from './shared/selectStyles';

// Champs d'identité de la demande de divulgation (prénom, deuxième prénom et nom sont déjà séparés ; pas de nom complet à recomposer).
const RELEASE_FIELDS = {
    id: 'patientID', title: 'patientTitle', full: null, first: 'patientFirstName', middle: 'patientMiddleName', last: 'patientLastName', dob: 'patientDateOfBirth',
    gender: 'patientGender', address: 'patientAddress', zip: 'patientZIP', phone: 'patientPH', email: 'patientEmail',
};

// Les anciens brouillons contenaient du texte libre (« 01/10/2026 ») : un champ date n'affiche que AAAA-MM-JJ, tout le reste s'affiche vide.
const isoDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : '');

const MedicalRelease = ({
    formData,
    handleChange,
    setFormData,
    patientTitleOptions, // Updated: Was patientTitle
    purposeOptions,
    formatOptions, // Updated: Was PurposeMedicalInformationReleaseFormat
    medicalRecordOptions, // Updated: Was MedicalRecordsRelease
    phmcGroupedOptions,
    unrestrictedPhmcGroupedOptions,

}) => {
    usePrices(); // se redessine si un admin change les tarifs

    const calculateCost = () => {
        const selectedCount = formData.MedicalRecordsRelease?.length || 0;
        if (selectedCount === 0) {
            return 0;
        }
        const costPerItem = getPrice('divulgationParElement');
        return selectedCount * costPerItem;
    };
    const approximateCost = calculateCost();
    const isMinor = isMinorPatient({ birthDate: formData.patientDateOfBirth, titleIsMinor: formData.patientTitle === 'Mineur' });
    const minorAge = ageOn(formData.patientDateOfBirth);
    // Si c'est un membre du personnel PHMC/DMEC connecté qui remplit ce
    // formulaire (pas le civil lui-même), le paiement ne doit jamais être
    // demandé ici : c'est au civil de payer, pas au soignant qui remplit le
    // dossier à sa place — sinon le paiement Fleeca ne peut tout simplement
    // pas avoir lieu.
    const { isCivilian, civilianProfile } = useEmployeeAuth();
    const { filledByStaff } = useBillingRole(formData, setFormData);
    const minorGuard = useMinorTitleGuard(formData, setFormData);
    // Praticien consulté : un personnel qui remplit pour un patient est lui-même le praticien (liste restreinte à lui) ; quand la personne est son propre
    // patient (Civil, DMEC, soignant pour lui-même), elle choisit parmi tout le personnel PHMC.
    // Seul le personnel soignant peut être « praticien consulté » (ni administration, ni polyvalent, ni DMEC).
    const practitionerOptions = ((filledByStaff ? phmcGroupedOptions : unrestrictedPhmcGroupedOptions) || phmcGroupedOptions || [])
        .map((group) => ({ ...group, options: group.options.filter((option) => !option.families || option.families.includes('soignant')) }))
        .filter((group) => group.options.length > 0);
    // Répercuté dans formData car le générateur BBCode (fonction pure, sans
    // accès au contexte React) en a besoin pour afficher le bon texte.
    useEffect(() => {
        setFormData(prev => (prev.filledByStaff === filledByStaff ? prev : { ...prev, filledByStaff }));
    }, [filledByStaff, setFormData]);
    // Pré-remplissage depuis le profil Civil connecté — uniquement les champs
    // identité/contact encore vides, aucun champ de santé (le profil Civil
    // n'en contient pas). Ce formulaire utilise prénom/nom séparés, pas un nom
    // combiné, contrairement à BasicPatientFile/PatientAdvanced.
    useEffect(() => {
        if (!isCivilian || !civilianProfile) return;
        const autofillValues = buildCivilianAutofillValues(civilianProfile);
        setFormData(prev => applyCivilianAutofill(prev, autofillValues, {
            patientID: 'patientID',
            patientFirstName: 'firstName',
            patientMiddleName: 'middleName',
            patientLastName: 'lastName',
            patientDateOfBirth: 'dateOfBirth',
            patientGender: 'gender',
            patientAddress: 'address',
            patientZIP: 'zip',
            patientPH: 'phone',
            patientEmail: 'email',
        }));
    }, [isCivilian, civilianProfile, setFormData]);

    return (
        <>
        <ForMyselfBanner formData={formData} setFormData={setFormData} fields={{ patientID: 'patientID', patientFirstName: 'firstName', patientMiddleName: 'middleName', patientLastName: 'lastName', patientDateOfBirth: 'dateOfBirth', patientGender: 'gender', patientAddress: 'address', patientZIP: 'zip', patientPH: 'phone', patientEmail: 'email' }} />
        <Form.Group className="mb-3">
            <PatientGeneralInfo
                formData={formData} setFormData={setFormData} handleChange={handleChange} fields={RELEASE_FIELDS}
                patientTitleOptions={patientTitleOptions || []} guard={minorGuard}
            />
            {isMinor && (
                <div className="mt-3 mb-3 p-3 border rounded" style={{ borderColor: '#e3b341' }}>
                    <strong style={{ color: '#e3b341' }}>
                        <i className="fas fa-child me-2"></i>Patient mineur{minorAge !== null ? ` (${minorAge} ans)` : ''}
                    </strong>
                    <p className="helper-text mb-2">
                        Un mineur ne signe pas seul cette autorisation : son représentant légal (parent ou tuteur) la signe à sa place.
                    </p>
                    <Form.Check
                        type="checkbox"
                        id="patientEmancipated"
                        label=" Mineur émancipé (il signe lui-même)"
                        checked={!!formData.patientEmancipated}
                        onChange={(e) => setFormData(prev => ({ ...prev, patientEmancipated: e.target.checked }))}
                        className="mb-2"
                    />
                    {!formData.patientEmancipated && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                type="text"
                                name="guardianName"
                                value={formData.guardianName || ''}
                                onChange={handleChange}
                                placeholder="Prénom Nom du représentant légal"
                                className="form-control"
                            />
                            <Form.Select
                                name="guardianRelation"
                                value={formData.guardianRelation || ''}
                                onChange={handleChange}
                                className="form-control"
                            >
                                <option value="" disabled>Lien avec le patient</option>
                                {GUARDIAN_RELATIONS.map((relation) => <option key={relation} value={relation}>{relation}</option>)}
                            </Form.Select>
                        </div>
                    )}
                </div>
            )}
        </Form.Group>
            <Form.Label>Objectif de la divulgation des informations médicales</Form.Label>
            <Form.Select
                name="CarePurposeMedicalInformationRelease"
                value={formData.CarePurposeMedicalInformationRelease}
                onChange={(e) => {
                    const selectedType = e.target.value;
                    setFormData(prev => ({
                        ...prev,
                        CarePurposeMedicalInformationRelease: selectedType,
                        PurposeFurtherCare: selectedType === 'Further Treatment' ? prev.PurposeFurtherCare : '',
                        PurposePersonal: selectedType === 'Personal' ? prev.PurposePersonal : '',
                        PurposeAttorney: selectedType === 'Attorney' ? prev.PurposeAttorney : '',
                        PurposeOther: selectedType === 'Other' ? prev.PurposeOther : '',
                    }));
                }}
                className="form-control"
            >
                <option value="" disabled>Objectif de la divulgation</option>
                {(purposeOptions || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
        {formData.CarePurposeMedicalInformationRelease === 'Other' && (
            <Form.Control
                as="textarea"
                rows="2"
                name="patientMedInfoReleaseOther"
                value={formData.patientMedInfoReleaseOther}
                onChange={handleChange}
                placeholder="Ajouter une raison de divulgation différente (Ex: Assurance / Tribunaux)"
                className="form-control"

            />
        )}

            <Form.Label>Format de divulgation des informations médicales </Form.Label>
            <Form.Select
            name="PurposeMedicalInformationReleaseFormat"
            value={formData.PurposeMedicalInformationReleaseFormat}
            onChange={(e) => {
                const selectedType = e.target.value;
                setFormData(prev => ({
                    ...prev,
                    PurposeMedicalInformationReleaseFormat: selectedType,
                    CopyofRecords: selectedType === 'CopyofRecords' ? prev.CopyofRecords : '',
                    VerbalRelease: selectedType === 'VerbalRelease' ? prev.VerbalRelease : '',
                    ElectronicRelease: selectedType === 'ElectronicRelease' ? prev.ElectronicRelease : '',
                    Other: selectedType === 'Other' ? prev.Other : '',
                }));
            }}
            className="form-control"
        >
            <option value="" disabled>Format de la divulgation</option>
            {/* Updated to use formatOptions prop */}
            {(formatOptions || []).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </Form.Select>
         {formData.PurposeMedicalInformationReleaseFormat === 'Other' && (
            <Form.Control
                as="textarea"
                rows="2"
                name="patientMedInfoFormatOther"
                value={formData.patientMedInfoFormatOther}
                onChange={handleChange}
                placeholder="Ajouter une option de divulgation différente (Ex: FAX)"
                className="form-control"

            />
        )}
          <Form.Label>Période de divulgation des dossiers</Form.Label>
        <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
                <Form.Label className="small mb-1">Du</Form.Label>
                <Form.Control type="date" name="StupidDateFrom" value={isoDate(formData.StupidDateFrom)} max={formData.StupidDateTo || undefined} onChange={handleChange} className="form-control" />
            </div>
            <div style={{ flex: 1 }}>
                <Form.Label className="small mb-1">Au</Form.Label>
                <Form.Control type="date" name="StupidDateTo" value={isoDate(formData.StupidDateTo)} min={formData.StupidDateFrom || undefined} onChange={handleChange} className="form-control" />
            </div>
        </div>

            <Form.Label>Dossiers médicaux à divulguer </Form.Label>
            <Select
                    isMulti
                    name="MedicalRecordsRelease"
                    // Updated to use medicalRecordOptions prop for options
                    // The value logic remains the same, checking against formData
                    value={(medicalRecordOptions || []).filter(option =>
                        formData.MedicalRecordsRelease?.includes(option.value)
                    )}
                        onChange={(selectedOptions) => {
                        setFormData(prev => ({
                            ...prev,
                            MedicalRecordsRelease: selectedOptions ? selectedOptions.map(option => option.value) : []
                        }));
                    }}
                    options={medicalRecordOptions || []} // Updated to use medicalRecordOptions prop
                    className="form-control"
                    placeholder="Sélectionner les options de divulgation (Choix multiples)"
                    styles={{
                        ...darkSelectStyles,
                        control: (base, state) => ({
                            ...darkSelectStyles.control(base, state),
                            borderColor: !formData.MedicalRecordsRelease || formData.MedicalRecordsRelease.length === 0 ? '#dc3545' : '#6c757d',
                        }),
                    }}
            />
                        {approximateCost > 0 && (
                <Form.Label style={{ marginTop: '5px', color: '#28a745', fontWeight: 'bold' }}>
                    Ce service coûtera environ ${approximateCost.toLocaleString()}
                </Form.Label>
            )}
            {approximateCost > 0 && filledByStaff && (
                <StaffBillingNotice
                    bbCodeVersion={24}
                    formData={formData}
                    setFormData={setFormData}
                    description={`Dossier médical - ${formData.patientFirstName || ''} ${formData.patientLastName || ''}`.trim()}
                />
            )}
            {approximateCost > 0 && !filledByStaff && (
                <Form.Group className="mb-3" style={{ marginTop: '15px' }}>
                    <Form.Check
                        type="checkbox"
                        id="payNowCheckbox"
                        label=" Payer maintenant?"
                        checked={formData.payNow === true || formData.payNow === 'true'}
                        onChange={(e) => {
                            setFormData(prev => ({
                                ...prev,
                                payNow: e.target.checked,
                            }));
                        }}
                    />
                    <span className="helper-text">
                        Cochez cette case pour générer un lien de paiement Fleeca. Si vous enregistrez sans avoir payé, une facture à votre nom est créée (rappels par mail).
                    </span>
                </Form.Group>
            )}

            {!filledByStaff && (formData.payNow === true || formData.payNow === 'true') && approximateCost > 0 && (
                <FleecaPaymentPanel
                    amount={approximateCost}
                    description={`Dossier médical - ${formData.patientFirstName || ''} ${formData.patientLastName || ''}`.trim()}
                    paymentId={formData.fleecaPaymentId}
                    onPaymentIdChange={(id) => setFormData(prev => ({ ...prev, fleecaPaymentId: id, ...(id ? {} : { paymentProofPhotos: '' }) }))}
                    onPaymentConfirmed={({ paymentLink }) => setFormData(prev => ({ ...prev, paymentProofPhotos: paymentLink }))}
                />
            )}
                                                <Form.Label></Form.Label>

            {formData.MedicalRecordsRelease && formData.MedicalRecordsRelease.includes('Other') && (
            <Form.Control
                as="textarea"
                rows="2"
                name="MedicalRecordsReleaseOther"
                value={formData.MedicalRecordsReleaseOther}
                onChange={handleChange}
                placeholder="Veuillez spécifier d'autres dossiers à divulguer"
                className="form-control" 
            />
        )}
            <Form.Label></Form.Label>
            <Form.Label>Praticien consulté:</Form.Label> 
    <Select
            name="phmcEmployee"
            value={practitionerOptions
                .flatMap(group => group.options)
                .find(option => option.value === formData.phmcEmployee) || null}
            onChange={(selectedOption) => {
                handleChange({
                    target: {
                        name: 'phmcEmployee',
                        value: selectedOption?.value || ''
                    }
                });
                if (selectedOption) {
                    setFormData(prev => ({
                        ...prev,
                        phmcSignature: selectedOption.signature || ''
                    }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        phmcSignature: ''
                    }));
                }
            }}
            options={practitionerOptions}
            isClearable
            placeholder="Quel médecin vous a traité? (Vous pouvez taper pour rechercher!)"
            className="form-control" 
            styles={{
                ...darkSelectStyles,
                group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
                groupHeading: (base) => ({ ...base, color: '#9aa7b4', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 }),
            }}
        />
            <Form.Label></Form.Label>

            <Form.Label>Autorisation de divulgation des informations</Form.Label>
            <Form.Control
type="date"
name="SubmitDate"
value={formData.SubmitDate || new Date().toISOString().split('T')[0]}
onChange={handleChange}
readOnly 
className="form-control" 
/>

</>
    );
};

export default MedicalRelease;
