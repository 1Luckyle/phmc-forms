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


const AdminFields = ({
    formData,
    handleChange,
    setFormData,
    selectOptions,
    handleImageUpload, // Added prop
    isUploading        // Added prop
    

}) => {
    // Use adminPositionDetailsData from selectOptions for position dropdown
    const positionDetails = selectOptions?.adminPositionDetailsData || {};

    const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(true);
    const [isEducationalInfoOpen, setIsEducationalInfoOpen] = useState(true);
    const [isEmploymentInfoOpen, setIsEmploymentInfoOpen] = useState(true);
    const [isMotivationalLetterOpen, setIsMotivationalLetterOpen] = useState(true);
    const [isOocInfoOpen, setIsOocInfoOpen] = useState(true);

    const prevCompletionStatusOnBlurRef = useRef({});

    const checkFieldsCompletion = useCallback((fieldsToCheck) => {
        for (const field of fieldsToCheck) {
            if (typeof field === 'string') {
                const value = formData[field];
                if (typeof value === 'string' && !value.trim()) return false;
                if (typeof value === 'boolean' && !value) return false; // For single checkboxes that must be true
                if (value === undefined || value === null) return false;
            } else if (typeof field === 'object' && field.anyOf) { // For groups where at least one must be checked
                if (!field.anyOf.some(subField => formData[subField])) return false;
            } else if (typeof field === 'object' && field.conditional) { // For conditional fields
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
            'applicantPrevEmployment', 'applicantPrevDuties', // applicantPrevDismissalReason is optional
        ],
        motivationalLetter: ['applicantMotivationLetter'],
        oocInfo: [
            'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone',
            'oocAdminRecordLink', 'oocStatsLink', 'charBackground'
            // Note: The BBCode for admin had 5.5 as Admin Record, 5.6 as Stats, 5.7 as Background.
            // The OOC question "Do you have any real-life administrative/management experience..." was not in the final BBCode.
            // If you want to add it back, ensure it's in adminFormFields, sectionRequiredFields, and the JSX.
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


    return (
        <>
            {/* --- 1. Personal Information --- */}
            <CollapsibleHeader
                title="1. Informations personnelles"
                isOpen={isPersonalInfoOpen}
                onToggle={() => setIsPersonalInfoOpen(!isPersonalInfoOpen)}
                sectionId="admin-personal-info"
            />
            {isPersonalInfoOpen && (
                <div id="collapse-admin-personal-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>1.0 Poste pour lequel vous postulez</Form.Label>
                        <Form.Select
                            name="recruitmentPosition"
                            value={formData.recruitmentPosition || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            required
                            className={`form-control ${!formData.recruitmentPosition ? 'is-invalid' : ''} mb-4`}
                        >
                            <option value="">Sélectionner un poste administratif...</option>
                            {Object.entries(positionDetails).map(([key, position]) => (
                                <option
                                    key={key}
                                    value={key} // Assuming key is the value to store (e.g., "OfficeAssistant")
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
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Prénom (Deuxième Prénom) & Nom"
                            required
                            className={`form-control ${!formData.applicantTitleAndFullName ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-1"> {/* Group for gender elements */}
                        <Form.Label>1.2 Genre</Form.Label>
                        <div
                            style={{ display: 'flex', gap: '1rem' }}
                            className="gender-checkbox-group mb-4" // mb-4 on the div containing checkboxes
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
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
                                onChange={handleChange} onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                                placeholder="Préciser autre genre"
                                className={`mt-2 form-control ${!formData.applicantGenderOtherText ? 'is-invalid' : ''} mb-4`} // mt-2 for spacing from checkboxes, mb-4 for below
                                required={formData.genderOther}
                            />
                        )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.3 Date et lieu de naissance</Form.Label>
                        <Form.Control
                            type="text" name="applicantDOBAndPlace" value={formData.applicantDOBAndPlace || ''}
                            onChange={handleChange} onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="jj/mm/aaaa à VILLE" required
                            className={`form-control ${!formData.applicantDOBAndPlace ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.4 Adresse du domicile</Form.Label>
                        <Form.Control
                            type="text" name="applicantAddress" value={formData.applicantAddress || ''}
                            onChange={handleChange} onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Adresse (Numéro, Étage, Rue)" required
                            className={`form-control ${!formData.applicantAddress ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.5 Coordonnées</Form.Label>
                        <Form.Control
                            type="text" name="applicantContactDetails" value={formData.applicantContactDetails || ''}
                            onChange={handleChange} onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Numéro de téléphone / Email" required
                            className={`form-control ${!formData.applicantContactDetails ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.6 Avez-vous une condition médicale diagnostiquée?</Form.Label>
                        <Form.Control
                            as="textarea" rows={2} name="applicantMedicalConditions" value={formData.applicantMedicalConditions || ''}
                            onChange={handleChange} onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Listez toute information médicale pertinente, ou N/A" required
                            className={`form-control ${!formData.applicantMedicalConditions ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.7 Citoyenneté</Form.Label>
                        <div
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            className="mb-4" // mb-4 on the div containing checkboxes
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
                isOpen={isEducationalInfoOpen}
                onToggle={() => setIsEducationalInfoOpen(!isEducationalInfoOpen)}
                sectionId="admin-educational-info"
            />
            {isEducationalInfoOpen && (
                <div id="collapse-admin-educational-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>2.1 Niveau d'éducation le plus élevé</Form.Label>
                        <div
                            onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')}
                            className="mb-4" // mb-4 on the div containing checkboxes
                        >
                            <Form.Check inline type="checkbox" label="Diplôme d’Études Secondaires (High School Diploma)" name="eduHighSchool" checked={formData.eduHighSchool || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Certificat (Sous-licence ou Professionnel/Technique)" name="eduCertificate" checked={formData.eduCertificate || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Diplôme (Sous-licence ou Professionnel/Technique)" name="eduDiploma" checked={formData.eduDiploma || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Diplôme d’Associé (Associate Degree)" name="eduAssociate" checked={formData.eduAssociate || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Licence/Baccalauréat (Bachelor’s Degree)" name="eduBachelor" checked={formData.eduBachelor || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Master (Master’s Degree)" name="eduMaster" checked={formData.eduMaster || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Doctorat (PhD)" name="eduDoctorate" checked={formData.eduDoctorate || false} onChange={handleChange} />
                        </div>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>2.2.1 Nom de l'établissement</Form.Label>
                        <Form.Control type="text" name="applicantSchoolName" value={formData.applicantSchoolName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="Nom de l'établissement" required className={`form-control ${!formData.applicantSchoolName ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.2 Période d'inscription</Form.Label>
                        <Form.Control type="text" name="applicantEnrollmentTerm" value={formData.applicantEnrollmentTerm || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="jj/mm/aaaa au jj/mm/aaaa" required className={`form-control ${!formData.applicantEnrollmentTerm ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.3 Domaine d'études principal</Form.Label>
                        <Form.Control type="text" name="applicantMajor" value={formData.applicantMajor || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="Spécialisation ou domaine d'études" required className={`form-control ${!formData.applicantMajor ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.3 Langues supplémentaires</Form.Label>
                        <Form.Control type="text" name="applicantLanguages" value={formData.applicantLanguages || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="Langues supplémentaires parlées (ou N/A)" required className={`form-control ${!formData.applicantLanguages ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                </div>
            )}

            {/* --- 3. Employment History --- */}
            <CollapsibleHeader
                title="3. Expérience professionnelle"
                isOpen={isEmploymentInfoOpen}
                onToggle={() => setIsEmploymentInfoOpen(!isEmploymentInfoOpen)}
                sectionId="admin-employment-info"
            />
            {isEmploymentInfoOpen && (
                <div id="collapse-admin-employment-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>3.1 Emploi précédent</Form.Label>
                        <Form.Control type="text" name="applicantPrevEmployment" value={formData.applicantPrevEmployment || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="RÔLE chez ENTREPRISE entre jj/mm/aaaa et jj/mm/aaaa (ou N/A)" required className={`form-control ${!formData.applicantPrevEmployment ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>3.2 Fonctions</Form.Label>
                        <Form.Control as="textarea" rows={3} name="applicantPrevDuties" value={formData.applicantPrevDuties || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="Description de la fonction précédente (ou N/A)" required className={`form-control ${!formData.applicantPrevDuties ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>3.3 Motif du départ (le cas échéant)</Form.Label>
                        <Form.Control as="textarea" rows={2} name="applicantPrevDismissalReason" value={formData.applicantPrevDismissalReason || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="Motif du départ de l'emploi précédent (ou N/A)" className="form-control mb-4" />
                    </Form.Group>
                </div>
            )}

            {/* --- 4. Motivational Letter --- */}
            <CollapsibleHeader
                title="4. Lettre de motivation"
                isOpen={isMotivationalLetterOpen}
                onToggle={() => setIsMotivationalLetterOpen(!isMotivationalLetterOpen)}
                sectionId="admin-motivational-letter"
            />
            {isMotivationalLetterOpen && (
                <div id="collapse-admin-motivational-letter" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>4.1 Lettre de motivation</Form.Label>
                        <Form.Control
                            as="textarea" rows={8} name="applicantMotivationLetter" value={formData.applicantMotivationLetter || ''}
                            onChange={handleChange} onBlur={() => handleSectionFieldBlur('motivationalLetter', isMotivationalLetterOpen, setIsMotivationalLetterOpen, 'motivationalLetter')}
                            placeholder="Décrivez pourquoi vous souhaitez nous rejoindre, pourquoi nous devrions vous choisir plutôt qu'une autre personne, et pourquoi les qualités requises pour ce poste vous correspondent"
                            required className={`form-control ${!formData.applicantMotivationLetter ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- 5. (( Out of Character information )) --- */}
            <CollapsibleHeader
                title="5. (( Informations hors personnage ))"
                isOpen={isOocInfoOpen}
                onToggle={() => setIsOocInfoOpen(!isOocInfoOpen)}
                sectionId="admin-ooc-info"
            />
            {isOocInfoOpen && (
                <div id="collapse-admin-ooc-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>5.1 Nom d'utilisateur du panneau de contrôle utilisateur (UCP)</Form.Label>
                        <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.oocUcpName ? 'is-invalid' : ''} mb-4`} />
                        {!formData.oocUcpName && <div className="invalid-feedback d-block custom-validation-message">Le nom d'utilisateur UCP est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.2 Nom de compte du forum GTA:W</Form.Label>
                        <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.oocForumName ? 'is-invalid' : ''} mb-4`} />
                        {!formData.oocForumName && <div className="invalid-feedback d-block custom-validation-message">Le nom du forum est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.3 Nom Discord</Form.Label>
                        <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.oocDiscord ? 'is-invalid' : ''} mb-4`} />
                        {!formData.oocDiscord && <div className="invalid-feedback d-block custom-validation-message">Le nom Discord est requis.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.4 Fuseau horaire</Form.Label>
                        <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="ex: UTC+0, EST, PST" required className={`form-control ${!formData.oocTimezone ? 'is-invalid' : ''} mb-4`} />
                        {!formData.oocTimezone && <div className="invalid-feedback d-block custom-validation-message">Le fuseau horaire est requis.</div>}
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                        <Form.Label>5.5 Capture d'écran non modifiée de votre dossier administratif</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="url"
                                name="oocAdminRecordLink"
                                value={formData.oocAdminRecordLink || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')}
                                placeholder="Lien direct vers l'image (ex: ImgBB)"
                                required
                                className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="outline-secondary"
                                onClick={() => document.getElementById('admin-oocAdminRecordUpload').click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                            </Button>
                        </InputGroup>
                        <input
                            type="file"
                            id="admin-oocAdminRecordUpload"
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'oocAdminRecordLink')}
                        />
                         <div className="mb-4"></div> {/* Spacer */}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>5.6 Capture d'écran des statistiques du personnage (/stats)</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="url"
                                name="oocStatsLink"
                                value={formData.oocStatsLink || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')}
                                placeholder="Lien direct vers l'image (ex: ImgBB)"
                                required
                                className={`form-control ${!formData.oocStatsLink ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="outline-secondary"
                                onClick={() => document.getElementById('admin-oocStatsUpload').click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                            </Button>
                        </InputGroup>
                        <input
                            type="file"
                            id="admin-oocStatsUpload"
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'oocStatsLink')}
                        />
                         <div className="mb-4"></div> {/* Spacer */}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>5.7 Background du personnage (Bref résumé)</Form.Label>
                        <Form.Control as="textarea" rows={8} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.charBackground ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default AdminFields;
