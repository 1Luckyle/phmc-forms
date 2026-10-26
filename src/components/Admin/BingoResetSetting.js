// src/components/Admin/BingoResetSetting.js
//
// Fréquence de réinitialisation de la carte de bingo d'un type : tous les N jours, ou jamais (carte « infinie »).
// Réglage : bingo/cards/{type}/resetEveryDays (1 par défaut ; 0 = jamais). Le serveur (dailyTaskHandler, 09:00 UTC) le lit
// chaque jour et compare à bingo/cards/{type}/lastResetAt, écrit à chaque génération de carte.
import React, { useEffect, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { ref, onValue, set, remove } from 'firebase/database';
import { database } from '../../firebase';

const formatDate = (ts) => (ts ? new Date(ts).toLocaleString('fr-FR') : 'inconnue');
const DAY_MS = 24 * 60 * 60 * 1000;

const BingoResetSetting = ({ bingoType, disabled, showNotification, onLogAction }) => {
    const [saved, setSaved] = useState({ resetEveryDays: 1, lastResetAt: 0 });
    const [days, setDays] = useState('1');
    const [never, setNever] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!bingoType?.path) return undefined;
        return onValue(ref(database, `bingo/cards/${bingoType.path}`), (snap) => {
            const value = snap.val() || {};
            const every = value.resetEveryDays === undefined || value.resetEveryDays === null ? 1 : Number(value.resetEveryDays);
            setSaved({ resetEveryDays: every, lastResetAt: Number(value.lastResetAt || 0) });
            setNever(every === 0);
            setDays(String(every === 0 ? 1 : every));
        }, () => {});
    }, [bingoType?.path]);

    const parsedDays = Math.floor(Number(days));
    const valid = never || (Number.isFinite(parsedDays) && parsedDays >= 1 && parsedDays <= 365);
    const nextValue = never ? 0 : parsedDays;
    const unchanged = valid && nextValue === saved.resetEveryDays;

    const save = async () => {
        if (!valid) return;
        setBusy(true);
        try {
            const settingRef = ref(database, `bingo/cards/${bingoType.path}/resetEveryDays`);
            if (nextValue === 1) await remove(settingRef); else await set(settingRef, nextValue);
            // On repart d'aujourd'hui : « tous les N jours » se compte à partir de l'enregistrement si aucune réinitialisation n'est connue.
            if (!saved.lastResetAt) await set(ref(database, `bingo/cards/${bingoType.path}/lastResetAt`), Date.now());
            const label = nextValue === 0 ? 'jamais (carte infinie)' : nextValue === 1 ? 'tous les jours' : `tous les ${nextValue} jours`;
            showNotification?.(`Carte Bingo ${bingoType.name} : réinitialisation ${label}.`, 'check-circle');
            onLogAction?.('Fréquence de réinitialisation du bingo modifiée', `Type : ${bingoType.name}\nRéinitialisation : ${label}`);
        } catch (error) {
            console.error('Bingo reset setting failed:', error);
            showNotification?.('Impossible d’enregistrer la fréquence de réinitialisation.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const nextReset = !never && saved.resetEveryDays > 0 && saved.lastResetAt
        ? saved.lastResetAt + saved.resetEveryDays * DAY_MS : null;

    return (
        <div className="adm-fieldset" style={{ marginBottom: '1rem' }}>
            <div className="adm-fieldset-title">Réinitialisation de la carte {bingoType?.name}</div>
            <div className="d-flex flex-wrap align-items-center gap-3">
                <Form.Check
                    type="switch" id="bingo-never-reset" label="Jamais (carte infinie)" checked={never}
                    onChange={(e) => setNever(e.target.checked)} disabled={disabled || busy}
                />
                <div className="d-flex align-items-center gap-2">
                    <span>Tous les</span>
                    <Form.Control
                        type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)}
                        disabled={disabled || busy || never} style={{ width: '90px' }} aria-label="Nombre de jours entre deux réinitialisations"
                    />
                    <span>jour(s)</span>
                </div>
                <Button variant="primary" size="sm" onClick={save} disabled={disabled || busy || !valid || unchanged}>Enregistrer</Button>
            </div>
            <p className="text-muted small mb-0 mt-2">
                {saved.resetEveryDays === 0
                    ? 'La carte ne se réinitialise jamais toute seule : seul le bouton « Générer une nouvelle carte » la renouvelle.'
                    : `Contrôle quotidien à 09:00 UTC. Dernière réinitialisation : ${formatDate(saved.lastResetAt)}${nextReset ? ` · prochaine vers le ${formatDate(nextReset)}` : ''}.`}
            </p>
        </div>
    );
};

export default BingoResetSetting;
