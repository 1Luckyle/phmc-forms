// src/components/Admin/users/RankMigrationPanel.js
//
// Outil « Rôles en français » (Utilisateurs → Outils) : passe les rôles du personnel des anciennes
// valeurs anglaises aux rôles français et pose la famille (pôle) de chaque fiche. Essai à blanc d'abord
// (rien n'est écrit), sauvegarde automatique avant l'écriture, restauration possible.
import React, { useState } from 'react';
import { Alert, Badge, Button, Spinner, Table } from 'react-bootstrap';
import { planRankMigration, applyRankMigration, loadRankBackups, restoreRankBackup } from '../../../utils/staffRankMigration';
import { STAFF_FAMILIES } from '../../../constants/ranks';
import { sendAdminActionWebhook } from '../adminUtils';

const RankMigrationPanel = ({ adminEmail, showNotification, onDone }) => {
    const [items, setItems] = useState(null);
    const [backups, setBackups] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const guard = async (fn) => {
        setBusy(true);
        setError('');
        try { await fn(); } catch (err) { console.error(err); setError(err.message || String(err)); } finally { setBusy(false); }
    };

    const analyse = () => guard(async () => {
        setItems(await planRankMigration());
        setBackups(await loadRankBackups());
    });

    const toMigrate = (items || []).filter((item) => item.changed);
    const ambiguous = toMigrate.filter((item) => item.ambiguous);
    const problems = (items || []).filter((item) => item.unknown || item.wrongList);

    const apply = () => guard(async () => {
        if (!window.confirm(`Migrer ${toMigrate.length} fiche(s) vers les rôles français ?\n\nLes anciennes valeurs sont sauvegardées avant l'écriture et peuvent être restaurées ici.`)) return;
        const result = await applyRankMigration(items, adminEmail);
        sendAdminActionWebhook(adminEmail, 'Migration des rôles en français', `${result.migrated} fiche(s) migrée(s)\nSauvegarde : ${result.backupId}`, null, 'Admin');
        showNotification(`${result.migrated} fiche(s) migrée(s) vers les rôles français.`, 'success');
        setItems(await planRankMigration());
        setBackups(await loadRankBackups());
        if (onDone) onDone();
    });

    const restore = (backup) => guard(async () => {
        if (!window.confirm(`Restaurer la sauvegarde du ${new Date(backup.createdAt).toLocaleString('fr-FR')} (${backup.count} fiche(s)) ? Les rôles reviendront à leurs anciennes valeurs.`)) return;
        const count = await restoreRankBackup(backup.id);
        sendAdminActionWebhook(adminEmail, 'Restauration des rôles', `${count} fiche(s) restaurée(s)\nSauvegarde : ${backup.id}`, null, 'Admin');
        showNotification(`${count} fiche(s) restaurée(s).`, 'info');
        setItems(await planRankMigration());
        if (onDone) onDone();
    });

    return (
        <div className="mb-4">
            <h6><i className="fas fa-language me-2"></i>Rôles en français</h6>
            <p className="text-muted small">
                Remplace les anciens rôles anglais (« Registered Nurse », « Physician »…) par les rôles français et classe chaque fiche dans sa famille
                (PHMC Soignant, Administration & Direction, Polyvalent, DMEC). Le badge, le nom et les rapports ne changent pas.
                Tant que ce n'est pas fait, l'application affiche déjà les rôles en français, mais la base garde les anciennes valeurs.
            </p>
            <div className="d-flex gap-2 flex-wrap mb-2">
                <Button size="sm" variant="outline-primary" onClick={analyse} disabled={busy}>
                    {busy && !items ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-search me-1"></i>Analyser (essai à blanc)</>}
                </Button>
                {items && toMigrate.length > 0 && (
                    <Button size="sm" variant="success" onClick={apply} disabled={busy}>
                        <i className="fas fa-check me-1"></i>Appliquer la migration ({toMigrate.length})
                    </Button>
                )}
            </div>
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}

            {items && (
                <>
                    <p className="small mb-2">
                        {items.length} fiche(s) lue(s) : <strong>{toMigrate.length}</strong> à migrer, {items.length - toMigrate.length - problems.length} déjà conformes
                        {problems.length > 0 && <>, <strong className="text-danger">{problems.length} à corriger à la main</strong></>}.
                    </p>
                    {ambiguous.length > 0 && (
                        <Alert variant="warning" className="py-2 small">
                            {ambiguous.length} fiche(s) ont un ancien rôle sans équivalent certain (« Physician » → Médecin Titulaire, « Nurse » → Aide Soignant(e)) :
                            après la migration, ajustez-les au cas par cas dans « Modifier » si besoin (ex. Docteur Junior, Infirmier).
                        </Alert>
                    )}
                    {(toMigrate.length > 0 || problems.length > 0) && (
                        <div className="table-responsive" style={{ maxHeight: 320, overflowY: 'auto' }}>
                            <Table size="sm" className="align-middle">
                                <thead><tr><th>Nom</th><th>Liste</th><th>Ancien rôle</th><th>Nouveau rôle</th><th>Famille</th><th></th></tr></thead>
                                <tbody>
                                    {[...toMigrate, ...problems].map((item) => (
                                        <tr key={item.path}>
                                            <td>{item.name}</td>
                                            <td>{item.service === 'coroner' ? 'DMEC' : 'PHMC'}</td>
                                            <td>{item.from || '—'}</td>
                                            <td>{item.unknown ? <em className="text-danger">rôle inconnu</em> : item.to}</td>
                                            <td>{item.pole ? STAFF_FAMILIES[item.pole].short : '—'}</td>
                                            <td>
                                                {item.ambiguous && <Badge bg="warning" text="dark">à vérifier</Badge>}
                                                {item.wrongList && <Badge bg="danger">mauvaise liste</Badge>}
                                                {item.unknown && <Badge bg="danger">à corriger</Badge>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </>
            )}

            {backups.length > 0 && (
                <div className="mt-2">
                    <div className="small fw-semibold mb-1">Sauvegardes</div>
                    {backups.map((backup) => (
                        <div key={backup.id} className="d-flex align-items-center gap-2 small mb-1">
                            <span>{new Date(backup.createdAt).toLocaleString('fr-FR')} — {backup.count} fiche(s){backup.by ? ` — ${backup.by}` : ''}</span>
                            <Button size="sm" variant="outline-warning" onClick={() => restore(backup)} disabled={busy}>Restaurer</Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RankMigrationPanel;
