// src/components/Admin/PendingAccountDeletions.js
//
// Demandes de suppression de compte envoyées par le personnel (demandesSuppression/{uid}, voir utils/accountDeletion.js). Un admin supprime le
// compte (la fiche, les droits, la connexion, la carte et la signature ; les archives — rapports, dossier patient, candidatures, contrats — sont
// conservées) ou refuse la demande. Un compte Civil, lui, se supprime directement depuis son menu.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Spinner, Table } from 'react-bootstrap';
import { loadStaffMembers, removeStaffMember } from '../../utils/staffAdmin';
import { loadDeletionRequests, closeDeletionRequest } from '../../utils/accountDeletion';
import { notifyUser } from '../../utils/notifications';
import { logActivity } from '../../utils/activityLog';

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

const PendingAccountDeletions = ({ showNotification, currentUser }) => {
    const [requests, setRequests] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyUid, setBusyUid] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [list, members] = await Promise.all([loadDeletionRequests(), loadStaffMembers().catch(() => [])]);
            setRequests(list);
            setStaff(members);
        } catch (err) {
            console.error('Demandes de suppression illisibles :', err);
            setError(err?.message || 'Chargement impossible.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const memberOf = (request) => staff.find((member) => member.uid === request.uid) || null;

    const approve = async (request) => {
        const member = memberOf(request);
        const label = member ? (member.displayName || member.name) : request.nom;
        if (!window.confirm(`Supprimer le compte de ${label} ?\n\nSa fiche, ses droits, sa carte, sa signature et sa connexion seront supprimés. Ses rapports, son dossier patient, ses candidatures et ses contrats sont conservés.`)) return;
        setBusyUid(request.uid);
        try {
            if (member) await removeStaffMember(member);
            await closeDeletionRequest(request.uid);
            logActivity({ category: 'comptes', action: 'deletion_approved', severity: 'warning', summary: `Suppression de compte accordée : ${label}`, target: label });
            showNotification(member ? `Compte de ${label} supprimé.` : `Demande clôturée : ${label} n'a plus de fiche du personnel.`, 'success');
            await load();
        } catch (err) {
            showNotification(`Suppression impossible : ${String(err?.message || err).slice(0, 160)}`, 'error');
        } finally {
            setBusyUid('');
        }
    };

    const refuse = async (request) => {
        const note = window.prompt(`Refuser la demande de ${request.nom} ? Indiquez le motif (envoyé à la personne, facultatif) :`, '');
        if (note === null) return;
        setBusyUid(request.uid);
        try {
            await closeDeletionRequest(request.uid);
            notifyUser(request.uid, { type: 'statut', titre: 'Demande de suppression de compte refusée', texte: String(note).trim().slice(0, 300) || undefined });
            showNotification('Demande refusée.', 'info');
            await load();
        } catch (err) {
            showNotification(`Refus impossible : ${String(err?.message || err).slice(0, 160)}`, 'error');
        } finally {
            setBusyUid('');
        }
    };

    return (
        <div>
            <p className="text-muted small">
                Demandes de suppression de compte du personnel. Un compte Civil se supprime lui-même depuis son menu « Supprimer mon compte ». Les archives liées à l'ID patient sont toujours conservées.
            </p>
            {loading && <Spinner animation="border" size="sm" />}
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}
            {!loading && !error && requests.length === 0 && <p className="text-muted">Aucune demande en attente.</p>}
            {requests.length > 0 && (
                <div className="table-responsive">
                    <Table variant="dark" hover size="sm" className="align-middle">
                        <thead><tr><th>Personne</th><th>Grade</th><th>Motif</th><th>Demandée le</th><th></th></tr></thead>
                        <tbody>
                            {requests.map((request) => {
                                const member = memberOf(request);
                                const own = request.uid === currentUser?.uid;
                                return (
                                    <tr key={request.uid}>
                                        <td className="fw-semibold">
                                            {request.nom}
                                            {request.email && <small className="d-block text-muted">{request.email}</small>}
                                            {!member && <Badge bg="secondary" className="fw-normal mt-1">Sans fiche du personnel</Badge>}
                                        </td>
                                        <td>{request.rang || '—'}</td>
                                        <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{request.motif || <span className="text-muted">—</span>}</td>
                                        <td>{formatDate(request.demandeLe)}</td>
                                        <td>
                                            <div className="d-flex gap-2 justify-content-end">
                                                <Button size="sm" variant="outline-danger" disabled={busyUid === request.uid || own} title={own ? 'Un autre admin doit traiter votre propre demande.' : undefined} onClick={() => approve(request)}>
                                                    {busyUid === request.uid ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-trash me-1"></i>Supprimer le compte</>}
                                                </Button>
                                                <Button size="sm" variant="outline-secondary" disabled={busyUid === request.uid} onClick={() => refuse(request)}>Refuser</Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default PendingAccountDeletions;
