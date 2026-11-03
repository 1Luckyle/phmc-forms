// src/components/ExemptionNote.js
//
// Sous la case « exempté » des dossiers médicaux facturés : dit sur quoi repose l'exemption (drapeau enregistré, patient mineur, ou simple demande
// à traiter) et, pour une demande, laisse choisir le motif. `staffFill` : le formulaire est rempli par un soignant pour un autre patient, qui
// s'engage alors sur l'exemption. Voir hooks/useExemption.js et utils/exemptions.js.
import React from 'react';
import { Form } from 'react-bootstrap';
import { EXEMPTION_INFO } from '../utils/exemptions';

const ExemptionNote = ({ exemption, formData, setFormData, staffFill = false }) => {
    const exempt = formData.isExempt === true || formData.isExempt === 'true';
    if (!exempt) return null;
    const source = formData.exemptSource;

    if (source === 'flag') {
        return <span className="helper-text d-block"><i className="fas fa-circle-check me-1" style={{ color: '#3fb950' }}></i>Une exemption est enregistrée pour ce patient : le service est gratuit.</span>;
    }
    if (source === 'mineur') {
        return <span className="helper-text d-block"><i className="fas fa-child me-1" style={{ color: '#e3b341' }}></i>Patient mineur : exempté de paiement pour ce rapport (aucune exemption n'est inscrite sur son dossier).</span>;
    }
    return (
        <div className="mt-2 p-2 border rounded" style={{ borderColor: '#58a6ff' }}>
            <span className="helper-text d-block mb-2">{EXEMPTION_INFO}</span>
            <span className="helper-text d-block mb-2">
                <i className="fas fa-hourglass-half me-1" style={{ color: '#58a6ff' }}></i>
                {staffFill
                    ? 'Aucune exemption n\'est enregistrée pour ce patient. En enregistrant ce rapport, vous transmettez une demande au personnel administratif et vous vous engagez sur le fait que ce patient peut être exempté. Sa facture s\'affichera « en attente de traitement pour l\'exemption » jusqu\'à la décision.'
                    : 'Votre exemption n\'est pas encore enregistrée. En enregistrant ce rapport, une demande est transmise au personnel administratif ; votre facture s\'affichera « en attente de traitement pour l\'exemption » jusqu\'à la décision.'}
            </span>
            <Form.Group>
                <Form.Label className="mb-1">Motif de l'exemption</Form.Label>
                <Form.Select
                    size="sm" name="exemptMotif" required data-guide="Pourquoi le patient doit être exempté : faible revenu, ou une autre situation."
                    value={formData.exemptMotif || 'faible_revenu'}
                    onChange={(event) => setFormData((prev) => ({ ...prev, exemptMotif: event.target.value }))}
                >
                    <option value="faible_revenu">Faible revenu</option>
                    <option value="autre">Autre situation</option>
                </Form.Select>
            </Form.Group>
        </div>
    );
};

export default ExemptionNote;
