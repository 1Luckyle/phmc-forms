// src/components/DeceasedGuard.js
//
// Patient déclaré DÉCÉDÉ par le DMEC (patientsDecedes/{ID}) qui a un compte Civil : à la place du site, il arrive sur une page qui le lui indique. Il ne peut plus rien faire, sauf CONTESTER auprès
// des administrateurs (contestationsDeces/{ID}) et se déconnecter. Un administrateur qui lui donne raison lève le blocage (le marqueur disparaît) : la page disparaît aussitôt.
// Seuls les comptes Civils sont concernés : un compte du personnel ou admin n'est jamais enfermé hors du site (un décès déclaré par erreur se corrige par un administrateur).
import React, { useEffect, useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { ref, onValue, set } from 'firebase/database';
import { database, auth } from '../firebase';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { canonicalPatientId } from '../utils/patientId';
import { notifyGroup } from '../utils/notifications';

const MAX_MESSAGE = 2000;
const when = (ms) => (ms ? new Date(Number(ms)).toLocaleString() : '');

/** Les deux marqueurs lus en direct : { loaded, marker, contest }. Un compte non concerné (pas d'ID, pas Civil) ne lit rien. */
export const useDeceasedStatus = (patientID) => {
    const id = canonicalPatientId(patientID);
    const [marker, setMarker] = useState({ id: '', value: null });
    const [contest, setContest] = useState({ id: '', value: null });
    useEffect(() => {
        if (!id) return undefined;
        // Lecture en direct : la page disparaît d'elle-même quand un administrateur lève le blocage, et la réponse à la contestation s'affiche aussitôt.
        const stopMarker = onValue(ref(database, `patientsDecedes/${id}`), (snap) => setMarker({ id, value: snap.exists() ? snap.val() : null }), () => setMarker({ id, value: null }));
        const stopContest = onValue(ref(database, `contestationsDeces/${id}`), (snap) => setContest({ id, value: snap.exists() ? snap.val() : null }), () => setContest({ id, value: null }));
        return () => { [stopMarker, stopContest].forEach((stop) => { try { stop(); } catch (error) { /* déjà arrêté */ } }); };
    }, [id]);
    return {
        deceased: !!id && marker.id === id && !!marker.value,
        marker: marker.id === id ? marker.value : null,
        contest: contest.id === id ? contest.value : null,
    };
};

export const DeceasedPage = ({ patientID, marker, contest, onLogout }) => {
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const canContest = !contest || contest.statut === 'rejetee';
    const send = async () => {
        const text = message.trim();
        if (!text) { setError('Expliquez pourquoi vous contestez ce décès.'); return; }
        setBusy(true);
        setError('');
        try {
            const id = canonicalPatientId(patientID);
            await set(ref(database, `contestationsDeces/${id}`), { uid: auth.currentUser.uid, message: text.slice(0, MAX_MESSAGE), creeLe: Date.now(), statut: 'en_attente' });
            await notifyGroup('admin', { type: 'demande', titre: `Contestation de décès : ${id}`, texte: text.slice(0, 200), lien: { cible: 'admin', section: 'users' } });
            setMessage('');
        } catch (err) { setError(err.message || "L'envoi a échoué."); } finally { setBusy(false); }
    };
    return (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 16px', color: '#e6edf3' }}>
            <div style={{ border: '1px solid #b62324', borderRadius: 8, padding: '24px', background: '#0d1117' }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: '2.4rem' }}><i className="fas fa-cross"></i></div>
                    <h3 style={{ marginTop: 8 }}>Vous avez été déclaré(e) décédé(e)</h3>
                </div>
                <p>
                    Le service de médecine légale (DMEC) a déclaré le patient <strong>{canonicalPatientId(patientID)}</strong> décédé{marker && marker.depuis ? ` le ${when(marker.depuis)}` : ''}. Tant que ce décès est enregistré,
                    votre compte ne donne plus accès au site.
                </p>
                <p className="text-muted">Si vous pensez qu'il s'agit d'une erreur, vous pouvez le contester : les administrateurs examineront votre demande.</p>

                {contest && contest.statut === 'en_attente' && (
                    <Alert variant="info"><i className="fas fa-hourglass-half me-2"></i>Votre contestation du {when(contest.creeLe)} est en attente de réponse des administrateurs.</Alert>
                )}
                {contest && contest.statut === 'rejetee' && (
                    <Alert variant="warning"><i className="fas fa-circle-xmark me-2"></i>Votre contestation a été rejetée{contest.reponse ? ` : « ${contest.reponse} »` : '.'} Vous pouvez en envoyer une nouvelle.</Alert>
                )}
                {contest && contest.statut === 'en_attente' && <div className="small text-muted mb-3" style={{ whiteSpace: 'pre-wrap' }}>Votre message : {contest.message}</div>}

                {canContest && (
                    <>
                        <Form.Label>Votre contestation</Form.Label>
                        <Form.Control as="textarea" rows={4} value={message} maxLength={MAX_MESSAGE} onChange={(event) => setMessage(event.target.value)} placeholder="Expliquez pourquoi ce décès est une erreur (personnage, circonstances, éléments de preuve…)" />
                        {error && <div className="text-danger small mt-1">{error}</div>}
                        <div className="d-flex gap-2 mt-3">
                            <Button variant="danger" onClick={send} disabled={busy || !message.trim()}><i className="fas fa-paper-plane me-1"></i>Envoyer la contestation</Button>
                            <Button variant="outline-secondary" onClick={onLogout}>Se déconnecter</Button>
                        </div>
                    </>
                )}
                {!canContest && <Button variant="outline-secondary" onClick={onLogout}>Se déconnecter</Button>}
            </div>
        </div>
    );
};

const DeceasedGuard = ({ children }) => {
    const { isCivilian, civilianProfile, logoutEmployee } = useEmployeeAuth();
    const patientID = isCivilian && civilianProfile ? civilianProfile.patientID : '';
    const { deceased, marker, contest } = useDeceasedStatus(patientID);
    if (patientID && deceased) return <DeceasedPage patientID={patientID} marker={marker} contest={contest} onLogout={() => { if (logoutEmployee) logoutEmployee(); }} />;
    return children;
};

export default DeceasedGuard;
