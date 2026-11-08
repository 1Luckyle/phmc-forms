// src/components/SaveAsEmployeeModal.js
//
// Affichée à un admin qui clique sur "Sauvegarder le rapport" : contrairement
// à un employé connecté (qui sauvegarde toujours sous sa propre identité, voir
// handleSaveReportWrapper dans MainApp.js), un admin doit choisir explicitement
// pour qui ce rapport est sauvegardé :
//   • formulaire de rédaction (rapport d'un soignant, du DMEC…) : l'EMPLOYÉ sur le compte duquel l'enregistrer ;
//   • demande civile (dossiers médicaux, libération médicale : `patientMode`) : le COMPTE PATIENT concerné, qu'il s'agisse d'un compte Civil
//     ou du compte patient d'un membre du personnel. Le rapport est alors rangé sous ce compte et visible par le patient.
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import DebugFillButton from './DebugFillButton';
import { loadStaffMembers } from '../utils/staffAdmin';
import { staffPatientIdOf } from '../utils/deletedAccounts';
import { canonicalPatientId } from '../utils/patientId';

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
    placeholder: (base) => ({ ...base, color: '#9aa7b4' }),
    groupHeading: (base) => ({ ...base, color: '#9aa7b4', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }),
};

// Comptes patient : comptes Civil (rapports rangés sous « Prénom Nom [ID] ») et comptes patient du personnel (rapports rangés sous leur nom d'employé).
export const loadPatientAccountOptions = async () => {
    const [civilSnap, members] = await Promise.all([
        get(ref(database, 'civilians')).catch(() => null),
        loadStaffMembers().catch(() => []),
    ]);
    const civils = Object.values((civilSnap && civilSnap.val()) || {})
        .filter((civil) => civil && civil.patientID)
        .map((civil) => {
            const name = `${civil.firstName || ''} ${civil.lastName || ''}`.trim() || civil.email || 'Compte civil';
            const patientID = canonicalPatientId(civil.patientID);
            return { value: `civil:${patientID}`, label: `${name} (${patientID})`, author: `${name} [${civil.patientID}]`, patientID };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    const staff = (members || [])
        .map((member) => ({ member, patientID: staffPatientIdOf(member) }))
        .filter(({ patientID }) => !!patientID)
        .map(({ member, patientID }) => ({ value: `staff:${patientID}`, label: `${member.displayName || member.name} (${patientID})`, author: member.name, patientID }))
        .sort((a, b) => a.label.localeCompare(b.label));
    return [
        { label: 'Comptes patient (Civils)', options: civils },
        { label: 'Comptes patient du personnel', options: staff },
    ].filter((group) => group.options.length > 0);
};

const SaveAsEmployeeModal = ({ show, onHide, employeeOptions, onConfirm, patientMode = false }) => {
    const [selected, setSelected] = useState(null);
    const [patientOptions, setPatientOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!show) setSelected(null);
    }, [show]);

    // Les comptes patient sont lus à l'ouverture (réservé aux administrateurs, qui seuls voient cette fenêtre).
    useEffect(() => {
        if (!show || !patientMode) return undefined;
        let cancelled = false;
        setLoading(true);
        loadPatientAccountOptions().then((options) => { if (!cancelled) setPatientOptions(options); }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [show, patientMode]);

    const options = patientMode ? patientOptions : employeeOptions;

    const handleConfirm = () => {
        if (!selected) return;
        onConfirm(patientMode ? { author: selected.author, patientID: selected.patientID, label: selected.label } : selected.value);
    };

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton closeVariant="white" style={{ backgroundColor: '#1a1a1a', color: '#fff', borderBottom: '1px solid #444' }}>
                <Modal.Title>Sauvegarder le rapport pour...</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>
                <Form.Label style={{ color: '#e6edf3' }}>
                    {patientMode
                        ? 'Sélectionnez le compte patient (Civil ou personnel) sur lequel enregistrer cette demande :'
                        : "Sélectionnez l'employé sur le compte duquel enregistrer ce rapport :"}
                </Form.Label>
                <Select
                    options={options}
                    value={selected}
                    onChange={setSelected}
                    isClearable
                    isLoading={patientMode && loading}
                    placeholder={patientMode ? 'Rechercher un compte patient (nom ou ID)...' : 'Rechercher ou sélectionner un employé...'}
                    noOptionsMessage={() => (patientMode ? 'Aucun compte patient trouvé' : 'Aucun employé')}
                    styles={reactSelectStyles}
                />
            </Modal.Body>
            <Modal.Footer style={{ backgroundColor: '#1a1a1a', borderTop: '1px solid #444' }}>
                <DebugFillButton
                    style={{ marginRight: 'auto' }}
                    onFill={() => {
                        // Premier compte de la première liste non vide.
                        const first = (options || []).flatMap((g) => g.options || [])[0];
                        if (first) setSelected(first);
                    }}
                />
                <Button variant="secondary" onClick={onHide}>Annuler</Button>
                <Button variant="success" onClick={handleConfirm} disabled={!selected}>
                    <i className="fas fa-save" style={{ marginRight: '6px' }}></i>
                    Sauvegarder
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default SaveAsEmployeeModal;
