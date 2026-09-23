// src/components/FleecaPaymentPanel.js
//
// Remplace l'ancien flux « allez payer sur Fleeca puis collez une capture
// d'écran comme preuve » par un vrai paiement Fleeca (passerelle marchand v2) :
// un lien de paiement réel est créé côté serveur, ouvert dans un nouvel onglet,
// et son statut (payé / échoué) revient automatiquement via le webhook signé
// (voir createFleecaPayment / fleecaWebhook dans functions/index.js), suivi en
// direct ici via un abonnement à fleecaPayments/{payment_id} dans la Realtime
// Database. Plus besoin d'aller vérifier son livre de compte : la confirmation
// (payeur, montant, date) s'affiche directement dans le formulaire.
import React, { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { ref, onValue, get } from 'firebase/database';
import { database } from '../firebase';
import { createFleecaPayment, checkFleecaPaymentStatus } from '../utils/fleecaPayment';

const FleecaPaymentPanel = ({ amount, description, paymentId, onPaymentIdChange, onPaymentConfirmed }) => {
    const [payment, setPayment] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!paymentId) {
            setPayment(null);
            return;
        }
        const paymentRef = ref(database, `fleecaPayments/${paymentId}`);
        const unsubscribe = onValue(paymentRef, (snapshot) => {
            setPayment(snapshot.val());
        });
        return () => unsubscribe();
    }, [paymentId]);

    // Un paymentId peut arriver depuis les données partagées du formulaire
    // (formData) plutôt que d'avoir été créé par CE panneau — typiquement en
    // passant d'un document à un autre sans vider le formulaire. Dans ce cas,
    // un paiement confirmé pour un AUTRE document (montant/description
    // différents) ne doit surtout pas s'afficher comme preuve valide ici : on
    // vérifie une seule fois par paymentId (pas à chaque mise à jour du statut,
    // pour ne pas invalider un paiement légitime si l'utilisateur modifie le
    // formulaire pendant que le paiement est en attente) que le montant et la
    // description enregistrés correspondent bien à ce formulaire.
    useEffect(() => {
        if (!paymentId) return;
        let cancelled = false;
        get(ref(database, `fleecaPayments/${paymentId}`)).then((snapshot) => {
            if (cancelled) return;
            const data = snapshot.val();
            if (!data) return;
            const amountMatches = Number(data.amount) === Number(amount);
            const descriptionMatches = (data.description || '') === (description || '');
            if (!amountMatches || !descriptionMatches) {
                onPaymentIdChange(null);
            }
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentId]);

    useEffect(() => {
        if (payment && payment.status === 'payment_successful') {
            onPaymentConfirmed({
                paymentLink: payment.paymentLink,
                payerName: payment.payerName || null,
                amount: payment.amount,
                paidAt: payment.paidAt || null,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payment?.status]);

    const handleCreatePayment = async () => {
        setIsCreating(true);
        setError('');
        try {
            const { payment_id, payment_link } = await createFleecaPayment({ amount, description });
            onPaymentIdChange(payment_id);
            window.open(payment_link, '_blank', 'noopener,noreferrer');
        } catch (err) {
            console.error('Failed to create Fleeca payment:', err);
            setError(err.message || 'Impossible de créer le lien de paiement.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleCheckStatus = async () => {
        if (!paymentId) return;
        setIsChecking(true);
        setError('');
        try {
            // Met aussi à jour fleecaPayments/{id} côté serveur : l'affichage se
            // rafraîchit via l'abonnement RTDB ci-dessus, pas besoin de gérer le
            // résultat ici.
            await checkFleecaPaymentStatus(paymentId);
        } catch (err) {
            console.error('Failed to check Fleeca payment status:', err);
            setError(err.message || 'Impossible de vérifier le statut du paiement.');
        } finally {
            setIsChecking(false);
        }
    };

    const handleRetry = () => {
        onPaymentIdChange(null);
        setPayment(null);
        setError('');
    };

    if (payment && payment.status === 'payment_successful') {
        return (
            <div style={{ marginTop: '10px', padding: '10px 12px', backgroundColor: 'rgba(40, 167, 69, 0.12)', border: '1px solid rgba(40, 167, 69, 0.4)', borderRadius: '6px', color: '#28a745', fontSize: '0.9em' }}>
                <i className="fas fa-check-circle" style={{ marginRight: '6px' }}></i>
                Paiement confirmé{payment.payerName ? ` par ${payment.payerName}` : ''} — ${Number(payment.amount).toLocaleString()}
                {payment.paidAt && ` (${new Date(payment.paidAt).toLocaleString('fr-FR')})`}.
                {' '}
                {payment.paymentLink && (
                    <a href={payment.paymentLink} target="_blank" rel="noopener noreferrer" style={{ color: '#28a745', textDecoration: 'underline' }}>
                        Voir le paiement sur Fleeca
                    </a>
                )}
            </div>
        );
    }

    if (payment && payment.status === 'payment_failed') {
        return (
            <div style={{ marginTop: '10px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: 'rgba(220, 53, 69, 0.12)', border: '1px solid rgba(220, 53, 69, 0.4)', borderRadius: '6px', color: '#dc3545', marginBottom: '10px', fontSize: '0.9em' }}>
                    <i className="fas fa-times-circle" style={{ marginRight: '6px' }}></i>
                    Le paiement a échoué{payment.statusReason ? ` : ${payment.statusReason}` : '.'}
                </div>
                <Button variant="outline-danger" size="sm" onClick={handleRetry}>Réessayer</Button>
            </div>
        );
    }

    if (paymentId) {
        return (
            <div style={{ marginTop: '10px' }}>
                <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255, 193, 7, 0.12)', border: '1px solid rgba(255, 193, 7, 0.4)', borderRadius: '6px', color: '#ffc107', marginBottom: '10px', fontSize: '0.9em' }}>
                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                    En attente du paiement...
                    {payment?.paymentLink && (
                        <>
                            {' '}
                            <a href={payment.paymentLink} target="_blank" rel="noopener noreferrer" style={{ color: '#ffc107', textDecoration: 'underline' }}>
                                Ouvrir le lien de paiement
                            </a>
                        </>
                    )}
                </div>
                <Button variant="outline-secondary" size="sm" onClick={handleCheckStatus} disabled={isChecking}>
                    {isChecking ? 'Vérification...' : 'Vérifier le statut'}
                </Button>
                {error && <div style={{ color: '#dc3545', marginTop: '8px', fontSize: '0.85em' }}>{error}</div>}
            </div>
        );
    }

    return (
        <div style={{ marginTop: '10px' }}>
            <Button variant="success" onClick={handleCreatePayment} disabled={isCreating || !amount}>
                {isCreating ? (
                    <><i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>Création du lien...</>
                ) : (
                    <><i className="fas fa-money-check-alt" style={{ marginRight: '6px' }}></i>Créer le lien de paiement Fleeca</>
                )}
            </Button>
            {error && <div style={{ color: '#dc3545', marginTop: '8px', fontSize: '0.85em' }}>{error}</div>}
        </div>
    );
};

export default FleecaPaymentPanel;
