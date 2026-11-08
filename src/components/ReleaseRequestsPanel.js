// src/components/ReleaseRequestsPanel.js
//
// « Dossier Patient » : demandes de divulgation à traiter (formulaire « Libération médicale », voir utils/releaseRequests.js).
// Chaque médecin y voit les demandes qui contiennent SES rapports et les partage avec le patient d'un clic ; un administrateur ou un chef de service voit
// toutes les demandes en attente et peut tout partager si un soignant ne le fait pas. On y voit le titre, la date et le médecin de chaque rapport.
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Badge } from 'react-bootstrap';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { getFormLabel } from '../formDefinitions';
import { logActivity } from '../utils/activityLog';
import {
    loadPendingReleaseRequests, requestsVisibleTo, shareableItems, waitingItems, shareRequestItems, cancelReleaseRequest, canCancelRequest,
    isServiceChief, ITEM_STATUS,
} from '../utils/releaseRequests';

const cardStyle = { border: '1px solid #30363d', borderRadius: 6, padding: '10px 12px', background: '#0d1117', marginBottom: 8 };
const mutedStyle = { color: '#8b949e', fontSize: '0.8rem' };
const dayOf = (ms) => (ms ? new Date(ms).toLocaleDateString('fr-FR') : '—');

const ITEM_BADGE = {
    [ITEM_STATUS.WAITING]: { bg: 'warning', text: 'À partager' },
    [ITEM_STATUS.SHARED]: { bg: 'success', text: 'Partagé' },
    [ITEM_STATUS.REMOVED]: { bg: 'secondary', text: 'Rapport retiré' },
};

const ReleaseRequestsPanel = ({ active, showNotification, onOpenPatient }) => {
    const { isAdmin, staffName, staffProfile, currentEmployee } = useEmployeeAuth();
    const viewer = { staffName, isAdmin: !!isAdmin, isChief: isServiceChief(staffProfile), uid: currentEmployee?.uid || '' };
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState('');
    const [open, setOpen] = useState(true);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            setRequests(await loadPendingReleaseRequests());
        } catch (error) {
            console.warn('Demandes de divulgation illisibles :', error);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { if (active) reload(); }, [active, reload]);

    const mine = requestsVisibleTo(requests, { staffName: viewer.staffName, isAdmin: viewer.isAdmin, isChief: viewer.isChief });
    if (!active || (mine.length === 0 && !loading)) return null;

    const share = async (request) => {
        setBusyId(request.id);
        try {
            const outcome = await shareRequestItems(request, viewer, { author: staffName });
            logActivity({
                category: 'rapports', action: 'report_shared', summary: `Divulgation : ${outcome.shared} rapport(s) partagé(s) avec le patient`,
                details: `Patient : ${request.patientNode}\nPartagé par : ${staffName || 'admin'}\nDemande : ${request.id}`, target: request.patientNode,
            });
            showNotification(`${outcome.shared} rapport(s) partagé(s) avec le patient.${outcome.removed ? ` ${outcome.removed} rapport(s) n'existent plus.` : ''}${outcome.left > 0 ? ` ${outcome.left} autre(s) restent à partager par leurs médecins.` : ''}`, 'check-circle', 7000);
            await reload();
        } catch (error) {
            console.error('Partage de la demande impossible :', error);
            showNotification('Le partage a échoué : réessayez ou prévenez un administrateur.', 'error');
        } finally {
            setBusyId('');
        }
    };

    const cancel = async (request) => {
        if (!window.confirm(`Annuler cette demande de divulgation pour ${request.patientNom || request.patientNode} ? Les rapports déjà partagés le restent.`)) return;
        setBusyId(request.id);
        try {
            await cancelReleaseRequest(request, staffName || 'admin');
            showNotification('Demande de divulgation annulée.', 'check-circle');
            await reload();
        } catch (error) {
            showNotification("L'annulation a échoué.", 'error');
        } finally {
            setBusyId('');
        }
    };

    return (
        <div className="mb-2" style={{ flexShrink: 0 }}>
            <button type="button" className="btn btn-sm btn-outline-warning mb-2" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
                <i className={`fas ${open ? 'fa-chevron-down' : 'fa-chevron-right'} me-2`}></i>
                Demandes de divulgation à traiter ({mine.length})
            </button>
            {open && (
                <div style={{ maxHeight: '38vh', overflowY: 'auto' }}>
                    {loading && mine.length === 0 && <div style={mutedStyle}>Chargement…</div>}
                    {mine.map((request) => {
                        const items = Object.entries(request.elements || {}).map(([key, item]) => ({ key, ...item })).sort((a, b) => (b.ts || 0) - (a.ts || 0));
                        const myCount = shareableItems(request, viewer).length;
                        const allCount = waitingItems(request).length;
                        const everything = viewer.isAdmin || viewer.isChief;
                        return (
                            <div key={request.id} style={cardStyle}>
                                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                                    <div>
                                        <strong>{request.patientNom || 'Patient'} ({request.patientNode})</strong>
                                        <div style={mutedStyle}>
                                            Demandé par {request.demandeurNom || 'inconnu'}{request.demandeurRole === 'patient' ? ' (le patient)' : ''} le {dayOf(request.creeLe)}
                                            {request.du || request.au ? ` · période du ${request.du || '…'} au ${request.au || '…'}` : ''}
                                        </div>
                                    </div>
                                    <div className="d-flex flex-wrap gap-1">
                                        <Button size="sm" variant="outline-secondary" onClick={() => onOpenPatient && onOpenPatient(request.patientNode)}>
                                            <i className="fas fa-folder-open me-1"></i>Ouvrir le dossier
                                        </Button>
                                        <Button size="sm" variant="primary" disabled={busyId === request.id || myCount === 0} onClick={() => share(request)}
                                            title={everything ? 'Partage tous les rapports en attente de cette demande (administrateur / chef de service).' : 'Partage uniquement vos propres rapports de cette demande.'}>
                                            <i className="fas fa-share-nodes me-1"></i>{everything ? `Tout partager (${myCount})` : `Partager mes rapports (${myCount})`}
                                        </Button>
                                        {canCancelRequest(request, viewer) && (
                                            <Button size="sm" variant="outline-danger" disabled={busyId === request.id} onClick={() => cancel(request)}>Annuler</Button>
                                        )}
                                    </div>
                                </div>
                                {!everything && allCount > myCount && (
                                    <div style={{ ...mutedStyle, marginTop: 4 }}>{allCount - myCount} autre(s) rapport(s) de cette demande sont à partager par leurs médecins.</div>
                                )}
                                <div style={{ marginTop: 6 }}>
                                    {items.map((item) => {
                                        const badge = ITEM_BADGE[item.statut] || ITEM_BADGE[ITEM_STATUS.WAITING];
                                        return (
                                            <div key={item.key} className="d-flex flex-wrap align-items-center gap-2" style={{ borderTop: '1px solid #21262d', padding: '4px 0' }}>
                                                <Badge bg={badge.bg} text={badge.bg === 'warning' ? 'dark' : undefined}>{badge.text}</Badge>
                                                <span style={{ overflowWrap: 'anywhere' }}>{item.titre}</span>
                                                <span style={mutedStyle}>{getFormLabel(item.version)} · {dayOf(item.ts)} · {item.auteur || 'médecin inconnu'}{item.partagePar ? ` · partagé par ${item.partagePar}` : ''}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ReleaseRequestsPanel;
