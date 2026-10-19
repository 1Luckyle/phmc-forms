// src/components/Admin/DebugWhitelist.js
//
// Liste blanche (WL) du bouton « Remplir (debug) » : seules les personnes listées ici voient le
// bouton quand le mode debug est activé (voir DebugContext). Les personnes sont proposées depuis
// les fiches du personnel et les comptes Civils ayant un compte de connexion (uid) ; l'admin
// connecté peut aussi s'ajouter lui-même, car un compte admin n'a pas forcément de fiche.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, ListGroup, Badge, Spinner } from 'react-bootstrap';
import { useDebug } from '../../contexts/DebugContext';
import { loadStaffMembers, loadCivilians, STAFF_SERVICES } from '../../utils/staffAdmin';

const DebugWhitelist = ({ currentUser, showInAppNotification }) => {
    const { debugAutofillAllowed, addDebugAutofillUser, removeDebugAutofillUser } = useDebug();
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [busyUid, setBusyUid] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [staff, civilians] = await Promise.all([loadStaffMembers(), loadCivilians()]);
                if (cancelled) return;
                const list = [
                    ...staff.filter((m) => m.uid).map((m) => ({ uid: m.uid, label: m.displayName, kind: STAFF_SERVICES[m.service]?.label || 'Personnel' })),
                    ...civilians.filter((c) => c.uid).map((c) => ({
                        uid: c.uid,
                        label: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.uid,
                        kind: 'Civil',
                    })),
                ];
                setCandidates(list);
            } catch (error) {
                console.error('Impossible de charger les comptes pour la WL debug :', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Noms affichés pour les uid déjà en WL (le label stocké sert de repli si le compte a disparu).
    const labelOf = (uid) => candidates.find((c) => c.uid === uid)?.label || debugAutofillAllowed[uid]?.label || uid;

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return candidates
            .filter((c) => !debugAutofillAllowed[c.uid] && c.label.toLowerCase().includes(q))
            .slice(0, 8);
    }, [candidates, query, debugAutofillAllowed]);

    const run = async (uid, action, successMessage) => {
        setBusyUid(uid);
        try {
            await action();
            if (showInAppNotification) showInAppNotification(successMessage, 'check-circle');
        } catch (error) {
            console.error('Erreur WL debug :', error);
            alert('Impossible de modifier la liste blanche : ' + (error?.message || error));
        } finally {
            setBusyUid(null);
        }
    };

    const add = (uid, label) => run(uid, () => addDebugAutofillUser(uid, label, currentUser?.email), `${label} ajouté(e) à la liste blanche.`).then(() => setQuery(''));
    const remove = (uid) => run(uid, () => removeDebugAutofillUser(uid), `${labelOf(uid)} retiré(e) de la liste blanche.`);

    const allowedEntries = Object.entries(debugAutofillAllowed);
    const selfAllowed = currentUser?.uid && debugAutofillAllowed[currentUser.uid];

    return (
        <div>
            <p className="text-muted">
                <strong>Liste blanche.</strong> Seules les personnes ci-dessous voient le bouton « Remplir (debug) » quand le mode est activé.
                Cela permet de tester directement en production sans l'afficher aux autres utilisateurs. Une personne doit se
                reconnecter avec son compte pour être reconnue.
            </p>

            <div className="d-flex gap-2 mb-2 align-items-center flex-wrap">
                <Form.Control
                    type="search"
                    style={{ maxWidth: 360 }}
                    placeholder="Ajouter une personne (nom du personnel ou du civil)…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {currentUser?.uid && !selfAllowed && (
                    <Button variant="outline-primary" size="sm" disabled={busyUid === currentUser.uid}
                        onClick={() => add(currentUser.uid, currentUser.email || 'Moi (admin)')}>
                        <i className="fas fa-user-plus me-1"></i>M'ajouter
                    </Button>
                )}
                {loading && <Spinner animation="border" size="sm" />}
            </div>

            {results.length > 0 && (
                <ListGroup className="mb-3" style={{ maxWidth: 520 }}>
                    {results.map((c) => (
                        <ListGroup.Item key={c.uid} action disabled={busyUid === c.uid} onClick={() => add(c.uid, c.label)}
                            className="d-flex justify-content-between align-items-center">
                            <span>{c.label}</span>
                            <Badge bg="secondary">{c.kind}</Badge>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
            {query.trim() && !loading && results.length === 0 && (
                <p className="text-muted small">Aucun compte correspondant (ou déjà dans la liste). Seuls les comptes avec un compte de connexion sont proposés.</p>
            )}

            <h6 className="mt-3">Personnes autorisées ({allowedEntries.length})</h6>
            {allowedEntries.length === 0 ? (
                <p className="text-warning small mb-0">
                    <i className="fas fa-exclamation-triangle me-1"></i>
                    Liste vide : personne ne verra le bouton, même avec le mode activé.
                </p>
            ) : (
                <ListGroup style={{ maxWidth: 520 }}>
                    {allowedEntries.map(([uid, entry]) => (
                        <ListGroup.Item key={uid} className="d-flex justify-content-between align-items-center">
                            <span>
                                {labelOf(uid)}
                                {currentUser?.uid === uid && <Badge bg="info" className="ms-2">vous</Badge>}
                            </span>
                            <Button variant="outline-danger" size="sm" disabled={busyUid === uid} onClick={() => remove(uid)}
                                title={entry?.addedBy ? `Ajouté par ${entry.addedBy}` : 'Retirer de la liste blanche'}>
                                <i className="fas fa-times"></i>
                            </Button>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            )}
        </div>
    );
};

export default DebugWhitelist;
