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
            showNotification('No employee data available.', 'warning');
            return;
          }
          const entry = findEntryByName(snapshot.val(), selectedEmployeeName);
          const employeeData = entry ? entry[1] : null;
          if (!employeeData) {
            showNotification('Employee data not found.', 'warning');
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
          showNotification(`Failed to fetch employee data: ${err.message}`, 'error');
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
        ? { coronerName: 'Coroner Name', coronerDiscord: 'Discord', coronerRank: 'Rank', coronerBadge: 'Badge' }
        : { coronerName: 'First Name', employeeLastName: 'Last Name', coronerRank: 'Rank' };

      const missing = Object.keys(required).filter(k => !missingEmployeeData[k]?.trim());
      if (missing.length) {
        showNotification(`Please fill in all required fields: ${missing.map(k => required[k]).join(', ')}`, 'warning');
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
          showNotification(`Staff member with name "${newName}" already exists.`, 'warning');
          setIsLoading(false);
          return;
        }

        const newRef = push(listRef);     // génère une clé unique
        await set(newRef, payload);

        await handleMissingEmployeeSubmit('addEmployee', employeeType, newName, null, [], authorizedBy, missingEmployeeData, payload);
        showNotification(`Successfully added ${newName} to the ${isCoroner ? 'coroner' : 'hospital staff'} list.`, 'success');

        setRefreshData(prev => !prev);
        setMissingEmployeeData({ coronerName: '', coronerDiscord: '', employeeLastName: '', coronerRank: '', coronerPHNumber: '', coronerBadge: '' });
      } catch (err) {
        console.error('Error adding staff member:', err);
        showNotification(`Error adding staff member: ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- EDIT USER ---
    if (actionType === 'editUser') {
      if (!selectedEmployeeName) {
        showNotification('No employee selected for edit.', 'warning');
        setIsLoading(false);
        return;
      }

      const basePath = employeeType === 'coroner' ? 'staff/coroner' : 'staff/phmc';
      const listRef = ref(database, basePath);

      try {
        const snap = await get(listRef);
        if (!snap.exists()) {
          showNotification('No employee data found in the database.', 'error');
          setIsLoading(false);
          return;
        }

        const data = snap.val();
        const entry = findEntryByName(data, selectedEmployeeName);
        if (!entry) {
          showNotification(`Employee "${selectedEmployeeName}" not found in the database.`, 'error');
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
        showNotification(`Successfully updated information for ${selectedEmployeeName}.`, 'success');
        setSelectedEmployeeName('');
        setRefreshData(prev => !prev);
      } catch (err) {
        console.error('Error updating employee information in Firebase:', err);
        showNotification(`Error updating employee information: ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- REMOVE STAFF ---
    if (actionType === 'removeStaff') {
      if (!staffToRemove?.length) {
        showNotification('No staff members selected for removal.', 'warning');
        setIsLoading(false);
        return;
      }
      if (!authorizedBy?.trim()) {
        showNotification('Authorization is required for staff removal.', 'warning');
        setIsLoading(false);
        return;
      }

      try {
        const snap = await get(ref(database, 'staff'));
        if (!snap.exists()) {
          showNotification('No staff data found in the database.', 'error');
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
        showNotification(`Successfully removed ${staffToRemove.length} staff member(s).`, 'success');
        setRefreshData(prev => !prev);
      } catch (err) {
        console.error('Error removing staff members from Firebase:', err);
        showNotification(`Error removing staff members: ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // --- UPDATE RANK ---
    if (actionType === 'updateRank') {
      if (!selectedEmployeeName || !newRank?.trim()) {
        showNotification('Please select an employee and enter a new rank.', 'warning');
        setIsLoading(false);
        return;
      }

      const trimmed = newRank.trim();
      const basePath = employeeType === 'coroner' ? 'staff/coroner' : 'staff/phmc';
      const listRef = ref(database, basePath);

      try {
        const snap = await get(listRef);
        if (!snap.exists()) {
          showNotification('No employee data found in the database.', 'error');
          setIsLoading(false);
          return;
        }

        const entry = findEntryByName(snap.val(), selectedEmployeeName);
        if (!entry) {
          showNotification(`Employee "${selectedEmployeeName}" not found in the database.`, 'error');
          setIsLoading(false);
          return;
        }

        const [key, employee] = entry;
        const updated = { ...employee, rank: trimmed, category: trimmed };
        await set(ref(database, `${basePath}/${key}`), updated);

        await handleMissingEmployeeSubmit('updateRank', employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updated);
        showNotification(`Successfully updated ${selectedEmployeeName}'s rank.`, 'success');
        setRefreshData(prev => !prev);
      } catch (err) {
        console.error('Error updating employee rank in Firebase:', err);
        showNotification(`Error updating employee rank: ${err.message}`, 'error');
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
          <h5 style={modalTitleStyle}>Manage Employee Data</h5>
          <button onClick={handleClose} style={closeButtonStyle} aria-label="Close modal">&times;</button>
        </div>

        <div style={modalBodyStyle}>
          <Form>
            <Form.Group controlId="actionTypeRadios" className="mb-3">
              <Form.Label style={formLabelStyle}>Select Action:</Form.Label>
              <div className="mb-3">
                <Form.Check inline label="Add Employee" name="actionType" type="radio"
                  id="addEmployee-radio" value="addEmployee"
                  checked={actionType === 'addEmployee'}
                  onChange={() => handleActionTypeChange('addEmployee')} />
                <Form.Check inline label="Change Employee Details" name="actionType" type="radio"
                  id="editUser-radio" value="editUser"
                  checked={actionType === 'editUser'}
                  onChange={() => handleActionTypeChange('editUser')} />
                <Form.Check inline label="Remove Staff" name="actionType" type="radio"
                  id="removeStaff-radio" value="removeStaff"
                  checked={actionType === 'removeStaff'}
                  onChange={() => handleActionTypeChange('removeStaff')} />
                <Form.Check inline label="Update Rank" name="actionType" type="radio"
                  id="updateRank-radio" value="updateRank"
                  checked={actionType === 'updateRank'}
                  onChange={() => handleActionTypeChange('updateRank')} />
              </div>
            </Form.Group>

            {(actionType === 'addEmployee' || actionType === 'updateRank') && (
              <Form.Group controlId="employeeTypeRadios" className="mb-3">
                <Form.Label style={formLabelStyle}>Select Employee Type:</Form.Label>
                <div className="mb-3">
                  <Form.Check inline label="Coroner" name="employeeType" type="radio"
                    id="coroner-radio" value="coroner"
                    checked={employeeType === 'coroner'}
                    onChange={() => handleEmployeeTypeChange('coroner')} />
                  <Form.Check inline label="Hospital Staff" name="employeeType" type="radio"
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
                        onChange={handleInputChange} placeholder="Coroner Name" required style={formControlStyle} />
                      <Form.Control type="text" name="coronerDiscord" value={missingEmployeeData.coronerDiscord}
                        onChange={handleInputChange} placeholder="Coroner Discord Name" required style={formControlStyle} />
                      <Form.Control type="text" name="coronerRank" value={missingEmployeeData.coronerRank}
                        onChange={handleInputChange} placeholder="Coroner Rank / Position" required style={formControlStyle} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <Form.Control type="text" name="coronerPHNumber" value={missingEmployeeData.coronerPHNumber}
                        onChange={handleInputChange} placeholder="Coroner PH number (Optional)" style={formControlStyle} />
                      <Form.Control type="text" name="coronerBadge" value={missingEmployeeData.coronerBadge}
                        onChange={handleInputChange} placeholder="Coroner Badge Number" required style={formControlStyle} />
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Control type="text" name="coronerName" value={missingEmployeeData.coronerName}
                      onChange={handleInputChange} placeholder="Employee First Name" required style={formControlStyle} />
                    <Form.Control type="text" name="employeeLastName" value={missingEmployeeData.employeeLastName}
                      onChange={handleInputChange} placeholder="Employee Last Name" required style={formControlStyle} />
                    <Form.Control type="text" name="coronerRank" value={missingEmployeeData.coronerRank}
                      onChange={handleInputChange} placeholder="Employee Rank / Position" required style={formControlStyle} />
                  </div>
                )}
              </>
            )}

            {actionType === 'removeStaff' && (
              <>
                <Form.Label style={formLabelStyle}>Staff to Remove:</Form.Label>
                <Select
                  isMulti
                  name="staffToRemove"
                  options={combinedStaffOptions}
                  value={combinedStaffOptions.filter(o => staffToRemove.includes(o.value))}
                  onChange={handleRemoveStaffChange}
                  isClearable
                  placeholder="Select staff member(s) to remove..."
                  styles={reactSelectStyles}
                  className="mb-2"
                />
                <Form.Label style={formLabelStyle}>Authorized By:</Form.Label>
                <Form.Control type="text" name="authorizedBy" value={authorizedBy}
                  onChange={handleAuthorizedByChange} placeholder="Your Name (Authorizing Removal)" required style={formControlStyle} />
                <span className="helper-text" style={{ color: '#6c757d', display: 'block', marginTop: '5px' }}>
                  (Only authorized personnel should submit removal requests.)
                </span>
              </>
            )}

            {actionType === 'editUser' && (
              <>
                <Form.Group controlId="employeeTypeRadios" className="mb-3">
                  <Form.Label style={formLabelStyle}>Select Employee Type:</Form.Label>
                  <div className="mb-3">
                    <Form.Check inline label="Coroner" name="employeeType" type="radio"
                      id="coroner-radio-2" value="coroner"
                      checked={employeeType === 'coroner'}
                      onChange={() => handleEmployeeTypeChange('coroner')} />
                    <Form.Check inline label="Hospital Staff" name="employeeType" type="radio"
                      id="hospitalStaff-radio-2" value="hospitalStaff"
                      checked={employeeType === 'hospitalStaff'}
                      onChange={() => handleEmployeeTypeChange('hospitalStaff')} />
                  </div>
                </Form.Group>

                <Form.Group controlId="coronerEmployeeSelect" className="mb-3">
                  <Form.Label style={formLabelStyle}>Select Employee</Form.Label>
                  <Select
                    name="coronerEmployeeSelect"
                    options={employeeOptions}
                    value={employeeOptions.find(o => o.value === selectedEmployeeName)}
                    onChange={handleSelectChange}
                    isClearable
                    placeholder="Search or select employee..."
                    styles={reactSelectStyles}
                  />
                </Form.Group>

                {employeeType === 'coroner' ? (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Enter Updated Coroner Name</Form.Label>
                      <Form.Control type="text" placeholder="Enter updated coroner name..."
                        value={missingEmployeeData.coronerName} onChange={handleInputChange}
                        name="coronerName" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Enter Updated Coroner Discord</Form.Label>
                      <Form.Control type="text" placeholder="Enter updated coroner discord..."
                        value={missingEmployeeData.coronerDiscord} onChange={handleInputChange}
                        name="coronerDiscord" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Enter Updated Coroner Rank</Form.Label>
                      <Form.Control type="text" placeholder="Enter updated coroner rank..."
                        value={missingEmployeeData.coronerRank} onChange={handleInputChange}
                        name="coronerRank" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Enter Updated Coroner Badge</Form.Label>
                      <Form.Control type="text" placeholder="Enter updated coroner badge..."
                        value={missingEmployeeData.coronerBadge} onChange={handleInputChange}
                        name="coronerBadge" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Enter Updated Coroner PH Number</Form.Label>
                      <Form.Control type="text" placeholder="Enter updated coroner ph number..."
                        value={missingEmployeeData.coronerPHNumber} onChange={handleInputChange}
                        name="coronerPHNumber" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                  </>
                ) : (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Enter Updated First Name</Form.Label>
                      <Form.Control type="text" placeholder="Enter updated first name..."
                        value={missingEmployeeData.coronerName} onChange={handleInputChange}
                        name="coronerName" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Enter Updated Last Name</Form.Label>
                      <Form.Control type="text" placeholder="Enter updated last name..."
                        value={missingEmployeeData.employeeLastName} onChange={handleInputChange}
                        name="employeeLastName" disabled={!selectedEmployeeName} style={formControlStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label style={formLabelStyle}>Enter Updated Rank</Form.Label>
                      <Form.Control type="text" placeholder="Enter updated rank..."
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
                  <Form.Label style={formLabelStyle}>Select Employee</Form.Label>
                  <Select
                    name="coronerEmployeeSelect2"
                    options={employeeOptions}
                    value={employeeOptions.find(o => o.value === selectedEmployeeName)}
                    onChange={handleSelectChange}
                    isClearable
                    placeholder="Search or select employee..."
                    styles={reactSelectStyles}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label style={formLabelStyle}>Enter Updated Rank</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder={employeeType === 'coroner' ? 'Enter updated rank name...' : 'Enter updated position name...'}
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
            Submit Request
          </Button>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  ) : null;
};

export default EmployeeModal;
