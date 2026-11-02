// src/components/FireSafety/FireSafetyHub.js
//
// « Sécurité incendie » (Boîte à outils) : un seul point d'entrée pour « Signaler un problème incendie » (tout le personnel) et « Gestion de la
// sécurité incendie » (admins, Direction, administratif), comme « Administratif » ou « Comptabilité ». Le menu n'est proposé que si la personne a
// les deux droits (avec un seul, l'entrée ouvre directement l'outil) ; chaque carte ouvre le menu correspondant.
import React from 'react';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import '../Administrative/AdministrativeHub.css';

const CARDS = [
    {
        key: 'report', icon: 'fa-triangle-exclamation', title: 'Signaler un problème',
        description: "Signaler un défaut ou un danger constaté dans le bâtiment : extincteur, alarme, issue de secours, etc.",
    },
    {
        key: 'manage', icon: 'fa-fire-extinguisher', title: 'Gestion de la sécurité',
        description: 'Registre des contrôles, non-conformités à suivre et exercices d\'évacuation.',
    },
];

// `access` : { report, manage } (booléens) ; `onOpen(key)` ouvre l'outil choisi.
const FireSafetyHub = ({ show, onHide, access, onOpen }) => (
    <BaseModal isOpen={show} onClose={onHide} title="Sécurité incendie" modalSize="large" zIndex={1090} className="dark-ui">
        <p className="text-muted">Choisissez ce que vous voulez faire.</p>
        <div className="admin-hub-grid">
            {CARDS.filter((card) => access?.[card.key]).map((card) => (
                <button key={card.key} type="button" className="admin-hub-card" onClick={() => onOpen(card.key)}>
                    <i className={`fas ${card.icon}`}></i>
                    <strong>{card.title}</strong>
                    <span>{card.description}</span>
                </button>
            ))}
        </div>
    </BaseModal>
);

export default FireSafetyHub;
