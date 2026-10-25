import { getPrice } from './pricing';
// src/utils/patientBilling.js
//
// Facturation des formulaires médicaux civils (module pur, sans Firebase) : montant dû, état d'une
// facture et libellés. Utilisé par les formulaires (affichage du montant au personnel), par la
// sauvegarde des rapports (création de la facture) et par les écrans patient / médecin.
//
//   Formulaires facturés : Dossier patient avancé (3), Dossier patient de base (25), Divulgation de dossier médical (24,
//   par élément demandé), Mise à jour du dossier (26). Les montants se règlent dans le panneau admin → Tarifs (utils/pricing.js).
//
//   Une facture vit sous facturesPatients/{ID patient}/{clé du rapport} avec un statut stocké :
//     'a_payer' | 'paye' | 'sans_paiement'
//   « paye » n'est écrit que par le serveur (webhook Fleeca) ; un paiement Fleeca confirmé depuis le
//   formulaire (fleecaPaymentId) est reconnu côté lecture par `effectiveInvoiceStatus`.

export const BILLABLE_VERSIONS = [3, 24, 25, 26];

// Les formulaires qui proposent une exemption (mineur / faible revenu) : le personnel peut la cocher.
export const EXEMPTABLE_VERSIONS = [3, 25];

export const INVOICE_STATUS = {
    A_PAYER: 'a_payer',
    PAYE: 'paye',
    SANS_PAIEMENT: 'sans_paiement',
};

export const INVOICE_STATUS_LABELS = {
    a_payer: 'À payer',
    paye: 'Payé',
    sans_paiement: 'Sans paiement',
};

export const INVOICE_STATUS_COLORS = {
    a_payer: '#d29922',
    paye: '#3fb950',
    sans_paiement: '#8b949e',
};

const isTrue = (value) => value === true || value === 'true';

export const isBillableVersion = (bbCodeVersion) => BILLABLE_VERSIONS.includes(Number(bbCodeVersion));

// Montant « plein » (hors exemption) du formulaire.
const baseAmountOf = (bbCodeVersion, formData) => {
    switch (Number(bbCodeVersion)) {
        case 3: return getPrice('dossierAvance');
        case 25: return getPrice('dossierBase');
        case 24: return (formData?.MedicalRecordsRelease?.length || 0) * getPrice('divulgationParElement');
        case 26: return formData?.UpdateMedicalFile?.length > 0 ? getPrice('miseAJourDossier') : 0;
        default: return 0;
    }
};

// { baseAmount, exempt, amount } : `amount` est ce que le patient doit réellement (0 si exempté).
export const computeBilling = (bbCodeVersion, formData = {}) => {
    const baseAmount = baseAmountOf(bbCodeVersion, formData);
    const exempt = EXEMPTABLE_VERSIONS.includes(Number(bbCodeVersion)) && isTrue(formData.isExempt);
    return { baseAmount, exempt, amount: exempt ? 0 : baseAmount };
};

export const formatMoney = (amount) => `${Number(amount || 0).toLocaleString('fr-FR')} $`;

// Ligne de paiement du BBCode d'un formulaire rempli par le personnel (à la place de l'ancien
// « le paiement ne se fait pas via cet outil »).
export const staffPaymentLine = (bbCodeVersion, formData = {}) => {
    const { baseAmount, exempt, amount } = computeBilling(bbCodeVersion, formData);
    if (exempt) return 'Rempli par le personnel PHMC — patient exempté de paiement.';
    if (baseAmount <= 0) return 'Rempli par le personnel PHMC — aucun paiement à régler.';
    return `Rempli par le personnel PHMC — montant à régler par le patient : ${formatMoney(amount)} (paiement via Fleeca, depuis son dossier patient).`;
};

// Statut tel qu'il doit être AFFICHÉ : un paiement Fleeca confirmé (lien créé depuis le formulaire,
// avec un montant suffisant) vaut « payé » même si le webhook n'a pas encore marqué la facture.
// `payment` = fleecaPayments/{invoice.paiementId || invoice.fleecaPaymentId} (ou null).
export const effectiveInvoiceStatus = (invoice, payment) => {
    if (!invoice) return INVOICE_STATUS.SANS_PAIEMENT;
    if (invoice.statut === INVOICE_STATUS.PAYE || invoice.statut === INVOICE_STATUS.SANS_PAIEMENT) return invoice.statut;
    if (payment && payment.status === 'payment_successful' && Number(payment.amount) >= Number(invoice.montant || 0)) {
        return INVOICE_STATUS.PAYE;
    }
    return INVOICE_STATUS.A_PAYER;
};

export const invoiceStatusLabel = (status) => INVOICE_STATUS_LABELS[status] || status || '—';

// Total à payer d'une liste de factures déjà résolues ({ ...facture, statutEffectif }).
export const totalDue = (invoices) => invoices
    .filter((invoice) => invoice.statutEffectif === INVOICE_STATUS.A_PAYER)
    .reduce((sum, invoice) => sum + Number(invoice.montant || 0), 0);
