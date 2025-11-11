import React, { useState, useEffect, useMemo } from 'react';
import { Form, Button } from 'react-bootstrap';

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

const EMSFields = ({ formData, handleChange, setFormData, selectOptions
}) => {
    const positionDetails = selectOptions?.emsPositionDetailsData || {};

    const selectedRole = formData.recruitmentPosition || '';

    const isParamedic = selectedRole === 'Paramedic';
    const isEMT = selectedRole === 'EMT';
    const isOtherEMS = selectedRole && !isParamedic && !isEMT;

    const [openSections, setOpenSections] = useState({
        personalInfo: true,
        educationalInfo: true,
        employmentInfo: true,
        licensingInfo: true,
        motivationalLetter: true,
        oocInfo: true,
    });
    // List of fields used in this component

    const toggleSection = (sectionName) => {
        setOpenSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));
    };

    return (
        <>
            {/* --- 1. Personal Information (Common to all) --- */}
            <CollapsibleHeader
                title="1. Informations personnelles"
                isOpen={openSections.personalInfo}
                onToggle={() => toggleSection('personalInfo')}
                sectionId="ems-personal-info"
            />
            {openSections.personalInfo && (
                <div id="collapse-ems-personal-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>1.0 Poste pour lequel vous postulez</Form.Label>
                        <Form.Select
                            name="recruitmentPosition"
                            value={formData.recruitmentPosition || ''}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.recruitmentPosition ? 'is-invalid' : ''} mb-4`}
                        >
                            <option value="">Sélectionner un poste EMS...</option>
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
                            placeholder="Prénom (Deuxième Prénom) & Nom"
                            required
                            className={`form-control ${!formData.applicantTitleAndFullName ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-1">
                        <Form.Label>1.2 Genre</Form.Label>
                        <div style={{ display: 'flex', gap: '1rem' }} className="mb-4">
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
                            placeholder="jj/mm/aaaa à VILLE" required
                            className={`form-control ${!formData.applicantDOBAndPlace ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.4 Adresse du domicile</Form.Label>
                    <Form.Control
                        type="text"
                        name="applicantAddress" //This must be identical to relevantFields
                        value={formData.applicantAddress || ''}
                        onChange={handleChange} //This is important too
                        placeholder="Adresse (Numéro, Étage, Rue)" required
                        className={`form-control ${!formData.applicantAddress ? 'is-invalid' : ''} mb-4`}
                    />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.5 Coordonnées</Form.Label>
                        <Form.Control
                            type="text" name="applicantContactDetails" value={formData.applicantContactDetails || ''}
                            onChange={handleChange}
                            placeholder="Numéro de téléphone / Email" required
                            className={`form-control ${!formData.applicantContactDetails ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.6 Avez-vous été diagnostiqué avec une condition médicale, des allergies, ou vous a-t-on prescrit des médicaments?</Form.Label>
                        <Form.Control
                            as="textarea" rows={2} name="applicantMedicalConditions" value={formData.applicantMedicalConditions || ''}
                            onChange={handleChange}
                            placeholder="Listez toute information médicale pertinente, ou N/A" required
                            className={`form-control ${!formData.applicantMedicalConditions ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.7 Citoyenneté</Form.Label>
                        <div className="mb-4">
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

            {/* --- 2. Educational Background (Common to all) --- */}
            <CollapsibleHeader
                title="2. Formation académique"
                isOpen={openSections.educationalInfo}
                onToggle={() => toggleSection('educationalInfo')}
                sectionId="ems-educational-info"
            />
            {openSections.educationalInfo && (
                <div id="collapse-ems-educational-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>2.1 Niveau d'éducation le plus élevé</Form.Label>
                        <div className="mb-4">
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
                        <Form.Control type="text" name="applicantSchoolName" value={formData.applicantSchoolName || ''} onChange={handleChange} placeholder="Nom de l'établissement" required className={`form-control ${!formData.applicantSchoolName ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.2 Période d'inscription</Form.Label>
                        <Form.Control type="text" name="applicantEnrollmentTerm" value={formData.applicantEnrollmentTerm || ''} onChange={handleChange} placeholder="jj/mm/aaaa au jj/mm/aaaa" required className={`form-control ${!formData.applicantEnrollmentTerm ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.3 Domaine d'études principal</Form.Label>
                        <Form.Control type="text" name="applicantMajor" value={formData.applicantMajor || ''} onChange={handleChange} placeholder="Spécialisation ou domaine d'études" required className={`form-control ${!formData.applicantMajor ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.3 Langues supplémentaires</Form.Label>
                        <Form.Control type="text" name="applicantLanguages" value={formData.applicantLanguages || ''} onChange={handleChange} placeholder="Langues supplémentaires parlées (ou N/A)" required className={`form-control ${!formData.applicantLanguages ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                </div>
            )}

            {/* --- Conditional Sections Start Here --- */}

            {/* Section 3: Employment History (Paramedic/EMT) */}
            {(isParamedic || isEMT) && (
                <div>
                    <CollapsibleHeader
                        title="3. Expérience professionnelle"
                        isOpen={openSections.employmentInfo}
                        onToggle={() => toggleSection('employmentInfo')}
                        sectionId="ems-employment-info"
                    />
                    {openSections.employmentInfo && (
                        <div id="collapse-ems-employment-info" style={{ paddingTop: '0.5rem' }}>
                            <Form.Group className="mb-3">
                                <Form.Label>3.1 Emploi précédent</Form.Label>
                                <Form.Control type="text" name="applicantPrevEmployment" value={formData.applicantPrevEmployment || ''} onChange={handleChange} placeholder="RÔLE chez ENTREPRISE entre jj/mm/aaaa et jj/mm/aaaa (ou N/A)" required className={`form-control ${!formData.applicantPrevEmployment ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>3.2 Fonctions</Form.Label>
                                <Form.Control as="textarea" rows={3} name="applicantPrevDuties" value={formData.applicantPrevDuties || ''} onChange={handleChange} placeholder="Description de la fonction précédente (ou N/A)" required className={`form-control ${!formData.applicantPrevDuties ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>3.3 Motif de départ (le cas échéant)</Form.Label>
                                <Form.Control as="textarea" rows={2} name="applicantPrevDismissalReason" value={formData.applicantPrevDismissalReason || ''} onChange={handleChange} placeholder="Motif du départ de l'emploi précédent (ou N/A)" className="form-control mb-4" />
                            </Form.Group>
                        </div>
                    )}
                </div>
            )}

            {/* Section 3: Licensing & Request Information (OtherEMS) */}
            {isOtherEMS && (
                <div>
                    <CollapsibleHeader
                        title="3. Informations sur les licences et demandes"
                        isOpen={openSections.licensingInfo}
                        onToggle={() => toggleSection('licensingInfo')}
                        sectionId="ems-licensing-info"
                    />
                    {openSections.licensingInfo && (
                        <div id="collapse-ems-licensing-info" style={{ paddingTop: '0.5rem' }}>
                            <Form.Group className="mb-3">
                                <Form.Label>3.1 Copie de votre licence de technicien médical d'urgence (( /licenses ))</Form.Label>
                                <Form.Control type="text" name="emsLicenseLink" value={formData.emsLicenseLink || ''} onChange={handleChange} placeholder="Lien vers la capture d'écran de la licence" required className={`form-control ${!formData.emsLicenseLink ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>3.2 Veuillez écrire un court paragraphe expliquant pourquoi vous pensez que vous devriez obtenir une place dans notre programme à temps partiel:</Form.Label>
                                <Form.Control as="textarea" rows={4} name="emsPartTimeReason" value={formData.emsPartTimeReason || ''} onChange={handleChange} required className={`form-control ${!formData.emsPartTimeReason ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                        </div>
                    )}
                </div>
            )}

            {/* Section 4: Motivational Letter (Paramedic/EMT) */}
            {(isParamedic || isEMT) && (
                <div>
                    <CollapsibleHeader
                        title="4. Lettre de motivation"
                        isOpen={openSections.motivationalLetter}
                        onToggle={() => toggleSection('motivationalLetter')}
                        sectionId="ems-motivational-letter"
                    />
                    {openSections.motivationalLetter && (
                        <div id="collapse-ems-motivational-letter" style={{ paddingTop: '0.5rem' }}>
                            <Form.Group className="mb-3">
                                <Form.Label>4.1 Lettre de motivation</Form.Label>
                                <Form.Control
                                    as="textarea" rows={8} name="applicantMotivationLetter" value={formData.applicantMotivationLetter || ''}
                                    onChange={handleChange}
                                    placeholder="Décrivez pourquoi vous souhaitez nous rejoindre, pourquoi nous devrions vous choisir plutôt qu'une autre personne, et pourquoi les qualités requises pour ce poste vous correspondent"
                                    required className={`form-control ${!formData.applicantMotivationLetter ? 'is-invalid' : ''} mb-4`}
                                />
                            </Form.Group>
                        </div>
                    )}
                </div>
            )}

            {/* Section 5 for Paramedic/EMT (OOC Info) OR Section 4 for OtherEMS (OOC Info) */}
            {(isParamedic || isEMT) && (
                <div>
                    <CollapsibleHeader
                        title="5. (( Informations hors personnage ))"
                        isOpen={openSections.oocInfo}
                        onToggle={() => toggleSection('oocInfo')}
                        sectionId="ems-ooc-info-paramedic-emt"
                    />
                    {openSections.oocInfo && (
                        <div id="collapse-ems-ooc-info-paramedic-emt" style={{ paddingTop: '0.5rem' }}>
                            <Form.Group className="mb-3">
                                <Form.Label>5.1 Nom d'utilisateur du panneau de contrôle utilisateur (UCP)</Form.Label>
                                <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} required className={`form-control ${!formData.oocUcpName ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>

                            {isParamedic && (
                                <Form.Group className="mb-3">
                                    <Form.Label>5.2 Nom de compte du forum GTA:W</Form.Label>
                                    <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} required className={`form-control ${!formData.oocForumName ? 'is-invalid' : ''} mb-4`} />
                                </Form.Group>
                            )}
                            {isEMT && (
                                <Form.Group className="mb-3">
                                    <Form.Label>5.2 Capture d'écran non modifiée de votre dossier administratif</Form.Label>
                                    <Form.Control type="text" name="oocAdminRecordLink" value={formData.oocAdminRecordLink || ''} onChange={handleChange} placeholder="Lien direct vers l'image (ex: ImgBB)" required className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''} mb-4`} />
                                </Form.Group>
                            )}

                            <Form.Group className="mb-3">
                                <Form.Label>{isParamedic ? '5.3' : '5.3'} Nom Discord</Form.Label>
                                <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} required className={`form-control ${!formData.oocDiscord ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>{isParamedic ? '5.4' : (isEMT ? '5.4 Nom de compte du forum GTA:W' : '5.4 Fuseau horaire')}</Form.Label>
                                {isEMT ? (
                                    <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} required className={`form-control ${!formData.oocForumName ? 'is-invalid' : ''} mb-4`} />
                                ) : (
                                    <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} placeholder="ex: UTC+0, EST, PST" required className={`form-control ${!formData.oocTimezone ? 'is-invalid' : ''} mb-4`} />
                                )}
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>{isParamedic ? '5.5' : (isEMT ? '5.5 Fuseau horaire' : '5.5 Expérience médicale réelle ou RP médical passé')}</Form.Label>
                                {isEMT ? (
                                    <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} placeholder="ex: UTC+0, EST, PST" required className={`form-control ${!formData.oocTimezone ? 'is-invalid' : ''} mb-4`} />
                                ) : (
                                    <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} placeholder="Décrivez toute expérience pertinente (ou N/A)" required className={`form-control ${!formData.oocMedicalExperience ? 'is-invalid' : ''} mb-4`} />
                                )}
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>{isParamedic ? '5.6 Capture d\'écran non modifiée de votre dossier administratif' : (isEMT ? '5.6 Expérience médicale réelle ou RP médical passé' : '5.6 Dossier administratif')}</Form.Label>
                                {isEMT ? (
                                    <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} placeholder="Décriver toute expérience pertinente (ou N/A)" required className={`form-control ${!formData.oocMedicalExperience ? 'is-invalid' : ''} mb-4`} />
                                ) : (
                                    <Form.Control type="text" name="oocAdminRecordLink" value={formData.oocAdminRecordLink || ''} onChange={handleChange} placeholder="Lien direct vers l'image (ex: ImgBB)" required className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''} mb-4`} />
                                )}
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>5.7 Capture d'écran des statistiques du personnage (/stats)</Form.Label>
                                <Form.Control type="text" name="oocStatsLink" value={formData.oocStatsLink || ''} onChange={handleChange} placeholder="Lien direct vers l'image (ex: ImgBB)" required className={`form-control ${!formData.oocStatsLink ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>5.8 Background du personnage (Bref résumé)</Form.Label>
                                <Form.Control as="textarea" rows={5} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} required className={`form-control ${!formData.charBackground ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                        </div>
                    )}
                </div>
            )}

            {isOtherEMS && (
                <div>
                    <CollapsibleHeader
                        title="4. (( Informations hors personnage ))"
                        isOpen={openSections.oocInfo}
                        onToggle={() => toggleSection('oocInfo')}
                        sectionId="ems-ooc-info-other"
                    />
                    {openSections.oocInfo && (
                        <div id="collapse-ems-ooc-info-other" style={{ paddingTop: '0.5rem' }}>
                            <Form.Group className="mb-3">
                                <Form.Label>4.1 Nom d'utilisateur du panneau de contrôle utilisateur (UCP)</Form.Label>
                                <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} required className={`form-control ${!formData.oocUcpName ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.2 Capture d'écran non modifiée de votre dossier administratif</Form.Label>
                                <Form.Control type="text" name="oocAdminRecordLink" value={formData.oocAdminRecordLink || ''} onChange={handleChange} placeholder="Lien direct vers l'image (ex: ImgBB)" required className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.3 Nom de compte du forum GTA:W</Form.Label>
                                <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} required className={`form-control ${!formData.oocForumName ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.4 Nom Discord</Form.Label>
                                <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange}required className={`form-control ${!formData.oocDiscord ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.5 Fuseau horaire</Form.Label>
                                <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} placeholder="ex: UTC+0, EST, PST" required className={`form-control ${!formData.oocTimezone ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.6 Détenez-vous une licence BLS/ALS valide sur un autre personnage? Si oui, fournir une preuve via /licenses</Form.Label>
                                <Form.Control type="text" name="oocOtherCharLicenseProof" value={formData.oocOtherCharLicenseProof || ''} onChange={handleChange} placeholder="RÉPONSE/LIEN (SI APPLICABLE)" className="form-control mb-4" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.7 Capture d'écran des statistiques du personnage (/stats)</Form.Label>
                                <Form.Control type="text" name="oocStatsLink" value={formData.oocStatsLink || ''} onChange={handleChange} placeholder="Lien direct vers l'image (ex: ImgBB)" required className={`form-control ${!formData.oocStatsLink ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.8 Fournir un lien de preuve de votre DFP de SANFIRE, PHMC et Legal Faction Management:</Form.Label>
                                <Form.Control type="text" name="dfpSanFireLink" value={formData.dfpSanFireLink || ''} onChange={handleChange} placeholder="Lien DFP SAN FIRE (ou N/A)" className="form-control mb-2" />
                                <Form.Control type="text" name="dfpPhmcLink" value={formData.dfpPhmcLink || ''} onChange={handleChange} placeholder="Lien DFP PHMC (ou N/A)" className="form-control mb-2" />
                                <Form.Control type="text" name="dfpLegalFactionLink" value={formData.dfpLegalFactionLink || ''} onChange={handleChange} placeholder="Lien DFP Legal Faction Management (ou N/A)" className="form-control mb-4" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.9 Background du personnage (Bref résumé)</Form.Label>
                                <Form.Control as="textarea" rows={5} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} required className={`form-control ${!formData.charBackground ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default EMSFields;