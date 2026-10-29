// src/components/FireSafety/FireReportModal.js
//
// « Signaler un problème de sécurité incendie » (Boîte à outils du personnel) : une issue encombrée, un extincteur absent ou périmé, une alarme qui ne sonne
// pas… Le signalement arrive dans le registre des admins (Admin → Sécurité incendie → Non-conformités), qui le suivent jusqu'à sa correction.
import React, { useEffect, useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { ARTICLES, reportProblem } from '../../utils/fireSafety';
import { BUILDING_FLOORS, floorByLabel } from '../../constants/buildingPlan';

const EMPTY = { etage: '', lieu: '', article: 'autre', description: '' };

const FireReportModal = ({ show, onHide, showNotification }) => {
    const { staffName } = useEmployeeAuth();
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (show) setForm(EMPTY); }, [show]);

    const submit = async () => {
        setBusy(true);
        try {
            await reportProblem({ ...form, etage: form.lieu ? `${form.etage} — ${form.lieu}` : form.etage, name: staffName });
            showNotification('Merci : le problème est signalé aux administrateurs.', 'check-circle');
            onHide();
        } catch (error) {
            showNotification(String(error?.message || error).slice(0, 160), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Signaler un problème de sécurité incendie" zIndex={1100} className="dark-ui">
            <p className="text-muted small">Issue de secours encombrée, extincteur absent ou périmé, alarme ou détecteur défaillant… Décrivez ce que vous avez vu : les administrateurs s'en occupent.</p>
            <Form.Group className="mb-2">
                <Form.Label>Étage et lieu</Form.Label>
                <Form.Select value={form.etage} onChange={(e) => setForm({ ...form, etage: e.target.value, lieu: '' })}>
                    <option value="">Choisir l'étage…</option>
                    {BUILDING_FLOORS.map((entry) => <option key={entry.label} value={entry.label}>{entry.label}</option>)}
                    <option value="Parking">Parking</option>
                    <option value="Extérieur du bâtiment">Extérieur du bâtiment</option>
                </Form.Select>
                {floorByLabel(form.etage) && (
                    <Form.Select className="mt-2" value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} aria-label="Lieu précis">
                        <option value="">Lieu précis (facultatif)…</option>
                        {floorByLabel(form.etage).zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                    </Form.Select>
                )}
            </Form.Group>
            <Form.Group className="mb-2">
                <Form.Label>Type de problème</Form.Label>
                <Form.Select value={form.article} onChange={(e) => setForm({ ...form, article: e.target.value })}>
                    {Object.entries(ARTICLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control as="textarea" rows={3} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="ex. Des cartons bloquent la porte de secours du couloir" />
            </Form.Group>
            <Button variant="danger" onClick={submit} disabled={busy || !form.etage.trim() || form.description.trim().length < 5}>
                {busy ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-triangle-exclamation me-1"></i>Signaler</>}
            </Button>
        </BaseModal>
    );
};

export default FireReportModal;
