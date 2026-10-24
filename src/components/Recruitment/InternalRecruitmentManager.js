// src/components/Recruitment/InternalRecruitmentManager.js
//
// Onglet « Évolutions internes » de la gestion du recrutement : les demandes de statut de recrutement interne des
// employés. Accepter pose le statut (l'employé peut de nouveau candidater) ; refuser garde une note visible de la personne ;
// le statut peut aussi être retiré à la main. Il se retire seul quand une candidature acceptée est suivie d'un contrat signé.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { sendEyefindMail } from '../../utils/eyefindMail';
import { sendAdminActionWebhook } from '../Admin/adminUtils';
import {
    INTERNAL_REQUEST_STATUS, loadInternalRequests, acceptInternalRequest, refuseInternalRequest, revokeInternalStatus,
} from '../../utils/internalRecruitment';

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (ts) => { const d = new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const cardStyle = (color) => ({ background: '#161b22', border: '1px solid #30363d', borderLeft: `4px solid ${color}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '10px' });
const chipStyle = (color) => ({ display: 'inline-block', padding: '1px 10px', fontSize: '0.78rem', fontWeight: 600, color: '#fff', border: `1px solid ${color}`, borderRadius: '12px', background: `${color}33` });
const chipButton = (active) => ({ padding: '3px 12px', fontSize: '0.85rem', color: '#e6edf3', background: active ? '#1f6feb' : '#21262d', border: `1px solid ${active ? '#58a6ff' : '#484f58'}`, borderRadius: '999px', cursor: 'pointer' });

// Adresse du compte d'un employé (pour le prévenir par mail, sans bloquer si elle manque).
const staffEmailOf = async (uid) => {
    try {
        for (const list of ['phmc', 'coroner']) {
            // eslint-disable-next-line no-await-in-loop
            const snap = await get(ref(database, `staff/${list}`));
            const member = Object.values(snap.val() || {}).find((entry) => entry && entry.uid === uid);
            if (member?.email) return member.email;
        }
    } catch (error) { /* mail facultatif */ }
    return null;
};

const InternalRecruitmentManager = ({ showNotification, onCountChange }) => {
    const { currentEmployee, isAdmin, staffName } = useEmployeeAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('en_attente');
    const [notes, setNotes] = useState({});
    const [busyUid, setBusyUid] = useState(null);

    const actorName = staffName || currentEmployee?.email || 'Le recrutement';
    const actorLabel = isAdmin ? 'Admin' : 'Recruteur';

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const list = await loadInternalRequests();
            setRequests(list);
            if (onCountChange) onCountChange(list.filter((r) => r.statut === 'en_attente').length);
        } catch (error) {
            console.error('Demandes de recrutement interne illisibles :', error);
            if (showNotification) showNotification(`Lecture impossible : ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [onCountChange, showNotification]);

    useEffect(() => { reload(); }, [reload]);

    const counts = useMemo(() => {
        const result = { all: requests.length };
        Object.keys(INTERNAL_REQUEST_STATUS).forEach((key) => { result[key] = requests.filter((r) => r.statut === key).length; });
        return result;
    }, [requests]);
    const shown = requests.filter((request) => filter === 'all' || request.statut === filter);

    const notify = async (request, subject, text) => {
        const to = await staffEmailOf(request.uid);
        if (!to) return;
        sendEyefindMail({
            to, subject,
            body: `Bonjour ${request.nom},\n\n${text}\n\nCordialement,\nPillbox Hill Medical Center`,
            html: `<p>Bonjour ${request.nom},</p><p>${text.replace(/\n/g, '<br>')}</p><p>Cordialement,<br>Pillbox Hill Medical Center</p>`,
        }).catch(() => {});
    };

    const act = async (request, task, success) => {
        setBusyUid(request.uid);
        try {
            await task();
            if (showNotification) showNotification(success, 'check-circle');
            await reload();
        } catch (error) {
            console.error('Action impossible :', error);
            if (showNotification) showNotification(`Action impossible : ${error.message}`, 'error');
        } finally {
            setBusyUid(null);
        }
    };

    const accept = (request) => act(request, async () => {
        await acceptInternalRequest(request, { byUid: currentEmployee?.uid, byName: actorName, note: notes[request.uid] });
        sendAdminActionWebhook(currentEmployee?.email, 'Statut de recrutement interne accordé', `Membre : ${request.nom}`, null, actorLabel);
        notify(request, 'Statut de recrutement interne accordé - PHMC', 'Votre demande de recrutement interne est acceptée : vous pouvez de nouveau candidater aux offres depuis les formulaires de candidature.');
    }, 'Statut accordé : l\'employé peut candidater.');

    const refuse = (request) => act(request, async () => {
        await refuseInternalRequest(request, { byName: actorName, note: notes[request.uid] });
        sendAdminActionWebhook(currentEmployee?.email, 'Demande de recrutement interne refusée', `Membre : ${request.nom}`, null, actorLabel);
        notify(request, 'Votre demande de recrutement interne - PHMC', `Votre demande de recrutement interne n'a pas été retenue.${notes[request.uid] ? `\nMotif : ${notes[request.uid]}` : ''}`);
    }, 'Demande refusée.');

    const revoke = (request) => {
        if (!window.confirm(`Retirer le statut de recrutement interne à ${request.nom} ? Il ne pourra plus candidater.`)) return;
        act(request, async () => {
            await revokeInternalStatus(request, { byName: actorName });
            sendAdminActionWebhook(currentEmployee?.email, 'Statut de recrutement interne retiré', `Membre : ${request.nom}`, null, actorLabel);
        }, 'Statut retiré.');
    };

    return (
        <div style={{ color: '#e6edf3' }}>
            <p style={{ color: '#b1bac4' }}>
                Les employés ne peuvent pas candidater. Ils demandent ici un <strong>statut de recrutement interne</strong> ; accepté, il rouvre leurs candidatures
                jusqu'à ce qu'une de leurs candidatures soit acceptée et leur contrat signé.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {[['en_attente', 'En attente'], ['acceptee', 'Acceptées'], ['refusee', 'Refusées'], ['terminee', 'Terminées'], ['all', 'Toutes']].map(([key, label]) => (
                    <button key={key} type="button" style={chipButton(filter === key)} onClick={() => setFilter(key)}>{label} ({counts[key] || 0})</button>
                ))}
                <Button size="sm" variant="outline-secondary" onClick={reload} title="Recharger"><i className="fas fa-rotate"></i></Button>
            </div>

            {loading && <p><Spinner animation="border" size="sm" className="me-2" />Chargement…</p>}
            {!loading && shown.length === 0 && <p style={{ color: '#b1bac4', textAlign: 'center', padding: '20px' }}>Aucune demande dans cette catégorie.</p>}

            {shown.map((request) => {
                const status = INTERNAL_REQUEST_STATUS[request.statut] || INTERNAL_REQUEST_STATUS.en_attente;
                const busy = busyUid === request.uid;
                return (
                    <div key={request.uid} style={cardStyle(status.color)}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                            <strong style={{ color: '#f0f6fc', fontSize: '1.05rem' }}>{request.nom || 'Inconnu'}</strong>
                            {request.role && <span style={{ color: '#b1bac4' }}>{request.role}{request.badge ? ` · ${request.badge}` : ''}</span>}
                            <span style={chipStyle(status.color)}>{status.label}{request.actif && request.statut === 'acceptee' ? ' · statut actif' : ''}</span>
                            <span style={{ marginLeft: 'auto', color: '#b1bac4', fontSize: '0.85rem' }}>Demandé le {formatDate(request.creeLe)}</span>
                        </div>
                        {request.motif && <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', color: '#e6edf3' }}>{request.motif}</p>}
                        {request.traiteParNom && request.statut !== 'en_attente' && (
                            <p style={{ margin: '6px 0 0', color: '#b1bac4', fontSize: '0.85rem' }}>
                                Traité par {request.traiteParNom}{request.traiteLe ? ` le ${formatDate(request.traiteLe)}` : ''}{request.noteRecruteur ? ` — « ${request.noteRecruteur} »` : ''}
                            </p>
                        )}

                        {request.statut === 'en_attente' && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
                                <input
                                    type="text" placeholder="Note ou motif (visible de l'employé)" value={notes[request.uid] || ''}
                                    onChange={(e) => setNotes((current) => ({ ...current, [request.uid]: e.target.value }))}
                                    style={{ flex: '1 1 260px', padding: '5px 10px', color: '#e6edf3', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px' }}
                                />
                                <Button size="sm" variant="success" disabled={busy} onClick={() => accept(request)}><i className="fas fa-check me-1"></i>Accepter</Button>
                                <Button size="sm" variant="danger" disabled={busy} onClick={() => refuse(request)}><i className="fas fa-xmark me-1"></i>Refuser</Button>
                            </div>
                        )}
                        {request.statut === 'acceptee' && request.actif && (
                            <div style={{ marginTop: '10px' }}>
                                <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => revoke(request)}><i className="fas fa-ban me-1"></i>Retirer le statut</Button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default InternalRecruitmentManager;
