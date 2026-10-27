// src/components/Admin/BingoPauseButton.js
//
// Met en pause / reprend la carte de bingo d'un type, sans rien supprimer : la carte, les cases cochées et le journal
// restent tels quels. En pause : plus personne ne peut cocher de case (règle Firebase + message dans le jeu) et la
// réinitialisation quotidienne du serveur laisse la carte en l'état. Drapeau : bingo/cards/{type}/paused.
import React, { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { ref, onValue, set, remove } from 'firebase/database';
import { database } from '../../firebase';

const BingoPauseButton = ({ bingoType, disabled, showNotification, onLogAction }) => {
    const [paused, setPaused] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!bingoType?.path) return undefined;
        setPaused(false);
        return onValue(ref(database, `bingo/cards/${bingoType.path}/paused`), (snap) => setPaused(snap.val() === true), () => setPaused(false));
    }, [bingoType?.path]);

    const toggle = async () => {
        setBusy(true);
        try {
            const flagRef = ref(database, `bingo/cards/${bingoType.path}/paused`);
            if (paused) await remove(flagRef); else await set(flagRef, true);
            showNotification?.(paused ? `Carte Bingo ${bingoType.name} reprise.` : `Carte Bingo ${bingoType.name} mise en pause : plus personne ne peut cocher de case.`, 'check-circle');
            onLogAction?.(paused ? 'Carte de bingo reprise' : 'Carte de bingo mise en pause', `Type : ${bingoType.name}`);
        } catch (error) {
            console.error('Bingo pause toggle failed:', error);
            showNotification?.('Impossible de changer l’état de la carte.', 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Button
            variant={paused ? 'success' : 'outline-warning'} onClick={toggle} disabled={disabled || busy || !bingoType}
            title={paused
                ? 'Reprend la partie : les cases peuvent de nouveau être cochées et la réinitialisation quotidienne reprend.'
                : 'Fige la carte (cases et journal conservés) : plus personne ne peut cocher de case et la réinitialisation quotidienne l’ignore.'}
        >
            <i className={`fas ${paused ? 'fa-play' : 'fa-pause'}`}></i> {paused ? 'Reprendre la carte' : 'Mettre la carte en pause'}
        </Button>
    );
};

export default BingoPauseButton;
