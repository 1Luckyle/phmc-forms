// src/utils/fleecaPayment.js
//
// Aide client pour la passerelle de paiement marchand Fleeca (v2). La clé API
// Fleeca reste côté serveur (Secret Manager) : le navigateur ne parle qu'à nos
// Cloud Functions, jamais directement à fleeca.gta.world.
const CREATE_PAYMENT_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/createFleecaPayment';
const GET_STATUS_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/getFleecaPaymentStatus';

// Crée un lien de paiement Fleeca pour le montant (en dollars, entier) donné.
// Retourne { payment_id, payment_link }.
export const createFleecaPayment = async ({ amount, description }) => {
    const response = await fetch(CREATE_PAYMENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description }),
    });

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        throw new Error(`Réponse invalide du serveur de paiement. Reçue : ${text.substring(0, 200)}`);
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Échec de la création du paiement.');
    }

    return data;
};

// Interroge directement Fleeca pour le statut d'un paiement (repli manuel si
// le webhook n'est pas encore arrivé). Retourne { status, payerName, paidAt }.
export const checkFleecaPaymentStatus = async (paymentId) => {
    const response = await fetch(GET_STATUS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId }),
    });

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        throw new Error(`Réponse invalide du serveur de paiement. Reçue : ${text.substring(0, 200)}`);
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Échec de la vérification du paiement.');
    }

    return data;
};
