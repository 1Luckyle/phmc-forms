// src/components/DeathSignalsModal.js
//
// « Décès signalés » (DMEC et admins) : les fiches posées par les soignants quand un patient décède aux urgences ou en opération (utils/deathSignals.js). Le DMEC n'a pas accès aux rapports de soins : la fiche
// donne l'essentiel, et « Créer le rapport de décès » ouvre « Services de Médecine Légale » prérempli. Une fiche passe en « traitée » quand ce rapport est enregistré.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Spinner } from 'react-bootstrap';
import BaseModal from './BaseModal';
import { loadDeathSignals, deathSignalSummary, deathSignalFamilyLabel } from '../utils/deathSignals';
import { deathMannerLabel, DEATH_RESUSCITATION, DEATH_BODY, labelOf } from '../constants/careFormOptions';

const card = { border: '1px solid #30363d', borderRadius: 6, padding: '10px 12px', background: '#0d1117', marginBottom: 10 };
const muted = { color: '#8b949e', fontSize: '0.8rem' };
const day = (ms) => (ms ? new Date(Number(ms)).toLocaleString() : '');

export const DeathSignalDetails = ({ signal }) => {
    const lines = [
        signal.cause && ['Cause', signal.cause],
        signal.nature && ['Nature', deathMannerLabel(signal.nature)],
        signal.reanimation && ['Réanimation', labelOf(DEATH_RESUSCITATION, signal.reanimation)],
        signal.famille && ['Famille', deathSignalFamilyLabel(signal.famille)],
        signal.destination && ['Destination du corps', labelOf(DEATH_BODY, signal.destination)],
    ].filter(Boolean);
    return (
        <div className="small" style={{ marginTop: 4 }}>
            {lines.map(([label, value]) => <div key={label}><span className="text-muted">{label} :</span> {value}</div>)}
        </div>
    );
};

const DeathSignalsModal = ({ show, onHide, onCreateReport }) => {
    const [signals, setSignals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('a_traiter');

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        try { setSignals(await loadDeathSignals()); } catch (err) { setError(err.message || 'Lecture impossible.'); } finally { setLoading(false); }
    }, []);
    useEffect(() => { if (show) reload(); }, [show, reload]);

    const shown = useMemo(() => signals.filter((signal) => (tab === 'a_traiter' ? signal.statut !== 'traite' : signal.statut === 'traite')), [signals, tab]);
    const pending = signals.filter((signal) => signal.statut !== 'traite').length;

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Décès signalés" modalSize="large" className="dark-ui">
            <div className="small text-muted mb-2">
                Fiches posées par les soignants quand un patient décède aux urgences ou en opération. Elles ne contiennent pas le rapport médical : seulement de quoi établir le rapport de décès.
            </div>
            <div className="d-flex gap-2 mb-3 align-items-center">
                <Button size="sm" variant={tab === 'a_traiter' ? 'primary' : 'outline-secondary'} onClick={() => setTab('a_traiter')}>À traiter ({pending})</Button>
                <Button size="sm" variant={tab === 'traite' ? 'primary' : 'outline-secondary'} onClick={() => setTab('traite')}>Traités ({signals.length - pending})</Button>
                <Button size="sm" variant="outline-secondary" className="ms-auto" onClick={reload} disabled={loading}><i className="fas fa-rotate me-1"></i>Actualiser</Button>
            </div>
            {loading && <div className="text-muted"><Spinner size="sm" animation="border" className="me-2" />Chargement…</div>}
            {error && <div className="text-danger">{error}</div>}
            {!loading && !error && shown.length === 0 && <div style={muted}>{tab === 'a_traiter' ? 'Aucun décès à traiter.' : 'Aucun décès traité pour le moment.'}</div>}
            {shown.map((signal) => (
                <div key={signal.key} style={card}>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <Badge bg={signal.statut === 'traite' ? 'success' : 'warning'} text={signal.statut === 'traite' ? undefined : 'dark'}>{signal.statut === 'traite' ? 'Traité' : 'À traiter'}</Badge>
                        <strong style={{ overflowWrap: 'anywhere' }}>{deathSignalSummary(signal)}</strong>
                    </div>
                    <div style={muted}>Signalé par {signal.par || 'un soignant'} · {day(signal.creeLe)}{signal.statut === 'traite' ? ` · traité par ${signal.traitePar || 'le DMEC'} le ${day(signal.traiteLe)}` : ''}</div>
                    <DeathSignalDetails signal={signal} />
                    {signal.statut !== 'traite' && onCreateReport && (
                        <Button size="sm" variant="outline-primary" className="mt-2" onClick={() => { onCreateReport(signal); onHide(); }}>
                            <i className="fas fa-file-medical me-1"></i>Créer le rapport de décès
                        </Button>
                    )}
                </div>
            ))}
        </BaseModal>
    );
};

export default DeathSignalsModal;
