// src/components/SaveAsEmployeeModal.js
//
// Affichée à un admin qui clique sur "Sauvegarder le rapport" : contrairement
// à un employé connecté (qui sauvegarde toujours sous sa propre identité, voir
// handleSaveReportWrapper dans MainApp.js), un admin doit choisir explicitement
// pour qui ce rapport est sauvegardé :
//   • formulaire de rédaction (rapport d'un soignant, du DMEC…) : l'EMPLOYÉ sur le compte duquel l'enregistrer ;
//   • demande civile (dossiers médicaux, libération médicale : `patientMode`) : le PATIENT concerné. Tous les patients sont proposés : comptes Civil, comptes
//     patient du personnel et patients sans compte (connus par leurs rapports) ; on peut aussi taper un ID patient. Le rapport est rangé sous ce patient et il le voit.
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import DebugFillButton from './DebugFillButton';
import { loadStaffMembers } from '../utils/staffAdmin';
import { staffPatientIdOf } from '../utils/deletedAccounts';
import { canonicalPatientId } from '../utils/patientId';
import { listIndexedPatientIds } from '../utils/patientRecords';

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

// Option « nouveau patient » pour un ID tapé à la main (ou celui du formulaire) : le rapport est rangé sous « Nom [ID] ».
export const typedPatientOption = (typedId, fallbackName = '') => {
    const patientID = canonicalPatientId(typedId);
    if (!patientID) return null;
    const name = String(fallbackName || '').trim() || 'Patient';
    return { value: `id:${patientID}`, label: `${name} (${patientID}) — ID saisi`, author: `${name} [${patientID}]`, patientID };
};

// Tous les patients : comptes Civil (rapports rangés sous « Prénom Nom [ID] »), comptes patient du personnel (sous leur nom d'employé) et patients SANS compte,
// connus par les rapports du personnel (sous « Nom [ID] »).
export const loadPatientAccountOptions = async () => {
    const [civilSnap, members, indexed] = await Promise.all([
        get(ref(database, 'civilians')).catch(() => null),
        loadStaffMembers().catch(() => []),
        listIndexedPatientIds().catch(() => []),
    ]);
    const known = new Set();
    const civils = Object.values((civilSnap && civilSnap.val()) || {})
        .filter((civil) => civil && civil.patientID)
        .map((civil) => {
            const name = `${civil.firstName || ''} ${civil.lastName || ''}`.trim() || civil.email || 'Compte civil';
            const patientID = canonicalPatientId(civil.patientID);
            known.add(patientID);
            return { value: `civil:${patientID}`, label: `${name} (${patientID})`, author: `${name} [${civil.patientID}]`, patientID };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    const staff = (members || [])
        .map((member) => ({ member, patientID: staffPatientIdOf(member) }))
        .filter(({ patientID }) => !!patientID)
        .map(({ member, patientID }) => {
            known.add(patientID);
            return { value: `staff:${patientID}`, label: `${member.displayName || member.name} (${patientID})`, author: member.name, patientID };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    const withoutAccount = (indexed || [])
        .map((patient) => ({ patientID: canonicalPatientId(patient.patientNode), name: patient.patientName }))
        .filter(({ patientID }) => patientID && !known.has(patientID))
        .map(({ patientID, name }) => ({
            value: `index:${patientID}`, label: `${name || 'Patient sans compte'} (${patientID})`, author: `${name || 'Patient'} [${patientID}]`, patientID,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    return [
        { label: 'Comptes patient (Civils)', options: civils },
        { label: 'Comptes patient du personnel', options: staff },
        { label: 'Patients sans compte', options: withoutAccount },
    ].filter((group) => group.options.length > 0);
};

const SaveAsEmployeeModal = ({ show, onHide, employeeOptions, onConfirm, patientMode = false, defaultPatientId = '', fallbackName = '' }) => {
    const [selected, setSelected] = useState(null);
    const [patientOptions, setPatientOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!show) setSelected(null);
    }, [show]);

    // Les patients sont lus à l'ouverture (réservé aux administrateurs, qui seuls voient cette fenêtre) ; l'ID du formulaire est présélectionné.
    useEffect(() => {
        if (!show || !patientMode) return undefined;
        let cancelled = false;
        setLoading(true);
        loadPatientAccountOptions().then((groups) => {
            if (cancelled) return;
            setPatientOptions(groups);
            const wanted = canonicalPatientId(defaultPatientId);
            if (wanted) {
                const found = groups.flatMap((group) => group.options).find((option) => option.patientID === wanted);
                setSelected(found || typedPatientOption(wanted, fallbackName));
            }
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [show, patientMode, defaultPatientId, fallbackName]);

    const options = patientMode ? patientOptions : employeeOptions;

    const handleConfirm = () => {
        if (!selected) return;
        onConfirm(patientMode ? { author: selected.author, patientID: selected.patientID, label: selected.label } : selected.value);
    };

    const SelectComponent = patientMode ? CreatableSelect : Select;
    const patientProps = patientMode ? {
        onCreateOption: (typed) => setSelected(typedPatientOption(typed, fallbackName)),
        formatCreateLabel: (typed) => `Enregistrer sur l'ID « ${canonicalPatientId(typed)} »`,
        isValidNewOption: (typed) => /\d/.test(typed) && typed.trim().length >= 3,
        createOptionPosition: 'first',
    } : {};

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton closeVariant="white" style={{ backgroundColor: '#1a1a1a', color: '#fff', borderBottom: '1px solid #444' }}>
                <Modal.Title>Sauvegarder le rapport pour...</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>
                <Form.Label style={{ color: '#e6edf3' }}>
                    {patientMode
                        ? 'Sélectionnez le patient sur lequel enregistrer cette demande (compte Civil, personnel ou patient sans compte), ou tapez son ID :'
                        : "Sélectionnez l'employé sur le compte duquel enregistrer ce rapport :"}
                </Form.Label>
                <SelectComponent
                    options={options}
                    value={selected}
                    onChange={setSelected}
                    isClearable
                    isLoading={patientMode && loading}
                    placeholder={patientMode ? 'Rechercher un patient (nom ou ID) ou taper un ID...' : 'Rechercher ou sélectionner un employé...'}
                    noOptionsMessage={() => (patientMode ? 'Aucun patient connu : tapez un ID (ex. 2752 ou PHMC-2752)' : 'Aucun employé')}
                    styles={reactSelectStyles}
                    {...patientProps}
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
