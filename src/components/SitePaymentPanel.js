// src/components/SitePaymentPanel.js
//
// Bloc de paiement des formulaires facturés, selon la VERSION du site (constants/siteMode.js) :
//   • version GTA World : le panneau Fleeca d'origine (FleecaPaymentPanel), inchangé ;
//   • version classique : pas de paiement en ligne. Le patient règle EN JEU auprès du personnel :
//       – le patient qui remplit lui-même : une facture « à payer » est créée à l'enregistrement, le personnel la marquera payée ;
//       – le personnel qui remplit pour un patient (staff) : case « Réglé sur place » → la facture est marquée payée à l'enregistrement, encaissée par lui
//         (useReportManagement → settleInvoices).
// formData.paiementEnJeu suit la version : le BBCode (staffPaymentLine, courriel du DMEC) écrit alors « à régler en jeu » au lieu de « via Fleeca ».
import React, { useEffect } from 'react';
import { Form } from 'react-bootstrap';
import FleecaPaymentPanel from './FleecaPaymentPanel';
import { useSiteMode } from '../contexts/SiteConfigContext';
import { formatMoney } from '../utils/patientBilling';

const SitePaymentPanel = ({ staff = false, formData = {}, setFormData, amount, ...fleecaProps }) => {
    const { isClassic } = useSiteMode();

    useEffect(() => {
        if (!setFormData) return;
        setFormData((prev) => {
            const next = { ...prev };
            let changed = false;
            if ((prev.paiementEnJeu === true) !== isClassic) { next.paiementEnJeu = isClassic; changed = true; }
            if (!isClassic && prev.regleSurPlace) { next.regleSurPlace = false; changed = true; }
            return changed ? next : prev;
        });
    }, [isClassic, setFormData]);

    if (!isClassic) return <FleecaPaymentPanel amount={amount} {...fleecaProps} />;

    if (staff) {
        return (
            <Form.Group className="mb-2" style={{ marginTop: '10px' }}>
                <Form.Check
                    type="checkbox"
                    id="regleSurPlace"
                    label={` Réglé sur place : le patient a payé ${formatMoney(amount)} en jeu`}
                    checked={formData.regleSurPlace === true}
                    onChange={(event) => setFormData((prev) => ({ ...prev, regleSurPlace: event.target.checked }))}
                />
                <span className="helper-text">
                    {formData.regleSurPlace === true
                        ? 'La facture sera marquée payée à l\'enregistrement, encaissée par vous.'
                        : 'Sinon, une facture « à payer » est créée : le patient la règle plus tard en jeu, et un membre du personnel la marque payée depuis son dossier.'}
                </span>
            </Form.Group>
        );
    }

    return (
        <div style={{ marginTop: '10px', padding: '10px 12px', border: '1px solid #30363d', borderRadius: 6, background: '#101923', fontSize: '0.9em' }}>
            <i className="fas fa-hand-holding-dollar me-2"></i>
            Le paiement de <strong>{formatMoney(amount)}</strong> se fait <strong>en jeu</strong>, auprès du personnel du PHMC. Une facture « à payer » est créée à l'enregistrement :
            vous la retrouvez dans votre dossier patient, et le personnel la marque comme payée une fois réglée.
        </div>
    );
};

export default SitePaymentPanel;
