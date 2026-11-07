import React, { useEffect } from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';
import FleecaPaymentPanel from '../components/FleecaPaymentPanel';
import StaffBillingNotice from '../components/StaffBillingNotice';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { buildCivilianAutofillValues, applyCivilianAutofill } from '../utils/civilianAutofill';
import { getPrice, usePrices } from '../utils/pricing';
import useBillingRole from '../hooks/useBillingRole';
import ForMyselfBanner from '../components/ForMyselfBanner';
import useMinorTitleGuard from '../hooks/useMinorTitleGuard';
import PatientGeneralInfo from './shared/PatientGeneralInfo';
import EmergencyContactFields from './shared/EmergencyContactFields';
import PresetTextField from './shared/PresetTextField';
import NameFields from './shared/NameFields';
import { HISTORY_PRESETS } from '../constants/historyPresets';

const ATTORNEY_FIELDS = { full: 'attorneyName', first: 'attorneyFirstName', middle: 'attorneyMiddleName', last: 'attorneyLastName', title: 'attorneyTitle' };

// Champs de l'identité actuelle du patient (en-tête) et des nouvelles informations générales (section « Informations générales »).
const CURRENT_FIELDS = {
    id: 'patientID', title: 'patientTitleOptions', full: 'patientName', first: 'patientFirstName', middle: 'patientMiddleName', last: 'patientLastName', dob: 'date',
    address: 'patientAddress', zip: 'patientZIP', phone: 'patientPH', email: 'patientEmail', discord: 'patientDiscord',
};
const NEW_FIELDS = {
    title: 'patientTitleNew', full: 'patientNameNew', first: 'patientFirstNameNew', middle: 'patientMiddleNameNew', last: 'patientLastNameNew', dob: 'patientDateOfBirthNew',
    gender: 'patientGenderNew', race: 'patientRaceNew', address: 'patientAddressNew', zip: 'patientZIPNew', phone: 'patientPHNew', discord: 'patientDiscordNew',
};

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
        color: '#9aa7b4',
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
        color: '#9aa7b4'
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
        color: '#9aa7b4',
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
    UpdateMedicalFile,

}) => {
    usePrices(); // se redessine si un admin change les tarifs

    const calculateCost = () => {
    if (formData.UpdateMedicalFile && formData.UpdateMedicalFile.length > 0) {
      return getPrice('miseAJourDossier'); // prix fixe du service « Mise à jour du dossier » (Boîte à outils → Comptabilité → Tarifs)
    }
    return 0;
  };
    const approximateCost = calculateCost();

    // Si c'est un membre du personnel PHMC/DMEC connecté qui remplit ce
    // formulaire (pas le civil lui-même), le paiement ne doit jamais être
    // demandé ici : c'est au civil de payer, pas au soignant qui remplit le
    // dossier à sa place — sinon le paiement Fleeca ne peut tout simplement
    // pas avoir lieu.
    const { isCivilian, civilianProfile } = useEmployeeAuth();
    const { filledByStaff } = useBillingRole(formData, setFormData);
    const minorGuard = useMinorTitleGuard(formData, setFormData, { titleField: 'patientTitleOptions', dobField: 'date' });
    // Nouveau titre (mise à jour des informations générales) : « Maître (Enfant <18 ans) » imposé à un mineur d'après la nouvelle date de naissance, à défaut la date actuelle.
    const newTitleGuard = useMinorTitleGuard(formData, setFormData, {
        titleField: 'patientTitleNew', dobField: 'patientDateOfBirthNew', fallbackDobField: 'date', minorValue: 'Mstr',
        enabled: !!formData.UpdateMedicalFile?.includes('GeneralInformation'),
    });
    // Répercuté dans formData car le générateur BBCode (fonction pure, sans
    // accès au contexte React) en a besoin pour afficher le bon texte.
    useEffect(() => {
        setFormData(prev => (prev.filledByStaff === filledByStaff ? prev : { ...prev, filledByStaff }));
    }, [filledByStaff, setFormData]);
    // Pré-remplissage depuis le profil Civil connecté — uniquement les champs
    // identité/contact encore vides, aucun champ de santé (le profil Civil
    // n'en contient pas). Le champ de date de naissance s'appelle "date" ici
    // (pas patientDateOfBirth, contrairement aux autres formulaires civils).
    useEffect(() => {
        if (!isCivilian || !civilianProfile) return;
        const autofillValues = buildCivilianAutofillValues(civilianProfile);
        setFormData(prev => applyCivilianAutofill(prev, autofillValues, {
            patientID: 'patientID',
            patientName: 'fullName',
            patientFirstName: 'firstName',
            patientMiddleName: 'middleName',
            patientLastName: 'lastName',
            date: 'dateOfBirth',
            patientAddress: 'address',
            patientPH: 'phone',
            patientEmail: 'email',
            patientDiscord: 'discord',
        }));
    }, [isCivilian, civilianProfile, setFormData]);

    return (
        <>
        <ForMyselfBanner formData={formData} setFormData={setFormData} fields={{ patientID: 'patientID', patientName: 'fullName', patientFirstName: 'firstName', patientMiddleName: 'middleName', patientLastName: 'lastName', date: 'dateOfBirth', patientAddress: 'address', patientPH: 'phone', patientEmail: 'email', patientDiscord: 'discord' }} />
        <Form.Label className="form-section-title">Identité actuelle du patient</Form.Label>
        <PatientGeneralInfo
            formData={formData} setFormData={setFormData} handleChange={handleChange} fields={CURRENT_FIELDS}
            patientTitleOptions={patientTitleOptions || []} guard={minorGuard}
        />

            <Form.Label className="form-section-title">Rubriques à mettre à jour</Form.Label>
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
                className="form-control"
                placeholder="Quels champs souhaitez-vous mettre à jour? (Vous pouvez taper pour rechercher!)"
                styles={customSelectStyles}           
                 />

            {/* Dynamic Sections based on selected options */}
            {formData.UpdateMedicalFile?.includes('GeneralInformation') && (
                    <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}

                <>

        <Form.Label className="form-section-title">Mettre à jour les informations générales</Form.Label>
        <PatientGeneralInfo
            formData={formData} setFormData={setFormData} handleChange={handleChange} fields={NEW_FIELDS}
            patientTitleOptions={patientTitleNew || []} guard={newTitleGuard}
        />
                </>            </div>


            )}

            {formData.UpdateMedicalFile?.includes('EmergencyContact') && (
                    <div style={{ marginTop: '20px' }}>
                        <Form.Label className="form-section-title">Mettre à jour le contact d'urgence</Form.Label>
                        <EmergencyContactFields formData={formData} handleChange={handleChange} setFormData={setFormData} />
                    </div>
            )}

            {formData.UpdateMedicalFile?.includes('Medical History') && (
        <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}
                    <Form.Label className="form-section-title">Mettre à jour l'historique médical</Form.Label>

                <>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                        <Form.Select
                            name="patientBloodType"
                            value={formData.patientBloodType || ""}
                            onChange={handleChange}
                            className="form-control"
                        >
                            <option value="" disabled>Groupe sanguin du patient</option>
                            {patientBloodType.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <PresetTextField name="patientAllergies" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientAllergies} />
                        <PresetTextField name="patientCurrentMedicine" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientCurrentMedicine} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <PresetTextField name="patientChronicDiseases" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientChronicDiseases} />
                        <PresetTextField name="patientNotes" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientNotes} />
                    </div>
                </></div>
            )}
            {formData.UpdateMedicalFile?.includes('MentalHealth') && (
                    <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}

<>                    <Form.Label className="form-section-title">Mettre à jour l'historique de santé mentale</Form.Label>

                                <div style={{ display: 'flex', gap: '10px' }}>

                    <PresetTextField name="patientMental" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientMental} />
                    <PresetTextField name="patientTherapy" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientTherapy} />
                <PresetTextField name="patientTriggers" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientTriggers} />

                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>

                    <PresetTextField name="patientSupport" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientSupport} />
                    <PresetTextField name="patientHarm" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientHarm} />

                                </div>

                </>
                </div>
            )}

            {formData.UpdateMedicalFile?.includes('FamilyHistory') && (
        <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}
                    <Form.Label className="form-section-title">Mettre à jour l'historique familial</Form.Label>
                    <>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}

                    <PresetTextField name="patientFam" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientFam} />
                    <PresetTextField name="patientGenetic" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientGenetic} />
                    <PresetTextField name="patientFamSocial" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientFamSocial} />
                </div></></div>
            )}
            {formData.UpdateMedicalFile?.includes('SocialInformation') && (
                <>
                    <Form.Label className="form-section-title">Mettre à jour les informations sociales</Form.Label>
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
</div>                 <div style={{ display: 'flex', gap: '10px' }}>

                    <PresetTextField name="patientReligion" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientReligion} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
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
                </div></>
            )}
            {formData.UpdateMedicalFile?.includes('Lifestyle') && (
                <>
                                    <Form.Label className="form-section-title">Mettre à jour les informations sur le mode de vie</Form.Label>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <PresetTextField name="patientSmoker" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientSmoker} />
                <PresetTextField name="patientAlcohol" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientAlcohol} />
                <PresetTextField name="patientDrugs" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientDrugs} />
            </div>          
                <div style={{ display: 'flex', gap: '10px' }}>
                    <PresetTextField name="patientExercise" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientExercise} />
                <PresetTextField name="patientDiet" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientDiet} />
                <PresetTextField name="patientSleep" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientSleep} />

            </div>            
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <PresetTextField name="patientSexLife" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientSexLife} />
                <PresetTextField name="patientJobRisks" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientJobRisks} />
                <PresetTextField name="patientHazards" formData={formData} setFormData={setFormData} presets={HISTORY_PRESETS.patientHazards} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    as="textarea"
                    rows="2"
                    name="patientOther"
                    value={formData.patientOther}
                    onChange={handleChange}
                    placeholder="Autres informations"
                    className="form-control"

                />

            </div>            

                </>
            )}
            {formData.UpdateMedicalFile?.includes('AdvancedDirectives') && (
                            <div style={{ marginTop: '20px' }}> {/* Added marginTop for spacing */}

                            <>
                                                <Form.Label className="form-section-title">Mettre à jour les directives anticipées</Form.Label>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                        <Form.Select
                            name="dnr"
                            value={formData.dnr}
                            onChange={handleChange}
                            className="form-control"
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
                            className="form-control"
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
                            className="form-control"
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
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <NameFields
                                        formData={formData} setFormData={setFormData} handleChange={handleChange} fields={ATTORNEY_FIELDS}
                                        placeholders={{ first: 'Prénom du mandataire', middle: 'Deuxième prénom du mandataire', last: 'Nom du mandataire' }}
                                    />
                                </div>
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
                </></div>
            )}

            {approximateCost > 0 && (
                <Form.Label style={{ marginTop: '5px', color: '#28a745', fontWeight: 'bold' }}>
                    Ce service coûtera ${approximateCost.toLocaleString()}.
                </Form.Label>
            )}
            {approximateCost > 0 && filledByStaff && (
                <StaffBillingNotice
                    bbCodeVersion={26}
                    formData={formData}
                    setFormData={setFormData}
                    description={`Mise à jour du dossier médical${formData.patientName ? ' - ' + formData.patientName : ''}`}
                />
            )}
            {approximateCost > 0 && !filledByStaff && (
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
                        Cochez cette case pour générer un lien de paiement Fleeca. Si vous enregistrez sans avoir payé, une facture à votre nom est créée (rappels par mail).
                    </span>
                </Form.Group>
            )}

            {!filledByStaff && (formData.payNow === true || formData.payNow === 'true') && approximateCost > 0 && (
                <FleecaPaymentPanel
                    amount={approximateCost}
                    description={`Mise à jour du dossier médical${formData.patientName ? ' - ' + formData.patientName : ''}`}
                    paymentId={formData.fleecaPaymentId}
                    onPaymentIdChange={(id) => setFormData(prev => ({ ...prev, fleecaPaymentId: id, ...(id ? {} : { paymentProofPhotos: '' }) }))}
                    onPaymentConfirmed={({ paymentLink }) => setFormData(prev => ({ ...prev, paymentProofPhotos: paymentLink }))}
                />
            )}
            <Form.Label></Form.Label>


        </>
    );
};

export default MedicalRelease;
