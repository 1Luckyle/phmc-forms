// src/components/Admin/UserStats.js
//
// Statistiques des rédacteurs (Utilisateurs → Outils) : combien de rapports sont écrits, par qui, quand et de quel type. Une seule lecture de
// savedReports ; tout le reste (période, classement, détail d'une personne) est calculé localement. Une seule couleur d'accent : la longueur
// des barres porte la valeur, le survol donne le chiffre exact.
import React, { useEffect, useMemo, useState } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';
import { getFormDefinition } from '../../formDefinitions';
import './UserStats.css';

const DAY = 24 * 60 * 60 * 1000;
const PERIODS = [
    { key: '7', label: '7 jours', days: 7 },
    { key: '30', label: '30 jours', days: 30 },
    { key: '90', label: '3 mois', days: 90 },
    { key: 'all', label: 'Tout', days: null },
];

const plural = (n, one, many) => `${n.toLocaleString('fr-FR')} ${n > 1 ? many : one}`;
const shortDate = (date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d; };

// Nom lisible d'un nœud : le nom d'auteur le plus fréquent, à défaut le nom du nœud.
const displayNameOf = (node, reports) => {
    const counts = {};
    reports.forEach((report) => { if (report.author) counts[report.author] = (counts[report.author] || 0) + 1; });
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : node.replace(/_/g, ' ');
};

const formNameOf = (version) => getFormDefinition(version)?.name || (version != null ? `Formulaire ${version}` : 'Autre');

// Tranches de temps de l'histogramme : jours (7 / 30 j), semaines (3 mois) ou mois (tout, 24 mois au plus).
const buildBuckets = (period, firstTs) => {
    const today = startOfDay(Date.now());
    const buckets = [];
    if (period.days && period.days <= 30) {
        for (let i = period.days - 1; i >= 0; i -= 1) {
            const start = new Date(today); start.setDate(start.getDate() - i);
            const end = new Date(start); end.setDate(end.getDate() + 1);
            buckets.push({ start: start.getTime(), end: end.getTime(), label: shortDate(start) });
        }
    } else if (period.days) {
        const weeks = Math.ceil(period.days / 7);
        for (let i = weeks - 1; i >= 0; i -= 1) {
            const end = new Date(today); end.setDate(end.getDate() + 1 - i * 7);
            const start = new Date(end); start.setDate(start.getDate() - 7);
            buckets.push({ start: start.getTime(), end: end.getTime(), label: `sem. du ${shortDate(start)}` });
        }
    } else {
        const first = new Date(firstTs || Date.now());
        let cursor = new Date(Math.max(new Date(first.getFullYear(), first.getMonth(), 1).getTime(), new Date(today.getFullYear(), today.getMonth() - 23, 1).getTime()));
        while (cursor <= today) {
            const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
            buckets.push({ start: cursor.getTime(), end: next.getTime(), label: cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) });
            cursor = next;
        }
    }
    return buckets;
};

const Bar = ({ value, max, label, active }) => (
    <div className={`us-hbar${active ? ' active' : ''}`} title={`${label} : ${plural(value, 'rapport', 'rapports')}`}>
        <span style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }}></span>
    </div>
);

const UserStats = () => {
    const [rows, setRows] = useState(null);
    const [error, setError] = useState('');
    const [periodKey, setPeriodKey] = useState('30');
    const [selected, setSelected] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const snap = await get(ref(database, 'savedReports'));
                const raw = snap.exists() ? snap.val() : {};
                const loaded = Object.entries(raw).map(([node, reports]) => {
                    const list = Object.values(reports || {}).filter(Boolean).map((report) => ({
                        ts: Number(report.timestamp) || 0, version: report.bbCodeVersion ?? null, author: report.authorName || '',
                    }));
                    return { node, name: displayNameOf(node, list), reports: list };
                });
                if (!cancelled) setRows(loaded);
            } catch (err) {
                console.error('Statistiques : lecture impossible', err);
                if (!cancelled) setError('Impossible de lire les rapports.');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const period = PERIODS.find((p) => p.key === periodKey);

    const stats = useMemo(() => {
        if (!rows) return null;
        const now = Date.now();
        const since = period.days ? startOfDay(now).getTime() - (period.days - 1) * DAY : 0;
        const prevSince = period.days ? since - period.days * DAY : null;
        const all = rows.flatMap((row) => row.reports.map((report) => ({ ...report, node: row.node })));
        const inPeriod = all.filter((report) => report.ts >= since);
        const previous = prevSince != null ? all.filter((report) => report.ts >= prevSince && report.ts < since).length : null;

        const perNode = rows.map((row) => {
            const mine = row.reports.filter((report) => report.ts >= since);
            const last = row.reports.reduce((max, report) => Math.max(max, report.ts), 0);
            return { node: row.node, name: row.name, total: row.reports.length, count: mine.length, last, reports: row.reports };
        });
        const ranking = perNode.filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        const byForm = {};
        inPeriod.forEach((report) => { const key = formNameOf(report.version); byForm[key] = (byForm[key] || 0) + 1; });
        const forms = Object.entries(byForm).sort((a, b) => b[1] - a[1]);

        const firstTs = all.reduce((min, report) => (report.ts && report.ts < min ? report.ts : min), now);
        const buckets = buildBuckets(period, firstTs).map((bucket) => ({
            ...bucket, count: inPeriod.filter((report) => report.ts >= bucket.start && report.ts < bucket.end).length,
        }));
        const lastTs = all.reduce((max, report) => Math.max(max, report.ts), 0);
        return { total: inPeriod.length, previous, ranking, perNode, forms, buckets, writers: ranking.length, lastTs, allTotal: all.length, everyone: perNode.length };
    }, [rows, period]);

    if (error) return <div className="us-empty">{error}</div>;
    if (!stats) return <div className="us-empty">Chargement des statistiques…</div>;

    const delta = stats.previous != null && stats.previous > 0 ? Math.round(((stats.total - stats.previous) / stats.previous) * 100) : null;
    const maxBucket = Math.max(1, ...stats.buckets.map((bucket) => bucket.count));
    const maxRank = stats.ranking[0]?.count || 1;
    const maxForm = stats.forms[0]?.[1] || 1;
    const top = stats.ranking.slice(0, 10);
    const chosen = selected ? stats.perNode.find((entry) => entry.node === selected) : null;
    const chosenForms = (() => {
        if (!chosen) return [];
        const since = period.days ? startOfDay(Date.now()).getTime() - (period.days - 1) * DAY : 0;
        const counts = {};
        chosen.reports.filter((report) => report.ts >= since).forEach((report) => { const key = formNameOf(report.version); counts[key] = (counts[key] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    })();

    return (
        <section className="us-wrap">
            <header className="us-head">
                <div>
                    <h6 className="us-title"><i className="fas fa-chart-column me-2"></i>Activité des rédacteurs</h6>
                    <p className="us-sub">{plural(stats.allTotal, 'rapport', 'rapports')} enregistré{stats.allTotal > 1 ? 's' : ''} au total, répartis sur {plural(stats.everyone, 'dossier de rédacteur', 'dossiers de rédacteurs')}.</p>
                </div>
                <div className="us-periods" role="group" aria-label="Période">
                    {PERIODS.map((p) => (
                        <button type="button" key={p.key} className={periodKey === p.key ? 'active' : ''} onClick={() => setPeriodKey(p.key)}>{p.label}</button>
                    ))}
                </div>
            </header>

            <div className="us-kpis">
                <div className="us-kpi">
                    <span className="us-kpi-value">{stats.total.toLocaleString('fr-FR')}</span>
                    <span className="us-kpi-label">Rapports{period.days ? ` · ${period.label}` : ''}</span>
                    {delta != null && <span className={`us-kpi-delta ${delta >= 0 ? 'up' : 'down'}`}><i className={`fas fa-arrow-${delta >= 0 ? 'up' : 'down'}`}></i> {Math.abs(delta)} % vs période précédente</span>}
                </div>
                <div className="us-kpi">
                    <span className="us-kpi-value">{stats.writers}<small> / {stats.everyone}</small></span>
                    <span className="us-kpi-label">Rédacteurs actifs</span>
                </div>
                <div className="us-kpi">
                    <span className="us-kpi-value">{stats.writers ? (stats.total / stats.writers).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—'}</span>
                    <span className="us-kpi-label">Rapports par rédacteur actif</span>
                </div>
                <div className="us-kpi">
                    <span className="us-kpi-value us-kpi-small">{stats.lastTs ? new Date(stats.lastTs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                    <span className="us-kpi-label">Dernier rapport enregistré</span>
                </div>
            </div>

            <div className="us-grid">
                <div className="us-card us-card-wide">
                    <div className="us-card-title">Rapports dans le temps</div>
                    {stats.total === 0 ? <div className="us-empty">Aucun rapport sur cette période.</div> : (
                        <>
                            <div className="us-chart" role="img" aria-label={`Rapports dans le temps : ${stats.total} sur la période`}>
                                <span className="us-chart-max">{maxBucket}</span>
                                {stats.buckets.map((bucket) => (
                                    <div key={bucket.start} className="us-col" title={`${bucket.label} : ${plural(bucket.count, 'rapport', 'rapports')}`}>
                                        <span className="us-col-bar" style={{ height: `${bucket.count > 0 ? Math.max(3, (bucket.count / maxBucket) * 100) : 0}%` }}></span>
                                    </div>
                                ))}
                            </div>
                            <div className="us-chart-axis"><span>{stats.buckets[0]?.label}</span><span>{stats.buckets[stats.buckets.length - 1]?.label}</span></div>
                        </>
                    )}
                </div>

                <div className="us-card">
                    <div className="us-card-title">Types de rapports</div>
                    {stats.forms.length === 0 ? <div className="us-empty">—</div> : stats.forms.slice(0, 8).map(([name, count]) => (
                        <div className="us-line" key={name}>
                            <span className="us-line-name" title={name}>{name}</span>
                            <Bar value={count} max={maxForm} label={name} />
                            <span className="us-line-count">{count}</span>
                        </div>
                    ))}
                    {stats.forms.length > 8 && <div className="us-more">+ {stats.forms.length - 8} autre(s) type(s)</div>}
                </div>

                <div className="us-card">
                    <div className="us-card-title">Classement des rédacteurs <small>(cliquez pour le détail)</small></div>
                    {top.length === 0 ? <div className="us-empty">Personne n'a écrit de rapport sur cette période.</div> : top.map((entry, index) => (
                        <button type="button" key={entry.node} className={`us-line us-line-btn${selected === entry.node ? ' active' : ''}`} onClick={() => setSelected(selected === entry.node ? '' : entry.node)}>
                            <span className="us-rank">{index + 1}</span>
                            <span className="us-line-name" title={entry.name}>{entry.name}</span>
                            <Bar value={entry.count} max={maxRank} label={entry.name} active={selected === entry.node} />
                            <span className="us-line-count">{entry.count}</span>
                        </button>
                    ))}
                    {stats.ranking.length > 10 && <div className="us-more">+ {stats.ranking.length - 10} autre(s) rédacteur(s) actif(s)</div>}
                </div>
            </div>

            <div className="us-card us-detail">
                <div className="us-card-title">Détail d'un rédacteur</div>
                <select className="form-select us-select" value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Choisir un rédacteur">
                    <option value="">Choisir un rédacteur…</option>
                    {[...stats.perNode].sort((a, b) => a.name.localeCompare(b.name)).map((entry) => <option key={entry.node} value={entry.node}>{entry.name} ({entry.total})</option>)}
                </select>
                {chosen ? (
                    <div className="us-detail-body">
                        <div className="us-detail-figures">
                            <div><strong>{chosen.count}</strong><span>sur la période</span></div>
                            <div><strong>{chosen.total}</strong><span>au total</span></div>
                            <div><strong>{stats.allTotal ? Math.round((chosen.total / stats.allTotal) * 100) : 0} %</strong><span>de tous les rapports</span></div>
                            <div><strong>{chosen.last ? new Date(chosen.last).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</strong><span>dernier rapport</span></div>
                        </div>
                        {chosenForms.length > 0 && (
                            <div className="us-detail-forms">
                                {chosenForms.map(([name, count]) => (
                                    <div className="us-line" key={name}>
                                        <span className="us-line-name" title={name}>{name}</span>
                                        <Bar value={count} max={chosenForms[0][1]} label={name} />
                                        <span className="us-line-count">{count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : <div className="us-empty">Sélectionnez un rédacteur (liste ou classement) pour voir son volume et ses types de rapports.</div>}
            </div>
        </section>
    );
};

export default UserStats;
