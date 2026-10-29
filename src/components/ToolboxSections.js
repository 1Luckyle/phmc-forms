// src/components/ToolboxSections.js
//
// Sections de la Boîte à Outils. Chaque section peut être :
//   • DÉROULÉE (par défaut) : son titre puis tous ses éléments, dans le menu ;
//   • REGROUPÉE : une seule ligne portant son nom ; ses éléments se déroulent dans un sous-menu au survol (au clic sur écran tactile ou au clavier).
// Un petit bouton à droite du nom bascule d'un état à l'autre. Le choix est mémorisé par appareil (localStorage) : un menu court sur PC, un autre sur
// un petit écran. Le sous-menu est rendu dans <body> (position fixe) : le menu défile et rognerait un sous-menu positionné à l'intérieur.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dropdown } from 'react-bootstrap';
import './ToolboxSections.css';

export const TOOLBOX_STORAGE_KEY = 'phmc.toolbox.groupedSections';
const OPEN_DELAY_MS = 90;
const CLOSE_DELAY_MS = 220;

const readGrouped = () => {
    try {
        const value = JSON.parse(localStorage.getItem(TOOLBOX_STORAGE_KEY) || '[]');
        return Array.isArray(value) ? value.filter((key) => typeof key === 'string') : [];
    } catch (error) {
        return [];
    }
};

const useGroupedSections = () => {
    const [grouped, setGrouped] = useState(readGrouped);
    const toggle = useCallback((key) => setGrouped((previous) => {
        const next = previous.includes(key) ? previous.filter((value) => value !== key) : [...previous, key];
        try { localStorage.setItem(TOOLBOX_STORAGE_KEY, JSON.stringify(next)); } catch (error) { /* stockage indisponible : le choix n'est pas gardé */ }
        return next;
    }), []);
    return [grouped, toggle];
};

// Sous-menu d'une section regroupée, à gauche de sa ligne (le menu est collé au bord droit de l'écran), sinon à droite ; recalé pour rester à l'écran.
const Flyout = ({ anchor, items, onEnter, onLeave, onPick, onEscape }) => {
    const ref = useRef(null);
    const [position, setPosition] = useState({ top: anchor.top, left: anchor.left, visible: false });

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const { offsetWidth: width, offsetHeight: height } = element;
        const margin = 8;
        let left = anchor.left - width + 1;
        if (left < margin) left = Math.min(anchor.right - 1, window.innerWidth - width - margin);
        const top = Math.max(margin, Math.min(anchor.top - 4, window.innerHeight - height - margin));
        setPosition({ top, left, visible: true });
    }, [anchor, items.length]);

    return createPortal(
        <div
            ref={ref}
            className="dropdown-menu show tb-flyout"
            role="menu"
            style={{ top: position.top, left: position.left, visibility: position.visible ? 'visible' : 'hidden' }}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onEscape(); } }}
        >
            {items.map((item) => (
                <button type="button" role="menuitem" key={item.key} className="dropdown-item" style={item.style} onClick={(event) => onPick(item, event)}>
                    <i className={item.icon}></i> {item.label}
                </button>
            ))}
        </div>,
        document.body,
    );
};

// sections : [{ key, label, items: [{ key, icon, label, onClick, style }] }] (déjà filtrées) ; menuOpen : le menu parent est ouvert.
const ToolboxSections = ({ sections, menuOpen }) => {
    const [grouped, toggleGrouped] = useGroupedSections();
    const [openKey, setOpenKey] = useState(null);
    const [anchor, setAnchor] = useState(null);
    const rowRefs = useRef({});
    const timer = useRef(null);

    const clearTimer = useCallback(() => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } }, []);
    const openFlyout = (key, delay = OPEN_DELAY_MS) => {
        clearTimer();
        timer.current = setTimeout(() => {
            const element = rowRefs.current[key];
            if (!element) return;
            setAnchor(element.getBoundingClientRect());
            setOpenKey(key);
        }, delay);
    };
    const scheduleClose = () => { clearTimer(); timer.current = setTimeout(() => setOpenKey(null), CLOSE_DELAY_MS); };
    const closeNow = useCallback(() => { clearTimer(); setOpenKey(null); }, [clearTimer]);

    useEffect(() => { if (!menuOpen) closeNow(); }, [menuOpen, closeNow]);
    useEffect(() => clearTimer, [clearTimer]);

    const openSection = sections.find((section) => section.key === openKey);

    return (
        <>
            {sections.map((section, index) => {
                const isGrouped = grouped.includes(section.key);
                return (
                    <React.Fragment key={section.key}>
                        {index > 0 && <Dropdown.Divider />}
                        {isGrouped ? (
                            <div className={`tb-row${openKey === section.key ? ' open' : ''}`} ref={(element) => { rowRefs.current[section.key] = element; }}
                                onMouseEnter={() => openFlyout(section.key)} onMouseLeave={scheduleClose}>
                                <button
                                    type="button" className="tb-row-main" aria-haspopup="menu" aria-expanded={openKey === section.key}
                                    onClick={() => { if (openKey === section.key) closeNow(); else openFlyout(section.key, 0); }}
                                    onKeyDown={(event) => { if (event.key === 'Escape' && openKey === section.key) { event.stopPropagation(); closeNow(); } }}
                                >
                                    <i className="fas fa-chevron-left tb-row-arrow" aria-hidden="true"></i>
                                    <span className="tb-row-label">{section.label}</span>
                                    <span className="tb-row-count">{section.items.length}</span>
                                </button>
                                <button type="button" className="tb-toggle" title="Dérouler cette section dans le menu" aria-label={`Dérouler la section ${section.label} dans le menu`}
                                    onClick={() => { closeNow(); toggleGrouped(section.key); }}>
                                    <i className="fas fa-up-right-and-down-left-from-center"></i>
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="dropdown-header tb-head">
                                    <span>{section.label}</span>
                                    <button type="button" className="tb-toggle" title="Regrouper cette section : ses éléments se déroulent au survol" aria-label={`Regrouper la section ${section.label}`}
                                        onClick={() => { closeNow(); toggleGrouped(section.key); }}>
                                        <i className="fas fa-layer-group"></i>
                                    </button>
                                </div>
                                {section.items.map((item) => (
                                    <Dropdown.Item key={item.key} onClick={item.onClick} style={item.style}>
                                        <i className={item.icon}></i> {item.label}
                                    </Dropdown.Item>
                                ))}
                            </>
                        )}
                    </React.Fragment>
                );
            })}
            {openSection && anchor && grouped.includes(openSection.key) && (
                <Flyout
                    anchor={anchor}
                    items={openSection.items}
                    onEnter={clearTimer}
                    onLeave={scheduleClose}
                    onEscape={closeNow}
                    onPick={(item, event) => { closeNow(); if (item.onClick) item.onClick(event); }}
                />
            )}
        </>
    );
};

export default ToolboxSections;
