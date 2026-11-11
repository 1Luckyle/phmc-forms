// src/components/AdminDossierEditor.js
//
// Correction du dossier d'un patient PAR UN ADMINISTRATEUR, sans payer : une erreur de saisie qu'un patient ne peut plus corriger autrement que par une mise à jour payante, ou un dossier à
// reprendre à la main. Le dossier lui-même n'est écrit que par le serveur ou par un administrateur (règles : database.rules.json, dossiersPatients). Chaque correction est inscrite dans
// l'historique du dossier et dans le journal d'activité. Les coordonnées d'identité sont aussi reportées sur le profil du compte Civil, comme le fait le serveur.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { ref, get, update } from 'firebase/database';
import { database } from '../firebase';
import BaseModal from './BaseModal';
import { getFieldInfo } from '../constants/fieldInfo';
import { canonicalPatientId } from '../utils/patientId';
import { forgetDossierLookup } from '../utils/dossierLookup';
import { findStaffPathByPatientNode, loadAccountIdentity } from '../utils/dossierPatient';
import { logActivity } from '../utils/activityLog';
import { findCivilianUidByPatientId } from '../utils/notifications';
import {
    IDENTITY_FIELDS, EMERGENCY_FIELDS, MEDICAL_FIELDS, MENTAL_FIELDS, FAMILY_FIELDS, SOCIAL_FIELDS, LIFESTYLE_FIELDS, DIRECTIVE_FIELDS, profilePatch,
} from '../utils/dossierCore';

const SECTIONS = [
    ['Identité', IDENTITY_FIELDS], ['Contact d\'urgence', EMERGENCY_FIELDS], ['Historique médical', MEDICAL_FIELDS], ['Santé mentale', MENTAL_FIELDS],
    ['Antécédents familiaux', FAMILY_FIELDS], ['Informations sociales', SOCIAL_FIELDS], ['Mode de vie', LIFESTYLE_FIELDS], ['Directives anticipées', DIRECTIVE_FIELDS],
];
// Clé du profil → clé de la fiche du personnel (le prénom et le nom restent ceux de l'employé).
const STAFF_KEY_OF = { middleName: 'middleName', dateOfBirth: 'dateOfBirth', gender: 'gender', address: 'address', zip: 'zip', phone: 'phNumber', discord: 'discord' };
// Champs du dossier reportés sur la fiche du compte (le prénom et le nom restent ceux de l'employé).
const SYNCED_FIELDS = { patientMiddleName: 1, patientDateOfBirth: 1, patientGender: 1, patientAddress: 1, patientZIP: 1, patientPH: 1, patientDiscord: 1 };
const labelOf = (key) =>getFieldInfo(3, key, 'text').label;

const AdminDossierEditor = ({ show, onHide, patientID, adminName, showNotification, onSaved }) => {
    const node = canonicalPatientId(patientID);
    const [original, setOriginal] = useState({});
    const [account, setAccount] = useState({});
    const [values, setValues] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!show || !node) return undefined;
        let cancelled = false;
        setLoading(true);
        setError('');
        get(ref(database, `dossiersPatients/${node}/donnees`)).then(async (snap) => {
            const identity = await loadAccountIdentity(node);
            if (cancelled) return;
            const found = snap.exists() ? snap.val() : {};
            setAccount(identity);
            setOriginal(found);
            setValues(found);
        }).catch((err) => { if (!cancelled) setError(err.message || String(err)); }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [show, node]);

    const changed = useMemo(() => Object.keys({ ...original, ...values }).filter((key) => String(original[key] ?? '') !== String(values[key] ?? '')), [original, values]);

    // Champs d'identité où la fiche du compte (qui prime dans l'aperçu) garde une valeur différente de celle du dossier : une correction les remet d'accord, même sans autre changement.
    const outOfSync = useMemo(() => Object.keys(SYNCED_FIELDS).filter((key) => String(account[key] ?? '').trim() !== '' && String(account[key]).trim() !== String(values[key] ?? '').trim()), [account, values]);
    const saveCount = changed.length + outOfSync.filter((key) => !changed.includes(key)).length;

    const save = async () => {
        if (saveCount === 0) return;
        setSaving(true);
        setError('');
        try {
            const now = Date.now();
            const updates = {};
            const changedValues = {};
            changed.forEach((key) => {
                const value = String(values[key] ?? '').trim();
                changedValues[key] = value;
                updates[`dossiersPatients/${node}/donnees/${key}`] = value === '' ? null : value;
            });
            updates[`dossiersPatients/${node}/majLe`] = now;
            updates[`dossiersPatients/${node}/historique/correction_${now}`] = { version: 0, appliqueLe: now, titre: `Correction par ${adminName || 'un administrateur'} (${saveCount} champ(s))`, createur: 'admin' };
            // Le profil du compte Civil garde la même identité que le dossier.
            const syncValues = { ...changedValues };
            outOfSync.forEach((key) => { syncValues[key] = String(values[key] ?? '').trim(); });
            const patch = profilePatch(syncValues);
            if (Object.keys(patch).length > 0) {
                const uid = await findCivilianUidByPatientId(node);
                if (uid) Object.entries(patch).forEach(([field, value]) => { updates[`civilians/${uid}/${field}`] = value === '' ? null : value; });
            }
            // La fiche du personnel (si la personne en a une) prime sur le dossier dans l'aperçu : on y reporte les mêmes corrections. Le nom d'employé (prénom, nom) n'est pas touché ici.
            if (Object.keys(patch).length > 0) {
                const staffPath = await findStaffPathByPatientNode(node);
                if (staffPath) Object.entries(patch).forEach(([profileKey, value]) => { const staffKey = STAFF_KEY_OF[profileKey]; if (staffKey) updates[`${staffPath}/${staffKey}`] = value === '' ? null : value; });
            }
            await update(ref(database), updates);
            logActivity({ category: 'dossier', action: 'dossier_corrige', severity: 'warning', summary: `Dossier patient corrigé par un administrateur : ${node}`, details: `Par : ${adminName || 'admin'}\nChamps : ${changed.join(', ')}`, target: node });
            // Le cache de lecture (formulaires) et l'aperçu du dossier doivent repartir des valeurs corrigées.
            forgetDossierLookup(node);
            if (onSaved) onSaved();
            if (showNotification) showNotification('Dossier corrigé.', 'check-circle');
            setOriginal({ ...original, ...changedValues });
            onHide();
        } catch (err) {
            setError(err.message || String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <BaseModal isOpen={show} onClose={onHide} title={`Corriger le dossier (${node})`} modalSize="large" className="dark-ui">
            <Alert variant="warning" className="py-2 small">
                Correction administrateur : elle ne passe pas par un formulaire, ne coûte rien et est consignée dans l'historique du dossier et le journal d'activité. L'e-mail et l'ID ne se modifient pas ici.
            </Alert>
            {loading && <div className="text-muted"><Spinner size="sm" animation="border" className="me-2" />Chargement…</div>}
            {!loading && SECTIONS.map(([title, keys]) => (
                <div key={title} className="mb-3">
                    <strong className="d-block mb-2">{title}</strong>
                    <div className="d-flex flex-wrap gap-2">
                        {keys.map((key) => (
                            <Form.Group key={key} style={{ flex: '1 1 260px' }}>
                                <Form.Label className="small mb-1">{labelOf(key)}</Form.Label>
                                <Form.Control as={['patientAllergies', 'patientCurrentMedicine', 'patientChronicDiseases', 'patientNotes', ...MENTAL_FIELDS, ...FAMILY_FIELDS, ...LIFESTYLE_FIELDS].includes(key) ? 'textarea' : 'input'}
                                    rows={2} value={values[key] ?? ''} onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))} data-no-tip="1" />
                            </Form.Group>
                        ))}
                    </div>
                </div>
            ))}
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}
            <div className="d-flex justify-content-end gap-2">
                <Button variant="secondary" onClick={onHide}>Annuler</Button>
                <Button variant="primary" onClick={save} disabled={saving || loading || saveCount === 0}>{saving ? <Spinner size="sm" animation="border" /> : `Enregistrer (${saveCount})`}</Button>
            </div>
        </BaseModal>
    );
};

export default AdminDossierEditor;
