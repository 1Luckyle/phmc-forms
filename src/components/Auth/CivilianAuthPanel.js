// src/components/Auth/CivilianAuthPanel.js
//
// Contenu de connexion / création de compte Civil, utilisé par l'étape
// CIVIL_AUTH d'OnboardingModal (choix Civil ou Candidat dans le Guide de
// Configuration — un compte Civil unique sert aux deux). Ne gère PAS elle-même
// la redirection OAuth GTA World : le parent lui fournit l'état déjà résolu
// (gtawCharacters/gtawResolutions/gtawUserId, partagés avec le flux Personnel/
// DMEC — un seul flux GTAW actif à la fois) et un déclencheur onStartGtaw.
//
// La création de compte Civil se fait UNIQUEMENT via GTA World (identité déjà
// vérifiée par le personnage choisi) — pas de création manuelle. L'adresse
// Eyefind Mail indiquée doit en plus être vérifiée par un code envoyé par mail
// avant que le compte ne soit créé (voir sendEmailVerificationCode/
// verifyEmailCode dans functions/index.js, et le filet de sécurité côté
// serveur dans createGtawCivilianAccount qui refuse toute création tant que
// l'email n'est pas marqué vérifié).
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../firebase';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { sendEmailVerificationCode, verifyEmailCode, EYEFIND_MAIL_SIGNUP_URL } from '../../utils/eyefindMail';
import GtawCharacterPicker from './GtawCharacterPicker';
import DebugFillButton from '../DebugFillButton';

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
    const { createCivilianAccountFromGtaw } = useEmployeeAuth();

    // 'choice' = écran initial (uniquement GTA World)
    // 'create' = formulaire d'identité + vérification email, pré-rempli via le
    //            personnage GTAW choisi (nom/prénom en lecture seule)
    const [mode, setMode] = useState('choice');
    const [selectedGtawCharacter, setSelectedGtawCharacter] = useState(null);
    const [accountData, setAccountData] = useState(emptyAccountData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // ID patient attribué à la création — affiché en lecture seule une fois le
    // compte créé (impossible de le montrer avant : il est généré par
    // generatePatientID() côté client, qui exige d'être déjà connecté — voir
    // EmployeeAuthContext.js).
    const [createdPatientID, setCreatedPatientID] = useState(null);

    // Vérification de l'adresse Eyefind Mail : un code est envoyé, doit être
    // ressaisi avant que le bouton "Créer mon compte" ne soit utilisable.
    const [emailCodeSent, setEmailCodeSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isVerifyingCode, setIsVerifyingCode] = useState(false);

    const EYEFIND_ADDRESS_REGEX = /^[^\s@]+@mail\.eyefind\.fr$/i;

    const handleAccountChange = (e) => {
        const { name, value } = e.target;
        setAccountData(prev => ({ ...prev, [name]: value }));
        // Modifier l'email après l'avoir vérifié invalide la vérification —
        // on ne veut jamais créer un compte avec une adresse différente de
        // celle réellement vérifiée.
        if (name === 'email') {
            setEmailCodeSent(false);
            setEmailVerified(false);
            setVerificationCode('');
        }
    };

    const handleDebugFill = () => {
        setAccountData(prev => ({
            ...prev,
            middleName: prev.middleName || 'Michel',
            dateOfBirth: '1990-05-17',
            gender: 'Male',
            address: '1234 Vinewood Blvd, Los Santos',
            zip: '90001',
            phone: '555-0142',
            discord: 'jean.testard',
            email: 'jean.testard.debug@mail.eyefind.fr',
        }));
        // Changer l'email invalide toute vérification précédente.
        setEmailCodeSent(false);
        setEmailVerified(false);
        setVerificationCode('');
    };

    const handleGtawCharacterForCreation = (character) => {
        setSelectedGtawCharacter(character);
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

    const handleSendVerificationCode = async () => {
        if (!EYEFIND_ADDRESS_REGEX.test(accountData.email.trim())) {
            showNotification('Adresse Eyefind Mail invalide (format attendu : prenomnom@mail.eyefind.fr).', 'warning');
            return;
        }
        setIsSendingCode(true);
        try {
            const result = await sendEmailVerificationCode(accountData.email.trim());
            if (result.ok) {
                setEmailCodeSent(true);
                showNotification('Code de vérification envoyé par mail.', 'success');
            } else {
                showNotification(result.message, 'error');
            }
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode.trim()) {
            showNotification('Veuillez entrer le code reçu par mail.', 'warning');
            return;
        }
        setIsVerifyingCode(true);
        try {
            const result = await verifyEmailCode(accountData.email.trim(), verificationCode.trim());
            if (result.ok) {
                setEmailVerified(true);
                showNotification('Adresse email vérifiée !', 'success');
            } else {
                showNotification(result.message, 'error');
            }
        } finally {
            setIsVerifyingCode(false);
        }
    };

    const handleCreateAccount = async () => {
        if (!emailVerified) {
            showNotification('Veuillez d\'abord vérifier votre adresse email.', 'warning');
            return;
        }
        const required = ['email', 'dateOfBirth', 'gender', 'address', 'zip', 'phone'];
        const missing = required.filter(f => !accountData[f]?.trim());
        if (missing.length > 0) {
            showNotification('Veuillez remplir tous les champs requis.', 'warning');
            return;
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

            const result = await createCivilianAccountFromGtaw(civilianData, accountData.email, selectedGtawCharacter?.id ?? null, gtawUserId ?? null);

            showNotification('Compte Civil créé avec succès !', 'success');
            setCreatedPatientID(result?.civilianData?.patientID || null);
            setMode('created');
        } catch (error) {
            console.error('Error creating civilian account:', error);
            let msg = 'Erreur lors de la création du compte.';
            if (error.code === 'auth/email-already-in-use' || error.error === 'email-already-exists') {
                msg = 'Cet email est déjà utilisé.';
            } else if (error.error === 'email-not-verified') {
                msg = 'Cette adresse email n\'a pas été vérifiée. Veuillez recommencer la vérification.';
                setEmailVerified(false);
                setEmailCodeSent(false);
            } else if (error.code === 'auth/invalid-email') {
                msg = 'Email invalide.';
            } else if (error.message) {
                msg = error.message;
            }
            showNotification(msg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (mode === 'created') {
        return (
            <div>
                <div style={{ marginBottom: '15px', color: '#3fb950' }}>
                    <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i>
                    Votre compte Civil a été créé avec succès !
                </div>
                <Form.Group className="mb-3">
                    <Form.Label>Votre ID Patient</Form.Label>
                    <Form.Control type="text" value={createdPatientID || ''} disabled style={fieldBoxStyle} />
                    <div style={{ fontSize: '0.85em', color: '#ccc', marginTop: '4px' }}>
                        Conservez cet identifiant : il vous sera demandé sur les formulaires médicaux et de candidature.
                    </div>
                </Form.Group>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="primary" onClick={onAuthenticated}>
                        Continuer
                    </Button>
                </div>
            </div>
        );
    }

    if (mode === 'create') {
        return (
            <Form>
                {selectedGtawCharacter && (
                    <div style={{ marginBottom: '15px', color: '#ffc107' }}>
                        <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i>
                        Identité vérifiée via GTA World : <strong>{selectedGtawCharacter.firstname} {selectedGtawCharacter.lastname}</strong>
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
                        <Form.Select name="gender" value={accountData.gender} onChange={handleAccountChange} style={fieldBoxStyle}>
                            <option value="" disabled>Sélectionner...</option>
                            <option value="Male">Homme</option>
                            <option value="Female">Femme</option>
                            <option value="Other">Autre</option>
                        </Form.Select>
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

                <Form.Group className="mb-2">
                    <Form.Label>Adresse Eyefind Mail</Form.Label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="email" name="email" value={accountData.email} onChange={handleAccountChange}
                            placeholder="prenomnom@mail.eyefind.fr" style={fieldBoxStyle}
                            disabled={emailCodeSent}
                        />
                        <Button variant="outline-primary" onClick={handleSendVerificationCode} disabled={isSendingCode || emailCodeSent}>
                            {isSendingCode ? 'Envoi...' : (emailCodeSent ? 'Code envoyé' : 'Envoyer le code')}
                        </Button>
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#ccc', marginTop: '4px' }}>
                        Pas encore d'adresse Eyefind Mail ?{' '}
                        <a href={EYEFIND_MAIL_SIGNUP_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff' }}>
                            Créez-en une ici
                        </a>.
                    </div>
                </Form.Group>

                {emailCodeSent && !emailVerified && (
                    <Form.Group className="mb-3">
                        <Form.Label>Code de vérification reçu par mail</Form.Label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)}
                                placeholder="123456" style={fieldBoxStyle}
                            />
                            <Button variant="primary" onClick={handleVerifyCode} disabled={isVerifyingCode}>
                                {isVerifyingCode ? 'Vérification...' : 'Vérifier'}
                            </Button>
                        </div>
                        <Button
                            variant="link" size="sm" onClick={handleSendVerificationCode} disabled={isSendingCode}
                            style={{ color: '#4a9eff', padding: 0, marginTop: '5px' }}
                        >
                            Renvoyer le code
                        </Button>
                    </Form.Group>
                )}

                {emailVerified && (
                    <div style={{ marginBottom: '15px', color: '#3fb950' }}>
                        <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i>
                        Adresse email vérifiée.
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    {/* Mode debug : remplit l'identité. La vérification du code envoyé
                        par mail reste obligatoire (contrôlée côté serveur). */}
                    <DebugFillButton onFill={handleDebugFill} />
                    <Button variant="outline-secondary" onClick={() => { setMode('choice'); setSelectedGtawCharacter(null); }} disabled={isSubmitting}>
                        Retour
                    </Button>
                    <Button variant="primary" onClick={handleCreateAccount} disabled={isSubmitting || !emailVerified}>
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
                            Connexion ou création de compte selon votre personnage. Seule méthode disponible pour un compte Civil.
                        </span>
                    </span>
                </button>
                <div style={{ fontSize: '0.85em', color: '#ccc', textAlign: 'center' }}>
                    Pas encore d'adresse Eyefind Mail ?{' '}
                    <a href={EYEFIND_MAIL_SIGNUP_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#4a9eff' }}>
                        Créez-en une ici
                    </a>.
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
