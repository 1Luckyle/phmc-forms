// src/components/Admin/UserManagementModal.js
//
// « Migrer des rapports » (Utilisateurs → Outils) : déplace les rapports enregistrés d'un rédacteur vers un autre (compte en double, ancien nom,
// fiche reprise par une autre personne). Avant d'écrire, la fenêtre montre ce qui va bouger et ce qui restera en conflit ; la destination est
// sauvegardée (migrationBackups) et les dossiers patients suivent les rapports déplacés.
//
// Les anciens boutons « Nettoyer / Migrer tous les noms d'utilisateur » ont été retirés : ils renommaient en masse les nœuds de rapports sans
// mettre à jour les dossiers patients ni le nœud de chaque compte (noeudsRapports), et les rapports se rangent désormais sous le nom de la fiche.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { ref, get, set, update } from 'firebase/database';
import BaseModal from '../BaseModal';
import { normalizePatientId } from '../../utils/patientRecords';
import { assertNoneFrozen } from '../../utils/judicialFreeze';
import { logActivity } from '../../utils/activityLog';
import './UserManagementModal.css';

const nodeLabel = (node) => node.replace(/_/g, ' ');
const sanitizeForFirebasePath = (str) => str.replace(/[.#$[/ \]]/g, '_');

const UserManagementModal = ({ show, onHide, database, showNotification }) => {
    const [nodes, setNodes] = useState(null);     // { [nœud]: [identifiants de rapports] }
    const [source, setSource] = useState('');
    const [destination, setDestination] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const loadNodes = async () => {
        try {
            const snapshot = await get(ref(database, 'savedReports'));
            const value = snapshot.exists() ? snapshot.val() : {};
            setNodes(Object.fromEntries(Object.entries(value).map(([node, reports]) => [node, Object.keys(reports || {})])));
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Impossible de récupérer les rédacteurs. Veuillez réessayer plus tard.');
            setNodes({});
        }
    };

    useEffect(() => {
        if (show) { setNodes(null); setSource(''); setDestination(''); setError(''); loadNodes(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    const names = useMemo(() => Object.keys(nodes || {}).sort((a, b) => nodeLabel(a).localeCompare(nodeLabel(b))), [nodes]);

    // Ce que la migration ferait : rapports déplacés, et rapports de même identifiant déjà présents chez la destination (laissés chez la source).
    const plan = useMemo(() => {
        if (!nodes || !source || !destination || source === destination) return null;
        const destinationKeys = new Set(nodes[destination] || []);
        const sourceKeys = nodes[source] || [];
        const conflicts = sourceKeys.filter((key) => destinationKeys.has(key));
        return { total: sourceKeys.length, moved: sourceKeys.length - conflicts.length, conflicts: conflicts.length, destinationCount: destinationKeys.size };
    }, [nodes, source, destination]);

    const handleMigrate = async () => {
        if (!plan) return;
        if (plan.moved === 0) { setError('Aucun rapport à déplacer : tous ceux de la source existent déjà chez la destination.'); return; }
        if (!window.confirm(`Déplacer ${plan.moved} rapport(s) de « ${nodeLabel(source)} » vers « ${nodeLabel(destination)} » ?\n\n`
            + `${plan.conflicts > 0 ? `${plan.conflicts} rapport(s) en conflit resteront chez « ${nodeLabel(source)} ».\n` : ''}La destination est sauvegardée avant l'écriture.`)) return;

        setError('');
        setBusy(true);
        const sourceRef = ref(database, `savedReports/${source}`);
        const destinationRef = ref(database, `savedReports/${destination}`);
        const backupDate = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
        const backupRef = ref(database, `migrationBackups/${sanitizeForFirebasePath(destination)}_${backupDate}`);
        let destinationBackup = null;
        let destinationWritten = false;

        try {
            const sourceSnapshot = await get(sourceRef);
            if (!sourceSnapshot.exists()) { showNotification("Le rédacteur source n'a pas de rapports à migrer.", 'warning'); return; }
            const sourceReports = sourceSnapshot.val();
            await assertNoneFrozen(Object.keys(sourceReports));

            const destinationSnapshot = await get(destinationRef);
            if (destinationSnapshot.exists()) {
                destinationBackup = destinationSnapshot.val();
                await set(backupRef, destinationBackup);
            }

            const merged = { ...(destinationBackup || {}) };
            const conflictedReports = [];
            const movedKeys = [];
            Object.keys(sourceReports).forEach((key) => {
                if (merged[key]) conflictedReports.push(key);
                else { merged[key] = sourceReports[key]; movedKeys.push(key); }
            });

            await set(destinationRef, merged);
            destinationWritten = true;
            // Seuls les rapports déplacés quittent la source : ceux en conflit y restent au lieu d'être perdus.
            const removals = {};
            movedKeys.forEach((key) => { removals[`savedReports/${source}/${key}`] = null; });
            await update(ref(database), removals);

            // Les dossiers patients pointent vers l'ANCIEN chemin (savedReports/{source}/…) : on les redirige, on corrige le nom d'auteur
            // (une adresse e-mail devient le nom du médecin) et les marqueurs « copié par » des rapports d'origine.
            try {
                const nameCounts = {};
                Object.values(destinationBackup || {}).forEach((report) => {
                    if (report && report.authorName) nameCounts[report.authorName] = (nameCounts[report.authorName] || 0) + 1;
                });
                const knownDestinationName = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
                const destinationAuthorName = knownDestinationName || nodeLabel(destination);
                const indexUpdates = {};
                movedKeys.forEach((key) => {
                    const report = sourceReports[key] || {};
                    const newPath = `savedReports/${destination}/${key}`;
                    const wasSelfCreated = !report.creatorName || report.creatorName === report.authorName;
                    indexUpdates[`${newPath}/authorName`] = destinationAuthorName;
                    if (wasSelfCreated) indexUpdates[`${newPath}/creatorName`] = destinationAuthorName;
                    const patientNode = normalizePatientId(report.data && report.data.patientID);
                    if (patientNode) {
                        indexUpdates[`patientRecords/${patientNode}/${key}/reportPath`] = newPath;
                        indexUpdates[`patientRecords/${patientNode}/${key}/authorName`] = destinationAuthorName;
                        if (wasSelfCreated) indexUpdates[`patientRecords/${patientNode}/${key}/creatorName`] = destinationAuthorName;
                    }
                    if (report.copiedFrom && report.copiedFrom.patientNode && report.copiedFrom.indexKey) {
                        const base = `patientRecords/${report.copiedFrom.patientNode}/${report.copiedFrom.indexKey}/copiedBy`;
                        indexUpdates[`${base}/${source}`] = null;
                        indexUpdates[`${base}/${destination}`] = key;
                    }
                });
                if (Object.keys(indexUpdates).length > 0) await update(ref(database), indexUpdates);
            } catch (indexError) {
                console.warn('Reports migrated but patient records could not be updated:', indexError);
                showNotification("Rapports migrés, mais l'index des dossiers patients n'a pas pu être mis à jour : utilisez « Réindexer les dossiers patients ».", 'warning');
            }

            logActivity({
                category: 'rapports', action: 'reports_migrated', severity: 'warning',
                summary: `Rapports migrés : ${movedKeys.length} de ${nodeLabel(source)} vers ${nodeLabel(destination)}`,
                details: conflictedReports.length > 0 ? `${conflictedReports.length} rapport(s) en conflit laissé(s) chez la source.` : undefined,
                target: nodeLabel(destination),
            });
            showNotification(conflictedReports.length > 0
                ? `Migration terminée : ${movedKeys.length} rapport(s) déplacé(s), ${conflictedReports.length} en conflit laissé(s) chez la source.`
                : `${movedKeys.length} rapport(s) migré(s) vers ${nodeLabel(destination)}.`, conflictedReports.length > 0 ? 'warning' : 'success');
            onHide();
        } catch (err) {
            console.error('Error migrating data:', err);
            showNotification(`Erreur lors de la migration des données : ${err.message}`, 'error');
            if (destinationWritten || destinationBackup) {
                try {
                    await set(destinationRef, destinationBackup);
                    showNotification("La migration a échoué. Les rapports d'origine de la destination ont été restaurés.", 'info');
                } catch (restoreError) {
                    console.error('Restore failed:', restoreError);
                }
            }
        } finally {
            setBusy(false);
        }
    };

    const optionLabel = (node) => `${nodeLabel(node)} — ${(nodes[node] || []).length} rapport(s)`;

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Migrer des rapports" modalSize="medium" zIndex={1100} className="um-modal">
            <p className="um-intro">
                Déplace les rapports d'un rédacteur vers un autre : compte en double, ancien nom, fiche reprise par quelqu'un d'autre. Les dossiers patients suivent les rapports.
            </p>
            {error && <Alert variant="danger" className="py-2" dismissible onClose={() => setError('')}>{error}</Alert>}
            {!nodes ? <div className="text-center py-4"><Spinner animation="border" /></div> : (
                <>
                    <div className="um-pair">
                        <Form.Group>
                            <Form.Label>Depuis (source)</Form.Label>
                            <Form.Select value={source} onChange={(e) => setSource(e.target.value)}>
                                <option value="">Choisir un rédacteur…</option>
                                {names.map((node) => <option key={node} value={node} disabled={node === destination}>{optionLabel(node)}</option>)}
                            </Form.Select>
                        </Form.Group>
                        <div className="um-arrow" aria-hidden="true"><i className="fas fa-arrow-right"></i></div>
                        <Form.Group>
                            <Form.Label>Vers (destination)</Form.Label>
                            <Form.Select value={destination} onChange={(e) => setDestination(e.target.value)}>
                                <option value="">Choisir un rédacteur…</option>
                                {names.map((node) => <option key={node} value={node} disabled={node === source}>{optionLabel(node)}</option>)}
                            </Form.Select>
                        </Form.Group>
                    </div>

                    {plan ? (
                        <div className="um-plan" role="status">
                            <div className="um-plan-figures">
                                <div><strong>{plan.moved}</strong><span>rapport(s) déplacé(s)</span></div>
                                <div className={plan.conflicts > 0 ? 'warn' : ''}><strong>{plan.conflicts}</strong><span>en conflit (restent à la source)</span></div>
                                <div><strong>{plan.destinationCount + plan.moved}</strong><span>chez la destination après</span></div>
                            </div>
                            <ul className="um-plan-notes">
                                <li>La destination est sauvegardée dans <code>migrationBackups</code> avant l'écriture ; en cas d'échec, elle est restaurée.</li>
                                {plan.conflicts > 0 && <li>Un rapport est « en conflit » quand la destination en a déjà un de même identifiant : il n'est pas écrasé, et celui de la source reste en place.</li>}
                                <li>Les rapports gelés (gel judiciaire) bloquent la migration.</li>
                            </ul>
                        </div>
                    ) : <p className="um-hint">Choisissez une source et une destination pour voir ce qui sera déplacé.</p>}
                </>
            )}
            <div className="um-footer">
                <Button variant="outline-secondary" onClick={onHide} disabled={busy}>Fermer</Button>
                <Button variant="primary" onClick={handleMigrate} disabled={busy || !plan || plan.moved === 0}>
                    {busy ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-right-left me-2"></i>{plan ? `Migrer ${plan.moved} rapport(s)` : 'Migrer'}</>}
                </Button>
            </div>
        </BaseModal>
    );
};

export default UserManagementModal;
