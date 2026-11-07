import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import './phmc-tooltips.css'; // Assuming you have a tooltip component
import FleecaPaymentPanel from '../components/FleecaPaymentPanel';
import StaffBillingNotice from '../components/StaffBillingNotice';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { buildCivilianAutofillValues, applyCivilianAutofill } from '../utils/civilianAutofill';
import { getPrice, usePrices } from '../utils/pricing';
import useBillingRole from '../hooks/useBillingRole';
import useExemption from '../hooks/useExemption';
import ExemptionNote from '../components/ExemptionNote';
import ForMyselfBanner from '../components/ForMyselfBanner';
import useMinorTitleGuard from '../hooks/useMinorTitleGuard';
import PatientGeneralInfo from './shared/PatientGeneralInfo';
import EmergencyContactFields from './shared/EmergencyContactFields';
import PresetTextField from './shared/PresetTextField';
import NameFields from './shared/NameFields';
import { HISTORY_PRESETS } from '../constants/historyPresets';

const ATTORNEY_FIELDS = { full: 'attorneyName', first: 'attorneyFirstName', middle: 'attorneyMiddleName', last: 'attorneyLastName' };

const GENERAL_FIELDS = {
    id: 'patientID', title: 'patientTitle', full: 'patientName', first: 'patientFirstName', middle: 'patientMiddleName', last: 'patientLastName', dob: 'patientDateOfBirth',
    gender: 'patientGender', race: 'patientRace', address: 'patientAddress', zip: 'patientZIP', phone: 'patientPH', email: 'patientEmail', discord: 'patientDiscord',
};

// Helper component for collapsible section headers - Copied from Nursing.js
const CollapsibleHeader = ({ title, isOpen, onToggle, sectionId }) => (
    <Button
        variant="link"
        onClick={onToggle} // Keep the existing onToggle function
        aria-expanded={isOpen}
        aria-controls={`collapse-${sectionId}`}
        style={{
            fontWeight: 'bold',
            marginTop: '1rem',
            padding: '0.5rem 0',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: 'none'
        }}
    >
        {title}
        <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ marginLeft: '10px' }}></i>
    </Button>
);

// Normalise ["Yes","No"] -> [{value:"Yes",label:"Yes"}, ...]
const toOptions = (arr = []) =>
  Array.isArray(arr)
    ? arr.map(v =>
        (v && typeof v === 'object' && 'value' in v && 'label' in v)
          ? v
          : { value: String(v), label: String(v) }
      )
    : [];

const PatientAdvanced = ({
    formData,
    handleChange,
    setFormData,
    patientTitleOptions,
    patientBloodType,
    maritalStatus,
    numberChildren,
    financialStatus,
    selectOptions
}) => {
    usePrices(); // se redessine si un admin change les tarifs
    const [isGeneralInfoOpen, setIsGeneralInfoOpen] = useState(true);
    const [isContactInfoOpen, setIsContactInfoOpen] = useState(true);
    const [isMentalHealthOpen, setIsMentalHealthOpen] = useState(true);
    const [isFamilyHistoryOpen, setIsFamilyHistoryOpen] = useState(true);
    const [isSocialHistoryOpen, setIsSocialHistoryOpen] = useState(true);
    const [isLifestyleOpen, setIsLifestyleOpen] = useState(true);
    const [isMedicalHistoryOpen, setIsMedicalHistoryOpen] = useState(true);
    const [isAdvancedDirectivesOpen, setIsAdvancedDirectivesOpen] = useState(true);
    const [isPaymentInfoOpen, setIsPaymentInfoOpen] = useState(true);
        // Si c'est un membre du personnel PHMC/DMEC connecté qui remplit ce
        // formulaire (pas le civil lui-même), le paiement ne doit jamais être
        // demandé ici : c'est au civil de payer, pas au soignant qui remplit le
        // dossier à sa place — sinon le paiement Fleeca ne peut tout simplement
        // pas avoir lieu.
        const { isCivilian, civilianProfile } = useEmployeeAuth();
        const { filledByStaff } = useBillingRole(formData, setFormData);
        const exemption = useExemption(formData, setFormData);
    const minorGuard = useMinorTitleGuard(formData, setFormData);
        // Répercuté dans formData car le générateur BBCode (fonction pure, sans
        // accès au contexte React) en a besoin pour afficher le bon texte.
        useEffect(() => {
            setFormData(prev => (prev.filledByStaff === filledByStaff ? prev : { ...prev, filledByStaff }));
        }, [filledByStaff, setFormData]);
        // Pré-remplissage depuis le profil Civil connecté — uniquement les
        // champs identité/contact encore vides, aucun champ de santé (le
        // profil Civil n'en contient pas).
        useEffect(() => {
            if (!isCivilian || !civilianProfile) return;
            const autofillValues = buildCivilianAutofillValues(civilianProfile);
            setFormData(prev => applyCivilianAutofill(prev, autofillValues, {
                patientID: 'patientID',
                patientName: 'fullName',
                patientFirstName: 'firstName',
                patientMiddleName: 'middleName',
                patientLastName: 'lastName',
                patientDateOfBirth: 'dateOfBirth',
                patientAddress: 'address',
                patientGender: 'gender',
                patientPH: 'phone',
                patientEmail: 'email',
                patientDiscord: 'discord',
            }));
        }, [isCivilian, civilianProfile, setFormData]);
        const isPayNow = formData.payNow === true || formData.payNow === 'true';
        const isExempt = formData.isExempt === true || formData.isExempt === 'true';
        const calculateCost = () => {
            if (isExempt) return 0;
            return getPrice('dossierAvance');
        };
        const approximateCost = calculateCost();


    const dnrOptions = toOptions(selectOptions.dnr || []);
    const attorneyOptions = toOptions(selectOptions.attorney || []);
    const dnrOrderOptions = toOptions(selectOptions.dnrOrder || []);

    return (
        



        <>
            <ForMyselfBanner formData={formData} setFormData={setFormData} fields={{ patientID: 'patientID', patientName: 'fullName', patientFirstName: 'firstName', patientMiddleName: 'middleName', patientLastName: 'lastName', patientDateOfBirth: 'dateOfBirth', patientGender: 'gender', patientAddress: 'address', patientPH: 'phone', patientEmail: 'email', patientDiscord: 'discord' }} />
            {/* --- 1. General Information --- */}
            <CollapsibleHeader
                title="Informations générales"
                isOpen={isGeneralInfoOpen}
                onToggle={() => setIsGeneralInfoOpen(!isGeneralInfoOpen)}
                sectionId="general-info"
            />
            {isGeneralInfoOpen && (
                <div id="collapse-general-info" style={{ marginTop: '1rem' }}>
                    <PatientGeneralInfo
                        formData={formData} setFormData={setFormData} handleChange={handleChange} fields={GENERAL_FIELDS}
                        patientTitleOptions={patientTitleOptions || []} guard={minorGuard}
                    />
                </div>
            )}

            {/* --- Emergency Contact Information --- */}
            <CollapsibleHeader
                title="Informations de contact d'urgence"
                isOpen={isContactInfoOpen}
                onToggle={() => setIsContactInfoOpen(!isContactInfoOpen)}
                sectionId="contact-info"
            />
            {isContactInfoOpen && (
                <div id="collapse-contact-info">
                    <EmergencyContactFields formData={formData} handleChange={handleChange} />
                </div>
            )}

            {/* --- 3. Medical History --- */}
            <CollapsibleHeader
                title="Historique médical"
                isOpen={isMedicalHistoryOpen}
                onToggle={() => setIsMedicalHistoryOpen(!isMedicalHistoryOpen)}
                sectionId="medical-history"
            />
            {isMedicalHistoryOpen && (
                <div id="collapse-medical-history">
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                        <Form.Select
                            name="patientBloodType"
                            value={formData.patientBloodType || ""}
                            onChange={handleChange}
                            className="form-control"
                        >
                            <option value="" disabled>Groupe sanguin</option>
                            {patientBloodType.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <PresetTextField name="patientAllergies" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientAllergies} />
                            <PresetTextField name="patientCurrentMedicine" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientCurrentMedicine} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <PresetTextField name="patientChronicDiseases" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientChronicDiseases} />
                            <PresetTextField name="patientNotes" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientNotes} />
                    </div>
                </div>
            )}
            {/* --- 3. Mental Health History --- */}
            <CollapsibleHeader
                title="Historique de santé mentale"
                isOpen={isMentalHealthOpen}
                onToggle={() => setIsMentalHealthOpen(!isMentalHealthOpen)}
                sectionId="mental-health"
            />
            {isMentalHealthOpen && (
                <div id="collapse-mental-health">
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <PresetTextField name="patientMental" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientMental} />
                            <PresetTextField name="patientTherapy" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientTherapy} />
                            
                            <PresetTextField name="patientTriggers" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientTriggers} />
                            

                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <PresetTextField name="patientSupport" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientSupport} />
                            <PresetTextField name="patientHarm" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientHarm} />
                    </div>
                </div>
            )}
            {/* ---  Family Health History --- */}
            <CollapsibleHeader
                title="Historique médical familial"
                isOpen={isFamilyHistoryOpen}
                onToggle={() => setIsFamilyHistoryOpen(!isFamilyHistoryOpen)}
                sectionId="family-history"
            />
            {isFamilyHistoryOpen && (
                <div id="collapse-family-health">
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <PresetTextField name="patientFam" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientFam} />
                            <PresetTextField name="patientGenetic" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientGenetic} />
                            <PresetTextField name="patientFamSocial" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientFamSocial} />
                    </div>
                </div>
            )}
            {/* --- Social Information --- */}
            <CollapsibleHeader
                title="Informations sociales"
                isOpen={isSocialHistoryOpen}
                onToggle={() => setIsSocialHistoryOpen(!isSocialHistoryOpen)}
                sectionId="social-information"
            />
            {isSocialHistoryOpen && (
                <div id="collapse-social-information">
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Select
                            name="maritalStatus"
                            value={formData.maritalStatus || ""}
                            onChange={handleChange}
                            className="form-control"
                        >
                            <option value="" disabled>État civil</option>
                            {maritalStatus.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <Form.Select
                            name="numberChildren"
                            value={formData.numberChildren || ""}
                            onChange={handleChange}
                            className="form-control"
                        >
                            <option value="" disabled>Nombre d'enfants</option>
                            {numberChildren.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                                <PresetTextField name="patientReligion" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientReligion} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Select
                                    name="financialStatus"
                                    value={formData.financialStatus || ""}
                                    onChange={handleChange}
                                    className="form-control"
                                >
                                    <option value="" disabled>Situation financière</option>
                                    {financialStatus.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                        </div>

                </div>
            )}
            {/* ---  Lifestyle Information --- */}
            <CollapsibleHeader
                title="Informations sur le mode de vie"
                isOpen={isLifestyleOpen}
                onToggle={() => setIsLifestyleOpen(!isLifestyleOpen)}
                sectionId="Lifestyle-Information"
            />
            {isLifestyleOpen && (
                <div id="collapse-Lifestyle-Information">
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <PresetTextField name="patientSmoker" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientSmoker} />
                            <PresetTextField name="patientAlcohol" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientAlcohol} />
                            <PresetTextField name="patientDrugs" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientDrugs} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <PresetTextField name="patientExercise" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientExercise} />
                            <PresetTextField name="patientDiet" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientDiet} />
                            <PresetTextField name="patientSleep" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientSleep} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <PresetTextField name="patientSexLife" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientSexLife} />
                            <PresetTextField name="patientJobRisks" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientJobRisks} />
                            <PresetTextField name="patientHazards" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientHazards} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            as="textarea"
                            rows="2"
                            name="patientOther"
                            value={formData.patientOther}
                            onChange={handleChange}
                            placeholder="Autres informations"
                            className="form-control"
                        />
                </div>

                </div>
            )}

            {/* ---  Advanced Directives --- */}
            <CollapsibleHeader
                title="Directives anticipées"
                isOpen={isAdvancedDirectivesOpen}
                onToggle={() => setIsAdvancedDirectivesOpen(!isAdvancedDirectivesOpen)}
                sectionId="advanced-directives"
            />
            {isAdvancedDirectivesOpen && (
                <div id="collapse-advanced-directives">
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                            <Form.Select
                                name="dnr"
                                value={formData.dnr}
                                onChange={handleChange}
                                className="form-control"
                            >
                                <option value="" disabled>Testament de vie</option>
                                {dnrOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                            <Form.Select
                                name="attorney"
                                value={formData.attorney}
                                onChange={handleChange}
                                className="form-control"
                            >
                                <option value="" disabled>Procuration pour soins de santé</option>
                                {attorneyOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                            <Form.Select
                                name="dnrOrder"
                                value={formData.dnrOrder}
                                onChange={handleChange}
                                className="form-control"
                            >
                                <option value="" disabled>Ordre de non-réanimation </option>
                                {dnrOrderOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {formData.dnr === 'other' && (
                                <Form.Control
                                    as="textarea"
                                    rows="2"
                                    name="dnrOther"
                                    value={formData.dnrOther}
                                    onChange={handleChange}
                                    placeholder="Autres instructions de testament de vie"
                                    className="form-control"
                                />
                        )}

                        {formData.attorney === 'Yes' && (
                            <>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <NameFields
                                            formData={formData} setFormData={setFormData} handleChange={handleChange} fields={ATTORNEY_FIELDS}
                                            placeholders={{ first: 'Prénom du mandataire', middle: 'Deuxième prénom du mandataire', last: 'Nom du mandataire' }}
                                        />
                                    </div>
                                    <Form.Control
                                        type="text"
                                        name="attorneyRelation"
                                        value={formData.attorneyRelation}
                                        onChange={handleChange}
                                        placeholder="Relation du mandataire"
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="attorneyPH"
                                        value={formData.attorneyPH}
                                        onChange={handleChange}
                                        placeholder="Numéro de téléphone du mandataire"
                                        className="form-control"
                                    />
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* --- 5. Payment Information --- */}
                        <CollapsibleHeader
                title="Informations de paiement"
                isOpen={isPaymentInfoOpen}
                onToggle={() => setIsPaymentInfoOpen(!isPaymentInfoOpen)}
                sectionId="payment-info"
            />
            {isPaymentInfoOpen && (
                <div id="collapse-payment-info">

            {filledByStaff ? (
                <StaffBillingNotice
                    bbCodeVersion={3}
                    exemption={exemption}
                    formData={formData}
                    setFormData={setFormData}
                    description={`Dossier patient avancé${formData.patientName ? ' - ' + formData.patientName : ''}`}
                />
            ) : (
                <>
                    <Form.Label style={{ marginTop: '5px', color: '#28a745', fontWeight: 'bold' }}>
                        Ce service coûtera ${approximateCost.toLocaleString()}.
                    </Form.Label>
                    <Form.Group className="mb-3" style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <Form.Check
                            type="radio"
                            id="payNowRadio"
                            label="  Payer maintenant?"
                            name="paymentOption"
                            checked={isPayNow}
                            onChange={() => {
                                setFormData(prev => ({
                                    ...prev,
                                    payNow: true,
                                    isExempt: false,
                                    exemptSource: null,
                                    exemptOptOut: true,
                                }));
                            }}
                            style={{ marginRight: '1rem' }}
                        />
                        <Form.Check
                            type="radio"
                            id="exemptRadio"
                            label="  Je suis exempté"
                            name="paymentOption"
                            checked={isExempt}
                            onChange={() => {
                                setFormData(prev => ({
                                    ...prev,
                                    payNow: false,
                                    isExempt: true,
                                    exemptSource: exemption.reason || 'demande',
                                    exemptOptOut: false,
                                    paymentProofPhotos: '',
                                }));
                            }}
                        />
                    </Form.Group>
                    {isExempt && (
                        <ExemptionNote exemption={exemption} formData={formData} setFormData={setFormData} />
                    )}

                    {(formData.payNow === true || formData.payNow === 'true') && approximateCost > 0 && (
                        <FleecaPaymentPanel
                            amount={approximateCost}
                            description={`Dossier patient avancé${formData.patientName ? ' - ' + formData.patientName : ''}`}
                            paymentId={formData.fleecaPaymentId}
                            onPaymentIdChange={(id) => setFormData(prev => ({ ...prev, fleecaPaymentId: id, ...(id ? {} : { paymentProofPhotos: '' }) }))}
                            onPaymentConfirmed={({ paymentLink }) => setFormData(prev => ({ ...prev, paymentProofPhotos: paymentLink }))}
                        />
                    )}
                </>
            )}
            </div>
            )}

        </>
    );
};





export default PatientAdvanced;
