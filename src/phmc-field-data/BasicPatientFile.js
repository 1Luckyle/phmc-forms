import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import './phmc-tooltips.css';
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
import { HISTORY_PRESETS } from '../constants/historyPresets';

const GENERAL_FIELDS = {
    id: 'patientID', title: 'patientTitle', full: 'patientName', first: 'patientFirstName', middle: 'patientMiddleName', last: 'patientLastName', dob: 'patientDateOfBirth',
    gender: 'patientGender', race: 'patientRace', address: 'patientAddress', phone: 'patientPH', phoneType: 'patientPhoneType', email: 'patientEmail', discord: 'patientDiscord',
};

// CollapsibleHeader copié de PatientAdvanced.js
const CollapsibleHeader = ({ title, isOpen, onToggle, sectionId }) => (
    <Button
        variant="link"
        onClick={onToggle}
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

const BasicPatientFile = ({
    formData,
    handleChange,
    patientTitleOptions,
    patientPhoneOptions,
    patientBloodType,
    setFormData,
}) => {
    usePrices(); // se redessine si un admin change les tarifs
    // État des sections repliables

        const [isGeneralInfoOpen, setIsGeneralInfoOpen] = useState(true);
        const [isContactInfoOpen, setIsContactInfoOpen] = useState(true);
        const [isMedicalHistoryOpen, setIsMedicalHistoryOpen] = useState(true);
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
        // État radio Paiement/Exempté
        const isPayNow = formData.payNow === true || formData.payNow === 'true';
        const isExempt = formData.isExempt === true || formData.isExempt === 'true';
        const calculateCost = () => {
            if (isExempt) return 0;
            return getPrice('dossierBase');
        };
        const approximateCost = calculateCost();

    return (
        <>
            <ForMyselfBanner formData={formData} setFormData={setFormData} fields={{ patientID: 'patientID', patientName: 'fullName', patientFirstName: 'firstName', patientMiddleName: 'middleName', patientLastName: 'lastName', patientDateOfBirth: 'dateOfBirth', patientGender: 'gender', patientAddress: 'address', patientPH: 'phone', patientEmail: 'email', patientDiscord: 'discord' }} />
            {/* --- 1. Informations générales --- */}
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
                        patientTitleOptions={patientTitleOptions || []} patientPhoneOptions={patientPhoneOptions} guard={minorGuard}
                    />
                </div>
            )}

            {/* --- 2. Informations de contact d'urgence --- */}
            <CollapsibleHeader
                title="Informations de contact d'urgence"
                isOpen={isContactInfoOpen}
                onToggle={() => setIsContactInfoOpen(!isContactInfoOpen)}
                sectionId="contact-info"
            />
            {isContactInfoOpen && (
                <div id="collapse-contact-info">
                    <EmergencyContactFields formData={formData} handleChange={handleChange} patientPhoneOptions={patientPhoneOptions} />
                </div>
            )}

            {/* --- 3. Historique médical --- */}
            <CollapsibleHeader
                title="Historique médical"
                isOpen={isMedicalHistoryOpen}
                onToggle={() => setIsMedicalHistoryOpen(!isMedicalHistoryOpen)}
                sectionId="medical-history"
            />
            {isMedicalHistoryOpen && (
                <div id="collapse-medical-history">
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Select
                            name="patientBloodType"
                            value={formData.patientBloodType || ""}
                            onChange={handleChange}
                            className="form-control"
                        >
                            <option value="" disabled>Groupe sanguin du patient</option>
                            {(patientBloodType || []).map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <PresetTextField name="patientAllergies" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientAllergies} placeholder="Autres allergies ou précisions" />
                        <PresetTextField name="patientCurrentMedicine" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientCurrentMedicine} placeholder="Autres médicaments, doses ou précisions" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                        <PresetTextField name="patientChronicDiseases" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientChronicDiseases} placeholder="Autres conditions chroniques ou précisions" />
                        <PresetTextField name="patientNotes" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientNotes} placeholder="Autres traumatismes, blessures ou précisions" />
                    </div>
                </div>
            )}

            {/* --- 5. Informations de paiement --- */}
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
                    bbCodeVersion={25}
                    exemption={exemption}
                    formData={formData}
                    setFormData={setFormData}
                    description={`Dossier patient de base${formData.patientName ? ' - ' + formData.patientName : ''}`}
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
                            label="  Payer maintenant ?"
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

                    {isPayNow && approximateCost > 0 && (
                        <FleecaPaymentPanel
                            amount={approximateCost}
                            description={`Dossier patient de base${formData.patientName ? ' - ' + formData.patientName : ''}`}
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
          
export default BasicPatientFile;
