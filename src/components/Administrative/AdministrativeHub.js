// src/components/Administrative/AdministrativeHub.js
//
// « Administratif » (Boîte à outils) : un seul point d'entrée pour les trois outils de gestion administrative, au lieu de trois entrées séparées :
//   • Recrutement (admins + recruteurs), • Sanctions : documents disciplinaires (admins, Direction, administratif), • Contrats commerciaux (idem).
// Chaque carte n'apparaît que si la personne a accès à l'outil ; un clic ouvre le menu correspondant.
import React from 'react';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import './AdministrativeHub.css';

const CARDS = [
    {
        key: 'recruitment', icon: 'fa-user-plus', title: 'Recrutement',
        description: 'Postes ouverts, candidatures, entretiens, contrats et avenants du personnel.',
    },
    {
        key: 'discipline', icon: 'fa-gavel', title: 'Sanctions',
        description: 'Convocations à un entretien préalable, notifications de sanction et fins de contrat.',
    },
    {
        key: 'commercial', icon: 'fa-handshake', title: 'Contrats commerciaux',
        description: 'Accords avec des entreprises, fournisseurs, prestataires ou partenaires, en lien avec le Code Civil et le Code Pénal.',
    },
    {
        key: 'exemptions', icon: 'fa-hand-holding-heart', title: 'Exemptions de paiement',
        description: 'Demandes d\'exemption (mineurs, faible revenu), personnes exemptées et retraits motivés.',
    },
];

// `access` : { recruitment, discipline, commercial, exemptions } (booléens) ; `onOpen(key)` ouvre l'outil choisi.
const AdministrativeHub = ({ show, onHide, access, onOpen }) => (
    <BaseModal isOpen={show} onClose={onHide} title="Administratif" modalSize="large" zIndex={1090} className="dark-ui">
        <p className="text-muted">Choisissez l'espace de gestion à ouvrir.</p>
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

export default AdministrativeHub;
