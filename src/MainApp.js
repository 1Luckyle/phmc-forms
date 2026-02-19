// src/MainApp.js
import { useReportManagement } from './components/useReportManagement';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { formDefinitions, getFormDefinition } from './formDefinitions'; 
import '@fortawesome/fontawesome-free/css/all.min.css';
import { Button, Dropdown } from 'react-bootstrap';
import getRelevantFields from './components/RevelantFields';
import SeasonalEvents from './components/SeasonalEvents';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as Sentry from "@sentry/react";
import { useNotification } from './contexts/NotificationContext';
import SwitchableFormButtons from './components/SwitchableFormButtons';
import { handleFormCopyAndNotify, handlePhmcRecruitmentCopyAndNotify, sendBingoNotification, sendPhraseRequestNotification } from './components/notificationService';
import { useData } from './contexts/DataContext';
import LoadingSpinner from './components/LoadingSpinner';
import { useModal } from './contexts/ModalProvider';
import { useSettings } from './contexts/SettingsProvider';
import { useWebhooks } from './hooks/useWebhooks';
import { useImageUpload } from './hooks/useImageUpload';
import { useGitHubCommit } from './hooks/useGitHubCommit';
import { useLockdown } from './contexts/LockdownContext';
import LockdownBanner from './components/LockdownBanner';
import LockdownDialog from './components/LockdownDialog';
// logos
import email from './assets/email.png'
import Civilian from './assets/Civilian.png'
import nurse from './assets/nurse.png'
import PHMCLogo from './assets/phmc.png'
import corpse from './assets/corpse.png'
import tombstone from './assets/tombstone.png'
import phmcpaletobay from './assets/phmcpaletobaylogo.png'
import './assets/fonts/Poppins-Medium.ttf';
import { sendMissingEmployeeNotification } from './components/notificationService';

// css fun
import './App.css';
import './buttons.css';
import HeaderInfo from './components/HeaderInfo';
import 'react-bootstrap-typeahead/css/Typeahead.css';

// database
import { database } from './firebase'; // Your Firebase config
// Lazy-loaded components
const SavedReportsModal = lazy(() => import('./components/SavedReportsModal'));
const AgencyGroupSelectorModal = lazy(() => import('./components/AgencyGroupSelectorModal'));
const AgencySelector = lazy(() => import('./components/AgencySelector'));
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));
const Footer = lazy(() => import('./components/Footer'));
const CoronerTipsModal = lazy(() => import('./components/CoronerTipsModal'));
const BusinessCardModal = lazy(() => import('./components/BusinessCardModal'));
const EmsAmaModal = lazy(() => import('./components/EmsAmaModal'));
const EasterEggModal = lazy(() => import('./components/EasterEggModal'));
const SwitchableFormsModal = lazy(() => import('./components/SwitchableFormsModal'));
const EmployeeModal = lazy(() => import('./components/EmployeeModal'));
const RecruitmentStatusDisplay = lazy(() => import('./components/RecruitmentStatusDisplay'));
const CctvRequestWebhookModal = lazy(() => import('./components/Admin/CctvRequestWebhookModal'));
const FeatureRequestModal = lazy(() => import('./contexts/FeatureRequestModal'));
const FormImageLink = lazy(() => import('./components/FormImageLink'));
const PositionInfoModal = lazy(() => import('./components/PositionInfoModal'));
const EmsBingoModal = lazy(() => import('./components/EmsBingoModal'));
const ensureArray = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);

/** --------------------------------------------------------------------
 *  FIX OPTIONS: transforme ["A","B"] -> [{label:"A", value:"A"}, ...]
 *  et passe au travers des tableaux d’objets déjà corrects.
 * -------------------------------------------------------------------*/
const optionize = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    if (item && typeof item === 'object' && 'label' in item && 'value' in item) return item;
    if (typeof item === 'string' || typeof item === 'number') {
      const s = String(item);
      return { label: s, value: s };
    }
    // fallback minimal pour objets simples {name:"X"} etc.
    if (item && typeof item === 'object') {
      const label = item.label ?? item.name ?? item.title ?? '';
      const value = item.value ?? item.id ?? label;
      return { label: String(label), value: String(value) };
    }
    return { label: '', value: '' };
  });
};

function MainApp({
    formData,
    setFormData,
    lastWebhookIdentifier,
    setLastWebhookIdentifier,
    initialFormData,
    showNotification,
    removeNotification,
}) { 
    const navigate = useNavigate();

    const {
        showEmsBingoModal, setShowEmsBingoModal,
        showEasterEggModal, setShowEasterEggModal,
        easterEggType, setEasterEggType,
        showAgencySelector, setShowAgencySelector,
        hideAgencySelector, setHideAgencySelector,
        showEmployeeModal, setShowEmployeeModal,
        showEmsAmaModal, setShowEmsAmaModal,
        showBusinessCard, setShowBusinessCard,
        showCoronerTips, setShowCoronerTips,
        showAgencyGroupSelectorModal, setShowAgencyGroupSelectorModal,
        showCctvRequestModal, setShowCctvRequestModal,
        showPHMCModal, setShowPHMCModal,
        switchableModalTitle, setSwitchableModalTitle,
        switchableFormsList, setSwitchableFormsList,
        showFeatureRequestModal, setShowFeatureRequestModal,

    } = useModal();


    // Onboarding detection and initialization
    useEffect(() => {
        const onboardingCompleteFlag = localStorage.getItem('onboardingComplete');
        const userPreferences = localStorage.getItem('userOnboardingPreferences');
        
        if (userPreferences) {
            try {
                const preferences = JSON.parse(userPreferences);
                setUserOnboardingPreferences(preferences);
                setOnboardingComplete(true);
            } catch (error) {
                console.warn('Failed to parse user onboarding preferences:', error);
                localStorage.removeItem('userOnboardingPreferences');
            }
        }
        
        // Show onboarding for first-time users
        if (!onboardingCompleteFlag && !userPreferences) {
            setShowOnboarding(true);
        } else {
            setOnboardingComplete(true);
        }
    }, []);

    const handleOnboardingComplete = (preferences) => {
        setUserOnboardingPreferences(preferences);
        setOnboardingComplete(true);
        setShowOnboarding(false);
        
        // Apply user preferences immediately
        if (preferences.allowedCategories?.length === 1) {
            setSelectedAgencyGroup(preferences.allowedCategories[0]);
            localStorage.setItem('selectedAgencyGroup', preferences.allowedCategories[0]);
        }
        
        // Set the default form based on user preferences
        if (preferences.defaultForm) {
            setBbCodeVersion(preferences.defaultForm);
            localStorage.setItem('selectedForm', preferences.defaultForm.toString());
        }
        
        showNotification(`Bienvenue ! Votre interface a été personnalisée pour ${preferences.userType} utilisateur.`, 'check-circle');
    };

    const handleOnboardingSkip = () => {
        setShowOnboarding(false);
        setOnboardingComplete(true);
        showNotification('L\'introduction a été ignorée. Vous pouvez la relancer à tout moment depuis le menu Outils.', 'info-circle');
    };

    const restartOnboarding = () => {
        localStorage.removeItem('onboardingComplete');
        localStorage.removeItem('onboardingSkipped');
        localStorage.removeItem('userOnboardingPreferences');
        setUserOnboardingPreferences(null);
        setOnboardingComplete(false);
        setShowOnboarding(true);
    };
    const [isMobile, setIsMobile] = useState(false);
    const [showMovedNotification, setShowMovedNotification] = useState(true);
    const [showToolsDropdown, setShowToolsDropdown] = useState(false);
    const modalCloseTimer = useRef(null);
    
    const [fillPhoneChecked, setFillPhoneChecked] = useState(false);
    const [showBBCode, setShowBBCode] = useState(false);
    const [bbCodeVersion, setBbCodeVersion] = useState(() => {
        const storedVersion = localStorage.getItem('bbCodeVersion');
        return storedVersion ? parseInt(storedVersion, 10) : (formDefinitions[0]?.version || 1);
    });
    const [selectedAgencyGroup, setSelectedAgencyGroup] = useState(null);
    const [hideAgencyGroupSelectorPreference, setHideAgencyGroupSelectorPreference] = useState(false);
    
    // Get data from DataContext
    const { 
        phmcListData,
        coronerListData,
        agencyDataStore,
        selectOptions,
        physicianRecruitmentDetails,
        psychRecruitmentDetails,
        adminRecruitmentDetails,
        emsRecruitmentDetails,
        nurseRecruitmentDetails,
        coronerRecruitmentDetails,
        isLoadingData,
        loading
    } = useData();
    const [isJohnDoe, setIsJohnDoe] = useState(false);
    const [isJaneDoe, setIsJaneDoe] = useState(false);
    const commitInfo = useGitHubCommit();
    
    // Onboarding state management
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [userOnboardingPreferences, setUserOnboardingPreferences] = useState(null);
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [isLoadingUserReports, setIsLoadingUserReports] = useState(false);
    
    const [featureRequest, setFeatureRequest] = useState('');
    const [discordName, setDiscordName] = useState('');
    const ER_PROTOCOL_VERSION = 19;
    const CONSULTATION_NOTES_PHMC_VERSION = 20;
    const CONSULTATION_NOTES_PBC_VERSION = 21;

    const [isRemoveStaff, setIsRemoveStaff] = useState(false);
    const [missingEmployeeData, setMissingEmployeeData] = useState({
        coronerName: '',
        coronerDiscord: '',
        employeeLastName: '',
        coronerRank: '',
        coronerPHNumber: '',
        coronerEmployee: '',
        coronerBadge: '',
        phmcEmployee: '',
        staffToRemove: [],
        authorizedBy: '',
    });
    const [staffToRemove, setStaffToRemove] = useState([]);
    const [webhookMessage, setWebhookMessage] = useState('');
    const [webhookTitle, setWebhookTitle] = useState('');
    const [isBbcodeRequest, setIsBbcodeRequest] = useState(false);
    const [bbcodeTitleRequest, setBbcodeTitleRequest] = useState('');
    const [bbcodeRequestText, setBbcodeRequestText] = useState('');
    const [currentUtcTime, setCurrentUtcTime] = useState('');
    const [phmcRecruitmentOptIn, setPhmcRecruitmentOptIn] = useState(() => {
        return localStorage.getItem('phmcRecruitmentOptIn') === 'true';
    });

    const { seasonalEffectsEnabled, toggleSeasonalEffects } = useSettings();
    const { lockdownConfig, showDialog, hideDialog, isLockdownActive } = useLockdown();
    const parseBBCode = (bbCode) => {
        const deathReportDefinition = getFormDefinition(1); // Assuming '1' is the ID for Death Report
        if (deathReportDefinition && deathReportDefinition.parser) {
            return deathReportDefinition.parser(bbCode);
        }
        return null; // Return null if no parser is found
    };

    // Get webhooks functions
    const { 
        sendEasterEggNotification,
        handleCctvWebhookSubmit,
    } = useWebhooks(formData, commitInfo, showNotification);
    // Get image upload functions
    const { isUploading, handleImageUpload } = useImageUpload(showNotification, setFormData);
    // All references to bbCodeVersion now occur after its initialization
    const handleSelectAgencyGroup = (group) => {
        setSelectedAgencyGroup(group);
        localStorage.setItem('selectedAgencyGroup', group);
        setShowAgencyGroupSelectorModal(false);
        setShowAgencySelector(true);
    };

    const handleAgencySelect = useCallback((version) => {
        setBbCodeVersion(version);
        setShowAgencySelector(false);
        setShowPHMCModal(false);
    }, [setBbCodeVersion, setShowAgencySelector, setShowPHMCModal]);

    const handleHideAgencyGroupSelectorPreference = (hide) => {
        setHideAgencyGroupSelectorPreference(hide);
        localStorage.setItem('hideAgencyGroupSelectorPreference', hide);
    };

    const handleRecruitmentOptIn = (optIn) => {
        setPhmcRecruitmentOptIn(optIn);
        localStorage.setItem('phmcRecruitmentOptIn', optIn);
        showNotification(`Notification de Recrutement du PHMC ${optIn ? 'activé' : 'désactivé'}.`, 'info');
    };

    const handleMainFormSelectionButtonClick = () => {
        setShowAgencySelector(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        
        setFormData(prev => {
            const newFormData = {
                ...prev,
                [name]: newValue
            };
            localStorage.setItem('formData', JSON.stringify(newFormData));
            return newFormData;
        });
    };

    const handleSelectChange = (selectedOption, action) => {
        const name = typeof action === 'string' ? action : action.name;

        setFormData(prev => {
            let newFormData;
            if (name === 'coronerEmployee' && selectedOption) {
                newFormData = {
                    ...prev,
                    coronerEmployee: selectedOption.value,
                    coronerBadge: selectedOption.badge,
                    coronerRank: selectedOption.rank,
                    coronerDiscord: selectedOption.discord,
                };
            } else if (name === 'coronerEmployee' && !selectedOption) {
                newFormData = {
                    ...prev,
                    coronerEmployee: '',
                    coronerBadge: '',
                    coronerRank: '',
                    coronerDiscord: '',
                };
            } else if (name === 'chiefCoronerEmployee' && selectedOption) {
                newFormData = {
                    ...prev,
                    chiefCoronerEmployee: selectedOption.value,
                    chiefCoronerBadge: selectedOption.badge,
                    chiefCoronerRank: selectedOption.rank,
                    chiefCoronerDiscord: selectedOption.discord,
                };
            } else if (name === 'chiefCoronerEmployee' && !selectedOption) {
                newFormData = {
                    ...prev,
                    chiefCoronerEmployee: '',
                    chiefCoronerBadge: '',
                    chiefCoronerRank: '',
                    chiefCoronerDiscord: '',
                };
            } else if (name === 'phmcEmployee' && selectedOption) {
                newFormData = {
                    ...prev,
                    phmcEmployee: selectedOption.value,
                    // Ne pas écraser phmcRank ici, il est géré séparément dans Surgical
                    // phmcRank: selectedOption.rank,
                    phmcEmployeeLastName: selectedOption.lastName,
                };
            } else if (name === 'phmcEmployee' && !selectedOption) {
                newFormData = {
                    ...prev,
                    phmcEmployee: '',
                    // Ne pas écraser phmcRank lors du clear
                    phmcEmployeeLastName: '',
                };
            } else {
                newFormData = {
                    ...prev,
                    [name]: selectedOption ? selectedOption.value : ''
                };
            }
            localStorage.setItem('formData', JSON.stringify(newFormData));
            return newFormData;
        });
    };

    const handleFillCoronerPhone = () => {
        showNotification("Numéro de téléphone du coroner rempli (espace réservé)", 'info');
    };

    const addReport = () => {
        setFormData(prev => ({
            ...prev,
            additionalReports: [...(prev.additionalReports || []), '']
        }));
    };

    const removeReport = (index) => {
        setFormData(prev => ({
            ...prev,
            additionalReports: (prev.additionalReports || []).filter((_, i) => i !== index)
        }));
    };
    const handleReportChange = (index, value) => {
        setFormData(prev => {
            const newReports = [...(prev.additionalReports || [])];
            newReports[index] = value;
            return {
                ...prev,
                additionalReports: newReports
            };
        });
    };

    const handleCopyTitle = () => {
        const title = generateTitle();
        navigator.clipboard.writeText(title);
        showNotification('Titre copié dans le presse-papiers !', 'check-circle');
    };

    const generateTitle = () => {
        const definition = getFormDefinition(bbCodeVersion);
        if (definition && definition.titleGenerator) {
            return definition.titleGenerator(formData);
        }
        return "Rapport Sans Titre";
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowMovedNotification(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    const getBBCodeContent = () => {
        const definition = getFormDefinition(bbCodeVersion);

        if (definition && definition.generator) {
            if (bbCodeVersion === 999) { // Admin Control Panel version
                return definition.generator({
                    isAdminAuthenticated: formData.isAdminAuthenticated,
                    adminUserEmail: formData.adminUserEmail,
                    adminDisplayData: formData.adminDisplayData,
                    adminSelectedCategoryName: formData.adminSelectedCategoryName,
                });
            } else {
                let specificPositionData = {};

                if (definition.group === "PHMC Recruitment") {
                    if (definition.titleKey === "phmcCarrieresMedicales") {
                        specificPositionData = selectOptions.physicianRecruitmentDetails || {};
                    } else if (definition.titleKey === "phmcCarrieresPsychologue") {
                        specificPositionData = selectOptions.psychPositionDetailsData || {};
                    } else if (definition.titleKey === "phmcCarrieresAdministration") {
                        specificPositionData = selectOptions.adminPositionDetailsData || {};
                    } else if (definition.titleKey === "phmcCarrieresInfirmieres") {
                        specificPositionData = selectOptions.nursePositionDetailsData || {};
                    } else if (definition.titleKey === "phmcCarrieresDMEC") {
                        specificPositionData = selectOptions.coronerPositionDetailsData || {};
                    } else if (definition.titleKey === "phmcCarrieresEMS") {
                        specificPositionData = selectOptions.emsPositionDetailsData || {};
                    }
                }

                const generatorArgs = {
                    ...formData,
                    positionDetailsData: specificPositionData || {},
                    agencyDataStore: agencyDataStore,
                };
                return definition.generator(generatorArgs);
            }
        } else {
            Sentry.captureMessage(`No BBCode generator found for version: ${bbCodeVersion}`);
            const formName = (getFormDefinition(bbCodeVersion) || {}).name || `Form v${bbCodeVersion}`;
            return `BBCode generation for form "${formName}" is not implemented.`;
        }
    };

    const initialLoadFormData = () => {
        const storedData = localStorage.getItem('formData');
        return storedData ? JSON.parse(storedData) : initialFormData;
    };

    useEffect(() => {
        const fieldsToSaveToLS = [
            'phmcEmployee', 'phmcEmployeeLastName', 'phmcRank',
            'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber',
            'pronouncedTimeOfDeath', 'department', 'dateTime', 'placeOfDeath', 'mannerOfDeath',
        ];

        fieldsToSaveToLS.forEach(field => {
            if (formData[field]) {
                localStorage.setItem(field, formData[field]);
            } else {
                localStorage.removeItem(field);
            }
        });

        const { evidenceLockerID, ...formDataToPersist } = formData;
        localStorage.setItem('formData', JSON.stringify(formDataToPersist));
    }, [formData]);

    const getCopyButtonText = () => {
        if (selectedAgencyGroup === 'PHMC Recruitment') {
            return 'Copier BBCode de Recrutement';
        }
        return 'Copier BBCode';
    };
    
    const getCurrentReportAuthor = useCallback((formData) => {
        const coronerFormVersions = [1, 2, 4, 8, 11, 18, 37];
        const phmcFormVersions = [
            5, 6, 7, 9, 10, 12, 13, 14, 16, 19, 20, 21, 22, 23, 27, 28, 29, 35
        ];

        if (coronerFormVersions.includes(bbCodeVersion)) {
            return formData.coronerEmployee || null;
        } else if (phmcFormVersions.includes(bbCodeVersion)) {
            return formData.phmcEmployee || null;
        }

        if (formData.coronerEmployee) return formData.coronerEmployee;
        if (formData.phmcEmployee) return formData.phmcEmployee;

        if (bbCodeVersion === 25 || bbCodeVersion === 3 || bbCodeVersion === 24) {
            if (formData.patientName) return formData.patientName;
            if (formData.patientFirstName && formData.patientLastName) return `${formData.patientFirstName} ${formData.patientLastName}`;
            if (formData.patientFirstName) return formData.patientFirstName;
            if (formData.patientLastName) return formData.patientLastName;
        }
        
        return null;
    }, [bbCodeVersion]);

    const filterFormData = (formData, bbCodeVersion) => {
        const relevantFields = getRelevantFields(bbCodeVersion);
        const filteredData = {};

        relevantFields.forEach(field => {
            if (formData.hasOwnProperty(field)) {
                filteredData[field] = formData[field];
            }
        });

        return filteredData;
    };
    const versionNames = {
        1: "Death Report",
        2: "Coroner Email",
        3: "Patient File - Advanced",
        4: "Autopsy Report",
        5: "Surgery Report",
        6: "Physical Evaluation (PHMC)",
        7: "Physical Evaluation (PBC)",
        8: "Death Certificate",
        9: "Obs Main File",
        10: "Obs Follow Up",
        11: "Mass Fatality Report",
        12: "Gynecology - Main File",
        13: "Gynecology - Add Reply",
        14: "Mental Health - PHMC",
        16: "Mental Health - PBC",
        18: "Agency Feedback",
        19: "Emergency Room Protocols",
        20: "Consultation Notes (PHMC)",
        21: "Consultation Notes (PBC)",
        22: "Commentary Note (PHMC)",
        23: "Commentary Note (PBC)",
        24: "Medical Release Records",
        25: "Patient File - Basic",
        26: "Medical Record Update",
        27: "Email Forms",
        28: "Psychological Evaluation PHMC",
        29: "Psychological Evaluation PBC",
        35: "PHMC - Email Generator",
        50: "PHMC - Physician Careers",
        51: "PHMC - Psych Careers",
        52: "PHMC - Admin Careers",
        53: "PHMC - Nursing Careers",
        54: "PHMC - Coroner Careers",
        55: "PHMC - EMS Careers"
    };

    const { 
        saveReport,
        savedReports,
        setSavedReports,
        showSavedReports,
        setShowSavedReports,
        
        loadUserSavedReports,
        loadReportForUser,
        handleReportSelectedForAttachment,
        onAttachReportSummaryRequest,
        deleteReportForUser,
        showRareEasterEggDirectly,
        toggleSavedReports,
        showPositionInfoModal,
        setShowPositionInfoModal,
        currentPositionInfo,
        setCurrentPositionInfo,
        handleShowPositionInfo,
        pendingReportAttachmentCallback,
        reportSelectionFilter,
        setReportSelectionFilter
    } = useReportManagement(
        formData,
        setFormData,
        bbCodeVersion,
        setBbCodeVersion,
        getBBCodeContent,
        getCurrentReportAuthor,
        filterFormData,
        coronerListData,
        phmcListData,
        selectOptions,
        showNotification,
        removeNotification,
        setShowEasterEggModal,
        setEasterEggType,
        sendEasterEggNotification,
        modalCloseTimer,
        versionNames,
        ER_PROTOCOL_VERSION,
        CONSULTATION_NOTES_PHMC_VERSION,
        CONSULTATION_NOTES_PBC_VERSION,
        physicianRecruitmentDetails,
        psychRecruitmentDetails,
        adminRecruitmentDetails,
        emsRecruitmentDetails,
        nurseRecruitmentDetails,
        coronerRecruitmentDetails,
        selectedAgencyGroup
    );

    const clearForm = () => {
        setFormData(prevFormData => ({
            ...initialFormData,
            coronerEmployee: prevFormData.coronerEmployee,
            phmcEmployee: prevFormData.phmcEmployee,
            coronerBadge: prevFormData.coronerBadge,
            coronerRank: prevFormData.coronerRank,
            coronerDiscord: prevFormData.coronerDiscord,
            SubmitDate: new Date().toISOString().split('T')[0],
        }));
        const fieldsToRemove = [
            'dateTime', 'department', 'pronouncedTimeOfDeath', 'placeOfDeath', 'mannerOfDeath'
        ];
        fieldsToRemove.forEach(field => {
            localStorage.removeItem(field);
            localStorage.removeItem(`${field}_timestamp`);
        });
        setLastWebhookIdentifier(null);
        showNotification('Formulaire vidé ! Sélections des employés conservées.', 'check-circle');
    };

    const handleShowCctvRequestModal = () => {
        setShowAgencyGroupSelectorModal(false);
        setShowCctvRequestModal(true);
    };
    
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
    }, []);

    const { imageSource: deathReportImage, className: deathReportClass, season, effect } = seasonalEffectsEnabled ? SeasonalEvents({ imageType: 'deathReport' }) : {};
    const { imageSource: civilianPaperworkImage, className: civilianPaperworkClass } = seasonalEffectsEnabled ? SeasonalEvents({ imageType: 'civilianPaperwork'  }) : {};

    const handleCopyAndNotifyWrapper = useCallback(() => {
        if (selectedAgencyGroup === 'PHMC Recruitment') {
            handlePhmcRecruitmentCopyAndNotify({
                formData,
                getBBCodeContent,
                showNotification,
                commitInfo,
                selectOptions,
                formDefinition: getFormDefinition(bbCodeVersion),
            });
        } else {
            handleFormCopyAndNotify({
                formData,
                bbCodeVersion,
                selectedAgencyGroup,
                getBBCodeContent,
                getFormDefinition,
                saveReport,
                showNotification,
                removeNotification,
                handleAgencySelect,
                setLastWebhookIdentifier,
                lastWebhookIdentifier,
                commitInfo,
                database,
                getCurrentReportAuthor,
            });
        }
    }, [
        selectedAgencyGroup, 
        formData, 
        getBBCodeContent, 
        showNotification, 
        commitInfo, 
        selectOptions, 
        bbCodeVersion, 
        saveReport, 
        removeNotification, 
        handleAgencySelect, 
        setLastWebhookIdentifier, 
        lastWebhookIdentifier, 
        database,
        getCurrentReportAuthor
    ]);

    const currentFormDefinition = useMemo(() => getFormDefinition(bbCodeVersion), [bbCodeVersion]);
    const FieldComponent = currentFormDefinition ? currentFormDefinition.FieldComponent : null;
    if (selectedAgencyGroup && !FieldComponent && !isLoadingData) {
        const warningMessage = `No FieldComponent found for bbCodeVersion: ${bbCodeVersion} in group: ${selectedAgencyGroup}.`;
        console.warn(`[App.js] ${warningMessage}`, currentFormDefinition);
        Sentry.captureMessage(warningMessage, {
            level: 'warning',
            extra: {
                bbCodeVersion: bbCodeVersion,
                selectedAgencyGroup: selectedAgencyGroup,
                currentFormDefinition: currentFormDefinition || 'Not found',
                isLoadingData: isLoadingData
            }
        });
    }
    const coronerFormsSubGroup = [
        { version: 1, name: "Services de Médecine Légale", icon: corpse },
        { version: 2, name: "Email DMEC", icon: email },
        { version: 4, name: "Rapport d'Autopsie", icon: corpse },
        { version: 8, name: "Certificat de Décès", icon: PHMCLogo },
        { version: 11, name: "Rapport de Tuerie/Accident de Masse", icon: corpse },
        { version: 37, name: "Rapport Public de Décès", icon: tombstone }
    ];
    const physicalEvalFormsSubGroup = [
        { version: 6, name: "Évaluation Physique | PHMC", icon: PHMCLogo },
        { version: 7, name: "Évaluation Physique | PBC", icon: phmcpaletobay }
    ];
    const psychEvalFormsSubGroup = [
        { version: 28, name: "Évaluation Psychologique | PHMC", icon: PHMCLogo },
        { version: 29, name: "Évaluation Psychologique | PBC", icon: phmcpaletobay }
    ];
    const generalConsultFormsSubGroup = [
        { version: 20, name: "Consultation Générale | PHMC", icon: PHMCLogo },
        { version: 21, name: "Consultation Générale | PBC", icon: phmcpaletobay }
    ];
    const commentaryNoteFormsSubGroup = [
        { version: 22, name: "Note de Service | PHMC", icon: PHMCLogo },
        { version: 23, name: "Note de Service | PBC", icon: phmcpaletobay }
    ];
    const mentalHealthFormsSubGroup = [
        { version: 14, name: "Consultation psychiatrique | PHMC", icon: PHMCLogo },
        { version: 16, name: "Consultation psychiatrique | PBC", icon: phmcpaletobay }
    ];
    const civilianFormsSubGroup = [
        { version: 24, name: "Formulaire de Libération Médicale", icon: Civilian },
        { version: 25, name: "Dossier Médical Basique", icon: nurse },
        { version: 3, name: "Dossier Médical Avancé", icon: nurse },
        { version: 26, name: "Mise à Jour du Dossier Médical", icon: Civilian},
    ];
    const phmcInternalEmails = [
        { version: 24, name: "Note Interne", icon: Civilian },
        { version: 35, name: "Certificat de Maladie", icon: nurse },
    ];

    const openSwitchableModal = (title, formsArray) => {
        setSwitchableModalTitle(title);
        setSwitchableFormsList(formsArray);
        setShowPHMCModal(true);
    };

    // --- Updated useEffect for CoronerTipsModal ---
    useEffect(() => {
        const isCoronerForm = [1, 2, 18].includes(bbCodeVersion);
        const shouldHidePermanently = localStorage.getItem('hideCoronerTipsModal') === 'true';
        if (isCoronerForm && !shouldHidePermanently) {
            setShowCoronerTips(true);
        } else {
            setShowCoronerTips(false);
        }
    }, [bbCodeVersion]);
    useEffect(() => {
        localStorage.setItem('bbCodeVersion', bbCodeVersion.toString());
    }, [bbCodeVersion]);

    useEffect(() => {
        if (selectedAgencyGroup) {
            localStorage.setItem('bbCodeVersion', bbCodeVersion.toString());
        }
    }, [bbCodeVersion, selectedAgencyGroup]);

    const phmcRecruitmentFormsSubGroup = formDefinitions.filter(
        form => form.group === "PHMC Recruitment"
    );

    const handleMissingEmployeeSubmit = async (actionType, employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updatedStaff) => {
        await sendMissingEmployeeNotification(
            actionType,
            employeeType,
            selectedEmployeeName,
            newRank,
            coronerListData, 
            phmcListData, 
            staffToRemove,
            authorizedBy,
            missingEmployeeData,
            commitInfo,
            showNotification, 
            formData.coronerEmployee, 
            formData.phmcEmployee
        );

        if (actionType === 'updateRank') {
            showNotification("Mise à jour des données du personnel...", 'info-circle', 2000);
        }

        if (actionType === 'updateRank') {
            showNotification("Mise à jour des données du personnel...", 'check-circle', 3000);
        }
    };

    useEffect(() => {
        const redirectPath = sessionStorage.getItem('redirectPath');
        if (redirectPath) {
            sessionStorage.removeItem('redirectPath');
            window.history.replaceState(null, '', redirectPath);
        }

        const currentPath = window.location.pathname;
        const hash = window.location.hash;

        if (hash === '#bingo' || currentPath.endsWith('/bingo')) {
            setShowEmsBingoModal(true);
        } else if (currentPath.endsWith('/cctv')) {
            handleShowCctvRequestModal();
        }
    }, []);
    const handleHideEmsBingoModal = useCallback(() => {
        setShowEmsBingoModal(false);
        const url = new URL(window.location.href);
        if (url.hash === '#bingo') {
            url.hash = '';
        }
        if (url.pathname.endsWith('/bingo')) {
            url.pathname = url.pathname.replace(/bingo$/, '') || '/';
        }
        window.history.replaceState({}, document.title, url.href);
    }, []);

    const handleHideCctvRequestModal = useCallback(() => {
        setShowCctvRequestModal(false);
        const url = new URL(window.location.href);
        if (url.pathname.endsWith('/cctv')) {
            url.pathname = url.pathname.replace(/cctv$/, '') || '/';
            window.history.replaceState({}, document.title, url.href);
        }
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectedPath = urlParams.get('p');
        const currentPath = window.location.pathname;
        const hash = window.location.hash;

        if (hash === '#bingo' || currentPath.endsWith('/bingo') || (redirectedPath && redirectedPath.endsWith('/bingo'))) {
            setShowEmsBingoModal(true);
        } else if (currentPath.endsWith('/cctv') || (redirectedPath && redirectedPath.endsWith('/cctv'))) {
            handleShowCctvRequestModal();
        }

        if (redirectedPath) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('p');
            window.history.replaceState({}, document.title, newUrl.href);
        }
    }, []);

    // --- Grouped staff options stay comme avant (déjà des objets) ---
    const phmcGroupedOptions = useMemo(() => {
        const list = ensureArray(phmcListData);
        if (list.length === 0) return [];
        return Object.entries(
            list.reduce((groups, employee) => {
                const categoryName = employee.category || 'Uncategorized';
                if (!groups[categoryName]) {
                    groups[categoryName] = [];
                }
                groups[categoryName].push({
                    value: employee.name,
                    label: employee.name,
                    category: employee.category,
                    lastName: employee.lastName
                });
                return groups;
            }, {})
        ).map(([category, options]) => ({
            label: category,
            options: options.sort((a, b) => a.label.localeCompare(b.label))
        })).sort((a, b) => {
            const order = ['Leadership', 'Hospital Supervisor', 'Chief Resident', 'Physician', 'Resident Physician', 'Physician Assistant', 'Psychiatrist', 'Psychologist', 'Dentist', 'Nursing', 'Emergency Medical Services', 'Attending Physician', 'Uncategorized'];
            return order.indexOf(a.label) - order.indexOf(b.label);
        });
    }, [phmcListData]);

    const coronerGroupedOptions = useMemo(() => {
        const list = ensureArray(coronerListData);
        if (list.length === 0) return [];
        return Object.entries(
            list.reduce((groups, coroner) => {
                const categoryName = coroner.category || 'Uncategorized';
                if (!groups[categoryName]) {
                    groups[categoryName] = [];
                }
                groups[categoryName].push({
                    value: coroner.name,
                    label: `${coroner.name} (${coroner.rank || 'Coroner'})`,
                    badge: coroner.badge,
                    rank: coroner.rank,
                    discord: coroner.discord,
                    category: categoryName
                });
                return groups;
            }, {})
        ).map(([category, options]) => ({
            label: category,
            options: options.sort((a, b) => a.label.localeCompare(b.label))
        })).sort((a, b) => {
            const order = ['Chief Boss', 'Deputy Chief Medical Examiner-Coroner,', 'Supervisor', 'Senior Medical Examiner', 'Medical Examiner', 'Senior Coroner Investigator', 'Coroner Investigator', 'Forensic Attendant', 'Trainee Forensic-Attendant', 'Developer Testing', 'Missing_Category', 'Uncategorized'];
            return order.indexOf(a.label) - order.indexOf(b.label);
        });
    }, [coronerListData]);

    const handleDoeChange = (type) => (e) => {
        const isChecked = e.target.checked;

        if (isChecked) {
            setFormData(prev => ({ ...prev, massFatality: false }));
        }

        if (isChecked) {
            setIsRemoveStaff(false);
            setMissingEmployeeData(prev => ({
                ...prev,
                staffToRemove: [],
                employeeLastName: '',
                authorizedBy: '',
            }));
        }

        if (type === 'john') {
            setIsJohnDoe(isChecked);
            if (isChecked) {
                setIsJaneDoe(false); 
                setFormData(prev => ({ ...prev, decedentName: 'John Doe' }));
            } else {
                if (formData.decedentName === 'John Doe') {
                    setFormData(prev => ({ ...prev, decedentName: '' }));
                }
            }
        } else if (type === 'jane') {
            setIsJaneDoe(isChecked);
            if (isChecked) {
                setIsJohnDoe(false);
                setFormData(prev => ({ ...prev, decedentName: 'Jane Doe' }));
            } else {
                if (formData.decedentName === 'Jane Doe') {
                    setFormData(prev => ({ ...prev, decedentName: '' }));
                }
            }
        }
    };

    useEffect(() => {
        const updateUtcTime = () => {
            const now = new Date();

            const pad = (num) => num.toString().padStart(2, '0');

            const day = pad(now.getUTCDate());
            const monthName = now.toLocaleString('en-US', { timeZone: 'UTC', month: 'long' });
            const year = now.getUTCFullYear();

            const hours = pad(now.getUTCHours());
            const minutes = pad(now.getUTCMinutes());
            const seconds = pad(now.getUTCSeconds());

            const utcString = `${day}/${monthName}/${year} ${hours}:${minutes}:${seconds} UTC`;

            setCurrentUtcTime(utcString);
        };

        updateUtcTime();
        const intervalId = setInterval(updateUtcTime, 1000);

        return () => clearInterval(intervalId);
    }, []); 
    
    const combinedStaffOptions = [
        {
            label: 'Coroners',
            options: ensureArray(coronerListData).map(c => ({ value: c.name, label: `${c.name} (${c.rank || 'Coroner'})` }))
        },
        {
            label: 'PHMC Staff',
            options: ensureArray(phmcListData).map(p => ({ value: p.name, label: `${p.name} (${p.category || 'PHMC'})` }))
        }
    ].filter(group => group.options.length > 0);

    useEffect(() => {
        if (!onboardingComplete) return;
        
        const savedGroup = localStorage.getItem('selectedAgencyGroup');
        const hidePreference = localStorage.getItem('hideAgencyGroupSelectorPreference') === 'true';
        setHideAgencyGroupSelectorPreference(hidePreference);

        if (userOnboardingPreferences?.allowedCategories?.length === 1) {
            const preferredGroup = userOnboardingPreferences.allowedCategories[0];
            setSelectedAgencyGroup(preferredGroup);
            setShowAgencyGroupSelectorModal(false);
            return;
        }

        if (savedGroup && hidePreference) {
            setSelectedAgencyGroup(savedGroup);
            setShowAgencyGroupSelectorModal(false);
        } else if (onboardingComplete) {
            setShowAgencyGroupSelectorModal(true);
        }
    }, [onboardingComplete, userOnboardingPreferences]);
    
    useEffect(() => {
        localStorage.setItem('bbCodeVersion', bbCodeVersion.toString());
        const definition = getFormDefinition(bbCodeVersion);
        if (definition) {
            if (selectedAgencyGroup !== definition.group) {
                setSelectedAgencyGroup(definition.group);
            }
            localStorage.setItem('selectedAgencyGroup', definition.group);
        } else {
            if (selectedAgencyGroup !== null) {
                setSelectedAgencyGroup(null);
            }
            localStorage.removeItem('selectedAgencyGroup');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bbCodeVersion]);

    return ( 
        <Suspense fallback={<LoadingSpinner />}>
            <div className="App">
                <LockdownBanner notification={lockdownConfig.notification} show={isLockdownActive} />
                <LockdownDialog show={showDialog} onHide={hideDialog} message={lockdownConfig.dialog} />
                <OnboardingModal 
                    show={showOnboarding} 
                    onComplete={handleOnboardingComplete}
                    onSkip={handleOnboardingSkip}
                    formDefinitions={formDefinitions}
                    showNotification={showNotification}
                    phmcList={phmcListData}
                    coronerList={coronerListData}
                />
                <AgencyGroupSelectorModal
                    show={showAgencyGroupSelectorModal && !selectedAgencyGroup && onboardingComplete}
                    onSelectGroup={handleSelectAgencyGroup}
                    onHideSelectorPreference={handleHideAgencyGroupSelectorPreference}
                    physicianRecruitmentDetails={selectOptions.physicianRecruitmentDetails || {}}
                    psychRecruitmentDetails={selectOptions.psychPositionDetailsData || {}}
                    adminRecruitmentDetails={selectOptions.adminPositionDetailsData || {}}
                    emsRecruitmentDetails={selectOptions.emsPositionDetailsData || {}}
                    handleFormSelect={handleAgencySelect}
                    nurseRecruitmentDetails={selectOptions.nursePositionDetailsData || {}}
                    coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData || {}}
                    onShowCctvRequest={handleShowCctvRequestModal}
                />

                <SwitchableFormsModal
                    show={showPHMCModal}
                    onHide={() => setShowPHMCModal(false)}
                    title={switchableModalTitle}
                    forms={switchableFormsList}
                    handleFormSelect={(version) => {
                        setBbCodeVersion(version);
                        setShowPHMCModal(false);
                    }}
                    isMobile={isMobile}
                    physicianRecruitmentDetails={selectOptions.physicianRecruitmentDetails}
                    psychRecruitmentStatus={selectOptions.psychPositionDetailsData}
                    adminRecruitmentDetails={selectOptions.adminPositionDetailsData}
                    emsRecruitmentDetails={selectOptions.emsPositionDetailsData}
                    nurseRecruitmentDetails={selectOptions.nursePositionDetailsData}
                    coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData}
                    formDefinitions={formDefinitions}
                    userPreferences={userOnboardingPreferences}
                />

                <CctvRequestWebhookModal
                    show={showCctvRequestModal}
                    onHide={handleHideCctvRequestModal}
                    onSubmit={handleCctvWebhookSubmit}
                    showNotification={showNotification}
                />

                <EasterEggModal
                    show={showEasterEggModal}
                    type={easterEggType}
                    onHide={() => {
                        setShowEasterEggModal(false);
                        setEasterEggType(null);
                    }}
                />
                {seasonalEffectsEnabled && effect}

                <CoronerTipsModal
                    show={showCoronerTips}
                    onClose={() => {
                        setShowCoronerTips(false);
                    }}
                />

                <EmsAmaModal
                    show={showEmsAmaModal}
                    onHide={() => setShowEmsAmaModal(false)}
                    showNotification={showNotification}
                    commitInfo={commitInfo}
                    handleImageUpload={handleImageUpload}
                />

                <PositionInfoModal
                    show={showPositionInfoModal}
                    onClose={() => setShowPositionInfoModal(false)}
                    positionData={currentPositionInfo}
                />

                {showAgencySelector && (
                    <AgencySelector
                        showAgencySelector={showAgencySelector}
                        setShowAgencySelector={setShowAgencySelector}
                        handleAgencySelect={handleAgencySelect}
                        isMobile={isMobile}
                        hideAgencySelector={hideAgencySelector}
                        setHideAgencySelector={setHideAgencySelector}
                        selectedAgencyGroup={selectedAgencyGroup}
                        formDefinitions={formDefinitions}
                        physicianRecruitmentDetails={physicianRecruitmentDetails}
                        psychRecruitmentDetails={psychRecruitmentDetails}
                        adminRecruitmentDetails={adminRecruitmentDetails}
                        emsRecruitmentDetails={emsRecruitmentDetails}
                        nurseRecruitmentDetails={nurseRecruitmentDetails}
                        coronerRecruitmentDetails={coronerRecruitmentDetails}
                        userPreferences={userOnboardingPreferences}
                    />
                )}

                <div className="header-info-wrapper">
                    <HeaderInfo commitInfo={commitInfo} /> 
                </div>

                <div className="container-fluid"> 
                    <div className="form-container">
                        <div className="button-group">
                            <div className="floating-tools-container">
                                <Dropdown drop="up" show={showToolsDropdown} onToggle={(isOpen) => setShowToolsDropdown(isOpen)}>
                                    <Dropdown.Toggle variant="secondary" id="dropdown-tools">
                                        <i className="fas fa-tools"></i> Boite à Outils
                                    </Dropdown.Toggle>

                                    <Dropdown.Menu>
                                        <Dropdown.Item onClick={() => {setShowEmployeeModal(true); setShowToolsDropdown(false);}}>
                                            <i className="fas fa-users-cog"></i> Gérer le Personnel
                                        </Dropdown.Item>
                                        <Dropdown.Item onClick={() => {setShowFeatureRequestModal(true); setShowToolsDropdown(false);}}>
                                            <i className="fas fa-bug"></i> Rapport de Bug/Ajout
                                        </Dropdown.Item>
                                        <Dropdown.Item onClick={() => {toggleSavedReports(); setShowToolsDropdown(false);}}>
                                            <i className="fas fa-save"></i> Rapports Sauvegardés
                                        </Dropdown.Item>
                                        <Dropdown.Item onClick={() => {setShowEmsAmaModal(prev => !prev); setShowToolsDropdown(false);}}>
                                            <i className="fa-solid fa-truck-medical"></i> EMS Contre Avis Médical
                                        </Dropdown.Item>
                                        <Dropdown.Item onClick={() => {toggleSeasonalEffects(); setShowToolsDropdown(false);}}>
                                            <i className={`fas ${seasonalEffectsEnabled ? 'fa-snowflake' : 'fa-sun'}`}></i> 
                                            {seasonalEffectsEnabled ? ' Désactiver' : ' Activer'} Effet de Saison
                                        </Dropdown.Item>
                                        <Dropdown.Item onClick={() => {restartOnboarding(); setShowToolsDropdown(false);}}>
                                            <i className="fas fa-play-circle"></i> Guide de Configuration
                                        </Dropdown.Item>
                                        <Dropdown.Divider />
                                        <Dropdown.Item onClick={() => {{
                                            localStorage.removeItem('selectedAgencyGroup');
                                            setSelectedAgencyGroup(null);
                                            setShowAgencyGroupSelectorModal(true);
                                            setShowToolsDropdown(false);
                                        }}}>
                                            <i className="fas fa-users"></i> Changer de Formulaire
                                        </Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>

                            <FeatureRequestModal
                                show={showFeatureRequestModal}
                                onClose={() => setShowFeatureRequestModal(false)}
                                featureRequest={featureRequest}
                                setFeatureRequest={setFeatureRequest}
                                discordName={discordName}
                                setDiscordName={setDiscordName}
                                isBbcodeRequest={isBbcodeRequest}
                                setIsBbcodeRequest={setIsBbcodeRequest}
                                bbcodeTitleRequest={bbcodeTitleRequest}
                                setBbcodeTitleRequest={setBbcodeTitleRequest}
                                bbcodeRequestText={bbcodeRequestText}
                                setBbcodeRequestText={setBbcodeRequestText}
                                bbCodeVersion={bbCodeVersion}
                                commitInfo={commitInfo}
                                setShowFeatureRequestModal={setShowFeatureRequestModal}
                            />

                            <Button
                                variant="secondary"
                                type="button"
                                className="changelog-button"
                                onClick={() => setShowBusinessCard(prev => !prev)}
                            >
                                <i className="fa-solid fa-address-card"></i>
                                Carte de Visite
                            </Button>

                            <div className="floating-top-right-tools">
                                {selectedAgencyGroup === 'PHMC Recruitment' && (
                                    <Button
                                        variant={phmcRecruitmentOptIn ? "outline-success" : "outline-secondary"}
                                        onClick={() => handleRecruitmentOptIn(!phmcRecruitmentOptIn)}
                                        className="changelog-button"
                                        title={phmcRecruitmentOptIn ? "Click to Opt-out of PHMC Recruitment Notifications" : "Click to Opt-in to PHMC Recruitment Notifications"}
                                    > Activer/désactiver l'alerte de bureau
                                        <i className={`fas ${phmcRecruitmentOptIn ? 'fa-bell-slash' : 'fa-bell'}`}></i>
                                    </Button>
                                )}
                            </div>

                            {(() => {
                                if (selectedAgencyGroup === 'PHMC Recruitment' && formData.recruitmentPosition) {

                                    let currentRecruitmentDetailsSource = null;
                                    let positionDisplayNameForTitle = formData.recruitmentPosition || 'selected position';
                                    const currentFormDef = getFormDefinition(bbCodeVersion);

                                    if (currentFormDef?.titleKey === "phmcCarrieresMedicales") {
                                        currentRecruitmentDetailsSource = selectOptions.physicianRecruitmentDetails;
                                    } else if (currentFormDef?.titleKey === "phmcCarrieresPsychologue") {
                                        currentRecruitmentDetailsSource = selectOptions.psychPositionDetailsData;
                                    } else if (currentFormDef?.titleKey === "phmcCarrieresAdministration") {
                                        currentRecruitmentDetailsSource = selectOptions.adminPositionDetailsData;
                                    } else if (currentFormDef?.titleKey === "phmcCarrieresInfirmieres") {
                                        currentRecruitmentDetailsSource = selectOptions.nursePositionDetailsData;
                                    } else if (currentFormDef?.titleKey === "phmcCarrieresEMS") {
                                        currentRecruitmentDetailsSource = selectOptions.emsPositionDetailsData;
                                    } else if (currentFormDef?.titleKey === "phmcCarrieresDMEC") {
                                        currentRecruitmentDetailsSource = selectOptions.coronerPositionDetailsData;
                                    }

                                    if (currentRecruitmentDetailsSource && currentRecruitmentDetailsSource[formData.recruitmentPosition]) {
                                        positionDisplayNameForTitle = currentRecruitmentDetailsSource[formData.recruitmentPosition].displayName || formData.recruitmentPosition;
                                    }

                                    if (currentRecruitmentDetailsSource && Object.keys(currentRecruitmentDetailsSource).length > 0) {
                                        return (
                                            <Button
                                                variant="info"
                                                type="button"
                                                className="changelog-button"
                                                onClick={() => handleShowPositionInfo(formData.recruitmentPosition, currentRecruitmentDetailsSource)}
                                                title={`More info about ${positionDisplayNameForTitle}`}
                                            >
                                                <i className="fas fa-info-circle"></i>
                                                Information sur le Poste
                                            </Button>
                                        );
                                    }
                                }
                                return null;
                                
                            })()}

                            {(bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 18) && (
                                <Button
                                    variant="secondary"
                                    type="button"
                                    className="changelog-button"
                                    onClick={() => setShowCoronerTips(true)}
                                >
                                    Conseils pour les Coroners
                                </Button>
                            )}
                        </div>

                        <div className="button-group">
                            <Button
                                type="button"
                                variant="phmc"
                                className="changelog-button"
                                onClick={() => window.open('https://phmcfr.com/', '_blank')}
                            >
                                <i className="fas fa-hospital"></i>
                                PHMC
                            </Button>
                            <Button
                                className="changelog-button"
                                variant='secondary'
                                onClick={handleMainFormSelectionButtonClick}
                            >
                                <i className="fas fa-exchange-alt"></i>
                                Sélectionner Formulaire {selectedAgencyGroup || "Agence"}
                            </Button>

                            <SwitchableFormButtons
                                bbCodeVersion={bbCodeVersion}
                                openSwitchableModal={openSwitchableModal}
                                formGroups={{
                                    coronerFormsSubGroup,
                                    physicalEvalFormsSubGroup,
                                    psychEvalFormsSubGroup,
                                    generalConsultFormsSubGroup,
                                    commentaryNoteFormsSubGroup,
                                    mentalHealthFormsSubGroup,
                                    civilianFormsSubGroup,
                                    phmcInternalEmails
                                }}
                            />
                        </div>

                        <form> 
                            <Suspense fallback={<LoadingSpinner />}>
                                {FieldComponent ? (
                                    <FieldComponent
                                        formData={formData}
                                        handleChange={handleChange}
                                        commitInfo={commitInfo}
                                        setFormData={setFormData}
                                        /* --- IMPORTANT: on passe désormais des [{label,value}] partout --- */
                                        typeOfDeathOptions={optionize(selectOptions.typeOfDeathOptions)}
                                        mannerOfDeathOptions={optionize(selectOptions.mannerOfDeathOptions)}
                                        requestingAgencyOptions={optionize(selectOptions.requestingAgenciesOptions)}
                                        phmcGroupedOptions={phmcGroupedOptions}
                                        coronerGroupedOptions={coronerGroupedOptions}
                                        setShowEmployeeModal={setShowEmployeeModal}
                                        handleSelectChange={handleSelectChange}
                                        isUploading={isUploading}
                                        handleImageUpload={handleImageUpload}
                                        removeNotification={removeNotification}
                                        patientTitleOptions={optionize(selectOptions.patientTitle)}
                                        patientPhoneOptions={optionize(selectOptions.patientPhone)}
                                        purposeOptions={optionize(selectOptions.PurposeMedicalInformationRelease)}
                                        formatOptions={optionize(selectOptions.PurposeMedicalInformationReleaseFormat)}
                                        medicalRecordOptions={optionize(selectOptions.MedicalRecordsRelease)}
                                        /* Surgical */
                                        phmcRank={optionize(selectOptions.phmcRank)}
                                        patientConsent={optionize(selectOptions.patientConsent)}
                                        complications={optionize(selectOptions.complications)}
                                        procedureGood={optionize(selectOptions.procedureGood)}
                                        /* PhysEval */
                                        BodyMassIndex={optionize(selectOptions.BodyMassIndex)}
                                        temperature={optionize(selectOptions.temperature)}
                                        heartRate={optionize(selectOptions.heartRate)}
                                        breathing={optionize(selectOptions.breathing)}
                                        bloodPressure={optionize(selectOptions.bloodPressure)}
                                        patientJob={optionize(selectOptions.patientJob)}
                                        patientJobRisks={optionize(selectOptions.patientJobRisks)}
                                        patientAllergiesRisk={optionize(selectOptions.patientAllergiesRisk)}
                                        patientMedicineRegular={optionize(selectOptions.patientMedicineRegular)}
                                        patientOther={optionize(selectOptions.patientOther)}
                                        predisposition={optionize(selectOptions.predisposition)}
                                        /* MentalHealth & ER & GeneralConsult */
                                        admission={optionize(selectOptions.admission)}
                                        followup={optionize(selectOptions.followup)}
                                        /* ER & GeneralConsult */
                                        painLevel={optionize(selectOptions.painLevel)}
                                        findings={optionize(selectOptions.findings)}
                                        lungs={optionize(selectOptions.lungs)}
                                        pupils={optionize(selectOptions.pupils)}
                                        wounds={optionize(selectOptions.wounds)}
                                        ecg={optionize(selectOptions.ecg)}
                                        sono={optionize(selectOptions.sono)}
                                        lab={optionize(selectOptions.lab)}
                                        bloodOxy={optionize(selectOptions.bloodOxy)}
                                        assignedDepartment={optionize(selectOptions.assignedDepartment)}
                                        departmentLarge={
                                            (currentFormDefinition?.version === 23 && selectedAgencyGroup === "PHMC")
                                                ? optionize(selectOptions.paletoClinicDepartment)
                                                : optionize(selectOptions.departmentLarge)
                                        }
                                        /* Shrink */
                                        Appearance={optionize(selectOptions.Appearance)}
                                        Behavior={optionize(selectOptions.Behavior)}
                                        Speech={optionize(selectOptions.Speech)}
                                        Mood={optionize(selectOptions.Mood)}
                                        Affect={optionize(selectOptions.Affect)}
                                        ThoughtProcess={optionize(selectOptions.ThoughtProcess)}
                                        ThoughtContent={optionize(selectOptions.ThoughtContent)}
                                        Insight={optionize(selectOptions.Insight)}
                                        Cognition={optionize(selectOptions.Cognition)}
                                        Risk={optionize(selectOptions.Risk)}
                                        /* CoronerEmail */
                                        fillPhoneChecked={fillPhoneChecked}
                                        setFillPhoneChecked={setFillPhoneChecked}
                                        handleFillCoronerPhone={handleFillCoronerPhone}
                                        addReport={addReport}
                                        removeReport={removeReport}
                                        handleReportChange={handleReportChange}
                                        toggleSavedReports={toggleSavedReports}
                                        /* DeathReport specific */
                                        dnr={optionize(selectOptions.dnr)}
                                        attorney={optionize(selectOptions.attorney)}
                                        dnrOrder={optionize(selectOptions.dnrOrder)}
                                        isJohnDoe={isJohnDoe}
                                        isJaneDoe={isJaneDoe}
                                        handleDoeChange={handleDoeChange}
                                        currentUtcTime={currentUtcTime}
                                        UpdateMedicalFile={optionize(selectOptions.UpdateMedicalFile)}
                                        Imaging={optionize(selectOptions.Imaging)}
                                        patientTitleNew={optionize(selectOptions.patientTitleNew)}
                                        XrayResults={optionize(selectOptions.XrayResults)}
                                        ctResults={optionize(selectOptions.ctResults)}
                                        mriResults={optionize(selectOptions.mriResults)}
                                        ultrasoundResults={optionize(selectOptions.ultrasoundResults)}
                                        otherResults={optionize(selectOptions.otherResults)}
                                        patientBloodType={optionize(selectOptions.patientBloodType)} 
                                        selectOptions={selectOptions}
                                        maritalStatus={optionize(selectOptions.maritalStatus)}
                                        numberChildren={optionize(selectOptions.numberChildren)}
                                        financialStatus={optionize(selectOptions.financialStatus)}
                                        physicianRecruitmentDetails={physicianRecruitmentDetails}
                                        psychRecruitmentDetails={psychRecruitmentDetails}
                                        adminRecruitmentDetails={adminRecruitmentDetails}
                                        emsRecruitmentDetails={emsRecruitmentDetails}
                                        nurseRecruitmentDetails={nurseRecruitmentDetails}
                                        coronerRecruitmentDetails={coronerRecruitmentDetails}
                                        showNotification={showNotification}
                                        onAttachReportSummaryRequest={onAttachReportSummaryRequest}
                                    />
                                ) : (
                                    <p>Veuillez sélectionner une agence, puis un type de formulaire.</p>
                                )}
                            </Suspense>
                            <div className="button-group">
                                <Button
                                    type="button"
                                    onClick={clearForm}
                                    className="remove-report-button"
                                >
                                    <i className="fas fa-trash-alt"></i>
                                    Vider le Formulaire
                                </Button>
                            </div>
                        </form>
                    </div>
                    
                    <div className="output-container">
                        <div className="floating-admin-button-container">
                            <Button
                                type="button"
                                variant="warning"
                                className="changelog-button"
                                onClick={() => setShowEmsBingoModal(true)}
                                title="Ouvrir le Bingo!"
                                // disabled // [BINGO DISABLED]
                            >
                                <i className="fas fa-trophy"></i>
                                Bingo
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                className="changelog-button"
                                onClick={() => navigate('/admin')}
                                title="Ouvrir le Panneau Admin"
                            >
                                <i className="fas fa-user-shield"></i>
                                Panneau Admin
                            </Button>
                        </div>

                        <RecruitmentStatusDisplay
                            selectedAgencyGroup={selectedAgencyGroup}
                            bbCodeVersion={bbCodeVersion}
                            physicianRecruitmentDetails={physicianRecruitmentDetails}
                            psychRecruitmentDetails={psychRecruitmentDetails}
                            adminRecruitmentDetails={selectOptions.adminPositionDetailsData || {}}
                            emsRecruitmentDetails={selectOptions.emsPositionDetailsData || {}}
                            nurseRecruitmentDetails={selectOptions.nursePositionDetailsData || {}}
                            coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData || {}}
                        />

                        <EmsBingoModal
                            show={showEmsBingoModal}
                            onHide={handleHideEmsBingoModal}
                            phmcGroupedOptions={phmcGroupedOptions}
                            coronerGroupedOptions={coronerGroupedOptions}
                            currentPhmcEmployee={formData.phmcEmployee}
                            showNotification={showNotification}
                            setShowEmployeeModal={setShowEmployeeModal}
                            isAdmin={formData.isAdminAuthenticated}
                            sendBingoWebhook={({ scorer, bingoType, phrase, lineName, marked, commitInfo: ci }) => 
                                sendBingoNotification({ scorer, bingoType, phrase, lineName, marked, commitInfo: ci || commitInfo })
                            }
                            sendPhraseRequestWebhook={({ requester, phrase, bingoType }) => 
                                sendPhraseRequestNotification({ requester, phrase, bingoType, commitInfo })
                            }
                        />

                        <EmployeeModal
                            show={showEmployeeModal}
                            onHide={() => {
                                setShowEmployeeModal(false);
                                setIsJohnDoe(false);
                                setIsJaneDoe(false);
                                setIsRemoveStaff(false);
                            }}
                            isJohnDoe={isJohnDoe}
                            coronerList={coronerListData}
                            phmcList={phmcListData}
                            isRemoveStaff={isRemoveStaff}
                            showNotification={showNotification}
                            handleDoeChange={handleDoeChange}
                            handleRemoveStaffChange={(selectedOptions) => {
                                setStaffToRemove(selectedOptions ? selectedOptions.map(option => option.value) : []);
                            }}
                            missingEmployeeData={missingEmployeeData}
                            handleMissingEmployeeChange={(e) => {
                                setMissingEmployeeData({ ...missingEmployeeData, [e.target.name]: e.target.value });
                            }}
                            phmcGroupedOptions={phmcGroupedOptions}
                            coronerGroupedOptions={coronerGroupedOptions}
                            employeeOptions={combinedStaffOptions}
                            handleMissingEmployeeSubmit={handleMissingEmployeeSubmit}
                        />            

                        <div className="bbcode-section">
                            {getBBCodeContent()?.length > 30000 && (
                                <div className={`char-counter ${getBBCodeContent()?.length > 60000 ? 'char-counter-warning' : ''}`}>
                                    Character Count: {getBBCodeContent()?.length ?? 'Error'} / 60000
                                    {getBBCodeContent()?.length > 60000 && (
                                        <div className="char-counter-warning-message">
                                            Attention : les forums PHPBB ont souvent une limite de caractères d’environ 60 000. Vous devrez peut-être scinder ce formulaire.
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="modern-output-controls">
                                <Button
                                    type="button"
                                    onClick={() => setShowBBCode(prev => !prev)}
                                    className="control-button"
                                >
                                    <i className={`fas ${showBBCode ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    {showBBCode ? 'Cacher BBCode' : 'Montrer BBCode'}
                                </Button>
                                <Button
                                    type="button"
                                    onClick={toggleSavedReports}
                                    className="control-button"
                                >
                                    <i className="fas fa-save"></i>
                                    Rapports Sauvegardés
                                </Button>
                            </div>
                            <p className="generated-title-label">Titre du Formulaire</p>
                            <p className="generated-title-string">{generateTitle()}</p>

                            {showBBCode && (
                                <div className="generated-title-container">
                                </div>
                            )}
                            
                            <div className="modern-copy-controls">
                                <Button
                                    type="button"
                                    onClick={handleCopyTitle}
                                    className="copy-button-modern"
                                >
                                    <i className="fas fa-copy"></i>
                                    Copier le Titre
                                </Button>

                                <Button
                                    type="button"
                                    onClick={handleCopyAndNotifyWrapper}
                                    className="copy-button-modern"
                                    disabled={isLockdownActive}
                                    title={isLockdownActive ? 'BBCode copying is disabled during site lockdown' : ''}
                                >
                                    <i className="fas fa-copy"></i>
                                    {getCopyButtonText()}
                                </Button>
                            </div>

                            {showBBCode && (
                                <pre className="bbcode-output">
                                    {getBBCodeContent()}
                                </pre>
                            )}

                            {bbCodeVersion === 2 && formData.department && agencyDataStore && agencyDataStore[formData.department] && agencyDataStore[formData.department].logo && agencyDataStore[formData.department].url && (
                                <div className="agency-buttons" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '18px 0 0 0', flexWrap: 'wrap' }}>
                                    <button
                                        className="agency-button"
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                        onClick={() => window.open(agencyDataStore[formData.department].url, '_blank')}
                                        title={agencyDataStore[formData.department].fullName || formData.department}
                                    >
                                        <img
                                            src={agencyDataStore[formData.department].logo}
                                            alt={agencyDataStore[formData.department].fullName || formData.department}
                                            style={{ height: '100px', width: 'auto', borderRadius: '6px', border: '1px solid #30363d', background: '#16202c', padding: '4px', marginBottom: '2px' }}
                                        />
                                    </button>
                                    <div style={{ color: '#eeeeeeb0', fontWeight: 600, fontSize: '1.1rem', textAlign: 'center', marginTop: '2px' }}>
                                        {agencyDataStore[formData.department].fullName || formData.department}
                                    </div>
                                </div>
                            )}

                            <FormImageLink
                                bbCodeVersion={bbCodeVersion}
                                selectedAgencyGroup={selectedAgencyGroup}
                                deathReportClass={deathReportClass}
                                civilianPaperworkClass={civilianPaperworkClass}
                                deathReportImage={deathReportImage}
                                civilianPaperworkImage={civilianPaperworkImage}
                            />
                        </div>

                        {(selectedAgencyGroup === 'PHMC' || selectedAgencyGroup === 'PHMC Recruitment') && (
                            <BusinessCardModal
                                show={showBusinessCard}
                                onHide={() => setShowBusinessCard(false)}
                                showNotification={showNotification}
                                commitInfo={commitInfo}
                                handleImageUpload={handleImageUpload}
                            />
                        )}

                        <SwitchableFormsModal
                            show={showPHMCModal}
                            onHide={() => setShowPHMCModal(false)}
                            title={switchableModalTitle}
                            forms={switchableFormsList}
                            handleFormSelect={handleAgencySelect}
                            isMobile={isMobile}
                            physicianRecruitmentDetails={selectOptions.physicianRecruitmentDetails}
                            psychRecruitmentStatus={psychRecruitmentDetails}
                            formDefinitions={formDefinitions}
                            adminRecruitmentDetails={selectOptions.adminPositionDetailsData || {}}
                            nurseRecruitmentDetails={selectOptions.nursePositionDetailsData || {}}
                            coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData || {}}
                            emsRecruitmentDetails={selectOptions.emsPositionDetailsData || {}}
                            userPreferences={userOnboardingPreferences}
                        />

                        <SavedReportsModal
                            show={showSavedReports}
                            onHide={() => setShowSavedReports(false)}
                            onClose={() => setShowSavedReports(false)}
                            savedReports={savedReports}
                            reportsForSelectedUser={savedReports}
                            loadReport={loadReportForUser}
                            deleteReportForUser={deleteReportForUser}
                            author={getCurrentReportAuthor(formData)}
                            isLoading={isLoadingUserReports}
                            onAttachReportSelectedForAttachment={handleReportSelectedForAttachment}
                            reportSelectionFilter={reportSelectionFilter}
                            versionNames={versionNames}
                            onEmployeeSelect={(employeeValue) => {
                                if (employeeValue) {
                                    loadUserSavedReports(employeeValue);
                                }
                            }}
                            employeeOptions={[
                                {
                                    label: 'PHMC Staff',
                                    options: ensureArray(phmcListData).map(p => ({
                                        value: p.name,
                                        label: `${p.name} (${p.category || 'PHMC'})`
                                    })).sort((a, b) => a.label.localeCompare(b.label))
                                },
                                {
                                    label: 'Coroners',
                                    options: ensureArray(coronerListData).map(c => ({
                                        value: c.name,
                                        label: `${c.name} (${c.rank || 'Coroner'})`
                                    })).sort((a, b) => a.label.localeCompare(b.label))
                                }
                            ]}
                            currentPhmcEmployee={formData.phmcEmployee}
                            currentCoronerEmployee={formData.coronerEmployee}
                            showNotification={showNotification}
                            removeNotification={removeNotification}
                            bbCodeVersion={bbCodeVersion}
                            handleReportSelectedForAttachment={handleReportSelectedForAttachment}
                        />
                    </div>
                </div>
                <Footer />
            </div>
        </Suspense>
    );
}

function MainAppWrapper() {
    const [formData, setFormData] = useState(() => {
        const savedFormData = localStorage.getItem('formData');
        return savedFormData ? JSON.parse(savedFormData) : {};
    });
    const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);

    const { showNotification, removeNotification, NotificationContainer } = useNotification();

    useEffect(() => {
        if (Object.keys(formData).length > 0) {
            localStorage.setItem('formData', JSON.stringify(formData));
        }
    }, [formData]);

    const initialFormData = {
        phmcEmployee: '',
        coronerEmployee: '',
        coronerBadge: '',
        coronerRank: '',
        coronerDiscord: '',
        coronerPHNumber: '50056',
        lastName: '',
        phmcRank: '',
        department: '',
        dateTime: '',
        date: '',
        decedentName: '',
        decedentOOC: '',
        synopsis: '',
        scenePhotos: '',
        additionalImages: '',
        patientID: '',
        patientName: '',
        patientAddress: '',
        massFatality: false,
        patientRace: '',
        patientGender: '',
        patientPH: '',
        patientDiscord: '',
        patientEmergencyContact: '',
        patientEmergencyContactNumber: '',
        patientEmergencyContactRelation: '',
        decedents: [],
        patientEmergencyContactDiscord: '',
        patientTitle: '',
        patientTitleOptions: '',
        patientAllergies: '',
        patientCurrentMedicine: '',
        patientChronicDiseases: '',
        patientNotes: '',
        patientDateOfBirth: '',
        patientBloodType: '',
        patientChiefComplaint: '',
        patientProcedure: '',
        patientDiagnosis: '',
        patientSecondaryDiagnosis: '',
        patientMedicine: '',
        admission: '',
        followup: '',
        SubmitDate: new Date().toISOString().split('T')[0],
        patientExercise: '',
        placeOfDeath: '',
        evidenceLockerID: '',
        evidenceLocker: '',
        pronouncedTimeOfDeath: '',
        mannerOfDeath: '',
        typeOfDeath: '',
        showRequestingOfficerInput: false,
        requestingOfficer: '',
        deathReport: '',
        additionalReports: [],
        autopsyDate: '',
        autopsyTime: '',
        autopsyDeathCauses: [''],
        autopsyAnatomicSummaryItems: [''],
        autopsyAlbumUrl: '',
        autopsyPhotosUnavailable: false,
        autopsyDiagramMarkers: [],
        autopsyDiagramImgurUrl: '',
        externalExamination: '',
        RadiologyResult: '',
        deathType: '',
        causeOfDeath: '',
        extraStaff: [],
        patientSummaryConsultation: '',
        patientSummary: '',
        surgeryProcedures: '',
        patientConsentOption: '',
        patientComplicationOptions: '',
        procedureGoodOptions: '',
        patientHeight: '',
        patientWeight: '',
        BodyMassIndex: '',
        temperature: '',
        heartRate: '',
        breathing: '',
        bloodPressure: '',
        patientJob: '',
        patientJobRisks: '',
        patientAllergiesRisk: '',
        patientMedicineRegular: '',
        patientOther: '',
        predisposition: '',
        patientCareer: '',
        patientImpairments: '',
        patientTriggers: '',
        patientFamily: '',
        patientFam: '',
        patientMedicalRecord: '',
        patientVisitReason: '',
        patientSymptoms: '',
        patientDrugs: '',
        patientDrugsUsage: '',
        patientMental: '',
        patientFamSocial: '',
        patientLegal: '',
        patientRelationship: '',
        patientFindings: '',
        patientTreatmentPlan: '',
        patientSafety: '',
        patientFollowUp: '',
        patientTreatmentMedicine: '',
        patientTherapy: '',
        patientRiskAssessment: '',
        Speech: '',
        Behavior: '',
        Appearance: '',
        Mood: '',
        Affect: '',
        Risk: '',
        ThoughtProcess: '',
        ThoughtContent: '',
        Insight: '',
        Cognition: '',
        painLevel: '',
        findings: '',
        lungs: '',
        pupils: '',
        wounds: '',
        ecg: '',
        sono: '',
        lab: [],
        bloodOxy: '',
        assignedDepartment: '',
        departmentLarge: '',
        paletoClinicDepartment: '',
        MedicalRecordsRelease: [],
        payNow: false,
        paymentProofPhotos: '',
        PurposeMedicalInformationReleaseFormat: '',
        CarePurposeMedicalInformationRelease: '',
        patientMedInfoReleaseOther: '',
        MedicalRecordsReleaseOther: '',
        patientMedInfoFormatOther: '',
        StupidDateFrom: '',
        StupidDateTo: '',
        patientFirstName: '',
        patientMiddleName: '',
        patientLastName: '',
        patientEmail: '',
        patientPhoneType: '',
        patientZIP: '',
        dnr: '',
        dnrOrder: '',
        attorney: '',
        dnrOther: '',
        attorneyName: '',
        attorneyRelation: '',
        attorneyPH: '',
        maritalStatus: '',
        numberChildren: '',
        financialStatus: '',
        patientSupport: '',
        patientHarm: '',
        patientGenetic: '',
        patientReligion: '',
        patientSmoker: '',
        patientAlcohol: '',
        patientDiet: '',
        patientSleep: '',
        patientSexLife: '',
        patientHazards: '',
        prescriptionImage: '',
        attachedReportSummary: '',
        emailPurpose: '',
        emailRecipient: '',
        dateOfVisit: '',
        sicknessStartDate: '',
        sicknessEndDate: '',
        reasonForSickness: '',
        illnessCondition: '',
        confirmationPurpose: '',
        phmcEmployeeSignatureImage: '',
        recruitmentPosition: '',
        applicantContactDetails: '',
        locationPHMC: false,
        locationPBC: false,
        applicantMedicalConditions: '',
        citizenUS: false,
        citizenPermanent: false,
        citizenNone: false,
        eduHighSchool: false,
       
        eduCertificate: false,
        eduDiploma: false,
        eduAssociate: false,
        eduBachelor: false,
        eduMaster: false,
        eduDoctorate: false,
        applicantSchoolName: '',
        applicantEnrollmentTerm: '',
        applicantMajor: '',
        applicantLanguages: '',
        applicantPrevEmployment: '',
        applicantPrevDuties: '',
        applicantPrevDismissalReason: '',
        applicantMotivationLetter: '',
        exemptCheckbox: false,
        oocMedicalExperience: '',
        oocAdminRecordLink: '',
        oocStatsLink: '',
        applicantTitleAndFullName: '',
        genderMale: '',
        genderFemale: '',
        genderOther: '',
        applicantGenderOtherText: '',
        applicantDOBAndPlace: '',
        applicantAddress: '',
        emsLicenseLink: '',
        emsPartTimeReason: '',
        oocUcpName: '',
        oocForumName: '',
        oocDiscord: '',
        oocTimezone: '',
        charBackground: '',
        oocOtherCharLicenseProof: '',
        dfpSanFireLink: '',
        dfpPhmcLink: '',
        dfpLegalFactionLink: '',
        Imaging: [],
        XrayResults: [],
        ctResults: [],
        mriResults: [],
        ultrasoundResults: [],
        patientTitleNew: '',
        patientNameNew: '',
        patientDateOfBirthNew: '',
        patientAddressNew: '',
        patientPHNew: '',
        patientDiscordNew: '',
        patientGenderNew: '',
        patientRaceNew: '',
        deathRecordType: '',
    };

    return (
        <MainApp
            formData={formData}
            setFormData={setFormData}
            lastWebhookIdentifier={lastWebhookIdentifier}
            setLastWebhookIdentifier={setLastWebhookIdentifier}
            initialFormData={initialFormData}
            showNotification={showNotification}
            removeNotification={removeNotification}
        />
    );
}

export default MainAppWrapper;
