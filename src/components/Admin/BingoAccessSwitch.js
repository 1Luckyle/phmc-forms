// src/components/Admin/BingoAccessSwitch.js
//
// Panneau admin → Affichage : active / désactive le bouton d'accès au Bingo pour TOUT le site. Désactivé, le bouton « Bingo » disparaît pour tout le monde, administrateurs compris (et la fenêtre ne s'ouvre plus,
// y compris par un lien direct). Les cartes, les cases cochées et le journal ne sont pas touchés (pour figer une partie,
// voir « Mettre la carte en pause » dans la section Bingo). Réglage stocké dans adminSettings/bingoAccess (lecture publique, écriture admin : voir database.rules.json).
import React, { useState } from 'react';
import { ref, set } from 'firebase/database';
import { database } from '../../firebase';
import { useSiteConfig } from '../../contexts/SiteConfigContext';

const BingoAccessSwitch = ({ currentUser, showInAppNotification }) => {
    const { bingoEnabled } = useSiteConfig();
    const [saving, setSaving] = useState(false);

    const handleChange = async (enabled) => {
        setSaving(true);
        try {
            await set(ref(database, 'adminSettings/bingoAccess'), { enabled, updatedAt: Date.now(), updatedBy: currentUser?.email || null });
            if (showInAppNotification) {
                showInAppNotification(enabled ? 'Accès au Bingo réactivé.' : 'Accès au Bingo désactivé : le bouton disparaît pour tout le monde.', enabled ? 'check-circle' : 'info-circle');
            }
        } catch (error) {
            console.error('Réglage Bingo impossible :', error);
            alert('Impossible de modifier ce réglage : ' + (error?.message || error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="card mt-3">
            <div className="card-header">Accès au Bingo</div>
            <div className="card-body">
                <div className="form-check form-switch mb-2">
                    <input className="form-check-input" type="checkbox" id="bingoAccessSwitch" checked={bingoEnabled} disabled={saving} onChange={(event) => handleChange(event.target.checked)} />
                    <label className="form-check-label" htmlFor="bingoAccessSwitch">
                        <strong>Bouton Bingo</strong> : {bingoEnabled ? 'activé' : 'désactivé'}
                    </label>
                </div>
                <p className="text-muted small mb-2">
                    Désactivé, le bouton « Bingo » disparaît pour tout le monde, administrateurs compris, et la fenêtre du Bingo ne s'ouvre plus (lien direct compris).
                    Les cartes, les cases cochées et le journal sont conservés tels quels.
                </p>
                <p className="text-muted small mb-0">Le réglage s'applique à tous les visiteurs, immédiatement.</p>
            </div>
        </div>
    );
};

export default BingoAccessSwitch;
