import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import * as Sentry from "@sentry/react";

// --- MODIFICATION START: Generic Modal Styles ---
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1055, // High z-index
};
const modalContentStyle = {
    position: 'relative', backgroundColor: '#161b22', color: '#c9d1d9',
    padding: '25px 30px', borderRadius: '10px', boxShadow: '0 7px 20px rgba(0,0,0,0.5)',
    width: '90%', maxWidth: '800px', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', border: '1px solid #30363d',
};
const modalHeaderStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid #30363d', paddingBottom: '15px', marginBottom: '20px',
};
const modalTitleStyle = { margin: 0, fontSize: '1.4rem', fontWeight: '500' };
const modalBodyStyle = { overflowY: 'auto', flexGrow: 1 };
const modalFooterStyle = {
    display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #30363d',
    paddingTop: '20px', marginTop: '25px',
};
const closeButtonStyle = {
    background: 'none', border: 'none', color: '#aaa', textDecoration: 'none',
    fontSize: '1.5rem', padding: '0 .5rem', lineHeight: 1, cursor: 'pointer',
};
// --- MODIFICATION END ---

const CctvRequestWebhookModal = ({ show, onHide, onSubmit, showNotification }) => {
    const [rank, setRank] = useState('');
    const [officer, setOfficer] = useState('');
    const [officerPH, setOfficerPH] = useState('');
    const [department, setDepartment] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [discordUsername, setDiscordUsername] = useState('');
    const [oocNotes, setOocNotes] = useState('');
    const [incidentDateTime, setIncidentDateTime] = useState('');
    const [requestReason, setRequestReason] = useState('');

    useEffect(() => {
        if (!show) {
            setRank('');
            setOfficer('');
            setOfficerPH('');
            setDepartment('');
            setLocation('');
            setDescription('');
            setIsSubmitting(false);
            setDiscordUsername('');
            setIncidentDateTime('');
            setRequestReason('');
            setOocNotes('');
        }
    }, [show]);

    const handleSubmit = async () => {
        if (!officer.trim() || !department.trim() || !location.trim() || !description.trim() || !incidentDateTime.trim() || !requestReason.trim()) {
            showNotification('Veuillez remplir tous les champs obligatoires.', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await onSubmit({
                rank, officer, officerPH, department, location, description,
                discordUsername, oocNotes, incidentDateTime, requestReason,
            });

            if (success) {
                onHide();
            }
        } catch (error) {
            console.error("Error submitting CCTV webhook:", error);
            Sentry.captureException(error, { extra: { context: 'CctvRequestWebhookModal Submit' } });
            showNotification('Une erreur s\'est produite lors de la soumission.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!show) return null;

    // --- MODIFICATION START: Use a portal for the modal ---
    const modalContent = (
        <div style={modalOverlayStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>Demande de vidéosurveillance</h5>
                    <button onClick={onHide} style={closeButtonStyle} aria-label="Fermer la fenêtre">&times;</button>
                </div>
                <div style={modalBodyStyle}>
                    <p className="flex-fill">Ce formulaire est envoyé directement aux superviseurs du PHMC pour demander des images de vidéosurveillance. Il sera traité dans les 24 heures suivantes et vous serez contacté par téléphone portable ou par le département. (( L'abus de ce formulaire sera signalé à la direction des factions légales ))</p>
                    <Form>
                        {/* --- MODIFICATION START: Reorganized form layout --- */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Grade de l'agent demandeur</Form.Label>
                                <Form.Control type="text" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="Grade de l'agent" disabled={isSubmitting} />
                            </Form.Group>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Agent demandeur *</Form.Label>
                                <Form.Control type="text" value={officer} onChange={(e) => setOfficer(e.target.value)} placeholder="Matricule, Prénom & Nom" required disabled={isSubmitting} />
                            </Form.Group>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Numéro de téléphone de l'agent</Form.Label>
                                <Form.Control type="text" value={officerPH} onChange={(e) => setOfficerPH(e.target.value)} placeholder="(Optionnel)" disabled={isSubmitting} />
                            </Form.Group>
                        </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Département demandeur *</Form.Label>
                                <Form.Control type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="ex. LSPD, LSSD" required disabled={isSubmitting} />
                            </Form.Group>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Nom d'utilisateur Discord</Form.Label>
                                <Form.Control type="text" value={discordUsername} onChange={(e) => setDiscordUsername(e.target.value)} disabled={isSubmitting} />
                            </Form.Group>
                        </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Date et heure de l'incident *</Form.Label>
                                <Form.Control type="text" value={incidentDateTime} onChange={(e) => setIncidentDateTime(e.target.value)} placeholder="jj/mm/aaaa vers xx:xx" required disabled={isSubmitting} />
                            </Form.Group>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Raison de la demande *</Form.Label>
                                <Form.Select value={requestReason} onChange={(e) => setRequestReason(e.target.value)} required disabled={isSubmitting}>
                                    <option value="">Sélectionnez une raison...</option>
                                    <option value="Criminal Investigation">Enquête criminelle</option>
                                    <option value="Internal Affairs Investigation">Enquête des affaires internes</option>
                                    <option value="Traffic Incident Review">Examen d'incident de circulation</option>
                                    <option value="General Security Review">Examen de sécurité générale</option>
                                    <option value="Other">Autre (Précisez dans la description)</option>
                                </Form.Select>
                            </Form.Group>
                        </div>

                            <Form.Label>Emplacement de la vidéosurveillance demandée *</Form.Label>
                                                    <Form.Control type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ex., Pillbox Hill Medical Center - Entrée principale" required disabled={isSubmitting} />
                                                    <Form.Label>Description de la demande (( et informations HRP ))</Form.Label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                            <Form.Control as="textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brève description des événements et de la période pour la demande d'images." required disabled={isSubmitting} />
                            <Form.Control as="textarea" rows={4} value={oocNotes} onChange={(e) => setOocNotes(e.target.value)} placeholder="(( Si vous connaissez les noms (ou noms masqués) impliqués, car cela nous aidera à affiner notre recherche dans les journaux de vidéosurveillance (qui peuvent être très volumineux) ))" disabled={isSubmitting} />
</div>                        {/* --- MODIFICATION END --- */}
                    </Form>
                </div>
                <div style={modalFooterStyle}>
                    <Button variant="secondary" onClick={onHide} disabled={isSubmitting}>Annuler</Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting} style={{ marginLeft: '10px' }}>
                        {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : 'Envoyer la demande de vidéosurveillance'}
                    </Button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.getElementById('modal-root'));
    // --- MODIFICATION END ---
};

export default CctvRequestWebhookModal;
