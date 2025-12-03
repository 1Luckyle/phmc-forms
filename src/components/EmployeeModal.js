import React, { useState, useMemo, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { database } from '../firebase';
import { ref, get, set, push, update } from 'firebase/database';

// --- Styles ---
const modalOverlayStyle = {
  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
  justifyContent: 'center', alignItems: 'center', zIndex: 1050,
};
const modalContentStyle = {
  backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
  borderRadius: '5px', width: '90%',
  maxWidth: '750px',
  maxHeight: '1500px', position: 'relative',
  border: '1px solid #30363d',
};
const modalHeaderStyle = {
  fontSize: '1.2em', fontWeight: 'bold', marginBottom: '15px',
  borderBottom: '1px solid #30363d', paddingBottom: '10px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  color: '#c9d1d9',
};
const modalTitleStyle = { margin: 0 };
const closeButtonStyle = {
  background: 'none', border: 'none', color: '#c9d1d9',
  fontSize: '24px', cursor: 'pointer', lineHeight: '1', padding: '0 5px',
};
const modalBodyStyle = { paddingTop: '10px' };
const modalFooterStyle = {
  borderTop: '1px solid #30363d', paddingTop: '15px', marginTop: '20px',
  display: 'flex', justifyContent: 'flex-end', gap: '10px',
};
const formControlStyle = {
  backgroundColor: '#0d1117', color: '#c9d1d9',
  borderColor: '#30363d', width: '100%',
};
const formLabelStyle = {
  color: '#c9d1d9',
  marginBottom: '8px',
  marginTop: '10px',
  display: 'block',
};
const reactSelectStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    borderColor: '#30363d',
    '&:hover': { borderColor: '#c9d1d9' }
  }),
  menu: (base) => ({ ...base, backgroundColor: '#0d1117', zIndex: 1051 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#1f2937' : '#0d1117',
    color: '#c9d1d9',
    '&:hover': { backgroundColor: '#1f2937' }
  }),
  singleValue: (base) => ({ ...base, color: '#c9d1d9' }),
  input: (base) => ({ ...base, color: '#c9d1d9' }),
  placeholder: (base) => ({ ...base, color: '#6c757d' }),
  group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
  groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })
};
// --- End Styles ---

// map|array|null -> array
const ensureArray = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

// Retourne la paire [key, obj] par name pour une map ou un array
const findEntryByName = (data, name) => {
  if (!data || !name) return null;
  const lower = name.toLowerCase();
  if (Array.isArray(data)) {
    const idx = data.findIndex(e => (e?.name || '').toLowerCase() === lower);
    return idx >= 0 ? [String(idx), data[idx]] : null; // fallback index pour legacy array
  }
  for (const [k, v] of Object.entries(data)) {
    if ((v?.name || '').toLowerCase() === lower) return [k, v];
  }
  return null;
};

const EmployeeModal = ({
  show,
  onHide,
  phmcList,
  handleMissingEmployeeSubmit,
  showNotification,
  coronerList,
  isLoadingData
}) => {
  const [actionType, setActionType] = useState('addEmployee');
  const [employeeType, setEmployeeType] = useState('coroner');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [newRank, setNewRank] = useState('');
  const [staffToRemove, setStaffToRemove] = useState([]);
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshData, setRefreshData] = useState(false);

  const [missingEmployeeData, setMissingEmployeeData] = useState({
    coronerName: '',
    coronerDiscord: '',
    employeeLastName: '',
    coronerRank: '',
    coronerPHNumber: '',
    coronerBadge: '',
  });

  const handleActionTypeChange = (type) => {
    setActionType(type);
    setSelectedEmployeeName('');
    setNewRank('');
    // Par défaut on reste sur 'coroner' sauf si tu veux autre chose
  };

  const handleEmployeeTypeChange = (type) => {
    setEmployeeType(type);
    setSelectedEmployeeName('');
    setNewRank('');
  };

  const handleSelectChange = (selectedOption) => {
    setSelectedEmployeeName(selectedOption ? selectedOption.value : '');
    setNewRank('');
  };

  const handleNewRankChange = (e) => setNewRank(e.target.value);
  const handleRemoveStaffChange = (opts) => setStaffToRemove(opts ? opts.map(o => o.value) : []);
  const handleAuthorizedByChange = (e) => setAuthorizedBy(e.target.value);
  const handleInputChange = (e) => setMissingEmployeeData({ ...missingEmployeeData, [e.target.name]: e.target.value });

  // Pré-remplissage en édition
  useEffect(() => {
    if (actionType === 'editUser' && selectedEmployeeName) {
      setIsLoading(true);
      const listRef = ref(database, employeeType === 'coroner' ? 'staff/coroner' : 'staff/phmc');
      get(listRef)
        .then((snapshot) => {
          if (!snapshot.exists()) {
            showNotification('Aucune donnée sur les employés n\'est disponible.', 'warning');
            return;
          }
          const entry = findEntryByName(snapshot.val(), selectedEmployeeName);
          const employeeData = entry ? entry[1] : null;
          if (!employeeData) {
            showNotification('Données de l\'employé introuvables.', 'warning');
            return;
          }
          setMissingEmployeeData({
            coronerName: employeeData.name || '',
            coronerDiscord: employeeData.discord || '',
            employeeLastName: employeeData.lastName || '',
            coronerRank: employeeData.rank || '',
            coronerPHNumber: employeeData.phNumber || '',
            coronerBadge: employeeData.badge || '',
          });
        })
        .catch((err) => {
          console.error('Error fetching employee data:', err);
          showNotification(`Échec de la récupération des données de l'employé : ${err.message}`, 'error');
        })
        .finally(() => setIsLoading(false));
    }
  }, [actionType, selectedEmployeeName, employeeType, showNotification, refreshData]);

  const handleSubmit = async () => {
    setIsLoading(true);

    // --- ADD EMPLOYEE ---
    if (actionType === 'addEmployee') {
      const isCoroner = employeeType === 'coroner';
      const required = isCoroner
        ? { coronerName: 'Nom du coroner', coronerDiscord: 'Discord', coronerRank: 'Grade', coronerBadge: 'Badge' }
        : { coronerName: 'Prénom', employeeLastName: 'Nom de famille', coronerRank: 'Grade' };

      const missing = Object.keys(required).filter(k => !missingEmployeeData[k]?.trim());
      if (missing.length) {
        showNotification(`Veuillez remplir tous les champs obligatoires : ${missing.map(k => required[k]).join(', ')}`, 'warning');
        setIsLoading(false);
        return;
      }

      const newName = isCoroner
        ? missingEmployeeData.coronerName
        : `${missingEmployeeData.coronerName} ${missingEmployeeData.employeeLastName}`.trim();

      const payload = isCoroner
        ? {
            name: newName,
            discord: missingEmployeeData.coronerDiscord,
            rank: missingEmployeeData.coronerRank,
            badge: missingEmployeeData.coronerBadge,
            phNumber: missingEmployeeData.coronerPHNumber || '',
            category: missingEmployeeData.coronerRank
          }
        : {
            name: newName,
            lastName: missingEmployeeData.employeeLastName,
            rank: missingEmployeeData.coronerRank,
            category: missingEmployeeData.coronerRank
          };

      const basePath = isCoroner ? 'staff/coroner' : 'staff/phmc';
      const listRef = ref(database, basePath);

      try {
        const snap = await get(listRef);
        const existing = snap.exists() ? ensureArray(snap.val()) : [];
        const dup = existing.some(m => (m?.name || '').toLowerCase() === newName.toLowerCase());
        if (dup) {
          showNotification(`Le membre du personnel avec le nom "${newName}" existe déjà.`, 'warning');
          setIsLoading(false);
          return;
        }

        const newRef = push(listRef);     // génère une clé unique
        await set(newRef, payload);

        await handleMissingEmployeeSubmit('addEmployee', employeeType, newName, null, [], authorizedBy, missingEmployeeData, payload);
        showNotification(`Ajout réussi de ${newName} à la liste des ${isCoroner ? 'coroners' : 'membres du personnel hospitalier'}.`, 'success');

        setRefreshData(prev => !prev);
        setMissingEmployeeData({ coronerName: '', coronerDiscord: '', employeeLastName: '', coronerRank: '', coronerPHNumber: '', coronerBadge: '' });
      } catch (err) {
        console.error('Error adding staff member:', err);
        showNotification(`Erreur lors de l'ajout du membre du personnel : ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- EDIT USER ---
    if (actionType === 'editUser') {
      if (!selectedEmployeeName) {
        showNotification('Aucun employé sélectionné pour la modification.', 'warning');
        setIsLoading(false);
        return;
      }

      const basePath = employeeType === 'coroner' ? 'staff/coroner' : 'staff/phmc';
      const listRef = ref(database, basePath);

      try {
        const snap = await get(listRef);
        if (!snap.exists()) {
          showNotification('Aucune donnée sur les employés n\'est disponible dans la base de données.', 'error');
          setIsLoading(false);
          return;
        }

        const data = snap.val();
        const entry = findEntryByName(data, selectedEmployeeName);
        if (!entry) {
          showNotification(`Employé "${selectedEmployeeName}" introuvable dans la base de données.`, 'error');
          setIsLoading(false);
          return;
        }
        const [key, employee] = entry;

        const updated = { ...employee };
        if (employeeType === 'coroner') {
          updated.name = missingEmployeeData.coronerName;
          updated.discord = missingEmployeeData.coronerDiscord;
          updated.rank = missingEmployeeData.coronerRank;
          updated.badge = missingEmployeeData.coronerBadge;
          updated.phNumber = missingEmployeeData.coronerPHNumber;
          updated.category = missingEmployeeData.coronerRank;
        } else {
          updated.name = missingEmployeeData.coronerName;
          updated.lastName = missingEmployeeData.employeeLastName;
          updated.rank = missingEmployeeData.coronerRank;
          updated.category = missingEmployeeData.coronerRank;
        }

        await set(ref(database, `${basePath}/${key}`), updated);

        await handleMissingEmployeeSubmit('editUser', employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updated);
        showNotification(`Mise à jour réussie des informations pour ${selectedEmployeeName}.`, 'success');
        setSelectedEmployeeName('');
        setRefreshData(prev => !prev);
      } catch (err) {
        console.error('Error updating employee information in Firebase:', err);
        showNotification(`Erreur lors de la mise à jour des informations de l'employé : ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- REMOVE STAFF ---
    if (actionType === 'removeStaff') {
      if (!staffToRemove?.length) {
        showNotification('Aucun membre du personnel sélectionné pour la suppression.', 'warning');
        setIsLoading(false);
        return;
      }
      if (!authorizedBy?.trim()) {
        showNotification('L\'autorisation est requise pour la suppression du personnel.', 'warning');
        setIsLoading(false);
        return;
      }

      try {
        const snap = await get(ref(database, 'staff'));
        if (!snap.exists()) {
          showNotification('Aucune donnée sur le personnel n\'est disponible dans la base de données.', 'error');
          setIsLoading(false);
          return;
        }

        const staffData = snap.val() || {};
        const updates = {};

        const removeMatches = (listPath, listData) => {
          if (!listData) return;
          if (Array.isArray(listData)) {
            const filtered = listData.filter(m => !staffToRemove.includes(m?.name));
            updates[listPath] = filtered; // réécrit l'array
          } else {
            for (const [k, v] of Object.entries(listData)) {
              if (staffToRemove.includes(v?.name)) {
                updates[`${listPath}/${k}`] = null; // supprime la clé
              }
            }
          }
        };

        removeMatches('staff/coroner', staffData.coroner);
        removeMatches('staff/phmc', staffData.phmc);

        await update(ref(database), updates);

        await handleMissingEmployeeSubmit('removeStaff', employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updates);
        showNotification(`Suppression réussie de ${staffToRemove.length} membre(s) du personnel.`, 'success');
        setRefreshData(prev => !prev);
      } catch (err) {
        console.error('Error removing staff members from Firebase:', err);
        showNotification(`Erreur lors de la suppression des membres du personnel : ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- UPDATE RANK ---
    if (actionType === 'updateRank') {
      if (!selectedEmployeeName || !newRank?.trim()) {
        showNotification('Veuillez sélectionner un employé et entrer un nouveau grade.', 'warning');
        setIsLoading(false);
        return;
      }

      const trimmed = newRank.trim();
      const basePath = employeeType === 'coroner' ? 'staff/coroner' : 'staff/phmc';
      const listRef = ref(database, basePath);

      try {
        const snap = await get(listRef);
        if (!snap.exists()) {
          showNotification('Aucune donnée sur les employés n\'est disponible dans la base de données.', 'error');
          setIsLoading(false);
          return;
        }

        const entry = findEntryByName(snap.val(), selectedEmployeeName);
        if (!entry) {
          showNotification(`Employé "${selectedEmployeeName}" introuvable dans la base de données.`, 'error');
          setIsLoading(false);
          return;
        }

        const [key, employee] = entry;
        const updated = { ...employee, rank: trimmed, category: trimmed };
        await set(ref(database, `${basePath}/${key}`), updated);

        await handleMissingEmployeeSubmit('updateRank', employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updated);
        showNotification(`Mise à jour réussie du grade de ${selectedEmployeeName}.`, 'success');
        setRefreshData(prev => !prev);
      } catch (err) {
        console.error('Error updating employee rank in Firebase:', err);
        showNotification(`Erreur lors de la mise à jour du grade de l'employé : ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(false);
  };

  const handleClose = () => {
    if (typeof onHide === 'function') onHide();
    else console.error('EmployeeModal: onHide is not a function', onHide);
  };

  // Options des selects (robustes map/array)
  const employeeOptions = useMemo(() => {
    const src = employeeType === 'coroner' ? ensureArray(coronerList) : ensureArray(phmcList);
    return src.map(emp => ({
      value: emp.name,
      label: `${emp.name} (${emp.rank || emp.category || 'Rank Missing'})`
    }));
  }, [employeeType, coronerList, phmcList]);

  const combinedStaffOptions = useMemo(() => {
    const coronerOptions = ensureArray(coronerList).map(c => ({
      value: c.name,
      label: `${c.name} (${c.rank || 'Coroner'})`,
      category: 'Coroner Staff'
    }));
    const phmcOptions = ensureArray(phmcList).map(p => ({
      value: p.name,
      label: `${p.name} (${p.category || 'PHMC'})`,
      category: 'Hospital Staff'
    }));
    return [...coronerOptions, ...phmcOptions].sort((a, b) => a.category.localeCompare(b.category));
  }, [coronerList, phmcList]);

  return show ? (
    <div style={modalOverlayStyle} onClick={handleClose}>
      <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <h5 style={modalTitleStyle}>Gérer les données des employés</h5>
          <button onClick={handleClose} style={closeButtonStyle} aria-label="Close modal">&times;</button>
        </div>

        <div style={modalBodyStyle}>
          <Form>
            <Form.Group controlId="actionTypeRadios" className="mb-3">
              <Form.Label style={formLabelStyle}>Sélectionner une action :</Form.Label>
              <div className="mb-3">
                <Form.Check inline label="Ajouter un employé" name="actionType" type="radio"
                  id="addEmployee-radio" value="addEmployee"
                  checked={actionType === 'addEmployee'}
                  onChange={() => handleActionTypeChange('addEmployee')} />
                <Form.Check inline label="Modifier les détails de l'employé" name="actionType" type="radio"
                  id="editUser-radio" value="editUser"
                  checked={actionType === 'editUser'}
                  onChange={() => handleActionTypeChange('editUser')} />
                <Form.Check inline label="Supprimer un employé" name="actionType" type="radio"
                  id="removeStaff-radio" value="removeStaff"
                  checked={actionType === 'removeStaff'}
                  onChange={() => handleActionTypeChange('removeStaff')} />
                <Form.Check inline label="Mettre à jour le grade" name="actionType" type="radio"
                  id="updateRank-radio" value="updateRank"
                  checked={actionType === 'updateRank'}
                  onChange={() => handleActionTypeChange('updateRank')} />
              </div>
            </Form.Group>

            {(actionType === 'addEmployee' || actionType === 'updateRank') && (
              <Form.Group controlId="employeeTypeRadios" className="mb-3">
                <Form.Label style={formLabelStyle}>Sélectionner le type d'employé :</Form.Label>
                <div className="mb-3">
                  <Form.Check inline label="DMEC" name="employeeType" type="radio"
                    id="coroner-radio" value="coroner"
                    checked={employeeType === 'coroner'}
                    onChange={() => handleEmployeeTypeChange('coroner')} />
                  <Form.Check inline label="Personnel hospitalier" name="employeeType" type="radio"
                    id="hospitalStaff-radio" value="hospitalStaff"
                    checked={employeeType === 'hospitalStaff'}
                    onChange={() => handleEmployeeTypeChange('hospitalStaff')} />
                </div>
              </Form.Group>
            )}

            {actionType === 'addEmployee' && (
              <>
                {employeeType === 'coroner' ? (
                  <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Form.Control type="text" name="coronerName" value={missingEmployeeData.coronerName}
                        onChange={handleInputChange} placeholder="Nom du coroner" required style={formControlStyle} />
                      <Form.Control type="text" name="coronerDiscord" value={missingEmployeeData.coronerDiscord}
                        onChange={handleInputChange} placeholder="Nom Discord du coroner" required style={formControlStyle} />
                      <Form.Control type="text" name="coronerRank" value={missingEmployeeData.coronerRank}
                        onChange={handleInputChange} placeholder="Grade / Poste du coroner" required style={formControlStyle} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <Form.Control type="text" name="coronerPHNumber" value={missingEmployeeData.coronerPHNumber}
                        onChange={handleInputChange} placeholder="Numéro PH du coroner (Optionnel)" style={formControlStyle} />
                      <Form.Control type="text" name="coronerBadge" value={missingEmployeeData.coronerBadge}
                        onChange={handleInputChange} placeholder="Numéro de badge du coroner" required style={formControlStyle} />
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Control type="text" name="coronerName" value={missingEmployeeData.coronerName}
                      onChange={handleInputChange} placeholder="Prénom de l'employé" required style={formControlStyle} />
                    <Form.Control type="text" name="employeeLastName" value={missingEmployeeData.employeeLastName}
                      onChange={handleInputChange} placeholder="Nom de l'employé" required style={formControlStyle} />
                    <Form.Control type="text" name="coronerRank" value={missingEmployeeData.coronerRank}
                      onChange={handleInputChange} placeholder="Grade / Poste de l'employé" required style={formControlStyle} />
                  </div>
                )}
              </>
            )}

            {actionType === 'removeStaff' && (
              <>
                <Form.Label style={formLabelStyle}>Personnel à retirer :</Form.Label>
                <Select
                  isMulti
                  name="staffToRemove"
                  options={combinedStaffOptions}
                  value={combinedStaffOptions.filter(o => staffToRemove.includes(o.value))}
                  onChange={handleRemoveStaffChange}
                  isClearable
                  placeholder="Sélectionner le(s) membre(s) du personnel à retirer..."
                  styles={reactSelectStyles}
                  className="mb-2"
                />
                <Form.Label style={formLabelStyle}>Autorisé par :</Form.Label>
                <Form.Control type="text" name="authorizedBy" value={authorizedBy}
                  onChange={handleAuthorizedByChange} placeholder="Votre nom (Autorisation de retrait)" required style={formControlStyle} />
                <span className="helper-text" style={{ color: '#6c757d', display: 'block', marginTop: '5px' }}>
                  (Seul le personnel autorisé doit soumettre les demandes de retrait.)
                </span>
              </>
            )}

            {actionType === 'editUser' && (
              <>
                <Form.Group controlId="employeeTypeRadios" className="mb-3">
                  <Form.Label style={formLabelStyle}>Sélectionner le type d'employé :</Form.Label>
                  <div className="mb-3">
                    <Form.Check inline label="DMEC" name="employeeType" type="radio"
                      id="coroner-radio-2" value="coroner"
                      checked={employeeType === 'coroner'}
                      onChange={() => handleEmployeeTypeChange('coroner')} />
                    <Form.Check inline label="Personnel hospitalier" name="employeeType" type="radio"
                      id="hospitalStaff-radio-2" value="hospitalStaff"
                      checked={employeeType === 'hospitalStaff'}
                      onChange={() => handleEmployeeTypeChange('hospitalStaff')} />
                  </div>
                </Form.Group>

                <Form.Group controlId="coronerEmployeeSelect" className="mb-3">
                  <Form.Label style={formLabelStyle}>Sélectionner l'employé</Form.Label>
                  <Select
                    name="coronerEmployeeSelect"
                    options={employeeOptions}
                    value={employeeOptions.find(o => o.value === selectedEmployeeName)}
                    onChange={handleSelectChange}
                    isClearable
                    placeholder="Rechercher ou sélectionner un employé..."
                    styles={reactSelectStyles}
                  />
                </Form.Group>

                {employeeType === 'coroner' ? (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Entrer le nom mis à jour du coroner</Form.Label>
                      <Form.Control type="text" placeholder="Entrer le nom mis à jour du coroner..."
                        value={missingEmployeeData.coronerName} onChange={handleInputChange}
                        name="coronerName" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Entrer le Discord mis à jour du coroner</Form.Label>
                      <Form.Control type="text" placeholder="Entrer le Discord mis à jour du coroner..."
                        value={missingEmployeeData.coronerDiscord} onChange={handleInputChange}
                        name="coronerDiscord" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Entrer le rang mis à jour du coroner</Form.Label>
                      <Form.Control type="text" placeholder="Entrer le rang mis à jour du coroner..."
                        value={missingEmployeeData.coronerRank} onChange={handleInputChange}
                        name="coronerRank" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Entrer le badge mis à jour du coroner</Form.Label>
                      <Form.Control type="text" placeholder="Entrer le badge mis à jour du coroner..."
                        value={missingEmployeeData.coronerBadge} onChange={handleInputChange}
                        name="coronerBadge" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Entrer le numéro de téléphone mis à jour du coroner</Form.Label>
                      <Form.Control type="text" placeholder="Entrer le numéro de téléphone mis à jour du coroner..."
                        value={missingEmployeeData.coronerPHNumber} onChange={handleInputChange}
                        name="coronerPHNumber" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                  </>
                ) : (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Entrer le prénom mis à jour</Form.Label>
                      <Form.Control type="text" placeholder="Entrer le prénom mis à jour..."
                        value={missingEmployeeData.coronerName} onChange={handleInputChange}
                        name="coronerName" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Entrer le nom de famille mis à jour</Form.Label>
                      <Form.Control type="text" placeholder="Entrer le nom de famille mis à jour..."
                        value={missingEmployeeData.employeeLastName} onChange={handleInputChange}
                        name="employeeLastName" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Entrer le rang mis à jour</Form.Label>
                      <Form.Control type="text" placeholder="Entrer le rang mis à jour..."
                        value={missingEmployeeData.coronerRank} onChange={handleInputChange}
                        name="coronerRank" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                  </>
                )}
              </>
            )}

            {actionType === 'updateRank' && (
              <>
                <Form.Group controlId="coronerEmployeeSelect2" className="mb-3">
                  <Form.Label style={formLabelStyle}>Sélectionner un employé</Form.Label>
                  <Select
                    name="coronerEmployeeSelect2"
                    options={employeeOptions}
                    value={employeeOptions.find(o => o.value === selectedEmployeeName)}
                    onChange={handleSelectChange}
                    isClearable
                    placeholder="Rechercher ou sélectionner un employé..."
                    styles={reactSelectStyles}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label style={formLabelStyle}>Entrer le rang mis à jour</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={employeeType === 'coroner' ? 'Entrer le rang mis à jour...' : 'Entrer le poste mis à jour...'}
                    value={newRank}
                    onChange={handleNewRankChange}
                    disabled={!selectedEmployeeName}
                    style={formControlStyle}
                  />
                </Form.Group>
              </>
            )}
          </Form>
        </div>

        <div style={modalFooterStyle}>
          <Button variant="primary" onClick={handleSubmit} disabled={isLoading}>
            Soumettre la demande
          </Button>
          <Button variant="secondary" onClick={handleClose}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  ) : null;
};

export default EmployeeModal;
