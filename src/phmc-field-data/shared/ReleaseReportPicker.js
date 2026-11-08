// src/phmc-field-data/shared/ReleaseReportPicker.js
//
// Libération médicale : liste des rapports du patient qui correspondent aux catégories et à la période choisies. On ne voit que le titre, la date et le
// médecin responsable (jamais le contenu). Les rapports cochés sont gardés dans `releaseReports` ; le praticien consulté s'en déduit (voir MedicalRelease).
// Voir utils/releaseRequests.js pour le circuit complet (demande, partage par chaque médecin, notification du patient).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { canonicalPatientId } from '../../utils/patientId';
import { getFormLabel } from '../../formDefinitions';
import {
    loadReleaseCandidates, eligibleReleaseEntries, toSelection, practitionersOf,
} from '../../utils/releaseRequests';

const boxStyle = { border: '1px solid #30363d', borderRadius: 6, padding: '10px 12px', background: '#0d1117', marginTop: 8 };
const rowStyle = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderTop: '1px solid #21262d' };
const smallStyle = { color: '#8b949e', fontSize: '0.8rem' };

const dayOf = (ms) => (ms ? new Date(ms).toLocaleDateString('fr-FR') : 'date inconnue');

const ReleaseReportPicker = ({ formData, setFormData }) => {
    const patientNode = canonicalPatientId(formData.patientID);
    const categories = useMemo(() => (Array.isArray(formData.MedicalRecordsRelease) ? formData.MedicalRecordsRelease : []), [formData.MedicalRecordsRelease]);
    const selection = useMemo(() => (Array.isArray(formData.releaseReports) ? formData.releaseReports : []), [formData.releaseReports]);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [reloadTick, setReloadTick] = useState(0);

    // Les rapports du patient : rechargés quand l'ID change (après une courte pause de saisie) ou sur « Actualiser ».
    useEffect(() => {
        setCandidates([]);
        setFailed(false);
        if (!patientNode || patientNode.length < 5) return undefined;
        let cancelled = false;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const found = await loadReleaseCandidates(patientNode);
                if (!cancelled) setCandidates(found);
            } catch (error) {
                if (!cancelled) setFailed(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 500);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [patientNode, reloadTick]);

    const eligible = useMemo(
        () => eligibleReleaseEntries(candidates, { categories, from: formData.StupidDateFrom, to: formData.StupidDateTo }),
        [candidates, categories, formData.StupidDateFrom, formData.StupidDateTo],
    );
    const selectedKeys = useMemo(() => new Set(selection.map((item) => item.k)), [selection]);

    // Un rapport qui sort des filtres (catégorie ou période modifiées) n'est plus retenu ; la liste n'est élaguée qu'une fois les rapports chargés.
    useEffect(() => {
        if (loading || candidates.length === 0 || selection.length === 0) return;
        const allowed = new Set(eligible.map((entry) => entry.indexKey));
        const kept = selection.filter((item) => allowed.has(item.k));
        if (kept.length !== selection.length) setFormData((prev) => ({ ...prev, releaseReports: kept }));
    }, [eligible, loading, candidates.length, selection, setFormData]);

    const setSelection = useCallback((next) => setFormData((prev) => ({ ...prev, releaseReports: next })), [setFormData]);
    const toggle = (entry, checked) => setSelection(checked
        ? [...selection.filter((item) => item.k !== entry.indexKey), toSelection(entry)]
        : selection.filter((item) => item.k !== entry.indexKey));
    const allChecked = eligible.length > 0 && eligible.every((entry) => selectedKeys.has(entry.indexKey));

    let body;
    if (!patientNode) body = <div style={smallStyle}>Renseignez l'ID patient pour voir les rapports disponibles.</div>;
    else if (categories.length === 0) body = <div style={smallStyle}>Choisissez au moins une catégorie de dossiers ci-dessus : les rapports correspondants s'affichent ici.</div>;
    else if (loading) body = <div style={smallStyle}>Recherche des rapports du patient…</div>;
    else if (failed) body = <div style={{ ...smallStyle, color: '#f85149' }}>Les rapports du patient n'ont pas pu être chargés.</div>;
    else if (eligible.length === 0) {
        body = (
            <div style={smallStyle}>
                Aucun rapport du personnel ne correspond à ces catégories{formData.StupidDateFrom || formData.StupidDateTo ? ' et à cette période' : ''}.
                {categories.includes('Other') ? ' La demande « Autres dossiers » reste possible : précisez-les dans le champ prévu.' : ''}
            </div>
        );
    } else {
        body = (
            <>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <Form.Check
                        type="checkbox" id="releaseAllReports" label={` Tout sélectionner (${eligible.length})`} checked={allChecked}
                        onChange={(e) => setSelection(e.target.checked ? eligible.map(toSelection) : [])}
                    />
                    <span style={smallStyle}>{selection.length} rapport(s) retenu(s)</span>
                </div>
                {eligible.map((entry) => {
                    const author = toSelection(entry).a;
                    return (
                        <div key={entry.indexKey} style={rowStyle}>
                            <Form.Check type="checkbox" id={`release-${entry.indexKey}`} checked={selectedKeys.has(entry.indexKey)} onChange={(e) => toggle(entry, e.target.checked)} aria-label={entry.title || 'Rapport'} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{entry.title || entry.originalKey || 'Rapport'}</div>
                                <div style={smallStyle}>
                                    {getFormLabel(entry.bbCodeVersion)} · {dayOf(entry.timestamp)} · {author || 'médecin inconnu'}
                                    {entry.visibility === 'shared' ? ' · déjà partagé avec le patient' : ' · à faire partager par son médecin'}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </>
        );
    }

    return (
        <div style={boxStyle} data-no-tip="1">
            <div className="d-flex justify-content-between align-items-center">
                <strong><i className="fas fa-folder-open me-2"></i>Rapports disponibles à divulguer</strong>
                <Button size="sm" variant="outline-secondary" disabled={!patientNode || loading} onClick={() => setReloadTick((tick) => tick + 1)}>
                    <i className="fas fa-rotate me-1"></i>Actualiser
                </Button>
            </div>
            <div style={{ ...smallStyle, marginBottom: 6 }}>
                Vous voyez le titre, la date et le médecin responsable de chaque rapport, pas son contenu. Une fois le formulaire enregistré, chaque médecin est prévenu et partage
                les siens avec le patient ; un administrateur ou un chef de service peut tout partager si un soignant ne le fait pas.
                {selection.length > 0 && practitionersOf(selection).length > 0 ? ` Praticiens concernés : ${practitionersOf(selection).join(', ')}.` : ''}
            </div>
            {body}
        </div>
    );
};

export default ReleaseReportPicker;
