// src/components/Admin/PbcAccessSwitch.js
//
// Panneau admin → Affichage : active / désactive les formulaires de la clinique de Paleto Bay (PBC) pour TOUT le site. Désactivés, personne (administrateurs
// compris) ne peut ouvrir, remplir ni enregistrer un formulaire PBC, et le choix « PBC » des candidatures disparaît. Les agences, elles, restent proposées
// comme destinataire ou requérant des formulaires. Réglage stocké dans adminSettings/pbcAccess (lecture publique, écriture admin).
import React, { useState } from 'react';
import { ref, set } from 'firebase/database';
import { database } from '../../firebase';
import { useSiteConfig } from '../../contexts/SiteConfigContext';

const PbcAccessSwitch = ({ currentUser, showInAppNotification }) => {
    const { pbcEnabled } = useSiteConfig();
    const [saving, setSaving] = useState(false);

    const handleChange = async (enabled) => {
        setSaving(true);
        try {
            await set(ref(database, 'adminSettings/pbcAccess'), {
                enabled,
                updatedAt: Date.now(),
                updatedBy: currentUser?.email || null,
            });
            if (showInAppNotification) {
                showInAppNotification(enabled ? 'Formulaires PBC réactivés.' : 'Formulaires PBC désactivés pour tout le site.', enabled ? 'check-circle' : 'info-circle');
            }
        } catch (error) {
            console.error('Réglage PBC impossible :', error);
            alert('Impossible de modifier ce réglage : ' + (error?.message || error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card mt-3">
            <div className="card-header">Clinique de Paleto Bay (PBC)</div>
            <div className="card-body">
                <div className="form-check form-switch mb-2">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="pbcAccessSwitch"
                        checked={pbcEnabled}
                        disabled={saving}
                        onChange={(event) => handleChange(event.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="pbcAccessSwitch">
                        <strong>Formulaires PBC</strong> : {pbcEnabled ? 'activés' : 'désactivés'}
                    </label>
                </div>
                <p className="text-muted small mb-2">
                    Désactivés, plus personne (administrateurs compris) ne peut ouvrir, remplir ni enregistrer l'Évaluation physique, la Consultation psychiatrique,
                    la Consultation générale, la Note de service ou l'Évaluation psychologique version PBC : un formulaire PBC resté ouvert bascule sur son
                    équivalent PHMC et le choix PHMC / PBC disparaît. Le site PBC n'est plus proposé dans les candidatures.
                </p>
                <p className="text-muted small mb-0">
                    Les agences restent proposées comme destinataire ou requérant des formulaires, PBC comprise. Les rapports PBC déjà enregistrés sont conservés.
                    Le réglage s'applique à tous les visiteurs, immédiatement.
                </p>
            </div>
        </div>
    );
};

export default PbcAccessSwitch;
