// src/phmc-field-data/shared/TemporaryIdPicker.js
//
// Sous le champ « ID patient » des formulaires du DMEC (rapports de médecine légale, certificat de décès, autopsie, rapport public) : un défunt sans ID patient reçoit un ID TEMPORAIRE (TMP-XXXXX) pour que ses
// rapports soient enregistrés par ID et liés à la même personne (voir utils/temporaryIds.js).
//   • champ vide             : « Générer un ID temporaire », ou réutiliser un ID temporaire déjà créé pour le même nom ;
//   • ID temporaire saisi    : rappel, et demande d'attribution de l'ID réel aux administrateurs quand il est connu ;
//   • ID réel                : rien.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { canonicalPatientId } from '../../utils/patientId';
import { isTemporaryId, loadTemporaryIds, registerTemporaryId, findTemporaryIdsByName, requestRealIdAssignment } from '../../utils/temporaryIds';

const decedentName = (formData) => [formData.decedentFirstName, formData.decedentMiddleName, formData.decedentLastName].filter(Boolean).join(' ').trim() || String(formData.decedentName || '').trim();

const TemporaryIdPicker = ({ formData, setFormData }) => {
    const { staffName } = useEmployeeAuth();
    const id = canonicalPatientId(formData.patientID);
    const temporary = isTemporaryId(id);
    const name = decedentName(formData);
    const [registry, setRegistry] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [realId, setRealId] = useState('');
    const [requested, setRequested] = useState(false);

    useEffect(() => {
        let cancelled = false;
        if (id && !temporary) return undefined;
        loadTemporaryIds().then((found) => { if (!cancelled) setRegistry(found || {}); }).catch(() => {});
        return () => { cancelled = true; };
    }, [id, temporary]);

    const matches = useMemo(() => findTemporaryIdsByName(registry, name), [registry, name]);
    const use = (value) => setFormData((prev) => ({ ...prev, patientID: value }));
    const generate = async () => {
        setBusy(true);
        setError('');
        try { use(await registerTemporaryId({ nom: name || formData.decedentOOC || 'Inconnu(e)', byName: staffName })); } catch (err) { setError(err.message || "Impossible de créer l'identifiant temporaire."); } finally { setBusy(false); }
    };
    const request = async () => {
        setBusy(true);
        try { await requestRealIdAssignment({ tempId: id, realId, byName: staffName }); setRequested(true); } catch (err) { setError(err.message || 'La demande a échoué.'); } finally { setBusy(false); }
    };

    if (id && !temporary) return null;
    if (temporary) {
        const knownReal = canonicalPatientId(realId);
        return (
            <Alert variant="info" className="py-2 small mt-2" data-no-tip="1">
                <i className="fas fa-id-badge me-2"></i><strong>ID temporaire {id}</strong> : utilisez le même ID sur chaque rapport de cette personne pour les relier. Quand son ID patient réel est connu (ou qu'elle ouvre son compte),
                les administrateurs le lui attribuent et tous les rapports sont transférés.
                <div className="d-flex gap-2 flex-wrap align-items-center mt-2">
                    <Form.Control size="sm" type="text" value={realId} onChange={(event) => { setRealId(event.target.value); setRequested(false); }} placeholder="ID réel (ex. PHMC-2752)" style={{ maxWidth: 200 }} />
                    <Button size="sm" variant="outline-primary" disabled={busy || requested || !/^PHMC-\d{3,}$/.test(knownReal)} onClick={request}>{requested ? 'Demande envoyée' : "Demander l'attribution aux administrateurs"}</Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => use('')}>Retirer l'ID temporaire</Button>
                </div>
                {error && <div className="text-danger mt-1">{error}</div>}
            </Alert>
        );
    }
    return (
        <div className="small mt-2" data-no-tip="1">
            <div className="d-flex gap-2 flex-wrap align-items-center">
                <Button size="sm" variant="outline-secondary" disabled={busy} onClick={generate} title="Pour un défunt sans ID patient : un ID temporaire relie ses rapports, et sera remplacé par l'ID réel plus tard">
                    <i className="fas fa-id-badge me-1"></i>Pas d'ID patient : générer un ID temporaire
                </Button>
                {matches.length > 0 && <span className="text-muted">ou réutiliser :</span>}
                {matches.slice(0, 4).map((match) => (
                    <Button key={match.id} size="sm" variant="outline-info" onClick={() => use(match.id)} title={`ID temporaire déjà créé pour « ${match.nom} »`}>{match.id} · {match.nom}</Button>
                ))}
            </div>
            {error && <div className="text-danger mt-1">{error}</div>}
        </div>
    );
};

export default TemporaryIdPicker;
