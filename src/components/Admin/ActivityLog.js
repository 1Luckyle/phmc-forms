// src/components/Admin/ActivityLog.js
//
// Journal d'activité du site (RTDB : activityLogs) : retrace ce qui a été fait, par qui et quand — connexions,
// rapports, candidatures, paiements, actions d'admin, demandes, erreurs… Filtres par catégorie, gravité,
// période et texte ; tri ; temps réel ; export CSV/JSON ; purge des vieilles lignes.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { ref, query, orderByChild, startAt, endAt, limitToLast, onValue, get, update } from 'firebase/database';
import { database } from '../../firebase';
import { ACTIVITY_CATEGORIES, ACTIVITY_SEVERITIES, categoryInfo } from '../../constants/activityCategories';
import WebhookLogs from './WebhookLogs';

const PERIODS = [
    { key: '1h', label: '1 h', ms: 3600000 },
    { key: '24h', label: '24 h', ms: 86400000 },
    { key: '7d', label: '7 jours', ms: 7 * 86400000 },
    { key: '30d', label: '30 jours', ms: 30 * 86400000 },
    { key: 'all', label: 'Tout', ms: null },
    { key: 'custom', label: 'Période…', ms: null },
];
const PAGE_SIZES = [25, 50, 100, 200];
const FETCH_STEP = 1000;

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (ts) => {
    const d = new Date(ts);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ⏎ ')}"`;

const download = (name, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const ActivityLog = ({
    showNotification, onLogAction, initialCategories = [], initialPeriod = '7d',
    title = "Journal d'activité", icon = 'fa-clock-rotate-left',
    subtitle = 'Tout ce qui se passe sur le site : qui a fait quoi, et quand. Les nouvelles lignes arrivent en direct.',
}) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [live, setLive] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [fetchLimit, setFetchLimit] = useState(FETCH_STEP);

    const [period, setPeriod] = useState(initialPeriod);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [activeCategories, setActiveCategories] = useState(initialCategories);
    const [activeSeverities, setActiveSeverities] = useState([]);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState({ key: 'ts', dir: 'desc' });
    const [pageSize, setPageSize] = useState(50);
    const [page, setPage] = useState(0);
    const [openId, setOpenId] = useState(null);
    const [showArchive, setShowArchive] = useState(false);
    const [purging, setPurging] = useState(false);

    // Bornes de la requête (la période) ; les autres filtres s'appliquent côté navigateur sur ce qui est chargé.
    const bounds = useMemo(() => {
        if (period === 'custom') {
            const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
            const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
            return { from, to };
        }
        const preset = PERIODS.find((p) => p.key === period);
        return { from: preset?.ms ? Date.now() - preset.ms : null, to: null };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period, fromDate, toDate, refreshKey]);

    useEffect(() => {
        setLoading(true);
        setError('');
        const constraints = [orderByChild('ts')];
        if (bounds.from != null) constraints.push(startAt(bounds.from));
        if (bounds.to != null) constraints.push(endAt(bounds.to));
        constraints.push(limitToLast(fetchLimit));
        const logsQuery = query(ref(database, 'activityLogs'), ...constraints);

        const toList = (snapshot) => {
            const list = [];
            snapshot.forEach((child) => { list.push({ id: child.key, ...child.val() }); });
            return list;
        };
        const onError = (err) => {
            console.error('Journal d\'activité : lecture impossible', err);
            setError(err?.message || 'Lecture impossible.');
            setLoading(false);
        };

        if (live) {
            const unsubscribe = onValue(logsQuery, (snapshot) => { setEntries(toList(snapshot)); setLoading(false); }, onError);
            return () => unsubscribe();
        }
        get(logsQuery).then((snapshot) => { setEntries(toList(snapshot)); setLoading(false); }).catch(onError);
        return undefined;
    }, [bounds, fetchLimit, live, refreshKey]);

    useEffect(() => { setPage(0); }, [activeCategories, activeSeverities, search, period, fromDate, toDate, sort, pageSize]);

    const toggle = (list, setList, value) => setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

    const categoryCounts = useMemo(() => {
        const counts = {};
        entries.forEach((entry) => { counts[entry.cat] = (counts[entry.cat] || 0) + 1; });
        return counts;
    }, [entries]);

    const filtered = useMemo(() => {
        const needle = normalize(search).trim();
        const list = entries.filter((entry) => {
            if (activeCategories.length && !activeCategories.includes(entry.cat)) return false;
            if (activeSeverities.length && !activeSeverities.includes(entry.sev)) return false;
            if (!needle) return true;
            return normalize(`${entry.msg} ${entry.det || ''} ${entry.by?.name || ''} ${entry.by?.email || ''} ${entry.by?.role || ''} ${entry.tgt || ''} ${entry.act || ''}`).includes(needle);
        });
        const direction = sort.dir === 'asc' ? 1 : -1;
        const keyOf = {
            ts: (e) => e.ts || 0,
            cat: (e) => categoryInfo(e.cat).label,
            sev: (e) => ['info', 'success', 'warning', 'error'].indexOf(e.sev),
            by: (e) => normalize(e.by?.name),
            msg: (e) => normalize(e.msg),
        }[sort.key] || ((e) => e.ts || 0);
        return list.sort((a, b) => {
            const left = keyOf(a);
            const right = keyOf(b);
            if (left < right) return -1 * direction;
            if (left > right) return 1 * direction;
            return ((a.ts || 0) - (b.ts || 0)) * -1;
        });
    }, [entries, activeCategories, activeSeverities, search, sort]);

    const stats = useMemo(() => {
        const actors = new Set(filtered.map((e) => e.by?.uid || e.by?.name));
        return {
            total: filtered.length,
            errors: filtered.filter((e) => e.sev === 'error').length,
            warnings: filtered.filter((e) => e.sev === 'warning').length,
            actors: actors.size,
        };
    }, [filtered]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);
    const mayHaveMore = entries.length >= fetchLimit;

    const setSortKey = (key) => setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'ts' ? 'desc' : 'asc' }));
    const sortMark = (key) => (sort.key === key ? <i className={`fas fa-caret-${sort.dir === 'asc' ? 'up' : 'down'} ms-1`}></i> : null);

    const resetFilters = () => { setActiveCategories([]); setActiveSeverities([]); setSearch(''); };
    const hasFilters = activeCategories.length > 0 || activeSeverities.length > 0 || search.trim() !== '';

    const exportCsv = () => {
        const header = ['Date', 'Catégorie', 'Gravité', 'Acteur', 'Rôle', 'E-mail', 'Action', 'Résumé', 'Cible', 'Détails', 'Source', 'Environnement', 'Identifiant'];
        const lines = filtered.map((e) => [
            new Date(e.ts).toISOString(), categoryInfo(e.cat).label, ACTIVITY_SEVERITIES[e.sev]?.label || e.sev, e.by?.name, e.by?.role, e.by?.email,
            e.act, e.msg, e.tgt, e.det, e.src, e.env, e.id,
        ].map(csvCell).join(';'));
        download(`journal-activite-${new Date().toISOString().slice(0, 10)}.csv`, `﻿${[header.map(csvCell).join(';'), ...lines].join('\r\n')}`, 'text/csv;charset=utf-8');
    };
    const exportJson = () => download(`journal-activite-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(filtered, null, 2), 'application/json');

    const purgeOlderThan = async (days) => {
        if (!window.confirm(`Supprimer définitivement les lignes du journal de plus de ${days} jours ? Cette action est irréversible.`)) return;
        setPurging(true);
        try {
            const cutoff = Date.now() - days * 86400000;
            const snapshot = await get(query(ref(database, 'activityLogs'), orderByChild('ts'), endAt(cutoff)));
            const updates = {};
            snapshot.forEach((child) => { updates[child.key] = null; });
            const keys = Object.keys(updates);
            for (let i = 0; i < keys.length; i += 400) {
                const batch = {};
                keys.slice(i, i + 400).forEach((key) => { batch[key] = null; });
                // eslint-disable-next-line no-await-in-loop
                await update(ref(database, 'activityLogs'), batch);
            }
            if (showNotification) showNotification(`${keys.length} ligne(s) supprimée(s) du journal.`, 'check-circle');
            if (onLogAction) onLogAction('Purge du journal d\'activité', `Lignes de plus de ${days} jours supprimées : ${keys.length}`);
            setRefreshKey((k) => k + 1);
        } catch (err) {
            console.error('Purge impossible', err);
            if (showNotification) showNotification(`Purge impossible : ${err.message}`, 'error');
        } finally {
            setPurging(false);
        }
    };

    return (
        <div className="adm-card">
            <div className="adm-card-head">
                <div>
                    <h4><i className={`fas ${icon}`}></i> {title}</h4>
                    <p>{subtitle}</p>
                </div>
                <div className="adm-card-actions adm-log-head-actions">
                    <div className="form-check form-switch m-0">
                        <input className="form-check-input" type="checkbox" role="switch" id="adm-log-live" checked={live} onChange={(e) => setLive(e.target.checked)} />
                        <label className="form-check-label" htmlFor="adm-log-live">Temps réel</label>
                    </div>
                    <Button size="sm" variant="outline-secondary" onClick={() => setRefreshKey((k) => k + 1)} title="Recharger le journal">
                        <i className="fas fa-rotate"></i>
                    </Button>
                </div>
            </div>

            <div className="adm-card-body">
                <div className="adm-log-stats">
                    <div><strong>{stats.total}</strong><span>événement{stats.total > 1 ? 's' : ''}</span></div>
                    <div className={stats.errors ? 'adm-log-stat-error' : ''}><strong>{stats.errors}</strong><span>erreur{stats.errors > 1 ? 's' : ''}</span></div>
                    <div className={stats.warnings ? 'adm-log-stat-warn' : ''}><strong>{stats.warnings}</strong><span>avertissement{stats.warnings > 1 ? 's' : ''}</span></div>
                    <div><strong>{stats.actors}</strong><span>personne{stats.actors > 1 ? 's' : ''}</span></div>
                </div>

                <div className="adm-log-toolbar">
                    <div className="adm-log-periods" role="group" aria-label="Période">
                        {PERIODS.map((p) => (
                            <button key={p.key} type="button" className={`adm-log-chip ${period === p.key ? 'on' : ''}`} onClick={() => setPeriod(p.key)}>{p.label}</button>
                        ))}
                    </div>
                    {period === 'custom' && (
                        <div className="adm-log-dates">
                            <input type="date" className="form-control form-control-sm" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} aria-label="Du" />
                            <span>→</span>
                            <input type="date" className="form-control form-control-sm" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} aria-label="Au" />
                        </div>
                    )}
                    <div className="adm-search adm-log-search">
                        <i className="fas fa-magnifying-glass"></i>
                        <input type="search" placeholder="Rechercher (personne, action, détail, cible…)" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>

                <div className="adm-log-filters">
                    {Object.entries(ACTIVITY_CATEGORIES).map(([key, info]) => (
                        <button
                            key={key} type="button" disabled={!categoryCounts[key] && !activeCategories.includes(key)}
                            className={`adm-log-chip adm-log-cat ${activeCategories.includes(key) ? 'on' : ''}`} style={{ '--chip-color': info.color }}
                            onClick={() => toggle(activeCategories, setActiveCategories, key)}
                        >
                            <i className={`fas ${info.icon}`}></i> {info.label} <span className="adm-log-count">{categoryCounts[key] || 0}</span>
                        </button>
                    ))}
                </div>
                <div className="adm-log-filters">
                    {Object.entries(ACTIVITY_SEVERITIES).map(([key, info]) => (
                        <button
                            key={key} type="button" className={`adm-log-chip ${activeSeverities.includes(key) ? 'on' : ''}`} style={{ '--chip-color': info.color }}
                            onClick={() => toggle(activeSeverities, setActiveSeverities, key)}
                        >
                            <span className="adm-log-dot" style={{ background: info.color }}></span> {info.label}
                        </button>
                    ))}
                    {hasFilters && <button type="button" className="adm-log-reset" onClick={resetFilters}><i className="fas fa-xmark me-1"></i>Effacer les filtres</button>}
                </div>

                {error && <div className="adm-notice">Lecture impossible : {error}. Les règles Firebase (activityLogs) sont-elles déployées ?</div>}

                <div className="adm-log-table-wrap">
                    <table className="table table-hover table-sm adm-log-table">
                        <thead>
                            <tr>
                                <th className="sortable" onClick={() => setSortKey('ts')}>Date{sortMark('ts')}</th>
                                <th className="sortable" onClick={() => setSortKey('cat')}>Catégorie{sortMark('cat')}</th>
                                <th className="sortable" onClick={() => setSortKey('sev')} title="Gravité">●{sortMark('sev')}</th>
                                <th className="sortable" onClick={() => setSortKey('by')}>Acteur{sortMark('by')}</th>
                                <th className="sortable" onClick={() => setSortKey('msg')}>Événement{sortMark('msg')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={5} className="adm-log-empty"><Spinner animation="border" size="sm" className="me-2" />Chargement…</td></tr>
                            )}
                            {!loading && visible.length === 0 && (
                                <tr><td colSpan={5} className="adm-log-empty">{entries.length === 0 ? 'Aucune activité enregistrée sur cette période.' : 'Aucun événement ne correspond aux filtres.'}</td></tr>
                            )}
                            {visible.map((entry) => {
                                const info = categoryInfo(entry.cat);
                                const sev = ACTIVITY_SEVERITIES[entry.sev] || ACTIVITY_SEVERITIES.info;
                                const open = openId === entry.id;
                                return (
                                    <React.Fragment key={entry.id}>
                                        <tr className={`adm-log-row ${open ? 'open' : ''}`} onClick={() => setOpenId(open ? null : entry.id)}>
                                            <td className="adm-log-date">{formatDate(entry.ts)}</td>
                                            <td><span className="adm-log-tag" style={{ '--chip-color': info.color }}><i className={`fas ${info.icon}`}></i> {info.label}</span></td>
                                            <td><span className="adm-log-dot" style={{ background: sev.color }} title={sev.label}></span></td>
                                            <td className="adm-log-actor">
                                                <strong>{entry.by?.name || (entry.src === 'server' ? 'Serveur' : 'Inconnu')}</strong>
                                                {entry.by?.role && <small>{entry.by.role}</small>}
                                            </td>
                                            <td className="adm-log-msg">{entry.msg}</td>
                                        </tr>
                                        {open && (
                                            <tr className="adm-log-detail-row">
                                                <td colSpan={5}>
                                                    <dl className="adm-log-detail">
                                                        <dt>Action</dt><dd><code>{entry.act}</code></dd>
                                                        {entry.tgt && (<><dt>Cible</dt><dd>{entry.tgt}</dd></>)}
                                                        {entry.by?.email && (<><dt>E-mail</dt><dd>{entry.by.email}</dd></>)}
                                                        <dt>Origine</dt><dd>{entry.src === 'server' ? 'Serveur (Cloud Function)' : `Site (${entry.env || 'inconnu'})`}</dd>
                                                        <dt>Gravité</dt><dd>{sev.label}</dd>
                                                        <dt>Identifiant</dt><dd><code>{entry.id}</code></dd>
                                                        {entry.det && (<><dt>Détails</dt><dd><pre>{entry.det}</pre></dd></>)}
                                                    </dl>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="adm-log-pager">
                    <div className="adm-log-pager-left">
                        <select className="form-select form-select-sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Lignes par page">
                            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} par page</option>)}
                        </select>
                        <span>{filtered.length === 0 ? '0' : `${page * pageSize + 1}–${Math.min(filtered.length, (page + 1) * pageSize)}`} sur {filtered.length}</span>
                    </div>
                    <div className="adm-log-pager-right">
                        <Button size="sm" variant="outline-secondary" disabled={page === 0} onClick={() => setPage(0)}><i className="fas fa-angles-left"></i></Button>
                        <Button size="sm" variant="outline-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><i className="fas fa-angle-left"></i></Button>
                        <span className="adm-log-page">Page {page + 1} / {pageCount}</span>
                        <Button size="sm" variant="outline-secondary" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}><i className="fas fa-angle-right"></i></Button>
                        <Button size="sm" variant="outline-secondary" disabled={page >= pageCount - 1} onClick={() => setPage(pageCount - 1)}><i className="fas fa-angles-right"></i></Button>
                    </div>
                </div>

                {mayHaveMore && (
                    <div className="adm-log-more">
                        {entries.length} lignes chargées (les plus récentes de la période).{' '}
                        <button type="button" className="btn btn-link btn-sm" onClick={() => setFetchLimit((n) => n + FETCH_STEP)}>Charger {FETCH_STEP} lignes de plus ancien</button>
                    </div>
                )}

                <div className="adm-actions-grid">
                    <div className="adm-fieldset">
                        <div className="adm-fieldset-title">Export</div>
                        <div className="adm-button-stack">
                            <Button variant="outline-secondary" size="sm" onClick={exportCsv} disabled={filtered.length === 0}><i className="fas fa-file-csv"></i> CSV ({filtered.length} ligne{filtered.length > 1 ? 's' : ''} filtrée{filtered.length > 1 ? 's' : ''})</Button>
                            <Button variant="outline-secondary" size="sm" onClick={exportJson} disabled={filtered.length === 0}><i className="fas fa-file-code"></i> JSON</Button>
                        </div>
                    </div>
                    <div className="adm-fieldset adm-fieldset-danger">
                        <div className="adm-fieldset-title">Nettoyage</div>
                        <div className="adm-button-stack">
                            <Button variant="outline-danger" size="sm" disabled={purging} onClick={() => purgeOlderThan(90)}>{purging ? <Spinner size="sm" animation="border" /> : <i className="fas fa-broom"></i>} Supprimer les lignes de plus de 90 jours</Button>
                            <Button variant="outline-danger" size="sm" disabled={purging} onClick={() => purgeOlderThan(365)}><i className="fas fa-broom"></i> Supprimer les lignes de plus d'un an</Button>
                        </div>
                    </div>
                </div>

                <div className="adm-log-archive">
                    <button type="button" className="btn btn-link btn-sm" onClick={() => setShowArchive((v) => !v)}>
                        <i className={`fas fa-chevron-${showArchive ? 'down' : 'right'} me-1`}></i>Archive : ancien journal des webhooks Discord
                    </button>
                    {showArchive && <WebhookLogs refreshTrigger={refreshKey} />}
                </div>
            </div>
        </div>
    );
};

export default ActivityLog;
