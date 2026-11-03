// src/components/Administrative/ExemptionsModal.js
//
// « Exemptions de paiement » (Administratif) : le personnel administratif (Direction, assistance, administration) et les admins traitent les demandes
// d'exemption (accorder, refuser avec un commentaire), consultent les personnes exemptées et peuvent retirer une exemption en indiquant POURQUOI
// (le motif est conservé et transmis à la personne). Chaque décision notifie la personne et lui écrit. Voir utils/exemptions.js.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Nav, Spinner, Table } from 'react-bootstrap';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import {
    loadPendingRequests, loadAllExemptions, approveRequest, refuseRequest, grantExemption, withdrawExemption, isValidPatientId,
    EXEMPTION_MOTIFS, EXEMPTION_SOURCES, EXEMPTION_INFO,
} from '../../utils/exemptions';

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

const ExemptionsModal = ({ show, onHide, showNotification }) => {
    const { staffName, currentEmployee } = useEmployeeAuth();
    const actor = staffName || currentEmployee?.email || 'Administration';
    const [tab, setTab] = useState('pending');
    const [requests, setRequests] = useState([]);
    const [flags, setFlags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState('');
    const [notes, setNotes] = useState({});
    const [query, setQuery] = useState('');
    const [manual, setManual] = useState({ patientID: '', name: '', note: '' });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [pending, active] = await Promise.all([loadPendingRequests(), loadAllExemptions()]);
            setRequests(pending);
            setFlags(active);
        } catch (err) {
            console.error('Exemptions illisibles :', err);
            setError(err?.message || 'Chargement impossible.');
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { if (show) load(); }, [show, load]);

    const run = async (id, action, success) => {
        setBusyId(id);
        try {
            await action();
            showNotification(success, 'success');
            await load();
        } catch (err) {
            showNotification(String(err?.message || err).slice(0, 200), 'error');
        } finally {
            setBusyId('');
        }
    };
    const noteOf = (id) => notes[id] || '';
    const setNote = (id, value) => setNotes((previous) => ({ ...previous, [id]: value }));

    const shownFlags = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return flags.filter((flag) => !needle || `${flag.patientID} ${flag.parNom || ''}`.toLowerCase().includes(needle));
    }, [flags, query]);

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Exemptions de paiement" modalSize="xl" zIndex={1100} className="dark-ui">
            <p className="text-muted small">{EXEMPTION_INFO} Les mineurs reçoivent l'exemption automatiquement à la création de leur profil.</p>
            <Nav variant="tabs" className="mb-3" activeKey={tab} onSelect={setTab}>
                <Nav.Item><Nav.Link eventKey="pending">Demandes {requests.length > 0 && <Badge bg="warning" text="dark">{requests.length}</Badge>}</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="active">Personnes exemptées <Badge bg="secondary">{flags.length}</Badge></Nav.Link></Nav.Item>
            </Nav>
            {loading && <Spinner animation="border" size="sm" />}
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}

            {tab === 'pending' && !loading && (
                requests.length === 0 ? <p className="text-muted">Aucune demande en attente.</p> : requests.map((request) => (
                    <div key={request.patientID} className="border rounded p-3 mb-3" style={{ borderColor: '#30363d' }} data-guide-zone>
                        <div className="d-flex flex-wrap justify-content-between gap-2">
                            <div>
                                <strong>{request.patientNom}</strong> <span className="text-muted">({request.patientID})</span>
                                <div className="small text-muted">
                                    {EXEMPTION_MOTIFS[request.motif] || request.motif} · demandée le {formatDate(request.demandeLe)} par {request.parSoignant ? `${request.parSoignant} (soignant, qui s'engage pour le patient)` : 'le patient'}
                                </div>
                                {request.details && <div className="small mt-1" style={{ whiteSpace: 'pre-wrap' }}>« {request.details} »</div>}
                            </div>
                        </div>
                        <Form.Control
                            size="sm" className="my-2" maxLength={300} name={`note-${request.patientID}`}
                            data-guide="Facultatif : un message transmis à la personne avec la décision."
                            placeholder="Commentaire pour la personne (facultatif, envoyé avec la décision)"
                            value={noteOf(request.patientID)} onChange={(event) => setNote(request.patientID, event.target.value)}
                        />
                        <div className="d-flex gap-2">
                            <Button size="sm" variant="success" disabled={busyId === request.patientID} onClick={() => run(request.patientID, () => approveRequest(request, { name: actor, note: noteOf(request.patientID) }), 'Exemption accordée.')}>
                                <i className="fas fa-check me-1"></i>Accorder
                            </Button>
                            <Button size="sm" variant="outline-danger" disabled={busyId === request.patientID} onClick={() => run(request.patientID, () => refuseRequest(request, { name: actor, note: noteOf(request.patientID) }), 'Demande refusée.')}>
                                <i className="fas fa-xmark me-1"></i>Refuser
                            </Button>
                        </div>
                    </div>
                ))
            )}

            {tab === 'active' && !loading && (
                <>
                    <div className="d-flex flex-wrap gap-2 mb-3" data-guide-zone>
                        <Form.Control size="sm" style={{ maxWidth: 160 }} name="patientID" required data-guide="L'ID patient à exempter (PHMC-1234)." placeholder="ID patient" value={manual.patientID} onChange={(event) => setManual({ ...manual, patientID: event.target.value })} />
                        <Form.Control size="sm" style={{ maxWidth: 200 }} name="name" data-guide="Facultatif : son nom, pour le courriel." placeholder="Nom (facultatif)" value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} />
                        <Form.Control size="sm" style={{ maxWidth: 260 }} name="note" data-guide="Facultatif : un message transmis à la personne." placeholder="Commentaire (facultatif)" value={manual.note} onChange={(event) => setManual({ ...manual, note: event.target.value })} />
                        <Button size="sm" variant="outline-success" disabled={!isValidPatientId(manual.patientID) || busyId === 'manual'} onClick={() => run('manual', () => grantExemption({ patientID: manual.patientID, patientName: manual.name, name: actor, note: manual.note }).then(() => setManual({ patientID: '', name: '', note: '' })), 'Exemption accordée.')}>
                            <i className="fas fa-plus me-1"></i>Accorder directement
                        </Button>
                    </div>
                    <Form.Control type="search" size="sm" className="mb-3" style={{ maxWidth: 280 }} data-no-mark placeholder="Rechercher (ID, nom)…" value={query} onChange={(event) => setQuery(event.target.value)} />
                    {shownFlags.length === 0 ? <p className="text-muted">Aucune personne exemptée.</p> : (
                        <div className="table-responsive">
                            <Table variant="dark" hover size="sm" className="align-middle">
                                <thead><tr><th>ID patient</th><th>Origine</th><th>Depuis</th><th>Par</th><th>Retirer l'exemption (motif obligatoire)</th></tr></thead>
                                <tbody>
                                    {shownFlags.map((flag) => (
                                        <tr key={flag.patientID}>
                                            <td className="fw-semibold">{flag.patientID}{flag.note && <small className="d-block text-muted">{flag.note}</small>}</td>
                                            <td>{EXEMPTION_SOURCES[flag.source] || flag.source}</td>
                                            <td>{formatDate(flag.depuisLe)}</td>
                                            <td>{flag.parNom || '—'}</td>
                                            <td>
                                                <div className="d-flex gap-2" data-guide-zone>
                                                    <Form.Control size="sm" maxLength={300} name={`retrait-${flag.patientID}`} required data-guide="Pourquoi l'exemption est retirée : ce motif est conservé et transmis à la personne."
                                                        placeholder="Motif du retrait" value={noteOf(`w-${flag.patientID}`)} onChange={(event) => setNote(`w-${flag.patientID}`, event.target.value)} />
                                                    <Button size="sm" variant="outline-danger" disabled={busyId === flag.patientID || !noteOf(`w-${flag.patientID}`).trim()}
                                                        onClick={() => { if (window.confirm(`Retirer l'exemption de ${flag.patientID} ?`)) run(flag.patientID, () => withdrawExemption({ patientID: flag.patientID, name: actor, comment: noteOf(`w-${flag.patientID}`) }), 'Exemption retirée.'); }}>
                                                        Retirer
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </>
            )}
        </BaseModal>
    );
};

export default ExemptionsModal;
