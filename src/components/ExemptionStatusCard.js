// src/components/ExemptionStatusCard.js
//
// Exemption de paiement de la personne connectée (profil, dossier patient, bandeau Civil) : l'indique si elle est exemptée (et depuis quand, par qui),
// si une demande est en attente, et sinon propose une demande rapide, traitée par le personnel administratif (notification et courriel à chaque étape).
import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Form, Spinner } from 'react-bootstrap';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import {
    loadExemption, loadMyPendingRequest, requestExemption, EXEMPTION_MOTIFS, EXEMPTION_SOURCES, EXEMPTION_INFO, isValidPatientId,
} from '../utils/exemptions';

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

const ExemptionStatusCard = ({ showNotification, compact = false }) => {
    const { myPatientID, civilianProfile, staffProfile, staffName, currentEmployee } = useEmployeeAuth();
    const [flag, setFlag] = useState(undefined);       // undefined = chargement
    const [pending, setPending] = useState(null);
    const [asking, setAsking] = useState(false);
    const [motif, setMotif] = useState('faible_revenu');
    const [details, setDetails] = useState('');
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        if (!isValidPatientId(myPatientID)) { setFlag(null); setPending(null); return; }
        const [found, request] = await Promise.all([loadExemption(myPatientID), loadMyPendingRequest(myPatientID)]);
        setFlag(found);
        setPending(request);
    }, [myPatientID]);
    useEffect(() => { refresh(); }, [refresh]);

    if (!isValidPatientId(myPatientID) || flag === undefined) return null;

    const name = [civilianProfile?.firstName, civilianProfile?.lastName].filter(Boolean).join(' ') || staffName || '';
    const send = async () => {
        setBusy(true);
        try {
            const outcome = await requestExemption({
                patientID: myPatientID, patientName: name, motif, details,
                patientEmail: civilianProfile?.email || staffProfile?.email || currentEmployee?.email || '',
                requesterEmail: civilianProfile?.email || staffProfile?.email || currentEmployee?.email || '',
            });
            if (showNotification) {
                showNotification(outcome.status === 'demandee' ? 'Demande envoyée au personnel administratif.' : 'Une demande est déjà en cours ou une exemption est déjà enregistrée.', 'info-circle');
            }
            setAsking(false);
            setDetails('');
            await refresh();
        } catch (error) {
            if (showNotification) showNotification(String(error?.message || error).slice(0, 160), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={compact ? '' : 'mb-3'} style={compact ? { fontSize: '0.9em' } : { padding: '10px 12px', border: '1px solid #30363d', borderRadius: '8px' }}>
            <div className="d-flex flex-wrap align-items-center gap-2">
                <i className="fas fa-hand-holding-heart" style={{ color: '#58a6ff' }}></i>
                <strong>Exemption de paiement :</strong>
                {flag ? (
                    <>
                        <Badge bg="success">Exempté(e)</Badge>
                        <span className="text-muted small">
                            {EXEMPTION_SOURCES[flag.source] || ''}{flag.depuisLe ? ` · depuis le ${formatDate(flag.depuisLe)}` : ''}
                        </span>
                    </>
                ) : pending ? (
                    <>
                        <Badge bg="info" text="dark">Demande en attente</Badge>
                        <span className="text-muted small">Envoyée le {formatDate(pending.demandeLe)} : le personnel administratif l'examine.</span>
                    </>
                ) : (
                    <>
                        <span className="text-muted small">aucune</span>
                        {!asking && <Button size="sm" variant="outline-info" onClick={() => setAsking(true)}>Demander l'exemption</Button>}
                    </>
                )}
            </div>
            {!flag && !pending && !asking && !compact && <div className="text-muted small mt-1">{EXEMPTION_INFO}</div>}
            {asking && (
                <div className="mt-2" data-guide-zone>
                    <p className="text-muted small mb-2">{EXEMPTION_INFO} Votre demande est traitée par le personnel administratif ; vous êtes prévenu(e) par notification et par courriel.</p>
                    <Form.Select size="sm" className="mb-2" name="motif" required data-guide="Pourquoi vous demandez l'exemption." value={motif} onChange={(event) => setMotif(event.target.value)} disabled={busy}>
                        {['faible_revenu', 'mineur', 'autre'].map((key) => <option key={key} value={key}>{EXEMPTION_MOTIFS[key]}</option>)}
                    </Form.Select>
                    <Form.Control
                        as="textarea" rows={2} maxLength={500} size="sm" className="mb-2" name="details" data-guide="Facultatif : une précision utile à l'examen de votre demande."
                        placeholder="Précision (facultatif)" value={details} onChange={(event) => setDetails(event.target.value)} disabled={busy}
                    />
                    <div className="d-flex gap-2">
                        <Button size="sm" variant="primary" onClick={send} disabled={busy}>{busy ? <Spinner size="sm" animation="border" /> : 'Envoyer la demande'}</Button>
                        <Button size="sm" variant="secondary" onClick={() => setAsking(false)} disabled={busy}>Annuler</Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExemptionStatusCard;
