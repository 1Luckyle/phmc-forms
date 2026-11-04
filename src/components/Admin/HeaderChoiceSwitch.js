// src/components/Admin/HeaderChoiceSwitch.js
//
// Panneau admin → Affichage : par défaut, tout le monde voit l'en-tête « immersif » (heure du serveur et météo). Activé, cet interrupteur rend à chacun le
// choix, dans Boîte à outils → Application, entre la météo et l'en-tête des remerciements (adminSettings/headerChoice, voir SettingsProvider).
import React, { useState } from 'react';
import { ref, set } from 'firebase/database';
import { database } from '../../firebase';
import { useSettings } from '../../contexts/SettingsProvider';

const HeaderChoiceSwitch = ({ currentUser, showInAppNotification }) => {
    const { headerChoiceEnabled } = useSettings();
    const [saving, setSaving] = useState(false);

    const handleChange = async (enabled) => {
        setSaving(true);
        try {
            await set(ref(database, 'adminSettings/headerChoice'), { enabled, updatedAt: Date.now(), updatedBy: currentUser?.email || null });
            if (showInAppNotification) {
                showInAppNotification(enabled ? 'Choix du header rétabli : le bouton revient dans Application.' : 'Header : météo seule pour tout le monde.', enabled ? 'check-circle' : 'info-circle');
            }
        } catch (error) {
            console.error('Réglage du header impossible :', error);
            alert('Impossible de modifier ce réglage : ' + (error?.message || error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card mt-3">
            <div className="card-header">En-tête du site</div>
            <div className="card-body">
                <div className="form-check form-switch mb-2">
                    <input
                        className="form-check-input" type="checkbox" id="headerChoiceSwitch"
                        checked={headerChoiceEnabled} disabled={saving} onChange={(event) => handleChange(event.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="headerChoiceSwitch">
                        <strong>Laisser le choix du header</strong> : {headerChoiceEnabled ? 'activé' : 'désactivé'}
                    </label>
                </div>
                <p className="text-muted small mb-2">
                    Désactivé (par défaut), tout le monde voit uniquement l'en-tête avec l'<strong>heure du serveur et la météo</strong>, et le bouton de bascule
                    disparaît de la Boîte à outils. Activé, le bouton « Header des remerciements » / « Header immersif » revient pour chacun ; son choix est
                    mémorisé dans son navigateur, et sans choix c'est la météo qui s'affiche.
                </p>
                <p className="text-muted small mb-0">Le réglage s'applique à tous les visiteurs, immédiatement.</p>
            </div>
        </div>
    );
};

export default HeaderChoiceSwitch;
