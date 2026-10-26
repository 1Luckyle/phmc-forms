// src/components/FleecaPaymentSuccess.js
//
// URL de redirection Fleeca (voir Merchant Center) : le navigateur du payeur
// atterrit ici après avoir payé, dans le nouvel onglet ouvert par
// FleecaPaymentPanel. Le formulaire d'origine (dans l'autre onglet) suit déjà
// le statut du paiement en direct via fleecaPayments/{payment_id} ; cette page
// n'a besoin d'informer que le payeur lui-même, qui peut ensuite fermer cet
// onglet et revenir au formulaire.
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { checkFleecaPaymentStatus } from '../utils/fleecaPayment';

const FleecaPaymentSuccess = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [payment, setPayment] = useState(null);
    const [error, setError] = useState('');

    // Le statut est lu via la Cloud Function getFleecaPaymentStatus (par payment_id), plus par une lecture
    // directe de fleecaPayments (nœud fermé au public) : cette page fonctionne donc même si le payeur n'est
    // pas connecté (lien ouvert depuis l'e-mail, autre appareil). On interroge jusqu'à un statut final, avec
    // un plafond de tentatives.
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const id = params.get('payment_id');
        if (!id) {
            setError('Aucun identifiant de paiement reçu.');
            return undefined;
        }

        let cancelled = false;
        let timer;
        let attempts = 0;
        const MAX_ATTEMPTS = 40; // ~2 min à 3 s d'intervalle
        const isFinal = (status) => status === 'payment_successful' || status === 'payment_failed';

        const poll = async () => {
            attempts += 1;
            try {
                const result = await checkFleecaPaymentStatus(id);
                if (cancelled) return;
                setPayment(result);
                if (!isFinal(result?.status) && attempts < MAX_ATTEMPTS) {
                    timer = setTimeout(poll, 3000);
                }
            } catch (err) {
                if (cancelled) return;
                console.warn('Fleeca status check failed:', err);
                if (attempts < MAX_ATTEMPTS) timer = setTimeout(poll, 5000);
            }
        };
        poll();

        return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }, [location.search]);

    const containerStyle = {
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    };
    const cardStyle = {
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '10px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        color: '#c9d1d9',
        textAlign: 'center',
    };

    let content;
    if (error) {
        content = (
            <>
                <i className="fas fa-times-circle" style={{ fontSize: '2.5rem', color: '#dc3545', marginBottom: '15px' }}></i>
                <h4>Erreur</h4>
                <p style={{ color: '#8b949e' }}>{error}</p>
            </>
        );
    } else if (!payment || payment.status === 'awaiting_payment' || payment.status === 'pending') {
        content = (
            <>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '2.5rem', color: '#4a9eff', marginBottom: '15px' }}></i>
                <h4>Traitement du paiement...</h4>
                <p style={{ color: '#8b949e' }}>Merci de patienter quelques instants.</p>
            </>
        );
    } else if (payment.status === 'payment_successful') {
        content = (
            <>
                <i className="fas fa-check-circle" style={{ fontSize: '2.5rem', color: '#28a745', marginBottom: '15px' }}></i>
                <h4>Paiement confirmé !</h4>
                <p style={{ color: '#8b949e' }}>
                    {payment.payerName && <>Payé par <strong style={{ color: '#c9d1d9' }}>{payment.payerName}</strong>{payment.amount != null ? ' — ' : ''}</>}
                    {payment.amount != null && <>${Number(payment.amount).toLocaleString()}</>}
                </p>
                <p style={{ color: '#8b949e', fontSize: '0.9em' }}>
                    Vous pouvez fermer cet onglet et retourner à votre formulaire.
                </p>
            </>
        );
    } else {
        content = (
            <>
                <i className="fas fa-times-circle" style={{ fontSize: '2.5rem', color: '#dc3545', marginBottom: '15px' }}></i>
                <h4>Le paiement a échoué</h4>
                <p style={{ color: '#8b949e' }}>Retournez à votre formulaire pour réessayer.</p>
            </>
        );
    }

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                {content}
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    style={{ marginTop: '20px', padding: '8px 16px', backgroundColor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer' }}
                >
                    Retour à l'accueil
                </button>
            </div>
        </div>
    );
};

export default FleecaPaymentSuccess;
