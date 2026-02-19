import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form } from 'react-bootstrap';
import Select from 'react-select';
import { copyToClipboard } from './notificationService';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';

const modalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
};

const modalContentStyle = {
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    padding: '20px',
    borderRadius: '5px',
    width: '95%',
    maxWidth: '1200px',
    height: '90vh',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'hidden',
    position: 'relative',
    border: '1px solid #30363d',
};

const modalHeaderStyle = {
    fontSize: '1.3em',
    fontWeight: 'bold',
    marginBottom: '15px',
    textAlign: 'center',
    paddingBottom: '10px',
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
};

const closeButtonStyle = {
    position: 'absolute',
    top: '15px',
    right: '15px',
    background: 'transparent',
    border: 'none',
    color: '#f85149',
    fontSize: '28px',
    fontWeight: 'bold',
    lineHeight: '1',
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    zIndex: 10,
};

const controlsContainerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    flexShrink: 0,
    gap: '10px',
    paddingRight: '50px',
};

const tableContainerStyle = {
    flexGrow: 1,
    overflowY: 'auto',
    marginTop: '10px',
};

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
};

const thStyle = {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    padding: '10px',
    textAlign: 'left',
    fontWeight: '600',
    position: 'sticky',
    top: 0,
    zIndex: 1,
};

const thCheckboxStyle = {
    ...thStyle,
    width: '40px',
    textAlign: 'center',
};

const tdStyle = {
    border: '1px solid #30363d',
    padding: '8px 10px',
    verticalAlign: 'middle',
    maxWidth: '250px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const tdCheckboxStyle = {
    ...tdStyle,
    textAlign: 'center',
};

const actionButtonStyle = {
    backgroundColor: '#238636',
    color: 'white',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '5px',
    fontSize: '0.9em',
    whiteSpace: 'nowrap',
};

const deleteButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#da3633',
};

const copyButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#2f81f7',
};

const bulkActionsContainerStyle = {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
    paddingTop: '10px',
    borderTop: '1px solid #30363d',
    flexShrink: 0,
};

const paginationStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '20px',
    paddingTop: '10px',
    borderTop: '1px solid #30363d',
    flexShrink: 0,
};

const searchInputStyle = {
    padding: '8px 10px',
    borderRadius: '5px',
    border: '1px solid #30363d',
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    flexGrow: 1,
    maxWidth: '450px',
};

const switchButtonStyle = {
    ...actionButtonStyle,
    backgroundColor: '#1f6feb',
    marginRight: '10px',
    flexShrink: 0,
};

const hrStyle = {
    borderColor: '#30363d',
    margin: '15px 0',
};

const reactSelectStyles = {
    control: (base) => ({
        ...base,
        backgroundColor: '#0d1117',
        color: '#c9d1d9',
        borderColor: '#30363d',
        '&:hover': {
            borderColor: '#c9d1d9',
        },
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#0d1117',
        zIndex: 1051,
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#1f2937' : '#0d1117',
        color: '#c9d1d9',
        '&:hover': {
            backgroundColor: '#1f2937',
        },
    }),
    singleValue: (base) => ({
        ...base,
        color: '#c9d1d9',
    }),
    input: (base) => ({
        ...base,
        color: '#c9d1d9',
    }),
    placeholder: (base) => ({
        ...base,
        color: '#6c757d',
    }),
    group: (base) => ({
        ...base,
        paddingTop: 8,
        paddingBottom: 8,
    }),
    groupHeading: (base) => ({
        ...base,
        color: '#6c757d',
        fontWeight: 600,
        textTransform: 'uppercase',
        fontSize: '0.75rem',
        marginBottom: 4,
    }),
};

const itemsPerPage = 7;
const LOAD_DELAY_MS = 1000;

const SavedReportsModal = ({
    show,
    onClose,
    onHide,
    showNotification,
    reportsForSelectedUser,
    onEmployeeSelect,
    employeeOptions,
    isLoadingReports,
    loadReport,
    deleteReportForUser,
    loadReportForUser,
    handleReportSelectedForAttachment,
    currentCoronerEmployee,
    currentPhmcEmployee,
    filterByBbCodeVersions,
    onAttachReportSummaryRequest,
    preselectedEmployeeType,
    bbCodeVersion,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReportKeys, setSelectedReportKeys] = useState([]);
    const [isLoadingMultiple, setIsLoadingMultiple] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    
    const lastLoadedEmployeeRef = useRef(null);
    const isManualSelectionRef = useRef(false);

    useEffect(() => {
        if (show && !isManualSelectionRef.current) {
            let employeeToSelectValue = null;
            
            // First try to use the current employee based on form data
            if (currentPhmcEmployee) {
                employeeToSelectValue = currentPhmcEmployee;
            } else if (currentCoronerEmployee) {
                employeeToSelectValue = currentCoronerEmployee;
            } else if (preselectedEmployeeType === 'PHMC') {
                employeeToSelectValue = currentPhmcEmployee;
            } else {
                employeeToSelectValue = currentCoronerEmployee || currentPhmcEmployee;
            }

            // Find the matching employee option
            const employeeOption = employeeOptions?.flatMap(group => group.options).find(
                (opt) => opt.value === employeeToSelectValue
            );

            if (employeeOption && employeeToSelectValue !== lastLoadedEmployeeRef.current) {
                setSelectedEmployee(employeeOption);
                onEmployeeSelect(String(employeeOption.value));
                lastLoadedEmployeeRef.current = employeeToSelectValue;
            } else if (!employeeOption) {
                setSelectedEmployee(null);
                onEmployeeSelect(null);
            }
        } else if (!show) {
            setSelectedEmployee(null);
            setSearchQuery('');
            setCurrentPage(1);
            setSelectedReportKeys([]);
            lastLoadedEmployeeRef.current = null;
            isManualSelectionRef.current = false;
        }
    }, [show, currentCoronerEmployee, currentPhmcEmployee, employeeOptions, preselectedEmployeeType, onEmployeeSelect]);

    const handleEmployeeSelect = (selectedOption) => {
        isManualSelectionRef.current = true;
        setSelectedEmployee(selectedOption);
        setSearchQuery('');
        setCurrentPage(1);
        setSelectedReportKeys([]);
        if (selectedOption) {
            onEmployeeSelect(String(selectedOption.value));
            lastLoadedEmployeeRef.current = selectedOption.value;
        } else {
            onEmployeeSelect(null);
            lastLoadedEmployeeRef.current = null;
        }
    };

    const { employeeProfile, currentEmployee, isAdmin } = useEmployeeAuth();

    const filteredEmployeeOptions = useMemo(() => {
        let options = employeeOptions || [];
        
        // Filtrer par type si preselectedEmployeeType est défini
        if (preselectedEmployeeType === 'PHMC') {
            options = options.filter((group) => group.label === 'PHMC Staff');
        }
        
        // Si admin, montrer tous les employés
        if (isAdmin) {
            return options;
        }
        
        // Si pas connecté, ne montrer personne
        if (!currentEmployee) {
            return [];
        }
        
        // Si employé connecté, montrer seulement cet employé
        if (employeeProfile) {
            const currentEmployeeName = employeeProfile.name;
            return options.map(group => ({
                ...group,
                options: group.options.filter(opt => opt.value === currentEmployeeName)
            })).filter(group => group.options.length > 0);
        }
        
        return options;
    }, [employeeOptions, preselectedEmployeeType, isAdmin, currentEmployee, employeeProfile]);

    const sortedReports = useMemo(() => {
        return [...(reportsForSelectedUser || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }, [reportsForSelectedUser]);

    const searchedAndFilteredReports = useMemo(() => {
        let reports = sortedReports;
        if (filterByBbCodeVersions && filterByBbCodeVersions.length > 0) {
            reports = reports.filter((report) => filterByBbCodeVersions.includes(report.bbCodeVersion));
        }
        if (searchQuery) {
            reports = reports.filter((report) =>
                report.originalKey.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return reports;
    }, [sortedReports, filterByBbCodeVersions, searchQuery]);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedReportKeys([]);
    }, [searchedAndFilteredReports]);

    const totalPages = Math.ceil(searchedAndFilteredReports.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentReportsOnPage = searchedAndFilteredReports.slice(startIndex, endIndex);

    const handleCheckboxChange = (reportKey, checked) => {
        setSelectedReportKeys((prev) =>
            checked ? [...prev, reportKey] : prev.filter((k) => k !== reportKey)
        );
    };

    const handleSelectAllChange = (checked) => {
        if (checked) {
            setSelectedReportKeys((prev) => [
                ...new Set([...prev, ...currentReportsOnPage.map((r) => r.key)]),
            ]);
        } else {
            const currentPageKeysSet = new Set(currentReportsOnPage.map((r) => r.key));
            setSelectedReportKeys((prev) => prev.filter((k) => !currentPageKeysSet.has(k)));
        }
    };

    const handleLoadSelected = async () => {
        if (selectedReportKeys.length === 0 || !selectedEmployee?.value) {
            showNotification('Aucun rapport sélectionné ou aucun employé identifié.', 'warning');
            return;
        }
        if (isLoadingMultiple) return;

        setIsLoadingMultiple(true);
        const numToLoad = selectedReportKeys.length;
        const calculatedDuration = numToLoad > 1 ? (numToLoad - 1) * LOAD_DELAY_MS + 500 : 3000;
        showNotification(`Chargement de ${numToLoad} rapport(s)...`, 'info-circle', calculatedDuration);

        const reportsToLoad = sortedReports
            .filter((r) => selectedReportKeys.includes(r.key))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        const isAttaching = bbCodeVersion === 2;
        const actionFunction = isAttaching ? handleReportSelectedForAttachment : loadReport;

        for (let i = 0; i < reportsToLoad.length; i++) {
            const report = reportsToLoad[i];
            try {
                await actionFunction(report.key, selectedEmployee.value);
                if (i < reportsToLoad.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY_MS));
                }
            } catch (error) {
                console.error(`Error ${isAttaching ? 'attaching' : 'loading'} report ${report.originalKey}:`, error);
                showNotification(`Erreur ${isAttaching ? 'attacher' : 'chargement'} rapport ${report.originalKey}.`, 'error');
            }
        }
        showNotification(`Terminé ${isAttaching ? 'attacher' : 'chargement'} ${reportsToLoad.length} rapport(s).`, 'check-circle');
        setIsLoadingMultiple(false);
        setSelectedReportKeys([]);
        onHide(); // Close modal after operation completes
    };

    const handleDeleteSelected = () => {
        if (selectedReportKeys.length === 0 || !selectedEmployee?.value) {
            showNotification('Aucun rapport sélectionné ou aucun employé identifié.', 'warning');
            return;
        }
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedReportKeys.length} rapport(s) sélectionné(s) ? Cette action est irréversible.`)) {
            return;
        }
        selectedReportKeys.forEach((reportKey) => {
            deleteReportForUser(reportKey, selectedEmployee.value);
        });
        showNotification(`${selectedReportKeys.length} rapport(s) supprimé(s).`, 'trash');
        setSelectedReportKeys([]);
    };

    const handleCopySelectedBBCode = async () => {
        if (selectedReportKeys.length === 0) {
            showNotification('Aucun rapport sélectionné à copier.', 'warning');
            return;
        }
        const reportsToCopy = sortedReports.filter((r) => selectedReportKeys.includes(r.key));
        const combinedBbCode = reportsToCopy.map((r) => r.bbCode).filter(Boolean).join('\n\n');
        if (combinedBbCode) {
            await copyToClipboard(combinedBbCode, showNotification, 'BBCode copié !');
        } else {
            showNotification('Aucun BBCode trouvé dans les rapports sélectionnés.', 'warning');
        }
    };

    const handleCopyBBCode = async (reportKey) => {
        const report = sortedReports.find((r) => r.key === reportKey);
        if (report && report.bbCode) {
            await copyToClipboard(report.bbCode, showNotification, 'BBCode copié !');
        } else {
            showNotification('Aucun BBCode trouvé pour ce rapport.', 'warning');
        }
    };

    const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
    const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

    const isAllCurrentPageSelected =
        currentReportsOnPage.length > 0 && currentReportsOnPage.every((report) => selectedReportKeys.includes(report.key));

    const canSwitchEmployee = currentPhmcEmployee && currentCoronerEmployee && currentPhmcEmployee !== currentCoronerEmployee;
    let otherEmployeeName = '';
    if (canSwitchEmployee) {
        otherEmployeeName = selectedEmployee?.value === currentCoronerEmployee ? currentPhmcEmployee : currentCoronerEmployee;
    }

    if (!show) return null;

    return ReactDOM.createPortal(
        <div style={modalStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={{ margin: 0 }}>Rapports enregistrés</h5>
                    <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">
                        &times;
                    </button>
                </div>

                <div style={controlsContainerStyle}>
                    <input
                        type="text"
                        placeholder="Rechercher des rapports par nom/identifiant..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={searchInputStyle}
                        disabled={!selectedEmployee || isLoadingReports}
                    />
                    <Form.Group controlId="employeeSelect" className="mb-3">
                        <Form.Label>Sélectionnez un employé pour voir les rapports :</Form.Label>
                        <Select
                            name="employeeSelect"
                            options={filteredEmployeeOptions}
                            value={selectedEmployee}
                            onChange={handleEmployeeSelect}
                            isClearable
                            placeholder="Rechercher ou sélectionner un employé..."
                            styles={reactSelectStyles}
                        />
                    </Form.Group>
                    {canSwitchEmployee && !preselectedEmployeeType && (
                        <Button
                            onClick={() => {
                                const newEmployeeValue =
                                    selectedEmployee?.value === currentCoronerEmployee ? currentPhmcEmployee : currentCoronerEmployee;
                                const newEmployeeOption = employeeOptions
                                    ?.flatMap((g) => g.options)
                                    .find((o) => o.value === newEmployeeValue);
                                if (newEmployeeOption) {
                                    handleEmployeeSelect(newEmployeeOption);
                                    showNotification(`Passé aux rapports pour ${newEmployeeOption.label}`, 'exchange-alt');
                                }
                            }}
                            style={switchButtonStyle}
                            title={`Passer aux rapports pour ${otherEmployeeName}`}
                        >
                            <i className="fas fa-exchange-alt" style={{ marginRight: '5px' }}></i>
                            Passer aux rapports pour {otherEmployeeName}
                        </Button>
                    )}
                </div>

                <hr style={hrStyle} />

                <div style={modalHeaderStyle} key={selectedEmployee ? selectedEmployee.value : 'noEmployee'}>
                    <h5 style={{ margin: 0 }}>
                        Rapports enregistrés {selectedEmployee ? `pour ${selectedEmployee.label}` : '(Aucun employé sélectionné)'}
                        {selectedEmployee && ` (${searchedAndFilteredReports.length} total)`}
                    </h5>
                </div>

                {isLoadingReports && selectedEmployee && (
                    <p style={{ textAlign: 'center', flexShrink: 0 }}>Chargement des rapports pour {selectedEmployee.label}...</p>
                )}

                <div style={tableContainerStyle}>
                    {!isLoadingReports && selectedEmployee && searchedAndFilteredReports.length > 0 ? (
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thCheckboxStyle}>
                                        <Form.Check
                                            type="checkbox"
                                            id="selectAllCheckbox"
                                            checked={isAllCurrentPageSelected}
                                            onChange={(e) => handleSelectAllChange(e.target.checked)}
                                            title="Sélectionner/Désélectionner tout sur cette page"
                                        />
                                    </th>
                                    <th style={thStyle}>Nom / Identifiant</th>
                                    <th style={thStyle}>Date et heure d'enregistrement</th>
                                    <th style={thStyle}>Version</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentReportsOnPage.map((report) => {
                                    const isSelected = selectedReportKeys.includes(report.key);
                                    return (
                                        <tr key={report.key} style={isSelected ? { backgroundColor: '#161b22' } : {}}>
                                            <td style={tdCheckboxStyle}>
                                                <Form.Check
                                                    type="checkbox"
                                                    id={`select-${report.key}`}
                                                    checked={isSelected}
                                                    onChange={(e) => handleCheckboxChange(report.key, e.target.checked)}
                                                />
                                            </td>
                                            <td style={tdStyle} title={report.originalKey}>
                                                {report.originalKey}
                                            </td>
                                            <td style={tdStyle}>{new Date(report.timestamp).toLocaleString()}</td>
                                            <td style={tdStyle}>{report.bbCodeVersion}</td>
                                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    className="me-2"
                                                    onClick={() => {
                                                        if (bbCodeVersion === 2) {
                                                            handleReportSelectedForAttachment(report.key, selectedEmployee.value);
                                                        } else if (loadReport) {
                                                            loadReport(report.key, selectedEmployee.value);
                                                        }
                                                        onHide(); // Close modal after action
                                                    }}
                                                    disabled={isLoadingReports || !selectedEmployee}
                                                >
                                                    {bbCodeVersion === 2 ? 'Attacher' : 'Charger'}
                                                </Button>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (window.confirm('Êtes-vous sûr de vouloir supprimer ce rapport ? Cette action est irréversible.')) {
                                                            deleteReportForUser(report.key, selectedEmployee.value);
                                                        }
                                                    }}
                                                    disabled={isLoadingReports || !selectedEmployee}
                                                >
                                                    Supprimer
                                                </Button>
                                                <Button
                                                    onClick={() => handleCopyBBCode(report.key)}
                                                    style={copyButtonStyle}
                                                    title="Copier le BBCode"
                                                >
                                                    Copier le BBCode
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        !isLoadingReports &&
                        selectedEmployee && (
                            <p style={{ textAlign: 'center', marginTop: '20px' }}>
                                {searchQuery
                                    ? `Aucun rapport ne correspond à votre recherche pour ${selectedEmployee.label}.`
                                    : `Aucun rapport enregistré pour ${selectedEmployee.label}.`}
                            </p>
                        )
                    )}
                    {!isLoadingReports && !selectedEmployee && (
                        <p style={{ textAlign: 'center', marginTop: '20px' }}>
                            Veuillez sélectionner un employé dans le formulaire principal pour voir ses rapports enregistrés.
                        </p>
                    )}
                </div>

                {!isLoadingReports && selectedEmployee && searchedAndFilteredReports.length > 0 && (
                    <div style={bulkActionsContainerStyle}>
                        <Button
                            onClick={handleDeleteSelected}
                            style={deleteButtonStyle}
                            disabled={selectedReportKeys.length === 0}
                        >
                            Supprimer la sélection ({selectedReportKeys.length})
                        </Button>
                        <Button
                            onClick={handleCopySelectedBBCode}
                            style={copyButtonStyle}
                            disabled={selectedReportKeys.length === 0}
                        >
                            Copier le BBCode sélectionné ({selectedReportKeys.length})
                        </Button>
                        <Button
                            style={actionButtonStyle}
                            disabled={selectedReportKeys.length === 0 || isLoadingMultiple}
                            onClick={handleLoadSelected}
                        >
                            {isLoadingMultiple ? (
                                <>
                                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>
                                    Chargement...
                                </>
                            ) : (
                                `${bbCodeVersion === 2 ? 'Attacher la sélection' : 'Charger la sélection'} (${selectedReportKeys.length})`
                            )}
                        </Button>
                    </div>
                )}

                {totalPages > 1 && !isLoadingReports && selectedEmployee && (
                    <div style={paginationStyle}>
                        <Button onClick={goToPreviousPage} disabled={currentPage === 1} style={actionButtonStyle}>
                            Précédent
                        </Button>
                        <span>
                            Page {currentPage} sur {totalPages}
                        </span>
                        <Button onClick={goToNextPage} disabled={currentPage === totalPages} style={actionButtonStyle}>
                            Suivant
                        </Button>
                    </div>
                )}
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default SavedReportsModal;