import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form, Dropdown, Modal } from 'react-bootstrap';
import Select from 'react-select';
import { copyToClipboard } from './notificationService';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { reportTitleOf, reportCreatorOf, comprehensiveSanitize } from '../utils/patientRecords';
import useReportIndexStatus from '../hooks/useReportIndexStatus';
import { logActivity } from '../utils/activityLog';
import { ACCEPTED_REPORT_LABELS } from '../utils/employerSummary';
import { getFormDefinition } from '../formDefinitions';
import PatientInvoicesPanel from './PatientInvoicesPanel';
import useReportInvoices from '../hooks/useReportInvoices';
import { INVOICE_STATUS_COLORS } from '../utils/patientBilling';
import { ReportCard, FilterChips, PaymentPill, Pill, BulkBar, Pager } from './Reports/ReportParts';
import ForumHint from './ForumHint';
import useForumNotice from '../hooks/useForumNotice';
import { downloadBbCodeAsHtml, combineBbCodes, combineBbCodesForExport, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../utils/reportExport';
import ReportExpansion, { ExpandToggle, useExpansions } from './ReportExpansion';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../utils/reportDocumentExport';
import useWriteLock from '../hooks/useWriteLock';
import { readFamiliesOf, isPublicDeathVersion, isDmecReportVersion } from '../utils/reportAccess';
import { loadFreezeMap, freezeReport, liftFreeze, isFrozen, AUTHORITY_TYPES, FREEZE_MESSAGE } from '../utils/judicialFreeze';
import { publishReport, unpublishReport } from '../utils/deathReports';
import PublishedDeathReportsModal from './PublishedDeathReportsModal';

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
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid #30363d',
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
        color: '#9aa7b4',
    }),
    group: (base) => ({
        ...base,
        paddingTop: 8,
        paddingBottom: 8,
    }),
    groupHeading: (base) => ({
        ...base,
        color: '#9aa7b4',
        fontWeight: 600,
        textTransform: 'uppercase',
        fontSize: '0.75rem',
        marginBottom: 4,
    }),
};

const itemsPerPage = 10;
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
    attachMode,
    initialEmployeeName = '',
    loadSharedReportsForPatient,
    loadCivilianDossier,
    shareReportWithPatient,
    copyReportToOwnAccount,
}) => {
    // Mode « joindre » : UNIQUEMENT quand la fenêtre est ouverte par le bouton « Joindre un rapport » d'un formulaire
    // (attachMode). Ouverte depuis la boîte à outils, c'est la liste habituelle (bouton « Charger »), même sur l'Email DMEC.
    // L'Email DMEC joint un rapport de décès ou de catastrophe mortelle ; le certificat médical joint un rapport clinique
    // accepté sous forme de résumé simplifié (voir filterByBbCodeVersions). Un seul rapport à la fois dans les deux cas.
    const isAttachMode = !!attachMode;
    const isCertificateAttach = isAttachMode && bbCodeVersion !== 2;
    const isCoronerAttach = isAttachMode && bbCodeVersion === 2;
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReportKeys, setSelectedReportKeys] = useState([]);
    const [isLoadingMultiple, setIsLoadingMultiple] = useState(false);
    const [selectedEmployeeRaw, setSelectedEmployee] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all'); // all | unpaid | paid | copies | shared
    const [typeFilter, setTypeFilter] = useState('');        // libellé du type de rapport, '' = tous

    const lastLoadedEmployeeRef = useRef(null);
    const isManualSelectionRef = useRef(false);

    const { employeeProfile, currentEmployee, isAdmin, isCivilian, civilianProfile, staffName, staffProfile } = useEmployeeAuth();
    // Rapport Public de Décès : le DMEC (et les admins) le publie / le dépublie ; tout le personnel lit ceux qui sont publiés.
    const viewerIsDmec = isAdmin || readFamiliesOf(staffProfile).dmec;
    const [showPublished, setShowPublished] = useState(false);
    const [publishBusy, setPublishBusy] = useState(false);
    const [publishOverrides, setPublishOverrides] = useState({}); // { [clé du rapport]: true | false } après une (dé)publication
    const [unpublishTarget, setUnpublishTarget] = useState(null);
    const [unpublishReason, setUnpublishReason] = useState('');
    // Gel judiciaire : { [clé du rapport]: entrée } ; la fenêtre de saisie sert à geler (autorité, référence, motif) et à lever (justificatif).
    const [freezes, setFreezes] = useState({});
    const [freezeTarget, setFreezeTarget] = useState(null);   // { report, mode: 'freeze' | 'lift' }
    const [freezeForm, setFreezeForm] = useState({ autorite: 'mandat', reference: '', motif: '' });
    const [freezeBusy, setFreezeBusy] = useState(false);
    // État de paiement des rapports payants (à payer / payé / sans paiement), visible du patient comme du médecin.
    const { invoiceOf } = useReportInvoices(reportsForSelectedUser, !!show);
    // Partagé avec le patient ? Copie déjà récupérée ? Même enregistrement que « Dossier Patient » (relié : jamais deux fois).
    const [indexRefresh, setIndexRefresh] = useState(0);
    const { openForumNotice, forumNoticeModal } = useForumNotice();
    const { locked, lockTitle } = useWriteLock();
    const { bbcodeEnabled } = useSiteConfig();
    const { open: openRows, toggle: toggleRow, setTab: setRowTab } = useExpansions();
    // Personne de connecté = aucune liste, même si une sélection (ou des rapports) datait d'une session
    // précédente : on ne peut ni afficher ni copier le titre / le BBCode d'un rapport sans compte.
    const selectedEmployee = currentEmployee ? selectedEmployeeRaw : null;
    useEffect(() => {
        if (!currentEmployee && selectedEmployeeRaw) {
            setSelectedEmployee(null);
            lastLoadedEmployeeRef.current = null;
            isManualSelectionRef.current = false;
            setSelectedReportKeys([]);
        }
    }, [currentEmployee, selectedEmployeeRaw]);
    // Le personnel (admin ou employé identifié) peut partager/copier un
    // rapport lié à un patient — un civil ne le peut jamais (Lot 5).
    const isStaffViewer = isAdmin || !!employeeProfile;
    // Nom sous lequel le médecin range ses rapports : sa fiche personnel (même pour
    // un admin, voir EmployeeAuthContext), JAMAIS son e-mail. Un admin sans fiche
    // personnel copie chez l'employé dont la liste est affichée.
    const staffAuthorNameForCopy = staffName
        || (isAdmin ? (selectedEmployee?.value || currentPhmcEmployee || currentCoronerEmployee || null) : null);

    const { statusOf } = useReportIndexStatus(reportsForSelectedUser, !!show && isStaffViewer, indexRefresh);
    const myCopyKey = comprehensiveSanitize(staffAuthorNameForCopy || '');

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
                    // Charge le dossier du civil par son ID patient (patientRecords), plus par le nœud
                    // savedReports/{nom} — ce qui permet de fermer la lecture de savedReports aux civils.
                    if (civilianProfile.patientID && loadCivilianDossier) {
                        loadCivilianDossier(civilianProfile.patientID);
                    }
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
            setStatusFilter('all');
            setTypeFilter('');
            setSelectedReportKeys([]);
            lastLoadedEmployeeRef.current = null;
            isManualSelectionRef.current = false;
        }
    }, [show, currentCoronerEmployee, currentPhmcEmployee, employeeOptions, preselectedEmployeeType, onEmployeeSelect, isAdmin, currentEmployee, employeeProfile, staffName, isCivilian, civilianProfile, loadSharedReportsForPatient, loadCivilianDossier]);

    // Ouvert depuis l'annuaire sur un employé précis (admin) : on le sélectionne directement.
    useEffect(() => {
        if (!show || !initialEmployeeName || !isAdmin) return;
        const option = employeeOptions?.flatMap((group) => group.options).find((candidate) => candidate.value === initialEmployeeName);
        if (option && selectedEmployeeRaw?.value !== option.value) handleEmployeeSelect(option);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, initialEmployeeName, employeeOptions, isAdmin]);

    const handleEmployeeSelect = (selectedOption) => {
        // Consulter les rapports d'un AUTRE employé (admin) laisse une trace.
        if (selectedOption && isAdmin && selectedOption.value !== staffName) {
            logActivity({ category: 'rapports', action: 'reports_viewed_other', summary: `Rapports enregistrés de ${selectedOption.label || selectedOption.value} consultés`, target: String(selectedOption.value) });
        }
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
        if (!currentEmployee) return [];
        return [...(reportsForSelectedUser || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }, [reportsForSelectedUser, currentEmployee]);

    // Libellé du type de rapport (formulaire).
    const typeLabelOf = (report) => (report.kind === 'ama'
        ? 'Formulaire AMA'
        : (getFormDefinition(report.bbCodeVersion)?.name || `Formulaire ${report.bbCodeVersion}`));

    // Recherche par titre (et rapports joignables seulement en mode « joindre »).
    const baseReports = useMemo(() => {
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

    const matchesStatus = (report, key) => {
        if (key === 'unpaid') return invoiceOf(report)?.statutEffectif === 'a_payer';
        if (key === 'paid') return invoiceOf(report)?.statutEffectif === 'paye';
        if (key === 'copies') return !!report.isCopy;
        if (key === 'shared') return !!report.sharedByStaff;
        return true;
    };

    const typeOptions = useMemo(() => {
        const counts = new Map();
        baseReports.forEach((report) => counts.set(typeLabelOf(report), (counts.get(typeLabelOf(report)) || 0) + 1));
        return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label));
    }, [baseReports]); // eslint-disable-line react-hooks/exhaustive-deps

    const searchedAndFilteredReports = useMemo(() => baseReports.filter(
        (report) => (!typeFilter || typeLabelOf(report) === typeFilter) && matchesStatus(report, statusFilter)
    ), [baseReports, typeFilter, statusFilter, invoiceOf]); // eslint-disable-line react-hooks/exhaustive-deps

    // Compteurs des pastilles (dans le type choisi).
    const statusChips = useMemo(() => {
        const inType = baseReports.filter((report) => !typeFilter || typeLabelOf(report) === typeFilter);
        const count = (key) => inType.filter((report) => matchesStatus(report, key)).length;
        return [
            { key: 'all', label: 'Tous', count: inType.length },
            { key: 'unpaid', label: 'À payer', count: count('unpaid'), color: '#d29922' },
            { key: 'paid', label: 'Payés', count: count('paid'), color: '#3fb950' },
            { key: 'copies', label: 'Copies', count: count('copies'), color: '#a371f7' },
            { key: 'shared', label: 'Partagés par le personnel', count: count('shared'), color: '#58a6ff' },
        ];
    }, [baseReports, typeFilter, invoiceOf]); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (isAttachMode && selectedReportKeys.length > 1) {
            showNotification("On ne peut joindre qu'un seul rapport à la fois : sélectionnez-en un seul.", 'warning', 6000);
            return;
        }
        if (!isAttachMode) {
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

        const isAttaching = isAttachMode;
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
        const hasAma = sortedReports.some((r) => selectedReportKeys.includes(r.key) && r.kind === 'ama');
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedReportKeys.length} rapport(s) sélectionné(s) ? Cette action est irréversible.${hasAma ? '\n\n⚠ La sélection contient un formulaire AMA (refus de soins signé) : sa suppression sera consignée dans le journal d\'activité avec un avertissement.' : ''}`)) {
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

    // Téléchargement HTML (forum GTA World) : un rapport, ou la sélection en un seul fichier.
    const handleDownloadHtml = (report) => {
        if (downloadBbCodeAsHtml({ bbCode: report?.bbCode, title: reportTitleOf(report) || report?.originalKey, showNotification })) {
            openForumNotice('html');
        }
    };

    const handleDownloadSelectedHtml = () => {
        if (selectedReportKeys.length === 0) {
            showNotification('Aucun rapport sélectionné à exporter.', 'warning');
            return;
        }
        const reportsToExport = sortedReports.filter((r) => selectedReportKeys.includes(r.key));
        const title = reportsToExport.length === 1
            ? (reportTitleOf(reportsToExport[0]) || reportsToExport[0].originalKey)
            : `${reportsToExport.length} rapports`;
        if (downloadBbCodeAsHtml({ bbCode: combineBbCodesForExport(reportsToExport), title, showNotification })) openForumNotice('html');
    };

    // PDF (A4) / SVG : un rapport, ou la sélection en un seul document.
    const handleExportDocument = (format, report) => {
        exportReportDocument(format, { bbCode: report?.bbCode, title: reportTitleOf(report) || report?.originalKey, showNotification });
    };

    const handleExportSelectedDocument = (format) => {
        if (selectedReportKeys.length === 0) {
            showNotification('Aucun rapport sélectionné à exporter.', 'warning');
            return;
        }
        const reportsToExport = sortedReports.filter((r) => selectedReportKeys.includes(r.key));
        const title = reportsToExport.length === 1
            ? (reportTitleOf(reportsToExport[0]) || reportsToExport[0].originalKey)
            : `${reportsToExport.length} rapports`;
        exportReportDocument(format, { bbCode: combineBbCodesForExport(reportsToExport), title, showNotification });
    };

    // Rapport rechargeable dans un formulaire ? (un formulaire AMA, par exemple, n'en a pas)
    const isLoadable = (report) => report.kind !== 'ama' && !!getFormDefinition(report.bbCodeVersion)?.FieldComponent;

    // Ce que deleteReportsForUser a besoin de savoir pour appliquer les règles de suppression.
    const toDeletePayload = (report) => ({
        kind: report.kind,
        title: reportTitleOf(report) || report.originalKey,
        key: report.key,
        reportPath: report.reportPath,
        patientID: report.patientID,
        sharedByStaff: report.sharedByStaff,
        isCopy: report.isCopy,
        copiedFrom: report.copiedFrom,
    });

    const handlePublish = async (report) => {
        if (publishBusy) return;
        if (!window.confirm("Publier ce rapport public de décès ? Tout le personnel du PHMC pourra le consulter (lecture seule). Vous pourrez le dépublier plus tard, avec un justificatif.")) return;
        setPublishBusy(true);
        try {
            await publishReport({ reportPath: report.reportPath, title: reportTitleOf(report) || report.originalKey, patientID: report.patientID, byName: staffName || 'admin' });
            setPublishOverrides((previous) => ({ ...previous, [report.key]: true }));
            showNotification('Rapport publié : le personnel peut maintenant le consulter.', 'check-circle');
        } catch (error) {
            console.error('Publication impossible :', error);
            showNotification(`Publication impossible : ${String(error?.message || error).slice(0, 140)}`, 'error');
        } finally {
            setPublishBusy(false);
        }
    };

    const handleConfirmUnpublish = async () => {
        if (!unpublishTarget || publishBusy) return;
        if (!unpublishReason.trim()) { showNotification('Un justificatif est obligatoire pour dépublier un rapport.', 'warning'); return; }
        setPublishBusy(true);
        try {
            await unpublishReport({
                reportPath: unpublishTarget.reportPath, title: reportTitleOf(unpublishTarget) || unpublishTarget.originalKey,
                patientID: unpublishTarget.patientID, byName: staffName || 'admin', reason: unpublishReason,
            });
            setPublishOverrides((previous) => ({ ...previous, [unpublishTarget.key]: false }));
            showNotification('Rapport dépublié : le personnel ne peut plus le consulter.', 'check-circle');
            setUnpublishTarget(null);
            setUnpublishReason('');
        } catch (error) {
            console.error('Dépublication impossible :', error);
            showNotification(`Dépublication impossible : ${String(error?.message || error).slice(0, 140)}`, 'error');
        } finally {
            setPublishBusy(false);
        }
    };

    // Gel judiciaire (DMEC et admins : geler ; admins : lever, avec justificatif).
    useEffect(() => {
        if (!show || !isStaffViewer) return undefined;
        let cancelled = false;
        // Une lecture ratée n'efface rien : la suppression et les opérations d'admin revérifient le gel elles-mêmes.
        loadFreezeMap().then((map) => { if (!cancelled) setFreezes(map); }).catch((error) => console.warn('Gels judiciaires illisibles :', error?.message || error));
        return () => { cancelled = true; };
    }, [show, isStaffViewer]);
    const freezeOf = (report) => freezes[String(report.reportPath || '').split('/').pop()] || null;

    const openFreezeDialog = (report, mode) => {
        setFreezeForm({ autorite: 'mandat', reference: '', motif: '' });
        setFreezeTarget({ report, mode });
    };

    const handleConfirmFreeze = async () => {
        if (!freezeTarget || freezeBusy) return;
        const { report, mode } = freezeTarget;
        const key = String(report.reportPath || '').split('/').pop();
        setFreezeBusy(true);
        try {
            if (mode === 'freeze') {
                const entry = await freezeReport({
                    reportPath: report.reportPath, title: reportTitleOf(report) || report.originalKey, patientID: report.patientID,
                    byName: staffName || 'admin', ...freezeForm,
                });
                setFreezes((previous) => ({ ...previous, [key]: entry }));
                showNotification('Rapport gelé : il ne peut plus être modifié, supprimé ni publié.', 'check-circle');
            } else {
                await liftFreeze({
                    reportPath: report.reportPath, title: reportTitleOf(report) || report.originalKey, patientID: report.patientID,
                    byName: staffName || 'admin', reason: freezeForm.motif,
                });
                setFreezes((previous) => ({ ...previous, [key]: { ...previous[key], actif: false } }));
                showNotification('Gel judiciaire levé.', 'check-circle');
            }
            setFreezeTarget(null);
        } catch (error) {
            console.error('Gel judiciaire impossible :', error);
            showNotification(String(error?.message || error).slice(0, 160), 'error');
        } finally {
            setFreezeBusy(false);
        }
    };

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
        <Dropdown className="d-inline-block">
            <Dropdown.Toggle size="sm" variant="secondary" title={bbcodeEnabled ? 'Copier le BBCode (forum PHMC), télécharger le HTML (forum GTA World), copier le titre…' : 'Télécharger le HTML, copier le titre…'}>
                Copier
            </Dropdown.Toggle>
            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                {report.kind === 'ama' && !report.bbCode ? (
                    <>
                        <Dropdown.Item onClick={() => handleCopyTitle(report)}>Copier le titre</Dropdown.Item>
                        <Dropdown.Item onClick={() => handleCopyImageLink(report)} disabled={!report.imageUrl}>
                            Copier le lien de l'image
                        </Dropdown.Item>
                    </>
                ) : (
                    <>
                        {bbcodeEnabled && (
<Dropdown.Item onClick={() => handleCopyBBCode(report.key)} title={COPY_BBCODE_HINT}>
                            Copier le BBCode<ForumHint kind="bbcode" />
                        </Dropdown.Item>
)}
                        <Dropdown.Item onClick={() => handleDownloadHtml(report)} disabled={!report.bbCode} title={DOWNLOAD_HTML_HINT}>
                            Télécharger le HTML<ForumHint kind="html" />
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => handleExportDocument('pdf', report)} disabled={!report.bbCode}>{PDF_EXPORT_LABEL}</Dropdown.Item>
                        <Dropdown.Item onClick={() => handleExportDocument('png', report)} disabled={!report.bbCode}>Télécharger l'image (PNG, pour Discord)</Dropdown.Item>
                        <Dropdown.Item onClick={() => handleExportDocument('png-copy', report)} disabled={!report.bbCode}>Copier l'image (à coller dans Discord)</Dropdown.Item>
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

    // Une carte par rapport : titre, méta, pastilles (paiement, copie, partage), actions toujours visibles, aperçu déplié dessous.
    const renderReportCard = (report) => {
        const isSelected = selectedReportKeys.includes(report.key);
        const invoice = invoiceOf(report);
        const color = invoice
            ? (INVOICE_STATUS_COLORS[invoice.statutEffectif] || '#8b949e')
            : (report.isCopy ? '#a371f7' : (report.sharedByStaff ? '#58a6ff' : '#3fb950'));
        const title = reportTitleOf(report) || report.originalKey;
        const indexStatus = statusOf(report);
        const isAma = report.kind === 'ama';
        // Déjà vu par le patient (partagé, ou créé par lui) : le bouton « Partager » n'a plus de sens. L'AMA est partagé dès sa création.
        const alreadyShared = isAma || indexStatus?.visibility === 'shared' || indexStatus?.visibility === 'owner';
        const iHaveCopy = !!myCopyKey && !!indexStatus?.copiedBy?.[myCopyKey];
        const isPublicDeath = isPublicDeathVersion(report.bbCodeVersion) && !report.isCopy;
        const isPublished = isPublicDeath && (publishOverrides[report.key] ?? report.publie === true);
        const freeze = freezeOf(report);
        const frozen = isFrozen(freeze);
        const canFreeze = viewerIsDmec && isDmecReportVersion(report.bbCodeVersion) && !report.isCopy && !isAttachMode;
        return (
            <ReportCard
                key={report.key}
                color={color}
                selected={isSelected}
                selectId={`select-${report.key}`}
                onSelect={(checked) => handleCheckboxChange(report.key, checked)}
                title={report.originalKey}
                titleHint={title}
                meta={`${reportCreatorOf(report) || 'N/A'} · ${new Date(report.timestamp).toLocaleString()} · ${typeLabelOf(report)}`}
                chips={(
                    <>
                        <PaymentPill invoice={invoice} />
                        {report.isCopy && <Pill color="#a371f7" title="Copie d'un rapport créé par un autre médecin">Copie</Pill>}
                        {report.sharedByStaff && <Pill color="#58a6ff" title="Rapport partagé avec vous par le personnel">Partagé par le personnel</Pill>}
                        {alreadyShared && <Pill color="#58a6ff" title="Le patient voit déjà ce rapport dans son dossier">Partagé avec le patient</Pill>}
                        {iHaveCopy && <Pill color="#a371f7" title="Vous avez déjà récupéré une copie de ce rapport">Vous en avez une copie</Pill>}
                        {isPublished && <Pill color="#58a6ff" title="Publié : tout le personnel du PHMC peut le consulter">Publié</Pill>}
                        {frozen && <Pill color="#f85149" title={`Gel judiciaire depuis le ${new Date(freeze.depuis).toLocaleDateString('fr-FR')} (${AUTHORITY_TYPES[freeze.autorite] || 'autorité'}${freeze.reference ? ` ${freeze.reference}` : ''}) : ${freeze.motif}`}>Gel judiciaire</Pill>}
                    </>
                )}
                actions={(
                    <>
                        {isLoadable(report) && !report.sharedByStaff && (loadReport || isAttachMode) && (
                            <Button
                                variant="primary" size="sm"
                                onClick={() => {
                                    if (isAttachMode) {
                                        handleReportSelectedForAttachment(report.key, selectedEmployee.value);
                                    } else if (loadReport) {
                                        loadReport(report.key, selectedEmployee.value);
                                    }
                                    onHide(); // Close modal after action
                                }}
                                disabled={isLoadingReports || !selectedEmployee}
                            >
                                <i className={`fas ${isAttachMode ? 'fa-paperclip' : 'fa-upload'} me-1`}></i>{isAttachMode ? 'Joindre' : 'Charger'}
                            </Button>
                        )}
                        {renderCopyMenu(report)}
                        {(report.bbCode || report.imageUrl) && (
                            <ExpandToggle open={!!openRows[report.key]} onClick={() => toggleRow(report.key)} title="Déplier / replier l'aperçu du rapport" />
                        )}
                        {isStaffViewer && report.patientID && !report.sharedByStaff && !report.isCopy && !alreadyShared && (
                            <Button
                                size="sm" style={{ backgroundColor: '#8957e5', border: 'none' }}
                                title={locked ? lockTitle : 'Rendre ce rapport visible au patient dans son propre compte'}
                                disabled={locked}
                                onClick={async () => { if (shareReportWithPatient) { await shareReportWithPatient(report.patientID, report.key); setIndexRefresh((n) => n + 1); } }}
                            >
                                <i className="fas fa-share-nodes me-1"></i>Partager avec le patient
                            </Button>
                        )}
                        {isStaffViewer && report.patientID && !report.sharedByStaff && report.authorName !== staffAuthorNameForCopy && !iHaveCopy && (
                            <Button
                                size="sm" style={{ backgroundColor: '#316dca', border: 'none' }}
                                title={staffAuthorNameForCopy
                                    ? `Enregistrer une copie de ce rapport dans les rapports de ${staffAuthorNameForCopy}`
                                    : 'Impossible de déterminer à quel médecin rattacher la copie'}
                                onClick={async () => { if (copyReportToOwnAccount) { await copyReportToOwnAccount(report.reportPath, staffAuthorNameForCopy, { patientID: report.patientID }); setIndexRefresh((n) => n + 1); } }}
                                disabled={!staffAuthorNameForCopy || locked}
                            >
                                <i className="fas fa-copy me-1"></i>Récupérer une copie
                            </Button>
                        )}
                        {canFreeze && (frozen ? (isAdmin && (
                            <Button size="sm" variant="outline-danger" title="Lever le gel judiciaire (un justificatif est demandé)" disabled={locked || freezeBusy} onClick={() => openFreezeDialog(report, 'lift')}>
                                <i className="fas fa-lock-open me-1"></i>Lever le gel
                            </Button>
                        )) : ((isAdmin || !freeze) && (
                            // Un rapport dont le gel a été levé ne se regèle que par un admin (l'historique du gel est conservé).
                            <Button size="sm" variant="outline-danger" title={locked ? lockTitle : 'Geler ce rapport (procédure judiciaire en cours) : plus aucune modification ni suppression'} disabled={locked || freezeBusy} onClick={() => openFreezeDialog(report, 'freeze')}>
                                <i className="fas fa-gavel me-1"></i>Geler
                            </Button>
                        )))}
                        {isPublicDeath && viewerIsDmec && !isAttachMode && (isPublished ? (
                            <Button
                                size="sm" variant="outline-warning"
                                title={locked ? lockTitle : 'Retirer la publication (un justificatif est demandé)'}
                                disabled={locked || publishBusy || frozen}
                                onClick={() => { setUnpublishReason(''); setUnpublishTarget(report); }}
                            >
                                <i className="fas fa-eye-slash me-1"></i>Dépublier
                            </Button>
                        ) : (
                            <Button
                                size="sm" variant="success"
                                title={locked ? lockTitle : 'Rendre ce rapport consultable par tout le personnel du PHMC'}
                                disabled={locked || publishBusy || frozen}
                                onClick={() => handlePublish(report)}
                            >
                                <i className="fas fa-bullhorn me-1"></i>Publier
                            </Button>
                        ))}
                        {!(isCivilian && isAma) && <Button
                            variant="outline-danger" size="sm" className="ms-auto"
                            onClick={async () => {
                                const message = isAma
                                    ? "⚠ Vous allez supprimer un formulaire AMA (refus de soins signé par un patient). C'est une action grave : elle sera consignée dans le journal d'activité avec un avertissement.\n\nSupprimer cet AMA ?"
                                    : 'Êtes-vous sûr de vouloir supprimer ce rapport ? Cette action est irréversible.';
                                if (window.confirm(message)) {
                                    await deleteReportsForUser([toDeletePayload(report)], selectedEmployee.value);
                                }
                            }}
                            disabled={isLoadingReports || !selectedEmployee || locked || frozen}
                            title={locked ? lockTitle : (frozen ? FREEZE_MESSAGE : undefined)}
                        >
                            <i className="fas fa-trash me-1"></i>Supprimer
                        </Button>}
                    </>
                )}
                expansion={openRows[report.key] ? (
                    <ReportExpansion
                        tab={openRows[report.key]}
                        onTabChange={(tab) => setRowTab(report.key, tab)}
                        bbCode={report.bbCode}
                        imageUrl={report.imageUrl}
                        title={title}
                    />
                ) : null}
            />
        );
    };

    const hasReports = !isLoadingReports && !!selectedEmployee && sortedReports.length > 0;

    return ReactDOM.createPortal(
        <div style={modalStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                {forumNoticeModal}
                <PublishedDeathReportsModal show={showPublished} onHide={() => setShowPublished(false)} showNotification={showNotification} />
                <Modal show={!!unpublishTarget} onHide={() => { if (!publishBusy) setUnpublishTarget(null); }} centered style={{ zIndex: 1070 }}>
                    <Modal.Header closeButton><Modal.Title>Dépublier ce rapport</Modal.Title></Modal.Header>
                    <Modal.Body>
                        <p className="mb-2">« {unpublishTarget ? (reportTitleOf(unpublishTarget) || unpublishTarget.originalKey) : ''} » ne sera plus consultable par le personnel. Indiquez le justificatif (il est consigné dans le journal d'activité et sur le rapport).</p>
                        <Form.Control as="textarea" rows={3} maxLength={500} autoFocus value={unpublishReason} onChange={(event) => setUnpublishReason(event.target.value)} placeholder="Justificatif (obligatoire)" />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setUnpublishTarget(null)} disabled={publishBusy}>Annuler</Button>
                        <Button variant="warning" onClick={handleConfirmUnpublish} disabled={publishBusy || !unpublishReason.trim()}>
                            <i className="fas fa-eye-slash me-1"></i>Dépublier
                        </Button>
                    </Modal.Footer>
                </Modal>
                <Modal show={!!freezeTarget} onHide={() => { if (!freezeBusy) setFreezeTarget(null); }} centered style={{ zIndex: 1070 }}>
                    <Modal.Header closeButton><Modal.Title>{freezeTarget?.mode === 'lift' ? 'Lever le gel judiciaire' : 'Geler ce rapport'}</Modal.Title></Modal.Header>
                    <Modal.Body>
                        {freezeTarget?.mode === 'lift' ? (
                            <>
                                <p className="mb-2">« {reportTitleOf(freezeTarget.report) || freezeTarget.report.originalKey} » pourra de nouveau être modifié ou supprimé. Indiquez le justificatif (il est consigné dans le journal d'activité et sur le gel).</p>
                                <Form.Control as="textarea" rows={3} maxLength={500} autoFocus value={freezeForm.motif} onChange={(event) => setFreezeForm((f) => ({ ...f, motif: event.target.value }))} placeholder="Justificatif (obligatoire)" />
                            </>
                        ) : (
                            <>
                                <p className="mb-2">Tant que le rapport est gelé, plus personne ne peut le modifier, le supprimer, le publier ou le dépublier. Seul un administrateur peut lever le gel, avec un justificatif.</p>
                                <Form.Group className="mb-2">
                                    <Form.Label>Autorité à l'origine du gel</Form.Label>
                                    <Form.Select value={freezeForm.autorite} onChange={(event) => setFreezeForm((f) => ({ ...f, autorite: event.target.value }))}>
                                        {Object.entries(AUTHORITY_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-2">
                                    <Form.Label>Référence <small className="text-muted">(n° de mandat, de dossier… facultatif)</small></Form.Label>
                                    <Form.Control maxLength={120} value={freezeForm.reference} onChange={(event) => setFreezeForm((f) => ({ ...f, reference: event.target.value }))} />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Motif du gel</Form.Label>
                                    <Form.Control as="textarea" rows={2} maxLength={500} autoFocus value={freezeForm.motif} onChange={(event) => setFreezeForm((f) => ({ ...f, motif: event.target.value }))} placeholder="ex. Enquête en cours, rapport requis par le tribunal" />
                                </Form.Group>
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setFreezeTarget(null)} disabled={freezeBusy}>Annuler</Button>
                        <Button variant="danger" onClick={handleConfirmFreeze} disabled={freezeBusy || freezeForm.motif.trim().length < 3}>
                            <i className={`fas ${freezeTarget?.mode === 'lift' ? 'fa-lock-open' : 'fa-gavel'} me-1`}></i>{freezeTarget?.mode === 'lift' ? 'Lever le gel' : 'Geler le rapport'}
                        </Button>
                    </Modal.Footer>
                </Modal>
                <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                <div className="rpt-modal-head">
                    <h5><i className="fas fa-folder-open me-2"></i>Rapports enregistrés</h5>
                    <span className="rpt-sub">
                        {selectedEmployee
                            ? `${selectedEmployee.label} · ${sortedReports.length} rapport${sortedReports.length > 1 ? 's' : ''}`
                            : (!currentEmployee ? 'Non connecté' : 'Aucun employé sélectionné')}
                    </span>
                </div>

                {isStaffViewer && !isAttachMode && (
                    <div className="mb-2" style={{ flexShrink: 0 }}>
                        <Button size="sm" variant="outline-info" onClick={() => setShowPublished(true)} title="Rapports publics de décès publiés par le DMEC : consultables par tout le personnel">
                            <i className="fas fa-bullhorn me-1"></i>Rapports publics de décès publiés
                        </Button>
                    </div>
                )}

                {isAdmin && (
                    <div className="d-flex flex-wrap align-items-end gap-2 mb-2" style={{ flexShrink: 0 }}>
                        <Form.Group controlId="employeeSelect" style={{ flex: '1 1 320px', maxWidth: '520px' }}>
                            <Form.Label className="mb-1">Employé dont on affiche les rapports</Form.Label>
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
                                variant="primary" size="sm"
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
                                title={`Passer aux rapports pour ${otherEmployeeName}`}
                            >
                                <i className="fas fa-exchange-alt me-1"></i>Passer à {otherEmployeeName}
                            </Button>
                        )}
                    </div>
                )}

                <div className="rpt-body">
                    {isCoronerAttach && (
                        <div className="rpt-banner">
                            <strong>Pièce jointe d'un Email DMEC.</strong> Seuls les rapports de décès et de catastrophe mortelle (tuerie / accident de masse) sont
                            proposés. Le rapport est vérifié puis ajouté à l'e-mail avec le nom du défunt (IC et HRP) ; choisissez-en un seul à la fois.
                        </div>
                    )}
                    {isCertificateAttach && (
                        <div className="rpt-banner">
                            <strong>Pièce jointe d'un certificat médical.</strong> Seuls ces rapports sont proposés :{' '}
                            {ACCEPTED_REPORT_LABELS.join(' · ')}. Le rapport n'est jamais joint en entier : il est remplacé par un
                            <strong> résumé simplifié</strong> (type de prise en charge, établissement, date, et pour les urgences/consultations
                            générales l'hospitalisation et le suivi) — le diagnostic, les traitements et les détails médicaux ne sont pas transmis.
                        </div>
                    )}

                    {isCivilian && civilianProfile?.patientID && (
                        <section className="rpt-section">
                            <h6><i className="fas fa-file-invoice-dollar me-2"></i>Mes factures</h6>
                            <PatientInvoicesPanel patientID={civilianProfile.patientID} showNotification={showNotification} />
                        </section>
                    )}

                    {hasReports && (
                        <div className="rpt-toolbar">
                            <div className="rpt-toolbar-row">
                                <input
                                    type="search" className="rpt-search" placeholder="Rechercher par titre ou identifiant…"
                                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} disabled={isLoadingReports}
                                />
                                {typeOptions.length > 1 && (
                                    <select className="rpt-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Type de rapport">
                                        <option value="">Tous les types ({baseReports.length})</option>
                                        {typeOptions.map((option) => <option key={option.label} value={option.label}>{option.label} ({option.count})</option>)}
                                    </select>
                                )}
                            </div>
                            <FilterChips items={statusChips} value={statusFilter} onChange={setStatusFilter} label="Filtrer les rapports" />
                        </div>
                    )}

                    {isLoadingReports && selectedEmployee && (
                        <p className="rpt-muted">Chargement des rapports pour {selectedEmployee.label}…</p>
                    )}

                    {!isLoadingReports && selectedEmployee && (
                        searchedAndFilteredReports.length > 0 ? (
                            <div className="rpt-list">{currentReportsOnPage.map(renderReportCard)}</div>
                        ) : (
                            <p className="rpt-empty">
                                {sortedReports.length > 0 || searchQuery
                                    ? `Aucun rapport ne correspond à ces filtres pour ${selectedEmployee.label}.`
                                    : `Aucun rapport enregistré pour ${selectedEmployee.label}.`}
                            </p>
                        )
                    )}
                    {!isLoadingReports && !selectedEmployee && (
                        <p className="rpt-empty">
                            {!currentEmployee
                                ? 'Vous devez être connecté pour consulter les rapports enregistrés.'
                                : isAdmin
                                ? 'Veuillez sélectionner un employé pour voir ses rapports enregistrés.'
                                : 'Impossible de retrouver votre fiche employé associée à ce compte. Contactez un administrateur.'}
                        </p>
                    )}

                    {!isLoadingReports && selectedEmployee && (
                        <Pager page={currentPage} pages={totalPages} onPrev={goToPreviousPage} onNext={goToNextPage} />
                    )}
                </div>

                {!isLoadingReports && selectedEmployee && searchedAndFilteredReports.length > 0 && (
                    <BulkBar count={selectedReportKeys.length} onClear={() => setSelectedReportKeys([])}>
                        <Form.Check
                            type="checkbox" id="selectAllCheckbox" label="Toute la page" className="align-self-center mb-0 me-1"
                            checked={isAllCurrentPageSelected} onChange={(e) => handleSelectAllChange(e.target.checked)}
                            title="Sélectionner/Désélectionner tout sur cette page"
                        />
                        <Button variant="outline-danger" size="sm" onClick={handleDeleteSelected} disabled={selectedReportKeys.length === 0 || locked} title={locked ? lockTitle : undefined}>
                            <i className="fas fa-trash me-1"></i>Supprimer
                        </Button>
                        <Dropdown drop="up">
                            <Dropdown.Toggle variant="secondary" size="sm" disabled={selectedReportKeys.length === 0}>Copier / exporter</Dropdown.Toggle>
                            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                {bbcodeEnabled && (
                                    <Dropdown.Item onClick={handleCopySelectedBBCode} title={COPY_BBCODE_HINT}>
                                        Copier le BBCode sélectionné<ForumHint kind="bbcode" />
                                    </Dropdown.Item>
                                )}
                                <Dropdown.Item onClick={handleDownloadSelectedHtml} title={DOWNLOAD_HTML_HINT}>
                                    Télécharger le HTML sélectionné<ForumHint kind="html" />
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => handleExportSelectedDocument('pdf')}>Télécharger le PDF (A4) sélectionné</Dropdown.Item>
                                <Dropdown.Item onClick={() => handleExportSelectedDocument('png')}>Télécharger l'image (PNG) sélectionnée</Dropdown.Item>
                                <Dropdown.Item onClick={handleCopySelectedTitles}>Copier les titres sélectionnés</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                        {(loadReport || isAttachMode) && (
                            <Button
                                variant="success" size="sm"
                                disabled={selectedReportKeys.length === 0 || isLoadingMultiple || selectedReportKeys.length > 1}
                                title={selectedReportKeys.length > 1 ? 'Un seul rapport peut être sélectionné à la fois' : ''}
                                onClick={handleLoadSelected}
                            >
                                {isLoadingMultiple ? (
                                    <><i className="fas fa-spinner fa-spin me-1"></i>Chargement…</>
                                ) : (
                                    <><i className={`fas ${isAttachMode ? 'fa-paperclip' : 'fa-upload'} me-1`}></i>{isAttachMode ? 'Joindre le rapport sélectionné' : 'Charger le rapport sélectionné'}</>
                                )}
                            </Button>
                        )}
                    </BulkBar>
                )}
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default SavedReportsModal;
