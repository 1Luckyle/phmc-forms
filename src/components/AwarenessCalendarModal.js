// src/components/AwarenessCalendarModal.js
//
// Calendrier des événements de sensibilisation et de soutien médical (Octobre Rose, Movember...) :
// ce que c'est, comment soutenir la cause, et les symboles (couleur du ruban, emblème). Les données
// sont dans src/data/awarenessEvents.js. Ouvert depuis la Boîte à outils, accessible à tous.
import React, { useMemo, useState } from 'react';
import { Badge, Form } from 'react-bootstrap';
import BaseModal from './BaseModal';
import {
    AWARENESS_EVENTS, AWARENESS_CATEGORIES, formatEventDates, getEventRange, isEventActive, daysUntilEvent, eventTouchesMonth,
} from '../data/awarenessEvents';
import './AwarenessCalendar.css';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// Ruban de la/des couleur(s) de la cause : dégradé à paliers nets quand il y en a plusieurs.
const RibbonIcon = ({ ribbon, size = 28 }) => {
    if (!ribbon || ribbon.length === 0) {
        return <i className="fas fa-hand-holding-medical awareness-ribbon awareness-ribbon-none" style={{ fontSize: size }} aria-hidden="true"></i>;
    }
    if (ribbon.length === 1) {
        return <i className="fas fa-ribbon awareness-ribbon" style={{ fontSize: size, color: ribbon[0].hex }} aria-hidden="true"></i>;
    }
    const step = 100 / ribbon.length;
    const stops = ribbon.map((c, i) => `${c.hex} ${i * step}% ${(i + 1) * step}%`).join(', ');
    return (
        <i className="fas fa-ribbon awareness-ribbon awareness-ribbon-multi" aria-hidden="true"
            style={{ fontSize: size, backgroundImage: `linear-gradient(90deg, ${stops})` }}></i>
    );
};

const EventCard = ({ event, today, open, onToggle }) => {
    const active = isEventActive(event, today);
    const days = daysUntilEvent(event, today);
    const category = AWARENESS_CATEGORIES[event.category];
    return (
        <div className={`awareness-card${active ? ' awareness-card-active' : ''}`}>
            <button type="button" className="awareness-card-head" onClick={onToggle} aria-expanded={open}>
                <RibbonIcon ribbon={event.ribbon} />
                <span className="awareness-card-title">
                    <strong>{event.name}</strong>
                    <small>{formatEventDates(event, today.getFullYear())} · {event.cause}</small>
                </span>
                <span className="awareness-card-badges">
                    {active
                        ? <Badge bg="success">En cours</Badge>
                        : days <= 30 && <Badge bg="info" text="dark">dans {days} j</Badge>}
                    {category && <Badge bg="secondary" className="d-none d-sm-inline"><i className={`fas ${category.icon} me-1`}></i>{category.label}</Badge>}
                </span>
                <i className={`fas fa-chevron-${open ? 'up' : 'down'} awareness-chevron`} aria-hidden="true"></i>
            </button>

            {open && (
                <div className="awareness-card-body">
                    <h6>De quoi s'agit-il ?</h6>
                    <p>{event.about}</p>

                    <h6>Comment soutenir la cause</h6>
                    <ul>{event.support.map((item) => <li key={item}>{item}</li>)}</ul>

                    <h6>Symboles</h6>
                    <div className="awareness-symbols">
                        {event.ribbon.length > 0 ? event.ribbon.map((color) => (
                            <span key={color.name} className="awareness-swatch">
                                <span className="awareness-swatch-dot" style={{ backgroundColor: color.hex }}></span>{color.name}
                            </span>
                        )) : <span className="awareness-swatch awareness-swatch-muted">Pas de ruban officiel largement reconnu</span>}
                        {event.emblem && <span className="awareness-swatch"><i className="fas fa-star me-1"></i>{event.emblem}</span>}
                    </div>
                    {event.symbols && <p className="awareness-symbols-text">{event.symbols}</p>}
                </div>
            )}
        </div>
    );
};

const AwarenessCalendarModal = ({ show, onHide }) => {
    const today = useMemo(() => new Date(), [show]); // eslint-disable-line react-hooks/exhaustive-deps -- recalculé à chaque ouverture
    const [month, setMonth] = useState('all'); // 'all' | 1..12
    const [category, setCategory] = useState('all');
    const [query, setQuery] = useState('');
    const [openId, setOpenId] = useState(null);

    const year = today.getFullYear();

    // Tous les événements triés par date de début dans l'année.
    const sorted = useMemo(
        () => [...AWARENESS_EVENTS].sort((a, b) => getEventRange(a, year).start - getEventRange(b, year).start),
        [year]
    );
    const active = sorted.filter((e) => isEventActive(e, today));
    const upcoming = useMemo(
        () => sorted.filter((e) => !isEventActive(e, today)).map((e) => ({ e, d: daysUntilEvent(e, today) }))
            .sort((a, b) => a.d - b.d).slice(0, 3).map(({ e }) => e),
        [sorted, today]
    );

    const filtered = sorted.filter((e) => {
        if (month !== 'all' && !eventTouchesMonth(e, month)) return false;
        if (category !== 'all' && e.category !== category) return false;
        const q = query.trim().toLowerCase();
        return !q || e.name.toLowerCase().includes(q) || e.cause.toLowerCase().includes(q);
    });

    const toggle = (id) => setOpenId((current) => (current === id ? null : id));
    const card = (event) => <EventCard key={event.id} event={event} today={today} open={openId === event.id} onToggle={() => toggle(event.id)} />;

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Calendrier de la santé" modalSize="large" className="dark-ui">
            <p className="text-muted small mb-3">
                Journées et mois de sensibilisation : de quoi il s'agit, comment soutenir la cause et que signifient les rubans et symboles.
                Aujourd'hui : {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>

            {active.length > 0 && (
                <section className="mb-3">
                    <h6 className="awareness-section-title"><i className="fas fa-bell me-2"></i>En ce moment</h6>
                    {active.map(card)}
                </section>
            )}
            {upcoming.length > 0 && (
                <section className="mb-3">
                    <h6 className="awareness-section-title"><i className="fas fa-hourglass-half me-2"></i>Prochainement</h6>
                    {upcoming.map(card)}
                </section>
            )}

            <h6 className="awareness-section-title"><i className="fas fa-calendar-alt me-2"></i>Tous les événements</h6>
            <div className="awareness-months" role="group" aria-label="Filtrer par mois">
                <button type="button" className={`awareness-chip${month === 'all' ? ' on' : ''}`} onClick={() => setMonth('all')}>Tous</button>
                {MONTH_LABELS.map((label, index) => (
                    <button key={label} type="button" className={`awareness-chip${month === index + 1 ? ' on' : ''}${today.getMonth() === index ? ' current' : ''}`}
                        onClick={() => setMonth(index + 1)}>{label}</button>
                ))}
            </div>
            <div className="d-flex gap-2 mb-3 flex-wrap">
                <Form.Control type="search" style={{ maxWidth: 260 }} size="sm" placeholder="Rechercher (cause, événement)…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <Form.Select size="sm" style={{ maxWidth: 240 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="all">Toutes les catégories</option>
                    {Object.entries(AWARENESS_CATEGORIES).map(([key, cat]) => <option key={key} value={key}>{cat.label}</option>)}
                </Form.Select>
            </div>

            {filtered.length === 0
                ? <p className="text-muted">Aucun événement ne correspond à ces filtres.</p>
                : filtered.map(card)}
        </BaseModal>
    );
};

export default AwarenessCalendarModal;
