// src/components/Auth/CivilianAuthPanel.js
//
// Contenu de connexion / création de compte Civil, utilisé par l'étape
// CIVIL_AUTH d'OnboardingModal (choix Civil ou Candidat dans le Guide de
// Configuration — un compte Civil unique sert aux deux). Ne gère PAS elle-même
// la redirection OAuth GTA World : le parent lui fournit l'état déjà résolu
// (gtawCharacters/gtawResolutions/gtawUserId, partagés avec le flux Personnel/
// DMEC — un seul flux GTAW actif à la fois) et un déclencheur onStartGtaw.
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../firebase';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import GtawCharacterPicker from './GtawCharacterPicker';

const emptyAccountData = {
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    zip: '',
    phone: '',
    discord: '',
    email: '',
    password: '',
    confirmPassword: ''
};

const fieldBoxStyle = {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #444'
};

const CivilianAuthPanel = ({
    gtawCharacters,
    gtawResolutions = {},
    gtawUserId,
    onStartGtaw,
    showNotification = () => {},
    onAuthenticated = () => {}
}) => {
    const { loginEmployee, createCivilianAccount, createCivilianAccountFromGtaw } = useEmployeeAuth();

    // 'choice' = écran initial (GTAW / manuel / j'ai déjà un compte)
    // 'login'  = email + mot de passe pour un compte existant
    // 'create' = formulaire d'identité (pré-rempli si method === 'gtaw')
    const [mode, setMode] = useState('choice');
    const [method, setMethod] = useState(null); // 'manual' | 'gtaw'
    const [selectedGtawCharacter, setSelectedGtawCharacter] = useState(null);
    const [accountData, setAccountData] = useState(emptyAccountData);
    const [loginData, setLoginData] = useState({ email: '', password: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAccountChange = (e) => {
        setAccountData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleLoginChange = (e) => {
        setLoginData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleGtawCharacterForCreation = (character) => {
        setSelectedGtawCharacter(character);
        setMethod('gtaw');
        setMode('create');
        setAccountData(prev => ({
            ...prev,
            firstName: character.firstname || '',
            lastName: character.lastname || ''
        }));
    };

    const handleGtawLogin = async (customToken) => {
        try {
            await signInWithCustomToken(auth, customToken);
            showNotification('Connecté avec succès !', 'success');
            onAuthenticated();
        } catch (error) {
            console.error('Error signing in as civilian via GTAW:', error);
            showNotification('Erreur lors de la connexion avec ce personnage.', 'error');
        }
    };

    const handleLogin = async () => {
        if (!loginData.email || !loginData.password) {
            showNotification('Veuillez remplir tous les champs.', 'warning');
            return;
        }
        setIsSubmitting(true);
        try {
            await loginEmployee(loginData.email, loginData.password);
            showNotification('Connecté avec succès !', 'success');
            onAuthenticated();
        } catch (error) {
            console.error('Error during civilian login:', error);
            let msg = 'Erreur lors de la connexion.';
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                msg = 'Email ou mot de passe incorrect.';
            } else if (error.code === 'auth/invalid-email') {
                msg = 'Email invalide.';
            } else if (error.code === 'auth/too-many-requests') {
                msg = 'Trop de tentatives. Réessayez plus tard.';
            } else if (error.message) {
                msg = error.message;
            }
            showNotification(msg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateAccount = async () => {
        const isGtaw = method === 'gtaw';
        const required = isGtaw
            ? ['email', 'dateOfBirth', 'gender', 'address', 'zip', 'phone']
            : ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'dateOfBirth', 'gender', 'address', 'zip', 'phone'];
        const missing = required.filter(f => !accountData[f]?.trim());
        if (missing.length > 0) {
            showNotification('Veuillez remplir tous les champs requis.', 'warning');
            return;
        }

        if (!isGtaw) {
            if (accountData.password !== accountData.confirmPassword) {
                showNotification('Les mots de passe ne correspondent pas.', 'warning');
                return;
            }
            const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
            if (!passwordRegex.test(accountData.password)) {
                showNotification('Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.', 'warning');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const civilianData = {
                firstName: accountData.firstName,
                middleName: accountData.middleName,
                lastName: accountData.lastName,
                dateOfBirth: accountData.dateOfBirth,
                gender: accountData.gender,
                address: accountData.address,
                zip: accountData.zip,
                phone: accountData.phone,
                discord: accountData.discord
            };

            if (isGtaw) {
                await createCivilianAccountFromGtaw(civilianData, accountData.email, selectedGtawCharacter?.id ?? null, gtawUserId ?? null);
            } else {
                await createCivilianAccount(civilianData, accountData.email, accountData.password);
            }

            showNotification('Compte Civil créé avec succès !', 'success');
            onAuthenticated();
        } catch (error) {
            console.error('Error creating civilian account:', error);
            let msg = 'Erreur lors de la création du compte.';
            if (error.code === 'auth/email-already-in-use' || error.error === 'email-already-exists') {
                msg = 'Cet email est déjà utilisé.';
            } else if (error.code === 'auth/invalid-email') {
                msg = 'Email invalide.';
            } else if (error.code === 'auth/weak-password') {
                msg = 'Le mot de passe est trop faible.';
            } else if (error.message) {
                msg = error.message;
            }
            showNotification(msg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (mode === 'login') {
        return (
            <Form>
                <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control type="email" name="email" value={loginData.email} onChange={handleLoginChange} style={fieldBoxStyle} />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Mot de passe</Form.Label>
                    <Form.Control type="password" name="password" value={loginData.password} onChange={handleLoginChange} style={fieldBoxStyle} />
                </Form.Group>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <Button variant="outline-secondary" onClick={() => setMode('choice')} disabled={isSubmitting}>Retour</Button>
                    <Button variant="primary" onClick={handleLogin} disabled={isSubmitting}>
                        {isSubmitting ? 'Connexion...' : 'Se connecter'}
                    </Button>
                </div>
            </Form>
        );
    }

    if (mode === 'create') {
        return (
            <Form>
                {method === 'gtaw' && selectedGtawCharacter && (
                    <div style={{ marginBottom: '15px', color: '#ffc107' }}>
                        <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i>
                        Identité vérifiée via GTA World : <strong>{selectedGtawCharacter.firstname} {selectedGtawCharacter.lastname}</strong>
                    </div>
                )}
                {method !== 'gtaw' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Group className="mb-3" style={{ flex: 1 }}>
                            <Form.Label>Prénom</Form.Label>
                            <Form.Control type="text" name="firstName" value={accountData.firstName} onChange={handleAccountChange} style={fieldBoxStyle} />
                        </Form.Group>
                        <Form.Group className="mb-3" style={{ flex: 1 }}>
                            <Form.Label>Nom</Form.Label>
                            <Form.Control type="text" name="lastName" value={accountData.lastName} onChange={handleAccountChange} style={fieldBoxStyle} />
                        </Form.Group>
                    </div>
                )}
                <Form.Group className="mb-3">
                    <Form.Label>Deuxième prénom (optionnel)</Form.Label>
                    <Form.Control type="text" name="middleName" value={accountData.middleName} onChange={handleAccountChange} style={fieldBoxStyle} />
                </Form.Group>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Group className="mb-3" style={{ flex: 1 }}>
                        <Form.Label>Date de naissance</Form.Label>
                        <Form.Control type="date" name="dateOfBirth" value={accountData.dateOfBirth} onChange={handleAccountChange} style={fieldBoxStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3" style={{ flex: 1 }}>
                        <Form.Label>Genre à l'état civil</Form.Label>
                        <Form.Control type="text" name="gender" value={accountData.gender} onChange={handleAccountChange} style={fieldBoxStyle} />
                    </Form.Group>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Group className="mb-3" style={{ flex: 2 }}>
                        <Form.Label>Adresse</Form.Label>
                        <Form.Control type="text" name="address" value={accountData.address} onChange={handleAccountChange} style={fieldBoxStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3" style={{ flex: 1 }}>
                        <Form.Label>Code postal</Form.Label>
                        <Form.Control type="text" name="zip" value={accountData.zip} onChange={handleAccountChange} style={fieldBoxStyle} />
                    </Form.Group>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Group className="mb-3" style={{ flex: 1 }}>
                        <Form.Label>Téléphone</Form.Label>
                        <Form.Control type="text" name="phone" value={accountData.phone} onChange={handleAccountChange} style={fieldBoxStyle} />
                    </Form.Group>
                    <Form.Group className="mb-3" style={{ flex: 1 }}>
                        <Form.Label>Discord (optionnel)</Form.Label>
                        <Form.Control type="text" name="discord" value={accountData.discord} onChange={handleAccountChange} style={fieldBoxStyle} />
                    </Form.Group>
                </div>
                <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control type="email" name="email" value={accountData.email} onChange={handleAccountChange} placeholder="prenomnom@mail.eyefind.fr" style={fieldBoxStyle} />
                </Form.Group>
                {method !== 'gtaw' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Group className="mb-3" style={{ flex: 1 }}>
                            <Form.Label>Mot de passe</Form.Label>
                            <Form.Control type="password" name="password" value={accountData.password} onChange={handleAccountChange} style={fieldBoxStyle} />
                        </Form.Group>
                        <Form.Group className="mb-3" style={{ flex: 1 }}>
                            <Form.Label>Confirmation</Form.Label>
                            <Form.Control type="password" name="confirmPassword" value={accountData.confirmPassword} onChange={handleAccountChange} style={fieldBoxStyle} />
                        </Form.Group>
                    </div>
                )}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <Button variant="outline-secondary" onClick={() => { setMode('choice'); setMethod(null); setSelectedGtawCharacter(null); }} disabled={isSubmitting}>
                        Retour
                    </Button>
                    <Button variant="primary" onClick={handleCreateAccount} disabled={isSubmitting}>
                        {isSubmitting ? 'Création...' : 'Créer mon compte'}
                    </Button>
                </div>
            </Form>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
                <button
                    type="button"
                    onClick={onStartGtaw}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        backgroundColor: '#2a2a2a', border: '1px solid #ff8c00',
                        borderRadius: '8px', padding: '15px', color: '#fff',
                        cursor: 'pointer', textAlign: 'left'
                    }}
                >
                    <i className="fas fa-gamepad" style={{ fontSize: '1.4rem', color: '#ff8c00' }}></i>
                    <span>
                        <strong style={{ display: 'block' }}>Continuer avec GTA World</strong>
                        <span style={{ fontSize: '0.85em', color: '#ccc' }}>
                            Connexion ou création de compte selon votre personnage.
                        </span>
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => { setMethod('manual'); setMode('create'); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        backgroundColor: '#2a2a2a', border: '1px solid #444',
                        borderRadius: '8px', padding: '15px', color: '#fff',
                        cursor: 'pointer', textAlign: 'left'
                    }}
                >
                    <i className="fas fa-keyboard" style={{ fontSize: '1.4rem', color: '#6c757d' }}></i>
                    <span>
                        <strong style={{ display: 'block' }}>Créer un compte manuellement</strong>
                        <span style={{ fontSize: '0.85em', color: '#ccc' }}>
                            Remplissez vous-même vos informations.
                        </span>
                    </span>
                </button>
                <div style={{ textAlign: 'center' }}>
                    <Button variant="link" onClick={() => setMode('login')} style={{ color: '#4a9eff' }}>
                        J'ai déjà un compte Civil — me connecter
                    </Button>
                </div>
            </div>

            {gtawCharacters && (
                <GtawCharacterPicker
                    characters={gtawCharacters}
                    gtawResolutions={gtawResolutions}
                    onLogin={(customToken) => handleGtawLogin(customToken)}
                    onCreate={handleGtawCharacterForCreation}
                    onPending={() => showNotification('Une demande est déjà en attente pour ce personnage.', 'warning')}
                    onNoCharacters={() => showNotification('Aucun personnage n\'a été trouvé sur ce compte GTA World.', 'warning')}
                />
            )}
        </div>
    );
};

export default CivilianAuthPanel;
