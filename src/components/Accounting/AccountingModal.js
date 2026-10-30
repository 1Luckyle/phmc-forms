// src/components/Accounting/AccountingModal.js
//
// Outil « Comptabilité » de la Boîte à outils : deux rubriques, « Tarifs des formulaires » et « Transparence » (page publique : direction, grille des
// rémunérations, comptes trimestriels). On choisit une rubrique puis on la modifie ici même. Réservé aux admins, à la Directrice et à l'Assistante de
// Direction (voir utils/accountingAccess.js et database.rules.json : l'écriture est refusée aux autres, quoi qu'affiche le menu).
import React, { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import '../Admin/AdminDashboard.css';
import './Accounting.css';
import PricingManager from '../Admin/PricingManager';
import TransparencyManager from '../Admin/TransparencyManager';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { useAccountingAccess } from '../../utils/accountingAccess';
import { logAdminAction } from '../../utils/activityLog';

const SECTIONS = [
    {
        key: 'pricing', icon: 'fa-coins', label: 'Tarifs des formulaires', log: 'Tarifs',
        description: "Les montants demandés aux patients et aux demandeurs : dossiers médicaux, divulgation, frais d'autopsie…",
    },
    {
        key: 'transparency', icon: 'fa-scale-balanced', label: 'Transparence', log: 'Transparence',
        description: 'La page publique de l\'établissement : direction, grille des rémunérations, comptes trimestriels du PHMC et de ses pharmacies.',
    },
];

const AccountingModal = ({ show, onHide, showNotification }) => {
    const { currentEmployee, staffName, isAdmin } = useEmployeeAuth();
    const allowed = useAccountingAccess(isAdmin);
    const [section, setSection] = useState(null);

    useEffect(() => { if (show) setSection(null); }, [show]);

    const current = SECTIONS.find((entry) => entry.key === section) || null;
    const actorName = staffName || currentEmployee?.email || '';
    const log = (categoryName) => (action, details) => logAdminAction({ email: currentEmployee?.email, action, details, categoryName, actorLabel: 'Comptabilité' });

    return (
        <BaseModal isOpen={show} onClose={onHide} title={current ? `Comptabilité — ${current.label}` : 'Comptabilité'} modalSize="xl" zIndex={1100} className="dark-ui">
            {!allowed ? (
                <Alert variant="warning" className="mb-0">La Comptabilité est réservée aux administrateurs, à la Directrice et à l'Assistante de Direction.</Alert>
            ) : !current ? (
                <>
                    <p className="text-muted">Choisissez ce que vous voulez consulter ou modifier.</p>
                    <div className="acc-choices">
                        {SECTIONS.map((entry) => (
                            <button type="button" key={entry.key} className="acc-choice" onClick={() => setSection(entry.key)}>
                                <i className={`fas ${entry.icon}`} aria-hidden="true"></i>
                                <strong>{entry.label}</strong>
                                <span>{entry.description}</span>
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                // Les écrans de tarifs et de transparence sont ceux du panneau admin : on garde leur habillage (classe du panneau, mise en page à plat).
                <div className="acc-body admin-dashboard-container">
                    <div className="acc-content">
                        <Button size="sm" variant="outline-secondary" className="mb-3" onClick={() => setSection(null)}><i className="fas fa-arrow-left me-2"></i>Comptabilité</Button>
                        {current.key === 'pricing' && <PricingManager showNotification={showNotification} onLogAction={log(current.log)} />}
                        {current.key === 'transparency' && <TransparencyManager showNotification={showNotification} adminName={actorName} onLogAction={log(current.log)} />}
                    </div>
                </div>
            )}
        </BaseModal>
    );
};

export default AccountingModal;
