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
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';
import { checkFleecaPaymentStatus } from '../utils/fleecaPayment';

const FleecaPaymentSuccess = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [paymentId, setPaymentId] = useState(null);
    const [payment, setPayment] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const id = params.get('payment_id');
        if (!id) {
            setError('Aucun identifiant de paiement reçu.');
            return;
        }
        setPaymentId(id);
        // Réconciliation immédiate : ne pas attendre le webhook pour afficher un
        // statut à jour (les callbacks peuvent échouer, voir doc Fleeca).
        checkFleecaPaymentStatus(id).catch((err) => console.warn('Fleeca status reconciliation failed:', err));
    }, [location.search]);

    useEffect(() => {
        if (!paymentId) return;
        const paymentRef = ref(database, `fleecaPayments/${paymentId}`);
        const unsubscribe = onValue(paymentRef, (snapshot) => setPayment(snapshot.val()));
        return () => unsubscribe();
    }, [paymentId]);

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
                    {payment.payerName && <>Payé par <strong style={{ color: '#c9d1d9' }}>{payment.payerName}</strong> — </>}
                    ${Number(payment.amount).toLocaleString()}
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
