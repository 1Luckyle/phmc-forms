import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
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
const [activeSection, setActiveSection] = useState('general-info');
        // Si c'est un membre du personnel PHMC/DMEC connecté qui remplit ce
        // formulaire (pas le civil lui-même), le paiement ne doit jamais être
        // demandé ici : c'est au civil de payer, pas au soignant qui remplit le
        // dossier à sa place — sinon le paiement Fleeca ne peut tout simplement
        // pas avoir lieu.
        const { currentEmployee, employeeProfile, isAdmin, isCivilian, civilianProfile } = useEmployeeAuth();
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
            <ForMyselfBanner formData={formData} setFormData={setFormData} fields={{ patientID: 'patientID', patientName: 'fullName', patientDateOfBirth: 'dateOfBirth', patientGender: 'gender', patientAddress: 'address', patientPH: 'phone', patientEmail: 'email', patientDiscord: 'discord' }} />
            {/* --- 1. General Information --- */}
            <CollapsibleHeader
                title="Informations générales"
                isOpen={isGeneralInfoOpen}
                onToggle={() => setIsGeneralInfoOpen(!isGeneralInfoOpen)}
                sectionId="general-info"
            />
            {isGeneralInfoOpen && (
                <div id="collapse-general-info" onFocusCapture={() => setActiveSection('general-info')}>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                            <Form.Control
                                type="text"
                                name="patientID"
                                value={formData.patientID}
                                onChange={handleChange}
                                placeholder="ID Patient"
                                className="form-control"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}

                                <Form.Select
                                    name="patientTitle"
                                    value={formData.patientTitle}
                                    onChange={handleChange}
                                    className="form-control"
                                >
                                    <option value="" disabled>Titre</option>
                                    {patientTitleOptions.map((option) => (
                                        <option key={option.value} value={option.value} disabled={minorGuard.isDisabled(option)}>{minorGuard.label(option)}</option>
                                    ))}
                                </Form.Select>
                                <Form.Control
                                    type="text"
                                    name="patientName"
                                    value={formData.patientName}
                                    onChange={handleChange}
                                    placeholder="Prénom & Nom du patient"
                                    className="form-control"
                                />
                                <Form.Control
                                    type="date"
                                    name="patientDateOfBirth"
                                    value={formData.patientDateOfBirth}
                                    onChange={handleChange}
                                    placeholder="Date de naissance"
                                    className="form-control"
                                />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> 
                                <Form.Control
                                    type="text"
                                    name="patientAddress"
                                    value={formData.patientAddress}
                                    onChange={handleChange}
                                    placeholder="Adresse (Numéro, Étage, Rue)"
                                    className="form-control"
                                />
                                <Form.Control
                                    type="text"
                                    name="patientGender"
                                    value={formData.patientGender}
                                    onChange={handleChange}
                                    placeholder="Genre à l'état civil du patient"
                                    className="form-control"
                                />
                                <Form.Control
                                    type="text"
                                    name="patientRace"
                                    value={formData.patientRace}
                                    onChange={handleChange}
                                    placeholder="Ethnicité du patient (optionnel)"
                                    className="form-control"
                                />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> 
                            <Form.Control
                                type="text"
                                name="patientPH"
                                value={formData.patientPH}
                                onChange={handleChange}
                                placeholder="Numéro de téléphone du patient"
                                className="form-control"
                            />
                            <Form.Control
                                type="email"
                                name="patientEmail"
                                value={formData.patientEmail}
                                onChange={handleChange}
                                placeholder="Adresse email (ex: prenomnom@mail.eyefind.fr)"
                                className="form-control"
                            />
                            <Form.Control
                                type="text"
                                name="patientDiscord"
                                value={formData.patientDiscord}
                                onChange={handleChange}
                                placeholder="(( Pseudo Discord du patient )) (optionnel)"
                                className="form-control"
                            />
                    </div>

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
                <div id="collapse-contact-info" onFocusCapture={() => setActiveSection('contact-info')}>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                            <Form.Control
                                type="text"
                                name="patientEmergencyContact"
                                value={formData.patientEmergencyContact}
                                onChange={handleChange}
                                placeholder="Prénom & Nom complet du contact d'urgence"
                                className="form-control"
                            />
                            <Form.Control
                                type="text"
                                name="patientEmergencyContactRelation"
                                value={formData.patientEmergencyContactRelation}
                                onChange={handleChange}
                                placeholder="Relation du contact d'urgence avec le patient"
                                className="form-control"
                            />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                type="text"
                                name="patientEmergencyContactNumber"
                                value={formData.patientEmergencyContactNumber}
                                onChange={handleChange}
                                placeholder="Numéro de téléphone du contact d'urgence"
                                className="form-control"
                            />
                            <Form.Control
                                type="text"
                                name="patientEmergencyContactDiscord"
                                value={formData.patientEmergencyContactDiscord}
                                onChange={handleChange}
                                placeholder="(( Discord du contact d'urgence du patient )) (optionnel)"
                                className="form-control"
                            />
                    </div>
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
                <div id="collapse-medical-history" onFocusCapture={() => setActiveSection('medical-history')}>
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
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientAllergies"
                                value={formData.patientAllergies}
                                onChange={handleChange}
                                placeholder="Allergies connues"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientCurrentMedicine"
                                value={formData.patientCurrentMedicine}
                                onChange={handleChange}
                                placeholder="Médicaments actuels"
                                className="form-control"
                            />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientChronicDiseases"
                                value={formData.patientChronicDiseases}
                                onChange={handleChange}
                                placeholder="Maladies chroniques"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientNotes"
                                value={formData.patientNotes}
                                onChange={handleChange}
                                placeholder="Traumatismes et blessures (optionnel)"
                                className="form-control"
                            />
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
                <div id="collapse-mental-health" onFocusCapture={() => setActiveSection('mental-health')}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientMental"
                                value={formData.patientMental}
                                onChange={handleChange}
                                placeholder="Troubles de santé mentale diagnostiqués (optionnel)"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientTherapy"
                                value={formData.patientTherapy}
                                onChange={handleChange}
                                placeholder="Thérapies et séances de conseil (optionnel)"
                                className="form-control"
                            />
                            
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientTriggers"
                                value={formData.patientTriggers}
                                onChange={handleChange}
                                placeholder="Déclencheurs ou phobies sensoriels (optionnel)"
                                className="form-control"
                            />
                            

                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientSupport"
                                value={formData.patientSupport}
                                onChange={handleChange}
                                placeholder="Soutien et mécanismes d'adaptation personnels (optionnel)"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientHarm"
                                value={formData.patientHarm}
                                onChange={handleChange}
                                placeholder="Automutilation / tentatives ou danger pour autrui (optionnel)"
                                className="form-control"
                            />
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
                <div id="collapse-family-health" onFocusCapture={() => setActiveSection('family-history')}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientFam"
                                value={formData.patientFam}
                                onChange={handleChange}
                                placeholder="Membres de la famille immédiate (optionnel)"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientGenetic"
                                value={formData.patientGenetic}
                                onChange={handleChange}
                                placeholder="Maladies génétiques connues (optionnel)"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientFamSocial"
                                value={formData.patientFamSocial}
                                onChange={handleChange}
                                placeholder="Antécédents sociaux familiaux (optionnel)"
                                className="form-control"
                            />
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
                <div id="collapse-social-information" onFocusCapture={() => setActiveSection('social-information')}>
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
                                <Form.Control
                                    as="textarea"
                                    rows="2"
                                    name="patientReligion"
                                    value={formData.patientReligion}
                                    onChange={handleChange}
                                    placeholder="Considérations culturelles et/ou religieuses (optionnel)"
                                    className="form-control"
                                />
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
                <div id="collapse-Lifestyle-Information" onFocusCapture={() => setActiveSection('Lifestyle-Information')}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientSmoker"
                                value={formData.patientSmoker}
                                onChange={handleChange}
                                placeholder="Habitudes de tabagisme (optionnel)"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientAlcohol"
                                value={formData.patientAlcohol}
                                onChange={handleChange}
                                placeholder="Consommation d'alcool (optionnel)"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientDrugs"
                                value={formData.patientDrugs}
                                onChange={handleChange}
                                placeholder="Consommation de drogue ou de substances (optionnel)"
                                className="form-control"
                            />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientExercise"
                                value={formData.patientExercise}
                                onChange={handleChange}
                                placeholder="Habitudes d'exercice (optionnel)"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientDiet"
                                value={formData.patientDiet}
                                onChange={handleChange}
                                placeholder="Habitudes alimentaires (optionnel)"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientSleep"
                                value={formData.patientSleep}
                                onChange={handleChange}
                                placeholder="Habitudes de sommeil (optionnel)"
                                className="form-control"
                            />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientSexLife"
                                value={formData.patientSexLife}
                                onChange={handleChange}
                                placeholder="Santé sexuelle (optionnel)"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientJobRisks"
                                value={formData.patientJobRisks}
                                onChange={handleChange}
                                placeholder="Risques ou dangers professionnels (optionnel)"
                                className="form-control"
                            />
                            <Form.Control
                                as="textarea"
                                rows="2"
                                name="patientHazards"
                                value={formData.patientHazards}
                                onChange={handleChange}
                                placeholder="Dangers environnementaux ou expositions (optionnel)"
                                className="form-control"
                            />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            as="textarea"
                            rows="2"
                            name="patientOther"
                            value={formData.patientOther}
                            onChange={handleChange}
                            placeholder="Autres informations (optionnel)"
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
                <div id="collapse-advanced-directives" onFocusCapture={() => setActiveSection('advanced-directives')}>
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
                                    <Form.Control
                                        type="text"
                                        name="attorneyName"
                                        value={formData.attorneyName}
                                        onChange={handleChange}
                                        placeholder="Prénom & Nom du mandataire"
                                        className="form-control"
                                    />
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
                <div id="collapse-payment-info" onFocusCapture={() => setActiveSection('payment-info')}>

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
