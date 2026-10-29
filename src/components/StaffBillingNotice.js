// src/components/StaffBillingNotice.js
//
// Bloc « Paiement » des formulaires médicaux civils quand c'est le PERSONNEL qui remplit pour un AUTRE patient : même logique
// que pour un Civil — le paiement direct est demandé (lien Fleeca créé ici, à remettre ou faire ouvrir au patient). S'il n'est pas
// réglé à l'enregistrement, une facture est créée au nom du patient (voir utils/patientInvoices.js) : il en est notifié à sa
// connexion, relancé par mail, et la paie depuis son dossier patient.
import React from 'react';
import { Form } from 'react-bootstrap';
import FleecaPaymentPanel from './FleecaPaymentPanel';
import { computeBilling, EXEMPTABLE_VERSIONS, formatMoney } from '../utils/patientBilling';

const StaffBillingNotice = ({ bbCodeVersion, formData, setFormData, description }) => {
    const { baseAmount, exempt, amount } = computeBilling(bbCodeVersion, formData);
    const canExempt = EXEMPTABLE_VERSIONS.includes(Number(bbCodeVersion));

    if (baseAmount <= 0) return null;

    const setExempt = (checked) => {
        setFormData((prev) => ({
            ...prev,
            isExempt: checked,
            payNow: false,
            ...(checked ? { fleecaPaymentId: null, paymentProofPhotos: '' } : {}),
        }));
    };

    return (
        <div style={{ marginTop: '5px' }}>
            {exempt ? (
                <Form.Label style={{ color: '#8b949e', fontWeight: 'bold' }}>
                    Patient exempté — aucun paiement à demander ({formatMoney(baseAmount)} non facturés).
                </Form.Label>
            ) : (
                <Form.Label style={{ color: '#28a745', fontWeight: 'bold' }}>
                    Montant à payer par le patient : {formatMoney(amount)}
                </Form.Label>
            )}
            <span className="helper-text">
                {exempt
                    ? 'Aucune facture à payer ne sera créée pour ce rapport.'
                    : "Demandez au patient de payer maintenant via Fleeca (lien ci-dessous). S'il n'a pas payé à l'enregistrement, une facture est créée à son nom : il en est notifié à sa connexion, relancé par mail, et la règle depuis son dossier patient. Son état (à payer / payé) est visible dans les rapports."}
            </span>

            {canExempt && (
                <Form.Group className="mb-2" style={{ marginTop: '10px' }}>
                    <Form.Check
                        type="checkbox"
                        id={`staffExempt-${bbCodeVersion}`}
                        label=" Patient exempté de paiement (mineur ou faible revenu)"
                        checked={exempt}
                        onChange={(e) => setExempt(e.target.checked)}
                    />
                </Form.Group>
            )}

            {!exempt && (
                <FleecaPaymentPanel
                    amount={amount}
                    description={description}
                    paymentId={formData.fleecaPaymentId}
                    openOnCreate={false}
                    onPaymentIdChange={(id) => setFormData((prev) => ({ ...prev, fleecaPaymentId: id, ...(id ? {} : { paymentProofPhotos: '' }) }))}
                    onPaymentConfirmed={({ paymentLink }) => setFormData((prev) => ({ ...prev, paymentProofPhotos: paymentLink }))}
                />
            )}
        </div>
    );
};

export default StaffBillingNotice;
