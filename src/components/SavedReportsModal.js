import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form, Dropdown } from 'react-bootstrap';
import Select from 'react-select';
import { copyToClipboard } from './notificationService';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { reportTitleOf, reportCreatorOf } from '../utils/patientRecords';
import { getFormDefinition } from '../formDefinitions';

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

// La colonne d'actions ne doit JAMAIS être tronquée (les boutons finissaient en « … »).
const actionsTdStyle = {
    ...tdStyle,
    maxWidth: 'none',
    overflow: 'visible',
    textOverflow: 'clip',
    whiteSpace: 'nowrap',
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
    deleteReportsForUser,
    loadReportForUser,
    handleReportSelectedForAttachment,
    currentCoronerEmployee,
    currentPhmcEmployee,
    filterByBbCodeVersions,
    onAttachReportSummaryRequest,
    preselectedEmployeeType,
    bbCodeVersion,
    loadSharedReportsForPatient,
    shareReportWithPatient,
    copyReportToOwnAccount,
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReportKeys, setSelectedReportKeys] = useState([]);
    const [isLoadingMultiple, setIsLoadingMultiple] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    const lastLoadedEmployeeRef = useRef(null);
    const isManualSelectionRef = useRef(false);

    const { employeeProfile, currentEmployee, isAdmin, isCivilian, civilianProfile, staffName } = useEmployeeAuth();
    // Le personnel (admin ou employé identifié) peut partager/copier un
    // rapport lié à un patient — un civil ne le peut jamais (Lot 5).
    const isStaffViewer = isAdmin || !!employeeProfile;
    // Nom sous lequel le médecin range ses rapports : sa fiche personnel (même pour
    // un admin, voir EmployeeAuthContext), JAMAIS son e-mail. Un admin sans fiche
    // personnel copie chez l'employé dont la liste est affichée.
    const staffAuthorNameForCopy = staffName
        || (isAdmin ? (selectedEmployee?.value || currentPhmcEmployee || currentCoronerEmployee || null) : null);

    // Un employé connecté (non-admin) consulte toujours SES PROPRES rapports,
    // directement, peu importe ce qui est sélectionné dans le formulaire
    // principal (currentPhmcEmployee/currentCoronerEmployee). Un admin garde
    // le comportement précédent (pré-sélection pratique basée sur le
    // formulaire, mais libre de choisir n'importe quel employé). Un visiteur
    // non connecté ne peut rien consulter du tout — voir le rendu plus bas.
    useEffect(() => {
        if (show && !isManualSelectionRef.current) {
            // Un Civil n'existe pas dans employeeOptions (ce n'est pas un
            // employé) : sa "sélection" est synthétique, construite directement
            // à partir de civilianProfile — même format que l'auteur utilisé à
            // la sauvegarde (voir handleSaveReportWrapper dans MainApp.js), pour
            // retomber exactement sur le même savedReports/{sanitizedAuthorId}.
            // On charge en plus les rapports que le personnel lui a partagés
            // (patientRecords, Lot 5), invisibles via ce chemin auteur seul.
            if (isCivilian && civilianProfile) {
                const civilName = civilianProfile.firstName && civilianProfile.lastName
                    ? `${civilianProfile.firstName} ${civilianProfile.lastName}`
                    : (civilianProfile.email || '');
                const civilAuthorValue = `${civilName} [${civilianProfile.patientID}]`;
                if (civilAuthorValue !== lastLoadedEmployeeRef.current) {
                    setSelectedEmployee({ value: civilAuthorValue, label: `${civilName} (Civil)` });
                    lastLoadedEmployeeRef.current = civilAuthorValue;
                    // Attend la fin du chargement des rapports "propriétaire" (qui
                    // REMPLACE tout le tableau savedReports) avant d'y AJOUTER les
                    // rapports partagés, pour éviter que l'un écrase l'autre.
                    Promise.resolve(onEmployeeSelect(civilAuthorValue)).then(() => {
                        if (civilianProfile.patientID && loadSharedReportsForPatient) {
                            loadSharedReportsForPatient(civilianProfile.patientID);
                        }
                    });
                }
                return;
            }

            let employeeToSelectValue = null;

            if (isAdmin) {
                if (currentPhmcEmployee) {
                    employeeToSelectValue = currentPhmcEmployee;
                } else if (currentCoronerEmployee) {
                    employeeToSelectValue = currentCoronerEmployee;
                } else if (preselectedEmployeeType === 'PHMC') {
                    employeeToSelectValue = currentPhmcEmployee;
                } else {
                    employeeToSelectValue = currentCoronerEmployee || currentPhmcEmployee;
                }
                // Un admin qui est aussi médecin retrouve ses propres rapports par défaut.
                if (!employeeToSelectValue && staffName) {
                    employeeToSelectValue = staffName;
                }
            } else if (currentEmployee && staffName) {
                employeeToSelectValue = staffName;
            }

            // Find the matching employee option
            let employeeOption = employeeOptions?.flatMap(group => group.options).find(
                (opt) => opt.value === employeeToSelectValue
            );
            // Un employé non-admin charge TOUJOURS ses propres rapports : on ne dépend pas de la
            // liste d'options (en cache jusqu'à 7 jours, elle peut ne pas encore contenir un
            // employé récent, ce qui laissait la liste vide).
            if (!employeeOption && !isAdmin && employeeToSelectValue) {
                employeeOption = { value: employeeToSelectValue, label: employeeToSelectValue };
            }

            if (employeeOption && employeeToSelectValue !== lastLoadedEmployeeRef.current) {
                setSelectedEmployee(employeeOption);
                onEmployeeSelect(String(employeeOption.value));
                lastLoadedEmployeeRef.current = employeeToSelectValue;
            } else if (!employeeOption && lastLoadedEmployeeRef.current !== '__none__') {
                lastLoadedEmployeeRef.current = '__none__';
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
    }, [show, currentCoronerEmployee, currentPhmcEmployee, employeeOptions, preselectedEmployeeType, onEmployeeSelect, isAdmin, currentEmployee, employeeProfile, staffName, isCivilian, civilianProfile, loadSharedReportsForPatient]);

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
            const currentEmployeeName = staffName || employeeProfile.name;
            const restricted = options.map(group => ({
                ...group,
                options: group.options.filter(opt => opt.value === currentEmployeeName)
            })).filter(group => group.options.length > 0);
            return restricted.length > 0
                ? restricted
                : [{ label: 'Moi', options: [{ value: currentEmployeeName, label: currentEmployeeName }] }];
        }
        
        return options;
    }, [employeeOptions, preselectedEmployeeType, isAdmin, currentEmployee, employeeProfile, staffName]);

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

        // Garde-fou : on peut sélectionner autant de rapports qu'on veut pour les supprimer ou
        // copier leur BBCode, mais on ne CHARGE qu'un rapport à la fois (chaque rapport
        // remplace le formulaire correspondant). Seul l'attachement à l'Email DMEC en accepte
        // plusieurs.
        if (bbCodeVersion !== 2) {
            if (selectedReportKeys.length > 1) {
                showNotification("Vous ne pouvez charger qu'un seul rapport à la fois. Désélectionnez les autres rapports (la suppression et la copie du BBCode restent possibles en sélection multiple).", 'warning', 7000);
                return;
            }
            const target = sortedReports.find((r) => r.key === selectedReportKeys[0]);
            if (target && (!isLoadable(target) || target.sharedByStaff)) {
                showNotification(target.sharedByStaff
                    ? 'Un rapport partagé par le personnel se consulte et se copie, mais ne peut pas être rechargé dans un formulaire.'
                    : "Ce rapport (ex. formulaire AMA) n'a pas de formulaire associé : il ne peut pas être rechargé.", 'warning', 6000);
                return;
            }
        }

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

    const handleDeleteSelected = async () => {
        if (selectedReportKeys.length === 0 || !selectedEmployee?.value) {
            showNotification('Aucun rapport sélectionné ou aucun employé identifié.', 'warning');
            return;
        }
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedReportKeys.length} rapport(s) sélectionné(s) ? Cette action est irréversible.`)) {
            return;
        }
        const reportsToDelete = sortedReports
            .filter((r) => selectedReportKeys.includes(r.key))
            .map(toDeletePayload);
        setSelectedReportKeys([]);
        // Les règles (qui peut supprimer quoi) et les notifications sont gérées par le hook.
        await deleteReportsForUser(reportsToDelete, selectedEmployee.value);
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

    // Rapport rechargeable dans un formulaire ? (un formulaire AMA, par exemple, n'en a pas)
    const isLoadable = (report) => report.kind !== 'ama' && !!getFormDefinition(report.bbCodeVersion)?.FieldComponent;

    // Ce que deleteReportsForUser a besoin de savoir pour appliquer les règles de suppression.
    const toDeletePayload = (report) => ({
        key: report.key,
        reportPath: report.reportPath,
        patientID: report.patientID,
        sharedByStaff: report.sharedByStaff,
        isCopy: report.isCopy,
        copiedFrom: report.copiedFrom,
    });

    const handleCopyTitle = async (report) => {
        const title = reportTitleOf(report);
        if (title) {
            await copyToClipboard(title, showNotification, 'Titre copié !');
        } else {
            showNotification('Aucun titre trouvé pour ce rapport.', 'warning');
        }
    };

    const handleCopyImageLink = async (report) => {
        if (report.imageUrl) {
            await copyToClipboard(report.imageUrl, showNotification, "Lien de l'image copié !");
        } else {
            showNotification("Aucun lien d'image enregistré pour ce rapport.", 'warning');
        }
    };

    const handleCopySelectedTitles = async () => {
        if (selectedReportKeys.length === 0) {
            showNotification('Aucun rapport sélectionné à copier.', 'warning');
            return;
        }
        const titles = sortedReports
            .filter((r) => selectedReportKeys.includes(r.key))
            .map((r) => reportTitleOf(r))
            .filter(Boolean);
        if (titles.length > 0) {
            await copyToClipboard(titles.join('\n'), showNotification, `${titles.length} titre(s) copié(s) !`);
        } else {
            showNotification('Aucun titre trouvé dans les rapports sélectionnés.', 'warning');
        }
    };

    // Menu « Copier ▾ » d'une ligne : BBCode + titre (ou titre + lien de l'image pour un AMA).
    const renderCopyMenu = (report) => (
        <Dropdown className="d-inline-block me-2">
            <Dropdown.Toggle size="sm" style={{ backgroundColor: '#2f81f7', border: 'none' }} title="Copier le BBCode, le titre…">
                Copier
            </Dropdown.Toggle>
            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                {report.kind === 'ama' ? (
                    <>
                        <Dropdown.Item onClick={() => handleCopyTitle(report)}>Copier le titre</Dropdown.Item>
                        <Dropdown.Item onClick={() => handleCopyImageLink(report)} disabled={!report.imageUrl}>
                            Copier le lien de l'image
                        </Dropdown.Item>
                    </>
                ) : (
                    <>
                        <Dropdown.Item onClick={() => handleCopyBBCode(report.key)}>Copier le BBCode</Dropdown.Item>
                        <Dropdown.Item onClick={() => handleCopyTitle(report)}>Copier le titre</Dropdown.Item>
                    </>
                )}
            </Dropdown.Menu>
        </Dropdown>
    );

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
                    {currentEmployee && (
                        <input
                            type="text"
                            placeholder="Rechercher des rapports par nom/identifiant..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={searchInputStyle}
                            disabled={!selectedEmployee || isLoadingReports}
                        />
                    )}
                    {isAdmin && (
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
                    )}
                    {isAdmin && canSwitchEmployee && !preselectedEmployeeType && (
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
                        Rapports enregistrés {selectedEmployee ? `pour ${selectedEmployee.label}` : (!currentEmployee ? '(Non connecté)' : '(Aucun employé sélectionné)')}
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
                                    <th style={thStyle}>Titre du rapport</th>
                                    <th style={thStyle}>Créé par</th>
                                    <th style={thStyle}>Date et heure d'enregistrement</th>
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
                                            <td style={{ ...tdStyle, maxWidth: '420px' }} title={reportTitleOf(report) || report.originalKey}>
                                                {report.originalKey}
                                            </td>
                                            <td style={tdStyle} title="Créateur d'origine du rapport">
                                                {reportCreatorOf(report) || 'N/A'}
                                                {report.isCopy && (
                                                    <span style={{ marginLeft: '6px', fontSize: '0.75em', padding: '1px 6px', borderRadius: '8px', backgroundColor: '#1f6feb', color: '#fff' }}>
                                                        Copie
                                                    </span>
                                                )}
                                            </td>
                                            <td style={tdStyle}>{new Date(report.timestamp).toLocaleString()}</td>
                                            <td style={actionsTdStyle}>
                                                {isLoadable(report) && !report.sharedByStaff && (loadReport || bbCodeVersion === 2) && (
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
                                                )}
                                                {renderCopyMenu(report)}
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    className="me-2"
                                                    onClick={async () => {
                                                        if (window.confirm('Êtes-vous sûr de vouloir supprimer ce rapport ? Cette action est irréversible.')) {
                                                            await deleteReportsForUser([toDeletePayload(report)], selectedEmployee.value);
                                                        }
                                                    }}
                                                    disabled={isLoadingReports || !selectedEmployee}
                                                >
                                                    Supprimer
                                                </Button>
                                                {report.sharedByStaff && (
                                                    <span style={{ marginLeft: '5px', fontSize: '0.8em', color: '#8b949e' }}>
                                                        <i className="fas fa-share-alt" style={{ marginRight: '4px' }}></i>
                                                        Partagé par le personnel
                                                    </span>
                                                )}
                                                {isStaffViewer && report.patientID && !report.sharedByStaff && !report.isCopy && (
                                                    <Button
                                                        size="sm"
                                                        className="me-2"
                                                        style={{ backgroundColor: '#8957e5', border: 'none' }}
                                                        title="Rendre ce rapport visible au patient dans son propre compte"
                                                        onClick={() => shareReportWithPatient && shareReportWithPatient(report.patientID, report.key)}
                                                    >
                                                        Partager avec le patient
                                                    </Button>
                                                )}
                                                {isStaffViewer && report.patientID && !report.sharedByStaff && report.authorName !== staffAuthorNameForCopy && (
                                                    <Button
                                                        size="sm"
                                                        style={{ backgroundColor: '#316dca', border: 'none' }}
                                                        title={staffAuthorNameForCopy
                                                            ? `Enregistrer une copie de ce rapport dans les rapports de ${staffAuthorNameForCopy}`
                                                            : 'Impossible de déterminer à quel médecin rattacher la copie'}
                                                        onClick={() => copyReportToOwnAccount && copyReportToOwnAccount(report.reportPath, staffAuthorNameForCopy, { patientID: report.patientID })}
                                                        disabled={!staffAuthorNameForCopy}
                                                    >
                                                        Récupérer une copie
                                                    </Button>
                                                )}
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
                            {!currentEmployee
                                ? 'Vous devez être connecté pour consulter les rapports enregistrés.'
                                : isAdmin
                                ? 'Veuillez sélectionner un employé pour voir ses rapports enregistrés.'
                                : 'Impossible de retrouver votre fiche employé associée à ce compte. Contactez un administrateur.'}
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
                        <Dropdown drop="up">
                            <Dropdown.Toggle style={copyButtonStyle} disabled={selectedReportKeys.length === 0}>
                                Copier la sélection ({selectedReportKeys.length})
                            </Dropdown.Toggle>
                            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                <Dropdown.Item onClick={handleCopySelectedBBCode}>Copier le BBCode sélectionné</Dropdown.Item>
                                <Dropdown.Item onClick={handleCopySelectedTitles}>Copier les titres sélectionnés</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                        {(loadReport || bbCodeVersion === 2) && (
                        <Button
                            style={actionButtonStyle}
                            disabled={selectedReportKeys.length === 0 || isLoadingMultiple || (bbCodeVersion !== 2 && selectedReportKeys.length > 1)}
                            title={bbCodeVersion !== 2 && selectedReportKeys.length > 1 ? 'Un seul rapport peut être chargé à la fois' : ''}
                            onClick={handleLoadSelected}
                        >
                            {isLoadingMultiple ? (
                                <>
                                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>
                                    Chargement...
                                </>
                            ) : (
                                `${bbCodeVersion === 2 ? 'Attacher la sélection' : 'Charger le rapport sélectionné'} (${selectedReportKeys.length})`
                            )}
                        </Button>
                        )}
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