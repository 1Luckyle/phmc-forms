// src/components/DeathSignalBanner.js
//
// Bandeau de « Dossier Patient » quand un décès a été signalé pour ce patient (utils/deathSignals.js) :
//   • à traiter : « rapport de décès à établir » (avec le bouton pour le DMEC, qui peut ouvrir « Services de Médecine Légale » prérempli) ;
//   • traité    : le rapport de décès a été établi.
import React, { useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { loadDeathSignalsFor, deathSignalSummary } from '../utils/deathSignals';

const DeathSignalBanner = ({ patientID, onCreate, refreshKey = 0 }) => {
    const [signals, setSignals] = useState([]);
    useEffect(() => {
        let cancelled = false;
        if (!patientID) { setSignals([]); return undefined; }
        loadDeathSignalsFor(patientID).then((found) => { if (!cancelled) setSignals(found); });
        return () => { cancelled = true; };
    }, [patientID, refreshKey]);
    if (!signals.length) return null;
    return (
        <div data-no-tip="1">
            {signals.map((signal) => (
                <Alert key={signal.key} variant={signal.statut === 'traite' ? 'secondary' : 'danger'} className="py-2 small mb-2">
                    <i className="fas fa-skull-crossbones me-2"></i>
                    <strong>Décès signalé</strong> : {deathSignalSummary(signal)}, par {signal.par || 'un soignant'}.{' '}
                    {signal.statut === 'traite' ? `Rapport de décès établi par ${signal.traitePar || 'le DMEC'}.` : 'Le rapport de décès reste à établir par le DMEC.'}
                    {signal.statut !== 'traite' && onCreate && <Button size="sm" variant="outline-light" className="ms-2" onClick={() => onCreate(signal)}>Créer le rapport de décès</Button>}
                </Alert>
            ))}
        </div>
    );
};

export default DeathSignalBanner;
