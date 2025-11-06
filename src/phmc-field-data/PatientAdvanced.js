import React, { useState } from 'react';
import { Form, Button, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Select from 'react-select';
import './phmc-tooltips.css'; // Assuming you have a tooltip component
import ImagePreview from '../components/ImagePreview';
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
    handleImageUpload,
    isUploading,
    setFormData,
    patientTitleOptions,
    patientBloodType,
    maritalStatus,
    numberChildren,
    financialStatus,
    selectOptions
}) => {
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
        const isPayNow = formData.payNow === true || formData.payNow === 'true';
        const isExempt = formData.isExempt === true || formData.isExempt === 'true';
        const calculateCost = () => {
            if (isExempt) return 0;
            if (formData.UpdateMedicalFile && formData.UpdateMedicalFile.length > 0) {
                return 2000;
            }
            return 2000;
        };
        const approximateCost = calculateCost();


    const dnrOptions = toOptions(selectOptions.dnr || []);
    const attorneyOptions = toOptions(selectOptions.attorney || []);
    const dnrOrderOptions = toOptions(selectOptions.dnrOrder || []);

    return (
        



        <>
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
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientID" className="phmc-tooltip">Identifiant unique du patient. Laisser vide si inconnu.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientID"
                                value={formData.patientID}
                                onChange={handleChange}
                                placeholder="ID Patient (Optionnel, laisser vide si incertain)"
                                className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}

                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientTitle" className="phmc-tooltip">Sélectionner le titre du patient (M., Mme, etc).</Tooltip>}
                            >
                                <Form.Select
                                    name="patientTitle"
                                    value={formData.patientTitle}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Titre</option>
                                    {patientTitleOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                            </OverlayTrigger>
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientName" className="phmc-tooltip">Entrer le nom complet du patient (Prénom / Deuxième Prénom / Nom de famille).</Tooltip>}
                            >
                                <Form.Control
                                    type="text"
                                    name="patientName"
                                    value={formData.patientName}
                                    onChange={handleChange}
                                    placeholder="Prénom & Nom du patient"
                                    required
                                    className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientDateOfBirth" className="phmc-tooltip">Date de naissance du patient.</Tooltip>}
                            >
                                <Form.Control
                                    type="date"
                                    name="patientDateOfBirth"
                                    value={formData.patientDateOfBirth}
                                    onChange={handleChange}
                                    placeholder="Date de naissance"
                                    required
                                    className={`form-control ${!formData.patientDateOfBirth ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> 
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientAddress" className="phmc-tooltip">Adresse du domicile du patient.</Tooltip>}
                            >
                                <Form.Control
                                    type="text"
                                    name="patientAddress"
                                    value={formData.patientAddress}
                                    onChange={handleChange}
                                    placeholder="Adresse (Numéro, Étage, Rue)"
                                    required
                                    className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientGender" className="phmc-tooltip">Genre à l'état civil du patient (Masculin / Féminin).</Tooltip>}
                            >
                                <Form.Control
                                    type="text"
                                    name="patientGender"
                                    value={formData.patientGender}
                                    onChange={handleChange}
                                    placeholder="Genre à l'état civil du patient"
                                    required
                                    className={`form-control ${!formData.patientGender ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientRace" className="phmc-tooltip">Ethnicité du patient</Tooltip>}
                            >
                                <Form.Control
                                    type="text"
                                    name="patientRace"
                                    value={formData.patientRace}
                                    onChange={handleChange}
                                    placeholder="Ethnicité du patient"
                                    required
                                    className={`form-control ${!formData.patientRace ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> 
                        <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientPH" className="phmc-tooltip">Numéro de téléphone du patient.</Tooltip>}
                            >
                            <Form.Control
                                type="text"
                                name="patientPH"
                                value={formData.patientPH}
                                onChange={handleChange}
                                placeholder="Numéro de téléphone du patient"
                                required
                                className={`form-control ${!formData.patientPH ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientDiscord" className="phmc-tooltip">(( Pseudo Discord du patient (HRP). )) </Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientDiscord"
                                value={formData.patientDiscord}
                                onChange={handleChange}
                                placeholder="(( Pseudo Discord du patient )) "
                                required
                                className={`form-control ${!formData.patientDiscord ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientEmergencyContact" className="phmc-tooltip">Entrer le nom complet du contact d'urgence (Prénom / Deuxième Prénom / Nom de famille).</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientEmergencyContact"
                                value={formData.patientEmergencyContact}
                                onChange={handleChange}
                                placeholder="Prénom & Nom complet du contact d'urgence"
                                required
                                className={`form-control ${!formData.patientEmergencyContact ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientEmergencyContactRelation" className="phmc-tooltip">Relation du contact d'urgence avec le patient (Ex: parent, ami, etc.).</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientEmergencyContactRelation"
                                value={formData.patientEmergencyContactRelation}
                                onChange={handleChange}
                                placeholder="Relation du contact d'urgence avec le patient"
                                required
                                className={`form-control ${!formData.patientEmergencyContactRelation ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientEmergencyContactNumber" className="phmc-tooltip">Numéro de téléphone du contact d'urgence.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientEmergencyContactNumber"
                                value={formData.patientEmergencyContactNumber}
                                onChange={handleChange}
                                placeholder="Numéro de téléphone du contact d'urgence"
                                required
                                className={`form-control ${!formData.patientEmergencyContactNumber ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientEmergencyContactDiscord" className="phmc-tooltip">(( Pseudo Discord du contact d'urgence (HRP). )) </Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientEmergencyContactDiscord"
                                value={formData.patientEmergencyContactDiscord}
                                onChange={handleChange}
                                placeholder="(( Discord du contact d'urgence du patient )) "
                                required
                                className={`form-control ${!formData.patientEmergencyContactDiscord ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                            required
                            className={`form-control ${!formData.patientBloodType ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Groupe sanguin</option>
                            {patientBloodType.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-allergies" className="phmc-tooltip">Allergies connues du patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientAllergies"
                                value={formData.patientAllergies}
                                onChange={handleChange}
                                placeholder="Allergies connues"
                                required
                                className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientCurrentMedicine" className="phmc-tooltip">Médicament(s) actuellement pris par le patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientCurrentMedicine"
                                value={formData.patientCurrentMedicine}
                                onChange={handleChange}
                                placeholder="Médicaments actuels"
                                required
                                className={`form-control ${!formData.patientCurrentMedicine ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientChronicDiseases" className="phmc-tooltip">Maladies chroniques du patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientChronicDiseases"
                                value={formData.patientChronicDiseases}
                                onChange={handleChange}
                                placeholder="Maladies chroniques"
                                required
                                className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientNotes" className="phmc-tooltip">Traumatismes et blessures du patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientNotes"
                                value={formData.patientNotes}
                                onChange={handleChange}
                                placeholder="Traumatismes et blessures"
                                required
                                className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                            <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientMental" className="phmc-tooltip">Historique des troubles de santé mentale diagnostiqués du patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientMental"
                                value={formData.patientMental}
                                onChange={handleChange}
                                placeholder="Troubles de santé mentale diagnostiqués"
                                required
                                className={`form-control ${!formData.patientMental ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientTherapy" className="phmc-tooltip">Historique de thérapie du patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientTherapy"
                                value={formData.patientTherapy}
                                onChange={handleChange}
                                placeholder="Thérapies et séances de conseil"
                                required
                                className={`form-control ${!formData.patientTherapy ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                            <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientTriggers" className="phmc-tooltip">Déclencheurs ou phobies sensoriels du patient.</Tooltip>}
                        >
                            
                            <Form.Control
                                type="text"
                                name="patientTriggers"
                                value={formData.patientTriggers}
                                onChange={handleChange}
                                placeholder="Déclencheurs ou phobies sensoriels"
                                required
                                className={`form-control ${!formData.patientTriggers ? 'is-invalid' : ''}`}
                            />
                            
                        </OverlayTrigger>

                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientSupport" className="phmc-tooltip">Historique du soutien et des mécanismes d'adaptation personnels du patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientSupport"
                                value={formData.patientSupport}
                                onChange={handleChange}
                                placeholder="Soutien et mécanismes d'adaptation personnels"
                                required
                                className={`form-control ${!formData.patientSupport ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                            <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientHarm" className="phmc-tooltip">Historique d'automutilation du patient / tentatives ou danger pour autrui.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientHarm"
                                value={formData.patientHarm}
                                onChange={handleChange}
                                placeholder="Automutilation / tentatives ou danger pour autrui"
                                required
                                className={`form-control ${!formData.patientHarm ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientFam" className="phmc-tooltip">Historique des membres de la famille immédiate.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientFam"
                                value={formData.patientFam}
                                onChange={handleChange}
                                placeholder="Membres de la famille immédiate"
                                required
                                className={`form-control ${!formData.patientFam ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientGenetic" className="phmc-tooltip">Historique des conditions génétiques familiales (ex: conditions chroniques, troubles génétiques).</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientGenetic"
                                value={formData.patientGenetic}
                                onChange={handleChange}
                                placeholder="Maladies génétiques connues"
                                required
                                className={`form-control ${!formData.patientFamSocial ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientFamSocial" className="phmc-tooltip">Historique social familial (ex: dynamique familiale, antécédents de santé mentale, tabagisme, consommation d'alcool, etc).</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientFamSocial"
                                value={formData.patientFamSocial}
                                onChange={handleChange}
                                placeholder="Antécédents sociaux familiaux"
                                required
                                className={`form-control ${!formData.patientFamSocial ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                            required
                            className={`form-control ${!formData.maritalStatus ? 'is-invalid' : ''}`}
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
                            required
                            className={`form-control ${!formData.numberChildren ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Nombre d'enfants</option>
                            {numberChildren.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientReligion" className="phmc-tooltip">Considérations culturelles et/ou religieuses.</Tooltip>}>
                                <Form.Control
                                    type="text"
                                    name="patientReligion"
                                    value={formData.patientReligion}
                                    onChange={handleChange}
                                    placeholder="Considérations culturelles et/ou religieuses"
                                    required
                                    className={`form-control ${!formData.patientReligion ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-financialStatus" className="phmc-tooltip">Situation financière.</Tooltip>}>
                                <Form.Select
                                    name="financialStatus"
                                    value={formData.financialStatus || ""}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.financialStatus ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Situation financière</option>
                                    {financialStatus.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                            </OverlayTrigger>
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
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientSmoker" className="phmc-tooltip">Statut tabagique du patient.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientSmoker"
                                value={formData.patientSmoker}
                                onChange={handleChange}
                                placeholder="Habitudes de tabagisme"
                                required
                                className={`form-control ${!formData.patientSmoker ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientAlcohol" className="phmc-tooltip">=Statut de la consommation d'alcool du patient.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientAlcohol"
                                value={formData.patientAlcohol}
                                onChange={handleChange}
                                placeholder="Consommation d'alcool"
                                required
                                className={`form-control ${!formData.patientAlcohol ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientDrugs" className="phmc-tooltip">Consommation de drogue ou de substances du patient.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientDrugs"
                                value={formData.patientDrugs}
                                onChange={handleChange}
                                placeholder="Consommation de drogue ou de substances"
                                required
                                className={`form-control ${!formData.patientDrugs ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientExercise" className="phmc-tooltip">Habitudes d'exercice du patient.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientExercise"
                                value={formData.patientExercise}
                                onChange={handleChange}
                                placeholder="Habitudes d'exercice"
                                required
                                className={`form-control ${!formData.patientExercise ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientDiet" className="phmc-tooltip">Habitudes alimentaires du patient.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientDiet"
                                value={formData.patientDiet}
                                onChange={handleChange}
                                placeholder="Habitudes alimentaires"
                                required
                                className={`form-control ${!formData.patientDiet ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientSleep" className="phmc-tooltip">Habitudes de sommeil du patient.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientSleep"
                                value={formData.patientSleep}
                                onChange={handleChange}
                                placeholder="Habitudes de sommeil"
                                required
                                className={`form-control ${!formData.patientSleep ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientSexLife" className="phmc-tooltip">Santé sexuelle du patient (ex: activité, grossesse, IST).</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientSexLife"
                                value={formData.patientSexLife}
                                onChange={handleChange}
                                placeholder="Santé sexuelle"
                                required
                                className={`form-control ${!formData.patientSexLife ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientJobRisks" className="phmc-tooltip">Risques ou dangers professionnels du patient.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientJobRisks"
                                value={formData.patientJobRisks}
                                onChange={handleChange}
                                placeholder="Risques ou dangers professionnels"
                                required
                                className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientHazards" className="phmc-tooltip">Dangers environnementaux ou expositions pour le patient.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientHazards"
                                value={formData.patientHazards}
                                onChange={handleChange}
                                placeholder="Dangers environnementaux ou expositions"
                                required
                                className={`form-control ${!formData.patientHazards ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                    <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientOther" className="phmc-tooltip">Autres informations.</Tooltip>}>
                        <Form.Control
                            type="text"
                            name="patientOther"
                            value={formData.patientOther}
                            onChange={handleChange}
                            placeholder="Autres informations"
                            required
                            className={`form-control ${!formData.patientOther ? 'is-invalid' : ''}`}
                        />
                    </OverlayTrigger>
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
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-dnr" className="phmc-tooltip">Sélectionner la préférence de testament de vie / Non-réanimation.</Tooltip>}>
                            <Form.Select
                                name="dnr"
                                value={formData.dnr}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.dnr ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Testament de vie</option>
                                {dnrOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-attorney" className="phmc-tooltip">Sélectionner la procuration pour soins de santé.</Tooltip>}>
                            <Form.Select
                                name="attorney"
                                value={formData.attorney}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.attorney ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Procuration pour soins de santé</option>
                                {attorneyOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-dnrOrder" className="phmc-tooltip">Sélectionner l'ordre de non-réanimation.</Tooltip>}>
                            <Form.Select
                                name="dnrOrder"
                                value={formData.dnrOrder}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.dnrOrder ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Ordre de non-réanimation </option>
                                {dnrOrderOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {formData.dnr === 'other' && (
                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-dnrOther" className="phmc-tooltip">Spécifier d'autres instructions de testament de vie.</Tooltip>}>
                                <Form.Control
                                    type="text"
                                    name="dnrOther"
                                    value={formData.dnrOther}
                                    onChange={handleChange}
                                    placeholder="Autres instructions de testament de vie"
                                    required
                                    className="form-control"
                                />
                            </OverlayTrigger>
                        )}

                        {formData.attorney === 'Yes' && (
                            <>
                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-attorneyName" className="phmc-tooltip">Entrer le nom complet du mandataire (Prénom / Deuxième Prénom / Nom de famille).</Tooltip>}>
                                    <Form.Control
                                        type="text"
                                        name="attorneyName"
                                        value={formData.attorneyName}
                                        onChange={handleChange}
                                        placeholder="Prénom & Nom du mandataire"
                                        required
                                        className="form-control"
                                    />
                                </OverlayTrigger>
                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-attorneyRelation" className="phmc-tooltip">Relation du mandataire avec le patient (Ex: parent, ami, etc.).</Tooltip>}>
                                    <Form.Control
                                        type="text"
                                        name="attorneyRelation"
                                        value={formData.attorneyRelation}
                                        onChange={handleChange}
                                        placeholder="Relation du mandataire"
                                        required
                                        className={`form-control ${!formData.attorneyRelation ? 'is-invalid' : ''}`}
                                    />
                                </OverlayTrigger>
                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-attorneyPH" className="phmc-tooltip">Numéro de téléphone du mandataire.</Tooltip>}>
                                    <Form.Control
                                        type="text"
                                        name="attorneyPH"
                                        value={formData.attorneyPH}
                                        onChange={handleChange}
                                        placeholder="Numéro de téléphone du mandataire"
                                        required
                                        className="form-control"
                                    />
                                </OverlayTrigger>
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
                            paymentProofPhotos: '',
                        }));
                    }}
                />
            </Form.Group>
            {isPayNow && approximateCost > 0 && (
                <span className="helper-text">
                    Cochez cette case si vous souhaitez fournir une preuve de paiement maintenant. Redirection: <a href="https://banking.gta.world/transfer" target="_blank" rel="noopener noreferrer">020000062</a>. Veuillez vous connecter à Fleeca avant le paiement.
                </span>
            )}
                         {isExempt && (
                                            <span className="helper-text">
                    Informations sur l'exemption: Les citoyens qui sont soit mineurs (moins de 18 ans), soit des citoyens de l'État à faible revenu sont exemptés du paiement de ce service.
                </span>

            )}
    
            {(formData.payNow === true || formData.payNow === 'true') && approximateCost > 0 && (
                <Form.Group className="mb-3 upload-container">
                    <Form.Label>Téléchargement de l'image de preuve de paiement</Form.Label>
                    <InputGroup>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            name="paymentProofPhotos"
                            value={formData.paymentProofPhotos || ''}
                            onChange={handleChange}
                            placeholder="Coller l'URL de l'image ou télécharger"
                            required
                            className={`form-control ${!formData.paymentProofPhotos ? 'is-invalid' : ''}`}
                            onPaste={(e) => {
                                const clipboardData = e.clipboardData || window.clipboardData;
                                const pastedData = clipboardData.getData('text');
                                const items = clipboardData.items;
                                let hasImageItem = false;
                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                const containsUrl = urlRegex.test(pastedData);

                                for (let i = 0; i < items.length; i++) {
                                    if (items[i].type.indexOf('image') !== -1) {
                                        hasImageItem = true;
                                        const file = items[i].getAsFile();
                                        handleImageUpload({ target: { files: [file] } }, 'paymentProofPhotos');
                                        e.preventDefault();
                                        break;
                                    }
                                }
                                if (containsUrl && !hasImageItem) {
                                    const currentValue = formData.paymentProofPhotos || '';
                                    const cursorPos = e.target.selectionStart;
                                    const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                    const newValue = currentValue.slice(0, cursorPos) +
                                        (cursorPos > 0 ? separator : '') +
                                        pastedData +
                                        currentValue.slice(cursorPos);
                                    setFormData(prev => ({ ...prev, paymentProofPhotos: newValue }));
                                    e.preventDefault();
                                }
                            }}
                        />
                        <Button
                            variant="success"
                            disabled={isUploading}
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.multiple = true;
                                input.onchange = (e) => handleImageUpload(e, 'paymentProofPhotos');
                                input.click();
                            }}
                        >
                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                            {isUploading ? ' Téléchargement...' : ' Télécharger image(s)'}
                        </Button>
                    </InputGroup>
                    <ImagePreview imageUrls={formData.paymentProofPhotos} />
                    <span className="helper-text">
                        Télécharger la preuve de paiement. Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                    </span>
                </Form.Group>
            )}
            </div>
            )}

        </>
    );
};





export default PatientAdvanced;
