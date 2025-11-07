import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select'; // Make sure react-select is imported
import ImagePreview from '../components/ImagePreview';

// Destructure the props that this component will need from App.js
const PHMCCommentaryNoteQuestions = ({
    formData,
    handleChange,
    setShowEmployeeModal,
    phmcGroupedOptions,
    isUploading,
    handleImageUpload, 
    setFormData // We need this for the Select's onChange logic
}) => {
    return (
        <>
            {/* The JSX code block for bbCodeVersion === 22 */}
            <Form.Control
                type="text"
                name="patientID"
                value={formData.patientID}
                onChange={handleChange}
                placeholder="ID Patient (Prénom (Deuxième Prénom) & Nom du patient si incertain)"
                required
                className="form-control"
            />

            <Form.Label>Date d'émission de l'ordonnance:</Form.Label>
            <Form.Control
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="form-control"
            />
            <Form.Control
                type="text" 
                name="drugName"
                value={formData.drugName}
                onChange={handleChange}
                placeholder="Nom du médicament"
                required
                className={`form-control ${!formData.drugName ? 'is-invalid' : ''}`}
            />
            <Form.Control
                type="text" 
                name="drugDiag"
                value={formData.drugDiag}
                onChange={handleChange}
                placeholder="Diagnostic / Raison du médicament"
                required
                className={`form-control ${!formData.drugDiag ? 'is-invalid' : ''}`}
            />
            <Form.Control
                type="text" 
                name="drugStr"
                value={formData.drugStr}
                onChange={handleChange}
                placeholder="Dosage du médicament"
                required
                className={`form-control ${!formData.drugStr ? 'is-invalid' : ''}`}
            />
            <Form.Control
                type="text" 
                name="drugCourse"
                value={formData.drugCourse}
                onChange={handleChange}
                placeholder="Durée du traitement"
                required
                className={`form-control ${!formData.drugCourse ? 'is-invalid' : ''}`}
            />
            <Form.Group className="mb-3 upload-container">
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        name="scenePhotos"
                        value={formData.scenePhotos}
                        onChange={handleChange}
                        rows="2"
                        required
                        className={`form-control ${!formData.scenePhotos ? 'is-invalid' : ''}`}
                        placeholder="Coller l'URL ou télécharger une image du/des bon/s de prescription dans cette section à des fins d'archivage. (si applicable) (séparées par des virgules)"
                        onPaste={(e) => { // Keep the paste logic
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
                                const newValue = currentValue.slice(0, cursorPos) +
                                    (cursorPos > 0 ? separator : '') +
                                    pastedData +
                                    currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, scenePhotos: newValue }));
                                e.preventDefault();
                            } else {
                                console.log('No URL detected or image item present');
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
                            input.onchange = (e) => handleImageUpload(e, 'scenePhotos');
                            input.click();
                        }}
                    >
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                        {isUploading ? 'Téléchargement...' : 'Télécharger images'}
                    </Button>
                </InputGroup>
                <ImagePreview imageUrls={formData.scenePhotos} />
                <span className="helper-text">Télécharger une image du bon de prescription si applicable. Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.</span>
            </Form.Group>
            <Form.Group className="mb-3 upload-container">
                <div className="input-group">
                    <Form.Control
                        as="textarea"
                        name="additionalImages"
                        value={formData.additionalImages}
                        onChange={handleChange}
                        rows="2"
                        required
                        className={`form-control ${!formData.additionalImages ? 'is-invalid' : ''}`}
                        placeholder="(( Écran de morgue, photos des liaisons (( /cdamages )), rapport de test ADN )) (séparés par des virgules)"
                        onPaste={(e) => { // Keep the paste logic
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
                                const newValue = currentValue.slice(0, cursorPos) +
                                    (cursorPos > 0 ? separator : '') +
                                    pastedData +
                                    currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, additionalImages: newValue }));
                                e.preventDefault();
                            } else {
                                console.log('No URL detected or image item present');
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
                            input.onchange = (e) => handleImageUpload(e, 'additionalImages');
                            input.click();
                        }}
                    >
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                        {isUploading ? 'Téléchargement...' : 'Télécharger images'}
                    </Button>
                </div>
                <ImagePreview imageUrls={formData.additionalImages} />
                <span className="helper-text">
                        Télécharger le(s) photographie(s). Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
                </span>
                <label>Bugs de la morgue:</label> {/* Use <Form.Label> ? */}
                <Form.Check
                    type="checkbox"
                    id="morgueStatus"
                    label="       Cocher si l'écran de la morgue est indisponible / cassé / inaccessible"
                    checked={formData.morgueStatus === 'true'}
                    onChange={(e) => setFormData(prev => ({ // Use setFormData passed as prop
                        ...prev,
                        morgueStatus: e.target.checked.toString()
                    }))}
                />
            </Form.Group>

            <Form.Label></Form.Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Identifiants de l'employé</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowEmployeeModal(true)}
                    className="close-button" // Consider a more specific class if needed
                    style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8rem',
                        lineHeight: '1.2'
                    }}
                >
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i>
                    Nom manquant?
                </button>
            </div>

            <Select
                name="phmcEmployee"
                value={phmcGroupedOptions
                    .flatMap(group => group.options)
                    .find(option => option.value === formData.phmcEmployee) || null}
                onChange={(selectedOption) => {
                    // This logic needs setFormData, which is passed as a prop
                    const lastName = selectedOption ? selectedOption.lastName : '';
                    setFormData(prev => ({
                        ...prev,
                        phmcEmployee: selectedOption ? selectedOption.value : '',
                        lastName: lastName // Use lastName from the selected option
                    }));
                }}
                options={phmcGroupedOptions}
                isClearable
                placeholder="Sélectionner un médecin. (Vous pouvez taper pour rechercher!)"
                className="form-control"
                styles={{ // Keep the styles for react-select
                    control: (base) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: '#30363d',
                        '&:hover': {
                            borderColor: '#30363d'
                        }
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
            <Form.Label></Form.Label>
        </>
    );
};

export default PHMCCommentaryNoteQuestions;