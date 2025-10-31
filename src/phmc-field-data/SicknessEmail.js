import React, { useState } from 'react'; // Import useState
import { Form, InputGroup, Button } from 'react-bootstrap';
import Select from 'react-select';
import ImagePreview from '../components/ImagePreview';

const SicknessEmail = ({
    formData,
    handleChange,
    setFormData,
    phmcGroupedOptions,
    handleImageUpload,
    isUploading,
    onAttachReportSummaryRequest, 
    handleSelectChange
}) => {
    // New state to track if consent has been confirmed
    const [consentConfirmed, setConsentConfirmed] = useState(false);

    return (
        <>
            <Form.Group className="mb-3">
                <Form.Label>Objet de l'email</Form.Label>
                <Form.Select
                    name="emailPurpose"
                    value={formData.emailPurpose}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.emailPurpose ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Sélectionner le type d'email</option>
                    <option value="Sickness Note">Certificat de maladie</option>
                    <option value="Illness Confirmation">Confirmation de maladie</option>
                </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Nom du destinataire</Form.Label>
                <Form.Control
                    type="text"
                    name="emailRecipient"
                    value={formData.emailRecipient}
                    onChange={handleChange}
                    placeholder="ex: Employeur, École, Individu"
                    required
                    className={`form-control ${!formData.emailRecipient ? 'is-invalid' : ''}`}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Nom du patient</Form.Label>
                <Form.Control
                    type="text"
                    name="patientName"
                    value={formData.patientName}
                    onChange={handleChange}
                    placeholder="Nom complet du patient"
                    required
                    className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Date de consultation du patient au PHMC</Form.Label>
                <Form.Control
                    type="date"
                    name="dateOfVisit"
                    value={formData.dateOfVisit}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.dateOfVisit ? 'is-invalid' : ''}`}
                />
            </Form.Group>

            {formData.emailPurpose === 'Sickness Note' && (
                <>
                    <Form.Group className="mb-3">
                        <Form.Label>Date de début de la maladie</Form.Label>
                        <Form.Control
                            type="date"
                            name="sicknessStartDate"
                            value={formData.sicknessStartDate}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.sicknessStartDate ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Date de fin de la maladie</Form.Label>
                        <Form.Control
                            type="date"
                            name="sicknessEndDate"
                            value={formData.sicknessEndDate}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.sicknessEndDate ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Raison de la maladie (Bref)</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            name="reasonForSickness"
                            value={formData.reasonForSickness}
                            onChange={handleChange}
                            placeholder="ex: Grippe, rhume, blessure mineure"
                            required
                            className={`form-control ${!formData.reasonForSickness ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                </>
            )}

            {formData.emailPurpose === 'Illness Confirmation' && (
                <>
                    <Form.Group className="mb-3">
                        <Form.Label>Maladie/Condition diagnostiquée</Form.Label>
                        <Form.Control
                            type="text"
                            name="illnessCondition"
                            value={formData.illnessCondition}
                            onChange={handleChange}
                            placeholder="ex: Angine streptococcique, Bras fracturé, Trouble anxieux"
                            required
                            className={`form-control ${!formData.illnessCondition ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Objet de la confirmation</Form.Label>
                        <Form.Control
                            type="text"
                            name="confirmationPurpose"
                            value={formData.confirmationPurpose}
                            onChange={handleChange}
                            placeholder="ex: Pour dossiers d'emploi, présence scolaire, réclamation d'assurance"
                            required
                            className={`form-control ${!formData.confirmationPurpose ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                </>
            )}

            {/* NEW: Attach Report Summary Section with Consent Confirmation */}
            <Form.Group className="mb-3">
                <Form.Label>Résumé de rapport joint (du protocole ER ou notes de consultation)</Form.Label>
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        rows={6}
                        name="attachedReportSummary"
                        value={formData.attachedReportSummary || ''}
                        onChange={handleChange}
                        placeholder={
                            consentConfirmed
                                ? "Le résumé BBCode d'un rapport joint apparaîtra ici."
                                : "Cliquez sur 'Confirmer le consentement' pour activer la pièce jointe de rapports. VOUS DEVEZ OBTENIR LE CONSENTEMENT DU PATIENT AVANT DE JOINDRE UN RAPPORT!!! GROSSE VIOLATION HIPAA SI AUCUNE APPROBATION ET VOUS INCLUEZ DES INFORMATIONS MÉDICALES IMPORTANTES"
                        }
                        readOnly={!consentConfirmed} // Make textarea read-only until consent is confirmed
                    />
                    {!consentConfirmed ? (
                        <Button
                            variant="warning" // Use a warning color to draw attention
                            onClick={() => setConsentConfirmed(true)}
                        >
                            <i className="fas fa-check-circle"></i> Confirmer le consentement
                        </Button>
                    ) : (
                        <Button
                            variant="info"
                            onClick={() => onAttachReportSummaryRequest((reportData) => {
                                // This callback is executed when a report is selected in the modal
                                // reportData will contain bbCode, data, originalKey, etc.
                                setFormData(prev => ({
                                    ...prev,
                                    attachedReportSummary: reportData.bbCode // Populate with the full BBCode
                                }));
                            })}
                        >
                            <i className="fas fa-paperclip"></i> Joindre un rapport
                        </Button>
                    )}
                </InputGroup>
                <span className="helper-text">
                    D'abord, confirmez que vous avez le consentement du patient. Ensuite, cliquez sur "Joindre un rapport" pour sélectionner un rapport de protocole ER ou de notes de consultation sauvegardé. Son BBCode sera inséré ici.
                </span>
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Employé PHMC envoyant l'email</Form.Label>
                <Select
                    name="phmcEmployee"
                    value={phmcGroupedOptions
                        .flatMap(group => group.options)
                        .find(option => option.value === formData.phmcEmployee) || null}
                    onChange={(selectedOption, actionMeta) => { // <--- MODIFIED onChange
                        handleSelectChange(selectedOption, actionMeta); 
                    }}
                    options={phmcGroupedOptions}
                    isClearable
                    placeholder="Rechercher ou sélectionner un employé PHMC..."
                    className={`form-control ${!formData.phmcEmployee ? 'is-invalid' : ''}`}
                    styles={{
                        control: (base) => ({
                            ...base,
                            backgroundColor: '#16202c',
                            color: '#eeeeeeb0',
                            borderColor: '#30363d',
                            '&:hover': { borderColor: '#30363d' }
                        }),
                        menu: (base) => ({
                            ...base,
                            backgroundColor: '#16202c',
                            zIndex: 1000
                        }),
                        option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isFocused ? 'Grey' : '#16202c',
                            color: '#eeeeeeb0'
                        }),
                        singleValue: (base) => ({
                            ...base,
                            color: '#eeeeeeb0'
                        }),
                        input: (base) => ({
                            ...base,
                            color: '#eeeeeeb0'
                        }),
                        placeholder: (base) => ({
                            ...base,
                            color: '#eeeeeeb0'
                        })
                    }}
                />
            </Form.Group>

            <Form.Group className="mb-3 upload-container">
                <Form.Label>Image de signature de l'employé (Optionnel)</Form.Label>
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        rows={2}
                        name="phmcEmployeeSignatureImage"
                        value={formData.phmcEmployeeSignatureImage || ''}
                        onChange={handleChange}
                        placeholder="Coller l'URL de l'image ou télécharger"
                        className="form-control"
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
                                    handleImageUpload({ target: { files: [file] } }, 'phmcEmployeeSignatureImage');
                                    e.preventDefault();
                                    break;
                                }
                            }
                            if (containsUrl && !hasImageItem) {
                                const currentValue = formData.phmcEmployeeSignatureImage || '';
                                const cursorPos = e.target.selectionStart;
                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                const newValue = currentValue.slice(0, cursorPos) +
                                    (cursorPos > 0 ? separator : '') +
                                    pastedData +
                                    currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, phmcEmployeeSignatureImage: newValue }));
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
                            input.multiple = false;
                            input.onchange = (e) => handleImageUpload(e, 'phmcEmployeeSignatureImage');
                            input.click();
                        }}
                    >
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                        {isUploading ? ' Téléchargement...' : ' Télécharger image'}
                    </Button>
                </InputGroup>
                <ImagePreview imageUrls={formData.phmcEmployeeSignatureImage} />
                <span className="helper-text">
                    Télécharger votre image de signature. Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                </span>
            </Form.Group>
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

export default SicknessEmail;
