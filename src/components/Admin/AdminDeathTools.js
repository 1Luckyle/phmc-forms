// src/components/Admin/AdminDeathTools.js
//
// Panneau admin (Utilisateurs) : « Décès et identifiants temporaires ».
//   • ID temporaires du DMEC : attribuer l'ID réel (transfère tous les rapports, le marqueur de décès et les rapports publics : utils/temporaryIds.js) ;
//   • contestations de décès des patients (comptes Civils déclarés décédés) : rétablir le patient (lève le blocage) ou rejeter, avec une réponse que le patient lit.
import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Form, Spinner } from 'react-bootstrap';
import { ref, get, update } from 'firebase/database';
import { database } from '../../firebase';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { loadTemporaryIds, assignTemporaryId } from '../../utils/temporaryIds';
import { unlockPatient } from '../../utils/deathReports';
import { findCivilianUidByPatientId, notifyUser } from '../../utils/notifications';
import { canonicalPatientId } from '../../utils/patientId';

const card = { border: '1px solid #30363d', borderRadius: 6, padding: '10px 12px', background: '#0d1117', marginBottom: 8 };
const muted = { color: '#8b949e', fontSize: '0.8rem' };
const when = (ms) => (ms ? new Date(Number(ms)).toLocaleString() : '');

const TemporaryIds = ({ showNotification, adminName }) => {
    const [registry, setRegistry] = useState({});
    const [loading, setLoading] = useState(false);
    const [targets, setTargets] = useState({});
    const [busy, setBusy] = useState('');
    const reload = useCallback(async () => { setLoading(true); try { setRegistry(await loadTemporaryIds()); } catch (error) { setRegistry({}); } finally { setLoading(false); } }, []);
    useEffect(() => { reload(); }, [reload]);

    const assign = async (id) => {
        const real = canonicalPatientId(targets[id]);
        if (!/^PHMC-\d{3,}$/.test(real)) { showNotification("Indiquez l'ID réel du patient (ex. PHMC-2752).", 'warning'); return; }
        if (!window.confirm(`Attribuer ${real} à ${id} ?\n\nTous les rapports portant ${id} seront transférés sur ${real} (index des dossiers, titres, ID dans les rapports).`)) return;
        setBusy(id);
        try {
            const result = await assignTemporaryId({ tempId: id, realId: real, byName: adminName });
            showNotification(`${id} → ${real} : ${result.moved} rapport(s) transféré(s)${result.frozen.length ? `, ${result.frozen.length} ignoré(s) (gel judiciaire)` : ''}${result.deathMarker ? ', patient déclaré décédé' : ''}.`, 'check-circle', 9000);
            await reload();
        } catch (error) { showNotification(`Attribution impossible : ${error.message || error}`, 'error', 9000); } finally { setBusy(''); }
    };

    const entries = Object.entries(registry).sort(([, a], [, b]) => (Number(b.creeLe) || 0) - (Number(a.creeLe) || 0));
    return (
        <div className="mb-4">
            <div className="d-flex align-items-center mb-2">
                <strong><i className="fas fa-id-badge me-2"></i>Identifiants temporaires du DMEC</strong>
                <Button size="sm" variant="outline-secondary" className="ms-auto" onClick={reload} disabled={loading}><i className="fas fa-rotate me-1"></i>Actualiser</Button>
            </div>
            <div style={{ ...muted, marginBottom: 8 }}>Un défunt sans ID patient reçoit un ID temporaire pour relier ses rapports. Attribuez-lui l'ID réel quand il est connu : les rapports sont transférés.</div>
            {loading && <Spinner size="sm" animation="border" />}
            {!loading && entries.length === 0 && <div style={muted}>Aucun identifiant temporaire.</div>}
            {entries.map(([id, entry]) => (
                <div key={id} style={card}>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <Badge bg={entry.statut === 'attribue' ? 'success' : 'warning'} text={entry.statut === 'attribue' ? undefined : 'dark'}>{entry.statut === 'attribue' ? 'Attribué' : 'Temporaire'}</Badge>
                        <strong>{id}</strong><span>{entry.nom}</span>
                        <span style={muted}>créé par {entry.par || 'le DMEC'} le {when(entry.creeLe)}</span>
                    </div>
                    {entry.statut === 'attribue'
                        ? <div style={muted}>Attribué à <strong>{entry.idReel}</strong> par {entry.attribuePar || 'un administrateur'} le {when(entry.attribueLe)}.</div>
                        : (
                            <div className="d-flex gap-2 mt-2 flex-wrap">
                                <Form.Control size="sm" type="text" placeholder="ID réel (ex. PHMC-2752)" value={targets[id] || ''} onChange={(event) => setTargets((prev) => ({ ...prev, [id]: event.target.value }))} style={{ maxWidth: 220 }} />
                                <Button size="sm" variant="primary" disabled={busy === id} onClick={() => assign(id)}>{busy === id ? <Spinner size="sm" animation="border" /> : "Attribuer l'ID réel"}</Button>
                            </div>
                        )}
                </div>
            ))}
        </div>
    );
};

const Contestations = ({ showNotification, adminName }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [replies, setReplies] = useState({});
    const [busy, setBusy] = useState('');
    const reload = useCallback(async () => {
        setLoading(true);
        try { const snap = await get(ref(database, 'contestationsDeces')); setItems(Object.entries(snap.val() || {}).map(([patientID, value]) => ({ patientID, ...value })).sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0))); } catch (error) { setItems([]); } finally { setLoading(false); }
    }, []);
    useEffect(() => { reload(); }, [reload]);

    const answer = async (item, accept) => {
        const reponse = String(replies[item.patientID] || '').trim().slice(0, 500);
        if (!accept && !reponse) { showNotification('Indiquez le motif du rejet : le patient le lira.', 'warning'); return; }
        if (!window.confirm(accept ? `Rétablir ${item.patientID} ? Le blocage du dossier est levé et le patient retrouve l'accès au site.` : `Rejeter la contestation de ${item.patientID} ?`)) return;
        setBusy(item.patientID);
        try {
            if (accept) await unlockPatient(item.patientID, adminName);
            await update(ref(database, `contestationsDeces/${item.patientID}`), { statut: accept ? 'acceptee' : 'rejetee', reponse, traiteLe: Date.now(), traitePar: String(adminName || '').slice(0, 120) });
            const uid = await findCivilianUidByPatientId(item.patientID);
            if (uid) await notifyUser(uid, { type: 'statut', titre: accept ? 'Votre contestation a été acceptée' : 'Votre contestation a été rejetée', texte: reponse || (accept ? 'Votre accès au site est rétabli.' : '') });
            showNotification(accept ? `${item.patientID} rétabli.` : 'Contestation rejetée.', 'check-circle');
            await reload();
        } catch (error) { showNotification(`Action impossible : ${error.message || error}`, 'error', 9000); } finally { setBusy(''); }
    };

    return (
        <div className="mb-3">
            <div className="d-flex align-items-center mb-2">
                <strong><i className="fas fa-gavel me-2"></i>Contestations de décès</strong>
                <Button size="sm" variant="outline-secondary" className="ms-auto" onClick={reload} disabled={loading}><i className="fas fa-rotate me-1"></i>Actualiser</Button>
            </div>
            <div style={{ ...muted, marginBottom: 8 }}>Un patient déclaré décédé qui a un compte Civil ne peut plus utiliser le site, sauf pour contester. Lui donner raison lève le blocage de son dossier.</div>
            {loading && <Spinner size="sm" animation="border" />}
            {!loading && items.length === 0 && <div style={muted}>Aucune contestation.</div>}
            {items.map((item) => (
                <div key={item.patientID} style={card}>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <Badge bg={item.statut === 'en_attente' ? 'warning' : item.statut === 'acceptee' ? 'success' : 'secondary'} text={item.statut === 'en_attente' ? 'dark' : undefined}>{item.statut === 'en_attente' ? 'En attente' : item.statut === 'acceptee' ? 'Acceptée' : 'Rejetée'}</Badge>
                        <strong>{item.patientID}</strong><span style={muted}>{when(item.creeLe)}</span>
                    </div>
                    <div className="small mt-1" style={{ whiteSpace: 'pre-wrap' }}>{item.message}</div>
                    {item.statut !== 'en_attente' && <div style={muted}>Traitée par {item.traitePar || 'un administrateur'} le {when(item.traiteLe)}{item.reponse ? ` : « ${item.reponse} »` : ''}</div>}
                    {item.statut === 'en_attente' && (
                        <>
                            <Form.Control as="textarea" rows={2} size="sm" className="mt-2" placeholder="Réponse au patient (obligatoire pour un rejet)" value={replies[item.patientID] || ''} onChange={(event) => setReplies((prev) => ({ ...prev, [item.patientID]: event.target.value }))} />
                            <div className="d-flex gap-2 mt-2">
                                <Button size="sm" variant="success" disabled={busy === item.patientID} onClick={() => answer(item, true)}>Rétablir le patient</Button>
                                <Button size="sm" variant="outline-danger" disabled={busy === item.patientID} onClick={() => answer(item, false)}>Rejeter</Button>
                            </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};

const AdminDeathTools = ({ showNotification }) => {
    const { staffName } = useEmployeeAuth();
    const adminName = staffName || 'Administrateur';
    return (
        <div>
            <h5 className="mb-3"><i className="fas fa-cross me-2"></i>Décès et identifiants temporaires</h5>
            <TemporaryIds showNotification={showNotification} adminName={adminName} />
            <Contestations showNotification={showNotification} adminName={adminName} />
        </div>
    );
};

export default AdminDeathTools;
