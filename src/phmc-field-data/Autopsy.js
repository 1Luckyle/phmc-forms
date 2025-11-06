import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';
import AutopsyDiagramModal from '../components/AutopsyDiagramModal';
import * as Sentry from "@sentry/react";

const Autopsy = ({
    formData,
    handleChange,
    setFormData,
    coronerGroupedOptions,
    handleSelectChange,
    isUploading,
    setShowEmployeeModal,
    showNotification,
    commitInfo, // <-- Add commitInfo to props
    removeNotification,
    handleImageUpload

}) => {

    const [showAutopsyDiagramModal, setShowAutopsyDiagramModal] = useState(false);

    const handleOpenDiagramModal = () => setShowAutopsyDiagramModal(true);
    const handleCloseDiagramModal = () => setShowAutopsyDiagramModal(false);

    const handleSaveAutopsyDiagram = (markers) => {
        setFormData(prev => ({
            ...prev,
            autopsyDiagramMarkers: markers,
        }));
        handleCloseDiagramModal();
        if (showNotification) {
            showNotification("Données des marqueurs du diagramme d'autopsie enregistrées!", "save");
        } else {
            console.warn("[Autopsy.js] showNotification n'est pas disponible dans handleSaveAutopsyDiagram");
        }
    };

    const handleAddDeathCause = () => {
        setFormData(prev => ({
            ...prev,
            autopsyDeathCauses: [...(prev.autopsyDeathCauses || ['']), '']
        }));
    };

    const handleDeathCauseChange = (index, value) => {
        setFormData(prev => {
            const newCauses = [...(prev.autopsyDeathCauses || [''])];
            newCauses[index] = value;
            return { ...prev, autopsyDeathCauses: newCauses };
        });
    };

    const handleRemoveDeathCause = (index) => {
        setFormData(prev => {
            const newCauses = [...(prev.autopsyDeathCauses || [''])];
            if (newCauses.length > 1) {
                newCauses.splice(index, 1);
            } else if (newCauses.length === 1 && index === 0) {
                newCauses[0] = '';
            }
            return { ...prev, autopsyDeathCauses: newCauses };
        });
    };
 
    const handleAutopsyImageUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) {
            showNotification('Aucun fichier sélectionné pour les photos d\'autopsie.', 'warning');
            return;
        }

        let indefiniteNotificationId = null;
        indefiniteNotificationId = showNotification('Traitement des photos d\'autopsie, veuillez patienter...', 'info-circle', 0);

        const uploadedImageLinks = [];

        try {
            for (const file of files) {
                const imageUrl = await handleImageUpload(file);
                if (imageUrl) {
                    uploadedImageLinks.push(imageUrl);
                }
            }

            if (uploadedImageLinks.length > 0) {
                setFormData(prev => {
                    const existingLinks = prev.autopsyAlbumUrl ? prev.autopsyAlbumUrl.split(',').map(s => s.trim()).filter(s => s) : [];
                    const allLinks = [...existingLinks, ...uploadedImageLinks];
                    const uniqueLinks = [...new Set(allLinks)];
                    return {
                        ...prev,
                        autopsyAlbumUrl: uniqueLinks.join(', '),
                        autopsyPhotosUnavailable: false
                    };
                });
                showNotification(`${uploadedImageLinks.length}/${files.length} image(s) téléchargée(s) avec succès. Liens ajoutés au champ photographie.`, 'check-circle', 7000);
            } else if (files.length > 0) {
                showNotification(`Aucune image n'a été téléchargée avec succès.`, 'warning', 5000);
            }

        } catch (error) {
            console.error('[Photos d\'autopsie] Une erreur s\'est produite lors du téléchargement de l\'image:', error);
            Sentry.captureException(error, { extra: { context: 'handleAutopsyImageUpload' } });
            showNotification(`Erreur lors du téléchargement des images: ${error.message}`, 'exclamation-triangle', 7000);
        } finally {
            if (indefiniteNotificationId) {
                removeNotification(indefiniteNotificationId);
            }
        }
    };


    const handleAnatomicSummaryItemChange = (index, value) => {
        setFormData(prev => {
            const currentItems = Array.isArray(prev.autopsyAnatomicSummaryItems) ? prev.autopsyAnatomicSummaryItems : [''];
            const newItems = [...currentItems];
            newItems[index] = value;
            return { ...prev, autopsyAnatomicSummaryItems: newItems };
        });
    };
    const handleAddAnatomicSummaryItem = () => {
        setFormData(prev => ({
            ...prev,
            autopsyAnatomicSummaryItems: [...(prev.autopsyAnatomicSummaryItems || ['']), '']
        }));
    };
    const handleRemoveAnatomicSummaryItem = (index) => {
        setFormData(prev => {
            const currentItems = Array.isArray(prev.autopsyAnatomicSummaryItems) ? prev.autopsyAnatomicSummaryItems : [''];
            const newItems = [...currentItems];
            if (newItems.length > 1) {
                newItems.splice(index, 1);
            } else if (newItems.length === 1 && index === 0) {
                newItems[0] = '';
            }
            return { ...prev, autopsyAnatomicSummaryItems: newItems };
        });
    };


    return (
        <>
             <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                <Form.Control
                    type="text"
                    name="decedentName"
                    value={formData.decedentName || ''}
                    onChange={handleChange}
                    placeholder="Prénom (Deuxième Prénom) & Nom du défunt (IC)"
                    required
                    className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="decedentOOC"
                    value={formData.decedentOOC || ''}
                    onChange={handleChange}
                    placeholder="(( Nom du défunt (HRP) ))"
                    required
                    className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label style={{ marginBottom: 0 }}>Date et heure de l'autopsie </Form.Label>
             <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                <Form.Control
                    type="date"
                    name="autopsyDate"
                    value={formData.autopsyDate || ''}
                    onChange={handleChange}
                    placeholder="Date de l'autopsie"
                    required
                    className={`form-control ${!formData.autopsyDate ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="time"
                    name="autopsyTime"
                    value={formData.autopsyTime || ''}
                    onChange={handleChange}
                    placeholder="Heure de l'autopsie"
                    required
                    className={`form-control ${!formData.autopsyTime ? 'is-invalid' : ''}`}
                />
            </div>

            {/* Button to open the Autopsy Diagram Modal */}
            <Form.Group className="mb-3">
                <Form.Label>Diagramme des blessures</Form.Label>
                <div>
                    <Button variant="info" onClick={handleOpenDiagramModal}>
                        <i className="fas fa-male" style={{ marginRight: '5px' }}></i>
                        Ouvrir l'outil de diagramme des blessures ({formData.autopsyDiagramMarkers?.length || 0} marqueurs)
                    </Button>
                </div>
            </Form.Group>

            <Form.Label>Cause(s) du décès:</Form.Label>
            {(formData.autopsyDeathCauses || ['']).map((cause, index) => (
                <div key={`deathcause-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <Form.Control
                        as="textarea"
                        value={cause}
                        rows={2}
                        onChange={(e) => handleDeathCauseChange(index, e.target.value)}
                        placeholder={`Cause du décès ${index + 1}`}
                        required={index === 0 && !cause.trim()}
                        className={`form-control ${index === 0 && !cause.trim() && (formData.autopsyDeathCauses?.length > 0) ? 'is-invalid' : ''}`}
                    />
                    {formData.autopsyDeathCauses && formData.autopsyDeathCauses.length > 0 && (
                        <Button
                            variant="danger"
                            onClick={() => handleRemoveDeathCause(index)}
                            style={{ marginLeft: '8px', transform: 'translateY(-11px)' }}
                            size="sm"
                            title="Retirer la cause"
                        >
                            <i className="fas fa-times"></i>
                        </Button>
                    )}
                </div>
            ))}
            <Button variant="secondary" onClick={handleAddDeathCause} size="sm" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                <i className="fas fa-plus"></i> Ajouter une nouvelle cause de décès
            </Button>

            <Form.Label>Mode de décès:</Form.Label>
            <Form.Control
                type="text"
                name="deathType"
                value={formData.deathType || ''}
                onChange={handleChange}
                placeholder="ex: Homicide, Accident, Naturel"
                className={`form-control mb-2 ${!formData.deathType ? 'is-invalid' : ''}`}
            />

            <Form.Label>Comment la blessure s'est produite:</Form.Label>
            <Form.Control
                type="text"
                name="causeOfDeath"
                value={formData.causeOfDeath || ''}
                onChange={handleChange}
                placeholder="ex: Multiples blessures par balle"
                className={`form-control mb-2 ${!formData.causeOfDeath ? 'is-invalid' : ''}`}
            />
            <Form.Label>Examen externe:</Form.Label>
            <Form.Control
                as="textarea" // Changed to textarea for potentially longer descriptions
                rows={3}
                name="externalExamination"
                value={formData.externalExamination || ''}
                onChange={handleChange}
                placeholder="Résultats détaillés de l'examen externe (ex: marques d'identification, état du corps, blessures spécifiques observées extérieurement (les liaisons non mortelles))"
                className={`form-control mb-2 ${!formData.externalExamination ? 'is-invalid' : ''}`}
            />

            <Form.Label>Éléments du résumé anatomique:</Form.Label>
            {(formData.autopsyAnatomicSummaryItems || ['']).map((item, index) => (
                <div key={`anatomic-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <Form.Control
                        as="textarea"
                        rows={2}
                        value={item}
                        onChange={(e) => handleAnatomicSummaryItemChange(index, e.target.value)}
                        placeholder={`Élément du résumé anatomique ${index + 1}`}
                        className={`form-control ${index === 0 && !item.trim() && (formData.autopsyAnatomicSummaryItems?.length > 0) ? 'is-invalid' : ''}`}
                    />
                    {formData.autopsyAnatomicSummaryItems && formData.autopsyAnatomicSummaryItems.length > 0 && (
                        <Button
                            variant="danger"
                            onClick={() => handleRemoveAnatomicSummaryItem(index)}
                            style={{ marginLeft: '8px', transform: 'translateY(-11px)' }}
                            size="sm"
                            title="Retirer l'élément du résumé"
                        >
                            <i className="fas fa-times"></i>
                        </Button>
                    )}
                </div>
            ))}
            <Button variant="secondary" onClick={handleAddAnatomicSummaryItem} size="sm" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                <i className="fas fa-plus"></i> Ajouter un élément de résumé anatomique
            </Button>

            <Form.Label>Résultat de radiologie:</Form.Label>
            <Form.Control
                as="textarea" // Changed to textarea for potentially longer descriptions
                rows={2}
                name="RadiologyResult"
                value={formData.RadiologyResult || ''}
                onChange={handleChange}
                placeholder="ex: Aucun objet étranger détecté. Les radiographies montrent trois projectiles dans le corps."
                className={`form-control mb-2 ${!formData.RadiologyResult ? 'is-invalid' : ''}`}
            />

            <Form.Label>Photographies & Radiographies:</Form.Label>
            <InputGroup className="mb-1">
                <Form.Control
                    as="textarea" // Changed to textarea for better visibility of multiple URLs
                    rows={3}
                    name="autopsyAlbumUrl" // Keeping name for consistency, though it's not an album URL anymore
                    value={formData.autopsyAlbumUrl || ''}
                    onChange={handleChange}
                    placeholder="Télécharger les photographies & radiographies (séparées par des virgules)"
                    className={`form-control ${!formData.autopsyPhotosUnavailable && !(formData.autopsyAlbumUrl || '').trim() ? 'is-invalid' : ''}`}
                    disabled={formData.autopsyPhotosUnavailable}
                />
                <Button
                    variant="success"
                    disabled={isUploading || formData.autopsyPhotosUnavailable}
                    onClick={() => {
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = 'image/*';
                        fileInput.multiple = true;
                        fileInput.onchange = handleAutopsyImageUpload;
                        fileInput.click();
                    }}
                >
                    <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                    {isUploading ? ' Traitement...' : ' Télécharger photo(s)'}
                </Button>
            </InputGroup>
            <span className="helper-text">
            Télécharger le(s) fichier(s). Prend en charge le collage depuis le presse-papiers (Ctrl+V). Hébergé par ImgBB.
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Check
                    type="checkbox"
                    label="Les photographies & radiographies ne sont pas disponibles pour ce cas"
                    name="autopsyPhotosUnavailable"
                    checked={formData.autopsyPhotosUnavailable || false}
                    onChange={handleChange}
                    className="mb-3"
                />
            </div>

            <Form.Label>Opinion (Synopsis de l'examinateur médical):</Form.Label>
            <Form.Control
                as="textarea"
                name="synopsis"
                value={formData.synopsis || ''}
                onChange={handleChange}
                rows="5"
                placeholder="Opinion de l'examinateur médical sur l'état du défunt et la cause du décès"
                className={`form-control mb-2 ${!formData.synopsis ? 'is-invalid' : ''}`}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Examinateur médical effectuant l'autopsie</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowEmployeeModal(true)}
                    className="close-button"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', lineHeight: '1.2' }}
                >
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i>
                    Nom manquant?
                </button>
            </div>
            <Select
                name="coronerEmployee"
                value={coronerGroupedOptions
                    .flatMap(group => group.options)
                    .find(option => option.value === formData.coronerEmployee) || null}
                onChange={(selectedOption) => handleSelectChange(selectedOption, { name: 'coronerEmployee' })}
                options={coronerGroupedOptions}
                isClearable
                placeholder="Rechercher ou sélectionner un coroner..."
                className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                styles={{
                    control: (base, state) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: !formData.coronerEmployee && state.isFocused ? '#dc3545' :
                                     !formData.coronerEmployee ? '#dc3545' :
                                     state.isFocused ? '#86b7fe' : '#6c757d',
                        '&:hover': {
                            borderColor: !formData.coronerEmployee ? '#dc3545' : '#86b7fe'
                        },
                        boxShadow: !formData.coronerEmployee && state.isFocused ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' :
                                   state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
                    }),
                    menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
                    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
                    singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
                    input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                    placeholder: (base) => ({ ...base, color: '#eeeeeeb0' }),
                    group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
                    groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })
                }}
            />
            <Form.Label></Form.Label>

            {/* Autopsy Diagram Modal Instance */}
            <AutopsyDiagramModal
               show={showAutopsyDiagramModal}
               onHide={handleCloseDiagramModal}
               onSaveDiagram={handleSaveAutopsyDiagram}
               handleImageUpload={handleImageUpload}
               initialMarkers={formData.autopsyDiagramMarkers || []}
               showNotification={showNotification}
            />
        </>
    );
};

export default Autopsy;