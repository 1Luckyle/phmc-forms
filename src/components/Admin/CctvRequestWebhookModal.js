// src/components/Admin/CctvRequestWebhookModal.js
//
// Forces de l'ordre → demande d'images de vidéosurveillance du PHMC. Le formulaire est visible de tous mais
// BLOQUÉ tant qu'on n'est pas connecté (se connecter ou créer un compte d'abord). L'envoi n'est possible que si
// tous les champs obligatoires sont remplis : agent demandeur, département, téléphone, Discord, date ET heure de
// l'incident, raison (avec précision si « Autre ») et au moins une caméra.
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import * as Sentry from "@sentry/react";
import DebugFillButton from '../DebugFillButton';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';

// Caméras du PHMC pouvant être demandées (une ou plusieurs).
export const CCTV_CAMERAS = [
    { value: 'reception', label: 'PHMC – Entrée de la réception des visiteurs (Elgin Avenue)' },
    { value: 'urgences', label: 'PHMC – Entrée des urgences (Strawberry Avenue)' },
    { value: 'parking', label: 'PHMC – Parking des employés (petite vue sur la Del Perro Freeway)' },
];

export const CCTV_REASONS = [
    { value: 'criminal', label: 'Enquête criminelle' },
    { value: 'internal', label: 'Enquête des affaires internes' },
    { value: 'traffic', label: "Examen d'incident de circulation" },
    { value: 'security', label: 'Examen de sécurité générale' },
    { value: 'other', label: 'Autre raison' },
];

const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1055,
};
const contentStyle = {
    position: 'relative', backgroundColor: '#0d1117', color: '#c9d1d9',
    borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
    width: '94%', maxWidth: '860px', maxHeight: '92vh',
    display: 'flex', flexDirection: 'column', border: '1px solid #30363d', overflow: 'hidden',
};
const headerStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 22px', background: 'linear-gradient(135deg, #0b2a4a 0%, #11375f 100%)',
    borderBottom: '2px solid #1f6feb',
};
const bodyStyle = { overflowY: 'auto', flexGrow: 1, padding: '18px 22px' };
const footerStyle = {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px',
    padding: '14px 22px', borderTop: '1px solid #30363d', backgroundColor: '#161b22',
};
const sectionStyle = { border: '1px solid #30363d', borderRadius: '8px', padding: '14px 16px', marginBottom: '14px', backgroundColor: '#161b22' };
const sectionTitleStyle = { fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#58a6ff', marginBottom: '10px', fontWeight: 700 };
const rowStyle = { display: 'flex', gap: '12px', flexWrap: 'wrap' };
const fieldStyle = { flex: '1 1 220px', minWidth: '200px' };
const closeButtonStyle = { background: 'none', border: 'none', color: '#c9d1d9', fontSize: '1.6rem', lineHeight: 1, cursor: 'pointer' };

const selectStyles = (invalid) => ({
    control: (base, state) => ({
        ...base, backgroundColor: '#0d1117', borderColor: invalid ? '#f85149' : (state.isFocused ? '#58a6ff' : '#30363d'),
        boxShadow: 'none', '&:hover': { borderColor: '#58a6ff' },
    }),
    menu: (base) => ({ ...base, backgroundColor: '#0d1117', zIndex: 1060 }),
    menuPortal: (base) => ({ ...base, zIndex: 1060 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#1f2937' : '#0d1117', color: '#c9d1d9' }),
    multiValue: (base) => ({ ...base, backgroundColor: '#1f3a5f' }),
    multiValueLabel: (base) => ({ ...base, color: '#e6edf3' }),
    multiValueRemove: (base) => ({ ...base, color: '#e6edf3', '&:hover': { backgroundColor: '#f85149', color: '#fff' } }),
    placeholder: (base) => ({ ...base, color: '#6e7681' }),
    input: (base) => ({ ...base, color: '#c9d1d9' }),
});

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (isoDate) => {
    const [year, month, day] = String(isoDate || '').split('-');
    return year && month && day ? `${day}/${month}/${year}` : '';
};

const CctvRequestWebhookModal = ({ show, onHide, onSubmit, showNotification, onLogin, onSignup }) => {
    const { currentEmployee } = useEmployeeAuth();
    const isLoggedIn = !!currentEmployee;

    const [rank, setRank] = useState('');
    const [officer, setOfficer] = useState('');
    const [officerPH, setOfficerPH] = useState('');
    const [department, setDepartment] = useState('');
    const [discordUsername, setDiscordUsername] = useState('');
    const [incidentDate, setIncidentDate] = useState('');
    const [incidentTime, setIncidentTime] = useState('');
    const [reason, setReason] = useState('');
    const [otherReason, setOtherReason] = useState('');
    const [cameras, setCameras] = useState([]);
    const [description, setDescription] = useState('');
    const [oocNotes, setOocNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [attempted, setAttempted] = useState(false);

    useEffect(() => {
        if (!show) {
            setRank(''); setOfficer(''); setOfficerPH(''); setDepartment(''); setDiscordUsername('');
            setIncidentDate(''); setIncidentTime(''); setReason(''); setOtherReason('');
            setCameras([]); setDescription(''); setOocNotes('');
            setIsSubmitting(false); setAttempted(false);
        }
    }, [show]);

    // Mode debug : données de test (l'envoi reste à la charge de l'utilisateur).
    const handleDebugFill = () => {
        const now = new Date();
        setRank('Sergent');
        setOfficer('1234, John Doe');
        setOfficerPH('555-0100');
        setDepartment('LSPD');
        setDiscordUsername('john.doe.debug');
        setIncidentDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
        setIncidentTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
        setReason('criminal');
        setCameras([CCTV_CAMERAS[1]]);
        setDescription('[TEST] Demande de vidéosurveillance générée par le mode debug.');
        setOocNotes('[TEST] Aucun nom connu.');
    };

    const today = (() => { const now = new Date(); return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; })();

    // Champs obligatoires → libellé du champ manquant.
    const missing = [];
    if (!officer.trim()) missing.push('Agent demandeur');
    if (!department.trim()) missing.push('Département demandeur');
    if (!officerPH.trim()) missing.push("Numéro de téléphone de l'agent");
    if (!discordUsername.trim()) missing.push("Nom d'utilisateur Discord");
    if (!incidentDate) missing.push("Date de l'incident");
    if (!incidentTime) missing.push("Heure de l'incident");
    if (!reason) missing.push('Raison de la demande');
    if (reason === 'other' && !otherReason.trim()) missing.push('Précision de la raison');
    if (cameras.length === 0) missing.push('Emplacement de la vidéosurveillance (au moins une caméra)');

    const handleSubmit = async () => {
        if (!isLoggedIn) {
            showNotification('Connectez-vous ou créez un compte avant d\'envoyer une demande.', 'warning');
            return;
        }
        setAttempted(true);
        if (missing.length > 0) {
            showNotification(`Champs obligatoires manquants :\n${missing.map((label) => `• ${label}`).join('\n')}`, 'warning', 8000);
            return;
        }

        setIsSubmitting(true);
        try {
            const reasonLabel = CCTV_REASONS.find((item) => item.value === reason)?.label || reason;
            const success = await onSubmit({
                rank,
                officer,
                officerPH,
                department,
                location: cameras.map((camera) => camera.label).join('\n'),
                description,
                discordUsername,
                oocNotes,
                incidentDateTime: `${formatDate(incidentDate)} à ${incidentTime}`,
                requestReason: reason === 'other' ? `Autre : ${otherReason.trim()}` : reasonLabel,
            });
            if (success) onHide();
        } catch (error) {
            console.error("Error submitting CCTV webhook:", error);
            Sentry.captureException(error, { extra: { context: 'CctvRequestWebhookModal Submit' } });
            showNotification('Une erreur s\'est produite lors de la soumission.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!show) return null;

    const invalid = (isMissing) => attempted && isMissing;
    const required = <span style={{ color: '#f85149' }}> *</span>;
    const locked = isSubmitting || !isLoggedIn;

    const modalContent = (
        <div style={overlayStyle} onClick={onHide}>
            <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
                <div style={headerStyle}>
                    <div>
                        <h5 style={{ margin: 0, color: '#f0f6fc' }}><i className="fas fa-video" style={{ marginRight: '10px' }}></i>Demande de vidéosurveillance</h5>
                        <div style={{ fontSize: '0.82rem', color: '#9ecbff' }}>Forces de l'ordre → Pillbox Hill Medical Center</div>
                    </div>
                    <button onClick={onHide} style={closeButtonStyle} aria-label="Fermer la fenêtre">&times;</button>
                </div>

                <div style={bodyStyle}>
                    {!isLoggedIn && (
                        <div style={{ border: '1px solid #d29922', backgroundColor: 'rgba(210, 153, 34, 0.12)', borderRadius: '8px', padding: '12px 16px', marginBottom: '14px' }}>
                            <strong><i className="fas fa-lock" style={{ marginRight: '8px' }}></i>Connexion requise</strong>
                            <div style={{ margin: '6px 0 10px' }}>Le formulaire est visible mais bloqué : connectez-vous ou créez un compte avant d'envoyer une demande.</div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {onLogin && <Button size="sm" variant="primary" onClick={() => { onHide(); onLogin(); }}><i className="fas fa-sign-in-alt"></i> Se connecter</Button>}
                                {onSignup && <Button size="sm" variant="success" onClick={() => { onHide(); onSignup(); }}><i className="fas fa-user-plus"></i> Créer un compte</Button>}
                            </div>
                        </div>
                    )}

                    <p style={{ color: '#8b949e', fontSize: '0.9em' }}>
                        Ce formulaire est envoyé directement aux superviseurs du PHMC. Il sera traité dans les 24 heures suivantes et vous serez contacté par téléphone ou par votre département.
                        {' '}(( L'abus de ce formulaire sera signalé à la direction des factions légales. ))
                    </p>

                    <Form onSubmit={(e) => e.preventDefault()}>
                        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, opacity: isLoggedIn ? 1 : 0.55 }}>
                            <div style={sectionStyle}>
                                <div style={sectionTitleStyle}>Agent demandeur</div>
                                <div style={rowStyle}>
                                    <Form.Group style={fieldStyle}>
                                        <Form.Label>Grade</Form.Label>
                                        <Form.Control type="text" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="Grade de l'agent (facultatif)" />
                                    </Form.Group>
                                    <Form.Group style={fieldStyle}>
                                        <Form.Label>Agent demandeur{required}</Form.Label>
                                        <Form.Control type="text" value={officer} onChange={(e) => setOfficer(e.target.value)} placeholder="Matricule, Prénom & Nom" isInvalid={invalid(!officer.trim())} />
                                    </Form.Group>
                                    <Form.Group style={fieldStyle}>
                                        <Form.Label>Numéro de téléphone de l'agent{required}</Form.Label>
                                        <Form.Control type="text" value={officerPH} onChange={(e) => setOfficerPH(e.target.value)} placeholder="ex. 555-0100" isInvalid={invalid(!officerPH.trim())} />
                                    </Form.Group>
                                </div>
                                <div style={{ ...rowStyle, marginTop: '10px' }}>
                                    <Form.Group style={fieldStyle}>
                                        <Form.Label>Département demandeur{required}</Form.Label>
                                        <Form.Control type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="ex. LSPD, LSSD" isInvalid={invalid(!department.trim())} />
                                    </Form.Group>
                                    <Form.Group style={fieldStyle}>
                                        <Form.Label>Nom d'utilisateur Discord{required}</Form.Label>
                                        <Form.Control type="text" value={discordUsername} onChange={(e) => setDiscordUsername(e.target.value)} placeholder="ex. prenom.nom" isInvalid={invalid(!discordUsername.trim())} />
                                    </Form.Group>
                                </div>
                            </div>

                            <div style={sectionStyle}>
                                <div style={sectionTitleStyle}>L'incident</div>
                                <div style={rowStyle}>
                                    <Form.Group style={fieldStyle}>
                                        <Form.Label>Date de l'incident{required}</Form.Label>
                                        <Form.Control type="date" value={incidentDate} max={today} onChange={(e) => setIncidentDate(e.target.value)} isInvalid={invalid(!incidentDate)} />
                                    </Form.Group>
                                    <Form.Group style={fieldStyle}>
                                        <Form.Label>Heure de l'incident{required}</Form.Label>
                                        <Form.Control type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} isInvalid={invalid(!incidentTime)} />
                                    </Form.Group>
                                    <Form.Group style={fieldStyle}>
                                        <Form.Label>Raison de la demande{required}</Form.Label>
                                        <Form.Select value={reason} onChange={(e) => setReason(e.target.value)} isInvalid={invalid(!reason)}>
                                            <option value="">Sélectionnez une raison…</option>
                                            {CCTV_REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                </div>
                                {reason === 'other' && (
                                    <Form.Group style={{ marginTop: '10px' }}>
                                        <Form.Label>Précisez la raison de la demande{required}</Form.Label>
                                        <Form.Control type="text" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="Motif de la demande" isInvalid={invalid(!otherReason.trim())} />
                                    </Form.Group>
                                )}
                            </div>

                            <div style={sectionStyle}>
                                <div style={sectionTitleStyle}>Vidéosurveillance demandée</div>
                                <Form.Group>
                                    <Form.Label>Emplacement(s){required} <small style={{ color: '#8b949e' }}>— une ou plusieurs caméras</small></Form.Label>
                                    <Select
                                        isMulti
                                        options={CCTV_CAMERAS}
                                        value={cameras}
                                        onChange={(selected) => setCameras(selected || [])}
                                        placeholder="Choisir une ou plusieurs caméras…"
                                        noOptionsMessage={() => 'Toutes les caméras sont sélectionnées'}
                                        closeMenuOnSelect={false}
                                        isDisabled={locked}
                                        menuPortalTarget={document.body}
                                        styles={selectStyles(invalid(cameras.length === 0))}
                                    />
                                    {invalid(cameras.length === 0) && <div style={{ color: '#f85149', fontSize: '0.85em', marginTop: '4px' }}>Choisissez au moins une caméra.</div>}
                                </Form.Group>
                            </div>

                            <div style={sectionStyle}>
                                <div style={sectionTitleStyle}>Détails (facultatif)</div>
                                <div style={rowStyle}>
                                    <Form.Group style={{ flex: '1 1 300px' }}>
                                        <Form.Label>Description des événements</Form.Label>
                                        <Form.Control as="textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brève description des événements et de la période concernée." />
                                    </Form.Group>
                                    <Form.Group style={{ flex: '1 1 300px' }}>
                                        <Form.Label>Informations hors RP</Form.Label>
                                        <Form.Control as="textarea" rows={4} value={oocNotes} onChange={(e) => setOocNotes(e.target.value)} placeholder="(( Noms ou noms masqués des personnes impliquées, s'ils sont connus : cela nous aide à affiner la recherche dans les journaux de vidéosurveillance, qui peuvent être très volumineux. ))" />
                                    </Form.Group>
                                </div>
                            </div>
                        </fieldset>
                    </Form>
                </div>

                <div style={footerStyle}>
                    <DebugFillButton onFill={handleDebugFill} disabled={locked} style={{ marginRight: 'auto' }} />
                    {isLoggedIn && attempted && missing.length > 0 && (
                        <span style={{ color: '#f85149', fontSize: '0.85em' }}>{missing.length} champ(s) à compléter</span>
                    )}
                    <Button variant="secondary" onClick={onHide} disabled={isSubmitting}>Annuler</Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={locked}>
                        {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-paper-plane" style={{ marginRight: '8px' }}></i>Envoyer la demande</>}
                    </Button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.getElementById('modal-root'));
};

export default CctvRequestWebhookModal;
