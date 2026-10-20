// src/components/SeasonControls.js
//
// Accès rapide dans le header (en haut à gauche) :
//   • un bouton pour activer / désactiver les effets de saison (même réglage que la Boîte à outils) ;
//   • un « i » dont l'infobulle explique les événements du calendrier de la santé en cours
//     (ou, à défaut, le prochain), pour une culture santé plus accessible.
import React, { useState } from 'react';
import { OverlayTrigger, Popover, Button } from 'react-bootstrap';
import { useSettings } from '../contexts/SettingsProvider';
import { getEffectiveDate, getSimulatedDateString, clearSimulatedDate } from '../utils/debugSeasonDate';
import RibbonIcon from './RibbonIcon';
import { getActiveEvents, getNextEvent, formatEventDates, getEventDurationDays, SHORT_EVENT_MAX_DAYS } from '../data/awarenessEvents';
import './SeasonControls.css';

const SeasonControls = ({ onOpenCalendar }) => {
    const { seasonalEffectsEnabled, toggleSeasonalEffects } = useSettings();
    const [open, setOpen] = useState(false);

    // Recalculé à chaque rendu (MainApp se re-rend chaque seconde) : bascule seule à minuit.
    // (ou la date simulée depuis le panneau admin → Debug, signalée par le badge 🧪 ci-dessous)
    const today = getEffectiveDate();
    const simulatedDate = getSimulatedDateString();
    const active = getActiveEvents(today).sort(
        (a, b) => getEventDurationDays(a, today.getFullYear()) - getEventDurationDays(b, today.getFullYear())
    );
    const next = active.length === 0 ? getNextEvent(today) : null;

    const popover = (
        <Popover id="season-health-popover" className="season-popover">
            <Popover.Header as="h3">
                <i className="fas fa-heart-pulse me-2"></i>Calendrier de la santé
            </Popover.Header>
            <Popover.Body>
                {active.length > 0 ? active.map((event) => (
                    <div key={event.id} className="season-popover-event">
                        <div className="season-popover-title">
                            <RibbonIcon ribbon={event.ribbon} size={22} />
                            <span>
                                <strong>{event.name}</strong>
                                <small>
                                    {formatEventDates(event, today.getFullYear())}
                                    {getEventDurationDays(event, today.getFullYear()) <= SHORT_EVENT_MAX_DAYS ? '' : ' · mois entier'}
                                </small>
                            </span>
                        </div>
                        <p className="season-popover-cause">{event.cause}</p>
                        <p>{event.about}</p>
                        {event.ribbon.length > 0 && (
                            <p className="season-popover-ribbon">
                                Ruban : {event.ribbon.map((color) => color.name).join(' + ')}
                                {event.emblem ? ` · ${event.emblem}` : ''}
                            </p>
                        )}
                    </div>
                )) : (
                    <p className="mb-2">
                        Aucun événement de santé aujourd'hui.
                        {next && (
                            <>
                                {' '}Prochain : <strong>{next.event.name}</strong>{' '}
                                ({formatEventDates(next.event, next.year)}),{' '}
                                {next.days === 1 ? 'demain' : `dans ${next.days} jours`}.
                            </>
                        )}
                    </p>
                )}
                <p className="season-popover-note">
                    Les effets de saison suivent ce calendrier : un événement d'un jour ou d'une semaine passe avant ceux d'un mois entier, et plusieurs événements d'un même mois se partagent l'écran.
                </p>
                <Button size="sm" variant="primary" onClick={() => { setOpen(false); onOpenCalendar(); }}>
                    <i className="fas fa-calendar-alt me-1"></i>Ouvrir le calendrier complet
                </Button>
            </Popover.Body>
        </Popover>
    );

    return (
        <div className="season-controls">
            <button
                type="button"
                className={`season-control-button${seasonalEffectsEnabled ? ' on' : ''}`}
                onClick={toggleSeasonalEffects}
                aria-pressed={seasonalEffectsEnabled}
                title={seasonalEffectsEnabled ? 'Effets de saison activés — cliquer pour désactiver' : 'Effets de saison désactivés — cliquer pour activer'}
            >
                <i className={`fas ${seasonalEffectsEnabled ? 'fa-wand-magic-sparkles' : 'fa-ban'}`}></i>
            </button>
            {simulatedDate && (
                <button
                    type="button"
                    className="season-control-button simulated"
                    onClick={() => clearSimulatedDate()}
                    title={`Date simulée (debug) : ${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. Cliquer pour revenir à la date réelle.`}
                >
                    <i className="fas fa-flask"></i>
                    <span>{today.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                </button>
            )}
            <OverlayTrigger
                show={open}
                onToggle={(next_) => setOpen(next_)}
                trigger="click"
                rootClose
                placement="bottom-start"
                overlay={popover}
            >
                <button type="button" className="season-control-button info" title="Que se passe-t-il en santé en ce moment ?" aria-label="Événements du calendrier de la santé en cours">
                    <i className="fas fa-circle-info"></i>
                </button>
            </OverlayTrigger>
        </div>
    );
};

export default SeasonControls;
