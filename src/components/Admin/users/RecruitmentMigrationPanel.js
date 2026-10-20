// src/components/Admin/users/RecruitmentMigrationPanel.js
//
// Outil « Recrutement en français » (Utilisateurs → Outils) : passe postes, candidatures, contrats, rôles
// « en attente de contrat » et droit Recruteur du schéma anglais au schéma français (voir
// utils/recruitmentMigration.js). Trois étapes volontairement séparées :
//   1. Analyser   — lecture seule, montre ce qui serait copié ;
//   2. Migrer     — COPIE vers les nouveaux nœuds ; l'ancien schéma reste intact et continue d'être lu ;
//   3. Nettoyer   — après vérification : sauvegarde puis suppression des anciens nœuds.
import React, { useState } from 'react';
import { Alert, Badge, Button, Form, Spinner, Table } from 'react-bootstrap';
import {
    planRecruitmentMigration, summarizePlan, applyRecruitmentMigration, cleanupLegacyRecruitment,
} from '../../../utils/recruitmentMigration';
import { sendAdminActionWebhook } from '../adminUtils';

const RecruitmentMigrationPanel = ({ adminEmail, showNotification }) => {
    const [plan, setPlan] = useState(null);
    const [translate, setTranslate] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const guard = async (fn) => {
        setBusy(true);
        setError('');
        try { await fn(); } catch (err) { console.error(err); setError(err.message || String(err)); } finally { setBusy(false); }
    };

    const analyse = () => guard(async () => setPlan(await planRecruitmentMigration({ translate })));
    const summary = plan ? summarizePlan(plan) : null;

    const migrate = () => guard(async () => {
        if (!window.confirm(`Copier ${summary.total} élément(s) vers le schéma français ?\n\nL'ancien schéma n'est PAS supprimé : l'application continue de le lire tant que vous ne lancez pas le nettoyage.`)) return;
        const result = await applyRecruitmentMigration(plan);
        sendAdminActionWebhook(adminEmail, 'Migration du recrutement en français', `${result.written} écriture(s) vers le nouveau schéma\nTraductions proposées : ${translate ? 'appliquées (textes inchangés uniquement)' : 'non appliquées'}`, null, 'Admin');
        showNotification(`${result.written} élément(s) copiés vers le schéma français.`, 'success');
        setPlan(await planRecruitmentMigration({ translate }));
    });

    const cleanup = () => guard(async () => {
        if (!window.confirm('Supprimer les anciens nœuds (anglais) du recrutement ?\n\nIls sont d\'abord sauvegardés dans migrationBackups. Vérifiez au préalable les postes, candidatures et contrats dans l\'application.')) return;
        const result = await cleanupLegacyRecruitment();
        sendAdminActionWebhook(adminEmail, 'Nettoyage des anciens nœuds du recrutement', `${result.removed} nœud(s) supprimé(s)\nSauvegarde : migrationBackups/${result.backupId}`, null, 'Admin');
        showNotification(`Anciens nœuds supprimés (sauvegarde : ${result.backupId}).`, 'success');
        setPlan(await planRecruitmentMigration({ translate }));
    });

    return (
        <div className="mb-4">
            <h6><i className="fas fa-language me-2"></i>Recrutement en français</h6>
            <p className="text-muted small">
                Passe en français les <strong>postes</strong> de recrutement (nœuds <code>postes…</code>, champs, statut OUVERT/FERMÉ, rôle du personnel relié),
                les <strong>candidatures</strong> (<code>candidatures</code>), les <strong>contrats</strong> (<code>contrats</code>), les rôles « en attente de contrat » et le droit
                Recruteur. Les textes d'origine sont traduits (diplômes américains conservés) <u>seulement s'ils n'ont pas été modifiés</u> ; les autres restent tels quels et sont signalés.
                Tant que le nettoyage n'est pas fait, l'ancien schéma reste lu : rien ne disparaît.
            </p>
            <div className="d-flex gap-3 flex-wrap align-items-center mb-2">
                <Button size="sm" variant="outline-primary" onClick={analyse} disabled={busy}>
                    {busy && !plan ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-search me-1"></i>Analyser (essai à blanc)</>}
                </Button>
                <Form.Check type="switch" id="recruitment-translate" checked={translate} onChange={(e) => { setTranslate(e.target.checked); setPlan(null); }}
                    label="Appliquer les traductions proposées (textes inchangés)" />
            </div>
            {error && <Alert variant="danger" className="py-2">{error}</Alert>}

            {plan && summary && (
                <>
                    <p className="small mb-2">
                        À migrer : <strong>{summary.positions}</strong> poste(s), <strong>{summary.applications}</strong> candidature(s), <strong>{summary.contracts}</strong> contrat(s),
                        {' '}<strong>{summary.contractIndex}</strong> index, <strong>{summary.candidates}</strong> rôle(s) « attente de contrat », <strong>{summary.recruiters}</strong> recruteur(s).
                        {summary.toTranslate > 0 && <> · <strong>{summary.toTranslate}</strong> poste(s) avec texte(s) à traduire à la main</>}
                        {summary.roleMissing > 0 && <> · <strong>{summary.roleMissing}</strong> poste(s) sans rôle du personnel</>}
                    </p>
                    <div className="d-flex gap-2 flex-wrap mb-3">
                        <Button size="sm" variant="success" onClick={migrate} disabled={busy || summary.total === 0}>
                            <i className="fas fa-copy me-1"></i>Migrer (copie, sans suppression) {summary.total > 0 ? `(${summary.total})` : ''}
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={cleanup} disabled={busy || summary.total > 0}
                            title={summary.total > 0 ? 'Terminez d\'abord la migration' : 'Sauvegarde puis suppression des anciens nœuds'}>
                            <i className="fas fa-broom me-1"></i>Nettoyer les anciens nœuds
                        </Button>
                    </div>

                    {plan.positions.length > 0 && (
                        <div className="table-responsive" style={{ maxHeight: 340, overflowY: 'auto' }}>
                            <Table size="sm" className="align-middle">
                                <thead><tr><th>Catégorie</th><th>Ancienne clé → nouvelle clé</th><th>Rôle du personnel</th><th>Textes</th></tr></thead>
                                <tbody>
                                    {plan.positions.map((item) => (
                                        <tr key={`${item.category}-${item.oldKey}`} className={item.alreadyDone ? 'text-muted' : ''}>
                                            <td>{item.categoryLabel}</td>
                                            <td>{item.oldKey} <span className="text-muted">→</span> <strong>{item.newKey}</strong>{item.alreadyDone && <Badge bg="secondary" className="ms-1">déjà migré</Badge>}</td>
                                            <td>{item.position.role || <Badge bg="warning" text="dark">à définir</Badge>}</td>
                                            <td>
                                                {item.translated.length > 0 && <Badge bg="success" className="me-1">{item.translated.length} traduit(s)</Badge>}
                                                {item.toTranslate.length > 0 && <Badge bg="warning" text="dark">à traduire : {item.toTranslate.join(', ')}</Badge>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default RecruitmentMigrationPanel;
