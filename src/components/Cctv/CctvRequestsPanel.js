// src/components/Cctv/CctvRequestsPanel.js
//
// Liste des demandes de vidéosurveillance avec leur fil de réponses.
//   scope="mine" : les demandes de la personne connectée (tout le monde) ; elle peut compléter le fil.
//   scope="all"  : toutes les demandes, pour l'administration du PHMC et les admins : réponse, changement de statut.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import {
    CCTV_STATUSES, CCTV_OPEN_STATUSES, CCTV_FIELD_LABELS, cctvStatusInfo, subscribeToAllCctvRequests, subscribeToMyCctvRequests,
    addCctvReply, setCctvStatus, editCctvRequest, isCctvEditable, isCctvFieldRequired, historyOf, repliesOf,
} from '../../utils/cctvRequests';
import './CctvRequests.css';
import useWriteLock from '../../hooks/useWriteLock';

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (ts) => {
    const d = new Date(ts);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Réponses types proposées à l'administration (elles remplissent le champ, à relire avant d'envoyer).
const QUICK_REPLIES = [
    { label: 'Acceptée', status: 'acceptee', text: "Votre demande est acceptée. Les images vous seront transmises prochainement par l'administration du PHMC." },
    { label: 'Informations manquantes', status: 'en_cours', text: "Nous avons besoin de précisions pour traiter votre demande :\n- " },
    { label: 'Refusée', status: 'refusee', text: "Après examen, nous ne pouvons pas donner suite à votre demande. N'hésitez pas à nous contacter pour plus de détails." },
];

const StatusChip = ({ status }) => {
    const info = cctvStatusInfo(status);
    return <span className="cctv-chip" style={{ '--c': info.color }}><span className="cctv-dot"></span>{info.label}</span>;
};

const RequestCard = ({ request, manage, author, defaultOpen }) => {
    const { locked, lockTitle } = useWriteLock();
    const [open, setOpen] = useState(defaultOpen);
    const [text, setText] = useState('');
    const [nextStatus, setNextStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const replies = repliesOf(request);
    const closed = request.statut === 'cloturee'; // ancien statut : ces dossiers restent en lecture seule
    // Décision rendue (acceptée / refusée) : le demandeur ne peut plus écrire sur cette demande ; l'administration, si.
    const decided = closed || ['acceptee', 'refusee'].includes(request.statut);
    const canWrite = !closed && (manage || !decided);
    const lastReply = replies[replies.length - 1];
    // Modifiée par le demandeur après la dernière action de l'administration : à relire.
    const history = historyOf(request);
    const lastModification = [...history].reverse().find((entry) => entry.type === 'modification');
    const lastStaffAction = Math.max(request.traitePar?.ts || 0, ...replies.filter((reply) => reply.par?.staff).map((reply) => reply.ts || 0));
    const modifiedSinceStaff = !!lastModification && lastModification.ts > lastStaffAction;
    const awaitingYou = manage ? (request.statut === 'nouvelle' || modifiedSinceStaff || (lastReply && !lastReply.par?.staff && CCTV_OPEN_STATUSES.includes(request.statut))) : (lastReply?.par?.staff);
    const canEdit = !manage && isCctvEditable(request);
    const [editing, setEditing] = useState(null);   // { [libellé]: valeur } pendant la modification
    const [showHistory, setShowHistory] = useState(false);

    const startEdit = () => {
        const values = Object.fromEntries((request.champs || []).map((field) => [field.l, field.v]));
        CCTV_FIELD_LABELS.forEach((label) => { if (!(label in values)) values[label] = ''; });
        setEditing(values);
        setError('');
    };
    const saveEdit = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await editCctvRequest({ request, values: editing, authorName: author.name });
            if (!result.changed) setError('Aucune modification à enregistrer.');
            else setEditing(null);
        } catch (err) {
            setError(err.message || "La modification a échoué.");
        } finally {
            setBusy(false);
        }
    };

    const send = async (event) => {
        event.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        setError('');
        try {
            await addCctvReply({
                request, text, staff: manage, status: manage ? nextStatus || undefined : undefined,
                authorName: author.name, authorRole: manage ? author.role : 'Demandeur',
            });
            setText('');
            setNextStatus('');
        } catch (err) {
            setError(err.message || "L'envoi a échoué.");
        } finally {
            setBusy(false);
        }
    };

    const changeStatus = async (status) => {
        setBusy(true);
        setError('');
        try { await setCctvStatus(request, status, author.name); } catch (err) { setError(err.message || 'Changement impossible.'); } finally { setBusy(false); }
    };

    return (
        <div className={`cctv-card ${open ? 'open' : ''}`} style={{ '--c': cctvStatusInfo(request.statut).color }}>
            <button type="button" className="cctv-card-head" onClick={() => setOpen(!open)}>
                <span className="cctv-card-main">
                    <strong>{request.titre}</strong>
                    <small>
                        {manage && <>{request.by?.name || 'Inconnu'} · </>}
                        {request.resume?.agent ? `${request.resume.agent} · ` : ''}{formatDate(request.ts)}
                        {replies.length > 0 && <> · {replies.length} message{replies.length > 1 ? 's' : ''}</>}
                    </small>
                </span>
                {awaitingYou && <span className="cctv-flag">{manage ? (modifiedSinceStaff && request.statut !== 'nouvelle' ? 'Modifiée' : 'À traiter') : 'Nouvelle réponse'}</span>}
                <StatusChip status={request.statut} />
                <i className={`fas fa-chevron-${open ? 'up' : 'down'} cctv-caret`}></i>
            </button>

            {open && (
                <div className="cctv-card-body">
                    {editing ? (
                        <div className="cctv-edit">
                            <p className="cctv-muted">Modifiez votre demande tant qu'elle n'est ni acceptée ni refusée. Les champs modifiés seront signalés à l'administration.</p>
                            {Object.keys(editing).map((label) => {
                                const long = ['Description des événements', 'Notes hors jeu', 'Raison de la demande', 'Emplacement de la vidéosurveillance'].includes(label);
                                return (
                                    <label key={label} className="cctv-edit-field">
                                        <span>{label}{isCctvFieldRequired(label) ? ' *' : ''}</span>
                                        {long ? (
                                            <textarea rows={3} value={editing[label]} disabled={busy} onChange={(e) => setEditing((prev) => ({ ...prev, [label]: e.target.value }))} />
                                        ) : (
                                            <input type="text" value={editing[label]} disabled={busy} onChange={(e) => setEditing((prev) => ({ ...prev, [label]: e.target.value }))} />
                                        )}
                                    </label>
                                );
                            })}
                            <div className="cctv-reply-actions">
                                <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={busy}>Annuler</Button>
                                <Button variant="primary" size="sm" onClick={saveEdit} disabled={busy || locked} title={locked ? lockTitle : undefined}>
                                    {busy ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-floppy-disk me-1"></i>Enregistrer les modifications</>}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <dl className="cctv-fields">
                                {(request.champs || []).map((field, index) => (
                                    <React.Fragment key={`${field.l}-${index}`}>
                                        <dt>{field.l}</dt>
                                        <dd>{String(field.v).includes('\n') || String(field.v).length > 110 ? <pre>{field.v}</pre> : field.v}</dd>
                                    </React.Fragment>
                                ))}
                                {request.traitePar?.name && (<><dt>Traitée par</dt><dd>{request.traitePar.name} · {formatDate(request.traitePar.ts)}</dd></>)}
                            </dl>
                            <div className="cctv-quick" style={{ marginTop: 0 }}>
                                {canEdit && <button type="button" onClick={startEdit} disabled={locked} title={locked ? lockTitle : undefined}><i className="fas fa-pen me-1"></i>Modifier ma demande</button>}
                                <button type="button" onClick={() => setShowHistory((value) => !value)}>
                                    <i className="fas fa-clock-rotate-left me-1"></i>{showHistory ? "Masquer l'historique" : `Historique (${history.length})`}
                                </button>
                                {!manage && !canEdit && <span>Demande traitée : elle ne peut plus être modifiée.</span>}
                            </div>
                            {showHistory && (
                                <ul className="cctv-history">
                                    {history.map((entry) => (
                                        <li key={entry.id}>
                                            <span className="cctv-history-date">{formatDate(entry.ts)}</span>
                                            <span>
                                                {entry.type === 'creation' && <>Demande déposée par <strong>{entry.par?.name}</strong></>}
                                                {entry.type === 'statut' && <><strong>{entry.par?.name || 'Administration'}</strong> : statut « {cctvStatusInfo(entry.statut).label} »</>}
                                                {entry.type === 'modification' && (
                                                    <>
                                                        <strong>{entry.par?.name}</strong> a modifié sa demande
                                                        <ul>
                                                            {(entry.modifs || []).map((modif) => (
                                                                <li key={modif.l}><em>{modif.l}</em> : <del>{modif.avant || '(vide)'}</del> → <ins>{modif.apres || '(vide)'}</ins></li>
                                                            ))}
                                                        </ul>
                                                    </>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}

                    <div className="cctv-thread">
                        <div className="cctv-thread-title"><i className="fas fa-comments"></i> Échanges</div>
                        {replies.length === 0 && <p className="cctv-muted">{manage ? "Aucune réponse pour l'instant." : "Aucune réponse pour l'instant : l'administration du PHMC examine votre demande."}</p>}
                        {replies.map((reply) => (
                            <div key={reply.id} className={`cctv-msg ${reply.par?.staff ? 'staff' : 'asker'}`}>
                                <div className="cctv-msg-head">
                                    <strong>{reply.par?.name || 'Inconnu'}</strong>
                                    <span className="cctv-msg-role">{reply.par?.staff ? (reply.par?.role || 'Administration') : 'Demandeur'}</span>
                                    <span className="cctv-msg-date">{formatDate(reply.ts)}</span>
                                    {reply.statut && <StatusChip status={reply.statut} />}
                                </div>
                                <p>{reply.texte}</p>
                            </div>
                        ))}
                    </div>

                    {manage && !closed && (
                        <div className="cctv-quick">
                            <span>Réponses types :</span>
                            {QUICK_REPLIES.map((quick) => (
                                <button key={quick.label} type="button" onClick={() => { setText(quick.text); setNextStatus(quick.status); }}>{quick.label}</button>
                            ))}
                        </div>
                    )}

                    {canWrite ? (
                        <form className="cctv-reply" onSubmit={send}>
                            <textarea
                                rows={3} value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
                                placeholder={manage ? 'Votre réponse au demandeur…' : "Ajouter un message ou une précision à l'administration…"}
                            />
                            <div className="cctv-reply-actions">
                                {manage && (
                                    <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} disabled={busy} aria-label="Statut après la réponse">
                                        <option value="">Garder le statut « {cctvStatusInfo(request.statut).label} »</option>
                                        {Object.entries(CCTV_STATUSES).filter(([key]) => key !== request.statut && key !== 'nouvelle').map(([key, info]) => (
                                            <option key={key} value={key}>Passer en « {info.label} »</option>
                                        ))}
                                    </select>
                                )}
                                <Button type="submit" variant="primary" size="sm" disabled={busy || !text.trim() || locked} title={locked ? lockTitle : undefined}>
                                    {busy ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-paper-plane me-1"></i>Envoyer</>}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <p className="cctv-muted">
                            <i className="fas fa-lock me-1"></i>
                            {closed ? 'Dossier clôturé.' : `Demande ${request.statut === 'acceptee' ? 'acceptée' : 'refusée'} : vous ne pouvez plus y envoyer de message. Pour une autre demande, utilisez « Nouvelle demande ».`}
                        </p>
                    )}

                    {manage && (
                        <div className="cctv-status-row">
                            <span>Statut sans message :</span>
                            {Object.entries(CCTV_STATUSES).filter(([key]) => key !== 'nouvelle').map(([key, info]) => (
                                <button key={key} type="button" disabled={busy || locked || request.statut === key} style={{ '--c': info.color }} onClick={() => changeStatus(key)}>{info.label}</button>
                            ))}
                        </div>
                    )}
                    {error && <div className="cctv-error">{error}</div>}
                </div>
            )}
        </div>
    );
};

const CctvRequestsPanel = ({ scope = 'mine', onNewRequest }) => {
    const manage = scope === 'all';
    const { locked, lockTitle } = useWriteLock();
    const { staffName, staffProfile, isAdmin, civilianProfile, currentEmployee } = useEmployeeAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState(manage ? 'open' : 'all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        const onData = (list) => { setRequests(list); setLoading(false); };
        const onError = (err) => { setError(err?.message || 'Lecture impossible.'); setLoading(false); };
        return manage ? subscribeToAllCctvRequests(onData, onError) : subscribeToMyCctvRequests(onData, onError);
    }, [manage]);

    const author = {
        name: staffName || civilianProfile?.name || [civilianProfile?.firstName, civilianProfile?.lastName].filter(Boolean).join(' ') || currentEmployee?.email || 'Inconnu',
        role: isAdmin ? 'Administrateur' : (staffProfile?.rank || staffProfile?.category || 'Administration'),
    };

    const counts = useMemo(() => {
        const result = { all: requests.length, open: requests.filter((r) => CCTV_OPEN_STATUSES.includes(r.statut)).length };
        Object.keys(CCTV_STATUSES).forEach((key) => { result[key] = requests.filter((r) => r.statut === key).length; });
        return result;
    }, [requests]);

    const shown = useMemo(() => {
        const needle = normalize(search).trim();
        return requests.filter((request) => {
            if (filter === 'open' && !CCTV_OPEN_STATUSES.includes(request.statut)) return false;
            if (filter !== 'open' && filter !== 'all' && request.statut !== filter) return false;
            if (!needle) return true;
            return normalize(`${request.titre} ${request.by?.name || ''} ${request.by?.discord || ''} ${(request.champs || []).map((f) => f.v).join(' ')}`).includes(needle);
        });
    }, [requests, filter, search]);

    return (
        <div className="cctv-panel">
            <div className="cctv-toolbar">
                <div className="cctv-filters" role="group" aria-label="Statut">
                    {manage && <button type="button" className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>À traiter <span>{counts.open}</span></button>}
                    {Object.entries(CCTV_STATUSES).filter(([key]) => manage || key !== 'nouvelle').map(([key, info]) => (
                        <button key={key} type="button" className={filter === key ? 'on' : ''} style={{ '--c': info.color }} onClick={() => setFilter(key)}>{info.label} <span>{counts[key] || 0}</span></button>
                    ))}
                    <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Toutes <span>{counts.all}</span></button>
                </div>
                <input type="search" className="cctv-search" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
                {onNewRequest && <Button variant="primary" size="sm" onClick={onNewRequest} disabled={locked} title={locked ? lockTitle : undefined}><i className="fas fa-plus me-1"></i>Nouvelle demande</Button>}
            </div>

            {error && <div className="cctv-error">Lecture impossible : {error}</div>}
            {loading && <p className="cctv-muted"><Spinner size="sm" animation="border" className="me-2" />Chargement…</p>}
            {!loading && !error && shown.length === 0 && (
                <p className="cctv-empty">
                    {requests.length === 0
                        ? (manage ? "Aucune demande de vidéosurveillance n'a encore été reçue." : "Vous n'avez envoyé aucune demande de vidéosurveillance.")
                        : 'Aucune demande ne correspond à ce filtre.'}
                </p>
            )}
            <div className="cctv-list">
                {shown.map((request) => <RequestCard key={request.id} request={request} manage={manage} author={author} defaultOpen={shown.length === 1} />)}
            </div>
        </div>
    );
};

export default CctvRequestsPanel;
