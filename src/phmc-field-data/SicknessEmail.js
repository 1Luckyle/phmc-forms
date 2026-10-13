import React, { useState, useEffect } from 'react'; // Import useState
import { getCachedSignatureUrl } from '../utils/userCreations';
import { Form, InputGroup, Button, Alert } from 'react-bootstrap';
import { prepareAttachedReport, ACCEPTED_REPORT_VERSIONS, ACCEPTED_REPORT_LABELS } from '../utils/employerSummary';
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
    handleSelectChange,
    showNotification
}) => {
    // New state to track if consent has been confirmed
    const [consentConfirmed, setConsentConfirmed] = useState(false);
    const notify = showNotification || (() => {});

    // Ma signature (créée dans Carte de visite → Signature) : préremplie si le champ est vide.
    useEffect(() => {
        const mySignature = getCachedSignatureUrl();
        if (mySignature && !formData.phmcEmployeeSignatureImage) {
            setFormData(prev => (prev.phmcEmployeeSignatureImage ? prev : { ...prev, phmcEmployeeSignatureImage: mySignature }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Le grade imprimé suit TOUJOURS le médecin sélectionné (il n'y a pas de champ grade dans ce formulaire :
    // sans cela, un grade d'un autre formulaire resté en mémoire, ex. « Medical Student », était imprimé).
    useEffect(() => {
        const doctor = phmcGroupedOptions.flatMap(group => group.options).find(option => option.value === formData.phmcEmployee);
        const rank = doctor?.rank || '';
        if ((formData.phmcRank || '') !== rank) {
            setFormData(prev => ({ ...prev, phmcRank: rank }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.phmcEmployee, formData.phmcRank, phmcGroupedOptions]);
    const applyMySignature = () => {
        const mySignature = getCachedSignatureUrl();
        if (!mySignature) {
            notify('Vous n\'avez pas encore de signature : créez-la dans la boîte à outils → Carte de visite → onglet Signature.', 'warning');
            return;
        }
        setFormData(prev => ({ ...prev, phmcEmployeeSignatureImage: mySignature }));
    };

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
        <p>Ce formulaire est utilisé pour créer des emails externes. Veuillez remplir tous les champs obligatoires avec précision. Le formulaire est ensuite enregistré dans le suivi des rapports du soignant.</p>
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
                    placeholder="Prénom (Deuxième Prénom) & Nom du patient"
                    required
                    className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>ID du patient</Form.Label>
                <Form.Control
                    type="text"
                    name="patientID"
                    value={formData.patientID || ''}
                    onChange={handleChange}
                    placeholder="ID Patient (optionnel, ex. PHMC-2752)"
                    className="form-control"
                />
                <span className="helper-text">
                    Sert à classer le certificat dans le bon dossier patient. Laissez vide si inconnu — vérifiez qu'il correspond bien à ce patient.
                </span>
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
                    placeholder="Sélectionner un médecin. (Vous pouvez taper pour rechercher!)"
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
                        placeholder="Image de signature de l'employé"
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
                    <Button variant="outline-primary" onClick={applyMySignature} title="Utiliser la signature créée dans Carte de visite → Signature">
                        <i className="fas fa-signature"></i> Ma signature
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
