// src/components/Admin/AdminDashboard.js
//
// Panneau d'administration. Le menu de gauche regroupe les sections par thème (À traiter, Personnes & accès, Site, Outils,
// Développement) avec une recherche et des pastilles pour ce qui attend une action ; la page « Vue d'ensemble » résume l'état du
// site. Les clés de section (« debug », « users »…) sont stables : d'autres écrans y renvoient (voir adminNavigation.js).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import './AdminDashboard.css';
import '../DarkUi.css';
import DatabaseEditor from './DatabaseEditor';
import WebhookLogs from './WebhookLogs';
import PendingAccountRequests from './PendingAccountRequests';
import PendingModificationRequests from './PendingModificationRequests';
import { useDebug } from '../../contexts/DebugContext';
import { useSiteConfig } from '../../contexts/SiteConfigContext';
import UsersHub from './users/UsersHub';
import DebugWhitelist from './DebugWhitelist';
import DebugSeasonTester from './DebugSeasonTester';
import DebugViewAs from './DebugViewAs';
import PendingImageDeletions, { useImgbbQueueCount } from './PendingImageDeletions';
import BbcodeAccessSwitch from './BbcodeAccessSwitch';
import AdminOverview from './AdminOverview';
import useAdminCounts from './useAdminCounts';
import { ADMIN_SECTION_GROUPS, ALL_ADMIN_SECTIONS, findAdminSection, filterAdminSections } from './adminNavigation';
import { seedDefaultBingoPhrases } from '../../utils/bingoDefaults';
import ActivityLog from './ActivityLog';
import SiteRequests from './SiteRequests';
import { logAdminAction } from '../../utils/activityLog';
import CctvRequestsPanel from '../Cctv/CctvRequestsPanel';

const LAST_SECTION_KEY = 'adminLastSection';

// Déploiements du site qu'un confinement peut viser (« all » = tous). « tous » et « phmc-tools » sont d'anciennes valeurs.
const LOCKDOWN_DEPLOYMENTS = [
    { value: 'all', label: 'Tous les déploiements', hint: 'Le site en ligne comme les tests en local' },
    { value: 'github-pages', label: 'Site en ligne', hint: 'Version publiée (GitHub Pages)' },
    { value: 'local', label: 'Développement local', hint: 'Les tests sur un ordinateur' },
];

const DEBUG_TABS = [
    { key: 'autofill', label: 'Remplissage de test', icon: 'fa-wand-magic-sparkles' },
    { key: 'applications', label: 'Suppression de candidatures', icon: 'fa-trash-can' },
    { key: 'season', label: 'Effets de saison', icon: 'fa-snowflake' },
    { key: 'viewas', label: 'Visualiser en tant que', icon: 'fa-eye' },
];

const isKnownSection = (key) => ALL_ADMIN_SECTIONS.some((section) => section.key === key);

const readLastSection = () => {
    try {
        const stored = sessionStorage.getItem(LAST_SECTION_KEY);
        return isKnownSection(stored) ? stored : null;
    } catch (error) { return null; }
};

// Cadre d'une page de section : icône, titre, description et zone d'actions éventuelle.
const SectionCard = ({ icon, title, description, actions, children }) => (
    <div className="adm-card">
        <div className="adm-card-head">
            <div>
                <h4><i className={`fas ${icon}`}></i> {title}</h4>
                {description && <p>{description}</p>}
            </div>
            {actions && <div className="adm-card-actions">{actions}</div>}
        </div>
        <div className="adm-card-body">{children}</div>
    </div>
);

// Interrupteur avec son texte d'état.
const SwitchRow = ({ id, checked, disabled, onChange, label, state, stateTone = 'ok', busy }) => (
    <div className="adm-switch-row">
        <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" role="switch" id={id} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
            <label className="form-check-label" htmlFor={id}>
                {label}{busy && <Spinner as="span" animation="border" size="sm" className="ms-2" />}
            </label>
        </div>
        {state && <span className={`adm-chip adm-chip-${stateTone}`}>{state}</span>}
    </div>
);

const AdminDashboard = ({
    currentUser,
    desktopNotificationPermission,
    handleEnableDesktopNotifications,
    isLoadingStatus,
    formGeneratorStatus,
    setFormGeneratorStatus,
    alternativeFormGeneratorStatus,
    setAlternativeFormGeneratorStatus,
    localHostStatus,
    setLocalHostStatus,
    handleUpdateServiceStatus,
    isUpdatingDb,
    selectedAdminBingoType,
    setSelectedAdminBingoType,
    BINGO_TYPES,
    handleManualResetAllBingoCards,
    handleGenerateNewBingoCard,
    handleClearBingoActivity,
    handleDisableBingoCard,
    setShowEditBingoPhrasesModal,
    selectedTypeForEdit,
    setShowReviewPhrasesModal,
    setShowUserManagementModal,

    setShowMarkdownModal,
    handleLogout,
    Sentry,
    showInAppNotification,
    setShowUserDataExchangeModal,
    lockdownConfig,
    setLockdownConfig,
    handleUpdateLockdownStatus,
    authConfig,
    setAuthConfig,
    handleUpdateAuthConfig,
    webhooks,
    newWebhook,
    setNewWebhook,
    handleAddWebhook,
    handleDeleteWebhook,
    isUpdatingWebhooks,
    customWebhookChannel,
    setCustomWebhookChannel,
    customWebhookTitle,
    setCustomWebhookTitle,
    customWebhookMessage,
    setCustomWebhookMessage,
    customWebhookUrl,
    setCustomWebhookUrl,
    customWebhookSending,
    customWebhookResult,
    handleSendCustomWebhook,
    logRefreshTrigger
}) => {
    const location = useLocation();
    const navigate = useNavigate();

    // Section ouverte : imposée par la navigation (ex. retour de « Visualiser en tant que »), sinon la dernière visitée, sinon la vue d'ensemble.
    const [selectedSection, setSelectedSection] = useState(
        (isKnownSection(location.state?.section) && location.state.section) || readLastSection() || 'overview'
    );
    const [debugTab, setDebugTab] = useState(location.state?.debugTab || 'autofill');
    const [query, setQuery] = useState('');
    const searchRef = useRef(null);
    const [testWebhookData, setTestWebhookData] = useState({ title: '', message: '', selectedWebhook: null });

    const imageCount = useImgbbQueueCount();
    const counts = useAdminCounts();
    const { bbcodeEnabled } = useSiteConfig();
    const badgeValues = { accounts: counts.accounts, modifications: counts.modifications, images: imageCount, requests: counts.requests, cctv: counts.cctv };

    const { debugAutofillEnabled, setDebugAutofillEnabled, debugDeleteApplicationsEnabled, setDebugDeleteApplicationsEnabled } = useDebug();
    const [isUpdatingDeleteDebug, setIsUpdatingDeleteDebug] = useState(false);
    const [isUpdatingDebug, setIsUpdatingDebug] = useState(false);
    const [isSeedingPhrases, setIsSeedingPhrases] = useState(false);

    const current = findAdminSection(selectedSection);

    // Phrases par défaut du bingo : n'ajoute que celles qui manquent (voir utils/bingoDefaults.js).
    const addDefaultPhrases = async (types) => {
        if (!types.length || isSeedingPhrases) return;
        setIsSeedingPhrases(true);
        try {
            const results = await seedDefaultBingoPhrases(types);
            const summary = results.map((r) => `${r.name} : +${r.added} (total ${r.total})`).join(' · ');
            showInAppNotification(`Phrases par défaut ajoutées — ${summary}`, 'success');
        } catch (error) {
            console.error('Ajout des phrases par défaut impossible :', error);
            showInAppNotification(`Impossible d'ajouter les phrases par défaut : ${error.message}`, 'error');
        } finally {
            setIsSeedingPhrases(false);
        }
    };
    const searchResults = useMemo(() => filterAdminSections(query), [query]);

    const openSection = (key) => {
        setSelectedSection(key);
        try { sessionStorage.setItem(LAST_SECTION_KEY, key); } catch (error) { /* stockage indisponible */ }
        setQuery('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Raccourci clavier : « / » place le curseur dans la recherche du menu.
    useEffect(() => {
        const onKeyDown = (event) => {
            const tag = (event.target && event.target.tagName) || '';
            if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
                event.preventDefault();
                if (searchRef.current) searchRef.current.focus();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const handleTestWebhook = async (webhook) => {
        if (!testWebhookData.title || !testWebhookData.message) {
            alert('Veuillez remplir les champs titre et message.');
            return;
        }

        try {
            const payload = {
                embeds: [{
                    title: testWebhookData.title,
                    description: testWebhookData.message,
                    color: 3447003,
                    timestamp: new Date().toISOString()
                }]
            };

            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert('Webhook de test envoyé avec succès !');
                setTestWebhookData({ title: '', message: '', selectedWebhook: null });
            } else {
                alert(`Échec de l'envoi du webhook : ${response.status}`);
            }
        } catch (error) {
            console.error('Error sending test webhook:', error);
            alert('Erreur lors de l\'envoi du webhook de test');
        }
    };

    const handleToggleDeleteApplications = async (enabled) => {
        setIsUpdatingDeleteDebug(true);
        try {
            await setDebugDeleteApplicationsEnabled(enabled, currentUser?.email);
            if (showInAppNotification) {
                showInAppNotification(`Suppression des candidatures ${enabled ? 'activée' : 'désactivée'}.`, enabled ? 'check-circle' : 'info-circle');
            }
        } catch (error) {
            console.error('Error updating debug delete applications setting:', error);
            alert('Impossible de modifier ce réglage : ' + (error?.message || error));
        } finally {
            setIsUpdatingDeleteDebug(false);
        }
    };

    const handleToggleDebugAutofill = async (enabled) => {
        setIsUpdatingDebug(true);
        try {
            await setDebugAutofillEnabled(enabled, currentUser?.email);
            if (showInAppNotification) {
                showInAppNotification(`Mode debug ${enabled ? 'activé' : 'désactivé'} (liste blanche uniquement).`, enabled ? 'check-circle' : 'info-circle');
            }
        } catch (error) {
            console.error('Error updating debug autofill setting:', error);
            if (Sentry?.captureException) Sentry.captureException(error, { extra: { context: 'toggleDebugAutofill' } });
            alert("Impossible de modifier le mode debug : " + (error?.message || error));
        } finally {
            setIsUpdatingDebug(false);
        }
    };

    // Confinement : les valeurs d'avant (« tous », « phmc-tools ») sont remplacées par « all » ; seul « all », « github-pages » et « local » existent.
    const lockdownDeployments = (lockdownConfig.affectedDeployments || []).map((value) => (value === 'tous' ? 'all' : value));
    const toggleDeployment = (value, checked) => {
        setLockdownConfig((previous) => {
            const base = (previous.affectedDeployments || []).map((entry) => (entry === 'tous' ? 'all' : entry)).filter((entry) => entry !== 'phmc-tools');
            const next = checked ? [...new Set([...base, value])] : base.filter((entry) => entry !== value);
            return { ...previous, affectedDeployments: next };
        });
    };

    const renderSection = () => {
        switch (selectedSection) {
            case 'overview':
                return (
                    <AdminOverview
                        counts={counts}
                        imageCount={imageCount}
                        lockdownConfig={lockdownConfig}
                        bbcodeEnabled={bbcodeEnabled}
                        authConfig={authConfig}
                        debugAutofillEnabled={debugAutofillEnabled}
                        debugDeleteApplicationsEnabled={debugDeleteApplicationsEnabled}
                        onOpen={openSection}
                    />
                );

            case 'pendingAccounts':
                return <div className="adm-card"><div className="adm-card-body"><PendingAccountRequests showNotification={showInAppNotification} currentUser={currentUser} /></div></div>;

            case 'pendingModifications':
                return <div className="adm-card"><div className="adm-card-body"><PendingModificationRequests showNotification={showInAppNotification} currentUser={currentUser} /></div></div>;

            case 'imageCleanup':
                return <div className="adm-card"><div className="adm-card-body"><PendingImageDeletions showNotification={showInAppNotification} /></div></div>;

            case 'users':
                return (
                    <UsersHub
                        currentUser={currentUser}
                        showNotification={showInAppNotification}
                        onOpenMigrationTools={() => setShowUserManagementModal(true)}
                    />
                );

            case 'authMethods':
                return (
                    <SectionCard icon={current.icon} title={current.label} description={current.description}>
                        <p className="text-muted">
                            Par défaut, seule la connexion et la création de compte via GTA World sont proposées au personnel (fenêtre de connexion et
                            guide de configuration). La connexion au panneau admin garde toujours les deux méthodes, quel que soit ce réglage.
                        </p>
                        <SwitchRow
                            id="authMethodsSwitch"
                            checked={!authConfig.gtawOnly}
                            onChange={(checked) => setAuthConfig((previous) => ({ ...previous, gtawOnly: !checked }))}
                            label="Autoriser aussi la connexion et la création de compte par e-mail et mot de passe"
                            state={authConfig.gtawOnly ? 'GTA World uniquement' : 'GTA World + e-mail'}
                            stateTone="neutral"
                        />
                        <Button variant="primary" onClick={handleUpdateAuthConfig} disabled={isUpdatingDb}>
                            {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer'}
                        </Button>
                    </SectionCard>
                );

            case 'serviceStatus':
                return (
                    <SectionCard icon={current.icon} title={current.label} description={current.description}>
                        {isLoadingStatus ? (
                            <Spinner animation="border" size="sm" />
                        ) : (
                            <div className="adm-form-grid">
                                <div className="form-group">
                                    <label>Générateur de formulaires (site principal)</label>
                                    <input type="text" value={formGeneratorStatus} onChange={(event) => setFormGeneratorStatus(event.target.value)} placeholder="ex. Entièrement mis à jour" className="form-control" />
                                </div>
                                <div className="form-group">
                                    <label>Générateur de formulaires (adresse alternative)</label>
                                    <input type="text" value={alternativeFormGeneratorStatus} onChange={(event) => setAlternativeFormGeneratorStatus(event.target.value)} placeholder="ex. Mises à jour différées" className="form-control" />
                                </div>
                                <div className="form-group">
                                    <label>Localhost / staging</label>
                                    <input type="text" value={localHostStatus} onChange={(event) => setLocalHostStatus(event.target.value)} placeholder="ex. En développement" className="form-control" />
                                </div>
                            </div>
                        )}
                        <Button variant="primary" onClick={handleUpdateServiceStatus} disabled={isUpdatingDb || isLoadingStatus}>
                            {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer les statuts'}
                        </Button>
                    </SectionCard>
                );

            case 'lockdown':
                return (
                    <SectionCard icon={current.icon} title={current.label} description={current.description}>
                        <SwitchRow
                            id="lockdownSwitch"
                            checked={!!lockdownConfig.enabled}
                            onChange={(checked) => setLockdownConfig((previous) => ({ ...previous, enabled: checked }))}
                            label="Activer le verrouillage du site"
                            state={lockdownConfig.enabled ? 'ACTIF' : 'inactif'}
                            stateTone={lockdownConfig.enabled ? 'alert' : 'ok'}
                        />
                        <div className="adm-form-grid">
                            <div className="form-group">
                                <label>Bandeau de notification</label>
                                <input
                                    type="text"
                                    value={lockdownConfig.notification}
                                    onChange={(event) => setLockdownConfig((previous) => ({ ...previous, notification: event.target.value }))}
                                    placeholder="ex. Le site est actuellement en maintenance."
                                    className="form-control"
                                />
                            </div>
                            <div className="form-group">
                                <label>Message de la fenêtre qui s'affiche aux visiteurs</label>
                                <textarea
                                    value={lockdownConfig.dialog}
                                    onChange={(event) => setLockdownConfig((previous) => ({ ...previous, dialog: event.target.value }))}
                                    placeholder="ex. Les formulaires sont temporairement indisponibles."
                                    className="form-control"
                                    rows="3"
                                ></textarea>
                            </div>
                        </div>
                        <div className="adm-fieldset">
                            <div className="adm-fieldset-title">Déploiements concernés</div>
                            {LOCKDOWN_DEPLOYMENTS.map((deployment) => (
                                <div className="form-check" key={deployment.value}>
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`deployment-${deployment.value}`}
                                        checked={lockdownDeployments.includes(deployment.value)}
                                        onChange={(event) => toggleDeployment(deployment.value, event.target.checked)}
                                    />
                                    <label className="form-check-label" htmlFor={`deployment-${deployment.value}`}>
                                        {deployment.label} <small className="text-muted">— {deployment.hint}</small>
                                    </label>
                                </div>
                            ))}
                        </div>
                        <Button variant="primary" onClick={handleUpdateLockdownStatus} disabled={isUpdatingDb}>
                            {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer le confinement'}
                        </Button>
                    </SectionCard>
                );

            case 'display':
                return <BbcodeAccessSwitch currentUser={currentUser} showInAppNotification={showInAppNotification} />;

            case 'activity':
                return (
                    <ActivityLog
                        showNotification={showInAppNotification}
                        onLogAction={(action, details) => logAdminAction({ email: currentUser?.email, action, details })}
                    />
                );

            case 'cctv':
                return (
                    <div className="adm-card">
                        <div className="adm-card-head">
                            <div>
                                <h4><i className="fas fa-video"></i> Vidéosurveillance</h4>
                                <p>Demandes d'images de caméras. L'administration du PHMC (Directeur(trice), Assistant(e) de Direction, Personnel Administratif) peut aussi les traiter depuis le site.</p>
                            </div>
                        </div>
                        <div className="adm-card-body"><CctvRequestsPanel scope="all" /></div>
                    </div>
                );

            case 'errors':
                return (
                    <ActivityLog
                        title="Erreurs du site"
                        icon="fa-triangle-exclamation"
                        subtitle="Erreurs rencontrées par les utilisateurs connectés : page, navigateur et pile d'appels. Les doublons sont regroupés par minute."
                        initialCategories={['erreurs']}
                        initialPeriod="30d"
                        showNotification={showInAppNotification}
                        onLogAction={(action, details) => logAdminAction({ email: currentUser?.email, action, details })}
                    />
                );

            case 'siteRequests':
                return (
                    <SiteRequests
                        currentUser={currentUser}
                        showNotification={showInAppNotification}
                        onLogAction={(action, details) => logAdminAction({ email: currentUser?.email, action, details })}
                    />
                );

            case 'bingo':
                return (
                    <SectionCard icon={current.icon} title={current.label} description={current.description}>
                        <div className="adm-form-grid">
                            <div className="form-group">
                                <label>Type de bingo</label>
                                <select value={selectedAdminBingoType} onChange={(event) => setSelectedAdminBingoType(event.target.value)} disabled={isUpdatingDb} className="form-select">
                                    {BINGO_TYPES.map((type) => (
                                        <option key={type.id} value={type.id}>{type.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <p className="text-muted small">
                            <i className="fas fa-clock me-1"></i> La réinitialisation quotidienne s'exécute automatiquement sur le serveur à 09:00 UTC.
                        </p>

                        <div className="adm-actions-grid">
                            <div className="adm-fieldset">
                                <div className="adm-fieldset-title">Cartes</div>
                                <div className="adm-button-stack">
                                    <Button variant="primary" onClick={handleGenerateNewBingoCard} disabled={isUpdatingDb}>
                                        <i className="fas fa-sync-alt"></i> Générer une nouvelle carte
                                    </Button>
                                    <Button variant="secondary" onClick={handleManualResetAllBingoCards} disabled={isUpdatingDb} title="Exécuter manuellement la réinitialisation quotidienne pour toutes les cartes de bingo actives.">
                                        <i className="fas fa-rotate-left"></i> Réinitialiser toutes les cartes
                                    </Button>
                                    <Button variant="warning" onClick={handleDisableBingoCard} disabled={isUpdatingDb} title="Supprime la carte actuelle et le journal : le jeu est désactivé jusqu'à ce qu'une nouvelle carte soit générée.">
                                        <i className="fas fa-power-off"></i> Désactiver la carte
                                    </Button>
                                </div>
                            </div>
                            <div className="adm-fieldset">
                                <div className="adm-fieldset-title">Phrases</div>
                                <div className="adm-button-stack">
                                    <Button variant="info" onClick={() => setShowEditBingoPhrasesModal(true)} disabled={isUpdatingDb || !selectedAdminBingoType}>
                                        <i className="fas fa-pen"></i> Modifier les phrases {selectedTypeForEdit?.name || 'Master'}
                                    </Button>
                                    <Button variant="warning" onClick={() => setShowReviewPhrasesModal(true)} disabled={isUpdatingDb}>
                                        <i className="fas fa-inbox"></i> Demandes de révision de phrases
                                    </Button>
                                    <Button variant="success" onClick={() => addDefaultPhrases(selectedTypeForEdit ? [selectedTypeForEdit] : [])} disabled={isUpdatingDb || isSeedingPhrases || !selectedTypeForEdit} title="Ajoute les 24 phrases par défaut à la liste du bingo sélectionné. Les phrases déjà présentes sont conservées.">
                                        <i className="fas fa-wand-magic-sparkles"></i> Ajouter les 24 phrases par défaut ({selectedTypeForEdit?.name})
                                    </Button>
                                    <Button variant="outline-success" onClick={() => addDefaultPhrases(BINGO_TYPES)} disabled={isUpdatingDb || isSeedingPhrases} title="Ajoute les phrases par défaut aux trois cartes (Urgences, EMS, Coroner), sans toucher à l'existant.">
                                        <i className="fas fa-layer-group"></i> Phrases par défaut pour toutes les cartes
                                    </Button>
                                </div>
                            </div>
                            <div className="adm-fieldset adm-fieldset-danger">
                                <div className="adm-fieldset-title">Zone sensible</div>
                                <div className="adm-button-stack">
                                    <Button variant="danger" onClick={handleClearBingoActivity} disabled={isUpdatingDb}>
                                        <i className="fas fa-trash-can"></i> Effacer le journal d'activité
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                );

            case 'webhooks':
                return (
                    <>
                        <SectionCard icon={current.icon} title={current.label} description={current.description}>
                            <h5 className="adm-subtitle">Webhooks existants</h5>
                            {webhooks && webhooks.length > 0 ? (
                                <ul className="adm-list">
                                    {webhooks.map((hook) => (
                                        <li key={hook.id}>
                                            <div className="adm-list-row">
                                                <div>
                                                    <strong>{hook.name}</strong> <span className="adm-chip adm-chip-neutral">{hook.type}</span>
                                                    <div className="adm-list-url">{hook.url}</div>
                                                </div>
                                                <div className="adm-list-actions">
                                                    <Button
                                                        variant="outline-secondary" size="sm" disabled={isUpdatingWebhooks} title="Modifier la configuration du webhook"
                                                        onClick={() => {
                                                            setNewWebhook({ name: hook.name, url: hook.url, type: hook.type, id: hook.id });
                                                            const form = document.getElementById('adm-webhook-form');
                                                            if (form) form.scrollIntoView({ behavior: 'smooth' });
                                                        }}
                                                    >
                                                        <i className="fas fa-pen"></i> Modifier
                                                    </Button>
                                                    <Button variant="outline-primary" size="sm" disabled={isUpdatingWebhooks} onClick={() => setTestWebhookData((previous) => ({ ...previous, selectedWebhook: hook }))}>
                                                        <i className="fas fa-vial"></i> Tester
                                                    </Button>
                                                    <Button variant="outline-danger" size="sm" disabled={isUpdatingWebhooks} onClick={() => handleDeleteWebhook(hook.id)}>
                                                        <i className="fas fa-trash-can"></i>
                                                    </Button>
                                                </div>
                                            </div>
                                            {testWebhookData.selectedWebhook?.id === hook.id && (
                                                <div className="adm-panel">
                                                    <h6>Tester le webhook : {hook.name}</h6>
                                                    <div className="form-group mb-2">
                                                        <label>Titre du test</label>
                                                        <input type="text" className="form-control" placeholder="Titre du message de test" value={testWebhookData.title} onChange={(event) => setTestWebhookData((previous) => ({ ...previous, title: event.target.value }))} />
                                                    </div>
                                                    <div className="form-group mb-2">
                                                        <label>Message de test</label>
                                                        <textarea className="form-control" rows="3" placeholder="Contenu du message de test" value={testWebhookData.message} onChange={(event) => setTestWebhookData((previous) => ({ ...previous, message: event.target.value }))} />
                                                    </div>
                                                    <div className="d-flex gap-2">
                                                        <Button variant="success" size="sm" onClick={() => handleTestWebhook(hook)}>Envoyer le test</Button>
                                                        <Button variant="secondary" size="sm" onClick={() => setTestWebhookData((previous) => ({ ...previous, selectedWebhook: null, title: '', message: '' }))}>Annuler</Button>
                                                    </div>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted">Aucun webhook configuré.</p>
                            )}

                            <div className="adm-panel" id="adm-webhook-form">
                                <h5 className="adm-subtitle">{newWebhook.id ? 'Modifier le webhook' : 'Ajouter un webhook'}</h5>
                                {newWebhook.id && (
                                    <div className="adm-notice">
                                        <i className="fas fa-circle-info me-2"></i>Modification de <strong>{newWebhook.name}</strong>
                                        <button type="button" className="btn btn-sm btn-outline-secondary ms-2" onClick={() => setNewWebhook({ name: '', url: '', type: 'coronerAlerts' })}>Annuler la modification</button>
                                    </div>
                                )}
                                <div className="adm-form-grid">
                                    <div className="form-group">
                                        <label>Nom du webhook</label>
                                        <input type="text" className="form-control" placeholder="ex. Notifications Discord" value={newWebhook.name} onChange={(event) => setNewWebhook((previous) => ({ ...previous, name: event.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label>Type d'événement</label>
                                        <select className="form-select" value={newWebhook.type} onChange={(event) => setNewWebhook((previous) => ({ ...previous, type: event.target.value }))}>
                                            <option value="coronerAlerts">Alertes Coroner</option>
                                            <option value="phmcAlerts">Alertes PHMC</option>
                                            <option value="dev">Développeur local de Discord</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group mb-3">
                                    <label>URL du webhook</label>
                                    <input type="url" className="form-control" placeholder="https://discord.com/api/webhooks/..." value={newWebhook.url} onChange={(event) => setNewWebhook((previous) => ({ ...previous, url: event.target.value }))} />
                                </div>
                                <div className="d-flex gap-2">
                                    <Button variant="primary" onClick={handleAddWebhook} disabled={isUpdatingWebhooks}>
                                        {isUpdatingWebhooks ? <Spinner as="span" animation="border" size="sm" /> : (newWebhook.id ? 'Mettre à jour le webhook' : 'Ajouter le webhook')}
                                    </Button>
                                    {newWebhook.id && (
                                        <Button variant="secondary" onClick={() => setNewWebhook({ name: '', url: '', type: 'coronerAlerts' })} disabled={isUpdatingWebhooks}>Annuler</Button>
                                    )}
                                </div>
                            </div>

                            <div className="adm-panel">
                                <h5 className="adm-subtitle">Envoyer un message personnalisé</h5>
                                <form onSubmit={handleSendCustomWebhook}>
                                    <div className="adm-form-grid">
                                        <div className="form-group">
                                            <label htmlFor="webhookChannel">Webhook</label>
                                            <select id="webhookChannel" className="form-select" value={customWebhookChannel} onChange={(event) => setCustomWebhookChannel(event.target.value)} disabled={customWebhookSending}>
                                                <option value="">Sélectionnez un webhook…</option>
                                                {webhooks && webhooks.map((hook) => (
                                                    <option key={hook.id} value={hook.id}>{hook.name} ({hook.type})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="webhookTitle">Titre</label>
                                            <input id="webhookTitle" className="form-control" type="text" value={customWebhookTitle} onChange={(event) => setCustomWebhookTitle(event.target.value)} placeholder="Entrez le titre" required disabled={customWebhookSending} />
                                        </div>
                                    </div>
                                    <div className="form-group mb-2">
                                        <label htmlFor="webhookMessage">Message</label>
                                        <textarea id="webhookMessage" className="form-control" rows="4" value={customWebhookMessage} onChange={(event) => setCustomWebhookMessage(event.target.value)} placeholder="Entrez le message (Markdown pris en charge)" required disabled={customWebhookSending} />
                                    </div>
                                    <div className="form-group mb-3">
                                        <label htmlFor="webhookUrl">Lien (facultatif)</label>
                                        <input id="webhookUrl" className="form-control" type="url" value={customWebhookUrl} onChange={(event) => setCustomWebhookUrl(event.target.value)} placeholder="https://…" disabled={customWebhookSending} />
                                    </div>
                                    <button type="submit" className="btn btn-primary" disabled={customWebhookSending || !customWebhookChannel || !customWebhookTitle || !customWebhookMessage}>
                                        {customWebhookSending ? 'Envoi en cours…' : 'Envoyer le message'}
                                    </button>
                                    <small className="text-muted d-block mt-2">
                                        <i className="fas fa-circle-info me-1"></i>Le message est mis en forme aux couleurs du PHMC, avec un lien vers le générateur et l'horodatage.
                                    </small>
                                    {customWebhookResult === 'success' && <div className="alert alert-success mt-2 mb-0 py-1">Message envoyé !</div>}
                                    {customWebhookResult === 'error' && <div className="alert alert-danger mt-2 mb-0 py-1">Échec de l'envoi. Vérifiez la configuration du canal et réessayez.</div>}
                                </form>
                            </div>
                        </SectionCard>
                        <WebhookLogs refreshTrigger={logRefreshTrigger} />
                    </>
                );

            case 'database':
                return <DatabaseEditor showNotification={showInAppNotification} />;

            case 'debug':
                return (
                    <SectionCard icon={current.icon} title={current.label} description={current.description}>
                        <div className="adm-tabs" role="tablist">
                            {DEBUG_TABS.map((tab) => (
                                <button key={tab.key} type="button" role="tab" aria-selected={debugTab === tab.key} className={`adm-tab ${debugTab === tab.key ? 'active' : ''}`} onClick={() => setDebugTab(tab.key)}>
                                    <i className={`fas ${tab.icon}`}></i> {tab.label}
                                </button>
                            ))}
                        </div>

                        {debugTab === 'autofill' && (
                            <>
                                <p className="text-muted">
                                    Quand il est activé, <strong>les personnes de la liste blanche</strong> voient un bouton « Remplir (debug) » sur chaque formulaire
                                    (rapports, e-mails, candidatures, dossiers civils) et dans les fenêtres (création de compte, demandes…). Il remplit le formulaire
                                    avec des données de test sans rien envoyer ni enregistrer. Les autres utilisateurs ne voient jamais le bouton.
                                </p>
                                <SwitchRow
                                    id="debugAutofillSwitch"
                                    checked={debugAutofillEnabled}
                                    disabled={isUpdatingDebug}
                                    onChange={handleToggleDebugAutofill}
                                    label="Activer le bouton « Remplir (debug) » pour la liste blanche"
                                    busy={isUpdatingDebug}
                                    state={debugAutofillEnabled ? 'ACTIVÉ (liste blanche)' : 'désactivé'}
                                    stateTone={debugAutofillEnabled ? 'warn' : 'ok'}
                                />
                                <DebugWhitelist currentUser={currentUser} showInAppNotification={showInAppNotification} />
                            </>
                        )}

                        {debugTab === 'applications' && (
                            <>
                                <p className="text-muted">
                                    Quand cet interrupteur est activé, un bouton « Supprimer » apparaît dans l'historique des candidatures : chaque candidat peut
                                    supprimer les siennes (« Mes candidatures ») et les admins et recruteurs celles de la liste de gestion. Utile pour nettoyer
                                    les candidatures de test ; à désactiver ensuite, car la suppression est définitive.
                                </p>
                                <SwitchRow
                                    id="debugDeleteApplicationsSwitch"
                                    checked={debugDeleteApplicationsEnabled}
                                    disabled={isUpdatingDeleteDebug}
                                    onChange={handleToggleDeleteApplications}
                                    label="Autoriser la suppression des candidatures"
                                    busy={isUpdatingDeleteDebug}
                                    state={debugDeleteApplicationsEnabled ? 'ACTIVÉE' : 'désactivée'}
                                    stateTone={debugDeleteApplicationsEnabled ? 'warn' : 'ok'}
                                />
                            </>
                        )}

                        {debugTab === 'season' && <DebugSeasonTester showInAppNotification={showInAppNotification} />}
                        {debugTab === 'viewas' && <DebugViewAs showInAppNotification={showInAppNotification} />}
                    </SectionCard>
                );

            case 'dev':
                return (
                    <SectionCard icon={current.icon} title={current.label} description={current.description}>
                        <div className="adm-actions-grid">
                            <div className="adm-fieldset">
                                <div className="adm-fieldset-title">Données</div>
                                <p className="text-muted small">Exporter ou importer les données d'un utilisateur (migration, dépannage).</p>
                                <Button variant="info" onClick={() => setShowUserDataExchangeModal(true)}>
                                    <i className="fas fa-user-secret"></i> Échange de données utilisateur
                                </Button>
                            </div>
                            <div className="adm-fieldset adm-fieldset-danger">
                                <div className="adm-fieldset-title">Suivi des erreurs</div>
                                <p className="text-muted small">Provoque une erreur volontaire pour vérifier qu'elle arrive bien dans Sentry.</p>
                                <Button
                                    variant="danger"
                                    onClick={() => {
                                        if (!window.confirm("Provoquer une erreur de test ? Elle sera envoyée à Sentry et la page peut se réafficher en erreur.")) return;
                                        try {
                                            null.throwError();
                                        } catch (error) {
                                            Sentry.captureException(error, { extra: { context: 'Test Erreur Bouton Cliqué' } });
                                            if (showInAppNotification) showInAppNotification('Erreur de test envoyée à Sentry !', 'check-circle');
                                            throw error; // relancée pour déclencher le gestionnaire global
                                        }
                                    }}
                                >
                                    <i className="fas fa-bug"></i> Test d'erreur Sentry
                                </Button>
                            </div>
                        </div>
                    </SectionCard>
                );

            default:
                return null;
        }
    };

    const navItem = (item) => {
        const badge = item.badge ? badgeValues[item.badge] : 0;
        return (
            <button
                key={item.key}
                type="button"
                className={`adm-nav-item ${selectedSection === item.key ? 'active' : ''}`}
                onClick={() => openSection(item.key)}
                title={item.description}
            >
                <i className={`fas ${item.icon}`}></i>
                <span className="adm-nav-label">{item.label}</span>
                {badge > 0 && <span className="adm-badge">{badge}</span>}
            </button>
        );
    };

    return (
        <div className="admin-dashboard-container dark-ui">
            <aside className="adm-sidebar">
                <div className="adm-sidebar-head">
                    <div className="adm-sidebar-title"><i className="fas fa-shield-halved"></i> Administration</div>
                    <div className="adm-sidebar-user" title={currentUser.email}>{currentUser.email}</div>
                    <div className="adm-search">
                        <i className="fas fa-magnifying-glass"></i>
                        <input
                            ref={searchRef}
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && searchResults && searchResults.length > 0) openSection(searchResults[0].key);
                                if (event.key === 'Escape') { setQuery(''); event.target.blur(); }
                            }}
                            placeholder="Rechercher… ( / )"
                            aria-label="Rechercher une section"
                        />
                    </div>
                </div>

                <nav className="adm-nav">
                    {searchResults ? (
                        searchResults.length > 0 ? (
                            <div className="adm-nav-group">
                                <div className="adm-nav-group-label">{searchResults.length} résultat{searchResults.length > 1 ? 's' : ''}</div>
                                {searchResults.map(navItem)}
                            </div>
                        ) : (
                            <p className="adm-nav-empty">Aucune section ne correspond à « {query} ».</p>
                        )
                    ) : (
                        ADMIN_SECTION_GROUPS.map((group) => (
                            <div className="adm-nav-group" key={group.key}>
                                {group.key !== 'home' && <div className="adm-nav-group-label">{group.label}</div>}
                                {group.items.map(navItem)}
                            </div>
                        ))
                    )}
                </nav>

                <div className="adm-sidebar-foot">
                    {desktopNotificationPermission === 'default' && (
                        <Button variant="outline-info" size="sm" onClick={handleEnableDesktopNotifications} className="w-100" title="Autoriser les notifications de bureau pour les statuts">
                            <i className="fas fa-bell"></i> Activer les notifications
                        </Button>
                    )}
                    <Button type="button" variant="secondary" size="sm" className="w-100" onClick={() => navigate('/')} title="Retourner aux formulaires">
                        <i className="fas fa-house"></i> Retour au site
                    </Button>
                    <Button variant="outline-warning" size="sm" onClick={handleLogout} className="w-100">
                        <i className="fas fa-right-from-bracket"></i> Déconnexion
                    </Button>
                </div>
            </aside>

            <main className="adm-main">
                <header className="adm-main-head">
                    <div className="adm-breadcrumb">
                        <span>Administration</span>
                        {current.key !== 'overview' && <><i className="fas fa-chevron-right"></i><span>{current.group}</span></>}
                    </div>
                    <h2><i className={`fas ${current.icon}`}></i> {current.label}</h2>
                    <p>{current.description}</p>
                </header>
                <div className="adm-content">{renderSection()}</div>
            </main>
        </div>
    );
};

export default AdminDashboard;
