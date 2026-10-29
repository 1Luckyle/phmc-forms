// src/components/FireSafety/FireReportModal.js
//
// « Signaler un problème de sécurité incendie » (Boîte à outils du personnel) : une issue encombrée, un extincteur absent ou périmé, une alarme qui ne sonne
// pas… Le signalement arrive dans le registre des admins (Admin → Sécurité incendie → Non-conformités), qui le suivent jusqu'à sa correction.
import React, { useEffect, useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { ARTICLES, ETAGE_SUGGESTIONS, reportProblem } from '../../utils/fireSafety';

const EMPTY = { etage: '', article: 'autre', description: '' };

const FireReportModal = ({ show, onHide, showNotification }) => {
    const { staffName } = useEmployeeAuth();
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (show) setForm(EMPTY); }, [show]);

    const submit = async () => {
        setBusy(true);
        try {
            await reportProblem({ ...form, name: staffName });
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
                <Form.Label>Étage ou lieu</Form.Label>
                <Form.Control list="fire-report-etages" value={form.etage} maxLength={60} onChange={(e) => setForm({ ...form, etage: e.target.value })} placeholder="ex. Étage 2, couloir est" />
                <datalist id="fire-report-etages">{ETAGE_SUGGESTIONS.map((e) => <option key={e} value={e} />)}</datalist>
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
