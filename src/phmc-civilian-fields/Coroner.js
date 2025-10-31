// src/phmc-civilian-fields/Coroner.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Button, InputGroup, Spinner } from 'react-bootstrap'; // Added InputGroup and Spinner

// Helper component for collapsible section headers
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


const CoronerFields = ({
    formData,
    handleChange,
    setFormData, 
    selectOptions,
    handleImageUpload, // Added prop
    isUploading        // Added prop
}) => {
    const positionDetails = selectOptions?.coronerPositionDetailsData || {};
    const [isOocInfoOpen, setIsOocInfoOpen] = useState(true);

    const [openSections, setOpenSections] = useState({
        personalInfo: true,
        educationalInfo: true,
        employmentInfo: true,
        motivationalLetter: true,
        oocInfo: true,
    });

    const prevCompletionStatusOnBlurRef = useRef({});

     useEffect(() => {
        const sections = Object.keys(openSections);
        sections.forEach(sectionId => {
            if (prevCompletionStatusOnBlurRef.current[sectionId] === undefined) {
                prevCompletionStatusOnBlurRef.current[sectionId] = false;
            }
        });
    }, [openSections]); 


    const checkFieldsCompletion = useCallback((fieldsToCheck) => {
        for (const field of fieldsToCheck) {
            if (typeof field === 'string') {
                const value = formData[field];
                if (typeof value === 'string' && !value.trim()) return false;
                if (typeof value === 'boolean' && !value) return false; 
                if (value === undefined || value === null) return false;
            } else if (typeof field === 'object' && field.anyOf) { 
                if (!field.anyOf.some(subField => formData[subField])) return false;
            } else if (typeof field === 'object' && field.conditional) { 
                if (formData[field.conditional.if.field] === field.conditional.if.value) {
                    const conditionalValue = formData[field.conditional.then.field];
                    if (typeof conditionalValue === 'string' && !conditionalValue.trim()) return false;
                    if (conditionalValue === undefined || conditionalValue === null) return false;
                }
            }
        }
        return true;
    }, [formData]);

    const sectionRequiredFields = {
        personalInfo: [
            'recruitmentPosition', 'applicantTitleAndFullName',
            { anyOf: ['genderMale', 'genderFemale', 'genderOther'] },
            { conditional: { if: { field: 'genderOther', value: true }, then: { field: 'applicantGenderOtherText' } } },
            'applicantDOBAndPlace', 'applicantAddress', 'applicantContactDetails', 'applicantMedicalConditions',
            { anyOf: ['citizenUS', 'citizenPermanent', 'citizenNone'] }
        ],
        educationalInfo: [
            { anyOf: ['eduHighSchool', 'eduCertificate', 'eduDiploma', 'eduAssociate', 'eduBachelor', 'eduMaster', 'eduDoctorate'] },
            'applicantSchoolName', 'applicantEnrollmentTerm', 'applicantMajor', 'applicantLanguages'
        ],
        employmentInfo: [
            'applicantPrevEmployment', 'applicantPrevDuties', 
        ],
        motivationalLetter: ['applicantMotivationLetter'],
        oocInfo: [
            'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone',
            'oocMedicalExperience', 'oocAdminRecordLink', 'oocStatsLink', 'charBackground'
        ]
    };

    const handleSectionFieldBlur = useCallback((sectionId, isOpenState, setIsOpenFunction, requiredFieldsKey) => {
        const isNowComplete = checkFieldsCompletion(sectionRequiredFields[requiredFieldsKey]);
        const wasCompleteAtLastBlur = prevCompletionStatusOnBlurRef.current[sectionId] === true;

        if (isOpenState && isNowComplete && !wasCompleteAtLastBlur) {
            setIsOpenFunction(false); 
        }
        prevCompletionStatusOnBlurRef.current[sectionId] = isNowComplete; 
    }, [checkFieldsCompletion, sectionRequiredFields]);


    const toggleSection = (sectionName) => {
        setOpenSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));
    };

    return (
        <>
            {/* --- 1. Personal Information --- */}
            <CollapsibleHeader
                title="1. Informations personnelles"
                isOpen={openSections.personalInfo}
                onToggle={() => toggleSection('personalInfo')}
                sectionId="coroner-personal-info"
            />
            {openSections.personalInfo && (
                <div id="collapse-coroner-personal-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>1.0 Poste pour lequel vous postulez</Form.Label>
                        <Form.Select
                            name="recruitmentPosition"
                            value={formData.recruitmentPosition || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            required
                            className={`form-control ${!formData.recruitmentPosition ? 'is-invalid' : ''} mb-4`}
                        >
                            <option value="">Sélectionner un poste de coroner...</option>
                            {Object.entries(positionDetails).map(([key, position]) => (
                                <option
                                    key={key}
                                    value={key}
                                    style={position.status === "CLOSED" ? { color: 'red', fontWeight: 'bold' } : {}}
                                    disabled={position.status === "CLOSED"}
                                >
                                    {position.displayName}{position.status === "CLOSED" ? " (Candidatures fermées)" : ""}
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.1 Titre et nom complet</Form.Label>
                        <Form.Control
                            type="text"
                            name="applicantTitleAndFullName"
                            value={formData.applicantTitleAndFullName || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            placeholder="ex: Dr. John Smith, Mme Jane Doe"
                            required
                            className={`form-control ${!formData.applicantTitleAndFullName ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-1">
                        <Form.Label>1.2 Genre</Form.Label>
                        <div
                            style={{ display: 'flex', gap: '1rem' }}
                            className="mb-4"
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                        >
                            <Form.Check
                                inline type="checkbox" label="Homme" name="genderMale"
                                checked={formData.genderMale || false} onChange={handleChange}
                            />
                            <Form.Check
                                inline type="checkbox" label="Femme" name="genderFemale"
                                checked={formData.genderFemale || false} onChange={handleChange}
                            />
                            <Form.Check
                                inline type="checkbox" label="Autre" name="genderOther"
                                checked={formData.genderOther || false} onChange={handleChange}
                            />
                        </div>
                        {formData.genderOther && (
                            <Form.Control
                                type="text" name="applicantGenderOtherText" value={formData.applicantGenderOtherText || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                                placeholder="Préciser autre genre"
                                className={`mt-2 form-control ${formData.genderOther && !formData.applicantGenderOtherText ? 'is-invalid' : ''} mb-4`}
                                required={formData.genderOther}
                            />
                        )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.3 Date et lieu de naissance</Form.Label>
                        <Form.Control
                            type="text" name="applicantDOBAndPlace" value={formData.applicantDOBAndPlace || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            placeholder="JJ/MMM/AAAA à VILLE" required
                            className={`form-control ${!formData.applicantDOBAndPlace ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.4 Adresse</Form.Label>
                        <Form.Control
                            type="text" name="applicantAddress" value={formData.applicantAddress || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            placeholder="Votre adresse résidentielle" required
                            className={`form-control ${!formData.applicantAddress ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.5 Coordonnées</Form.Label>
                        <Form.Control
                            type="text" name="applicantContactDetails" value={formData.applicantContactDetails || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            placeholder="Numéro de téléphone / Email" required
                            className={`form-control ${!formData.applicantContactDetails ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.6 Avez-vous une condition médicale diagnostiquée?</Form.Label>
                        <Form.Control
                            as="textarea" rows={2} name="applicantMedicalConditions" value={formData.applicantMedicalConditions || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            placeholder="Listez toute information médicale pertinente, ou N/A" required
                            className={`form-control ${!formData.applicantMedicalConditions ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.7 Citoyenneté</Form.Label>
                        <div
                            className="mb-4"
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                        >
                            <Form.Check
                                inline type="checkbox" label="Citoyen des États-Unis" name="citizenUS"
                                checked={formData.citizenUS || false} onChange={handleChange}
                            />
                            <Form.Check
                                inline type="checkbox" label="Statut de résident permanent étranger et demande de citoyenneté américaine" name="citizenPermanent"
                                checked={formData.citizenPermanent || false} onChange={handleChange}
                            />
                            <Form.Check
                                inline type="checkbox" label="Aucun des éléments ci-dessus" name="citizenNone"
                                checked={formData.citizenNone || false} onChange={handleChange}
                            />
                        </div>
                    </Form.Group>
                </div>
            )}

            {/* --- 2. Educational Background --- */}
            <CollapsibleHeader
                title="2. Formation académique"
                isOpen={openSections.educationalInfo}
                onToggle={() => toggleSection('educationalInfo')}
                sectionId="coroner-educational-info"
            />
            {openSections.educationalInfo && (
                <div id="collapse-coroner-educational-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>2.1 Niveau d'éducation le plus élevé</Form.Label>
                        <div
                            className="mb-4"
                            onBlur={() => handleSectionFieldBlur('educationalInfo', openSections.educationalInfo, (val) => setOpenSections(p => ({...p, educationalInfo: val})), 'educationalInfo')}
                        >
                            <Form.Check inline type="checkbox" label="Diplôme d'études secondaires" name="eduHighSchool" checked={formData.eduHighSchool || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Certificat (Pré-baccalauréat ou professionnel)" name="eduCertificate" checked={formData.eduCertificate || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Diplôme (Pré-baccalauréat ou professionnel)" name="eduDiploma" checked={formData.eduDiploma || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Diplôme d'associé" name="eduAssociate" checked={formData.eduAssociate || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Licence" name="eduBachelor" checked={formData.eduBachelor || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Master" name="eduMaster" checked={formData.eduMaster || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Doctorat" name="eduDoctorate" checked={formData.eduDoctorate || false} onChange={handleChange} />
                        </div>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>2.2.1 Nom de l'école</Form.Label>
                        <Form.Control type="text" name="applicantSchoolName" value={formData.applicantSchoolName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', openSections.educationalInfo, (val) => setOpenSections(p => ({...p, educationalInfo: val})), 'educationalInfo')} placeholder="Nom de l'établissement" required className={`form-control ${!formData.applicantSchoolName ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.2 Période d'inscription</Form.Label>
                        <Form.Control type="text" name="applicantEnrollmentTerm" value={formData.applicantEnrollmentTerm || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', openSections.educationalInfo, (val) => setOpenSections(p => ({...p, educationalInfo: val})), 'educationalInfo')} placeholder="JJ/MMM/AAAA à JJ/MMM/AAAA" required className={`form-control ${!formData.applicantEnrollmentTerm ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.3 Domaine d'études principal</Form.Label>
                        <Form.Control type="text" name="applicantMajor" value={formData.applicantMajor || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', openSections.educationalInfo, (val) => setOpenSections(p => ({...p, educationalInfo: val})), 'educationalInfo')} placeholder="ex: Sciences médico-légales, Biologie" required className={`form-control ${!formData.applicantMajor ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.3 Langues supplémentaires</Form.Label>
                        <Form.Control type="text" name="applicantLanguages" value={formData.applicantLanguages || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', openSections.educationalInfo, (val) => setOpenSections(p => ({...p, educationalInfo: val})), 'educationalInfo')} placeholder="Listez toutes les langues supplémentaires parlées (ou N/A)" required className={`form-control ${!formData.applicantLanguages ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                </div>
            )}

            {/* --- 3. Employment History --- */}
            <CollapsibleHeader
                title="3. Historique d'emploi"
                isOpen={openSections.employmentInfo}
                onToggle={() => toggleSection('employmentInfo')}
                sectionId="coroner-employment-info"
            />
            {openSections.employmentInfo && (
                <div id="collapse-coroner-employment-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>3.1 Emploi précédent</Form.Label>
                        <Form.Control type="text" name="applicantPrevEmployment" value={formData.applicantPrevEmployment || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', openSections.employmentInfo, (val) => setOpenSections(p => ({...p, employmentInfo: val})), 'employmentInfo')} placeholder="RÔLE chez ENTREPRISE entre JJ/MMM/AAAA et JJ/MMM/AAAA (ou N/A)" required className={`form-control ${!formData.applicantPrevEmployment ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>3.2 Fonctions</Form.Label>
                        <Form.Control as="textarea" rows={3} name="applicantPrevDuties" value={formData.applicantPrevDuties || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', openSections.employmentInfo, (val) => setOpenSections(p => ({...p, employmentInfo: val})), 'employmentInfo')} placeholder="Décrivez vos fonctions (ou N/A)" required className={`form-control ${!formData.applicantPrevDuties ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>3.3 Raison du licenciement (le cas échéant)</Form.Label>
                        <Form.Control as="textarea" rows={2} name="applicantPrevDismissalReason" value={formData.applicantPrevDismissalReason || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', openSections.employmentInfo, (val) => setOpenSections(p => ({...p, employmentInfo: val})), 'employmentInfo')} placeholder="Raison du départ de l'emploi précédent (ou N/A)" className="form-control mb-4" />
                    </Form.Group>
                </div>
            )}

            {/* --- 4. Motivational Letter --- */}
            <CollapsibleHeader
                title="4. Lettre de motivation"
                isOpen={openSections.motivationalLetter}
                onToggle={() => toggleSection('motivationalLetter')}
                sectionId="coroner-motivational-letter"
            />
            {openSections.motivationalLetter && (
                <div id="collapse-coroner-motivational-letter" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>4.1 Lettre de motivation</Form.Label>
                        <Form.Control
                            as="textarea" rows={8} name="applicantMotivationLetter" value={formData.applicantMotivationLetter || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('motivationalLetter', openSections.motivationalLetter, (val) => setOpenSections(p => ({...p, motivationalLetter: val})), 'motivationalLetter')}
                            placeholder="Décrivez pourquoi vous souhaitez nous rejoindre, pourquoi nous devrions vous choisir plutôt qu'une autre personne, et pourquoi les qualités requises pour ce poste vous correspondent."
                            required className={`form-control ${!formData.applicantMotivationLetter ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- 5. (( Out of Character information )) --- */}
            <CollapsibleHeader
                title="5. (( Informations hors personnage ))"
                isOpen={openSections.oocInfo}
                onToggle={() => toggleSection('oocInfo')}
                sectionId="coroner-ooc-info"
            />
            {openSections.oocInfo && (
                <div id="collapse-coroner-ooc-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychOocUcpName">
                        <Form.Label className="field-label">5.1 Nom d'utilisateur du panneau de contrôle utilisateur (UCP):</Form.Label>
                        <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="Votre nom UCP" required className={`form-control ${!formData.oocUcpName?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocUcpName?.trim() && <div className="invalid-feedback d-block">Le nom d'utilisateur UCP est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocForumName">
                        <Form.Label className="field-label">5.2 Nom de compte du forum GTA:W:</Form.Label>
                        <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="Votre nom de forum" required className={`form-control ${!formData.oocForumName?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocForumName?.trim() && <div className="invalid-feedback d-block">Le nom du forum est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocDiscord">
                        <Form.Label className="field-label">5.3 Nom Discord:</Form.Label>
                        <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="votrediscord#1234 ou nouveau nom d'utilisateur" required className={`form-control ${!formData.oocDiscord?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocDiscord?.trim() && <div className="invalid-feedback d-block">Le nom Discord est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocTimezone">
                        <Form.Label className="field-label">5.4 Fuseau horaire:</Form.Label>
                        <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="ex: EST, PST, GMT+2" required className={`form-control ${!formData.oocTimezone?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocTimezone?.trim() && <div className="invalid-feedback d-block">Le fuseau horaire est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocMedicalExperience">
                        <Form.Label className="field-label">5.5 Expérience médicale réelle ou RP médical passé:</Form.Label>
                        <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="Décrivez toute expérience pertinente" required className={`form-control ${!formData.oocMedicalExperience?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocMedicalExperience?.trim() && <div className="invalid-feedback d-block">Ce champ est requis.</div>}
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                        <Form.Label>5.6 Capture d'écran non modifiée de votre dossier administratif avec la date et l'heure actuelles affichées:</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="text"
                                name="oocAdminRecordLink"
                                value={formData.oocAdminRecordLink || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('oocInfo', openSections.oocInfo, (val) => setOpenSections(p => ({...p, oocInfo: val})), 'oocInfo')}
                                placeholder="Lien direct vers l'image (ex: ImgBB)"
                                required
                                className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="outline-secondary"
                                onClick={() => document.getElementById('coroner-oocAdminRecordUpload').click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                            </Button>
                        </InputGroup>
                        <input
                            type="file"
                            id="coroner-oocAdminRecordUpload"
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'oocAdminRecordLink')}
                        />
                        <div className="mb-4"></div> {/* Spacer */}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>5.7 Fournissez une capture d'écran des statistiques de votre personnage (/stats) avec lequel vous postulez:</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="text"
                                name="oocStatsLink"
                                value={formData.oocStatsLink || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('oocInfo', openSections.oocInfo, (val) => setOpenSections(p => ({...p, oocInfo: val})), 'oocInfo')}
                                placeholder="Lien direct vers l'image (ex: ImgBB)"
                                required
                                className={`form-control ${!formData.oocStatsLink ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="outline-secondary"
                                onClick={() => document.getElementById('coroner-oocStatsUpload').click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                            </Button>
                        </InputGroup>
                        <input
                            type="file"
                            id="coroner-oocStatsUpload"
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'oocStatsLink')}
                        />
                        <div className="mb-4"></div> {/* Spacer */}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>5.8 Fournissez l'histoire de fond de votre personnage:</Form.Label>
                        <Form.Control as="textarea" rows={5} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', openSections.oocInfo, (val) => setOpenSections(p => ({...p, oocInfo: val})), 'oocInfo')} required className={`form-control ${!formData.charBackground ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default CoronerFields;
