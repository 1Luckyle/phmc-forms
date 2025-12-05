import React, { useState } from 'react';
import { Form, Button, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import './phmc-tooltips.css';
import ImagePreview from '../components/ImagePreview';

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
    patientBloodType,
    setFormData,
    handleImageUpload,
    isUploading,
}) => {
    // État des sections repliables

        const [isGeneralInfoOpen, setIsGeneralInfoOpen] = useState(true);
        const [isContactInfoOpen, setIsContactInfoOpen] = useState(true);
        const [isMedicalHistoryOpen, setIsMedicalHistoryOpen] = useState(true);
        const [isPaymentInfoOpen, setIsPaymentInfoOpen] = useState(true);
        const [activeSection, setActiveSection] = useState('general-info');
        // État radio Paiement/Exempté
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

    return (
        <>
            {/* --- 1. Informations générales --- */}
            <CollapsibleHeader
                title="Informations générales"
                isOpen={isGeneralInfoOpen}
                onToggle={() => setIsGeneralInfoOpen(!isGeneralInfoOpen)}
                sectionId="general-info"
            />
            {isGeneralInfoOpen && (
                <div id="collapse-general-info" onFocusCapture={() => setActiveSection('general-info')}>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Ajout de marginTop */}
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
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Ajout de marginTop */}

                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientTitle" className="phmc-tooltip">Sélectionner le titre du patient (M., Mme, etc.).</Tooltip>}
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
                                overlay={<Tooltip id="tooltip-patientDOB" className="phmc-tooltip">Date de naissance du patient.</Tooltip>}
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
                                overlay={<Tooltip id="tooltip-patientRace" className="phmc-tooltip">Ethnicité du patient.</Tooltip>}
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
                            overlay={<Tooltip id="tooltip-patientDiscord" className="phmc-tooltip">Pseudo Discord du patient (HRP).</Tooltip>}
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

            {/* --- 2. Informations de contact d'urgence --- */}
            <CollapsibleHeader
                title="Informations de contact d'urgence"
                isOpen={isContactInfoOpen}
                onToggle={() => setIsContactInfoOpen(!isContactInfoOpen)}
                sectionId="contact-info"
            />
            {isContactInfoOpen && (
                <div id="collapse-contact-info">
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-emergencyContact" className="phmc-tooltip">Entrer le nom complet du contact d'urgence (Prénom / Deuxième Prénom / Nom de famille).</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientEmergencyContact"
                                value={formData.patientEmergencyContact}
                                onChange={handleChange}
                                placeholder="Nom complet du contact d'urgence"
                                required
                                className={`form-control ${!formData.patientEmergencyContact ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-emergencyContactRelation" className="phmc-tooltip">Relation du contact d'urgence avec le patient (Ex: parent, ami, etc.).</Tooltip>}
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
                            overlay={<Tooltip id="tooltip-emergencyContactNumber" className="phmc-tooltip">Numéro de téléphone du contact d'urgence.</Tooltip>}
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
                            overlay={<Tooltip id="tooltip-emergencyContactDiscord" className="phmc-tooltip">Pseudo Discord du contact d'urgence (HRP).</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientEmergencyContactDiscord"
                                value={formData.patientEmergencyContactDiscord}
                                onChange={handleChange}
                                placeholder="(( Pseudo Discord du contact d'urgence du patient )) "
                                required
                                className={`form-control ${!formData.patientEmergencyContactDiscord ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                </div>
            )}

            {/* --- 3. Antécédents médicaux --- */}
            <CollapsibleHeader
                title="Antécédents médicaux"
                isOpen={isMedicalHistoryOpen}
                onToggle={() => setIsMedicalHistoryOpen(!isMedicalHistoryOpen)}
                sectionId="medical-history"
            />
            {isMedicalHistoryOpen && (
                <div id="collapse-medical-history">
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-bloodType" className="phmc-tooltip">Groupe sanguin du patient.</Tooltip>}
                        >
                            <Form.Select
                                name="patientBloodType"
                                value={formData.patientBloodType || ""}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.patientBloodType ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Groupe sanguin du patient</option>
                                {(patientBloodType || []).map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                        </OverlayTrigger>
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
                                placeholder="Allergies connues du patient"
                                required
                                className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-currentMedicine" className="phmc-tooltip">Médicament(s) actuellement pris par le patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientCurrentMedicine"
                                value={formData.patientCurrentMedicine}
                                onChange={handleChange}
                                placeholder="Médicaments actuels du patient"
                                required
                                className={`form-control ${!formData.patientCurrentMedicine ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-chronicDiseases" className="phmc-tooltip">Conditions chroniques du patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientChronicDiseases"
                                value={formData.patientChronicDiseases}
                                onChange={handleChange}
                                placeholder="Conditions chroniques du patient"
                                required
                                className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-traumas" className="phmc-tooltip">Traumatismes et blessures du patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientNotes"
                                value={formData.patientNotes}
                                onChange={handleChange}
                                placeholder="Traumatismes et blessures du patient"
                                required
                                className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                <div id="collapse-payment-info" onFocusCapture={() => setActiveSection('payment-info')}>

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
                         {isExempt && (
                                            <span className="helper-text">
                    Informations sur l'exemption: Les citoyens qui sont soit mineurs (moins de 18 ans), soit des citoyens de l'État à faible revenu sont exemptés du paiement de ce service.
                </span>

            )}

            {isPayNow && approximateCost > 0 && (
                <span className="helper-text">
                    Cochez cette case si vous souhaitez fournir une preuve de paiement maintenant. Redirection: <a href="https://fleeca.gta.world/login" target="_blank" rel="noopener noreferrer">020000062</a>. Veuillez vous connecter à Fleeca avant le paiement.
                </span>
            )}
                 
            {isPayNow && approximateCost > 0 && (
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
                    <span className="helper-text">
                        Télécharger la preuve de paiement. Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                    </span>
                    <ImagePreview imageUrls={formData.paymentProofPhotos} />
                </Form.Group>
            )}
            </div>
            )}
        </>
    );
};
          
export default BasicPatientFile;
