// src/components/PatientInvoiceNotifier.js
//
// Notification de paiement à la connexion : tant que la personne connectée (civil, ou membre du personnel
// en tant que patient) a des factures « à payer », une fenêtre les liste avec le total et permet de payer
// chaque rapport ou tout d'un coup. Elle réapparaît à chaque rechargement de la page (la fermeture ne vaut
// que pour la session de la page) et dès qu'une nouvelle facture arrive.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import PatientInvoicesPanel from './PatientInvoicesPanel';
import { INVOICE_STATUS, formatMoney, totalDue } from '../utils/patientBilling';

const overlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1100,
};
const contentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px', borderRadius: '6px',
    width: '95%', maxWidth: '760px', maxHeight: '85vh', overflowY: 'auto',
    position: 'relative', border: '1px solid #d29922',
};
const closeStyle = {
    position: 'absolute', top: '10px', right: '14px', background: 'transparent', border: 'none',
    color: '#f85149', fontSize: '28px', lineHeight: 1, cursor: 'pointer',
};

const PatientInvoiceNotifier = ({ showNotification }) => {
    const { myPatientID, currentEmployee, viewAs } = useEmployeeAuth();
    const [dueCount, setDueCount] = useState(0);
    const [total, setTotal] = useState(0);
    const [dismissedAt, setDismissedAt] = useState(null); // nombre de factures dues au moment de la fermeture
    const lastPatientRef = useRef(null);

    // Nouvelle identité (connexion / déconnexion / simulation) : on repart de zéro.
    useEffect(() => {
        if (lastPatientRef.current !== myPatientID) {
            lastPatientRef.current = myPatientID;
            setDueCount(0);
            setTotal(0);
            setDismissedAt(null);
        }
    }, [myPatientID]);

    const handleInvoices = useCallback((invoices) => {
        const due = invoices.filter((invoice) => invoice.statutEffectif === INVOICE_STATUS.A_PAYER);
        setDueCount(due.length);
        setTotal(totalDue(invoices));
    }, []);

    // Pas de notification en mode « visualiser en tant que » : un admin ne doit pas payer à la place de quelqu'un.
    const active = !!myPatientID && !!currentEmployee && !viewAs;
    const isOpen = active && dueCount > 0 && (dismissedAt === null || dueCount > dismissedAt);

    // Le panneau reste monté (abonnement actif) même fenêtre fermée, pour réagir à une nouvelle facture.
    return (
        <>
            {active && (
                <div style={{ display: 'none' }}>
                    <PatientInvoicesPanel patientID={myPatientID} showNotification={showNotification} onInvoices={handleInvoices} />
                </div>
            )}
            {isOpen && ReactDOM.createPortal(
                <div style={overlayStyle}>
                    <div style={contentStyle} role="dialog" aria-label="Paiements en attente">
                        <button onClick={() => setDismissedAt(dueCount)} style={closeStyle} aria-label="Fermer">&times;</button>
                        <h5 style={{ color: '#d29922' }}>
                            <i className="fas fa-file-invoice-dollar" style={{ marginRight: '8px' }}></i>
                            Vous avez {dueCount} paiement{dueCount > 1 ? 's' : ''} en attente
                        </h5>
                        <p style={{ color: '#8b949e', fontSize: '0.9em' }}>
                            Des rapports médicaux établis à votre nom sont à régler ({formatMoney(total)} au total). Vous pouvez payer
                            chaque rapport séparément ou tout régler d'un coup via Fleeca. Ce rappel réapparaît à chaque connexion tant
                            que ce n'est pas payé ; vous retrouverez aussi vos factures dans votre dossier patient.
                        </p>
                        <PatientInvoicesPanel patientID={myPatientID} showNotification={showNotification} showPaidHistory={false} />
                        <div style={{ textAlign: 'right', marginTop: '14px' }}>
                            <button
                                onClick={() => setDismissedAt(dueCount)}
                                style={{ background: 'transparent', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: '4px', padding: '4px 12px' }}
                            >
                                Plus tard
                            </button>
                        </div>
                    </div>
                </div>,
                document.getElementById('modal-root') || document.body
            )}
        </>
    );
};

export default PatientInvoiceNotifier;
