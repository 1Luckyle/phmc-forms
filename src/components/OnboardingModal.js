// src/components/OnboardingModal.js
import { useState, useEffect } from 'react';
import { Button, Form } from 'react-bootstrap';
import { formDefinitions } from '../formDefinitions';
import { database } from '../firebase';
import { ref, get, set } from 'firebase/database';
import { useWebhooks } from '../hooks/useWebhooks';
import * as Sentry from "@sentry/react";

// Step definitions for the onboarding flow
const ONBOARDING_STEPS = {
    WELCOME: 'welcome',
    USER_TYPE: 'userType',
    ROLE_SPECIFIC: 'roleSpecific',
    FORM_PREVIEW: 'formPreview',
    PRIVACY_POLICY: 'privacyPolicy',
    COMPLETE: 'complete'
};

// User type categories
const USER_TYPES = {
    CIVILIAN: 'civilian',
    PHMC_STAFF: 'phmcStaff',
    CORONER: 'coroner',
    RECRUITMENT: 'recruitment',
    OTHER: 'other'
};

// Form categories for each user type
const FORM_CATEGORIES = {
    [USER_TYPES.CIVILIAN]: ['PHMC'],
    [USER_TYPES.PHMC_STAFF]: ['PHMC'],
    [USER_TYPES.CORONER]: ['PHMC'],
    [USER_TYPES.RECRUITMENT]: ['PHMC Recruitment'],
    [USER_TYPES.OTHER]: ['PHMC', 'PHMC Recruitment']
};

// Recommended forms for each user type
const RECOMMENDED_FORMS = {
    [USER_TYPES.CIVILIAN]: [24, 25, 3, 26], // Medical Release, Basic Patient File, Advanced Patient File
    [USER_TYPES.PHMC_STAFF]: [ 5, 6, 14, 19, 20, 22, 27], // Forensic Services, Surgical Ops, Physical Eval, ER Protocol, General Consultation
    [USER_TYPES.CORONER]: [1, 2, 4, 8, 11, 37, 27], // Forensic Services, Coroner Email, Autopsy, Certificate, Mass Fatality
    [USER_TYPES.RECRUITMENT]: [50, 51, 52, 53, 54, 55], // All recruitment forms
    [USER_TYPES.OTHER]: 'ALL_FORMS' // Show all available forms
};

// Utility function to ensure a value is an array
const ensureArray = (v) => (Array.isArray(v) ? v : v ? Object.values(v) : []);

const OnboardingModal = ({ 
    show, 
    onComplete, 
    onSkip,
    formDefinitions: formDefs = formDefinitions,
    showNotification = () => {}, // Add showNotification prop with default fallback
    phmcList = [], // Add phmcList prop
    coronerList = [] // Add coronerList prop
}) => {
    // Initialize webhook functions
    const { logWebhookToFirebase } = useWebhooks({}, { sha: 'onboarding' }, showNotification);
    const [currentStep, setCurrentStep] = useState(ONBOARDING_STEPS.WELCOME);
    const [selectedUserType, setSelectedUserType] = useState(null);
    const [selectedRole, setSelectedRole] = useState(null);
    const [recommendedForms, setRecommendedForms] = useState([]);
    const [showAccountCreation, setShowAccountCreation] = useState(false);
    const [accountData, setAccountData] = useState({
        firstName: '',
        lastName: '',
        discord: '',
        rank: '',
        badge: '',
        phNumber: ''
    });
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [accountCreated, setAccountCreated] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (show) {
            setCurrentStep(ONBOARDING_STEPS.WELCOME);
            setSelectedUserType(null);
            setSelectedRole(null);
            setRecommendedForms([]);
            setShowAccountCreation(false);
            setShowLogin(false);
            setSelectedEmployeeId('');
            setLoggedIn(false);
            setAccountData({
                firstName: '',
                lastName: '',
                discord: '',
                rank: '',
                badge: '',
                phNumber: ''
            });
            setIsCreatingAccount(false);
            setAccountCreated(false);
        }
    }, [show]);

    // Update recommended forms when user type changes
    useEffect(() => {
        if (selectedUserType) {
            const formIds = RECOMMENDED_FORMS[selectedUserType];
            if (formIds === 'ALL_FORMS') {
                // For OTHER user type, show all forms
                setRecommendedForms(formDefs);
            } else {
                const forms = formIds?.map(id => formDefs.find(form => form.version === id)).filter(Boolean) || [];
                setRecommendedForms(forms);
            }
        }
    }, [selectedUserType, formDefs]);

    const handleNext = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.WELCOME:
                setCurrentStep(ONBOARDING_STEPS.USER_TYPE);
                break;
            case ONBOARDING_STEPS.USER_TYPE:
                if (selectedUserType === USER_TYPES.PHMC_STAFF || selectedUserType === USER_TYPES.CORONER) {
                    setCurrentStep(ONBOARDING_STEPS.ROLE_SPECIFIC);
                } else {
                    setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
                }
                break;
            case ONBOARDING_STEPS.ROLE_SPECIFIC:
                setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
                break;
            case ONBOARDING_STEPS.FORM_PREVIEW:
                setCurrentStep(ONBOARDING_STEPS.PRIVACY_POLICY);
                break;
            case ONBOARDING_STEPS.PRIVACY_POLICY:
                setCurrentStep(ONBOARDING_STEPS.COMPLETE);
                break;
            case ONBOARDING_STEPS.COMPLETE:
                handleComplete();
                break;
            default:
                break;
        }
    };

    const handleBack = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.USER_TYPE:
                setCurrentStep(ONBOARDING_STEPS.WELCOME);
                break;
            case ONBOARDING_STEPS.ROLE_SPECIFIC:
                setCurrentStep(ONBOARDING_STEPS.USER_TYPE);
                break;
            case ONBOARDING_STEPS.FORM_PREVIEW:
                if (selectedUserType === USER_TYPES.PHMC_STAFF || selectedUserType === USER_TYPES.CORONER) {
                    setCurrentStep(ONBOARDING_STEPS.ROLE_SPECIFIC);
                } else {
                    setCurrentStep(ONBOARDING_STEPS.USER_TYPE);
                }
                break;
            case ONBOARDING_STEPS.PRIVACY_POLICY:
                setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
                break;
            case ONBOARDING_STEPS.COMPLETE:
                setCurrentStep(ONBOARDING_STEPS.PRIVACY_POLICY);
                break;
            default:
                break;
        }
    };

    const handleComplete = () => {
        // Get logged-in user data if available
        const loggedInUser = loggedIn ? 
            [...ensureArray(phmcList), ...ensureArray(coronerList)].find(emp => emp.name === selectedEmployeeId) : null;
        
        // Determine default form based on user type and role
        let defaultForm = 1; // Default fallback
        if (selectedUserType === USER_TYPES.CIVILIAN) {
            defaultForm = 24; // Medical Release Form
        } else if (selectedUserType === USER_TYPES.PHMC_STAFF) {
            defaultForm = selectedRole === 'physician' ? 5 : // Surgical Ops for physicians
                         selectedRole === 'nurse' ? 6 : // Physical Evaluation for nurses
                         selectedRole === 'ems' ? 19 : // ER Protocol for EMS
                         selectedRole === 'psych' ? 14 : // Mental Health for psych
                         20; // General Consultation for others
        } else if (selectedUserType === USER_TYPES.CORONER) {
            defaultForm = 1; // Forensic Services
        } else if (selectedUserType === USER_TYPES.RECRUITMENT) {
            defaultForm = 50; // Physician recruitment (first recruitment form)
        }
            
        const preferences = {
            userType: selectedUserType,
            role: selectedRole,
            recommendedForms: recommendedForms.map(form => form.version),
            allowedCategories: FORM_CATEGORIES[selectedUserType] || ['PHMC', 'PHMC Recruitment'],
            onboardingComplete: true,
            completedAt: new Date().toISOString(),
            defaultForm: defaultForm,
            // Include user account info if logged in or account created
            ...(loggedInUser && { 
                userAccount: {
                    name: loggedInUser.name,
                    category: loggedInUser.category || loggedInUser.rank,
                    type: selectedUserType === USER_TYPES.CORONER ? 'coroner' : 'phmc'
                }
            }),
            ...(accountCreated && {
                accountCreated: true,
                newAccount: true
            })
        };

        // Save preferences to localStorage
        localStorage.setItem('userOnboardingPreferences', JSON.stringify(preferences));
        localStorage.setItem('onboardingComplete', 'true');

        // Send webhook notification for onboarding completion
        sendOnboardingCompletionWebhook(preferences);

        // Call completion callback
        onComplete(preferences);
    };

    const sendOnboardingCompletionWebhook = async (preferences) => {
        try {
            const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
            if (!webhookURL) {
                console.warn('Dev webhook URL not configured for onboarding notifications.');
                return;
            }

            const embed = {
                title: "🎯 Intégration de l'utilisateur terminée",
                color: 0x28a745, // Green color for success
                fields: [
                    { name: "Type d'utilisateur", value: getUserTypeLabel(preferences.userType), inline: true },
                    { name: "Rôle", value: preferences.role ? getRoleLabel(preferences.role) : 'Non spécifié', inline: true },
                    { name: "Formulaires recommandés", value: `${preferences.recommendedForms.length} formulaires`, inline: true },
                    { name: "Accès aux catégories", value: preferences.allowedCategories.join(', '), inline: false },
                    { name: "Statut du compte", value: preferences.userAccount ? 'Connecté' : (preferences.accountCreated ? 'Compte créé' : 'Pas de compte'), inline: true },
                    ...(preferences.userAccount ? [{ name: "Compte utilisateur", value: `${preferences.userAccount.name} (${preferences.userAccount.category})`, inline: true }] : [])
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: "Formulaires PHMC-FR - Système d'intégration"
                }
            };

            const payload = {
                username: "Bot d'Intégration",
                embeds: [embed]
            };

            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('Onboarding completion webhook sent successfully');
                // Log to Firebase
                await logWebhookToFirebase('onboarding_completion', payload);
            } else {
                console.error('Failed to send onboarding completion webhook:', response.status);
            }
        } catch (error) {
            console.error('Error sending onboarding completion webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Onboarding Completion Webhook' } });
        }
    };

    const handleSkip = () => {
        localStorage.setItem('onboardingComplete', 'true');
        localStorage.setItem('onboardingSkipped', 'true');
        onSkip();
    };

    const handleAccountDataChange = (e) => {
        setAccountData({
            ...accountData,
            [e.target.name]: e.target.value
        });
    };

    const handleCreateAccount = async () => {
        setIsCreatingAccount(true);
        try {
            const isCoroner = selectedUserType === USER_TYPES.CORONER;
            const requiredFields = isCoroner
                ? ['Prénom', 'discord', 'rang', 'badge']
                : ['Prénom', 'Nom', 'rang'];

            const emptyFields = requiredFields.filter(field => !accountData[field]?.trim());
            if (emptyFields.length > 0) {
                showNotification(`Veuillez remplir tous les champs requis : ${emptyFields.join(', ')}`, 'warning');
                setIsCreatingAccount(false);
                return;
            }

            const newStaffMemberName = isCoroner 
                ? accountData.firstName
                : `${accountData.firstName} ${accountData.lastName}`.trim();

            const newStaffMember = isCoroner ? {
                name: newStaffMemberName,
                discord: accountData.discord,
                rank: accountData.rank,
                badge: accountData.badge,
                phNumber: accountData.phNumber || "",
                category: accountData.rank,
            } : {
                name: newStaffMemberName,
                lastName: accountData.lastName,
                rank: accountData.rank,
                category: accountData.rank,
            };

            const listRef = ref(database, isCoroner ? 'staff/coroner' : 'staff/phmc');
            const snapshot = await get(listRef);
            const currentStaff = snapshot.exists() ? snapshot.val() : [];

            const isDuplicate = currentStaff.some(member => 
                member.name.toLowerCase() === newStaffMember.name.toLowerCase());
            if (isDuplicate) {
                showNotification(`Le membre du personnel avec le nom "${newStaffMember.name}" existe déjà.`, 'warning');
                setIsCreatingAccount(false);
                return;
            }

            const updatedStaff = [...currentStaff, newStaffMember];
            await set(listRef, updatedStaff);
            
            // Send webhook notification for account creation
            await sendAccountCreationWebhook(newStaffMember, isCoroner);
            
            setAccountCreated(true);
            showNotification(`Compte créé avec succès pour ${newStaffMember.name} !`, 'success');
            
            // Auto-progress to next step after successful account creation
            setTimeout(() => {
                setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
            }, 1500);
        } catch (error) {
            console.error('Error creating account:', error);
            showNotification(`Erreur lors de la création du compte : ${error.message}`, 'error');
        } finally {
            setIsCreatingAccount(false);
        }
    };

    const sendAccountCreationWebhook = async (staffMember, isCoroner) => {
        try {
            const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
            if (!webhookURL) {
                console.warn('Dev webhook URL not configured for account creation notifications.');
                return;
            }

            const embed = {
                title: `👤 Nouveau compte ${isCoroner ? 'Coroner' : 'Personnel PHMC'} créé`,
                color: isCoroner ? 0x8b0000 : 0x007bff, // Red for coroner, blue for PHMC
                fields: [
                    { name: "Nom", value: staffMember.name, inline: true },
                    { name: "Rang/Position", value: staffMember.rank || staffMember.category, inline: true },
                    ...(isCoroner ? [
                        { name: "Discord", value: staffMember.discord, inline: true },
                        { name: "Numéro de badge", value: staffMember.badge, inline: true },
                        ...(staffMember.phNumber ? [{ name: "Numéro PH", value: staffMember.phNumber, inline: true }] : [])
                    ] : [
                        { name: "Nom de famille", value: staffMember.lastName, inline: true }
                    ]),
                    { name: "Type de compte", value: isCoroner ? 'Personnel Coroner' : 'Personnel Hospitalier', inline: true },
                    { name: "Créé via", value: 'Système d\'intégration', inline: true }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: "Formulaires PHMC-FR - Création de compte"
                }
            };

            const payload = {
                username: "Bot de Compte",
                embeds: [embed]
            };

            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('Account creation webhook sent successfully');
                // Log to Firebase
                await logWebhookToFirebase('account_creation', payload);
            } else {
                console.error('Failed to send account creation webhook:', response.status);
            }
        } catch (error) {
            console.error('Error sending account creation webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Account Creation Webhook' } });
        }
    };

    const handleLogin = async () => {
        if (!selectedEmployeeId) {
            showNotification('Veuillez sélectionner un employé pour vous connecter.', 'warning');
            return;
        }
        
        setIsLoggingIn(true);
        
        try {
            // Find the selected employee
            const allEmployees = [...ensureArray(phmcList), ...ensureArray(coronerList)];
            const selectedEmployee = allEmployees.find(emp => emp.name === selectedEmployeeId);
            
            // Send webhook notification for login
            await sendAccountCreationWebhook({
                name: selectedEmployee?.name || 'Inconnu',
                role: selectedEmployee?.category || selectedEmployee?.rank || 'Inconnu',
                userType: getUserTypeLabel(selectedUserType),
                action: 'login'
            }, selectedUserType === USER_TYPES.CORONER);
            
            setLoggedIn(true);
            showNotification(`Connecté avec succès en tant que ${selectedEmployee?.name || 'Employé'} !`, 'success');
            
            // Auto-progress to next step after successful login
            setTimeout(() => {
                setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
            }, 1500);
        } catch (error) {
            console.error('Error during login:', error);
            showNotification(`Erreur lors de la connexion : ${error.message}`, 'error');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const getStepNumber = () => {
        const steps = [ONBOARDING_STEPS.WELCOME, ONBOARDING_STEPS.USER_TYPE, ONBOARDING_STEPS.ROLE_SPECIFIC, ONBOARDING_STEPS.FORM_PREVIEW, ONBOARDING_STEPS.PRIVACY_POLICY, ONBOARDING_STEPS.COMPLETE];
        const totalSteps = selectedUserType === USER_TYPES.PHMC_STAFF || selectedUserType === USER_TYPES.CORONER ? 6 : 5;
        let currentStepIndex = steps.indexOf(currentStep) + 1;
        
        // Adjust for skipped role step
        if ((selectedUserType !== USER_TYPES.PHMC_STAFF && selectedUserType !== USER_TYPES.CORONER) && currentStepIndex > 2) {
            currentStepIndex -= 1;
        }
        
        return { current: currentStepIndex, total: totalSteps };
    };

    if (!show) return null;

    const renderProgressBar = () => {
        const { current, total } = getStepNumber();
        const percentage = (current / total) * 100;

        return (
            <div style={progressContainerStyle}>
                <div style={progressBarStyle}>
                    <div style={{...progressFillStyle, width: `${percentage}%`}} />
                </div>
                <span style={progressTextStyle}>Étape {current} sur {total}</span>
            </div>
        );
    };

    const renderWelcomeStep = () => (
        <div style={stepContentStyle}>
            <div style={welcomeIconStyle}>
                <i className="fas fa-hand-wave" style={{fontSize: '3rem', color: '#007bff'}}></i>
            </div>
            <h2 style={stepTitleStyle}>Bienvenue sur les formulaires PHMC !</h2>
            <p style={stepDescriptionStyle}>
                Nous sommes là pour vous aider à démarrer avec les bons formulaires pour vos besoins. 
                Cette configuration rapide personnalisera votre expérience et vous montrera les outils les plus pertinents.
            </p>
            <div style={featureListStyle}>
                <div style={featureItemStyle}>
                    <i className="fas fa-check-circle" style={checkIconStyle}></i>
                    <span>Recommandations personnalisées de formulaires</span>
                </div>
                <div style={featureItemStyle}>
                    <i className="fas fa-check-circle" style={checkIconStyle}></i>
                    <span>Interface simplifiée pour votre rôle</span>
                </div>
                <div style={featureItemStyle}>
                    <i className="fas fa-check-circle" style={checkIconStyle}></i>
                    <span>Accès rapide aux formulaires fréquemment utilisés</span>
                </div>
            </div>
            <p style={timeEstimateStyle}>
                <i className="fas fa-clock"></i> Cela devrait prendre moins de 2 minutes
            </p>
        </div>
    );

    const renderUserTypeStep = () => (
        <div style={stepContentStyle}>
            <h2 style={stepTitleStyle}>Quelle description correspond le mieux à votre rôle ?</h2>
            <p style={stepDescriptionStyle}>
                Sélectionnez l'option qui correspond le mieux à la façon dont vous utiliserez le système de formulaires :
            </p>
            <div style={userTypeGridStyle}>
                <button
                    style={{
                        ...userTypeButtonStyle,
                        ...(selectedUserType === USER_TYPES.CIVILIAN ? selectedButtonStyle : {}),
                        backgroundColor: selectedUserType === USER_TYPES.CIVILIAN ? '#1a3a5c' : '#2a2a2a',
                        borderColor: selectedUserType === USER_TYPES.CIVILIAN ? '#007bff' : '#444'
                    }}
                    onClick={() => setSelectedUserType(USER_TYPES.CIVILIAN)}
                >
                    <i className="fas fa-user" style={userTypeIconStyle}></i>
                    <h4 style={userTypeButtonTitleStyle}>Civil</h4>
                    <p style={userTypeButtonDescStyle}>
                        J'ai besoin de soumettre un formulaire sur les forums (dossiers patients, autorisations médicales, etc.)
                    </p>
                </button>

                <button
                    style={{
                        ...userTypeButtonStyle,
                        ...(selectedUserType === USER_TYPES.PHMC_STAFF ? selectedButtonStyle : {}),
                        backgroundColor: selectedUserType === USER_TYPES.PHMC_STAFF ? '#1a3a5c' : '#2a2a2a',
                        borderColor: selectedUserType === USER_TYPES.PHMC_STAFF ? '#007bff' : '#444'
                    }}
                    onClick={() => setSelectedUserType(USER_TYPES.PHMC_STAFF)}
                >
                    <i className="fas fa-user-md" style={userTypeIconStyle}></i>
                    <h4 style={userTypeButtonTitleStyle}>Personnel PHMC</h4>
                    <p style={userTypeButtonDescStyle}>
                        Je travaille au PHMC et je crée des rapports médicaux, des consultations et de la documentation patient
                    </p>
                </button>

                <button
                    style={{
                        ...userTypeButtonStyle,
                        ...(selectedUserType === USER_TYPES.CORONER ? selectedButtonStyle : {}),
                        backgroundColor: selectedUserType === USER_TYPES.CORONER ? '#1a3a5c' : '#2a2a2a',
                        borderColor: selectedUserType === USER_TYPES.CORONER ? '#007bff' : '#444'
                    }}
                    onClick={() => setSelectedUserType(USER_TYPES.CORONER)}
                >
                    <i className="fas fa-search" style={userTypeIconStyle}></i>
                    <h4 style={userTypeButtonTitleStyle}>DMEC</h4>
                    <p style={userTypeButtonDescStyle}>
                        Je m'occupe des services médico-légaux, des rapports de décès, des autopsies et des enquêtes du coroner
                    </p>
                </button>

                <button
                    style={{
                        ...userTypeButtonStyle,
                        ...(selectedUserType === USER_TYPES.RECRUITMENT ? selectedButtonStyle : {}),
                        backgroundColor: selectedUserType === USER_TYPES.RECRUITMENT ? '#1a3a5c' : '#2a2a2a',
                        borderColor: selectedUserType === USER_TYPES.RECRUITMENT ? '#007bff' : '#444'
                    }}
                    onClick={() => setSelectedUserType(USER_TYPES.RECRUITMENT)}
                >
                    <i className="fas fa-clipboard-user" style={userTypeIconStyle}></i>
                    <h4 style={userTypeButtonTitleStyle}>Candidat</h4>
                    <p style={userTypeButtonDescStyle}>
                        Je postule pour un poste au PHMC (médecin, infirmier, administratif, etc.)
                    </p>
                </button>

                <button
                    style={{
                        ...userTypeButtonStyle,
                        ...(selectedUserType === USER_TYPES.OTHER ? selectedButtonStyle : {}),
                        backgroundColor: selectedUserType === USER_TYPES.OTHER ? '#1a3a5c' : '#2a2a2a',
                        borderColor: selectedUserType === USER_TYPES.OTHER ? '#007bff' : '#444'
                    }}
                    onClick={() => setSelectedUserType(USER_TYPES.OTHER)}
                >
                    <i className="fas fa-question-circle" style={userTypeIconStyle}></i>
                    <h4 style={userTypeButtonTitleStyle}>Autre/Multiple</h4>
                    <p style={userTypeButtonDescStyle}>
                        J'utilise les formulaires à plusieurs fins ou je ne corresponds pas aux catégories ci-dessus
                    </p>
                </button>
            </div>
        </div>
    );

    const renderRoleSpecificStep = () => {
        if (selectedUserType === USER_TYPES.PHMC_STAFF) {
            if (showAccountCreation) {
                return (
                    <div style={stepContentStyle}>
                        <h2 style={stepTitleStyle}>Créer un compte Personnel PHMC</h2>
                        <p style={stepDescriptionStyle}>
                            Remplissez vos informations pour créer votre compte personnel :
                        </p>
                        <div style={accountFormStyle}>
                            <div style={formRowStyle}>
                                <Form.Control
                                    type="text"
                                    name="firstName"
                                    value={accountData.firstName}
                                    onChange={handleAccountDataChange}
                                    placeholder="Prénom *"
                                    style={formInputStyle}
                                />
                                <Form.Control
                                    type="text"
                                    name="lastName"
                                    value={accountData.lastName}
                                    onChange={handleAccountDataChange}
                                    placeholder="Nom *"
                                    style={formInputStyle}
                                />
                            </div>
                            <Form.Control
                                type="text"
                                name="rank"
                                value={accountData.rank}
                                onChange={handleAccountDataChange}
                                placeholder="Rang *"
                                style={formInputStyle}
                            />
                            <div style={accountActionsStyle}>
                                <Button 
                                    variant="outline-secondary" 
                                    onClick={() => setShowAccountCreation(false)}
                                    style={skipAccountButtonStyle}
                                >
                                    Passer la création du compte
                                </Button>
                                <Button 
                                    variant="primary" 
                                    onClick={handleCreateAccount}
                                    disabled={isCreatingAccount}
                                    style={createAccountButtonStyle}
                                >
                                    {isCreatingAccount ? 'Création en cours...' : 'Créer un compte'}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            }

            // Show login form for PHMC Staff
            if (showLogin) {
                return (
                    <div style={stepContentStyle}>
                        <h2 style={stepTitleStyle}>Connexion à votre compte Personnel PHMC</h2>
                        <p style={stepDescriptionStyle}>
                            Sélectionnez votre nom dans la liste ci-dessous :
                        </p>
                        
                        <div style={{margin: '20px 0'}}>
                            <Form.Group>
                                <Form.Label style={{fontWeight: 'bold', marginBottom: '10px'}}>
                                    Sélectionnez votre nom :
                                </Form.Label>
                                <Form.Select 
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    style={{
                                        padding: '10px',
                                        borderRadius: '5px',
                                        border: '1px solid #ddd',
                                        fontSize: '16px'
                                    }}
                                >
                                    <option value="">Choisissez votre nom...</option>
                                    {ensureArray(phmcList).map((employee, index) => (
                                        <option key={index} value={employee.name}>
                                            {employee.name} - {employee.category || employee.rank || 'Personnel PHMC'}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </div>

                        <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '30px'}}>
                            <Button 
                                variant="secondary" 
                                onClick={() => setShowLogin(false)}
                                style={{padding: '10px 20px'}}
                            >
                                Retour
                            </Button>
                            <Button 
                                variant="success" 
                                onClick={handleLogin}
                                disabled={!selectedEmployeeId || isLoggingIn}
                                style={{padding: '10px 20px'}}
                            >
                                {isLoggingIn ? 'Connexion en cours...' : 'Connexion'}
                            </Button>
                        </div>
                    </div>
                );
            }

            return (
                <div style={stepContentStyle}>
                    <h2 style={stepTitleStyle}>Quel est votre rôle principal au sein de PHMC ?</h2>
                    <p style={stepDescriptionStyle}>
                        Cela nous aide à vous montrer les formulaires les plus pertinents pour votre département :
                    </p>
                    <div style={roleGridStyle}>
                        {[
                            { id: 'physician', icon: 'fas fa-stethoscope', title: 'Médecin', desc: 'Chirurgien, Médecin urgentiste, Spécialiste' },
                            { id: 'nurse', icon: 'fas fa-user-nurse', title: 'Infirmier', desc: 'Infirmier autorisé, Infirmier auxiliaire, Infirmier praticien' },
                            { id: 'ems', icon: 'fas fa-ambulance', title: 'EMS', desc: 'Paramédic, Technicien ambulancier' },
                            { id: 'admin', icon: 'fas fa-clipboard-list', title: 'Administration', desc: 'Gestion, Clerical, Support' },
                            { id: 'psych', icon: 'fas fa-brain', title: 'Santé mentale', desc: 'Psychiatre, Psychologue' },
                            { id: 'other', icon: 'fas fa-ellipsis-h', title: 'Autre', desc: 'Rôles multiples ou autre spécialité' }
                        ].map(role => (
                            <button
                                key={role.id}
                                style={{
                                    ...roleButtonStyle,
                                    ...(selectedRole === role.id ? selectedButtonStyle : {}),
                                    backgroundColor: selectedRole === role.id ? '#1a3a5c' : '#2a2a2a',
                                    borderColor: selectedRole === role.id ? '#007bff' : '#444'
                                }}
                                onClick={() => setSelectedRole(role.id)}
                            >
                                <i className={role.icon} style={roleIconStyle}></i>
                                <h5 style={roleButtonTitleStyle}>{role.title}</h5>
                                <p style={roleButtonDescStyle}>{role.desc}</p>
                            </button>
                        ))}
                    </div>
                    <div style={accountPromptStyle}>
                        <p style={accountPromptTextStyle}>
                            <i className="fas fa-user-plus" style={promptIconStyle}></i>
                            Souhaitez-vous créer un compte personnel ou vous connecter avec un compte existant ?
                        </p>
                        <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                            <Button 
                                variant="outline-primary" 
                                onClick={() => setShowAccountCreation(true)}
                                style={{
                                    borderColor: '#007bff',
                                    color: '#007bff',
                                    backgroundColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#007bff';
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.color = '#007bff';
                                }}
                            >
                                Créer un compte personnel
                            </Button>
                            <Button 
                                variant="outline-success" 
                                onClick={() => setShowLogin(true)}
                                style={{
                                    borderColor: '#28a745',
                                    color: '#28a745',
                                    backgroundColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#28a745';
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.color = '#28a745';
                                }}
                            >
                                Connexion
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        if (selectedUserType === USER_TYPES.CORONER) {
            if (showAccountCreation) {
                return (
                    <div style={stepContentStyle}>
                        <h2 style={stepTitleStyle}>Créer votre compte de membre du DMEC</h2>
                        <p style={stepDescriptionStyle}>
                            Remplissez vos informations pour créer votre compte de membre du DMEC :
                        </p>
                        <div style={accountFormStyle}>
                            <div style={formRowStyle}>
                                <Form.Control
                                    type="text"
                                    name="firstName"
                                    value={accountData.firstName}
                                    onChange={handleAccountDataChange}
                                    placeholder="Prénom Nom *"
                                    style={formInputStyle}
                                />
                                <Form.Control
                                    type="text"
                                    name="discord"
                                    value={accountData.discord}
                                    onChange={handleAccountDataChange}
                                    placeholder="Nom Discord *"
                                    style={formInputStyle}
                                />
                            </div>
                            <div style={formRowStyle}>
                                <Form.Control
                                    type="text"
                                    name="rank"
                                    value={accountData.rank}
                                    onChange={handleAccountDataChange}
                                    placeholder="Rang *"
                                    style={formInputStyle}
                                />
                                <Form.Control
                                    type="text"
                                    name="badge"
                                    value={accountData.badge}
                                    onChange={handleAccountDataChange}
                                    placeholder="Numéro de Badge *"
                                    style={formInputStyle}
                                />
                            </div>
                            <Form.Control
                                type="text"
                                name="phNumber"
                                value={accountData.phNumber}
                                onChange={handleAccountDataChange}
                                placeholder="Numéro de téléphone (Optionnel)"
                                style={formInputStyle}
                            />
                            <div style={accountActionsStyle}>
                                <Button 
                                    variant="outline-secondary" 
                                    onClick={() => setShowAccountCreation(false)}
                                    style={skipAccountButtonStyle}
                                >
                                    Passer la création de compte
                                </Button>
                                <Button 
                                    variant="primary" 
                                    onClick={handleCreateAccount}
                                    disabled={isCreatingAccount}
                                    style={createAccountButtonStyle}
                                >
                                    {isCreatingAccount ? 'Création en cours...' : 'Créer un compte'}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            }

            // Show login form for Coroner
            if (showLogin) {
                return (
                    <div style={stepContentStyle}>
                        <h2 style={stepTitleStyle}>Connexion à votre compte de membre du DMEC</h2>
                        <p style={stepDescriptionStyle}>
                            Sélectionnez votre nom dans la liste ci-dessous :
                        </p>
                        
                        <div style={{margin: '20px 0'}}>
                            <Form.Group>
                                <Form.Label style={{fontWeight: 'bold', marginBottom: '10px'}}>
                                    Sélectionnez votre nom :
                                </Form.Label>
                                <Form.Select 
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    style={{
                                        padding: '10px',
                                        borderRadius: '5px',
                                        border: '1px solid #ddd',
                                        fontSize: '16px'
                                    }}
                                >
                                    <option value="">Choisissez votre nom...</option>
                                    {ensureArray(coronerList).map((employee, index) => (
                                        <option key={index} value={employee.name}>
                                            {employee.name} - {employee.category || employee.rank || 'Médecin légiste'}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </div>

                        <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '30px'}}>
                            <Button 
                                variant="secondary" 
                                onClick={() => setShowLogin(false)}
                                style={{padding: '10px 20px'}}
                            >
                                Retour
                            </Button>
                            <Button 
                                variant="success" 
                                onClick={handleLogin}
                                disabled={!selectedEmployeeId || isLoggingIn}
                                style={{padding: '10px 20px'}}
                            >
                                {isLoggingIn ? 'Connexion en cours...' : 'Connexion'}
                            </Button>
                        </div>
                    </div>
                );
            }

            return (
                <div style={stepContentStyle}>
                    <h2 style={stepTitleStyle}>Bienvenue, Membre du DMEC !</h2>
                    <p style={stepDescriptionStyle}>
                        Configurons votre accès aux formulaires et service du DMEC :
                    </p>
                    <div style={coronerWelcomeStyle}>
                        <div style={coronerInfoCardStyle}>
                            <i className="fas fa-clipboard-check" style={coronerInfoIconStyle}></i>
                            <h4 style={coronerInfoTitleStyle}>Accès aux formulaires médico-légaux</h4>
                            <p style={coronerInfoDescStyle}>Accès complet à tous les formulaires et services médico-légaux</p>
                        </div>
                        <div style={coronerInfoCardStyle}>
                            <i className="fas fa-search" style={coronerInfoIconStyle}></i>
                            <h4 style={coronerInfoTitleStyle}>Outils d'enquête</h4>
                            <p style={coronerInfoDescStyle}>Rapports d'autopsie, certificats de décès et gestion des dossiers</p>
                        </div>
                    </div>
                    <div style={accountPromptStyle}>
                        <p style={accountPromptTextStyle}>
                            <i className="fas fa-user-plus" style={promptIconStyle}></i>
                            Souhaitez-vous créer un compte de membre du DMEC ou vous connecter avec un compte existant ?
                        </p>
                        <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                            <Button 
                                variant="outline-primary" 
                                onClick={() => setShowAccountCreation(true)}
                                style={{
                                    borderColor: '#007bff',
                                    color: '#007bff',
                                    backgroundColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#007bff';
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.color = '#007bff';
                                }}
                            >
                                Créer un compte de membre du DMEC
                            </Button>
                            <Button 
                                variant="outline-success" 
                                onClick={() => setShowLogin(true)}
                                style={{
                                    borderColor: '#28a745',
                                    color: '#28a745',
                                    backgroundColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#28a745';
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.color = '#28a745';
                                }}
                            >
                                Connexion
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    const renderFormPreviewStep = () => (
        <div style={stepContentStyle}>
            <h2 style={stepTitleStyle}>Voici vos formulaires recommandés</h2>
            <p style={stepDescriptionStyle}>
                En fonction de votre sélection, ces formulaires seront prioritaires dans votre interface :
            </p>
            <div style={formPreviewGridStyle}>
                {recommendedForms.slice(0, 6).map(form => (
                    <div key={form.version} style={formPreviewCardStyle}>
                        <div style={formPreviewIconStyle}>
                            <img src={form.icon} alt={form.name} style={formIconImageStyle} />
                        </div>
                        <h5 style={formPreviewTitleStyle}>{form.name}</h5>
                        <p style={formPreviewDescStyle}>Version {form.version}</p>
                    </div>
                ))}
            </div>
            {recommendedForms.length > 6 && (
                <p style={moreFormsTextStyle}>
                    + {recommendedForms.length - 6} formulaires supplémentaires disponibles pour votre rôle
                </p>
            )}
            <div style={previewNoteStyle}>
                <i className="fas fa-info-circle" style={noteIconStyle}></i>
                <span>Vous pouvez toujours accéder à tous les formulaires via le sélecteur de formulaires, mais ceux-ci seront mis en avant pour un accès rapide.</span>
            </div>
        </div>
    );

    const renderPrivacyPolicyStep = () => (
        <div style={stepContentStyle}>
            <div style={privacyIconStyle}>
                <i className="fas fa-shield-alt" style={{fontSize: '3rem', color: '#007bff'}}></i>
            </div>
            <h2 style={stepTitleStyle}>Politique de confidentialité</h2>
            <p style={stepDescriptionStyle}>
                Veuillez consulter notre politique de confidentialité avant de terminer votre configuration.
            </p>
            <div style={privacyContentStyle}>
                <div style={privacyPolicyBoxStyle}>
                    <p>Cette politique couvre l'utilisation des outils PHMC-FR et est conforme à la <a href="https://gta.world/terms/" target="_blank" rel="noopener noreferrer" style={linkStyle}>Politique de confidentialité de GTA World</a>.</p>
                    <p>Ce site traite des informations <strong>IN CHARACTER</strong> pour l'utilisation du Pillbox Hill Medical Center (une faction de GTA World)</p>
                    <p>Nous sommes en pleine conformité avec les <a href="https://forum.gta.world/en/topic/141256-gta-world-website-regulations-last-update-march-1st-2025/" target="_blank" rel="noopener noreferrer" style={linkStyle}>Règlements de GTA World</a> en hébergeant ce site sur les serveurs de GTA World et le code est vérifié par les développeurs de GTAW.</p>
                    <p>
                        Nous utilisons des services tiers pour collecter et stocker certaines données, notamment : 
                        <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" style={linkStyle}> Sentry</a> (Error Tracking) et 
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={linkStyle}> Google Firebase</a> (Sauvegarde des rapports).
                    </p>
                    <p><strong>Nous collectons les données suivantes :</strong></p>
                    <ul style={privacyListStyle}>
                        <li>Firebase ne stocke que les rapports sauvegardés, les champs déroulants et les noms des employés</li>
                        <li>Journaux d'erreurs Informations sur l'appareil (Mobile / Bureau / Tablette), fichier d'erreur lié et bouton pressé.</li>
                        <li>Seul moi-même peut voir les journaux d'erreurs et la base de données Firebase.</li>
                    </ul>
                    <p>Nous ne partageons pas vos données avec des tiers, à l'exception des fournisseurs tiers mentionnés ci-dessus.</p>
                    <p><strong>Questions :</strong> Posez-les sur le serveur Discord de PHMC.</p>
                </div>
            </div>
        </div>
    );

    const renderCompleteStep = () => (
        <div style={stepContentStyle}>
            <div style={completeIconStyle}>
                <i className="fas fa-check-circle" style={{fontSize: '4rem', color: '#28a745'}}></i>
            </div>
            <h2 style={stepTitleStyle}>C'est tout bon !</h2>
            <p style={stepDescriptionStyle}>
                Votre interface a été personnalisée pour votre rôle. Vous pouvez modifier ces préférences à tout moment depuis le menu Outils.
            </p>
            <div style={summaryBoxStyle}>
                <h4 style={summaryTitleStyle}>Résumé de votre configuration :</h4>
                <div style={summaryItemStyle}>
                    <strong>Rôle :</strong> {getUserTypeLabel(selectedUserType)}
                    {selectedRole && ` (${getRoleLabel(selectedRole)})`}
                </div>
                <div style={summaryItemStyle}>
                    <strong>Formulaires principaux :</strong> {recommendedForms.length} formulaires recommandés
                </div>
                <div style={summaryItemStyle}>
                    <strong>Catégories disponibles :</strong> {FORM_CATEGORIES[selectedUserType]?.join(', ') || 'Toutes les catégories'}
                </div>
            </div>
        </div>
    );

    const getUserTypeLabel = (userType) => {
        const labels = {
            [USER_TYPES.CIVILIAN]: 'Civil',
            [USER_TYPES.PHMC_STAFF]: 'Personnel PHMC',
            [USER_TYPES.CORONER]: 'DMEC',
            [USER_TYPES.RECRUITMENT]: 'Candidat',
            [USER_TYPES.OTHER]: 'Plusieurs rôles'
        };
        return labels[userType] || 'Inconnu';
    };

    const getRoleLabel = (role) => {
        const labels = {
            physician: 'Physician',
            nurse: 'Nurse',
            ems: 'EMS',
            admin: 'Administrator',
            psych: 'Mental Health',
            investigator: 'Investigator',
            examiner: 'Medical Examiner',
            supervisor: 'Supervisor',
            other: 'Other'
        };
        return labels[role] || role;
    };

    const canProceed = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.WELCOME:
                return true;
            case ONBOARDING_STEPS.USER_TYPE:
                return selectedUserType !== null;
            case ONBOARDING_STEPS.ROLE_SPECIFIC:
                if (selectedUserType === USER_TYPES.PHMC_STAFF) {
                    return selectedRole !== null || showAccountCreation || (showLogin && selectedEmployeeId) || accountCreated || loggedIn;
                }
                if (selectedUserType === USER_TYPES.CORONER) {
                    return true || showAccountCreation || (showLogin && selectedEmployeeId) || accountCreated || loggedIn;
                }
                return selectedRole !== null;
            case ONBOARDING_STEPS.FORM_PREVIEW:
                return true;
            case ONBOARDING_STEPS.PRIVACY_POLICY:
                return true;
            case ONBOARDING_STEPS.COMPLETE:
                return true;
            default:
                return false;
        }
    };

    const getNextButtonText = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.WELCOME:
                return "C'est parti";
            case ONBOARDING_STEPS.PRIVACY_POLICY:
                return "Accepter et continuer";
            case ONBOARDING_STEPS.COMPLETE:
                return "Commencer à utiliser les formulaires";
            default:
                return "Continuer";
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.WELCOME:
                return renderWelcomeStep();
            case ONBOARDING_STEPS.USER_TYPE:
                return renderUserTypeStep();
            case ONBOARDING_STEPS.ROLE_SPECIFIC:
                return renderRoleSpecificStep();
            case ONBOARDING_STEPS.FORM_PREVIEW:
                return renderFormPreviewStep();
            case ONBOARDING_STEPS.PRIVACY_POLICY:
                return renderPrivacyPolicyStep();
            case ONBOARDING_STEPS.COMPLETE:
                return renderCompleteStep();
            default:
                return null;
        }
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    {renderProgressBar()}
                    <button style={skipButtonStyle} onClick={handleSkip} title="Passer l'intégration">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                
                <div style={contentStyle}>
                    {renderStepContent()}
                </div>

                <div style={footerStyle}>
                    {currentStep !== ONBOARDING_STEPS.WELCOME && (
                        <Button 
                            variant="outline-secondary" 
                            onClick={handleBack}
                            style={backButtonStyle}
                        >
                            <i className="fas fa-arrow-left"></i> Retour
                        </Button>
                    )}
                    
                    <div style={footerRightStyle}>
                        <Button 
                            variant="primary" 
                            onClick={handleNext}
                            disabled={!canProceed()}
                            style={nextButtonStyle}
                        >
                            {getNextButtonText()} <i className="fas fa-arrow-right"></i>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Styles
const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1070,
    padding: '20px'
};

const modalStyle = {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    borderRadius: '12px',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
};

const headerStyle = {
    padding: '20px 20px 0 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
};

const progressContainerStyle = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
};

const progressBarStyle = {
    flex: 1,
    height: '6px',
    backgroundColor: '#333',
    borderRadius: '3px',
    overflow: 'hidden'
};

const progressFillStyle = {
    height: '100%',
    backgroundColor: '#007bff',
    transition: 'width 0.3s ease'
};

const progressTextStyle = {
    fontSize: '0.85rem',
    color: '#ccc',
    whiteSpace: 'nowrap'
};

const skipButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#ccc',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '5px',
    borderRadius: '4px',
    transition: 'color 0.2s ease'
};

const contentStyle = {
    padding: '20px',
    flex: 1,
    overflow: 'auto'
};

const stepContentStyle = {
    textAlign: 'center'
};

const welcomeIconStyle = {
    marginBottom: '20px'
};

const stepTitleStyle = {
    fontSize: '2rem',
    marginBottom: '15px',
    color: '#ffffff'
};

const stepDescriptionStyle = {
    fontSize: '1.1rem',
    color: '#ccc',
    marginBottom: '30px',
    lineHeight: '1.5'
};

const featureListStyle = {
    textAlign: 'left',
    maxWidth: '400px',
    margin: '0 auto 30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
};

const featureItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
};

const checkIconStyle = {
    color: '#28a745',
    fontSize: '1.1rem'
};

const timeEstimateStyle = {
    color: '#aaa',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px'
};

const userTypeGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '15px',
    maxWidth: '900px',
    margin: '0 auto'
};

const userTypeButtonStyle = {
    background: '#2a2a2a',
    border: '2px solid #444',
    borderRadius: '8px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
    color: '#fff',
    '&:hover': {
        borderColor: '#666',
        backgroundColor: '#333'
    }
};

const selectedButtonStyle = {
    borderColor: '#007bff !important',
    backgroundColor: '#1a3a5c !important',
    boxShadow: '0 0 0 2px rgba(0, 123, 255, 0.25)',
    color: '#fff !important'
};

const userTypeIconStyle = {
    fontSize: '2.5rem',
    color: '#007bff',
    marginBottom: '15px'
};

const userTypeButtonTitleStyle = {
    fontSize: '1.3rem',
    marginBottom: '10px',
    color: '#fff'
};

const userTypeButtonDescStyle = {
    fontSize: '0.9rem',
    color: '#ccc',
    lineHeight: '1.4',
    margin: 0
};

const roleGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    maxWidth: '700px',
    margin: '0 auto'
};

const roleButtonStyle = {
    background: '#2a2a2a',
    border: '2px solid #444',
    borderRadius: '8px',
    padding: '15px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
    color: '#fff',
    '&:hover': {
        borderColor: '#666',
        backgroundColor: '#333'
    }
};

const roleIconStyle = {
    fontSize: '2rem',
    color: '#007bff',
    marginBottom: '10px'
};

const roleButtonTitleStyle = {
    fontSize: '1.1rem',
    marginBottom: '8px',
    color: '#fff'
};

const roleButtonDescStyle = {
    fontSize: '0.8rem',
    color: '#ccc',
    lineHeight: '1.3',
    margin: 0
};

const formPreviewGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '15px',
    maxWidth: '600px',
    margin: '0 auto 20px'
};

const formPreviewCardStyle = {
    background: '#2a2a2a',
    borderRadius: '8px',
    padding: '15px',
    textAlign: 'center'
};

const formPreviewIconStyle = {
    marginBottom: '10px'
};

const formIconImageStyle = {
    width: '40px',
    height: '40px',
    objectFit: 'contain'
};

const formPreviewTitleStyle = {
    fontSize: '0.9rem',
    marginBottom: '5px',
    color: '#fff'
};

const formPreviewDescStyle = {
    fontSize: '0.8rem',
    color: '#ccc',
    margin: 0
};

const moreFormsTextStyle = {
    color: '#aaa',
    fontSize: '0.9rem',
    marginTop: '10px'
};

const previewNoteStyle = {
    background: '#2a3a2a',
    borderRadius: '6px',
    padding: '15px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '20px',
    fontSize: '0.9rem',
    color: '#ccc'
};

const noteIconStyle = {
    color: '#17a2b8',
    fontSize: '1.1rem'
};

const completeIconStyle = {
    marginBottom: '20px'
};

const summaryBoxStyle = {
    background: '#2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'left',
    maxWidth: '500px',
    margin: '0 auto'
};

const summaryTitleStyle = {
    color: '#fff',
    marginBottom: '15px'
};

const summaryItemStyle = {
    marginBottom: '10px',
    color: '#ccc'
};

const footerStyle = {
    padding: '20px',
    borderTop: '1px solid #444',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};

const footerRightStyle = {
    marginLeft: 'auto'
};

const backButtonStyle = {
    marginRight: '10px'
};

const nextButtonStyle = {
    minWidth: '120px'
};

// Account creation styles
const accountFormStyle = {
    maxWidth: '500px',
    margin: '0 auto',
    textAlign: 'left'
};

const formRowStyle = {
    display: 'flex',
    gap: '15px',
    marginBottom: '15px'
};

const formInputStyle = {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    padding: '10px',
    marginBottom: '15px'
};

const accountActionsStyle = {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginTop: '20px'
};

const skipAccountButtonStyle = {
    borderColor: '#6c757d',
    color: '#6c757d'
};

const createAccountButtonStyle = {
    backgroundColor: '#007bff',
    borderColor: '#007bff'
};

const accountPromptStyle = {
    background: '#2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    marginTop: '30px',
    textAlign: 'center'
};

const accountPromptTextStyle = {
    color: '#ccc',
    marginBottom: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
};

const promptIconStyle = {
    color: '#007bff',
    fontSize: '1.1rem'
};

const coronerWelcomeStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
};

const coronerInfoCardStyle = {
    background: '#2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center'
};

const coronerInfoIconStyle = {
    fontSize: '2.5rem',
    color: '#007bff',
    marginBottom: '15px'
};

const coronerInfoTitleStyle = {
    fontSize: '1.2rem',
    marginBottom: '10px',
    color: '#fff'
};

const coronerInfoDescStyle = {
    fontSize: '0.9rem',
    color: '#ccc',
    lineHeight: '1.4',
    margin: 0
};

const privacyIconStyle = {
    fontSize: '3rem',
    color: '#17a2b8',
    marginBottom: '20px'
};

const privacyContentStyle = {
    textAlign: 'left',
    color: '#f8f9fa',
    maxHeight: '400px',
    overflowY: 'auto',
    backgroundColor: '#2c3e50',
    border: '1px solid #495057',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px'
};

const privacyPolicyBoxStyle = {
    backgroundColor: '#2c3e50',
    border: '1px solid #495057',
    borderRadius: '4px',
    padding: '15px',
    margin: '10px 0',
    color: '#f8f9fa'
};

const linkStyle = {
    color: '#17a2b8',
    textDecoration: 'none'
};

const privacyListStyle = {
    color: '#e9ecef',
    paddingLeft: '20px',
    marginBottom: '15px'
};

export default OnboardingModal;