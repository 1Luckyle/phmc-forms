// src/components/Directory/HospitalPlan.js
//
// Plan du PHMC, étage par étage : chaque étage se développe pour montrer ses services, ses pièces et leur niveau d'accès (libre, sur consultation, zone
// sécurisée, réservé au personnel). Une recherche (« où trouver… ») et la légende filtrent les pièces. Aucune donnée en base ni connexion requise :
// utilisé dans l'onglet « Plan de l'hôpital » de la Boîte à outils et sur la page publique #/plan.
import React, { useMemo, useState } from 'react';
import { ACCESS_LEVELS, HOSPITAL_FLOORS } from '../../constants/hospitalPlan';
import './HospitalPlan.css';

const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const AccessBadge = ({ level }) => {
    const info = ACCESS_LEVELS[level];
    if (!info) return null;
    return <span className="hp-badge" style={{ '--c': info.color }} title={info.help}><i className={`fas ${info.icon}`}></i>{info.short}</span>;
};

const HospitalPlan = () => {
    const [query, setQuery] = useState('');
    const [level, setLevel] = useState('all');
    const [opened, setOpened] = useState(() => new Set(HOSPITAL_FLOORS.filter((floor) => floor.entree).map((floor) => floor.code)));

    const needle = normalize(query).trim();
    const filtering = needle !== '' || level !== 'all';

    // Étages filtrés : seules les pièces qui correspondent à la recherche et au niveau d'accès restent (un service dont le nom correspond garde toutes ses pièces).
    const floors = useMemo(() => HOSPITAL_FLOORS.map((floor) => {
        const floorMatches = needle !== '' && normalize(`${floor.titre} ${floor.niveau}`).includes(needle);
        const sections = floor.sections.map((section) => {
            const sectionMatches = floorMatches || (needle !== '' && normalize(section.titre).includes(needle));
            const zones = section.zones.filter((zone) => {
                const textMatches = needle === '' || sectionMatches
                    || normalize(`${zone.nom} ${zone.note || ''} ${(zone.sous || []).map((child) => child.nom).join(' ')}`).includes(needle);
                const levelMatches = level === 'all' || zone.acces === level || (zone.sous || []).some((child) => child.acces === level);
                return textMatches && levelMatches;
            });
            return { ...section, zones };
        }).filter((section) => section.zones.length > 0);
        return { ...floor, sections };
    }).filter((floor) => !filtering || floor.sections.length > 0), [needle, level, filtering]);

    const counts = useMemo(() => {
        const result = {};
        HOSPITAL_FLOORS.forEach((floor) => floor.sections.forEach((section) => section.zones.forEach((zone) => { result[zone.acces] = (result[zone.acces] || 0) + 1; })));
        return result;
    }, []);

    const toggle = (code) => setOpened((current) => {
        const next = new Set(current);
        if (next.has(code)) next.delete(code); else next.add(code);
        return next;
    });
    const isOpen = (code) => filtering || opened.has(code);
    const allOpen = HOSPITAL_FLOORS.every((floor) => opened.has(floor.code));

    return (
        <div className="hp">
            <div className="hp-toolbar">
                <input
                    type="search" className="hp-search" placeholder="Où trouver… (radiologie, chapelle, bureau, toilettes)"
                    value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Rechercher une pièce ou un service"
                />
                <button
                    type="button" className="hp-link" disabled={filtering}
                    onClick={() => setOpened(allOpen ? new Set() : new Set(HOSPITAL_FLOORS.map((floor) => floor.code)))}
                >
                    <i className={`fas ${allOpen ? 'fa-compress' : 'fa-expand'} me-1`}></i>{allOpen ? 'Tout réduire' : 'Tout développer'}
                </button>
            </div>

            <div className="hp-legend" role="group" aria-label="Filtrer par niveau d'accès">
                <button type="button" className={`hp-chip ${level === 'all' ? 'on' : ''}`} onClick={() => setLevel('all')}>Tous les accès</button>
                {Object.entries(ACCESS_LEVELS).map(([key, info]) => (
                    <button
                        key={key} type="button" className={`hp-chip ${level === key ? 'on' : ''}`} style={{ '--c': info.color }}
                        onClick={() => setLevel(level === key ? 'all' : key)} title={info.help}
                    >
                        <i className={`fas ${info.icon} me-1`}></i>{info.label} <span className="hp-count">{counts[key] || 0}</span>
                    </button>
                ))}
            </div>
            <p className="hp-help">
                {Object.entries(ACCESS_LEVELS).map(([key, info]) => <span key={key}><b style={{ color: info.color }}>{info.label}</b> : {info.help} </span>)}
            </p>

            {floors.length === 0 && <p className="hp-empty">Aucune pièce ne correspond à cette recherche.</p>}

            <div className="hp-floors">
                {floors.map((floor) => {
                    const open = isOpen(floor.code);
                    const total = floor.sections.reduce((sum, section) => sum + section.zones.length, 0);
                    return (
                        <section key={floor.code} className={`hp-floor ${floor.entree ? 'entree' : ''} ${open ? 'open' : ''}`}>
                            <button
                                type="button" className="hp-banner" aria-expanded={open} onClick={() => toggle(floor.code)}
                                title={open ? 'Réduire cet étage' : 'Développer cet étage'}
                            >
                                <span className="hp-level"><i className="fas fa-chevron-up hp-level-arrow"></i>{floor.niveau}</span>
                                <span className="hp-name"><i className={`fas ${floor.icon} me-2`}></i>{floor.titre}</span>
                                <span className="hp-meta">
                                    {floor.entree && <span className="hp-entry"><i className="fas fa-door-open me-1"></i>Entrée</span>}
                                    <span className="hp-total">{total} pièce{total > 1 ? 's' : ''}</span>
                                    <i className={`fas fa-chevron-${open ? 'up' : 'down'}`}></i>
                                </span>
                            </button>
                            {open && (
                                <div className="hp-body">
                                    {floor.resume && <p className="hp-resume">{floor.resume}</p>}
                                    {floor.sections.map((section) => (
                                        <div key={section.titre} className="hp-section">
                                            <h4>{section.titre}</h4>
                                            {section.note && <p className="hp-note"><i className="fas fa-circle-info me-1"></i>{section.note}</p>}
                                            <ul className="hp-rooms">
                                                {section.zones.map((zone, index) => (
                                                    <li key={`${zone.nom}-${index}`} style={{ '--c': ACCESS_LEVELS[zone.acces]?.color }}>
                                                        <div className="hp-room">
                                                            <span className="hp-room-name">{zone.nom}</span>
                                                            <AccessBadge level={zone.acces} />
                                                        </div>
                                                        {zone.note && <small className="hp-room-note">{zone.note}</small>}
                                                        {(zone.sous || []).length > 0 && (
                                                            <ul className="hp-sub">
                                                                {zone.sous.map((child) => (
                                                                    <li key={child.nom}>
                                                                        <span>{child.nom}</span>
                                                                        {child.acces && child.acces !== zone.acces && <AccessBadge level={child.acces} />}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
};

export default HospitalPlan;
