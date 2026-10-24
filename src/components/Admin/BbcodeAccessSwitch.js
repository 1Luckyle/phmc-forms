// src/components/Admin/BbcodeAccessSwitch.js
//
// Panneau admin → Affichage : active / désactive l'accès au BBCode pour TOUT le site (copie du BBCode,
// « Montrer BBCode », onglets BBCode, convertisseur Discord). Désactivé, il ne reste que l'aperçu et le
// téléchargement HTML, et les textes d'aide ne parlent plus de BBCode ni du forum PHMC.
import React, { useState } from 'react';
import { ref, set } from 'firebase/database';
import { database } from '../../firebase';
import { useSiteConfig } from '../../contexts/SiteConfigContext';

const BbcodeAccessSwitch = ({ currentUser, showInAppNotification }) => {
    const { bbcodeEnabled } = useSiteConfig();
    const [saving, setSaving] = useState(false);

    const handleChange = async (enabled) => {
        setSaving(true);
        try {
            await set(ref(database, 'adminSettings/bbcodeAccess'), {
                enabled,
                updatedAt: Date.now(),
                updatedBy: currentUser?.email || null,
            });
            if (showInAppNotification) {
                showInAppNotification(enabled ? 'Accès au BBCode réactivé.' : 'Accès au BBCode désactivé : aperçu et HTML uniquement.', enabled ? 'check-circle' : 'info-circle');
            }
        } catch (error) {
            console.error('Réglage BBCode impossible :', error);
            alert('Impossible de modifier ce réglage : ' + (error?.message || error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card">
            <div className="card-header">Affichage du site</div>
            <div className="card-body">
                <div className="form-check form-switch mb-2">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="bbcodeAccessSwitch"
                        checked={bbcodeEnabled}
                        disabled={saving}
                        onChange={(event) => handleChange(event.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="bbcodeAccessSwitch">
                        <strong>Accès au BBCode</strong> : {bbcodeEnabled ? 'activé' : 'désactivé'}
                    </label>
                </div>
                <p className="text-muted small mb-2">
                    Désactivé, tout le site cache la copie du BBCode, le bouton « Montrer BBCode », les onglets et boutons BBCode des listes
                    (rapports enregistrés, dossiers, candidatures, recrutement) et le convertisseur BBCode → Discord. Il ne reste que
                    l'<strong>aperçu</strong> et le <strong>téléchargement HTML</strong> ; les fenêtres d'aide ne mentionnent plus le BBCode ni
                    le forum PHMC. Seule la demande de fonctionnalité continue d'accepter du BBCode <em>ou</em> du HTML pour proposer un nouveau formulaire.
                </p>
                <p className="text-muted small mb-0">Le réglage s'applique à tous les visiteurs, immédiatement.</p>
            </div>
        </div>
    );
};

export default BbcodeAccessSwitch;
