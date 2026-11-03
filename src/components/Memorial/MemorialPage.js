// src/components/Memorial/MemorialPage.js
//
// Page publique « Hommage » (#/hommage), sans connexion : les Rapports Publics de Décès publiés par le DMEC, dans un cadre apaisé, comme un lieu de
// recueillement plutôt qu'un registre. Les textes viennent de hommages/{clé} (lecture publique), copie du rapport posée à sa publication (voir
// utils/deathReports.js) et retirée à sa dépublication.
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';
import { ReportPreviewFrame } from '../ReportExpansion';
import './Memorial.css';

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MemorialPage = () => {
    const [items, setItems] = useState(null);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [openKey, setOpenKey] = useState('');

    useEffect(() => {
        let cancelled = false;
        get(ref(database, 'hommages'))
            .then((snap) => {
                if (cancelled) return;
                const list = snap.exists() ? Object.entries(snap.val()).map(([key, value]) => ({ key, ...value })) : [];
                setItems(list.sort((a, b) => (b.publieLe || 0) - (a.publieLe || 0)));
            })
            .catch((err) => { console.error('Hommage : lecture impossible', err); if (!cancelled) { setItems([]); setError("Cette page n'est pas disponible pour le moment."); } });
        return () => { cancelled = true; };
    }, []);

    const shown = useMemo(() => {
        const needle = normalize(query).trim();
        return (items || []).filter((item) => !needle || normalize(`${item.titre} ${item.bbCode}`).includes(needle));
    }, [items, query]);

    return (
        <div className="mem-page">
            <div className="mem-wrap">
                <Link to="/" className="mem-back"><i className="fas fa-arrow-left me-2"></i>Retour au site</Link>

                <header className="mem-head">
                    <span className="mem-candle" aria-hidden="true"><span className="mem-flame"></span><span className="mem-wax"></span></span>
                    <h1>Hommage</h1>
                    <p className="mem-intro">
                        Un moment de recueillement pour celles et ceux qui nous ont quittés. Le Pillbox Hill Medical Center publie ici, avec le plus grand respect,
                        les rapports publics de décès établis par son service de médecine légale.
                    </p>
                    <div className="mem-rule" aria-hidden="true"><span></span></div>
                </header>

                {error && <p className="mem-note">{error}</p>}
                {items === null && !error && <p className="mem-note">Chargement…</p>}
                {items && items.length > 0 && (
                    <div className="mem-search">
                        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chercher un nom…" aria-label="Chercher un nom" />
                    </div>
                )}
                {items && items.length === 0 && !error && <p className="mem-note">Aucun rapport n'est publié pour le moment.</p>}
                {items && items.length > 0 && shown.length === 0 && <p className="mem-note">Aucun nom ne correspond à votre recherche.</p>}

                <ul className="mem-list">
                    {shown.map((item) => {
                        const open = openKey === item.key;
                        return (
                            <li key={item.key} className={`mem-card${open ? ' open' : ''}`}>
                                <button type="button" className="mem-card-head" onClick={() => setOpenKey(open ? '' : item.key)} aria-expanded={open}>
                                    <span className="mem-card-flame" aria-hidden="true"></span>
                                    <span className="mem-card-title">{item.titre || 'Rapport public de décès'}</span>
                                    <span className="mem-card-date">{formatDate(item.publieLe)}</span>
                                    <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} aria-hidden="true"></i>
                                </button>
                                {open && (
                                    <div className="mem-card-body">
                                        {item.bbCode
                                            ? <ReportPreviewFrame bbCode={item.bbCode} title={item.titre || 'Rapport public de décès'} height={420} />
                                            : <p className="mem-note">Le texte de ce rapport n'est pas encore disponible.</p>}
                                        {item.par && <p className="mem-sign">Rapport établi par {item.par}</p>}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>

                <footer className="mem-foot">
                    <p>« On ne meurt vraiment que lorsqu'on est oublié. »</p>
                </footer>
            </div>
        </div>
    );
};

export default MemorialPage;
