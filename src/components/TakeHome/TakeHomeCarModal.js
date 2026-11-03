// src/components/TakeHome/TakeHomeCarModal.js
//
// « Take Home Car » (Boîte à outils) : un seul outil pour tout le personnel, en onglets.
//   • Règlement : le texte du programme (constants/takeHomeCar.js) ;
//   • Ma demande : demander l'un des véhicules éligibles encore libres, suivre sa demande, la retirer ou rendre le véhicule ;
//   • Gestion (Direction, administration, admins) : accorder ou refuser les demandes, voir qui a quel véhicule, retirer un véhicule, historique.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Nav, Spinner, Table } from 'react-bootstrap';
import BaseModal from '../BaseModal';
import '../DarkUi.css';
import './TakeHome.css';
import { auth } from '../../firebase';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { TAKE_HOME_RULES, TAKE_HOME_VEHICLES, MOTIF_MIN, MOTIF_MAX, MOTIF_PRESETS, DECISION_PRESETS, vehicleByPlate, vehicleLabel } from '../../constants/takeHomeCar';
import {
    subscribeMyRequests, subscribeAllRequests, subscribeAssignments, submitRequest, cancelRequest, returnVehicle, decideRequest, withdrawVehicle,
    isActive, statusInfo,
} from '../../utils/takeHomeCars';

const formatDate = (ms) => (ms ? new Date(ms).toLocaleDateString('fr-FR') : '—');
const StatusBadge = ({ statut }) => { const info = statusInfo(statut); return <Badge bg={info.bg} text={info.text}>{info.label}</Badge>; };

// Photo d'aperçu d'un véhicule éligible (rien si la plaque est inconnue).
const VehiclePhoto = ({ plate, thumb }) => {
    const vehicle = vehicleByPlate(plate);
    return vehicle?.image
        ? <img className={thumb ? 'thc-thumb' : 'thc-photo'} src={vehicle.image} alt={vehicleLabel(plate)} loading="lazy" style={{ objectPosition: vehicle.focus || '50% 50%' }} />
        : null;
};

// Menu de réponses toutes faites : en choisir une remplit le champ (qu'on peut ensuite modifier), « Écrire librement » le vide.
// `groups` : [{ label?, items: [texte] }] ; `onPick(texte)`.
const PresetSelect = ({ groups, onPick, placeholder }) => (
    <Form.Select size="sm" className="mb-2" value="" aria-label={placeholder} onChange={(e) => { if (e.target.value) onPick(e.target.value === '__free' ? '' : e.target.value); }}>
        <option value="">{placeholder}</option>
        {groups.map((group) => (group.label
            ? <optgroup key={group.label} label={group.label}>{group.items.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>
            : group.items.map((item) => <option key={item} value={item}>{item}</option>)))}
        <option value="__free">✏️ Écrire librement</option>
    </Form.Select>
);

const Rules = () => (
    <div className="thc-rules">
        <p>{TAKE_HOME_RULES.intro}</p>
        <p className="thc-hrp">{TAKE_HOME_RULES.hrp}</p>
        {TAKE_HOME_RULES.sections.map((section) => (
            <div key={section.title}>
                <h6>{section.title}</h6>
                <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
                {section.note && <p className="text-muted small">{section.note}</p>}
            </div>
        ))}
        <p>{TAKE_HOME_RULES.closing}</p>
        <p className="thc-hrp"><strong>{TAKE_HOME_RULES.closingHrp}</strong></p>
    </div>
);

const MyRequest = ({ requests, assignments, name, run, busy }) => {
    const { staffProfile } = useEmployeeAuth();
    // Zone de stationnement : par défaut l'adresse de la fiche du personnel (vide s'il n'y en a pas) ; `lieu: null` = non modifié par l'utilisateur.
    const address = String(staffProfile?.address || '').trim();
    const [form, setForm] = useState({ plate: '', lieu: null, motif: '' });
    const lieu = form.lieu ?? address;
    const uid = auth.currentUser?.uid;
    const current = requests.find(isActive);
    const history = requests.filter((request) => !isActive(request));
    const holder = (plate) => assignments[plate];

    return (
        <>
            {current ? (
                <div className="thc-card">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                        <strong>{vehicleLabel(current.plaque)}</strong>
                        <StatusBadge statut={current.statut} />
                    </div>
                    <VehiclePhoto plate={current.plaque} />
                    <div className="text-muted small mt-2">Demande du {formatDate(current.demandeLe)}{current.lieu ? ` · ${current.lieu}` : ''}</div>
                    <p className="mb-2 mt-2">{current.motif}</p>
                    {current.statut === 'en_attente' && (
                        <>
                            <p className="text-muted small mb-2">La Direction étudie votre demande : vous serez prévenu(e) par une notification.</p>
                            <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => run(() => cancelRequest(current), 'Demande annulée.')}>Annuler ma demande</Button>
                        </>
                    )}
                    {current.statut === 'accepte' && (
                        <>
                            <Alert variant="success" className="py-2 small">
                                Véhicule accordé{current.decisionParNom ? ` par ${current.decisionParNom}` : ''}{current.decisionNote ? ` : ${current.decisionNote}` : ''}. Vous pouvez en faire un /fspawn chez vous.
                            </Alert>
                            <Button size="sm" variant="outline-warning" disabled={busy} onClick={() => run(() => returnVehicle(current), 'Véhicule rendu : il est de nouveau disponible.')}>Rendre le véhicule</Button>
                        </>
                    )}
                </div>
            ) : (
                <>
                    <p className="text-muted small">Choisissez un véhicule libre et expliquez votre demande. La Direction l'acceptera ou la refusera ; l'attribution reste un privilège révocable.</p>
                    <Form.Group className="mb-2">
                        <Form.Label>Véhicule</Form.Label>
                        <Form.Select value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })}>
                            <option value="">Choisir un véhicule…</option>
                            {TAKE_HOME_VEHICLES.map((vehicle) => {
                                const taken = holder(vehicle.plate);
                                return <option key={vehicle.plate} value={vehicle.plate} disabled={!!taken}>{vehicleLabel(vehicle.plate)}{taken ? ` — attribué à ${taken.uid === uid ? 'vous' : taken.nom}` : ''}</option>;
                            })}
                        </Form.Select>
                        {form.plate && <div className="mt-2"><VehiclePhoto plate={form.plate} /></div>}
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>Zone de stationnement <small className="text-muted">(facultatif{address ? ' · votre adresse par défaut' : ''})</small></Form.Label>
                        <Form.Control maxLength={120} value={lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} placeholder="ex. quartier de résidence" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Motif de la demande</Form.Label>
                        <PresetSelect groups={[{ items: MOTIF_PRESETS }]} placeholder="Choisir une réponse toute faite…" onPick={(text) => setForm({ ...form, motif: text })} />
                        <Form.Control as="textarea" rows={3} maxLength={MOTIF_MAX} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} placeholder="Ou écrivez librement : pourquoi un Take Home Car, et comment vous restez disponible" />
                    </Form.Group>
                    <Button disabled={busy || !form.plate || form.motif.trim().length < MOTIF_MIN} onClick={() => run(async () => { await submitRequest({ ...form, lieu, name }); setForm({ plate: '', lieu: null, motif: '' }); }, 'Demande envoyée à la Direction.')}>
                        {busy ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-paper-plane me-1"></i>Envoyer la demande</>}
                    </Button>
                </>
            )}
            {history.length > 0 && (
                <>
                    <h6 className="mt-4">Historique</h6>
                    <Table size="sm" className="thc-table">
                        <thead><tr><th>Date</th><th>Véhicule</th><th>État</th><th>Remarque</th></tr></thead>
                        <tbody>{history.map((request) => (
                            <tr key={request.id}><td>{formatDate(request.demandeLe)}</td><td>{request.plaque}</td><td><StatusBadge statut={request.statut} /></td><td>{request.finNote || request.decisionNote || ''}</td></tr>
                        ))}</tbody>
                    </Table>
                </>
            )}
        </>
    );
};

const Management = ({ requests, assignments, name, run, busy }) => {
    const [notes, setNotes] = useState({});
    const [withdrawing, setWithdrawing] = useState('');
    const pending = requests.filter((request) => request.statut === 'en_attente');
    const history = requests.filter((request) => request.statut !== 'en_attente');
    const noteOf = (key) => notes[key] || '';
    const setNote = (key, value) => setNotes((prev) => ({ ...prev, [key]: value }));
    const requestFor = (plate) => requests.find((request) => request.plaque === plate && request.statut === 'accepte');

    return (
        <>
            <h6>Demandes en attente {pending.length > 0 && <Badge bg="warning" text="dark">{pending.length}</Badge>}</h6>
            {pending.length === 0 ? <p className="text-muted small">Aucune demande en attente.</p> : pending.map((request) => (
                <div className="thc-card" key={request.id}>
                    <div className="d-flex justify-content-between gap-2"><strong>{request.demandeurNom || 'Membre du personnel'}</strong><span>{vehicleLabel(request.plaque)}</span></div>
                    <VehiclePhoto plate={request.plaque} thumb />
                    <div className="text-muted small">Demande du {formatDate(request.demandeLe)}{request.lieu ? ` · ${request.lieu}` : ''}{assignments[request.plaque] ? ` · déjà attribué à ${assignments[request.plaque].nom}` : ''}</div>
                    <p className="my-2">{request.motif}</p>
                    <PresetSelect
                        groups={[{ label: 'Pour un accord', items: DECISION_PRESETS.accord }, { label: 'Pour un refus', items: DECISION_PRESETS.refus }]}
                        placeholder="Réponse toute faite pour le demandeur…" onPick={(text) => setNote(request.id, text)}
                    />
                    <Form.Control size="sm" className="mb-2" maxLength={300} placeholder="Ou écrivez librement une remarque pour le demandeur (facultatif)" value={noteOf(request.id)} onChange={(e) => setNote(request.id, e.target.value)} />
                    <div className="d-flex gap-2">
                        <Button size="sm" variant="success" disabled={busy || !!assignments[request.plaque]} onClick={() => run(() => decideRequest(request, { accept: true, note: noteOf(request.id), name }), 'Take Home Car accordé.')}>Accorder</Button>
                        <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => run(() => decideRequest(request, { accept: false, note: noteOf(request.id), name }), 'Demande refusée.')}>Refuser</Button>
                    </div>
                </div>
            ))}

            <h6 className="mt-4">Véhicules</h6>
            <Table size="sm" className="thc-table">
                <thead><tr><th>Véhicule</th><th>Attribué à</th><th>Depuis</th><th></th></tr></thead>
                <tbody>{TAKE_HOME_VEHICLES.map((vehicle) => {
                    const taken = assignments[vehicle.plate];
                    const request = requestFor(vehicle.plate);
                    return (
                        <React.Fragment key={vehicle.plate}>
                            <tr>
                                <td><div className="d-flex align-items-center gap-2"><VehiclePhoto plate={vehicle.plate} thumb />{vehicleLabel(vehicle.plate)}</div></td>
                                <td>{taken ? taken.nom : <span className="text-muted">Libre</span>}</td>
                                <td>{taken ? formatDate(taken.depuis) : '—'}</td>
                                <td className="text-end">{taken && request && <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => setWithdrawing(withdrawing === vehicle.plate ? '' : vehicle.plate)}>Retirer</Button>}</td>
                            </tr>
                            {withdrawing === vehicle.plate && request && (
                                <tr><td colSpan={4}>
                                    <PresetSelect groups={[{ items: DECISION_PRESETS.retrait }]} placeholder="Motif de retrait tout fait…" onPick={(text) => setNote(`w${vehicle.plate}`, text)} />
                                    <div className="d-flex gap-2">
                                        <Form.Control size="sm" maxLength={300} placeholder="Ou écrivez librement le motif du retrait (facultatif, transmis au membre)" value={noteOf(`w${vehicle.plate}`)} onChange={(e) => setNote(`w${vehicle.plate}`, e.target.value)} />
                                        <Button size="sm" variant="danger" disabled={busy} onClick={() => run(async () => { await withdrawVehicle(request, { note: noteOf(`w${vehicle.plate}`), name }); setWithdrawing(''); }, 'Véhicule retiré.')}>Confirmer</Button>
                                    </div>
                                </td></tr>
                            )}
                        </React.Fragment>
                    );
                })}</tbody>
            </Table>

            {history.length > 0 && (
                <>
                    <h6 className="mt-4">Historique</h6>
                    <div className="thc-scroll">
                        <Table size="sm" className="thc-table">
                            <thead><tr><th>Date</th><th>Membre</th><th>Véhicule</th><th>État</th><th>Remarque</th></tr></thead>
                            <tbody>{history.map((request) => (
                                <tr key={`${request.uid}-${request.id}`}><td>{formatDate(request.demandeLe)}</td><td>{request.demandeurNom}</td><td>{request.plaque}</td><td><StatusBadge statut={request.statut} /></td><td>{request.finNote || request.decisionNote || ''}</td></tr>
                            ))}</tbody>
                        </Table>
                    </div>
                </>
            )}
        </>
    );
};

// `canManage` : Direction, administration, admins. `initialTab` : onglet à l'ouverture (ex. depuis une notification).
const TakeHomeCarModal = ({ show, onHide, canManage, showNotification, initialTab }) => {
    const { staffName, currentEmployee } = useEmployeeAuth();
    const canRequest = !!staffName;
    const [tab, setTab] = useState('rules');
    const [myRequests, setMyRequests] = useState([]);
    const [allRequests, setAllRequests] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [busy, setBusy] = useState(false);
    const uid = auth.currentUser?.uid;

    useEffect(() => { if (show) setTab(initialTab === 'manage' || !canRequest ? (canManage ? 'manage' : 'rules') : 'mine'); }, [show, initialTab, canRequest, canManage]);
    useEffect(() => (show && canRequest && uid ? subscribeMyRequests(uid, setMyRequests) : undefined), [show, canRequest, uid]);
    useEffect(() => (show && canManage ? subscribeAllRequests(setAllRequests) : undefined), [show, canManage]);
    useEffect(() => (show ? subscribeAssignments(setAssignments) : undefined), [show]);

    const run = async (action, success) => {
        setBusy(true);
        try {
            await action();
            if (success) showNotification(success, 'check-circle');
        } catch (error) {
            showNotification(String(error?.message || error).slice(0, 160), 'error');
        } finally {
            setBusy(false);
        }
    };

    const pendingCount = useMemo(() => allRequests.filter((request) => request.statut === 'en_attente').length, [allRequests]);
    const actorName = staffName || currentEmployee?.email || '';

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Take Home Car" modalSize="large" zIndex={1100} className="dark-ui">
            <Nav variant="tabs" activeKey={tab} onSelect={setTab} className="mb-3">
                {canRequest && <Nav.Item><Nav.Link eventKey="mine">Ma demande</Nav.Link></Nav.Item>}
                {canManage && <Nav.Item><Nav.Link eventKey="manage">Gestion {pendingCount > 0 && <Badge bg="warning" text="dark">{pendingCount}</Badge>}</Nav.Link></Nav.Item>}
                <Nav.Item><Nav.Link eventKey="rules">Règlement</Nav.Link></Nav.Item>
            </Nav>
            {tab === 'rules' && <Rules />}
            {tab === 'mine' && canRequest && <MyRequest requests={myRequests} assignments={assignments} name={staffName} run={run} busy={busy} />}
            {tab === 'manage' && canManage && <Management requests={allRequests} assignments={assignments} name={actorName} run={run} busy={busy} />}
        </BaseModal>
    );
};

export default TakeHomeCarModal;
