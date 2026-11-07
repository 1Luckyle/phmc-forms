import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import ImagePreview from '../components/ImagePreview';
import CoronerSelect from './shared/CoronerSelect';
import PlaceWithCity from './shared/PlaceWithCity';
import PresetTextField from './shared/PresetTextField';
import ZipCityField from '../components/ZipCityField';
import { splitFullName, joinFullName } from '../utils/patientIdentity';
import { DEATH_CAUSE_PRESETS } from '../constants/deathPresets';
import { localizeOptions, DEATH_TYPE_FR, MANNER_FR } from '../utils/deathLabels';
const defaultDecedent = {
    decedentName: '',
    decedentOOC: '',
    patientID: '',
    dateTime: '',
    pronouncedTimeOfDeath: '',
    department: '',
    requestingOfficer: '',
    typeOfDeath: '',
    placeOfDeath: '',
    mannerOfDeath: '',
    synopsis: '',
    evidenceLocker: 'false',
    evidenceLockerID: '',
    probableCauseOfDeath: '',
    scenePhotos: '',
    additionalImages: '',
    morgueStatus: 'false',
    collapsed: false, // Added for collapsable functionality
};
// Nom d'un défunt en trois parties (anciens rapports : découpé depuis le nom complet).
const partsOf = (dec) => ((dec.decedentFirstName || dec.decedentMiddleName || dec.decedentLastName)
    ? { first: dec.decedentFirstName || '', middle: dec.decedentMiddleName || '', last: dec.decedentLastName || '' }
    : splitFullName(dec.decedentName));
const isDoe = (dec, first) => {
    const parts = partsOf(dec);
    return parts.first.trim() === first && parts.last.trim() === 'Doe' && !parts.middle.trim();
};

const isDecedentComplete = (dec) => {
    return (
        dec.decedentName.trim() !== '' &&
        dec.decedentOOC.trim() !== '' &&
        dec.pronouncedTimeOfDeath.trim() !== '' &&
        dec.typeOfDeath.trim() !== '' &&
        dec.placeOfDeath.trim() !== '' &&
        dec.mannerOfDeath.trim() !== '' &&
        dec.probableCauseOfDeath.trim() !== ''
    );
};

const CollapsibleHeader = ({ title, isOpen, onToggle, sectionId, onRemove, showRemoveButton }) => (
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
        <span>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center' }}>
            {showRemoveButton && (
                <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ marginRight: '10px' }}>
                    Retirer
                </Button>
            )}
            <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ marginLeft: '10px' }}></i>
        </span>
    </Button>
);

const MassFatality = ({
    formData,
    handleChange,
    handleSelectChange,
    setFormData,
    isUploading,
    handleImageUpload,
    typeOfDeathOptions,
    mannerOfDeathOptions,
    requestingAgencyOptions,
    currentUtcTime,
    coronerGroupedOptions,
}) => {
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

    

    const addDecedent = () => {
        setFormData(prevFormData => ({
            ...prevFormData,
            decedents: [...(prevFormData.decedents || []), { ...defaultDecedent, collapsed: false }]
        }));
    };

    const updateDecedent = (index, field, value) => {
        setFormData(prevFormData => ({
            ...prevFormData,
            decedents: prevFormData.decedents.map((dec, i) => {
                if (i === index) {
                    // Only update the field value, not the collapsed state
                    return { ...dec, [field]: value };
                }
                return dec;
            })
        }));
    };

    useEffect(() => {
        // This effect runs once on mount to collapse any decedents that are already complete.
        setFormData(prevFormData => {
            if (!prevFormData.decedents) return prevFormData;
            const updatedDecedents = prevFormData.decedents.map(dec => ({
                ...dec,
                collapsed: isDecedentComplete(dec)
            }));
            return { ...prevFormData, decedents: updatedDecedents };
        });
    }, []); // Empty dependency array ensures this runs only once on mount

    const toggleCollapse = (index) => {
        setFormData(prevFormData => ({
            ...prevFormData,
            decedents: prevFormData.decedents.map((dec, i) => {
                if (i === index) {
                    return { ...dec, collapsed: !dec.collapsed };
                }
                return dec;
            })
        }));
    };

    const removeDecedent = (index) => {
        setFormData(prevFormData => ({
            ...prevFormData,
            decedents: prevFormData.decedents.filter((_, i) => i !== index)
        }));
    };

    const patchDecedent = (index, patch) => setFormData((prev) => ({
        ...prev,
        decedents: prev.decedents.map((dec, i) => (i === index ? { ...dec, ...(typeof patch === 'function' ? patch(dec) : patch) } : dec)),
    }));

    const setNamePart = (index, part, value) => patchDecedent(index, (dec) => {
        const next = { ...partsOf(dec), [part]: value };
        return { decedentFirstName: next.first, decedentMiddleName: next.middle, decedentLastName: next.last, decedentName: joinFullName(next.first, next.middle, next.last) };
    });

    // John / Jane Doe : se cochent et se décochent ; la case se décoche toute seule dès qu'un autre nom est saisi.
    const toggleDoe = (index, first, checked) => patchDecedent(index, {
        decedentFirstName: checked ? first : '', decedentMiddleName: '', decedentLastName: checked ? 'Doe' : '', decedentName: checked ? `${first} Doe` : '',
    });

    return (
        <>
            <Form.Label className="form-section-title">Informations générales</Form.Label>
            <CoronerSelect options={coronerGroupedOptions} formData={formData} handleSelectChange={(option) => handleSelectChange(option, 'coronerEmployee')} />
            <Form.Label>
                Heure d'envoi
                <span style={{ fontSize: '0.8em', color: '#9aa7b4', marginLeft: '10px' }}>
                    (Heure actuelle du serveur: {currentUtcTime})
                </span>
            </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="datetime-local"
                    name="dateTime"
                    value={formData.dateTime}
                    onChange={handleChange}
                    className="form-control"
                />
            </div>
            <Form.Label>Lieu de l'incident</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <PlaceWithCity formData={formData} setFormData={setFormData} handleChange={handleChange} addressName="placeOfDeath" zipName="placeOfDeathZip" placeholder="Lieu de l'incident (Numéro, Étage, Rue)" />
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
                        type="text"
                        name="requestingOfficer"
                        value={formData.requestingOfficer || ''}
                        onChange={handleChange}
                        placeholder="Grade, prénom et nom de la personne qui demande le rapport (ex. Officier John Doe)"
                    />
                </div>
            )}

            <Form.Label className="form-section-title">Résumé de l'incident</Form.Label>
            <Form.Control as="textarea" name="synopsis" value={formData.synopsis} onChange={handleChange} rows="4" placeholder="Résumé de l'incident (ce qui s'est passé, nombre de victimes, circonstances…)" className="form-control" />

            <Form.Label className="form-section-title">Défunts</Form.Label>
            <Button variant="primary" onClick={addDecedent} style={{ marginBottom: '1rem' }}>
                Ajouter un nouveau défunt
            </Button>
            {(formData.decedents || []).map((dec, idx) => (
                <div key={idx}>
                    <CollapsibleHeader
                        title={`Informations du défunt #${idx + 1}`}
                        isOpen={!dec.collapsed}
                        onToggle={() => toggleCollapse(idx)}
                        sectionId={`decedent-${idx}`}
                        onRemove={() => removeDecedent(idx)}
                        showRemoveButton={formData.decedents.length > 1}
                    />
                    {!dec.collapsed && (
                        <div id={`decedent-collapse-${idx}`}>
                        <div data-guide-zone>
                            <div className="radio-inline-container">
                                <div className="radio-button-group">
                                    <Form.Check type="checkbox" id={`johnDoe-${idx}`} label="   John Doe" checked={isDoe(dec, 'John')} onChange={(e) => toggleDoe(idx, 'John', e.target.checked)} inline />
                                    <Form.Check type="checkbox" id={`janeDoe-${idx}`} label="   Jane Doe" checked={isDoe(dec, 'Jane')} onChange={(e) => toggleDoe(idx, 'Jane', e.target.checked)} inline />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" value={partsOf(dec).first} placeholder="Prénom du défunt (IC)" onChange={(e) => setNamePart(idx, 'first', e.target.value)} required={idx === 0} data-guide="Prénom du défunt, tel que son personnage. Le premier défunt doit avoir un nom." />
                                <Form.Control type="text" value={partsOf(dec).middle} placeholder="Deuxième prénom (IC)" onChange={(e) => setNamePart(idx, 'middle', e.target.value)} data-guide="Deuxième prénom du défunt, s'il en a un." />
                                <Form.Control type="text" value={partsOf(dec).last} placeholder="Nom de famille (IC)" onChange={(e) => setNamePart(idx, 'last', e.target.value)} required={idx === 0} data-guide="Nom de famille du défunt, tel que son personnage." />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" value={dec.decedentOOC} placeholder="(( Discord du joueur (HRP) ))" onChange={(e) => updateDecedent(idx, 'decedentOOC', e.target.value)} data-guide="Discord du joueur du défunt, hors jeu de rôle." />
                                <Form.Control type="text" value={dec.patientID || ''} placeholder="ID Patient (le défunt n'était peut-être pas patient du PHMC)" onChange={(e) => updateDecedent(idx, 'patientID', e.target.value)} data-guide="ID du défunt s'il était patient du PHMC (PHMC-2752)." />
                            </div>
                            <Form.Label>Heure du décès prononcée</Form.Label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="datetime-local" value={dec.pronouncedTimeOfDeath} onChange={(e) => updateDecedent(idx, 'pronouncedTimeOfDeath', e.target.value)} data-guide="Date et heure à laquelle le décès a été prononcé." />
                                <Form.Select value={dec.typeOfDeath} onChange={(e) => updateDecedent(idx, 'typeOfDeath', e.target.value)} data-guide="Type de décès : PK (mort du joueur) ou CK (mort définitive du personnage).">
                                    <option value="" disabled>Sélectionner le type de décès</option>
                                    {localizeOptions(typeOfDeathOptions, DEATH_TYPE_FR).map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </Form.Select>
                            </div>
                            <Form.Label>Lieu du décès</Form.Label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" value={dec.placeOfDeath} placeholder="Lieu du décès (Numéro, Étage, Rue)" onChange={(e) => updateDecedent(idx, 'placeOfDeath', e.target.value)} data-guide="Adresse du lieu où le défunt est décédé." />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <ZipCityField zip={dec.placeOfDeathZip || ''} onZipChange={(zip) => updateDecedent(idx, 'placeOfDeathZip', zip)} placeholder="Code postal" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Select value={dec.mannerOfDeath} onChange={(e) => updateDecedent(idx, 'mannerOfDeath', e.target.value)} data-guide="Mode du décès : naturelle, accidentelle, suicide, homicide ou indéterminée.">
                                    <option value="" disabled>Sélectionner le mode de décès</option>
                                    {localizeOptions(mannerOfDeathOptions, MANNER_FR).map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </Form.Select>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <PresetTextField
                                    name="probableCauseOfDeath" formData={dec}
                                    setFormData={(updater) => patchDecedent(idx, (current) => updater(current))}
                                    presets={DEATH_CAUSE_PRESETS} placeholder="Autres précisions sur la cause probable du décès" selectPlaceholder="Cause probable du décès (plusieurs choix possibles)…"
                                />
                            </div>
                        </div>
                            <Form.Group className="mb-3">
                                <Form.Label>Blessures du défunt / Points à noter</Form.Label>
                                <Form.Control as="textarea" rows={3} value={dec.synopsis} onChange={e => updateDecedent(idx, 'synopsis', e.target.value)} placeholder="Blessures constatées, éléments notables…" data-guide="Blessures constatées sur le défunt et éléments à noter." />
                            </Form.Group>
                            <Form.Group className="mb-3">
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
                            </Form.Group>
                            <Form.Group className="mb-3 upload-container">
                                <Form.Label>Photos de la scène</Form.Label>
                                <InputGroup>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        value={dec.scenePhotos}
                                        onChange={e => updateDecedent(idx, 'scenePhotos', e.target.value)}
                                        placeholder="Télécharger les photos de la scène (séparées par des virgules)"
                                        onPaste={e => {
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
                                                    handleImageUpload({ target: { files: [file] } }, `scenePhotos-${idx}`);
                                                    e.preventDefault();
                                                    break;
                                                }
                                            }
                                            if (containsUrl && !hasImageItem) {
                                                const currentValue = dec.scenePhotos || '';
                                                const cursorPos = e.target.selectionStart;
                                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                                const newValue = currentValue.slice(0, cursorPos) +
                                                    (cursorPos > 0 ? separator : '') +
                                                    pastedData +
                                                    currentValue.slice(cursorPos);
                                                updateDecedent(idx, 'scenePhotos', newValue);
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
                                            input.onchange = (e) => handleImageUpload(e, `scenePhotos-${idx}`);
                                            input.click();
                                        }}
                                    >
                                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                        {isUploading ? ' Téléchargement...' : ' Télécharger image(s)'}
                                    </Button>
                                </InputGroup>
                                <ImagePreview imageUrls={dec.scenePhotos} />
                                <span className="helper-text">
                                    Télécharger le(s) photographie(s). Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                                </span>
                            </Form.Group>
                            <Form.Group className="mb-3 upload-container">
                                <Form.Label>Images de la morgue, des liaisons et DNA</Form.Label>
                                <InputGroup>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        value={dec.additionalImages}
                                        onChange={e => updateDecedent(idx, 'additionalImages', e.target.value)}
                                        placeholder="(( Écran de morgue, photos des liaisons (( /cdamages )), rapport de test ADN )) (séparés par des virgules)"
                                        onPaste={e => {
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
                                                    handleImageUpload({ target: { files: [file] } }, `additionalImages-${idx}`);
                                                    e.preventDefault();
                                                    break;
                                                }
                                            }
                                            if (containsUrl && !hasImageItem) {
                                                const currentValue = dec.additionalImages || '';
                                                const cursorPos = e.target.selectionStart;
                                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                                const newValue = currentValue.slice(0, cursorPos) +
                                                    (cursorPos > 0 ? separator : '') +
                                                    pastedData +
                                                    currentValue.slice(cursorPos);
                                                updateDecedent(idx, 'additionalImages', newValue);
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
                                            input.onchange = (e) => handleImageUpload(e, `additionalImages-${idx}`);
                                            input.click();
                                        }}
                                    >
                                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                        {isUploading ? ' Téléchargement...' : ' Télécharger image(s)'}
                                    </Button>
                                </InputGroup>
                                <ImagePreview imageUrls={dec.additionalImages} />
                                <span className="helper-text">
                                    Télécharger le(s) photographie(s). Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                                </span>
                                <label>Bugs de la morgue:</label>
                                <Form.Check
                                    type="checkbox"
                                    id={`morgueStatus-${idx}`}
                                    label="       Cocher si l'écran de morgue est indisponible / cassé / inaccessible"
                                    checked={dec.morgueStatus === 'true' || dec.morgueStatus === true}
                                    onChange={(e) => updateDecedent(idx, 'morgueStatus', e.target.checked.toString())}
                                />
                            </Form.Group>
                            
                        </div>
                    )}
                </div>
            ))}
        </>
    );
};

export default MassFatality;