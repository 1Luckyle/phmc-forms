// c:\Users\cross\Documents\GitHub\phmc-forms\src\phmc-civilian-fields\Psych.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Button, InputGroup, Spinner } from 'react-bootstrap'; // Added InputGroup and Spinner

// Helper component for collapsible section headers (from Physician.js)
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

const LOCAL_STORAGE_KEY_PSYCH = 'psychApplicationFormData';
const EXPIRY_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

// Define which fields belong to this form for potential localStorage or other logic
const psychFormFields = [
    'recruitmentPosition', 'applicantTitleAndFullName', 'genderMale', 'genderFemale', 'genderOther',
    'applicantGenderOtherText', 'applicantDOBAndPlace', 'applicantAddress', 'applicantContactDetails',
    'locationPHMC', 'locationPBC', 'applicantMedicalConditions', 'citizenUS', 'citizenPermanent', 'citizenNone',
    'eduHighSchool', 'eduCertificate', 'eduDiploma', 'eduAssociate', 'eduBachelor', 'eduMaster', 'eduDoctorate',
    'applicantSchoolName', 'applicantEnrollmentTerm', 'applicantMajor', 'applicantLanguages',
    'applicantPrevEmployment', 'applicantPrevDuties', 'applicantPrevDismissalReason',
    'applicantMotivationLetter', 'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone',
    'oocMedicalExperience', 'oocAdminRecordLink', 'oocStatsLink', 'charBackground'
];


const PsychFields = ({
    formData,
    handleChange,
    setFormData,
    selectOptions, 
    psychRecruitmentDetails,
    handleImageUpload, // Added prop
    isUploading        // Added prop
    }) => {

    const currentPositionDetails = psychRecruitmentDetails || {};
    const currentRecruitmentOptions = selectOptions.psychRecruitmentPositions || []; 

    const selectedRecruitmentPositionValue = formData.recruitmentPosition;
    const selectedRecruitmentPosition = currentRecruitmentOptions.find(
        option => option.value === selectedRecruitmentPositionValue
    );

    const shouldShowSimplifiedLayout =
        selectedRecruitmentPositionValue === "Counseling Psychologist" ||
        selectedRecruitmentPositionValue === "Psychologist";

    const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(true);
    const [isEducationalInfoOpen, setIsEducationalInfoOpen] = useState(true);
    const [isEmploymentInfoOpen, setIsEmploymentInfoOpen] = useState(true);
    const [isMotivationalLetterOpen, setIsMotivationalLetterOpen] = useState(true);
    const [isOocInfoOpen, setIsOocInfoOpen] = useState(true);

    const prevCompletionStatusOnBlurRef = useRef({});

    useEffect(() => {
        const sections = ['personalInfo', 'educationalInfo', 'employmentInfo', 'motivationalLetter', 'oocInfo'];
        sections.forEach(sectionId => {
            if (prevCompletionStatusOnBlurRef.current[sectionId] === undefined) {
                prevCompletionStatusOnBlurRef.current[sectionId] = false;
            }
        });
    }, []);

    // --- START localStorage Logic ---
    useEffect(() => {
        try {
            const savedDataString = localStorage.getItem(LOCAL_STORAGE_KEY_PSYCH);
            if (savedDataString) {
                const savedData = JSON.parse(savedDataString);
                if (savedData && savedData.data && savedData.timestamp) {
                    if (Date.now() - savedData.timestamp < EXPIRY_DURATION_MS) {
                        const relevantSavedData = {};
                        psychFormFields.forEach(field => {
                            if (savedData.data.hasOwnProperty(field)) {
                                relevantSavedData[field] = savedData.data[field];
                            }
                        });
                        setFormData(prev => ({ ...prev, ...relevantSavedData }));
                    } else {
                        localStorage.removeItem(LOCAL_STORAGE_KEY_PSYCH);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading psych form data from localStorage:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY_PSYCH);
        }
    }, [setFormData]);

    useEffect(() => {
        try {
            const dataToSave = {};
            psychFormFields.forEach(field => {
                if (formData.hasOwnProperty(field)) {
                    dataToSave[field] = formData[field];
                }
            });
            const psychDataWithTimestamp = {
                data: dataToSave,
                timestamp: Date.now()
            };
            localStorage.setItem(LOCAL_STORAGE_KEY_PSYCH, JSON.stringify(psychDataWithTimestamp));
        } catch (error) {
            console.error("Error saving psych form data to localStorage:", error);
        }
    }, [formData]);
    // --- END localStorage Logic ---


    const sectionRequiredFields = {
        personalInfo: [
            'recruitmentPosition', 'applicantTitleAndFullName',
            { anyOf: ['genderMale', 'genderFemale', 'genderOther'] },
            { conditional: { if: { field: 'genderOther', value: true }, then: { field: 'applicantGenderOtherText' } } },
            'applicantDOBAndPlace', 'applicantAddress', 'applicantContactDetails',
            { 
                check: (currentFormData, showSimplified) => {
                    if (showSimplified) { 
                        return !!currentFormData.applicantMedicalConditions?.trim() &&
                               (!!currentFormData.citizenUS || !!currentFormData.citizenPermanent || !!currentFormData.citizenNone);
                    } else { 
                        return (!!currentFormData.locationPHMC || !!currentFormData.locationPBC);
                    }
                }
            }
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

    const checkFieldsCompletion = useCallback((fieldsToCheck, showSimplifiedFlag) => { 
        for (const field of fieldsToCheck) {
            if (typeof field === 'string') {
                const value = formData[field];
                if (typeof value === 'string' && !value.trim()) return false;
                if (typeof value === 'boolean' && !value && value !== false) return false;
                if (value === undefined || value === null) return false;
            } else if (typeof field === 'object' && field.anyOf) {
                if (!field.anyOf.some(subField => !!formData[subField])) return false;
            } else if (typeof field === 'object' && field.conditional) {
                if (!!formData[field.conditional.if.field] === field.conditional.if.value) {
                    const conditionalValue = formData[field.conditional.then.field];
                    if (typeof conditionalValue === 'string' && !conditionalValue.trim()) return false;
                    if (conditionalValue === undefined || conditionalValue === null) return false;
                }
            } else if (typeof field === 'object' && field.check) {
                if (!field.check(formData, showSimplifiedFlag)) return false;
            }
        }
        return true;
    }, [formData]);

    const handleSectionFieldBlur = useCallback((sectionId, isOpenState, setIsOpenFunction, requiredFieldsKey) => {
        const isNowComplete = checkFieldsCompletion(sectionRequiredFields[requiredFieldsKey], shouldShowSimplifiedLayout);
        const wasCompleteAtLastBlur = prevCompletionStatusOnBlurRef.current[sectionId] === true;

        if (isOpenState && isNowComplete && !wasCompleteAtLastBlur) {
            setIsOpenFunction(false);
        }
        prevCompletionStatusOnBlurRef.current[sectionId] = isNowComplete;
    }, [checkFieldsCompletion, sectionRequiredFields, shouldShowSimplifiedLayout]); 


    return (
        <>
            {/* Section 1: Personal Information */}
            <CollapsibleHeader
                title="1. Informations personnelles"
                isOpen={isPersonalInfoOpen}
                onToggle={() => setIsPersonalInfoOpen(!isPersonalInfoOpen)}
                sectionId="psych-personal-info"
            />
            {isPersonalInfoOpen && (
                <div id="collapse-psych-personal-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychRecruitmentPosition">
                        <Form.Label className="field-label">1.0 Poste pour lequel vous postulez :</Form.Label>
                        <Form.Select
                            name="recruitmentPosition"
                            value={formData.recruitmentPosition || ''}
                            onChange={handleChange} 
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            required 
                            className={`form-control ${!formData.recruitmentPosition ? 'is-invalid' : ''}`}
                        >
                            <option value="">Sélectionner un poste en psychologie...</option>
                            {currentRecruitmentOptions.map(opt => (
                                <option
                                    key={opt.value}
                                    value={opt.value}
                                    disabled={currentPositionDetails[opt.value]?.status === "CLOSED"}
                                    style={currentPositionDetails[opt.value]?.status === "CLOSED" ? { color: 'red', fontWeight: 'bold' } : {}}
                                >
                                    {opt.label}
                                    {currentPositionDetails[opt.value]?.status === "CLOSED" ? " (Candidatures fermées)" : ""}
                                </option>
                            ))}
                        </Form.Select>
                        {!formData.recruitmentPosition && <div className="invalid-feedback d-block">Le poste est requis.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychApplicantTitleAndFullName">
                        <Form.Label className="field-label">1.1 Titre et nom complet</Form.Label>
                        <Form.Control
                            type="text" name="applicantTitleAndFullName" value={formData.applicantTitleAndFullName || ''} onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Prénom (Deuxième Prénom) & Nom" required
                            className={`form-control ${!formData.applicantTitleAndFullName?.trim() ? 'is-invalid' : ''}`}
                        />
                        {!formData.applicantTitleAndFullName?.trim() && <div className="invalid-feedback d-block">Le titre et nom complet est requis.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychApplicantGender">
                        <Form.Label className="field-label">1.2 Genre</Form.Label>
                        <div onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}>
                            <Form.Check inline type="checkbox" label="Homme" name="genderMale" checked={!!formData.genderMale} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Femme" name="genderFemale" checked={!!formData.genderFemale} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Autre" name="genderOther" checked={!!formData.genderOther} onChange={handleChange} />
                            {!(formData.genderMale || formData.genderFemale || formData.genderOther) && <div className="invalid-feedback d-block">La sélection du genre est requise.</div>}
                            {formData.genderOther && (
                                <Form.Control
                                    type="text" name="applicantGenderOtherText" value={formData.applicantGenderOtherText || ''} onChange={handleChange}
                                    onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                                    placeholder="Veuillez préciser" className={`mt-2 form-control ${!formData.applicantGenderOtherText?.trim() ? 'is-invalid' : ''}`} required={formData.genderOther}
                                />
                            )}
                            {formData.genderOther && !formData.applicantGenderOtherText?.trim() && <div className="invalid-feedback d-block">La précision pour 'Autre' genre est requise.</div>}
                        </div>
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychApplicantDOBAndPlace">
                        <Form.Label className="field-label">1.3 Date et lieu de naissance</Form.Label>
                        <Form.Control
                            type="text" name="applicantDOBAndPlace" value={formData.applicantDOBAndPlace || ''} onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="jj/mm/aaaa à VILLE" required
                            className={`form-control ${!formData.applicantDOBAndPlace?.trim() ? 'is-invalid' : ''}`}
                        />
                        {!formData.applicantDOBAndPlace?.trim() && <div className="invalid-feedback d-block">La date et le lieu de naissance sont requis.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychApplicantAddress">
                        <Form.Label className="field-label">1.4 Adresse du domicile</Form.Label>
                        <Form.Control
                            type="text" name="applicantAddress" value={formData.applicantAddress || ''} onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Adresse (Numéro, Étage, Rue)" required
                            className={`form-control ${!formData.applicantAddress?.trim() ? 'is-invalid' : ''}`}
                        />
                        {!formData.applicantAddress?.trim() && <div className="invalid-feedback d-block">L'adresse est requise.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychApplicantContactDetails">
                        <Form.Label className="field-label">1.5 Coordonnées</Form.Label>
                        <Form.Control
                            type="text" name="applicantContactDetails" value={formData.applicantContactDetails || ''} onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Numéro de téléphone / Email" required
                            className={`form-control ${!formData.applicantContactDetails?.trim() ? 'is-invalid' : ''}`}
                        />
                        {!formData.applicantContactDetails?.trim() && <div className="invalid-feedback d-block">Les coordonnées sont requises.</div>}
                    </Form.Group>

                    {shouldShowSimplifiedLayout ? (
                        <>
                            <Form.Group className="mb-3" controlId="psychApplicantMedicalConditionsSimplified">
                                <Form.Label className="field-label">1.6 Avez-vous une condition médicale diagnostiquée?</Form.Label>
                                <Form.Control
                                    as="textarea" rows={3} name="applicantMedicalConditions" value={formData.applicantMedicalConditions || ''} onChange={handleChange}
                                    onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                                    placeholder="Listez toute information médicale pertinente, ou N/A" required
                                    className={`form-control ${!formData.applicantMedicalConditions?.trim() ? 'is-invalid' : ''}`}
                                />
                                {!formData.applicantMedicalConditions?.trim() && <div className="invalid-feedback d-block">Ce champ est requis (entrez N/A si aucun).</div>}
                            </Form.Group>
                            <Form.Group className="mb-3" controlId="psychApplicantCitizenshipSimplified">
                                <Form.Label className="field-label">1.7 Citoyenneté</Form.Label>
                                <div onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}>
                                    <Form.Check type="checkbox" label="Citoyen des États-Unis" name="citizenUS" checked={!!formData.citizenUS} onChange={handleChange} />
                                    <Form.Check type="checkbox" label="Statut de résident permanent étranger et demande de citoyenneté américaine" name="citizenPermanent" checked={!!formData.citizenPermanent} onChange={handleChange} />
                                    <Form.Check type="checkbox" label="Aucun des éléments ci-dessus" name="citizenNone" checked={!!formData.citizenNone} onChange={handleChange} />
                                    {!(formData.citizenUS || formData.citizenPermanent || formData.citizenNone) && <div className="invalid-feedback d-block">Le statut de citoyenneté est requis.</div>}
                                </div>
                            </Form.Group>
                        </>
                    )  : (
                        <>
                            <Form.Group className="mb-3" controlId="psychDesiredEmploymentLocationStandard">
                                <Form.Label className="field-label">1.6 Lieu d'emploi souhaité</Form.Label>
                                <div onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}>
                                    <Form.Check inline type="checkbox" label="Pillbox Hill Medical Center (Ville)" name="locationPHMC" checked={!!formData.locationPHMC || true} onChange={handleChange} />
                                    <Form.Check inline type="checkbox" label="PHMC Paleto Bay Clinic" name="locationPBC" checked={!!formData.locationPBC || false} disabled />
                                    {!(formData.locationPHMC || formData.locationPBC) && <div className="invalid-feedback d-block">Au moins un lieu doit être sélectionné.</div>}
                                </div>
                            </Form.Group>
                        </>
                    )}
                </div>
            )}

            {/* Section 2: Educational Background */}
            <CollapsibleHeader
                title="2. Formation académique"
                isOpen={isEducationalInfoOpen}
                onToggle={() => setIsEducationalInfoOpen(!isEducationalInfoOpen)}
                sectionId="psych-educational-info"
            />
            {isEducationalInfoOpen && (
                <div id="collapse-psych-educational-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychHighestEducation">
                        <Form.Label className="field-label">2.1 Niveau d'éducation le plus élevé</Form.Label>
                        <div onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')}>
                            <Form.Check type="checkbox" label="Diplôme d’Études Secondaires (High School Diploma)" name="eduHighSchool" checked={!!formData.eduHighSchool} onChange={handleChange} />
                            <Form.Check type="checkbox" label="ertificat (Sous-licence ou Professionnel/Technique)" name="eduCertificate" checked={!!formData.eduCertificate} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Diplôme (Sous-licence ou Professionnel/Technique)" name="eduDiploma" checked={!!formData.eduDiploma} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Diplôme d’Associé (Associate Degree)" name="eduAssociate" checked={!!formData.eduAssociate} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Licence/Baccalauréat (Bachelor’s Degree)" name="eduBachelor" checked={!!formData.eduBachelor} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Master (Master’s Degree)" name="eduMaster" checked={!!formData.eduMaster} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Doctorat (PhD)" name="eduDoctorate" checked={!!formData.eduDoctorate} onChange={handleChange} />
                            {!(formData.eduHighSchool || formData.eduCertificate || formData.eduDiploma || formData.eduAssociate || formData.eduBachelor || formData.eduMaster || formData.eduDoctorate) && <div className="invalid-feedback d-block">Le niveau d'éducation le plus élevé est requis.</div>}
                        </div>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychSchoolName">
                        <Form.Label className="field-label">2.2.1 Nom de l'établissement</Form.Label>
                        <Form.Control type="text" name="applicantSchoolName" value={formData.applicantSchoolName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="Nom de l'établissement" required className={`form-control ${!formData.applicantSchoolName?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantSchoolName?.trim() && <div className="invalid-feedback d-block">Le nom de l'école est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychEnrollmentTerm">
                        <Form.Label className="field-label">2.2.2 Période d'inscription</Form.Label>
                        <Form.Control type="text" name="applicantEnrollmentTerm" value={formData.applicantEnrollmentTerm || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="jj/mm/aaaa à jj/mm/aaaa" required className={`form-control ${!formData.applicantEnrollmentTerm?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantEnrollmentTerm?.trim() && <div className="invalid-feedback d-block">La période d'inscription est requise.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychMajor">
                        <Form.Label className="field-label">2.2.3 Domaine d'études principal</Form.Label>
                        <Form.Control type="text" name="applicantMajor" value={formData.applicantMajor || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="Spécialisation ou domaine d'études" required className={`form-control ${!formData.applicantMajor?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantMajor?.trim() && <div className="invalid-feedback d-block">Le domaine d'études principal est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychLanguages">
                        <Form.Label className="field-label">2.3 Langues supplémentaires</Form.Label>
                        <Form.Control type="text" name="applicantLanguages" value={formData.applicantLanguages || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="Langues supplémentaires parlées (ou N/A)" required className={`form-control ${!formData.applicantLanguages?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantLanguages?.trim() && <div className="invalid-feedback d-block">Ce champ est requis (entrez N/A si aucune).</div>}
                    </Form.Group>
                </div>
            )}

            {/* Section 3: Employment History */}
            <CollapsibleHeader
                title="3. Expérience professionnelle"
                isOpen={isEmploymentInfoOpen}
                onToggle={() => setIsEmploymentInfoOpen(!isEmploymentInfoOpen)}
                sectionId="psych-employment-info"
            />
            {isEmploymentInfoOpen && (
                <div id="collapse-psych-employment-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychPrevEmployment">
                        <Form.Label className="field-label">3.1 Emploi précédent</Form.Label>
                        <Form.Control type="text" name="applicantPrevEmployment" value={formData.applicantPrevEmployment || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="RÔLE chez ENTREPRISE entre jj/mm/aaaa et jj/mm/aaaa (ou N/A)" required className={`form-control ${!formData.applicantPrevEmployment?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantPrevEmployment?.trim() && <div className="invalid-feedback d-block">Ce champ est requis (entrez N/A si aucun).</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychPrevDuties">
                        <Form.Label className="field-label">3.2 Fonctions</Form.Label>
                        <Form.Control as="textarea" rows={3} name="applicantPrevDuties" value={formData.applicantPrevDuties || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="Description de la fonction précédente (ou N/A)" required className={`form-control ${!formData.applicantPrevDuties?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantPrevDuties?.trim() && <div className="invalid-feedback d-block">Ce champ est requis (entrez N/A si aucune).</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychPrevDismissalReason">
                        <Form.Label className="field-label">3.3 Motif du départ (le cas échéant)</Form.Label>
                        <Form.Control as="textarea" rows={2} name="applicantPrevDismissalReason" value={formData.applicantPrevDismissalReason || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="Motif du départ de l'emploi précédent (ou N/A)" />
                    </Form.Group>
                </div>
            )}

            {/* Section 4: Motivational Letter */}
            <CollapsibleHeader
                title="4. Lettre de motivation"
                isOpen={isMotivationalLetterOpen}
                onToggle={() => setIsMotivationalLetterOpen(!isMotivationalLetterOpen)}
                sectionId="psych-motivational-letter"
            />
            {isMotivationalLetterOpen && (
                <div id="collapse-psych-motivational-letter" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychMotivationLetter">
                        <Form.Label className="field-label">4.1 Lettre de motivation</Form.Label>
                        <Form.Control
                            as="textarea" rows={8} name="applicantMotivationLetter" value={formData.applicantMotivationLetter || ''} onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('motivationalLetter', isMotivationalLetterOpen, setIsMotivationalLetterOpen, 'motivationalLetter')}
                            placeholder="Décrivez pourquoi vous souhaitez nous rejoindre, pourquoi nous devrions vous choisir plutôt qu'une autre personne, et pourquoi les qualités requises pour ce poste vous correspondent" required
                            className={`form-control ${!formData.applicantMotivationLetter?.trim() ? 'is-invalid' : ''}`}
                        />
                        {!formData.applicantMotivationLetter?.trim() && <div className="invalid-feedback d-block">La lettre de motivation est requise.</div>}
                    </Form.Group>
                </div>
            )}

            {/* Section 5: OOC Information */}
            <CollapsibleHeader
                title="5. (( Informations hors personnage ))"
                isOpen={isOocInfoOpen}
                onToggle={() => setIsOocInfoOpen(!isOocInfoOpen)}
                sectionId="psych-ooc-info"
            />
            {isOocInfoOpen && (
                <div id="collapse-psych-ooc-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychOocUcpName">
                        <Form.Label className="field-label">5.1 Nom d'utilisateur du panneau de contrôle utilisateur (UCP)</Form.Label>
                        <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.oocUcpName?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocUcpName?.trim() && <div className="invalid-feedback d-block">Le nom d'utilisateur UCP est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocForumName">
                        <Form.Label className="field-label">5.2 Nom de compte du forum GTA:W</Form.Label>
                        <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.oocForumName?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocForumName?.trim() && <div className="invalid-feedback d-block">Le nom du forum est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocDiscord">
                        <Form.Label className="field-label">5.3 Nom Discord</Form.Label>
                        <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.oocDiscord?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocDiscord?.trim() && <div className="invalid-feedback d-block">Le nom Discord est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocTimezone">
                        <Form.Label className="field-label">5.4 Fuseau horaire</Form.Label>
                        <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="ex: UTC+0, EST, PST" required className={`form-control ${!formData.oocTimezone?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocTimezone?.trim() && <div className="invalid-feedback d-block">Le fuseau horaire est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocMedicalExperience">
                        <Form.Label className="field-label">5.5 Expérience médicale réelle ou RP médical passé</Form.Label>
                        <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="Décrivez toute expérience pertinente" required className={`form-control ${!formData.oocMedicalExperience?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocMedicalExperience?.trim() && <div className="invalid-feedback d-block">Ce champ est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocAdminRecordLink">
                        <Form.Label className="field-label">5.6 Capture d'écran non modifiée de votre dossier administratif</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="url"
                                name="oocAdminRecordLink"
                                value={formData.oocAdminRecordLink || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')}
                                placeholder="Lien direct vers l'image (ex : ImgBB)"
                                required
                                className={`form-control ${!formData.oocAdminRecordLink?.trim() ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="outline-secondary"
                                onClick={() => document.getElementById('psych-oocAdminRecordUpload').click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                            </Button>
                        </InputGroup>
                        <input
                            type="file"
                            id="psych-oocAdminRecordUpload"
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'oocAdminRecordLink')}
                        />
                        {!formData.oocAdminRecordLink?.trim() && <div className="invalid-feedback d-block">Le lien du dossier administratif est requis.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychOocStatsLink">
                        <Form.Label className="field-label">5.7 Capture d'écran des statistiques du personnage (/stats)</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="url"
                                name="oocStatsLink"
                                value={formData.oocStatsLink || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')}
                                placeholder="Lien direct vers l'image (ex : ImgBB)"
                                required
                                className={`form-control ${!formData.oocStatsLink?.trim() ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="outline-secondary"
                                onClick={() => document.getElementById('psych-oocStatsUpload').click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                            </Button>
                        </InputGroup>
                        <input
                            type="file"
                            id="psych-oocStatsUpload"
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'oocStatsLink')}
                        />
                        {!formData.oocStatsLink?.trim() && <div className="invalid-feedback d-block">Le lien des statistiques est requis.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychCharBackground">
                        <Form.Label className="field-label">5.8 Background du personnage</Form.Label>
                        <Form.Control as="textarea" rows={8} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')}required className={`form-control ${!formData.charBackground?.trim() ? 'is-invalid' : ''} mb-4`} />
                        {!formData.charBackground?.trim() && <div className="invalid-feedback d-block">Le Background du personnage est requise.</div>}
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default PsychFields;
