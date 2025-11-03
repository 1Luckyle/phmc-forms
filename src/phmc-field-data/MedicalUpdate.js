import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';
const customSelectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '38px',
        backgroundColor: '#16202c',
        color: '#eeeeeeb0',
        borderColor: state.isFocused ? '#86b7fe' : '#30363d',
        boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
        '&:hover': {
            borderColor: '#86b7fe'
        }
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#16202c',
        zIndex: 1000,
        border: '1px solid #30363d',
        borderRadius: '0.375rem'
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#30363d' : '#16202c',
        color: '#eeeeeeb0',
        padding: '0.5rem 1rem',
        '&:hover': {
            backgroundColor: '#30363d'
        }
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: '#30363d',
        color: '#eeeeeeb0'
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#6c757d',
        '&:hover': {
            backgroundColor: '#dc3545',
            color: '#fff'
        }
    }),
    input: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    placeholder: (base) => ({
        ...base,
        color: '#6c757d'
    }),
    singleValue: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    group: (base) => ({
        ...base,
        paddingTop: 8,
        paddingBottom: 8
    }),
    groupHeading: (base) => ({
        ...base,
        color: '#6c757d',
        fontWeight: 600,
        textTransform: 'uppercase',
        fontSize: '0.75rem',
        marginBottom: 4
    })
};

const MedicalRelease = ({
    formData,
    handleChange,
    setFormData,
    patientTitleOptions,
    patientBloodType,
    numberChildren,
    maritalStatus,
    patientTitleNew,
    dnrOrder,
    financialStatus,
    attorney,
    dnr,
    handleImageUpload,
    UpdateMedicalFile,
    isUploading,

}) => {

    const calculateCost = () => {
    if (formData.UpdateMedicalFile && formData.UpdateMedicalFile.length > 0) {
      return 1000; // Fixed price for "Update Medical File" service
    }
    return 0;
  };
    const approximateCost = calculateCost();

    return (
        <>
        <Form.Label>Titre / Prénom (Deuxième Prénom) & Nom du patient / Date de naissance</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Select
            name="patientTitleOptions"
            value={formData.patientTitleOptions}
            onChange={handleChange}
            required
            className={`form-control ${!formData.patientTitleOptions ? 'is-invalid' : ''}`}
        >
            <option value="" disabled>Titre</option>
            {/* Ensure patientTitle (the options array) is not null/undefined before mapping */}
            {(patientTitleOptions || []).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </Form.Select>
                <Form.Control
                    type="text"
                    name="patientName"
                    value={formData.patientName}
                    onChange={handleChange}
                    placeholder="Prénom & Nom du patient"
                    required
                    className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}

                />
    <Form.Control
      type="date"
      name="date"
      value={formData.date}
      onChange={handleChange}
      placeholder="Date de naissance"
      required
      className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
    />

                </div>


            <div className="input-group">        
                  <Form.Control
    type="text"
    name="patientAddress"
    value={formData.patientAddress}
    onChange={handleChange}
    placeholder="Adresse du domicile du patient"
    required
    className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}
  />
                                                       
         <Form.Control
                    type="text"
                    name="patientPH"
                    value={formData.patientPH}
                    onChange={handleChange}
                    placeholder="Numéro de téléphone du patient"
                    required
                    className={`form-control ${!formData.patientPH ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientDiscord"
                    value={formData.patientDiscord}
                    onChange={handleChange}
                    placeholder="(( Pseudo Discord du patient )) "
                    required
                    className={`form-control ${!formData.patientDiscord ? 'is-invalid' : ''}`}

                />
            </div>

            <Form.Label>Options de mise à jour du dossier médical</Form.Label>
            <Select
                isMulti
                name="UpdateMedicalFile"
                value={(UpdateMedicalFile || []).filter(option =>
                    formData.UpdateMedicalFile?.includes(option.value)
                )}
                onChange={(selectedOptions) => {
                    setFormData(prev => ({
                        ...prev,
                        UpdateMedicalFile: selectedOptions ? selectedOptions.map(option => option.value) : []
                    }));
                }}
                options={UpdateMedicalFile || []}
                className={`form-control ${!formData.UpdateMedicalFile || formData.UpdateMedicalFile.length === 0 ? 'is-invalid' : ''}`}
                placeholder="Quels champs souhaitez-vous mettre à jour? (Vous pouvez taper pour rechercher!)"
                styles={customSelectStyles}           
                 />

            {/* Dynamic Sections based on selected options */}
            {formData.UpdateMedicalFile?.includes('GeneralInformation') && (
                    <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}

                <>

        <Form.Label>Mettre à jour les informations générales </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Select
            name="patientTitleNew"
            value={formData.patientTitleNew}
            onChange={handleChange}
            required
            className={`form-control ${!formData.patientTitleNew ? 'is-invalid' : ''}`}
        >
            <option value="" disabled>Titre</option>
            {(patientTitleNew || []).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </Form.Select>
                <Form.Control
                    type="text"
                    name="patientNameNew"
                    value={formData.patientNameNew}
                    onChange={handleChange}
                    placeholder="Prénom & Nom du patient"
                    required
                    className={`form-control ${!formData.patientNameNew ? 'is-invalid' : ''}`}

                />

                <Form.Control
                    type="date"
                    name="patientDateOfBirthNew"
                    value={formData.patientDateOfBirthNew}
                    onChange={handleChange}
                    placeholder="Date de naissance"
                    required
                    className={`form-control ${!formData.patientDateOfBirthNew ? 'is-invalid' : ''}`}

                />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Control
                    type="text"
                    name="patientAddressNew"
                    value={formData.patientAddressNew}
                    onChange={handleChange}
                    placeholder="Adresse du domicile du patient"
                    required
                    className={`form-control ${!formData.patientAddressNew ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientAddressNew"
                    value={formData.patientGenderNew}
                    onChange={handleChange}
                    placeholder="Genre à l'état civil du patient"
                    required
                    className={`form-control ${!formData.patientGenderNew ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientRaceNew"
                    value={formData.patientRaceNew}
                    onChange={handleChange}
                    placeholder="Ethnicité du patient"
                    required
                    className={`form-control ${!formData.patientRaceNew ? 'is-invalid' : ''}`}

                />

            </div>            

            <div className="input-group">                                                               
         <Form.Control
                    type="text"
                    name="patientPHNew"
                    value={formData.patientPHNew}
                    onChange={handleChange}
                    placeholder="Numéro de téléphone du patient"
                    required
                    className={`form-control ${!formData.patientPHNew ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientDiscordNew"
                    value={formData.patientDiscordNew}
                    onChange={handleChange}
                    placeholder="(( Pseudo Discord du patient )) "
                    required
                    className={`form-control ${!formData.patientDiscordNew ? 'is-invalid' : ''}`}

                />
            </div>
                </>            </div>


            )}

            {formData.UpdateMedicalFile?.includes('MentalHealth') && (
                    <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}

<>                    <Form.Label>Mettre à jour l'historique de santé mentale</Form.Label>

                                <div style={{ display: 'flex', gap: '10px' }}>

                    <Form.Control
                        type="text"
                        name="patientMental"
                        value={formData.patientMental}
                        onChange={handleChange}
                        placeholder="Troubles de santé mentale diagnostiqués"
                    />
                    <Form.Control
                        type="text"
                        name="patientTherapy"
                        value={formData.patientTherapy}
                        onChange={handleChange}
                        placeholder="Thérapies et séances de conseil"
                    />
                <Form.Control
                        type="text"
                        name="patientTriggers"
                        value={formData.patientTriggers}
                        onChange={handleChange}
                        placeholder="Déclencheurs ou phobies sensoriels"
                    />

                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>

                    <Form.Control
                        type="text"
                        name="patientSupport"
                        value={formData.patientSupport}
                        onChange={handleChange}
                        placeholder="Soutien et mécanismes d'adaptation personnels"
                    />
                    <Form.Control
                        type="text"
                        name="patientHarm"
                        value={formData.patientHarm}
                        onChange={handleChange}
                        placeholder="Historique d'automutilation ou tentatives"
                    />

                                </div>

                </>
                </div>
            )}

            {formData.UpdateMedicalFile?.includes('EmergencyContact') && (
                                    <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}

<>                    <Form.Label>Mettre à jour les informations de contact d'urgence</Form.Label>
                        <div style={{ display: 'flex', gap: '10px'}}> {/* Added marginTop */}
                        <Form.Control
                            type="text"
                            name="patientEmergencyContact"
                            value={formData.patientEmergencyContact}
                            onChange={handleChange}
                            placeholder="Prénom & Nom complet du contact d'urgence"
                            required
                            className={`form-control ${!formData.patientEmergencyContact ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientEmergencyContactRelation"
                            value={formData.patientEmergencyContactRelation}
                            onChange={handleChange}
                            placeholder="Relation du contact d'urgence avec le patient"
                            required
                            className={`form-control ${!formData.patientEmergencyContactRelation ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientEmergencyContactNumber"
                            value={formData.patientEmergencyContactNumber}
                            onChange={handleChange}
                            placeholder="Numéro de téléphone du contact d'urgence"
                            required
                            className={`form-control ${!formData.patientEmergencyContactNumber ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientEmergencyContactDiscord"
                            value={formData.patientEmergencyContactDiscord}
                            onChange={handleChange}
                            placeholder="(( Pseudo Discord du contact d'urgence )) "
                            required
                            className={`form-control ${!formData.patientEmergencyContactDiscord ? 'is-invalid' : ''}`}
                        />
                    </div>
                </> </div>
            )}

            {formData.UpdateMedicalFile?.includes('Medical History') && (
        <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}
                    <Form.Label>Mettre à jour l'historique médical</Form.Label>

                <>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                        <Form.Select
                            name="patientBloodType"
                            value={formData.patientBloodType || ""}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.patientBloodType ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Groupe sanguin du patient</option>
                            {patientBloodType.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientAllergies"
                            value={formData.patientAllergies}
                            onChange={handleChange}
                            placeholder="Allergies connues"
                            required
                            className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientCurrentMedicine"
                            value={formData.patientCurrentMedicine}
                            onChange={handleChange}
                            placeholder="Médicaments actuels"
                            required
                            className={`form-control ${!formData.patientCurrentMedicine ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientChronicDiseases"
                            value={formData.patientChronicDiseases}
                            onChange={handleChange}
                            placeholder="Maladies chroniques"
                            required
                            className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientNotes"
                            value={formData.patientNotes}
                            onChange={handleChange}
                            placeholder="Traumatismes et blessures"
                            required
                            className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
                        />
                    </div>
                </></div>
            )}
            {formData.UpdateMedicalFile?.includes('FamilyHistory') && (
        <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}
                    <Form.Label>Mettre à jour l'historique médical</Form.Label>
                    <>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}

                    <Form.Control
                        type="text"
                        name="patientFam"
                        value={formData.patientFam}
                        onChange={handleChange}
                        placeholder="Membres de la famille immédiate"
                    />
                    <Form.Control
                        type="text"
                        name="patientGenetic"
                        value={formData.patientGenetic}
                        onChange={handleChange}
                        placeholder="Maladies génétiques connues"
                    />
                    <Form.Control
                        type="text"
                        name="patientFamSocial"
                        value={formData.patientFamSocial}
                        onChange={handleChange}
                        placeholder="Antécédents sociaux familiaux"
                    />
                </div></></div>
            )}
            {formData.UpdateMedicalFile?.includes('SocialInformation') && (
                <>
                    <Form.Label>Mettre à jour les informations sociales</Form.Label>
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
</div>                 <div style={{ display: 'flex', gap: '10px' }}>

                    <Form.Control
                        type="text"
                        name="patientReligion"
                        value={formData.patientReligion}
                        onChange={handleChange}
                        placeholder="Considérations culturelles et/ou religieuses"
                    />
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
                </div></>
            )}
            {formData.UpdateMedicalFile?.includes('Lifestyle') && (
                <>
                                    <Form.Label>Mettre à jour les informations sur le mode de vie</Form.Label>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Control
                    type="text"
                    name="patientSmoker"
                    value={formData.patientSmoker}
                    onChange={handleChange}
                    placeholder="Habitudes de tabagisme"
                    required
                    className={`form-control ${!formData.patientSmoker ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientAlcohol"
                    value={formData.patientAlcohol}
                    onChange={handleChange}
                    placeholder="Consommation d'alcool"
                    required
                    className={`form-control ${!formData.patientAlcohol ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="Other Substances"
                    value={formData.patientDrugs}
                    onChange={handleChange}
                    placeholder="Consommation de drogue et autres substances"
                    required
                    className={`form-control ${!formData.patientDrugs ? 'is-invalid' : ''}`}

                />
            </div>          
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Control
                    type="text"
                    name="patientExercise"
                    value={formData.patientExercise}
                    onChange={handleChange}
                    placeholder="Habitudes d'exercice du patient"
                    required
                    className={`form-control ${!formData.patientExercise ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientDiet"
                    value={formData.patientDiet}
                    onChange={handleChange}
                    placeholder="Habitudes alimentaires"
                    required
                    className={`form-control ${!formData.patientDiet ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientSleep"
                    value={formData.patientSleep}
                    onChange={handleChange}
                    placeholder="Habitudes de sommeil"
                    required
                    className={`form-control ${!formData.patientSleep ? 'is-invalid' : ''}`}

                />

            </div>            
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Control
                    type="text"
                    name="patientSexLife"
                    value={formData.patientSexLife}
                    onChange={handleChange}
                    placeholder="Santé sexuelle"
                    required
                    className={`form-control ${!formData.patientSexLife ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientJobRisks"
                    value={formData.patientJobRisks}
                    onChange={handleChange}
                    placeholder="Risques ou dangers professionnels"
                    required
                    className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientHazards"
                    value={formData.patientHazards}
                    onChange={handleChange}
                    placeholder="Dangers environnementaux ou expositions"
                    required
                    className={`form-control ${!formData.patientHazards ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientOther"
                    value={formData.patientOther}
                    onChange={handleChange}
                    placeholder="Autres informations"
                    required
                    className={`form-control ${!formData.patientOther ? 'is-invalid' : ''}`}

                />

            </div>            

                </>
            )}
            {formData.UpdateMedicalFile?.includes('AdvancedDirectives') && (
                            <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}

                            <>
                                                <Form.Label>Mettre à jour les directives anticipées</Form.Label>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                        <Form.Select
                            name="dnr"
                            value={formData.dnr}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.dnr ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Testament de vie</option>
                            {dnr.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <Form.Select
                            name="attorney"
                            value={formData.attorney}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.attorney ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Procuration pour soins de santé</option>
                            {attorney.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <Form.Select
                            name="dnrOrder"
                            value={formData.dnrOrder}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.dnrOrder ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Ordre de non-réanimation </option>
                            {dnrOrder.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {formData.dnr === 'other' && (
                            <Form.Control
                                type="text"
                                name="dnrOther"
                                value={formData.dnrOther}
                                onChange={handleChange}
                                placeholder="Autres instructions de testament de vie"
                                required
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
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    type="text"
                                    name="attorneyRelation"
                                    value={formData.attorneyRelation}
                                    onChange={handleChange}
                                    placeholder="Relation du mandataire"
                                    required
                                    className={`form-control ${!formData.attorneyRelation ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="attorneyPH"
                                    value={formData.attorneyPH}
                                    onChange={handleChange}
                                    placeholder="Numéro de téléphone du mandataire"
                                    required
                                    className="form-control"
                                />
                            </> 
                        )}                     

                    </div>
                </></div>
            )}

            {approximateCost > 0 && (
                <Form.Label style={{ marginTop: '5px', color: '#28a745', fontWeight: 'bold' }}>
                    Ce service coûtera ${approximateCost.toLocaleString()}.
                </Form.Label>
            )}
            {approximateCost > 0 && (
                <Form.Group className="mb-3" style={{ marginTop: '15px' }}>
                    <Form.Check
                        type="checkbox"
                        id="payNowCheckbox"
                        label=" Payer maintenant?"
                        checked={formData.payNow === true || formData.payNow === 'true'}
                        onChange={(e) => {
                            setFormData(prev => ({
                                ...prev,
                                payNow: e.target.checked,
                            }));
                        }}
                    />
                    <span className="helper-text">
                        Cochez cette case si vous souhaitez fournir une preuve de paiement maintenant. Redirection: <a href="https://banking.gta.world/transfer" target="_blank" rel="noopener noreferrer">020000062</a> Veuillez vous connecter à Fleeca avant le paiement.
                    </span>
                </Form.Group>
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
                    <span className="helper-text">
                        Télécharger la preuve de paiement. Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                    </span>
                    {formData.paymentProofPhotos && formData.paymentProofPhotos.split(',').map((url, index) => (
                        url.trim() && <img key={index} src={url.trim()} alt={`Preuve de paiement ${index + 1}`} style={{ maxWidth: '100px', maxHeight: '100px', marginTop: '5px', marginRight: '5px', border: '1px solid #30363d' }} />
                    ))}
                </Form.Group>
            )}
            <Form.Label></Form.Label>


        </>
    );
};

export default MedicalRelease;
