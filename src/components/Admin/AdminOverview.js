// src/components/Admin/AdminOverview.js
//
// Accueil du panneau admin : ce qui attend une action, l'état des réglages importants et des raccourcis.
import React from 'react';

const Tile = ({ icon, label, value, hint, tone = 'neutral', onClick }) => (
    <button type="button" className={`adm-tile adm-tile-${tone}`} onClick={onClick}>
        <span className="adm-tile-icon"><i className={`fas ${icon}`}></i></span>
        <span className="adm-tile-body">
            <span className="adm-tile-value">{value}</span>
            <span className="adm-tile-label">{label}</span>
            {hint && <span className="adm-tile-hint">{hint}</span>}
        </span>
    </button>
);

const StateRow = ({ label, value, tone, onClick, detail }) => (
    <button type="button" className="adm-state-row" onClick={onClick}>
        <span className="adm-state-label">{label}{detail && <small>{detail}</small>}</span>
        <span className={`adm-chip adm-chip-${tone}`}>{value}</span>
    </button>
);

const AdminOverview = ({
    counts, imageCount, lockdownConfig, bbcodeEnabled, authConfig, debugAutofillEnabled, debugDeleteApplicationsEnabled, onOpen,
}) => {
    const todo = (count) => (count > 0 ? 'alert' : 'ok');
    const total = (counts.accounts || 0) + (counts.modifications || 0) + (counts.requests || 0) + (counts.cctv || 0) + (imageCount || 0);

    return (
        <div className="adm-overview">
            <section>
                <h3 className="adm-block-title">
                    À traiter {total > 0 ? <span className="adm-chip adm-chip-alert">{total}</span> : <span className="adm-chip adm-chip-ok">rien en attente</span>}
                </h3>
                <div className="adm-tiles">
                    <Tile icon="fa-user-clock" label="Demandes de compte" value={counts.accounts || 0} hint="Créations de compte du personnel" tone={todo(counts.accounts)} onClick={() => onOpen('pendingAccounts')} />
                    <Tile icon="fa-pen-to-square" label="Demandes de modification" value={counts.modifications || 0} hint="Fiches à mettre à jour" tone={todo(counts.modifications)} onClick={() => onOpen('pendingModifications')} />
                    <Tile icon="fa-video" label="Vidéosurveillance" value={counts.cctv || 0} hint="Demandes d'images à traiter" tone={todo(counts.cctv)} onClick={() => onOpen('cctv')} />
                    <Tile icon="fa-inbox" label="Demandes du site" value={counts.requests || 0} hint="Bugs, idées, formulaires" tone={todo(counts.requests)} onClick={() => onOpen('siteRequests')} />
                    <Tile icon="fa-images" label="Images à supprimer" value={imageCount || 0} hint="Liens imgBB à ouvrir" tone={todo(imageCount)} onClick={() => onOpen('imageCleanup')} />
                </div>
            </section>

            <section>
                <h3 className="adm-block-title">État du site</h3>
                <div className="adm-states">
                    <StateRow
                        label="Confinement" detail="Verrouillage du site pour les visiteurs"
                        value={lockdownConfig.enabled ? 'ACTIF' : 'inactif'} tone={lockdownConfig.enabled ? 'alert' : 'ok'} onClick={() => onOpen('lockdown')}
                    />
                    <StateRow
                        label="Accès au BBCode" detail="Copie, onglets BBCode et convertisseur Discord"
                        value={bbcodeEnabled ? 'activé' : 'désactivé (aperçu et HTML seulement)'} tone={bbcodeEnabled ? 'neutral' : 'info'} onClick={() => onOpen('display')}
                    />
                    <StateRow
                        label="Connexion" detail="Méthodes proposées au personnel"
                        value={authConfig && authConfig.gtawOnly === false ? 'GTA World + e-mail' : 'GTA World uniquement'} tone="neutral" onClick={() => onOpen('authMethods')}
                    />
                    <StateRow
                        label="Remplissage de test (debug)" detail="Bouton « Remplir (debug) » de la liste blanche"
                        value={debugAutofillEnabled ? 'ACTIVÉ' : 'désactivé'} tone={debugAutofillEnabled ? 'warn' : 'ok'} onClick={() => onOpen('debug')}
                    />
                    <StateRow
                        label="Suppression des candidatures" detail="Bouton de suppression dans l'historique"
                        value={debugDeleteApplicationsEnabled ? 'ACTIVÉE' : 'désactivée'} tone={debugDeleteApplicationsEnabled ? 'warn' : 'ok'} onClick={() => onOpen('debug')}
                    />
                </div>
            </section>

            <section>
                <h3 className="adm-block-title">Raccourcis</h3>
                <div className="adm-tiles adm-tiles-small">
                    <Tile icon="fa-users-gear" label="Utilisateurs" value="" tone="neutral" onClick={() => onOpen('users')} />
                    <Tile icon="fa-clock-rotate-left" label="Journal d'activité" value="" tone="neutral" onClick={() => onOpen('activity')} />
                    <Tile icon="fa-dice" label="Bingo" value="" tone="neutral" onClick={() => onOpen('bingo')} />
                    <Tile icon="fa-database" label="Base de données" value="" tone="neutral" onClick={() => onOpen('database')} />
                    <Tile icon="fa-bug" label="Debug & simulation" value="" tone="neutral" onClick={() => onOpen('debug')} />
                </div>
            </section>
        </div>
    );
};

export default AdminOverview;
