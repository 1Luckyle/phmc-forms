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
import BingoPauseButton from './BingoPauseButton';
import BingoResetSetting from './BingoResetSetting';
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
import PricingManager from './PricingManager';
import CitiesManager from './CitiesManager';
import TransparencyManager from './TransparencyManager';
import MailTemplatesManager from './MailTemplatesManager';
import { runRecruitmentMigrationOnce } from '../../utils/recruitmentMigration';

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
    { key: 'bingo', label: 'Bingo : choix du joueur', icon: 'fa-dice' },
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
    const badgeValues = { accounts: counts.accounts, modifications: counts.modifications, images: imageCount, requests: counts.requests };

    const {
        debugAutofillEnabled, setDebugAutofillEnabled, debugDeleteApplicationsEnabled, setDebugDeleteApplicationsEnabled,
        debugBingoPickerEnabled, setDebugBingoPickerEnabled,
    } = useDebug();
    const [isUpdatingBingoPicker, setIsUpdatingBingoPicker] = useState(false);
    const [isUpdatingDeleteDebug, setIsUpdatingDeleteDebug] = useState(false);
    const [isUpdatingDebug, setIsUpdatingDebug] = useState(false);
    const [isSeedingPhrases, setIsSeedingPhrases] = useState(false);

    const current = findAdminSection(selectedSection);

    // Recrutement : passage automatique, une seule fois, de l'ancien schéma (anglais) au schéma français.
    useEffect(() => {
        if (!currentUser) return;
        runRecruitmentMigrationOnce(currentUser.email).then((result) => {
            if (!result) return;
            logAdminAction({
                email: currentUser.email, action: 'Recrutement migré vers le schéma français',
                details: `${result.copied} écriture(s), ${result.removed} ancien(s) nœud(s) supprimé(s)\nSauvegarde : migrationBackups/${result.backupId}`,
            });
            if (showInAppNotification) {
                showInAppNotification(`Recrutement passé en français (${result.copied} élément(s) copiés ; sauvegarde des anciens nœuds : ${result.backupId}).${result.textsToReview ? ` ${result.textsToReview} poste(s) gardent leurs textes d'origine : à relire dans la gestion du recrutement.` : ''}`, 'success', 12000);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.uid]);

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

    const handleToggleBingoPicker = async (enabled) => {
        setIsUpdatingBingoPicker(true);
        try {
            await setDebugBingoPickerEnabled(enabled, currentUser?.email);
            if (showInAppNotification) showInAppNotification(`Choix du joueur au bingo ${enabled ? 'activé (admins)' : 'désactivé'}.`, enabled ? 'check-circle' : 'info-circle');
        } catch (error) {
            console.error('Error updating bingo picker setting:', error);
            alert('Impossible de modifier ce réglage : ' + (error?.message || error));
        } finally {
            setIsUpdatingBingoPicker(false);
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
                        key="activity"
                        showNotification={showInAppNotification}
                        onLogAction={(action, details) => logAdminAction({ email: currentUser?.email, action, details })}
                    />
                );

            case 'pricing':
                return (
                    <PricingManager
                        showNotification={showInAppNotification}
                        onLogAction={(action, details) => logAdminAction({ email: currentUser?.email, action, details, categoryName: 'Tarifs' })}
                    />
                );

            case 'cities':
                return (
                    <CitiesManager
                        showNotification={showInAppNotification}
                        onLogAction={(action, details) => logAdminAction({ email: currentUser?.email, action, details, categoryName: 'Villes' })}
                    />
                );

            case 'mails':
                return (
                    <MailTemplatesManager
                        showNotification={showInAppNotification}
                        adminName={currentUser?.displayName || currentUser?.email || ''}
                        onLogAction={(action, details) => logAdminAction({ email: currentUser?.email, action, details, categoryName: 'E-mails' })}
                    />
                );

            case 'transparency':
                return (
                    <TransparencyManager
                        showNotification={showInAppNotification}
                        adminName={currentUser?.displayName || currentUser?.email || ''}
                        onLogAction={(action, details) => logAdminAction({ email: currentUser?.email, action, details, categoryName: 'Transparence' })}
                    />
                );

            case 'errors':
                return (
                    <ActivityLog
                        key="errors"
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
                        <BingoResetSetting
                            bingoType={BINGO_TYPES.find((type) => type.id === selectedAdminBingoType)}
                            disabled={isUpdatingDb} showNotification={showInAppNotification}
                            onLogAction={(action, details) => logAdminAction({ email: currentUser?.email, action, details })}
                        />

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
                                    <BingoPauseButton
                                        bingoType={BINGO_TYPES.find((type) => type.id === selectedAdminBingoType)}
                                        disabled={isUpdatingDb} showNotification={showInAppNotification}
                                        onLogAction={(action, details) => logAdminAction({ email: currentUser?.email, action, details })}
                                    />
                                    <Button variant="warning" onClick={handleDisableBingoCard} disabled={isUpdatingDb} title="Supprime la carte actuelle et le journal : le jeu est désactivé jusqu'à ce qu'une nouvelle carte soit générée. Pour simplement arrêter la partie, utilisez « Mettre la carte en pause ».">
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

                        {debugTab === 'bingo' && (
                            <>
                                <p className="text-muted">
                                    Au bingo, chacun joue avec <strong>son propre compte</strong> : son nom est sélectionné automatiquement. Quand cet interrupteur
                                    est activé, les <strong>administrateurs</strong> (et eux seuls) retrouvent le menu pour jouer à la place de n'importe qui, par
                                    exemple pour tester une carte. Les autres joueurs ne voient aucun changement.
                                </p>
                                <SwitchRow
                                    id="debugBingoPickerSwitch"
                                    checked={debugBingoPickerEnabled}
                                    disabled={isUpdatingBingoPicker}
                                    onChange={handleToggleBingoPicker}
                                    label="Autoriser les admins à choisir le joueur"
                                    busy={isUpdatingBingoPicker}
                                    state={debugBingoPickerEnabled ? 'ACTIVÉ' : 'désactivé'}
                                    stateTone={debugBingoPickerEnabled ? 'warn' : 'ok'}
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
