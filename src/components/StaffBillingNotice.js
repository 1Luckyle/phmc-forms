// src/components/StaffBillingNotice.js
//
// Bloc « Paiement » des formulaires médicaux civils quand c'est le PERSONNEL qui remplit : le montant
// dû par le patient est affiché, et le personnel peut préparer un lien de paiement Fleeca à lui remettre.
// À la sauvegarde, une facture est créée au nom du patient (voir utils/patientInvoices.js) : il en est
// notifié à sa connexion et par mail, et la paie depuis son dossier patient.
import React, { useState } from 'react';
import { Form } from 'react-bootstrap';
import FleecaPaymentPanel from './FleecaPaymentPanel';
import { computeBilling, EXEMPTABLE_VERSIONS, formatMoney } from '../utils/patientBilling';

const StaffBillingNotice = ({ bbCodeVersion, formData, setFormData, description }) => {
    const { baseAmount, exempt, amount } = computeBilling(bbCodeVersion, formData);
    const canExempt = EXEMPTABLE_VERSIONS.includes(Number(bbCodeVersion));
    const [wantsLink, setWantsLink] = useState(!!formData.fleecaPaymentId);

    if (baseAmount <= 0) return null;

    const setExempt = (checked) => {
        if (checked) setWantsLink(false);
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
                    : 'Rempli par le personnel PHMC : une facture est créée au nom du patient à la sauvegarde. Il sera notifié à sa connexion (et par mail) et pourra la régler via Fleeca depuis son dossier patient ; son état (à payer / payé) est visible dans les rapports.'}
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
                <Form.Group className="mb-2" style={{ marginTop: '10px' }}>
                    <Form.Check
                        type="checkbox"
                        id={`staffPayLink-${bbCodeVersion}`}
                        label=" Préparer un lien de paiement Fleeca à remettre au patient"
                        checked={wantsLink || !!formData.fleecaPaymentId}
                        onChange={(e) => {
                            setWantsLink(e.target.checked);
                            if (!e.target.checked) {
                                setFormData((prev) => ({ ...prev, fleecaPaymentId: null, paymentProofPhotos: '' }));
                            }
                        }}
                    />
                    <span className="helper-text">
                        Facultatif : le patient pourra de toute façon payer plus tard depuis son dossier patient.
                    </span>
                </Form.Group>
            )}

            {!exempt && (wantsLink || formData.fleecaPaymentId) && (
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
