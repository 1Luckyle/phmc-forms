// src/components/Recruitment/InterviewModal.js
//
// Planifier ou modifier l'entretien d'une candidature : date et heure, qui mène le recrutement (par défaut la personne connectée,
// modifiable parmi le personnel), qui d'autre sera présent, et — si aucun personnel administratif n'est prévu — la décharge que le
// recruteur signe. Voir utils/interviews.js.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Modal } from 'react-bootstrap';
import Select from 'react-select';
import { loadStaffMembers, rankLabel } from '../../utils/staffAdmin';
import { DECHARGE_TEXT, isAdministrativeMember, signatureMatches } from '../../utils/interviews';
import './Applications.css';

const selectStyles = {
    control: (base, state) => ({ ...base, backgroundColor: '#0d1117', borderColor: state.isFocused ? '#58a6ff' : '#30363d', minHeight: '36px', '&:hover': { borderColor: '#58a6ff' } }),
    menu: (base) => ({ ...base, backgroundColor: '#161b22', zIndex: 2000, border: '1px solid #30363d' }),
    menuPortal: (base) => ({ ...base, zIndex: 2000 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#30363d' : '#161b22', color: '#e6edf3' }),
    singleValue: (base) => ({ ...base, color: '#e6edf3' }),
    input: (base) => ({ ...base, color: '#e6edf3' }),
    placeholder: (base) => ({ ...base, color: '#9aa7b4' }),
    multiValue: (base) => ({ ...base, backgroundColor: '#30363d' }),
    multiValueLabel: (base) => ({ ...base, color: '#e6edf3' }),
    multiValueRemove: (base) => ({ ...base, color: '#9aa7b4', '&:hover': { backgroundColor: '#da3633', color: '#fff' } }),
};

// <input type="datetime-local"> attend « AAAA-MM-JJTHH:mm » en heure locale.
const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// application : candidature concernée ; interview : entretien existant (modification) ou null ; actor : { name, uid }
// onSubmit({ entretien, signature }) → promesse (la fenêtre se ferme si elle réussit).
const InterviewModal = ({ show, onHide, application, interview, actor, onSubmit }) => {
    const [members, setMembers] = useState([]);
    const [when, setWhen] = useState('');
    const [lead, setLead] = useState(null);
    const [others, setOthers] = useState([]);
    const [signature, setSignature] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // Personnel proposé : TOUTES les fiches (PHMC et DMEC), lues en direct (pas la liste en cache, parfois incomplète), avec leur rôle
    // pour savoir qui est administratif.
    useEffect(() => {
        if (!show) return undefined;
        let cancelled = false;
        loadStaffMembers()
            .then((list) => { if (!cancelled) setMembers(list); })
            .catch((error) => console.warn('Liste du personnel illisible :', error?.message || error));
        return () => { cancelled = true; };
    }, [show]);

    const people = useMemo(() => {
        const seen = new Set();
        return members
            .filter((member) => member && member.name && (seen.has(member.name) ? false : seen.add(member.name)))
            .map((member) => ({
                value: member.name,
                label: `${member.displayName || member.name} (${rankLabel(member.service, member.rank || member.category)})`,
                administrative: isAdministrativeMember(member),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [members]);

    const me = useMemo(() => {
        const known = people.find((person) => person.value === actor?.name);
        return known || { value: actor?.name || 'Moi', label: `${actor?.name || 'Moi'} (vous)`, administrative: false };
    }, [people, actor]);

    const optionOf = (name) => people.find((person) => person.value === name) || { value: name, label: name, administrative: false };

    useEffect(() => {
        if (!show) return;
        setError('');
        setSignature('');
        setWhen(toLocalInput(interview?.date));
        setLead(interview?.recruteur?.nom ? optionOf(interview.recruteur.nom) : me);
        setOthers((interview?.presents || []).map((person) => optionOf(person.nom)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, interview, application?.id]);

    const hasAdministrative = !!lead?.administrative || others.some((person) => person.administrative);
    const needsDecharge = !hasAdministrative;
    const peopleOptions = useMemo(() => people.filter((person) => person.value !== lead?.value), [people, lead]);

    const submit = async () => {
        setError('');
        if (!when) { setError("Choisissez la date et l'heure de l'entretien."); return; }
        if (!lead?.value) { setError("Indiquez qui mène l'entretien."); return; }
        if (needsDecharge && !signatureMatches(signature, actor?.name)) {
            setError(`Aucun personnel administratif n'est prévu : signez la décharge en tapant votre nom complet${actor?.name && !String(actor.name).includes('@') ? ` (« ${actor.name} »)` : ''}.`);
            return;
        }
        const date = new Date(when).toISOString();
        const entretien = {
            date,
            recruteur: { nom: lead.value },
            presents: others.map((person) => ({ nom: person.value })),
            sansAdministratif: needsDecharge,
        };
        setBusy(true);
        try {
            await onSubmit({ entretien, signature: needsDecharge ? signature : '' });
            onHide();
        } catch (err) {
            setError(err?.message || "L'enregistrement de l'entretien a échoué.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal show={show} onHide={busy ? undefined : onHide} centered contentClassName="cctv-modal-content" size="lg">
            <Modal.Header closeButton>
                <Modal.Title>{interview ? "Modifier l'entretien" : 'Planifier un entretien'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className="cctv-muted">
                    Candidat : <strong>{application?.nomCandidat}</strong> — {application?.poste}. Le candidat est prévenu par mail de chaque planification, modification ou annulation.
                </p>
                <Form.Group className="mb-3">
                    <Form.Label>Date et heure *</Form.Label>
                    <Form.Control type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={busy} style={{ colorScheme: 'dark' }} />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Qui mène le recrutement ? *</Form.Label>
                    <Select
                        value={lead} onChange={setLead} options={people.length ? people : [me]} isDisabled={busy}
                        styles={selectStyles} menuPortalTarget={document.body} placeholder="Choisir une personne du personnel…"
                        noOptionsMessage={() => 'Aucune personne trouvée'}
                    />
                    <Form.Text className="cctv-muted">Par défaut : vous. Choisissez quelqu'un d'autre si c'est lui ou elle qui reçoit le candidat.</Form.Text>
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Autres personnes présentes</Form.Label>
                    <Select
                        isMulti value={others} onChange={(value) => setOthers(value || [])} options={peopleOptions} isDisabled={busy}
                        styles={selectStyles} menuPortalTarget={document.body} placeholder="Ajouter des personnes présentes (facultatif)…"
                        noOptionsMessage={() => 'Aucune personne trouvée'}
                    />
                </Form.Group>

                {hasAdministrative ? (
                    <div className="rec-banner accepted">
                        <i className="fas fa-circle-check me-2"></i>Du personnel administratif est prévu à l'entretien : aucune décharge n'est nécessaire.
                    </div>
                ) : (
                    <Alert variant="warning" className="mb-0">
                        <strong><i className="fas fa-file-signature me-2"></i>Aucun personnel administratif n'est prévu : décharge à signer</strong>
                        <p className="mt-2 mb-2" style={{ fontSize: '0.9em' }}>{DECHARGE_TEXT}</p>
                        <Form.Control
                            type="text" value={signature} onChange={(e) => setSignature(e.target.value)} disabled={busy}
                            placeholder={`Signature : tapez votre nom complet${actor?.name && !String(actor.name).includes('@') ? ` (${actor.name})` : ''}`}
                        />
                        <Form.Text style={{ color: '#c9d1d9' }}>
                            En signant, vous vous engagez sur ce processus. Vous pouvez aussi ajouter une personne de l'administration ci-dessus pour éviter la décharge.
                        </Form.Text>
                    </Alert>
                )}
                {error && <div className="cctv-error">{error}</div>}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={busy}>Annuler</Button>
                <Button variant="primary" onClick={submit} disabled={busy}>
                    {busy ? 'Enregistrement…' : (interview ? "Enregistrer l'entretien" : "Planifier l'entretien")}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default InterviewModal;
