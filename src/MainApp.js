// src/MainApp.js
import { useReportManagement } from './components/useReportManagement';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense, Fragment } from 'react';
import { formDefinitions, getFormDefinition } from './formDefinitions'; 
import '@fortawesome/fontawesome-free/css/all.min.css';
import { Button, Dropdown, Modal } from 'react-bootstrap';
import getRelevantFields from './components/RevelantFields';
import { buildReportTitle } from './utils/reportTitle';
import { canonicalPatientId } from './utils/patientId';
import SeasonalEvents from './components/SeasonalEvents';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as Sentry from "@sentry/react";
import { useNotification } from './contexts/NotificationContext';
import SwitchableFormButtons from './components/SwitchableFormButtons';
import { handleSaveReportAndNotify, handleCopyBBCodeOnly, handlePhmcRecruitmentCopyAndNotify, sendBingoNotification, sendPhraseRequestNotification } from './components/notificationService';
import { sendEyefindMail } from './utils/eyefindMail';
import { useData } from './contexts/DataContext';
import LoadingSpinner from './components/LoadingSpinner';
import { useModal } from './contexts/ModalProvider';
import { useSettings } from './contexts/SettingsProvider';
import { useWebhooks } from './hooks/useWebhooks';
import { useImageUpload } from './hooks/useImageUpload';
import { loadUserCreations } from './utils/userCreations';
import { normalizeBBCodeLineBreaks } from './utils/bbcodeLineBreaks';
import { bbcodeToHtmlDocument, buildHtmlFileName, downloadHtmlFile } from './utils/bbcodeToHtml';
import ForumCopyNoticeModal, { isForumNoticeHidden } from './components/ForumCopyNoticeModal';
import { useGitHubCommit } from './hooks/useGitHubCommit';
import { useLockdown } from './contexts/LockdownContext';
import LockdownBanner from './components/LockdownBanner';
import LockdownDialog from './components/LockdownDialog';
import { useEmployeeAuth } from './contexts/EmployeeAuthContext';
import { useEmployeeSelector } from './hooks/useEmployeeSelector';
import DebugFillButton from './components/DebugFillButton';
import { getDebugTemplate, hasDebugTemplate } from './utils/debugTemplates';
import useAutoGrowTextareas from './hooks/useAutoGrowTextareas';
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
import SeasonControls from './components/SeasonControls';
import ViewAsBanner from './components/ViewAsBanner';
import { getToolAccess } from './utils/viewAs';
import useFormAccess from './hooks/useFormAccess';
import 'react-bootstrap-typeahead/css/Typeahead.css';

// database
import { database, auth } from './firebase'; // Your Firebase config
import { signInWithCustomToken } from 'firebase/auth';
import { getEmployeeDisplayName } from './utils/employeeName';
import { mergeResultOptions, IMAGING_RESULT_ADDITIONS, LAB_RESULT_ADDITIONS } from './constants/clinicalOptions';
import PatientInvoiceNotifier from './components/PatientInvoiceNotifier';
import { ReportPreviewFrame } from './components/ReportExpansion';
import { useSiteConfig } from './contexts/SiteConfigContext';
import ImmersiveHeader from './components/ImmersiveHeader';
import { exportReportDocument } from './utils/reportDocumentExport';
// Lazy-loaded components
const SavedReportsModal = lazy(() => import('./components/SavedReportsModal'));
const SaveAsEmployeeModal = lazy(() => import('./components/SaveAsEmployeeModal'));
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
const EmployeeLoginModal = lazy(() => import('./components/Auth/EmployeeLoginModal'));
const PatientDossierModal = lazy(() => import('./components/PatientDossierModal'));
const MyPatientFileModal = lazy(() => import('./components/MyPatientFileModal'));
const MyProfileModal = lazy(() => import('./components/MyProfileModal'));
const AwarenessCalendarModal = lazy(() => import('./components/AwarenessCalendarModal'));
const MyContractsModal = lazy(() => import('./components/Contracts/MyContractsModal'));
const RecruitmentManager = lazy(() => import('./components/Recruitment/RecruitmentManager'));
const MyJobApplicationsModal = lazy(() => import('./components/MyJobApplicationsModal'));
const RecruitmentStatusDisplay = lazy(() => import('./components/RecruitmentStatusDisplay'));
const CctvRequestWebhookModal = lazy(() => import('./components/Admin/CctvRequestWebhookModal'));
const FeatureRequestModal = lazy(() => import('./contexts/FeatureRequestModal'));
const FormImageLink = lazy(() => import('./components/FormImageLink'));
const PositionInfoModal = lazy(() => import('./components/PositionInfoModal'));
const EmsBingoModal = lazy(() => import('./components/EmsBingoModal'));
const BbcodeToMarkdownModal = lazy(() => import('./components/BbcodeToMarkdownModal'));
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
    
    const { currentEmployee, employeeProfile, staffProfile, civilianProfile, isCivilian, isAdmin, canUseAma, staffName, isRecruiter, isContractCandidate, canManageRecruitment, viewAs, logoutEmployee, isLoading: authLoading } = useEmployeeAuth();
    // Ce que la personne (ou le profil simulé par un admin) voit dans la Boîte à outils : une seule définition, voir utils/viewAs.js.
    const toolAccess = getToolAccess({ currentEmployee, employeeProfile, staffProfile, isAdmin, isRecruiter, isContractCandidate, isCivilian, staffName, canUseAma, canManageRecruitment });
    const [showLoginModal, setShowLoginModal] = useState(false);
    // Choix de rôle affiché par le bouton « Se connecter » de la page
    // principale : Personnel PHMC/DMEC ouvre EmployeeLoginModal (existant),
    // Civil ouvre le Guide de Configuration directement sur la connexion/
    // création de compte Civil (voir ONBOARDING_STEPS.CIVIL_AUTH /
    // USER_TYPES.CIVILIAN dans OnboardingModal.js — valeurs dupliquées ici en
    // chaînes littérales pour ne pas forcer le chargement anticipé de ce
    // composant lazy-loaded).
    // Compte GTAW lié à plusieurs comptes (ex. employé + civil) : liste à choisir après la redirection.
    const [accountChoices, setAccountChoices] = useState(null);
    const [quickCivilOnboarding, setQuickCivilOnboarding] = useState(false);
    // Outil personnel "Dossier Patient" (Lot 5) : recherche par ID patient,
    // voir PatientDossierModal.js.
    const [showPatientDossierModal, setShowPatientDossierModal] = useState(false);
    // « Mon dossier patient » : le personnel peut lui aussi être un patient.
    const [showMyPatientFile, setShowMyPatientFile] = useState(false);
    // « Mon profil » : le personnel modifie lui-même téléphone, Discord et adresse Eyefind Mail.
    const [showMyProfile, setShowMyProfile] = useState(false);
    // Calendrier des événements de sensibilisation médicale (Octobre Rose, Movember...).
    const [showAwarenessCalendar, setShowAwarenessCalendar] = useState(false);
    // « Mes contrats » : le personnel lit et signe les contrats envoyés par les recruteurs.
    const [showMyContracts, setShowMyContracts] = useState(false);
    // Gestion du recrutement (admins + recruteurs).
    const [showRecruitmentManager, setShowRecruitmentManager] = useState(false);
    const [showBbcodeToMarkdown, setShowBbcodeToMarkdown] = useState(false);
    // Modal de sélection d'employé affichée à un admin qui clique sur
    // "Sauvegarder le rapport" : un admin peut sauvegarder pour n'importe quel
    // employé, alors qu'un employé connecté (non-admin) sauvegarde toujours
    // sous sa propre identité, et un visiteur non connecté ne peut pas
    // sauvegarder du tout (voir handleSaveReportWrapper).
    const [showSaveAsEmployeeModal, setShowSaveAsEmployeeModal] = useState(false);


    // Onboarding detection and initialization
    useEffect(() => {
        const onboardingCompleteFlag = localStorage.getItem('onboardingComplete');
        const userPreferences = localStorage.getItem('userOnboardingPreferences');
        // Présent si l'utilisateur vient de lancer une connexion GTA World depuis la
        // création de compte (OnboardingModal) et revient d'une redirection OAuth :
        // il faut rouvrir l'onboarding même si elle avait déjà été complétée avant.
        const gtawOnboardingPending = sessionStorage.getItem('gtaw-onboarding-pending');

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

        // Show onboarding for first-time users, or to resume a GTA World OAuth flow
        if (gtawOnboardingPending || (!onboardingCompleteFlag && !userPreferences)) {
            setShowOnboarding(true);
        } else {
            setOnboardingComplete(true);
        }
    }, []);

    // Reprise après une redirection OAuth GTA World lancée depuis EmployeeLoginModal :
    // GtaCallback connecte déjà l'utilisateur directement (signInWithCustomToken),
    // donc on n'a besoin ici que de signaler un éventuel échec (compte non lié, erreur
    // OAuth, etc). Le succès est déjà couvert par la notification de bienvenue ci-dessous
    // dès que employeeProfile se charge.
    useEffect(() => {
        try {
            const resultRaw = sessionStorage.getItem('gtaw-login-result');
            if (resultRaw) {
                sessionStorage.removeItem('gtaw-login-result');
                const result = JSON.parse(resultRaw);
                if (result.choices) {
                    setAccountChoices(result.choices);
                } else if (result.notLinked) {
                    // Aucun compte lié à ce personnage : on emmène directement vers la création de compte
                    // (Guide de Configuration).
                    showNotification("Aucun compte n'est encore lié à ce personnage GTA World : créons-le avec le Guide de Configuration !", 'info-circle', 10000);
                    restartOnboarding();
                } else if (result.error) {
                    showNotification(`Échec de la connexion avec GTA World : ${result.error}`, 'error');
                }
            }
        } catch (error) {
            console.warn('Failed to parse GTA World login result:', error);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleOnboardingComplete = (preferences) => {
        setUserOnboardingPreferences(preferences);
        setOnboardingComplete(true);
        setShowOnboarding(false);
        setQuickCivilOnboarding(false);

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
        setQuickCivilOnboarding(false);
        showNotification('L\'introduction a été ignorée. Vous pouvez la relancer à tout moment depuis le menu Outils.', 'info-circle');
    };

    const restartOnboarding = () => {
        localStorage.removeItem('onboardingComplete');
        localStorage.removeItem('onboardingSkipped');
        localStorage.removeItem('userOnboardingPreferences');
        setUserOnboardingPreferences(null);
        setOnboardingComplete(false);
        setQuickCivilOnboarding(false);
        setShowOnboarding(true);
    };
    const [isMobile, setIsMobile] = useState(false);
    const [showMovedNotification, setShowMovedNotification] = useState(true);
    const [showToolsDropdown, setShowToolsDropdown] = useState(false);
    const modalCloseTimer = useRef(null);
    
    const [fillPhoneChecked, setFillPhoneChecked] = useState(false);
    const [showBBCode, setShowBBCode] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    // BBCode désactivé par les admins : il ne reste que l'aperçu et le téléchargement HTML.
    const { bbcodeEnabled } = useSiteConfig();
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
    
    // Filtrer les listes d'employés selon l'utilisateur connecté
    const { 
        filteredPhmcList, 
        filteredCoronerList, 
        isRestricted,
        currentEmployeeName 
    } = useEmployeeSelector(phmcListData, coronerListData);
    
    // Créer des listes non-filtrées pour extraStaff et chiefCoronerEmployee
    const { 
        filteredPhmcList: unrestrictedPhmcList, 
        filteredCoronerList: unrestrictedCoronerList
    } = useEmployeeSelector(phmcListData, coronerListData, false); // applyRestriction = false
    
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

    const { seasonalEffectsEnabled, toggleSeasonalEffects, immersiveHeaderEnabled, toggleImmersiveHeader } = useSettings();
    // Deux versions du formulaire de retour : rapport de bug (tout le monde) et demande de fonctionnalité (comptes connectés).
    const [featureModalMode, setFeatureModalMode] = useState('bug');
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
    const { isUploading, handleImageUpload, uploadImageDetailed } = useImageUpload(showNotification, setFormData);
    // Rafraîchit la copie locale de ma signature (proposée dans les formulaires qui la demandent).
    const myCreationsUid = currentEmployee?.uid || null;
    useEffect(() => {
        if (myCreationsUid) loadUserCreations(myCreationsUid).catch(() => {});
    }, [myCreationsUid]);
    // All references to bbCodeVersion now occur after its initialization
    const handleSelectAgencyGroup = (group) => {
        setSelectedAgencyGroup(group);
        localStorage.setItem('selectedAgencyGroup', group);
        setShowAgencyGroupSelectorModal(false);
        setShowAgencySelector(true);
    };

    // L'ID patient saisi reste en place quand on passe d'un formulaire à l'autre : on enchaîne souvent plusieurs
    // rapports pour le même patient.
    const handleAgencySelect = useCallback((version) => {
        setBbCodeVersion(version);
        setShowAgencySelector(false);
        setShowPHMCModal(false);
    }, [setBbCodeVersion, setShowAgencySelector, setShowPHMCModal]);

    const handleHideAgencyGroupSelectorPreference = (hide) => {
        setHideAgencyGroupSelectorPreference(hide);
        localStorage.setItem('hideAgencyGroupSelectorPreference', hide);
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

    // Fenêtre d'aide « forums » : 'bbcode' (après une copie) ou 'html' (après un téléchargement).
    const [forumNotice, setForumNotice] = useState(null);
    const openForumNotice = (kind, force = false) => {
        if (force || !isForumNoticeHidden(kind)) setForumNotice(kind);
    };

    // Export HTML : converti depuis le BBCode courant AU CLIC (état le plus récent du formulaire),
    // entièrement dans le navigateur — aucun appel serveur, donc aucun coût Firebase.
    const handleDownloadHtml = () => {
        const bbCode = getBBCodeContent();
        if (!bbCode || !String(bbCode).trim()) {
            showNotification('Rien à exporter : le BBCode est vide.', 'warning');
            return;
        }
        try {
            const title = generateTitle();
            downloadHtmlFile(buildHtmlFileName(title), bbcodeToHtmlDocument(bbCode, { title }));
            showNotification('Fichier HTML téléchargé !', 'check-circle');
            openForumNotice('html');
        } catch (error) {
            console.error('Export HTML impossible :', error);
            Sentry.captureException(error, { extra: { context: 'Export HTML', bbCodeVersion } });
            showNotification(`Échec de la génération du HTML : ${(error.message || '').substring(0, 120)}`, 'error');
        }
    };

    // Export PDF (A4) ou SVG (image vectorielle) du rapport affiché, converti depuis le BBCode courant au clic.
    const handleExportDocument = (format) => {
        exportReportDocument(format, { bbCode: getBBCodeContent(), title: generateTitle(), showNotification });
    };

    const handleCopyTitle = () => {
        const title = generateTitle();
        navigator.clipboard.writeText(title);
        showNotification('Titre copié dans le presse-papiers !', 'check-circle');
    };

    // Le « Titre du Formulaire » est EXACTEMENT le titre qui sera enregistré avec le
    // rapport (Rapports enregistrés, Dossier Patient) : même fonction que saveReport.
    const generateTitle = () => {
        const definition = getFormDefinition(bbCodeVersion);
        if (!definition) return "Rapport Sans Titre";
        if (bbCodeVersion === 999 && definition.titleGenerator) return definition.titleGenerator(formData);
        return buildReportTitle(bbCodeVersion, formData, definition.name);
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
                        specificPositionData = physicianRecruitmentDetails || {};
                    } else if (definition.titleKey === "phmcCarrieresPsychologue") {
                        specificPositionData = psychRecruitmentDetails || {};
                    } else if (definition.titleKey === "phmcCarrieresAdministration") {
                        specificPositionData = adminRecruitmentDetails || {};
                    } else if (definition.titleKey === "phmcCarrieresInfirmieres") {
                        specificPositionData = nurseRecruitmentDetails || {};
                    } else if (definition.titleKey === "phmcCarrieresDMEC") {
                        specificPositionData = coronerRecruitmentDetails || {};
                    } else if (definition.titleKey === "phmcCarrieresEMS") {
                        specificPositionData = emsRecruitmentDetails || {};
                    }
                }

                const generatorArgs = {
                    ...formData,
                    // L'ID patient est toujours écrit sous sa forme canonique dans le BBCode
                    // (2752 → PHMC-2752), même si l'utilisateur n'a saisi que les chiffres.
                    ...(formData.patientID ? { patientID: canonicalPatientId(formData.patientID) } : {}),
                    positionDetailsData: specificPositionData || {},
                    agencyDataStore: agencyDataStore,
                };
                // Un retour à la ligne ET [br][/br] côte à côte faisaient deux sauts : on les fusionne (voir utils/bbcodeLineBreaks.js).
                return normalizeBBCodeLineBreaks(definition.generator(generatorArgs));
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
        deleteReportsForUser,
        loadSharedReportsForPatient,
        shareReportWithPatient,
        copyReportToOwnAccount,
        saveJobApplication,
        loadMyJobApplications,
        loadApplicationIntoForm,
        updateJobApplicationStatus,
        myJobApplications,
        isLoadingJobApplications,
        showMyJobApplications,
        setShowMyJobApplications,
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
        selectedAgencyGroup,
        initialFormData
    );

    // Fermer « Rapports enregistrés » abandonne aussi une pièce jointe en attente (sinon le filtre
    // « rapports acceptés pour un certificat » resterait actif à la prochaine ouverture).
    const closeSavedReports = () => {
        setShowSavedReports(false);
        setReportSelectionFilter(null);
        if (pendingReportAttachmentCallback) pendingReportAttachmentCallback.current = null;
    };

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
    
    // « Se connecter » : une seule fenêtre pour Personnel ET Civil (connexion GTA World ou e-mail).
    const handleOpenLogin = () => setShowLoginModal(true);

    // « Créer un compte » : on passe par le Guide de Configuration, qui accompagne toutes les étapes.
    const handleOpenSignup = () => restartOnboarding();

    // Compte GTAW lié à plusieurs comptes : connexion avec le jeton du compte choisi.
    const handleChooseAccount = async (choice) => {
        try {
            await signInWithCustomToken(auth, choice.customToken);
            setAccountChoices(null);
        } catch (error) {
            console.error('Connexion au compte choisi impossible :', error);
            showNotification('Connexion impossible : le lien de connexion a expiré, recommencez avec GTA World.', 'error');
            setAccountChoices(null);
        }
    };

    const handleEmployeeLogout = async () => {
        try {
            await logoutEmployee();
            showNotification('Déconnexion réussie', 'success');
        } catch (error) {
            console.error('Error logging out:', error);
            showNotification('Erreur lors de la déconnexion', 'error');
        }
        setShowToolsDropdown(false);
    };
    
    const handleLoginSuccess = () => {
        // employeeProfile est chargé de manière asynchrone — la notification sera
        // affichée par le useEffect ci-dessous dès que le profil sera disponible.
    };

    // Affiche la notification de bienvenue dès que le profil employé est chargé après connexion
    const prevEmployeeRef = useRef(null);
    useEffect(() => {
        if (employeeProfile && !prevEmployeeRef.current) {
            const displayName = getEmployeeDisplayName(employeeProfile, currentEmployee?.email || '');
            showNotification(`Bienvenue ${displayName} !`, 'success');
        }
        prevEmployeeRef.current = employeeProfile;
    }, [employeeProfile]); // eslint-disable-line react-hooks/exhaustive-deps
    
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
    }, []);

    // Quand les effets de saison sont désactivés, on force la saison "Default"
    // plutôt que de ne pas appeler SeasonalEvents du tout : sinon imageSource
    // vaut undefined et l'image générique (Generic.png) ne s'affiche plus.
    const { imageSource: deathReportImage, className: deathReportClass, season, effect } = SeasonalEvents({ imageType: 'deathReport', season: seasonalEffectsEnabled ? undefined : 'Default' });
    const { imageSource: civilianPaperworkImage, className: civilianPaperworkClass } = SeasonalEvents({ imageType: 'civilianPaperwork', season: seasonalEffectsEnabled ? undefined : 'Default' });

    // Copie pure du BBCode dans le presse-papiers. Pour les formulaires de
    // recrutement PHMC, la copie EST l'action de soumission (webhook de
    // candidature inclus) puisque ces formulaires ne peuvent pas être
    // sauvegardés (voir saveReport() dans useReportManagement.js) — ce cas
    // reste donc géré à part. Pour tous les autres formulaires, copier ne fait
    // plus que copier : la sauvegarde (et ses conditions/validations) est
    // désormais déclenchée séparément par handleSaveReportWrapper.
    const handleCopyAndNotifyWrapper = useCallback(async () => {
        let copied = false;
        if (selectedAgencyGroup === 'PHMC Recruitment') {
            copied = await handlePhmcRecruitmentCopyAndNotify({
                formData,
                getBBCodeContent,
                showNotification,
                commitInfo,
                selectOptions,
                formDefinition: getFormDefinition(bbCodeVersion),
            });
        } else {
            copied = await handleCopyBBCodeOnly({
                getBBCodeContent,
                getFormDefinition,
                bbCodeVersion,
                showNotification,
            });
        }
        // Rappel : le BBCode marche sur le forum PHMC, pas sur le forum GTA World (voir ForumCopyNoticeModal).
        if (copied) openForumNotice('bbcode');
    }, [
        selectedAgencyGroup,
        formData,
        getBBCodeContent,
        showNotification,
        commitInfo,
        selectOptions,
        bbCodeVersion,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ]);

    // Sauvegarde un rapport pour l'auteur donné (compte connecté, ou employé
    // choisi par un admin via SaveAsEmployeeModal). C'est ce nom qui remplace
    // désormais getCurrentReportAuthor(formData) pour la sauvegarde : on
    // sauvegarde sous l'identité réelle de qui enregistre, pas sous le nom
    // choisi dans le menu déroulant coronerEmployee/phmcEmployee du formulaire
    // ni sous un compartiment "CIVILIAN" invisible.
    const runSaveReport = useCallback((authorOverride) => {
        handleSaveReportAndNotify({
            formData,
            bbCodeVersion,
            selectedAgencyGroup,
            getBBCodeContent,
            getFormDefinition,
            saveReport,
            showNotification,
            handleAgencySelect,
            setLastWebhookIdentifier,
            commitInfo,
            database,
            authorOverride,
        });
    }, [
        formData,
        bbCodeVersion,
        selectedAgencyGroup,
        getBBCodeContent,
        saveReport,
        showNotification,
        handleAgencySelect,
        setLastWebhookIdentifier,
        commitInfo,
        database,
    ]);

    const handleSaveReportWrapper = useCallback(() => {
        if (viewAs) {
            showNotification('Simulation de rôle active : l\'enregistrement est désactivé (rien ne doit être écrit au nom d\'un faux profil).', 'warning');
            return;
        }
        if (!currentEmployee) {
            showNotification('Vous devez être connecté pour enregistrer un rapport.', 'error');
            return;
        }
        if (isAdmin) {
            setShowSaveAsEmployeeModal(true);
            return;
        }
        // Un civil sauvegarde sous sa propre identité (civilianProfile), jamais
        // sous employeeProfile — l'ID patient est inclus pour garantir
        // l'unicité même entre deux civils homonymes.
        if (isCivilian) {
            const civilName = civilianProfile?.firstName && civilianProfile?.lastName
                ? `${civilianProfile.firstName} ${civilianProfile.lastName}`
                : (civilianProfile?.email || null);
            if (!civilName || !civilianProfile?.patientID) {
                showNotification('Impossible de déterminer votre identité Civil. Veuillez réessayer ou contacter un administrateur.', 'error');
                return;
            }
            runSaveReport(`${civilName} [${civilianProfile.patientID}]`);
            return;
        }
        const authorName = employeeProfile?.name
            || (employeeProfile?.firstName && employeeProfile?.lastName ? `${employeeProfile.firstName} ${employeeProfile.lastName}` : null);
        if (!authorName) {
            showNotification('Impossible de déterminer votre identité employé. Veuillez réessayer ou contacter un administrateur.', 'error');
            return;
        }
        runSaveReport(authorName);
    }, [viewAs, currentEmployee, isAdmin, isCivilian, civilianProfile, employeeProfile, runSaveReport, showNotification]);

    const handleConfirmSaveAsEmployee = useCallback((employeeName) => {
        setShowSaveAsEmployeeModal(false);
        runSaveReport(employeeName);

        // Prévient l'employé par mail Eyefind qu'un rapport a été sauvegardé sur
        // son compte par un admin — best-effort, ne bloque jamais la sauvegarde.
        const employeeRecord = [...ensureArray(phmcListData), ...ensureArray(coronerListData)]
            .find((emp) => emp.name === employeeName);
        if (employeeRecord?.email) {
            const formName = getFormDefinition(bbCodeVersion)?.name || 'un rapport';
            sendEyefindMail({
                to: employeeRecord.email,
                subject: 'Rapport enregistré sur votre compte - PHMC',
                body: `Bonjour ${employeeName},\n\nUn administrateur a enregistré « ${formName} » sur votre compte PHMC. Vous pouvez le consulter dans « Rapports enregistrés ».\n\nCordialement,\nPillbox Hill Medical Center`,
                html: `<p>Bonjour ${employeeName},</p><p>Un administrateur a enregistré « ${formName} » sur votre compte PHMC. Vous pouvez le consulter dans « Rapports enregistrés ».</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
            }).then((result) => {
                if (!result.ok) {
                    console.warn('Eyefind Mail non envoyé:', result.error, result.message);
                }
            });
        }
    }, [runSaveReport, phmcListData, coronerListData, bbCodeVersion]);

    // Les zones de texte du formulaire s'agrandissent avec leur contenu.
    useAutoGrowTextareas([formData, bbCodeVersion]);

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

    const handleMissingEmployeeSubmit = async (actionType, employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updatedStaff, adminUserEmail) => {
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
            formData.phmcEmployee,
            adminUserEmail || formData.adminUserEmail
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
        const list = ensureArray(filteredPhmcList);
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
                    rank: employee.category || employee.rank || '',
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
    }, [filteredPhmcList]);

    const coronerGroupedOptions = useMemo(() => {
        const list = ensureArray(filteredCoronerList);
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
    }, [filteredCoronerList]);

    // Versions non-filtrées pour extraStaff et chiefCoronerEmployee
    const unrestrictedPhmcGroupedOptions = useMemo(() => {
        const list = ensureArray(unrestrictedPhmcList);
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
    }, [unrestrictedPhmcList]);

    const unrestrictedCoronerGroupedOptions = useMemo(() => {
        const list = ensureArray(unrestrictedCoronerList);
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
    }, [unrestrictedCoronerList]);

    // Mode debug (activé depuis le panneau admin) : remplit le formulaire
    // courant avec un gabarit de test. Les employés sont choisis parmi les
    // listes déjà filtrées par useEmployeeSelector, donc un employé restreint
    // reste « lui-même » (utile pour tester les permissions).
    const handleDebugFill = () => {
        const flatten = (groups) => (groups || []).flatMap((g) => g.options || []);
        const template = getDebugTemplate(bbCodeVersion, {
            selectOptions,
            formData,
            civilianProfile: isCivilian ? civilianProfile : null,
            phmcOptions: flatten(phmcGroupedOptions),
            coronerOptions: flatten(coronerGroupedOptions),
            unrestrictedPhmcOptions: flatten(unrestrictedPhmcGroupedOptions),
            unrestrictedCoronerOptions: flatten(unrestrictedCoronerGroupedOptions),
        });
        if (!template) {
            showNotification('Aucun gabarit de debug pour ce formulaire.', 'info-circle');
            return;
        }
        setFormData(prev => ({ ...prev, ...template }));
        showNotification('Formulaire rempli avec des données de test (debug).', 'check-circle');
    };

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

    // Un civil connecté voit un libellé qui reflète ce qu'il retrouvera en
    // cliquant ; le personnel garde le libellé générique dans tous les
    // contextes. Sur un formulaire de candidature, ce bouton (qui pointe vers
    // savedReports, jamais alimenté par saveJobApplication) est masqué pour un
    // civil — "Mes candidatures" (candidatures) est le seul suivi pertinent
    // là, le garder en plus créait une confusion entre deux boutons dont l'un
    // ne menait jamais à rien.
    const savedReportsButtonLabel = isCivilian ? 'Dossier Patient' : 'Rapports Sauvegardés';

    // Garde du formulaire courant : si le rôle de la personne (ou le profil simulé par un admin) n'y donne pas accès,
    // on bascule sur le premier formulaire autorisé — ex. un membre du DMEC qui avait gardé une consultation en mémoire.
    const { canAccess: canAccessCurrentForm } = useFormAccess();
    useEffect(() => {
        if (authLoading || canAccessCurrentForm(bbCodeVersion)) return;
        const allowed = formDefinitions.filter((form) => canAccessCurrentForm(form.version));
        const fallback = allowed.find((form) => !form.name.startsWith('[Civil]') && !form.isHiddenInSelector && !form.name.includes('(PBC)')) || allowed[0];
        if (fallback) {
            setBbCodeVersion(fallback.version);
            showNotification('Ce formulaire n\'est pas accessible avec votre rôle : bascule sur « ' + fallback.name + ' ».', 'warning');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bbCodeVersion, canAccessCurrentForm, authLoading]);

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
                    // Valeurs dupliquées d'ONBOARDING_STEPS.CIVIL_AUTH / USER_TYPES.CIVILIAN
                    // (voir la déclaration de quickCivilOnboarding ci-dessus pour le pourquoi).
                    initialStep={quickCivilOnboarding ? 'civilAuth' : null}
                    initialUserType={quickCivilOnboarding ? 'civilian' : null}
                />
                <AgencyGroupSelectorModal
                    show={showAgencyGroupSelectorModal && !selectedAgencyGroup && onboardingComplete}
                    onSelectGroup={handleSelectAgencyGroup}
                    onHideSelectorPreference={handleHideAgencyGroupSelectorPreference}
                    physicianRecruitmentDetails={physicianRecruitmentDetails || {}}
                    psychRecruitmentDetails={psychRecruitmentDetails || {}}
                    adminRecruitmentDetails={adminRecruitmentDetails || {}}
                    emsRecruitmentDetails={emsRecruitmentDetails || {}}
                    handleFormSelect={handleAgencySelect}
                    nurseRecruitmentDetails={nurseRecruitmentDetails || {}}
                    coronerRecruitmentDetails={coronerRecruitmentDetails || {}}
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
                    physicianRecruitmentDetails={physicianRecruitmentDetails}
                    psychRecruitmentStatus={psychRecruitmentDetails}
                    adminRecruitmentDetails={adminRecruitmentDetails}
                    emsRecruitmentDetails={emsRecruitmentDetails}
                    nurseRecruitmentDetails={nurseRecruitmentDetails}
                    coronerRecruitmentDetails={coronerRecruitmentDetails}
                    formDefinitions={formDefinitions}
                    userPreferences={userOnboardingPreferences}
                />

                <CctvRequestWebhookModal
                    show={showCctvRequestModal}
                    onHide={handleHideCctvRequestModal}
                    onSubmit={handleCctvWebhookSubmit}
                    showNotification={showNotification}
                    onLogin={handleOpenLogin}
                    onSignup={handleOpenSignup}
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
                        isCivilian={isCivilian}
                    />
                )}

                {/* Simulation « visualiser en tant que » (admin) : rappel + sortie. */}
                <ViewAsBanner />

                {/* Accès rapide (haut gauche) : effets de saison + infobulle du calendrier de la santé en cours. */}
                <div className={`header-info-wrapper header-with-season-controls${immersiveHeaderEnabled ? ' has-immersive-header' : ''}`}>
                    <SeasonControls onOpenCalendar={() => setShowAwarenessCalendar(true)} />
                    {immersiveHeaderEnabled ? <ImmersiveHeader /> : <HeaderInfo commitInfo={commitInfo} />}
                </div>

                {/* Message d'information si restriction employé active */}
                {isRestricted && currentEmployeeName && !isAdmin && (
                    <div style={{
                        backgroundColor: '#1e3a5f',
                        color: '#fff',
                        padding: '10px 20px',
                        margin: '10px 20px',
                        borderRadius: '8px',
                        border: '1px solid #3a5a8f',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap'
                    }}>
                        <i className="fas fa-user-lock" style={{ color: '#4a9eff' }}></i>
                        <span>
                            <strong>Mode Employé:</strong> Vous êtes connecté en tant que <strong>{currentEmployeeName}</strong>. 
                            Les sélecteurs d'employés sont restreints à votre compte uniquement.
                            {' '}<span style={{ fontStyle: 'italic', color: '#ffd700' }}>
                                Si vous ne vous voyez pas dans les listes, 
                                <a 
                                    href="#debug-cache"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const confirmed = window.confirm(
                                            "⚠️ Vider le cache et actualiser\n\n" +
                                            "Cette action va :\n" +
                                            "• Vider le cache local (localStorage)\n" +
                                            "• Vider la session (sessionStorage)\n" +
                                            "• Recharger complètement la page\n\n" +
                                            "Cela permet de synchroniser les données avec Firebase.\n" +
                                            "Utilisez cette fonction si un nouvel employé n'apparaît pas ou si vos modifications ne sont pas visibles.\n\n" +
                                            "Voulez-vous continuer ?"
                                        );
                                        if (confirmed) {
                                            localStorage.clear();
                                            sessionStorage.clear();
                                            window.location.reload();
                                        }
                                    }}
                                    style={{ color: '#4a9eff', textDecoration: 'underline', cursor: 'pointer', marginLeft: '5px' }}
                                >
                                    cliquez ici pour vider le cache
                                </a>
                            </span>
                        </span>
                    </div>
                )}
                
                {/* Message d'information si admin */}
                {isAdmin && currentEmployee && (
                    <div style={{
                        backgroundColor: '#3e2f1f',
                        color: '#fff',
                        padding: '10px 20px',
                        margin: '10px 20px',
                        borderRadius: '8px',
                        border: '1px solid #d4a017',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <i className="fas fa-crown" style={{ color: '#ffd700' }}></i>
                        <span>
                            <strong>Mode Administrateur:</strong> Vous êtes connecté en tant qu'admin <strong>{
                                employeeProfile
                                    ? getEmployeeDisplayName(employeeProfile, currentEmployee.email)
                                    : currentEmployee.email
                            }</strong>. 
                            Vous avez accès à tous les employés et toutes les fonctions.
                        </span>
                    </div>
                )}

                {/* Message d'information si connecté en tant que Civil */}
                {isCivilian && civilianProfile && (
                    <div style={{
                        backgroundColor: isRecruiter ? '#2d1f3a' : '#1f3a2e',
                        color: '#fff',
                        padding: '10px 20px',
                        margin: '10px 20px',
                        borderRadius: '8px',
                        border: `1px solid ${isRecruiter ? '#8957e5' : '#2e7d32'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <i className={`fas ${isRecruiter ? 'fa-user-tie' : 'fa-id-card'}`} style={{ color: isRecruiter ? '#b392f0' : '#66bb6a' }}></i>
                        <span>
                            <strong>{isRecruiter ? 'Connecté en tant que Recruteur :' : 'Connecté en tant que Civil :'}</strong> {
                                civilianProfile.firstName && civilianProfile.lastName
                                    ? `${civilianProfile.firstName} ${civilianProfile.lastName}`
                                    : (civilianProfile.email || '')
                            } (ID patient : <strong>{civilianProfile.patientID}</strong>).
                            Vous pouvez sauvegarder et retrouver vos propres dossiers médicaux et candidatures.
                            {isRecruiter && (
                                <> <strong style={{ color: '#b392f0' }}>En tant que recruteur</strong>, vous gérez en plus les postes et les candidatures depuis la Boîte à Outils (« Gestion du recrutement ») et pouvez créer votre carte de visite.</>
                            )}
                            {isRecruiter && !isContractCandidate && (
                                <> Si un admin ou un autre recruteur vous prépare un contrat, vous le trouverez dans « Mes contrats » (Boîte à outils).</>
                            )}
                            {isContractCandidate && (
                                <> <strong style={{ color: '#58a6ff' }}>Votre contrat vous attend :</strong> lisez-le et signez-le depuis « Mes contrats » (vous pouvez y créer votre signature).{' '}
                                    <Button variant="info" size="sm" className="ms-1" onClick={() => setShowMyContracts(true)}>
                                        <i className="fas fa-file-contract me-1"></i>Mes contrats
                                    </Button>
                                </>
                            )}
                        </span>
                    </div>
                )}

                <div className="container-fluid">
                    <div className="form-container">
                        <div className="button-group">
                            <div className="floating-tools-container">
                                <Dropdown drop="up" show={showToolsDropdown} onToggle={(isOpen) => setShowToolsDropdown(isOpen)}>
                                    <Dropdown.Toggle variant="secondary" id="dropdown-tools">
                                        <i className="fas fa-tools"></i> Boite à Outils
                                    </Dropdown.Toggle>

                                    <Dropdown.Menu>
                                        {currentEmployee ? (
                                            <>
                                                <Dropdown.Header>
                                                    <i className="fas fa-user-circle"></i> {
                                        employeeProfile
                                            ? getEmployeeDisplayName(employeeProfile, currentEmployee.email)
                                            : (civilianProfile
                                                ? (civilianProfile.firstName && civilianProfile.lastName
                                                    ? `${civilianProfile.firstName} ${civilianProfile.lastName}`
                                                    : (civilianProfile.email || currentEmployee.email))
                                                : currentEmployee.email)
                                    }
                                                    {isAdmin && <span style={{marginLeft: '5px', color: '#ffc107'}}><i className="fas fa-crown"></i> Admin</span>}
                                                    {isCivilian && <span style={{marginLeft: '5px', color: '#66bb6a'}}><i className="fas fa-id-card"></i> Civil</span>}
                                                </Dropdown.Header>
                                                <Dropdown.Divider />
                                            </>
                                        ) : null}
                                        {/* "Gérer le Personnel" déplacé dans le Panneau Admin (section
                                            Utilisateurs) — la modale reste montée ci-dessous pour les
                                            boutons "Nom manquant ?" des formulaires (setShowEmployeeModal),
                                            un usage self-service distinct de la gestion admin complète. */}
                                        {/* Menu organisé en catégories ; une catégorie sans entrée visible pour le rôle
                                            de la personne (visiteur, civil, candidat, recruteur, personnel, admin) n'est
                                            pas affichée, ni son séparateur. */}
                                        {(() => {
                                            const closeAnd = (action) => () => { action(); setShowToolsDropdown(false); };
                                            const handleClearCache = () => {
                                                const confirmed = window.confirm(
                                                    "\u26a0\ufe0f Vider le cache et actualiser\n\n" +
                                                    "Cette action va :\n" +
                                                    "\u2022 Vider le cache local (localStorage)\n" +
                                                    "\u2022 Vider la session (sessionStorage)\n" +
                                                    "\u2022 Recharger complètement la page\n\n" +
                                                    "Cela permet de synchroniser les données avec Firebase.\n" +
                                                    "Utilisez cette fonction si :\n" +
                                                    "  - Un nouvel employé n'apparaît pas dans les listes\n" +
                                                    "  - Vos modifications ne sont pas visibles\n" +
                                                    "  - Les données semblent obsolètes\n\n" +
                                                    "Voulez-vous continuer ?"
                                                );
                                                if (confirmed) {
                                                    localStorage.clear();
                                                    sessionStorage.clear();
                                                    window.location.reload();
                                                }
                                            };
                                            const sections = [
                                                {
                                                    key: 'account', label: 'Mon espace', items: [
                                                        toolAccess.myProfile && { key: 'profile', icon: 'fas fa-id-badge', label: 'Mon profil', onClick: closeAnd(() => setShowMyProfile(true)) },
                                                        toolAccess.myContracts && { key: 'contracts', icon: 'fas fa-file-contract', label: 'Mes contrats', onClick: closeAnd(() => setShowMyContracts(true)) },
                                                        toolAccess.myPatientFile && { key: 'myfile', icon: 'fas fa-user-injured', label: 'Mon dossier patient', onClick: closeAnd(() => setShowMyPatientFile(true)) },
                                                    ],
                                                },
                                                {
                                                    key: 'reports', label: 'Rapports & dossiers', items: [
                                                        // Sans compte connecté il n'y a aucun rapport à retrouver : on ne l'affiche pas.
                                                        toolAccess.savedReports && { key: 'saved', icon: 'fas fa-save', label: savedReportsButtonLabel, onClick: closeAnd(toggleSavedReports) },
                                                        toolAccess.patientDossier && { key: 'dossier', icon: 'fas fa-folder-open', label: 'Dossier Patient', onClick: closeAnd(() => setShowPatientDossierModal(true)) },
                                                    ],
                                                },
                                                {
                                                    // Outils réservés : recrutement (admins + recruteurs), formulaire AMA (médecins PHMC + admins).
                                                    key: 'work', label: 'Gestion & outils métier', items: [
                                                        toolAccess.recruitment && { key: 'recruitment', icon: 'fas fa-user-plus', label: 'Gestion du recrutement', onClick: closeAnd(() => setShowRecruitmentManager(true)) },
                                                        toolAccess.ama && { key: 'ama', icon: 'fa-solid fa-truck-medical', label: 'EMS Contre Avis Médical', onClick: closeAnd(() => setShowEmsAmaModal(prev => !prev)) },
                                                    ],
                                                },
                                                {
                                                    key: 'info', label: 'Santé & informations', items: [
                                                        { key: 'calendar', icon: 'fas fa-calendar-alt', label: 'Calendrier de la santé', onClick: closeAnd(() => setShowAwarenessCalendar(true)) },
                                                    ],
                                                },
                                                {
                                                    key: 'app', label: 'Application', items: [
                                                        { key: 'season', icon: `fas ${seasonalEffectsEnabled ? 'fa-snowflake' : 'fa-sun'}`, label: `${seasonalEffectsEnabled ? 'Désactiver' : 'Activer'} Effet de Saison`, onClick: closeAnd(toggleSeasonalEffects) },
                                                        { key: 'guide', icon: 'fas fa-play-circle', label: 'Guide de Configuration', onClick: closeAnd(restartOnboarding) },
                                                        { key: 'header', icon: immersiveHeaderEnabled ? 'fas fa-heart' : 'fas fa-city', label: immersiveHeaderEnabled ? 'Header des remerciements' : 'Header immersif (heure & météo)', onClick: closeAnd(toggleImmersiveHeader) },
                                                        { key: 'bug', icon: 'fas fa-bug', label: 'Rapport de Bug', onClick: closeAnd(() => { setFeatureModalMode('bug'); setShowFeatureRequestModal(true); }) },
                                                        // La demande de fonctionnalité est réservée aux comptes connectés (tous rôles).
                                                        currentEmployee && { key: 'feature', icon: 'fas fa-lightbulb', label: 'Demande de Fonctionnalité', onClick: closeAnd(() => { setFeatureModalMode('feature'); setShowFeatureRequestModal(true); }) },
                                                        {
                                                            key: 'agency', icon: 'fas fa-users', label: 'Changer de Formulaire', onClick: closeAnd(() => {
                                                                localStorage.removeItem('selectedAgencyGroup');
                                                                setSelectedAgencyGroup(null);
                                                                setShowAgencyGroupSelectorModal(true);
                                                            }),
                                                        },
                                                    ],
                                                },
                                                {
                                                    key: 'session', label: 'Session', items: [
                                                        { key: 'cache', icon: 'fas fa-sync-alt', label: 'Vider le Cache & Actualiser', onClick: closeAnd(handleClearCache), style: { color: '#dc3545' } },
                                                        currentEmployee && { key: 'logout', icon: 'fas fa-sign-out-alt', label: 'Déconnexion', onClick: handleEmployeeLogout },
                                                    ],
                                                },
                                            ]
                                                .map((section) => ({ ...section, items: section.items.filter(Boolean) }))
                                                .filter((section) => section.items.length > 0);

                                            return sections.map((section, index) => (
                                                <Fragment key={section.key}>
                                                    {index > 0 && <Dropdown.Divider />}
                                                    <Dropdown.Header style={{ textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.06em', paddingBottom: '2px' }}>
                                                        {section.label}
                                                    </Dropdown.Header>
                                                    {section.items.map((item) => (
                                                        <Dropdown.Item key={item.key} onClick={item.onClick} style={item.style}>
                                                            <i className={item.icon}></i> {item.label}
                                                        </Dropdown.Item>
                                                    ))}
                                                </Fragment>
                                            ));
                                        })()}
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>

                            <FeatureRequestModal
                                mode={currentEmployee ? featureModalMode : 'bug'}
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

                            {/* Carte de visite ET signature (même fenêtre, deux onglets) : personnel, admins et recruteurs. */}
                            {toolAccess.businessCard && (
                                <Button
                                    variant="secondary"
                                    type="button"
                                    className="changelog-button"
                                    onClick={() => setShowBusinessCard(prev => !prev)}
                                >
                                    <i className="fa-solid fa-address-card"></i>
                                    Carte de Visite &amp; Signature
                                </Button>
                            )}

                            {bbcodeEnabled && (
<Button
                                variant="secondary"
                                type="button"
                                className="changelog-button"
                                onClick={() => setShowBbcodeToMarkdown(true)}
                                title="Convertir du BBcode en Markdown Discord"
                            >
                                <i className="fab fa-discord" style={{ color: '#5865F2' }}></i>
                                BBcode → Discord
                            </Button>
)}

                            {(() => {
                                if (selectedAgencyGroup === 'PHMC Recruitment' && formData.recruitmentPosition) {

                                    let currentRecruitmentDetailsSource = null;
                                    let positionDisplayNameForTitle = formData.recruitmentPosition || 'selected position';
                                    const currentFormDef = getFormDefinition(bbCodeVersion);

                                    if (currentFormDef?.titleKey === "phmcCarrieresMedicales") {
                                        currentRecruitmentDetailsSource = physicianRecruitmentDetails;
                                    } else if (currentFormDef?.titleKey === "phmcCarrieresPsychologue") {
                                        currentRecruitmentDetailsSource = psychRecruitmentDetails;
                                    } else if (currentFormDef?.titleKey === "phmcCarrieresAdministration") {
                                        currentRecruitmentDetailsSource = adminRecruitmentDetails;
                                    } else if (currentFormDef?.titleKey === "phmcCarrieresInfirmieres") {
                                        currentRecruitmentDetailsSource = nurseRecruitmentDetails;
                                    } else if (currentFormDef?.titleKey === "phmcCarrieresEMS") {
                                        currentRecruitmentDetailsSource = emsRecruitmentDetails;
                                    } else if (currentFormDef?.titleKey === "phmcCarrieresDMEC") {
                                        currentRecruitmentDetailsSource = coronerRecruitmentDetails;
                                    }

                                    if (currentRecruitmentDetailsSource && currentRecruitmentDetailsSource[formData.recruitmentPosition]) {
                                        positionDisplayNameForTitle = currentRecruitmentDetailsSource[formData.recruitmentPosition].nom || formData.recruitmentPosition;
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

                            {/* Mode debug : visible seulement si un admin l'a activé (voir DebugContext). */}
                            {FieldComponent && currentEmployee && hasDebugTemplate(bbCodeVersion) && (
                                <DebugFillButton onFill={handleDebugFill} className="changelog-button" />
                            )}
                        </div>

                        {/* Quand on quitte un champ « ID patient », on le complète : 2752 → PHMC-2752. */}
                        <form onBlur={(event) => {
                            const field = event.target;
                            if (field && field.name === 'patientID' && field.value && field.value.trim()) {
                                const completed = canonicalPatientId(field.value);
                                if (completed && completed !== field.value) {
                                    handleChange({ target: { name: 'patientID', value: completed, type: 'text' } });
                                }
                            }
                        }}> 
                            <Suspense fallback={<LoadingSpinner />}>
                                {FieldComponent && currentEmployee ? (
                                    <FieldComponent
                                        bbCodeVersion={bbCodeVersion}
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
                                        unrestrictedPhmcGroupedOptions={unrestrictedPhmcGroupedOptions}
                                        unrestrictedCoronerGroupedOptions={unrestrictedCoronerGroupedOptions}
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
                                        lab={mergeResultOptions(optionize(selectOptions.lab), LAB_RESULT_ADDITIONS)}
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
                                        XrayResults={mergeResultOptions(optionize(selectOptions.XrayResults), IMAGING_RESULT_ADDITIONS.XrayResults)}
                                        ctResults={mergeResultOptions(optionize(selectOptions.ctResults), IMAGING_RESULT_ADDITIONS.ctResults)}
                                        mriResults={mergeResultOptions(optionize(selectOptions.mriResults), IMAGING_RESULT_ADDITIONS.mriResults)}
                                        ultrasoundResults={mergeResultOptions(optionize(selectOptions.ultrasoundResults), IMAGING_RESULT_ADDITIONS.ultrasoundResults)}
                                        otherResults={mergeResultOptions(optionize(selectOptions.otherResults), IMAGING_RESULT_ADDITIONS.otherResults)}
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
                                ) : !currentEmployee ? (
                                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                                        <i className="fas fa-lock" style={{ fontSize: '3rem', marginBottom: '20px', opacity: 0.6 }}></i>
                                        <h4>Connexion requise</h4>
                                        <p>Vous devez être connecté (Personnel PHMC/DMEC ou Civil) pour remplir un formulaire.</p>
                                        <p style={{ maxWidth: '520px', margin: '0 auto 18px' }}>
                                            <strong>Première visite ?</strong> Cliquez sur <strong>« Créer un compte »</strong> : le
                                            {' '}<strong>Guide de Configuration</strong> vous accompagne pas à pas (personnage GTA World, vérification de
                                            votre e-mail Eyefind Mail, préférences). Vous avez déjà un compte ? Utilisez « Se connecter ».
                                        </p>
                                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <Button variant="success" size="lg" onClick={handleOpenSignup}>
                                                <i className="fas fa-user-plus"></i> Créer un compte (Guide de Configuration)
                                            </Button>
                                            <Button
                                                variant="primary"
                                                size="lg"
                                                onClick={handleOpenLogin}
                                                style={{ border: '2px solid #58a6ff', boxShadow: '0 0 0 3px rgba(88, 166, 255, 0.35), 0 0 14px rgba(88, 166, 255, 0.45)', fontWeight: 600 }}
                                            >
                                                <i className="fas fa-sign-in-alt"></i> Se connecter
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p>Veuillez sélectionner une agence, puis un type de formulaire.</p>
                                )}
                            </Suspense>
                            {currentEmployee && (
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
                            )}
                        </form>
                    </div>
                    
                    <div className="output-container">
                        <div className="floating-admin-button-container">
                            {/* Bingo : réservé au personnel (voir getToolAccess). */}
                            {toolAccess.bingo && (
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
                            )}
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
                            adminRecruitmentDetails={adminRecruitmentDetails || {}}
                            emsRecruitmentDetails={emsRecruitmentDetails || {}}
                            nurseRecruitmentDetails={nurseRecruitmentDetails || {}}
                            coronerRecruitmentDetails={coronerRecruitmentDetails || {}}
                        />

                        {toolAccess.bingo && (
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
                        )}

                        <EmployeeLoginModal
                            show={showLoginModal}
                            onHide={() => setShowLoginModal(false)}
                            onSuccess={handleLoginSuccess}
                            onCreateAccount={handleOpenSignup}
                        />

                        <ForumCopyNoticeModal
                            kind={forumNotice || 'bbcode'}
                            show={!!forumNotice}
                            onHide={() => setForumNotice(null)}
                            onDownloadHtml={handleDownloadHtml}
                        />

                        <Modal show={!!accountChoices} onHide={() => setAccountChoices(null)} centered>
                            <Modal.Header closeButton style={{ backgroundColor: '#1a1a1a', color: '#fff', borderBottom: '1px solid #444' }}>
                                <Modal.Title>
                                    <i className="fas fa-users" style={{ marginRight: '10px' }}></i>
                                    Quel compte utiliser ?
                                </Modal.Title>
                            </Modal.Header>
                            <Modal.Body style={{ backgroundColor: '#2a2a2a', color: '#fff' }}>
                                <p>Plusieurs comptes sont liés à votre compte GTA World. Choisissez celui avec lequel vous connecter :</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {(accountChoices || []).map((choice, index) => (
                                        <button
                                            type="button"
                                            key={index}
                                            onClick={() => handleChooseAccount(choice)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                backgroundColor: '#1a1a1a',
                                                border: `1px solid ${choice.accountType === 'civilian' ? '#2e7d32' : '#007bff'}`,
                                                borderRadius: '8px', padding: '14px', color: '#fff', cursor: 'pointer', textAlign: 'left'
                                            }}
                                        >
                                            <i className={`fas ${choice.accountType === 'civilian' ? 'fa-id-card' : 'fa-user-md'}`} style={{ fontSize: '1.3rem' }}></i>
                                            <span>
                                                <strong style={{ display: 'block' }}>{choice.label || 'Compte'}</strong>
                                                <span style={{ fontSize: '0.85em', color: '#ccc' }}>
                                                    {choice.accountType === 'civilian' ? 'Civil' : (choice.accountType === 'coroner' ? 'Personnel DMEC' : 'Personnel PHMC')}
                                                </span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </Modal.Body>
                        </Modal>

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
                            isAdminAuthenticated={formData.isAdminAuthenticated}
                            adminUserEmail={formData.adminUserEmail}
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

                            {/* Sans compte connecté : ni titre, ni BBCode, ni boutons de copie / sauvegarde. */}
                            {!currentEmployee ? (
                                <p style={{ textAlign: 'center', opacity: 0.75, padding: '30px 10px' }}>
                                    <i className="fas fa-lock" style={{ marginRight: '8px' }}></i>
                                    {bbcodeEnabled
                                        ? 'Connectez-vous pour afficher et copier le titre et le BBCode.'
                                        : "Connectez-vous pour remplir un formulaire, voir l'aperçu et télécharger le HTML."}
                                </p>
                            ) : (
                                <>
                                    <div className="modern-output-controls">
                                        {bbcodeEnabled && (
<Button
                                            type="button"
                                            onClick={() => setShowBBCode(prev => !prev)}
                                            className="control-button"
                                        >
                                            <i className={`fas ${showBBCode ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                            {showBBCode ? 'Cacher BBCode' : 'Montrer BBCode'}
                                        </Button>
)}
                                        <Button
                                            type="button"
                                            onClick={() => setShowPreview(prev => !prev)}
                                            className="control-button"
                                            title="Afficher le rapport tel qu'il apparaîtra sur le forum, sous les boutons de copie"
                                        >
                                            <i className={`fas ${showPreview ? 'fa-eye-slash' : 'fa-image'}`}></i>
                                            {showPreview ? "Cacher l'aperçu" : 'Aperçu'}
                                        </Button>
                                        {!(isCivilian && selectedAgencyGroup === 'PHMC Recruitment') && (
                                            <Button
                                                type="button"
                                                onClick={toggleSavedReports}
                                                className="control-button"
                                            >
                                                <i className="fas fa-save"></i>
                                                {savedReportsButtonLabel}
                                            </Button>
                                        )}
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

                                        {bbcodeEnabled && (
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
)}

                                {/* Export HTML : à coller en texte enrichi sur le forum GTA World (et PHMC). */}
                                <Button
                                    type="button"
                                    onClick={handleDownloadHtml}
                                    className="copy-button-modern"
                                    disabled={isLockdownActive || !getBBCodeContent()}
                                    title={isLockdownActive ? 'Le téléchargement est désactivé pendant le confinement du site' : 'Télécharge le rapport mis en page, à copier-coller sur le forum'}
                                >
                                    <i className="fas fa-file-code"></i>
                                    Télécharger le HTML
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline-light"
                                    onClick={() => openForumNotice('html', true)}
                                    aria-label="Comment publier le HTML sur le forum ?"
                                    title="Comment publier le HTML sur le forum ?"
                                >
                                    <i className="fas fa-circle-question"></i>
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => handleExportDocument('pdf')}
                                    className="copy-button-modern"
                                    disabled={isLockdownActive || !getBBCodeContent()}
                                    title="Imprime le rapport en A4 : choisissez « Enregistrer au format PDF » (texte vectoriel, net à tout zoom)"
                                >
                                    <i className="fas fa-file-pdf"></i>
                                    PDF (A4)
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => handleExportDocument('svg')}
                                    className="copy-button-modern"
                                    disabled={isLockdownActive || !getBBCodeContent()}
                                    title="Télécharge le rapport en image vectorielle (SVG), zoomable sans perte dans un navigateur"
                                >
                                    <i className="fas fa-bezier-curve"></i>
                                    SVG
                                </Button>

                                        {selectedAgencyGroup !== 'PHMC Recruitment' && (
                                            <Button
                                                type="button"
                                                onClick={handleSaveReportWrapper}
                                                className="copy-button-modern"
                                                disabled={isLockdownActive}
                                                title={isLockdownActive ? 'La sauvegarde des rapports est désactivée pendant le confinement du site' : ''}
                                            >
                                                <i className="fas fa-save"></i>
                                                {isCivilian ? 'Sauvegarder le dossier' : 'Sauvegarder le rapport'}
                                            </Button>
                                        )}

                                        {/* Pipeline de candidatures (Lot 6) : un Civil sur un formulaire de
                                            candidature a le choix entre garder un brouillon et candidater
                                            réellement (accusé de réception + notification admin). */}
                                        {selectedAgencyGroup === 'PHMC Recruitment' && isCivilian && (
                                            <>
                                                <Button
                                                    type="button"
                                                    onClick={() => saveJobApplication('save')}
                                                    className="copy-button-modern"
                                                    disabled={isLockdownActive}
                                                >
                                                    <i className="fas fa-save"></i>
                                                    Enregistrer
                                                </Button>
                                                <Button
                                                    type="button"
                                                    onClick={() => saveJobApplication('submit')}
                                                    className="copy-button-modern"
                                                    disabled={isLockdownActive}
                                                >
                                                    <i className="fas fa-paper-plane"></i>
                                                    Enregistrer et Candidater
                                                </Button>
                                                <Button
                                                    type="button"
                                                    onClick={() => { loadMyJobApplications(); setShowMyJobApplications(true); }}
                                                    className="copy-button-modern"
                                                >
                                                    <i className="fas fa-list-check"></i>
                                                    Mes candidatures
                                                </Button>
                                            </>
                                        )}
                                    </div>

                                    {showPreview && (
                                        <div style={{ margin: '14px auto 0', maxWidth: '980px' }}>
                                            <ReportPreviewFrame bbCode={getBBCodeContent()} title={generateTitle()} height={520} />
                                        </div>
                                    )}

                                    {bbcodeEnabled && showBBCode && (
                                        <pre className="bbcode-output">
                                            {getBBCodeContent()}
                                        </pre>
                                    )}
                                </>
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

                        {/* Carte de visite : accessible depuis TOUS les groupes (PHMC, DMEC, recrutement…). */}
                        {toolAccess.businessCard && (
                            <BusinessCardModal
                                show={showBusinessCard}
                                onHide={() => setShowBusinessCard(false)}
                                showNotification={showNotification}
                                commitInfo={commitInfo}
                                handleImageUpload={handleImageUpload}
                                uploadImageDetailed={uploadImageDetailed}
                                uid={currentEmployee?.uid || null}
                                defaultName={staffName || ''}
                            />
                        )}

                        <SwitchableFormsModal
                            show={showPHMCModal}
                            onHide={() => setShowPHMCModal(false)}
                            title={switchableModalTitle}
                            forms={switchableFormsList}
                            handleFormSelect={handleAgencySelect}
                            isMobile={isMobile}
                            physicianRecruitmentDetails={physicianRecruitmentDetails}
                            psychRecruitmentStatus={psychRecruitmentDetails}
                            formDefinitions={formDefinitions}
                            adminRecruitmentDetails={adminRecruitmentDetails || {}}
                            nurseRecruitmentDetails={nurseRecruitmentDetails || {}}
                            coronerRecruitmentDetails={coronerRecruitmentDetails || {}}
                            emsRecruitmentDetails={emsRecruitmentDetails || {}}
                            userPreferences={userOnboardingPreferences}
                        />

                        <SavedReportsModal
                            show={showSavedReports}
                            onHide={closeSavedReports}
                            onClose={closeSavedReports}
                            savedReports={savedReports}
                            reportsForSelectedUser={savedReports}
                            loadReport={loadReportForUser}
                            deleteReportsForUser={deleteReportsForUser}
                            loadSharedReportsForPatient={loadSharedReportsForPatient}
                            shareReportWithPatient={shareReportWithPatient}
                            copyReportToOwnAccount={copyReportToOwnAccount}
                            author={getCurrentReportAuthor(formData)}
                            isLoading={isLoadingUserReports}
                            onAttachReportSelectedForAttachment={handleReportSelectedForAttachment}
                            reportSelectionFilter={reportSelectionFilter}
                            // Mode « joindre » (certificat médical) : seuls les rapports acceptés sont listés.
                            filterByBbCodeVersions={reportSelectionFilter}
                            attachMode={!!reportSelectionFilter}
                            versionNames={versionNames}
                            onEmployeeSelect={(employeeValue) => {
                                if (employeeValue) {
                                    return loadUserSavedReports(employeeValue);
                                }
                                return Promise.resolve();
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
                        <PatientDossierModal
                            show={showPatientDossierModal}
                            onHide={() => setShowPatientDossierModal(false)}
                            showNotification={showNotification}
                            shareReportWithPatient={shareReportWithPatient}
                            copyReportToOwnAccount={copyReportToOwnAccount}
                            loadReport={loadReportForUser}
                            deleteReportsForUser={deleteReportsForUser}
                        />
                        <RecruitmentManager
                            show={showRecruitmentManager}
                            onHide={() => setShowRecruitmentManager(false)}
                            showNotification={showNotification}
                        />
                        <AwarenessCalendarModal
                            show={showAwarenessCalendar}
                            onHide={() => setShowAwarenessCalendar(false)}
                        />
                        <MyContractsModal
                            show={showMyContracts}
                            onHide={() => setShowMyContracts(false)}
                            showNotification={showNotification}
                            uploadImageDetailed={uploadImageDetailed}
                        />
                        <MyProfileModal
                            show={showMyProfile}
                            onHide={() => setShowMyProfile(false)}
                            showNotification={showNotification}
                        />
                        <PatientInvoiceNotifier showNotification={showNotification} />
                        <MyPatientFileModal
                            show={showMyPatientFile}
                            onHide={() => setShowMyPatientFile(false)}
                            showNotification={showNotification}
                        />
                        <MyJobApplicationsModal
                            show={showMyJobApplications}
                            onHide={() => setShowMyJobApplications(false)}
                            applications={myJobApplications}
                            isLoading={isLoadingJobApplications}
                            showNotification={showNotification}
                            onDeleted={() => loadMyJobApplications()}
                            onLoad={(application) => {
                                if (loadApplicationIntoForm(application)) setShowMyJobApplications(false);
                            }}
                            onUpdateStatus={async (applicantUid, applicationId, newStatus) => {
                                const result = await updateJobApplicationStatus(applicantUid, applicationId, newStatus);
                                if (result?.success) {
                                    loadMyJobApplications();
                                }
                                return result;
                            }}
                        />
                        <SaveAsEmployeeModal
                            show={showSaveAsEmployeeModal}
                            onHide={() => setShowSaveAsEmployeeModal(false)}
                            employeeOptions={combinedStaffOptions}
                            onConfirm={handleConfirmSaveAsEmployee}
                        />
                    </div>
                </div>
                <BbcodeToMarkdownModal
                    show={showBbcodeToMarkdown}
                    onHide={() => setShowBbcodeToMarkdown(false)}
                    showNotification={showNotification}
                />
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
        fleecaPaymentId: '',
        autopsyPaymentLink: '',
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
        applicantPhone: '',
        applicantEmail: '',
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
