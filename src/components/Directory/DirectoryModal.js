// src/components/Directory/DirectoryModal.js
//
// Annuaire du site, EN LECTURE SEULE, pour le personnel et les admins : la même vision que « Gestion des utilisateurs » du panneau
// admin, sans aucun outil de modification. Deux onglets : Personnel (rôle, ID employé, téléphone, Discord, droits) et Civils (nom et
// ID patient seulement : e-mail, adresse et coordonnées des civils ne sont pas affichés).
import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Spinner } from 'react-bootstrap';
import {
    loadStaffMembers, loadCivilians, loadRecruiterUids, loadAdminUids, rankLabel,
} from '../../utils/staffAdmin';
import { loadInternalGrants } from '../../utils/internalRecruitment';
import { getEmployeeFullName } from '../../utils/employeeName';
import { STAFF_FAMILIES, familiesOfMember } from '../../constants/ranks';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { FilterChips, Pill } from '../Reports/ReportParts';
import '../Cctv/CctvRequests.css';
import './Directory.css';

const FAMILY_COLORS = { soignant: '#3fb950', administration: '#58a6ff', polyvalent: '#d29922', dmec: '#a371f7' };
const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nameOfCivilian = (civilian) => [civilian.firstName, civilian.middleName, civilian.lastName].filter(Boolean).join(' ').trim() || 'Sans nom';

const DirectoryModal = ({ show, onHide }) => {
    const { isAdmin, staffProfile } = useEmployeeAuth();
    // Coordonnées des civils (e-mail, téléphone, Discord, adresse) : admins, personnel soignant et personnel administratif seulement.
    const families = staffProfile ? familiesOfMember(staffProfile, staffProfile.type) : [];
    const canSeeContacts = !!isAdmin || families.includes('soignant') || families.includes('administration');
    const [tab, setTab] = useState('staff');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [staff, setStaff] = useState([]);
    const [civilians, setCivilians] = useState([]);
    const [recruiters, setRecruiters] = useState({});
    const [admins, setAdmins] = useState({});
    const [internalGrants, setInternalGrants] = useState({});
    const [family, setFamily] = useState('all');
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!show) return undefined;
        let cancelled = false;
        setLoading(true);
        setError('');
        (async () => {
            try {
                // Les civils et le recrutement interne ne sont lisibles que selon le rôle : un refus n'empêche pas le reste de s'afficher.
                const [staffList, civilList, recruiterUids, adminUids, grants] = await Promise.all([
                    loadStaffMembers(),
                    loadCivilians().catch(() => []),
                    loadRecruiterUids().catch(() => ({})),
                    loadAdminUids().catch(() => ({})),
                    loadInternalGrants().catch(() => ({})),
                ]);
                if (cancelled) return;
                setStaff(staffList);
                setCivilians(civilList);
                setRecruiters(recruiterUids);
                setAdmins(adminUids);
                setInternalGrants(grants);
            } catch (err) {
                if (!cancelled) setError(err?.message || 'Annuaire illisible.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [show]);

    useEffect(() => {
        if (!show) return undefined;
        const onKeyDown = (event) => { if (event.key === 'Escape') onHide(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [show, onHide]);

    const staffUids = useMemo(() => new Set(staff.map((member) => member.uid).filter(Boolean)), [staff]);
    // Civils « purs » : sans fiche du personnel (les autres sont dans l'onglet Personnel).
    const pureCivilians = useMemo(() => civilians.filter((civilian) => !staffUids.has(civilian.uid)), [civilians, staffUids]);

    const familyChips = useMemo(() => {
        const counts = {};
        staff.forEach((member) => { counts[member.family] = (counts[member.family] || 0) + 1; });
        return [
            { key: 'all', label: 'Tous', count: staff.length },
            ...Object.values(STAFF_FAMILIES).map((item) => ({ key: item.key, label: item.label, count: counts[item.key] || 0, color: FAMILY_COLORS[item.key] })),
        ];
    }, [staff]);

    const needle = normalize(query).trim();
    const staffRows = useMemo(() => staff.filter((member) => (family === 'all' || member.family === family)
        && (!needle || normalize(`${member.displayName} ${rankLabel(member.service, member.rank || member.category)} ${member.serviceDirige || ''} ${member.badge || ''} ${member.discord || ''} ${member.phNumber || ''}`).includes(needle))),
    [staff, family, needle]);
    const civilRows = useMemo(() => pureCivilians.filter((civilian) => !needle || normalize(`${nameOfCivilian(civilian)} ${civilian.patientID || ''} ${canSeeContacts ? `${civilian.email || ''} ${civilian.phone || ''} ${civilian.discord || ''}` : ''}`).includes(needle)),
        [pureCivilians, needle, canSeeContacts]);

    if (!show) return null;

    return ReactDOM.createPortal(
        <div className="dir-overlay" onClick={onHide}>
            <div className="dir-content" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="dir-close" onClick={onHide} aria-label="Fermer">&times;</button>
                <h5 className="dir-title"><i className="fas fa-address-book me-2"></i>Annuaire</h5>
                <p className="dir-sub">
                    Consultation seule : personnel et comptes Civils du site. Aucune modification n'est possible ici.
                    {tab === 'civilians' && !canSeeContacts && " Les coordonnées des civils sont réservées au personnel soignant, au personnel administratif et aux admins."}
                </p>

                <div className="cctv-tabs" role="tablist">
                    <button type="button" role="tab" className={tab === 'staff' ? 'on' : ''} onClick={() => setTab('staff')}>
                        <i className="fas fa-user-md me-2"></i>Personnel <span className="dir-count">{staff.length}</span>
                    </button>
                    <button type="button" role="tab" className={tab === 'civilians' ? 'on' : ''} onClick={() => setTab('civilians')}>
                        <i className="fas fa-id-card me-2"></i>Civils <span className="dir-count">{pureCivilians.length}</span>
                    </button>
                </div>

                <div className="dir-toolbar">
                    <input type="search" className="cctv-search" style={{ flex: '1 1 260px', maxWidth: '420px' }} placeholder={tab === 'staff' ? 'Nom, rôle, ID employé, Discord…' : 'Nom, ID patient, e-mail…'}
                        value={query} onChange={(event) => setQuery(event.target.value)} />
                    {tab === 'staff' && <FilterChips items={familyChips} value={family} onChange={setFamily} label="Filtrer par famille" />}
                </div>

                <div className="dir-body">
                    {loading && <p className="cctv-muted"><Spinner size="sm" animation="border" className="me-2" />Chargement…</p>}
                    {error && <div className="cctv-error">{error}</div>}

                    {!loading && tab === 'staff' && (
                        staffRows.length === 0 ? <p className="cctv-empty">Aucun membre ne correspond.</p> : (
                            <div className="dir-list">
                                {staffRows.map((member) => (
                                    <div key={`${member.service}-${member.storageKey}`} className="dir-row" style={{ '--c': FAMILY_COLORS[member.family] || '#58a6ff' }}>
                                        <div className="dir-main">
                                            <strong>{getEmployeeFullName(member, member.displayName)}</strong>
                                            <small>
                                                {rankLabel(member.service, member.rank || member.category)}
                                                {member.extraRanks.length > 0 ? ` + ${member.extraRanks.join(' · ')}` : ''}
                                                {member.serviceDirige ? ` · Service : ${member.serviceDirige}` : ''}
                                            </small>
                                        </div>
                                        <div className="dir-meta">
                                            <span><i className="fas fa-id-badge"></i> {member.badge || '—'}</span>
                                            <span><i className="fas fa-phone"></i> {member.phNumber || '—'}</span>
                                            <span><i className="fab fa-discord"></i> {member.discord || '—'}</span>
                                        </div>
                                        <div className="dir-chips">
                                            {member.families.map((key) => <Pill key={key} color={FAMILY_COLORS[key]}>{STAFF_FAMILIES[key]?.label || key}</Pill>)}
                                            {member.uid && recruiters[member.uid] === true && <Pill color="#e3b341">Recruteur</Pill>}
                                            {member.uid && admins[member.uid] === true && <Pill color="#f85149">Admin</Pill>}
                                            {member.uid && internalGrants[member.uid] && <Pill color="#79c0ff" title="Statut de recrutement interne accordé">Recrutement interne</Pill>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {!loading && tab === 'civilians' && (
                        civilRows.length === 0 ? <p className="cctv-empty">Aucun compte Civil ne correspond.</p> : (
                            <div className="dir-list">
                                {civilRows.map((civilian) => (
                                    <div key={civilian.uid} className="dir-row" style={{ '--c': '#8b949e' }}>
                                        <div className="dir-main">
                                            <strong>{nameOfCivilian(civilian)}</strong>
                                            <small>Compte Civil</small>
                                        </div>
                                        <div className="dir-meta">
                                            <span><i className="fas fa-id-card"></i> {civilian.patientID || '—'}</span>
                                            {canSeeContacts && (
                                                <>
                                                    <span><i className="fas fa-envelope"></i> {civilian.email || '—'}</span>
                                                    <span><i className="fas fa-phone"></i> {civilian.phone || '—'}</span>
                                                    <span><i className="fab fa-discord"></i> {civilian.discord || '—'}</span>
                                                    {(civilian.address || civilian.zip) && <span><i className="fas fa-location-dot"></i> {[civilian.address, civilian.zip].filter(Boolean).join(' · ')}</span>}
                                                </>
                                            )}
                                        </div>
                                        <div className="dir-chips">
                                            {recruiters[civilian.uid] === true && <Pill color="#e3b341">Recruteur</Pill>}
                                            {internalGrants[civilian.uid] && <Pill color="#79c0ff" title="Statut de recrutement interne accordé">Recrutement interne</Pill>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default DirectoryModal;
