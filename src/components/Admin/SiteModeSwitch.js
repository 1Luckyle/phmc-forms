// src/components/Admin/SiteModeSwitch.js
//
// Panneau admin → Version du site : bascule TOUT le site entre la version GTA World (d'origine, par défaut) et la version PHMC classique
// (sans GTA World). Réglage adminSettings/siteMode = { mode, majLe, majPar } (lecture publique, écriture admin : database.rules.json).
// Les Cloud Functions lisent le même réglage et refusent ce qui n'appartient pas à la version active. On peut revenir en arrière à tout moment :
// aucune donnée n'est supprimée par la bascule.
import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { ref, set } from 'firebase/database';
import { database } from '../../firebase';
import { useSiteMode } from '../../contexts/SiteConfigContext';
import { SITE_MODES, SITE_MODE_CLASSIC, siteModeLabel } from '../../constants/siteMode';
import { logAdminAction } from '../../utils/activityLog';

const DETAILS = {
    gtaw: [
        'Connexion et création de compte avec GTA World (personnage, faction PHMC pour le personnel).',
        'Paiements par lien Fleeca, confirmés automatiquement.',
        'Mails Eyefind (adresses prenomnom@mail.eyefind.fr) en plus des notifications du site.',
        'ID patient tiré du personnage GTA World.',
    ],
    classique: [
        'Connexion et création de compte avec Discord : compte civil libre, compte du personnel soumis à la validation d’un admin.',
        'Paiements mis en attente, puis marqués payés par le personnel (encaissement en jeu).',
        'Notifications et messagerie du site uniquement (aucun mail Eyefind) ; adresses fictives prenom.nom@phmc.health.',
        'ID patient créé avec le compte et conservé ; ID temporaires pour les patients sans compte.',
        'Aucune mention de GTA World sur le site.',
    ],
};

const SiteModeSwitch = ({ currentUser, showInAppNotification }) => {
    const { siteMode } = useSiteMode();
    const [pending, setPending] = useState(null);
    const [saving, setSaving] = useState(false);

    const confirm = async () => {
        const mode = pending;
        setSaving(true);
        try {
            await set(ref(database, 'adminSettings/siteMode'), { mode, majLe: Date.now(), majPar: currentUser?.email || null });
            logAdminAction({ email: currentUser?.email, action: `Version du site : ${siteModeLabel(mode)}`, details: `Avant : ${siteModeLabel(siteMode)}` });
            if (showInAppNotification) showInAppNotification(`${siteModeLabel(mode)} activée pour tout le site.`, 'check-circle');
            setPending(null);
        } catch (error) {
            console.error('Changement de version impossible :', error);
            alert('Impossible de changer la version du site : ' + (error?.message || error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="d-flex flex-column gap-3">
                {SITE_MODES.map((entry) => {
                    const active = entry.value === siteMode;
                    return (
                        <div key={entry.value} className="card" style={{ borderColor: active ? '#1f6feb' : undefined, borderWidth: active ? 2 : 1 }}>
                            <div className="card-body">
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <strong>{entry.label}</strong>
                                    {active && <span className="badge bg-primary">Active</span>}
                                    {!active && (
                                        <Button size="sm" variant="outline-primary" className="ms-auto" disabled={saving} onClick={() => setPending(entry.value)}>
                                            Passer à cette version
                                        </Button>
                                    )}
                                </div>
                                <ul className="small text-muted mb-0">
                                    {DETAILS[entry.value].map((line) => <li key={line}>{line}</li>)}
                                </ul>
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="text-muted small mt-3 mb-0">
                La bascule s'applique à tous les visiteurs, immédiatement, et ne supprime aucune donnée : on peut revenir à l'autre version à tout moment.
                La connexion au panneau admin (/login) reste disponible dans les deux versions.
            </p>

            <Modal show={!!pending} onHide={() => !saving && setPending(null)} centered>
                <Modal.Header closeButton={!saving}>
                    <Modal.Title>Passer à la {pending ? siteModeLabel(pending).toLowerCase() : ''} ?</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p className="mb-2">Tout le site change de version, pour tous les visiteurs, dès la confirmation.</p>
                    {pending === SITE_MODE_CLASSIC
                        ? <p className="mb-0">La connexion GTA World, les paiements Fleeca et les mails Eyefind cessent de fonctionner. Les comptes existants restent en place.</p>
                        : <p className="mb-0">La connexion Discord et la validation manuelle des paiements cessent d'être proposées. Les comptes et paiements déjà enregistrés restent en place.</p>}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setPending(null)} disabled={saving}>Annuler</Button>
                    <Button variant="primary" onClick={confirm} disabled={saving}>{saving ? 'Enregistrement…' : 'Confirmer'}</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default SiteModeSwitch;
