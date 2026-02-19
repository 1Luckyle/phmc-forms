import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import DatabaseEditor from './DatabaseEditor';
import UserStats from './UserStats';
import WebhookLogs from './WebhookLogs';
import PendingAccountRequests from './PendingAccountRequests';
import PendingModificationRequests from './PendingModificationRequests';

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
    selectedRecruitmentCategory,
    setSelectedRecruitmentCategory,
    recruitmentCategories,
    handleAddRoleClick,
    isLoadingRecruitmentData,
    currentRecruitmentData,
    handleRenameRoleKeyClick,
    handleEditRoleClick,
    handleTogglePositionStatus,
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

    setShowCctvWebhookModal,
    setShowMarkdownModal,
    handleLogout,
    Sentry,
    showInAppNotification,
    setShowOAuthTokenExchangeModal,
    setShowUserDataExchangeModal,
    handleGtaWorldLogin,
    lockdownConfig,
    setLockdownConfig,
    handleUpdateLockdownStatus,
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

    const [selectedSection, setSelectedSection] = useState('serviceStatus');
    const [gtaWorldUser, setGtaWorldUser] = useState(null);
    const [testWebhookData, setTestWebhookData] = useState({ title: '', message: '', selectedWebhook: null });
    const navigate = useNavigate();

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

    return (
        <div className="admin-dashboard-container">
            <div className="admin-dashboard-layout">
                <div className="sidebar">
                    <div className="sidebar-header">
                        <h5>Admin Panel</h5>
                        <p>Connecté en tant que : {currentUser.email}</p>
                        {gtaWorldUser && (
                            <p className="text-info">
                                <i className="fas fa-user me-1"></i>
                                GTA World: {gtaWorldUser.username}
                            </p>
                        )}
                    </div>
                    <div className="nav-pills-flex-column">
                        <button className={`nav-link ${selectedSection === 'serviceStatus' ? 'active' : ''}`} onClick={() => setSelectedSection('serviceStatus')}><i className="fas fa-server me-2"></i>Statut du service</button>
                        <button className={`nav-link ${selectedSection === 'lockdown' ? 'active' : ''}`} onClick={() => setSelectedSection('lockdown')}><i className="fas fa-lock me-2"></i>Confinement</button>
                        <button className={`nav-link ${selectedSection === 'pendingAccounts' ? 'active' : ''}`} onClick={() => setSelectedSection('pendingAccounts')}><i className="fas fa-user-clock me-2"></i>Demandes de compte</button>
                        <button className={`nav-link ${selectedSection === 'pendingModifications' ? 'active' : ''}`} onClick={() => setSelectedSection('pendingModifications')}><i className="fas fa-edit me-2"></i>Demandes de modification</button>
                        <button className={`nav-link ${selectedSection === 'recruitment' ? 'active' : ''}`} onClick={() => setSelectedSection('recruitment')}><i className="fas fa-user-plus me-2"></i>Recrutement</button>
                        <button className={`nav-link ${selectedSection === 'bingo' ? 'active' : ''}`} onClick={() => setSelectedSection('bingo')}><i className="fas fa-dice me-2"></i>Bingo</button>
                        <button className={`nav-link ${selectedSection === 'users' ? 'active' : ''}`} onClick={() => setSelectedSection('users')}><i className="fas fa-users-cog me-2"></i>Utilisateurs</button>
                        <button className={`nav-link ${selectedSection === 'webhooks' ? 'active' : ''}`} onClick={() => setSelectedSection('webhooks')}><i className="fas fa-bullhorn me-2"></i>Webhooks</button>
                        <button className={`nav-link ${selectedSection === 'dev' ? 'active' : ''}`} onClick={() => setSelectedSection('dev')}><i className="fas fa-code me-2"></i>Développeur</button>
                        <button className={`nav-link ${selectedSection === 'database' ? 'active' : ''}`} onClick={() => setSelectedSection('database')}><i className="fas fa-database me-2"></i>Base de données</button>
                    </div>
                    <div className="sidebar-footer">
                        {desktopNotificationPermission === 'default' && (
                            <Button variant="outline-info" size="sm" onClick={handleEnableDesktopNotifications} className="w-100 mb-2" title="Click to allow desktop notifications for status updates">
                                <i className="fas fa-bell"></i> Activer les notifications
                            </Button>
                        )}
                        <Button variant="warning" onClick={handleLogout} className="w-100">Déconnexion</Button>
                                    <Button type="button" variant="secondary" className="changelog-button" onClick={() => navigate('/')} title="Aller à l'accueil" > <i className="fas fa-home"></i>Accueil</Button>
                    </div>
                </div>
                <div className="main-content">
                    {selectedSection === 'serviceStatus' && (
                        <div className="card">
                            <div className="card-header">Statut du service</div>
                            <div className="card-body">
                                {isLoadingStatus ? (
                                    <Spinner animation="border" size="sm" />
                                ) : (
                                    <>
                                        <div className="form-group mb-3">
                                            <label>Statut du générateur de formulaires</label>
                                            <input
                                                type="text"
                                                value={formGeneratorStatus}
                                                onChange={(e) => setFormGeneratorStatus(e.target.value)}
                                                placeholder="ex. Entièrement mis à jour"
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-3">
                                            <label>Statut alternatif du générateur de formulaires</label>
                                            <input
                                                type="text"
                                                value={alternativeFormGeneratorStatus}
                                                onChange={(e) => setAlternativeFormGeneratorStatus(e.target.value)}
                                                placeholder="ex. Mises à jour différées"
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-3">
                                            <label>Statut localhost/staging</label>
                                            <input
                                                type="text"
                                                value={localHostStatus}
                                                onChange={(e) => setLocalHostStatus(e.target.value)}
                                                placeholder="ex. En développement"
                                                className="form-control"
                                            />
                                        </div>
                                    </>
                                )}
                                <Button variant="primary" onClick={handleUpdateServiceStatus} disabled={isUpdatingDb || isLoadingStatus}>
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : "Mettre à jour le statut du service"}
                                </Button>
                            </div>
                        </div>
                    )}
                    {selectedSection === 'pendingAccounts' && (
                        <div className="card">
                            <div className="card-header">Demandes de compte en attente</div>
                            <div className="card-body">
                                <PendingAccountRequests showNotification={showInAppNotification} />
                            </div>
                        </div>
                    )}
                    {selectedSection === 'pendingModifications' && (
                        <div className="card">
                            <div className="card-header">Demandes de modification en attente</div>
                            <div className="card-body">
                                <PendingModificationRequests showNotification={showInAppNotification} />
                            </div>
                        </div>
                    )}
                    {selectedSection === 'lockdown' && (
                        <div className="card">
                            <div className="card-header">Verrouillage du site</div>
                            <div className="card-body">
                                <div className="form-check form-switch mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        role="switch"
                                        id="lockdownSwitch"
                                        checked={lockdownConfig.enabled}
                                        onChange={(e) => setLockdownConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                                    />
                                    <label className="form-check-label" htmlFor="lockdownSwitch">
                                        Activer le verrouillage du site
                                    </label>
                                </div>
                                <div className="form-group mb-3">
                                    <label>Message de notification</label>
                                    <input
                                        type="text"
                                        value={lockdownConfig.notification}
                                        onChange={(e) => setLockdownConfig(prev => ({ ...prev, notification: e.target.value }))}
                                        placeholder="ex. Le site est actuellement en maintenance."
                                        className="form-control"
                                    />
                                </div>
                                <div className="form-group mb-3">
                                    <label>Texte de la boîte de dialogue popup</label>
                                    <textarea
                                        value={lockdownConfig.dialog}
                                        onChange={(e) => setLockdownConfig(prev => ({ ...prev, dialog: e.target.value }))}
                                        placeholder="ex. Le générateur de BBCode est temporairement désactivé."
                                        className="form-control"
                                        rows="3"
                                    ></textarea>
                                </div>
                                <div className="form-group mb-3">
                                    <label>Déploiements affectés</label>
                                    <div>
                                        {['tous', 'phmc-tools', 'github-pages', 'local'].map((deployment) => (
                                            <div className="form-check form-check-inline" key={deployment}>
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id={`deployment-${deployment}`}
                                                    value={deployment}
                                                    checked={lockdownConfig.affectedDeployments.includes(deployment)}
                                                    onChange={(e) => {
                                                        const { value, checked } = e.target;
                                                        setLockdownConfig((prev) => {
                                                            let newDeployments;
                                                            if (checked) {
                                                                newDeployments = [...prev.affectedDeployments, value];
                                                            } else {
                                                                newDeployments = prev.affectedDeployments.filter((d) => d !== value);
                                                            }
                                                            return { ...prev, affectedDeployments: newDeployments };
                                                        });
                                                    }}
                                                />
                                                <label className="form-check-label" htmlFor={`deployment-${deployment}`}>
                                                    {deployment.charAt(0).toUpperCase() + deployment.slice(1)}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <Button variant="primary" onClick={handleUpdateLockdownStatus} disabled={isUpdatingDb}>
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : "Mise à jour sur l'état du confinement"}
                                </Button>
                            </div>
                        </div>
                    )}
                    {selectedSection === 'recruitment' && (
                        <div className="card">
                            <div className="card-header">Gestion du recrutement</div>
                            <div className="card-body">
                                <div className="form-group mb-3">
                                    <label htmlFor="selectRecruitmentCategory">Sélectionnez une option de recrutement</label>
                                    <select id="selectRecruitmentCategory" value={selectedRecruitmentCategory} onChange={(e) => setSelectedRecruitmentCategory(e.target.value)} className="form-select">
                                        <option value="">-- Sélectionnez une option --</option>
                                        {Object.entries(recruitmentCategories).map(([key, cat]) => (<option key={key} value={key}>{cat.displayName}</option>))}
                                    </select>
                                </div>

                                {selectedRecruitmentCategory && recruitmentCategories[selectedRecruitmentCategory] ? (
                                    <>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <h5>Gérer {recruitmentCategories[selectedRecruitmentCategory]?.displayName}</h5>
                                            <Button variant="success" size="sm" onClick={handleAddRoleClick}>
                                                <i className="fas fa-plus-circle"></i> Ajouter un rôle
                                            </Button>
                                        </div>
                                        {isLoadingRecruitmentData ? (<Spinner animation="border" />) : Object.keys(currentRecruitmentData).length > 0 ? (
                                            <div className="list-group mb-3">
                                                {Object.entries(currentRecruitmentData).map(([key, position]) => (
                                                    <div key={key} className="list-group-item d-flex justify-content-between align-items-center">
                                                        <div>
                                                            {position.displayName || position.name || key}: {}
                                                            <strong style={{ color: position.status === "OPEN" ? 'green' : 'red' }}>{position.status || "N/A"}</strong>
                                                            <br />
                                                            <small className="text-muted">Clé BD: {key}</small>
                                                        </div>
                                                        <div className="d-flex gap-2">
                                                            <Button variant="outline-warning" size="sm" onClick={() => handleRenameRoleKeyClick(key, position)} disabled={isUpdatingDb} title={`Renommer la clé de la base de données pour ${position.displayName || position.name || key}`}>
                                                                <i className="fas fa-key"></i> Renommer la clé
                                                            </Button>
                                                            <Button variant="outline-secondary" size="sm" onClick={() => handleEditRoleClick(key, position)} disabled={isUpdatingDb} title={`Modifier ${position.displayName || position.name || key}`}>
                                                                <i className="fas fa-edit"></i> Modifier
                                                            </Button>
                                                            <Button variant={position.status === "OPEN" ? "outline-danger" : "outline-success"} size="sm" onClick={() => handleTogglePositionStatus(key, position.status)} disabled={isUpdatingDb} style={{ minWidth: '120px' }}>
                                                                {isUpdatingDb && <Spinner as="span" animation="border" size="sm" />}
                                                                {position.status === "OPEN" ? "CLOSED" : "OPEN"}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (<p>Aucun poste chargé pour {recruitmentCategories[selectedRecruitmentCategory]?.displayName}.</p>)}
                                    </>
                                ) : (<p>Sélectionnez une catégorie de recrutement pour gérer les postes.</p>)}
                            </div>
                        </div>
                    )}
                    {selectedSection === 'bingo' && (
                        <div className="card">
                            <div className="card-header">Gestion du Bingo</div>
                            <div className="card-body">
                                <div className="form-group mb-3">
                                    <label>Sélectionnez le type de Bingo :</label>
                                    <select
                                        value={selectedAdminBingoType}
                                        onChange={(e) => setSelectedAdminBingoType(e.target.value)}
                                        disabled={isUpdatingDb}
                                        className="form-select"
                                    >
                                        {BINGO_TYPES.map(type => (
                                            <option key={type.id} value={type.id}>{type.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-info small mt-1">
                                    La réinitialisation quotidienne s'exécute désormais automatiquement sur le serveur à 09:00 UTC.
                                </p>
                                <Button
                                    variant="secondary"
                                    onClick={handleManualResetAllBingoCards}
                                    disabled={isUpdatingDb}
                                    className="mt-2 me-2"
                                    title="Exécuter manuellement la réinitialisation quotidienne pour toutes les cartes de bingo actives."
                                >
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-bomb"></i> Réinitialiser toutes les cartes</>}
                                </Button>

                                <Button
                                    variant="primary"
                                    onClick={handleGenerateNewBingoCard}
                                    disabled={isUpdatingDb}
                                    className="mt-2 me-2"
                                >
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-sync-alt"></i> Générer une nouvelle carte</>}
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={handleClearBingoActivity}
                                    disabled={isUpdatingDb}
                                    className="mt-2 me-2"
                                >
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-trash-alt"></i> Effacer le journal d'activité</>}
                                </Button>
                                <Button
                                    variant="warning"
                                    onClick={handleDisableBingoCard}
                                    disabled={isUpdatingDb}
                                    className="mt-2 me-2"
                                    title="Cela supprimera la carte actuelle et le journal, désactivant effectivement le jeu jusqu'à ce qu'une nouvelle carte soit générée."
                                >
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-power-off"></i> Désactiver la carte</>}
                                </Button>
                                <Button
                                    variant="info"
                                    onClick={() => setShowEditBingoPhrasesModal(true)}
                                    disabled={isUpdatingDb || !selectedAdminBingoType}
                                    className="mt-2 me-2"
                                >
                                    <i className="fas fa-edit"></i> Modifier les phrases {selectedTypeForEdit?.name || 'Master'}
                                </Button>
                                <Button
                                    variant="warning"
                                    onClick={() => setShowReviewPhrasesModal(true)}
                                    disabled={isUpdatingDb}
                                    className="mt-2"
                                >
                                    <i className="fas fa-inbox"></i> Demandes de révision de phrases
                                </Button>
                            </div>
                        </div>
                    )}
                    {selectedSection === 'users' && (
                        <div className="card">
                            <div className="card-header">Gestion des utilisateurs</div>
                            <div className="card-body">
                                <Button variant="primary" onClick={() => setShowUserManagementModal(true)}>
                                    <i className="fas fa-users-cog"></i> Gérer les utilisateurs
                                </Button>
                            </div>
                            <UserStats currentUser={currentUser} />
                        </div>
                    )}
                    {selectedSection === 'webhooks' && (
                        <div className="card">
                            <div className="card-header">Webhook Management</div>
                            <div className="card-body">
                                <div className="mb-4">
                                    <h5>{newWebhook.id ? 'Modifier le webhook' : 'Ajouter un nouveau webhook'}</h5>
                                    {newWebhook.id && (
                                        <div className="alert alert-info py-2 mb-3">
                                            <i className="fas fa-info-circle me-2"></i>
                                            Modification du webhook : <strong>{newWebhook.name}</strong>
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-outline-secondary ms-2"
                                                onClick={() => setNewWebhook({ name: '', url: '', type: 'coronerAlerts' })}
                                            >
                                                Annuler la modification
                                            </button>
                                        </div>
                                    )}
                                    <div className="form-group mb-2">
                                        <label>Nom du webhook</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="ex. Notifications Discord"
                                            value={newWebhook.name}
                                            onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group mb-2">
                                        <label>URL du webhook</label>
                                        <input
                                            type="url"
                                            className="form-control"
                                            placeholder="https://discord.com/api/webhooks/..."
                                            value={newWebhook.url}
                                            onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group mb-3">
                                        <label>Type d'événement</label>
                                        <select
                                            className="form-select"
                                            value={newWebhook.type}
                                            onChange={(e) => setNewWebhook(prev => ({ ...prev, type: e.target.value }))}
                                        >
                                            <option value="coronerAlerts">Alertes Coroner</option>
                                            <option value="phmcAlerts">Alertes PHMC</option>
                                            <option value="dev">Développeur local de Discord</option>
                                        </select>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <Button variant="primary" onClick={handleAddWebhook} disabled={isUpdatingWebhooks}>
                                            {isUpdatingWebhooks ? <Spinner as="span" animation="border" size="sm" /> : (newWebhook.id ? "Mettre à jour le webhook" : "Ajouter le webhook")}
                                        </Button>
                                        {newWebhook.id && (
                                            <Button 
                                                variant="secondary" 
                                                onClick={() => setNewWebhook({ name: '', url: '', type: 'coronerAlerts' })}
                                                disabled={isUpdatingWebhooks}
                                            >
                                                Annuler
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <hr />

                                {/* Custom Webhook Panel */}
                                <div className="mb-4 p-3 border rounded bg-light">
                                    <h5>Envoyer un webhook personnalisé</h5>
                                    <form className="row g-2 align-items-end" onSubmit={handleSendCustomWebhook}>
                                            <label htmlFor="webhookChannel" className="form-label mb-0">Webhook</label>
                                            <select
                                                id="webhookChannel"
                                                className="form-select"
                                                value={customWebhookChannel}
                                                onChange={e => setCustomWebhookChannel(e.target.value)}
                                                disabled={customWebhookSending}
                                            >
                                                <option value="">Sélectionnez un webhook...</option>
                                                {webhooks && webhooks.map((hook) => (
                                                    <option key={hook.id} value={hook.id}>
                                                        {hook.name} ({hook.type})
                                                    </option>
                                                ))}
                                            </select>
                                            <label htmlFor="webhookTitle" className="form-label mb-0">Title</label>
                                            <input
                                                id="webhookTitle"
                                                className="form-control"
                                                type="text"
                                                value={customWebhookTitle}
                                                onChange={e => setCustomWebhookTitle(e.target.value)}
                                                placeholder="Entrez le titre"
                                                required
                                                disabled={customWebhookSending}
                                            />
                                            <label htmlFor="webhookMessage" className="form-label mb-0">Message</label>
                                            <textarea
                                                id="webhookMessage"
                                                className="form-control"
                                                rows="4"
                                                value={customWebhookMessage}
                                                onChange={e => setCustomWebhookMessage(e.target.value)}
                                                placeholder="Entrez le message (prend en charge Markdown)"
                                                required
                                                disabled={customWebhookSending}
                                                style={{ resize: 'vertical', minHeight: '38px' }}
                                            />
                                            <label htmlFor="webhookUrl" className="form-label mb-0">URL (Optionnel)</label>
                                            <input
                                                id="webhookUrl"
                                                className="form-control"
                                                type="url"
                                                value={customWebhookUrl}
                                                onChange={e => setCustomWebhookUrl(e.target.value)}
                                                placeholder="https://..."
                                                disabled={customWebhookSending}
                                            />
                                            <button
                                                type="submit"
                                                className="btn btn-primary"
                                                disabled={customWebhookSending || !customWebhookChannel || !customWebhookTitle || !customWebhookMessage}
                                            >
                                                {customWebhookSending ? 'Envoi en cours...' : 'Envoyer Webhook'}
                                            </button>
                                    </form>
                                    <small className="text-muted mt-2 d-block">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Intégrations Discord enrichies avec la marque PHMC, liens vers le générateur de formulaires, informations d'administration et horodatage. Le formatage Markdown est pris en charge..
                                    </small>
                                    {customWebhookResult === 'success' && (
                                        <div className="alert alert-success mt-2 mb-0 py-1">Webhook envoyé avec succès !</div>
                                    )}
                                    {customWebhookResult === 'error' && (
                                        <div className="alert alert-danger mt-2 mb-0 py-1">Échec de l'envoi du webhook. Vérifiez la configuration du canal et réessayez.</div>
                                    )}
                                </div>

                                <hr />

                                <div>
                                    <h5>Webhooks existants</h5>
                                    {webhooks && webhooks.length > 0 ? (
                                        <ul className="list-group">
                                            {webhooks.map((hook) => (
                                                <li key={hook.id} className="list-group-item">
                                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                                        <div>
                                                            <strong>{hook.name}</strong> ({hook.type})
                                                            <br />
                                                            <small className="text-muted">{hook.url}</small>
                                                        </div>
                                                        <div className="d-flex gap-2">
                                                            <Button 
                                                                variant="outline-secondary" 
                                                                size="sm" 
                                                                onClick={() => {
                                                                    setNewWebhook({
                                                                        name: hook.name,
                                                                        url: hook.url,
                                                                        type: hook.type,
                                                                        id: hook.id
                                                                    });
                                                                    // Scroll to the top of the webhook section
                                                                    document.querySelector('.card-header').scrollIntoView({ behavior: 'smooth' });
                                                                }}
                                                                disabled={isUpdatingWebhooks}
                                                                title="Modifier la configuration du webhook"
                                                            >
                                                                <i className="fas fa-edit"></i> Modifier
                                                            </Button>
                                                            <Button 
                                                                variant="outline-primary" 
                                                                size="sm" 
                                                                onClick={() => setTestWebhookData(prev => ({ ...prev, selectedWebhook: hook }))}
                                                                disabled={isUpdatingWebhooks}
                                                            >
                                                                Tester
                                                            </Button>
                                                            <Button variant="danger" size="sm" onClick={() => handleDeleteWebhook(hook.id)} disabled={isUpdatingWebhooks}>
                                                                Supprimer
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {testWebhookData.selectedWebhook?.id === hook.id && (
                                                        <div className="mt-3 p-3 bg-light rounded">
                                                            <h6>Tester le Webhook : {hook.name}</h6>
                                                            <div className="form-group mb-2">
                                                                <label>Titre du test</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control"
                                                                    placeholder="Titre du message de test"
                                                                    value={testWebhookData.title}
                                                                    onChange={(e) => setTestWebhookData(prev => ({ ...prev, title: e.target.value }))}
                                                                />
                                                            </div>
                                                            <div className="form-group mb-2">
                                                                <label>Message de test</label>
                                                                <textarea
                                                                    className="form-control"
                                                                    rows="3"
                                                                    placeholder="Contenu du message de test"
                                                                    value={testWebhookData.message}
                                                                    onChange={(e) => setTestWebhookData(prev => ({ ...prev, message: e.target.value }))}
                                                                />
                                                            </div>
                                                            <div className="d-flex gap-2">
                                                                <Button variant="success" size="sm" onClick={() => handleTestWebhook(hook)}>
                                                                    Envoyer le test
                                                                </Button>
                                                                <Button 
                                                                    variant="secondary" 
                                                                    size="sm" 
                                                                    onClick={() => setTestWebhookData(prev => ({ ...prev, selectedWebhook: null, title: '', message: '' }))}
                                                                >
                                                                    Annuler
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p>Aucun webhook configuré.</p>
                                    )}
                                </div>
                            </div>
                                                        <WebhookLogs refreshTrigger={logRefreshTrigger} />
                        </div>
                    )}
                    {selectedSection === 'dev' && (
                        <div className="card">
                            <div className="card-header">Outils de développement</div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <Button variant="primary" onClick={handleGtaWorldLogin}>
                                        <i className="fas fa-sign-in-alt me-2"></i>
                                        Connexion à GTA World
                                    </Button>
                                </div>
                                <div className="mb-3">
                                    <Button 
                                        variant="info" 
                                        onClick={() => setShowOAuthTokenExchangeModal(true)} 
                                        title={gtaWorldUser ? `Connecté en tant que ${gtaWorldUser.username}` : 'Échanger un jeton OAuth'}
                                    >
                                        <i className="fas fa-exchange-alt me-2"></i>
                                        Échange de jetons OAuth
                                    </Button>
                                    <Button variant="info" onClick={() => setShowUserDataExchangeModal(true)} className="ms-2">
                                        <i className="fas fa-user-secret me-2"></i>
                                        Échange de données utilisateur
                                    </Button>
                                </div>
                                <div className="mb-3">
                                    <Button variant="secondary" onClick={() => setShowCctvWebhookModal(true)} title="Envoyer un webhook de test simulant une demande CCTV.">
                                        <i className="fas fa-video me-2"></i>
                                        Test de demande CCTV
                                    </Button>
                                </div>
                                <Button variant="danger" onClick={() => {
                                    try {
                                        null.throwError();
                                    } catch (error) {
                                        Sentry.captureException(error, { extra: { context: 'Test Erreur Bouton Cliqué' } });
                                        if (showInAppNotification) showInAppNotification('Erreur de test envoyée à Sentry !', 'check-circle');
                                        throw error; // Re-throw the error to trigger the global handler
                                    }
                                }}>
                                    <i className="fas fa-bug"></i> Test d'erreur Sentry
                                </Button>
                            </div>
                        </div>
                    )}
                    {selectedSection === 'database' && (
                        <DatabaseEditor showNotification={showInAppNotification} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;