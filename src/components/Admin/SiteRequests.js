// src/components/Admin/SiteRequests.js
//
// Demandes envoyées depuis le site (vidéosurveillance, bugs, idées de fonctionnalités, nouveaux formulaires).
// Elles sont enregistrées dans RTDB (siteRequests) : on les lit ici, on les passe « en cours / traitée / refusée »
// et on y laisse une note. Chaque changement de statut laisse une ligne dans le journal d'activité.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { ref, query, orderByChild, limitToLast, onValue, update, remove } from 'firebase/database';
import { database } from '../../firebase';
import { REQUEST_TYPES, REQUEST_STATUSES } from '../../utils/siteRequests';

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (ts) => {
    const d = new Date(ts);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const RequestCard = ({ request, onChange, onDelete }) => {
    const type = REQUEST_TYPES[request.type] || { label: request.type, icon: 'fa-circle-question', color: '#8b949e' };
    const status = REQUEST_STATUSES[request.status] || REQUEST_STATUSES.nouveau;
    const [open, setOpen] = useState(request.status === 'nouveau');
    const [note, setNote] = useState(request.note || '');
    const [busy, setBusy] = useState(false);
    const fields = Array.isArray(request.fields) ? request.fields : [];

    useEffect(() => { setNote(request.note || ''); }, [request.note]);

    const run = async (task) => { setBusy(true); try { await task(); } finally { setBusy(false); } };
    const noteChanged = note.trim() !== (request.note || '');

    return (
        <div className={`adm-req ${open ? 'open' : ''}`} style={{ '--req-color': type.color }}>
            <button type="button" className="adm-req-head" onClick={() => setOpen(!open)}>
                <span className="adm-req-icon"><i className={`fas ${type.icon}`}></i></span>
                <span className="adm-req-main">
                    <strong>{request.title}</strong>
                    <small>{type.label} · {request.by?.name || 'Inconnu'}{request.by?.discord ? ` (${request.by.discord})` : ''} · {formatDate(request.ts)}</small>
                </span>
                <span className="adm-chip" style={{ color: status.color, borderColor: status.color }}>{status.label}</span>
                <i className={`fas fa-chevron-${open ? 'up' : 'down'} adm-req-caret`}></i>
            </button>

            {open && (
                <div className="adm-req-body">
                    <dl className="adm-log-detail">
                        {fields.map((field, index) => (
                            <React.Fragment key={`${field.l}-${index}`}>
                                <dt>{field.l}</dt>
                                <dd>{String(field.v).includes('\n') || String(field.v).length > 120 ? <pre>{field.v}</pre> : field.v}</dd>
                            </React.Fragment>
                        ))}
                        {request.by?.email && (<><dt>Compte</dt><dd>{request.by.email}</dd></>)}
                        {request.handledBy && (<><dt>Dernier traitement</dt><dd>{request.handledBy} · {formatDate(request.handledAt)}</dd></>)}
                    </dl>

                    <div className="form-group">
                        <label htmlFor={`note-${request.id}`}>Note interne (visible des admins seulement)</label>
                        <textarea id={`note-${request.id}`} className="form-control" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Suite donnée, personne contactée…" />
                    </div>

                    <div className="adm-req-actions">
                        {Object.entries(REQUEST_STATUSES).map(([key, info]) => (
                            <Button
                                key={key} size="sm" disabled={busy || (request.status === key && !noteChanged)}
                                variant={request.status === key ? 'secondary' : 'outline-secondary'}
                                onClick={() => run(() => onChange(request, { status: key, note: note.trim() }))}
                            >
                                <span className="adm-log-dot" style={{ background: info.color }}></span> {request.status === key ? (noteChanged ? 'Enregistrer la note' : info.label) : `Marquer « ${info.label} »`}
                            </Button>
                        ))}
                        <Button size="sm" variant="outline-danger" className="ms-auto" disabled={busy} onClick={() => run(() => onDelete(request))} title="Supprimer définitivement cette demande">
                            <i className="fas fa-trash-can"></i>
                        </Button>
                    </div>
                    {busy && <Spinner animation="border" size="sm" />}
                </div>
            )}
        </div>
    );
};

const SiteRequests = ({ currentUser, showNotification, onLogAction }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('active');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const requestsQuery = query(ref(database, 'siteRequests'), orderByChild('ts'), limitToLast(500));
        const unsubscribe = onValue(requestsQuery, (snapshot) => {
            const list = [];
            snapshot.forEach((child) => { list.push({ id: child.key, ...child.val() }); });
            setRequests(list.reverse());
            setLoading(false);
        }, (err) => { setError(err?.message || 'Lecture impossible.'); setLoading(false); });
        return () => unsubscribe();
    }, []);


    const handleChange = async (request, patch) => {
        try {
            await update(ref(database, `siteRequests/${request.id}`), { ...patch, handledBy: currentUser?.email || 'Admin', handledAt: Date.now() });
            if (patch.status !== request.status && onLogAction) {
                onLogAction(`Demande « ${request.title} » : ${REQUEST_STATUSES[patch.status]?.label || patch.status}`, `Type : ${REQUEST_TYPES[request.type]?.label || request.type}\nDemandeur : ${request.by?.name || 'Inconnu'}${patch.note ? `\nNote : ${patch.note}` : ''}`);
            }
            if (showNotification) showNotification('Demande mise à jour.', 'check-circle');
        } catch (err) {
            console.error('Mise à jour de la demande impossible', err);
            if (showNotification) showNotification(`Mise à jour impossible : ${err.message}`, 'error');
        }
    };

    const handleDelete = async (request) => {
        if (!window.confirm(`Supprimer définitivement la demande « ${request.title} » ?`)) return;
        try {
            await remove(ref(database, `siteRequests/${request.id}`));
            if (onLogAction) onLogAction(`Demande supprimée : ${request.title}`, `Type : ${REQUEST_TYPES[request.type]?.label || request.type}\nDemandeur : ${request.by?.name || 'Inconnu'}`);
        } catch (err) {
            if (showNotification) showNotification(`Suppression impossible : ${err.message}`, 'error');
        }
    };

    const counts = useMemo(() => {
        const result = { all: requests.length };
        requests.forEach((request) => { result[request.type] = (result[request.type] || 0) + 1; });
        return result;
    }, [requests]);

    const statusCounts = useMemo(() => {
        const ofType = requests.filter((request) => typeFilter === 'all' || request.type === typeFilter);
        const result = { all: ofType.length, active: ofType.filter((request) => ['nouveau', 'en_cours'].includes(request.status)).length };
        Object.keys(REQUEST_STATUSES).forEach((key) => { result[key] = ofType.filter((request) => request.status === key).length; });
        return result;
    }, [requests, typeFilter]);

    const shown = useMemo(() => {
        const needle = normalize(search).trim();
        return requests.filter((request) => {
            if (typeFilter !== 'all' && request.type !== typeFilter) return false;
            if (statusFilter === 'active' && !['nouveau', 'en_cours'].includes(request.status)) return false;
            if (statusFilter !== 'active' && statusFilter !== 'all' && request.status !== statusFilter) return false;
            if (!needle) return true;
            const haystack = `${request.title} ${request.by?.name || ''} ${request.by?.discord || ''} ${(request.fields || []).map((f) => `${f.l} ${f.v}`).join(' ')}`;
            return normalize(haystack).includes(needle);
        });
    }, [requests, typeFilter, statusFilter, search]);

    return (
        <div className="adm-card">
            <div className="adm-card-head">
                <div>
                    <h4><i className="fas fa-inbox"></i> Demandes du site</h4>
                    <p>Bugs, idées de fonctionnalités et propositions de nouveaux formulaires envoyés par les utilisateurs.</p>
                </div>
            </div>
            <div className="adm-card-body">
                <div className="adm-log-filters">
                    <button type="button" className={`adm-log-chip ${typeFilter === 'all' ? 'on' : ''}`} onClick={() => setTypeFilter('all')}>Tous les types <span className="adm-log-count">{counts.all || 0}</span></button>
                    {Object.entries(REQUEST_TYPES).map(([key, info]) => (
                        <button key={key} type="button" className={`adm-log-chip adm-log-cat ${typeFilter === key ? 'on' : ''}`} style={{ '--chip-color': info.color }} onClick={() => setTypeFilter(key)}>
                            <i className={`fas ${info.icon}`}></i> {info.label} <span className="adm-log-count">{counts[key] || 0}</span>
                        </button>
                    ))}
                </div>
                <div className="adm-log-toolbar">
                    <div className="adm-log-periods" role="group" aria-label="Statut">
                        <button type="button" className={`adm-log-chip ${statusFilter === 'active' ? 'on' : ''}`} onClick={() => setStatusFilter('active')}>À traiter <span className="adm-log-count">{statusCounts.active}</span></button>
                        {Object.entries(REQUEST_STATUSES).map(([key, info]) => (
                            <button key={key} type="button" className={`adm-log-chip ${statusFilter === key ? 'on' : ''}`} onClick={() => setStatusFilter(key)}>{info.label} <span className="adm-log-count">{statusCounts[key] || 0}</span></button>
                        ))}
                        <button type="button" className={`adm-log-chip ${statusFilter === 'all' ? 'on' : ''}`} onClick={() => setStatusFilter('all')}>Toutes <span className="adm-log-count">{statusCounts.all}</span></button>
                    </div>
                    <div className="adm-search adm-log-search">
                        <i className="fas fa-magnifying-glass"></i>
                        <input type="search" placeholder="Rechercher (titre, personne, contenu…)" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>

                {error && <div className="adm-notice">Lecture impossible : {error}. Les règles Firebase (siteRequests) sont-elles déployées ?</div>}
                {loading && <p><Spinner animation="border" size="sm" className="me-2" />Chargement…</p>}
                {!loading && shown.length === 0 && <p className="adm-log-empty">Aucune demande {statusFilter === 'active' ? 'à traiter' : 'ne correspond aux filtres'}.</p>}

                <div className="adm-req-list">
                    {shown.map((request) => (
                        <RequestCard key={request.id} request={request} onChange={handleChange} onDelete={handleDelete} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SiteRequests;
