// src/components/Admin/DebugSeasonTester.js
//
// Testeur des effets de saison (section Debug du panneau admin) : un bouton par jour de fête, par
// fond de saison et par événement du calendrier de la santé. Chaque bouton simule la date en question
// (dans CE navigateur uniquement, voir utils/debugSeasonDate.js) ; il suffit ensuite de retourner sur
// la page des formulaires pour voir l'effet. Le bandeau indique la date simulée et l'effet attendu.
import React, { useMemo, useState } from 'react';
import { Button, Alert, Form } from 'react-bootstrap';
import { useSettings } from '../../contexts/SettingsProvider';
import { resolveSeason } from '../SeasonalEvents';
import {
    AWARENESS_EVENTS, AWARENESS_CATEGORIES, getEventRange, formatEventDates,
} from '../../data/awarenessEvents';
import {
    getSimulatedDateString, setSimulatedDate, clearSimulatedDate, toDateString,
} from '../../utils/debugSeasonDate';

const EFFECT_LABELS = {
    Halloween: 'tombes d\'Halloween (+ image Halloween des rapports)',
    Christmas: 'neige de Noël (+ image de Noël des rapports)',
    NewYear: 'confettis du Nouvel An',
    AprilFools: 'poissons qui tombent + œuf qui tourne (poisson d\'avril)',
    Valentine: 'cœurs de la Saint-Valentin',
    Easter: 'œufs en chocolat qui tombent (+ image de Pâques des rapports)',
    Winter: 'neige légère d\'hiver',
    Spring: 'fleurs de printemps',
    Summer: 'soleils d\'été',
    Autumn: 'feuilles d\'automne',
};

const describeEffect = (date) => {
    const { season, healthEvents } = resolveSeason(date);
    if (season === 'HealthEvent') {
        const names = healthEvents.map((event) => event.name).join(' + ');
        return healthEvents.length > 1
            ? `rubans mélangés : ${names}`
            : `effet santé : ${names}`;
    }
    return EFFECT_LABELS[season] || season;
};

const FESTIVE = [
    { label: 'Halloween', mmdd: '10-31' },
    { label: 'Noël', mmdd: '12-25' },
    { label: 'Nouvel An', mmdd: '01-01' },
    { label: 'Poisson d\'avril', mmdd: '04-01' },
    { label: 'Saint-Valentin', mmdd: '02-14' },
];

// Périodes « creuses » sans événement de santé : l'ancien effet de saison sert de fond.
const BACKGROUNDS = [
    { label: 'Hiver (février)', mmdd: '02-10' },
    { label: 'Pâques (avril)', mmdd: '04-15' },
    { label: 'Été (juin)', mmdd: '06-15' },
    { label: 'Été (août)', mmdd: '08-20' },
    { label: 'Noël en fond (décembre)', mmdd: '12-15' },
];

// Mois comportant plusieurs événements d'un mois entier : rubans mélangés.
const MIXED = [
    { label: 'Septembre (Or + prostate + ovaire)', mmdd: '09-15' },
    { label: 'Mars (Mars Bleu + endométriose)', mmdd: '03-17' },
    { label: 'Novembre (Movember + poumon)', mmdd: '11-20' },
];

const formatFr = (dateString) => {
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const DebugSeasonTester = ({ showInAppNotification }) => {
    const { seasonalEffectsEnabled, toggleSeasonalEffects } = useSettings();
    const year = new Date().getFullYear();
    const [simulated, setSimulated] = useState(getSimulatedDateString());
    const [customDate, setCustomDate] = useState('');

    // Pour chaque événement, une date de test où C'EST BIEN lui qui pilote l'effet (le 1er janvier,
    // par exemple, serait pris par le Nouvel An : on cherche le premier jour utilisable).
    const eventButtons = useMemo(() => AWARENESS_EVENTS.map((event) => {
        const { start, end } = getEventRange(event, year);
        const cursor = new Date(start);
        let testDate = null;
        while (cursor <= end) {
            const { season, healthEvents } = resolveSeason(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12));
            if (season === 'HealthEvent' && healthEvents.some((candidate) => candidate.id === event.id)) {
                testDate = toDateString(cursor);
                break;
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return { event, testDate };
    }), [year]);

    const eventsByCategory = useMemo(() => {
        const groups = {};
        eventButtons.forEach((entry) => {
            (groups[entry.event.category] = groups[entry.event.category] || []).push(entry);
        });
        Object.values(groups).forEach((list) => list.sort((a, b) => (a.testDate || '').localeCompare(b.testDate || '')));
        return groups;
    }, [eventButtons]);

    const apply = (dateString, label) => {
        setSimulatedDate(dateString);
        setSimulated(dateString);
        if (showInAppNotification) showInAppNotification(`Date simulée : ${formatFr(dateString)} (${label || 'date choisie'}).`, 'flask');
    };

    const reset = () => {
        clearSimulatedDate();
        setSimulated(null);
        if (showInAppNotification) showInAppNotification('Retour à la date réelle.', 'info-circle');
    };

    const simulatedDate = simulated ? (() => { const [y, m, d] = simulated.split('-').map(Number); return new Date(y, m - 1, d, 12); })() : null;

    const renderButton = (key, label, dateString, title) => (
        <Button
            key={key}
            size="sm"
            className="me-1 mb-1"
            variant={simulated === dateString ? 'primary' : 'outline-secondary'}
            onClick={() => apply(dateString, label)}
            title={title || `Simuler le ${formatFr(dateString)}`}
        >
            {label} <small>({dateString.slice(8, 10)}/{dateString.slice(5, 7)})</small>
        </Button>
    );

    return (
        <div>
            <p className="text-muted">
                <strong>Tester les effets de saison.</strong> Chaque bouton simule la date correspondante <strong>dans ce navigateur uniquement</strong> :
                retournez ensuite sur la page des formulaires pour voir l'effet (et l'infobulle « i » du header). Un badge 🧪 apparaît
                dans le header tant qu'une date est simulée ; cliquez dessus ou sur « Date réelle » pour revenir à la normale.
            </p>

            <Alert variant={simulated ? 'warning' : 'secondary'} className="py-2">
                {simulated ? (
                    <>
                        <i className="fas fa-flask me-2"></i>
                        Date simulée : <strong>{formatFr(simulated)}</strong> — effet attendu : <strong>{describeEffect(simulatedDate)}</strong>.
                    </>
                ) : (
                    <>
                        <i className="fas fa-check-circle me-2"></i>
                        Date réelle utilisée — effet actuel : <strong>{describeEffect(new Date())}</strong>.
                    </>
                )}
                {!seasonalEffectsEnabled && (
                    <div className="mt-2">
                        <i className="fas fa-exclamation-triangle me-1"></i>
                        Les effets de saison sont <strong>désactivés</strong> sur votre navigateur : vous ne verrez rien.{' '}
                        <Button size="sm" variant="outline-dark" onClick={toggleSeasonalEffects}>Les activer</Button>
                    </div>
                )}
            </Alert>

            <div className="mb-3 d-flex gap-2 flex-wrap align-items-center">
                <Button size="sm" variant={simulated ? 'warning' : 'outline-secondary'} onClick={reset} disabled={!simulated}>
                    <i className="fas fa-undo me-1"></i>Date réelle
                </Button>
                <Form.Control type="date" size="sm" style={{ maxWidth: 180, width: 'auto' }} value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                <Button size="sm" variant="outline-primary" disabled={!customDate} onClick={() => apply(customDate, 'date libre')}>Simuler cette date</Button>
            </div>

            <h6>Jours de fête <small className="text-muted">(priorité maximale)</small></h6>
            <div className="mb-3">
                {FESTIVE.map((entry) => renderButton(entry.label, entry.label, `${year}-${entry.mmdd}`, describeEffect(new Date(`${year}-${entry.mmdd}T12:00:00`))))}
            </div>

            <h6>Fond de saison <small className="text-muted">(périodes sans événement de santé)</small></h6>
            <div className="mb-1">
                {BACKGROUNDS.map((entry) => renderButton(entry.label, entry.label, `${year}-${entry.mmdd}`, describeEffect(new Date(`${year}-${entry.mmdd}T12:00:00`))))}
            </div>
            <p className="text-muted small mb-3">Printemps et automne n'ont plus de période propre : mars, mai et septembre à novembre sont couverts par des événements de santé.</p>

            <h6>Mois à plusieurs événements <small className="text-muted">(rubans mélangés)</small></h6>
            <div className="mb-3">
                {MIXED.map((entry) => renderButton(entry.label, entry.label, `${year}-${entry.mmdd}`, describeEffect(new Date(`${year}-${entry.mmdd}T12:00:00`))))}
            </div>

            <h6>Événements du calendrier de la santé <small className="text-muted">({AWARENESS_EVENTS.length})</small></h6>
            {Object.entries(AWARENESS_CATEGORIES).map(([categoryKey, category]) => (
                eventsByCategory[categoryKey] ? (
                    <div key={categoryKey} className="mb-2">
                        <div className="small fw-semibold mb-1"><i className={`fas ${category.icon} me-1`}></i>{category.label}</div>
                        {eventsByCategory[categoryKey].map(({ event, testDate }) => (
                            testDate
                                ? renderButton(event.id, event.name, testDate, `${formatEventDates(event, year)} — ${describeEffect(new Date(`${testDate}T12:00:00`))}`)
                                : null
                        ))}
                    </div>
                ) : null
            ))}
            {eventButtons.some((entry) => !entry.testDate) && (
                <p className="text-muted small mb-0">
                    Non testable à part (le jour de fête prime sur toute la durée) :{' '}
                    {eventButtons.filter((entry) => !entry.testDate).map((entry) => entry.event.name).join(', ')}. Son contenu reste visible dans l'infobulle « i ».
                </p>
            )}
        </div>
    );
};

export default DebugSeasonTester;
