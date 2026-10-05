// src/components/SaveAsEmployeeModal.js
//
// Affichée à un admin qui clique sur "Sauvegarder le rapport" : contrairement
// à un employé connecté (qui sauvegarde toujours sous sa propre identité, voir
// handleSaveReportWrapper dans MainApp.js), un admin doit choisir explicitement
// pour quel employé ce rapport est sauvegardé.
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import DebugFillButton from './DebugFillButton';

const reactSelectStyles = {
    control: (base) => ({
        ...base,
        backgroundColor: '#1a1a1a',
        color: '#fff',
        borderColor: '#444',
    }),
    menu: (base) => ({ ...base, backgroundColor: '#1a1a1a', zIndex: 1060 }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#2a2a2a' : '#1a1a1a',
        color: '#fff',
    }),
    singleValue: (base) => ({ ...base, color: '#fff' }),
    input: (base) => ({ ...base, color: '#fff' }),
    placeholder: (base) => ({ ...base, color: '#6c757d' }),
    groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }),
};

const SaveAsEmployeeModal = ({ show, onHide, employeeOptions, onConfirm }) => {
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    useEffect(() => {
        if (!show) setSelectedEmployee(null);
    }, [show]);

    const handleConfirm = () => {
        if (!selectedEmployee) return;
        onConfirm(selectedEmployee.value);
    };

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton style={{ backgroundColor: '#1a1a1a', color: '#fff', borderBottom: '1px solid #444' }}>
                <Modal.Title>Sauvegarder le rapport pour...</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>
                <Form.Label>Sélectionnez l'employé sur le compte duquel enregistrer ce rapport :</Form.Label>
                <Select
                    options={employeeOptions}
                    value={selectedEmployee}
                    onChange={setSelectedEmployee}
                    isClearable
                    placeholder="Rechercher ou sélectionner un employé..."
                    styles={reactSelectStyles}
                />
            </Modal.Body>
            <Modal.Footer style={{ backgroundColor: '#1a1a1a', borderTop: '1px solid #444' }}>
                <DebugFillButton
                    style={{ marginRight: 'auto' }}
                    onFill={() => {
                        // Premier employé de la première liste non vide.
                        const first = (employeeOptions || []).flatMap((g) => g.options || [])[0];
                        if (first) setSelectedEmployee(first);
                    }}
                />
                <Button variant="secondary" onClick={onHide}>Annuler</Button>
                <Button variant="success" onClick={handleConfirm} disabled={!selectedEmployee}>
                    <i className="fas fa-save" style={{ marginRight: '6px' }}></i>
                    Sauvegarder
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default SaveAsEmployeeModal;
