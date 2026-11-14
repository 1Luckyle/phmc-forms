import React, { useState, useEffect} from 'react'; // Import useEffect
import DeathSignalPicker from './shared/DeathSignalPicker';
import TemporaryIdPicker from './shared/TemporaryIdPicker';
import { Form, Button, InputGroup } from 'react-bootstrap';
import ImagePreview from '../components/ImagePreview';
import DecedentDetailsFields from './shared/DecedentDetailsFields';
import RequestingAuthorityFields from './shared/RequestingAuthorityFields';
import CoronerSelect from './shared/CoronerSelect';
import NameFields from './shared/NameFields';
import DoeChoice from './shared/DoeChoice';
import PlaceWithCity from './shared/PlaceWithCity';
import PresetTextField from './shared/PresetTextField';
import { DEATH_CAUSE_PRESETS } from '../constants/deathPresets';
import { localizeOptions, DEATH_TYPE_FR, MANNER_FR } from '../utils/deathLabels';

const DECEDENT_FIELDS = { full: 'decedentName', first: 'decedentFirstName', middle: 'decedentMiddleName', last: 'decedentLastName', title: 'decedentTitle' };

const DeathReport = ({
    formData,
    handleChange,
    handleSelectChange,
    coronerGroupedOptions,
    setFormData,
    currentUtcTime,
    isUploading,
    handleImageUpload,
    typeOfDeathOptions,
    mannerOfDeathOptions,
    requestingAgencyOptions
}) => {
    // Function to generate the Evidence Locker ID
    const generateEvidenceLockerID = () => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = today.getFullYear().toString().slice(2, 4); // Get last 2 digits of year
        const baseID = `EV-${year}${month}${day}-`;
        // Append whatever the user types
        return baseID;
    };
    const [evidenceLockerChecked, setEvidenceLockerChecked] = useState(formData.evidenceLocker === 'true');

    const setGeneratedEvidenceLockerID = () => {
        setFormData(prev => ({
            ...prev,
            evidenceLockerID: generateEvidenceLockerID()
        }));
    };
useEffect(() => {
        setFormData(prev => ({
            ...prev,
            evidenceLockerID: '',
            evidenceLocker: 'false'
        }));
    }, [setFormData]);

    return (
        <>
            <Form.Label className="form-section-title">Informations générales</Form.Label>
            <CoronerSelect options={coronerGroupedOptions} formData={formData} handleSelectChange={handleSelectChange} />
            <span style={{ fontSize: '0.8em', color: '#9aa7b4', display: 'block', marginTop: '0.5rem' }}>
                Heure actuelle du serveur: {currentUtcTime}
            </span>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Form.Control
                    type="date"
                    name="dateTime"
                    title="Date de l'enquête"
                    value={String(formData.dateTime || '').slice(0, 10)}
                    onChange={handleChange}
                    className="form-control"
                />
                <Button
                    variant="outline-info"
                    size="sm"
                    style={{ height: '38px', lineHeight: '1.5', paddingTop: 0, paddingBottom: 0, display: 'flex', alignItems: 'center', position: 'relative', top: '-10px' }}
                    onClick={() => {
                        const now = new Date();
                        const pad = (n) => n.toString().padStart(2, '0');
                        // Date UTC (celle de l'heure du serveur affichée plus haut) ; seule la date est conservée.
                        const utc = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
                        handleChange({ target: { name: 'dateTime', value: utc } });
                    }}
                >
                    Envoyé sur la scène
                </Button>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Form.Control
                    type="time"
                    name="pronouncedTimeOfDeath"
                    value={formData.pronouncedTimeOfDeath}
                    onChange={handleChange}
                    className="form-control"
                />
                <Button
                    variant="outline-info"
                    size="sm"
                    style={{ height: '38px', lineHeight: '1.5', paddingTop: 0, paddingBottom: 0, display: 'flex', alignItems: 'center', position: 'relative', top: '-10px' }}
                    onClick={() => {
                        const now = new Date();
                        const pad = (n) => n.toString().padStart(2, '0');
                        // Use UTC for accuracy (matches Current Server Time)
                        const time = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
                        handleChange({ target: { name: 'pronouncedTimeOfDeath', value: time } });
                    }}
                >
                    Heure du décès du défunt
                </Button>
            </div>

            <Form.Label className="form-section-title">Appel au Bureau du Coroner</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select name="department" value={formData.department || ''} onChange={handleChange} className="form-control">
                    <option value="" disabled>Agence ayant appelé le Bureau du Coroner</option>
                    {requestingAgencyOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Check
                    type="checkbox"
                    label="Rapport demandé ?"
                    name="showRequestingOfficerInput"
                    checked={formData.showRequestingOfficerInput || false}
                    onChange={handleChange}
                />
            </div>
            {formData.showRequestingOfficerInput && (
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Select name="requestingAgency" value={formData.requestingAgency || ''} onChange={handleChange} className="form-control">
                        <option value="" disabled>Agence de la personne qui demande le rapport</option>
                        {requestingAgencyOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    <Form.Control
                        type="text" name="requestingOfficer" value={formData.requestingOfficer || ''} onChange={handleChange}
                        placeholder="Grade, prénom et nom de la personne qui demande le rapport (ex. Officier John Doe)"
                    />
                </div>
            )}
            <RequestingAuthorityFields formData={formData} handleChange={handleChange} />

            <DeathSignalPicker formData={formData} setFormData={setFormData} />
            <Form.Label className="form-section-title">Défunt</Form.Label>
            <DoeChoice formData={formData} setFormData={setFormData} fields={DECEDENT_FIELDS} showMassFatality />
            <div style={{ display: 'flex', gap: '10px' }}>
                <NameFields
                    formData={formData} setFormData={setFormData} handleChange={handleChange} fields={DECEDENT_FIELDS}
                    placeholders={{ first: 'Prénom du défunt (IC)', middle: 'Deuxième prénom (IC)', last: 'Nom de famille (IC)' }}
                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control type="text" name="decedentOOC" value={formData.decedentOOC} onChange={handleChange} placeholder="(( Discord du joueur (HRP) ))" className="form-control" />
                <Form.Control type="text" name="patientID" value={formData.patientID} onChange={handleChange} placeholder="ID Patient du défunt (obligatoire ; ID temporaire si le défunt n'en a pas)" className="form-control" />
            </div>
            <TemporaryIdPicker formData={formData} setFormData={setFormData} />
            <DecedentDetailsFields formData={formData} handleChange={handleChange} />

            <Form.Label className="form-section-title">Circonstances du décès</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select name="typeOfDeath" value={formData.typeOfDeath} onChange={handleChange} className="form-control">
                    <option value="" disabled>Sélectionner le type de décès</option>
                    {localizeOptions(typeOfDeathOptions, DEATH_TYPE_FR).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <PlaceWithCity formData={formData} setFormData={setFormData} handleChange={handleChange} addressName="placeOfDeath" zipName="placeOfDeathZip" placeholder="Lieu du décès (Numéro, Étage, Rue)" />
            </div>
            {(formData.typeOfDeath === 'CK' || formData.typeOfDeath === 'Character Kill') && (
                <>
                    <Form.Group className="mb-3 upload-container">
                        <InputGroup>
                            <Form.Control
                                type="text"
                                name="decedentAttributes"
                                value={formData.decedentAttributes}
                                onChange={handleChange}
                                className={`form-control`}
                                placeholder="(( Apparence du défunt (( /attributes )) )) (séparés par des virgules)"
                            />
                            <Button variant="success" disabled={isUploading} onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.onchange = (e) => handleImageUpload(e, 'decedentAttributes'); input.click(); }}>
                                <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i> {isUploading ? '...' : ''}
                            </Button>
                        </InputGroup>
                        <span className="helper-text">
                            Télécharger le(s) photographie(s). Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                        </span>
                    </Form.Group>
                </>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select name="mannerOfDeath" value={formData.mannerOfDeath} onChange={handleChange} className="form-control">
                    <option value="" disabled>Sélectionner le mode de décès</option>
                    {localizeOptions(mannerOfDeathOptions, MANNER_FR).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <PresetTextField name="probableCauseOfDeath" formData={formData} setFormData={setFormData} presets={DEATH_CAUSE_PRESETS} placeholder="Autres précisions sur la cause probable du décès" selectPlaceholder="Cause probable du décès (plusieurs choix possibles)…" />
            </div>
            <Form.Label className="form-section-title">Résumé et preuves</Form.Label>
            <Form.Control as="textarea" name="synopsis" value={formData.synopsis} onChange={handleChange} rows="4" placeholder="Résumé de l'enquête sur la scène…" className="form-control" />
            <label>Soumission au casier à preuves:</label>
            <Form.Check
                type="checkbox"
                id="evidenceLocker"
                label="       J'ai soumis des preuves au casier à preuves"
                checked={evidenceLockerChecked}
                onChange={(e) => {
                    setEvidenceLockerChecked(e.target.checked);
                    setFormData(prev => ({
                        ...prev,
                        evidenceLocker: e.target.checked.toString(),
                    }));

                    if (e.target.checked) {
                        setGeneratedEvidenceLockerID();
                    } else {
                        setFormData(prev => ({
                            ...prev,
                            evidenceLockerID: ''
                        }));
                    }
                }}
            />

            {evidenceLockerChecked && (
                <Form.Control
                    type="text"
                    name="evidenceLockerID"
                    value={formData.evidenceLockerID || generateEvidenceLockerID()}
                    onChange={handleChange}
                    placeholder={generateEvidenceLockerID() + " Votre numéro de soumission ici"}
                    className="form-control"
                />
            )}
            <label></label>

            <Form.Group className="mb-3 upload-container">
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        name="scenePhotos"
                        value={formData.scenePhotos}
                        onChange={handleChange}
                        rows="2"
                        // Removed 'required' to allow empty if not applicable, or add validation if always needed
                        className={`form-control ${!formData.scenePhotos && formData.evidenceLocker !== 'true' ? '' : ''}`} // Adjusted validation logic if needed
                        placeholder="Télécharger les photos de la scène (séparées par des virgules)"
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
                                    handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                                    e.preventDefault();
                                    break;
                                }
                            }
                            if (containsUrl && !hasImageItem) {
                                const currentValue = formData.scenePhotos || '';
                                const cursorPos = e.target.selectionStart;
                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                const newValue = currentValue.slice(0, cursorPos) + (cursorPos > 0 ? separator : '') + pastedData + currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, scenePhotos: newValue }));
                                e.preventDefault();
                            }
                        }}
                    />
                    <Button variant="success" disabled={isUploading} onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.onchange = (e) => handleImageUpload(e, 'scenePhotos'); input.click(); }}>
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i> {isUploading ? 'Téléchargement...' : 'Télécharger images'}
                    </Button>
                </InputGroup>
                <span className="helper-text">
                        Télécharger le(s) photographie(s). Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                </span>
<ImagePreview 
    imageUrls={formData.scenePhotos} 
    showPreviews={true}
    onImageRemove={(updatedUrls) => {
        setFormData(prev => ({ ...prev, scenePhotos: updatedUrls }));
    }}
/>             </Form.Group>
            <Form.Group className="mb-3 upload-container">
                <div className="input-group">
                    <Form.Control
                        as="textarea"
                        name="additionalImages"
                        value={formData.additionalImages}
                        onChange={handleChange}
                        rows="2"
                        // Removed 'required' for flexibility
                        className={`form-control`}
                        placeholder="(( Écran de morgue, photos des liaisons (( /cdamages )), rapport de test ADN )) (séparés par des virgules)"
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
                                    handleImageUpload({ target: { files: [file] } }, 'additionalImages');
                                    e.preventDefault();
                                    break;
                                }
                            }
                            if (containsUrl && !hasImageItem) {
                                const currentValue = formData.additionalImages || '';
                                const cursorPos = e.target.selectionStart;
                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                const newValue = currentValue.slice(0, cursorPos) + (cursorPos > 0 ? separator : '') + pastedData + currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, additionalImages: newValue }));
                                e.preventDefault();
                            }
                        }}
                    />
                    <Button variant="success" disabled={isUploading} onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.onchange = (e) => handleImageUpload(e, 'additionalImages'); input.click(); }}>
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i> {isUploading ? 'Téléchargement...' : 'Télécharger images'}
                    </Button>
                </div>
                <span className="helper-text">
                        Télécharger le(s) photographie(s). Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                </span>
<ImagePreview 
    imageUrls={formData.additionalImages} 
    showPreviews={true}
    onImageRemove={(updatedUrls) => {
        setFormData(prev => ({ ...prev, additionalImages: updatedUrls }));
    }}
/>   
             <label>Bugs de la morgue:</label>
                <Form.Check
                    type="checkbox"
                    id="morgueStatus"
                    label="       Cocher si l'écran de morgue est indisponible / cassé / inaccessible"
                    checked={formData.morgueStatus === 'true'}
                    onChange={(e) => setFormData(prev => ({ ...prev, morgueStatus: e.target.checked.toString() }))}
                />        
                    </Form.Group>
        </>
    );
};

export default DeathReport;