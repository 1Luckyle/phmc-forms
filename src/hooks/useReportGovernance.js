// src/hooks/useReportGovernance.js
//
// Actions « de gouvernance » d'un rapport du DMEC, partagées entre « Rapports enregistrés » et « Dossier Patient » :
//   - Geler / Lever le gel (gel judiciaire : le rapport ne peut plus être modifié, supprimé ni (dé)publié ; seul un admin lève le gel) ;
//   - Publier / Dépublier un Rapport Public de Décès (lisible par tout le personnel une fois publié).
// Le hook garde l'état (gels, publications, fenêtres de saisie) et rend les pastilles, les boutons et les fenêtres. Les droits sont ceux de la
// base : DMEC et admins agissent ; un rapport gelé se lève par un admin uniquement. Un rapport est repéré par son chemin (reportPath).
import React, { useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import useWriteLock from './useWriteLock';
import { Pill } from '../components/Reports/ReportParts';
import { reportTitleOf } from '../utils/patientRecords';
import { readFamiliesOf, isPublicDeathVersion, isDmecReportVersion } from '../utils/reportAccess';
import { loadFreezeMap, freezeReport, liftFreeze, isFrozen, AUTHORITY_TYPES } from '../utils/judicialFreeze';
import { publishReport, unpublishReport } from '../utils/deathReports';

const keyOf = (report) => String(report?.reportPath || '').split('/').pop();
const titleOf = (report) => reportTitleOf(report) || report?.originalKey || '';
const isCopyOf = (report) => !!(report?.isCopy || report?.copiedFrom);

const useReportGovernance = ({ active, showNotification }) => {
    const { isAdmin, staffName, staffProfile } = useEmployeeAuth();
    const { locked, lockTitle } = useWriteLock();
    const viewerIsDmec = isAdmin || readFamiliesOf(staffProfile).dmec;

    const [publishBusy, setPublishBusy] = useState(false);
    const [publishOverrides, setPublishOverrides] = useState({}); // { [clé du rapport]: true | false } après une (dé)publication
    const [unpublishTarget, setUnpublishTarget] = useState(null);
    const [unpublishReason, setUnpublishReason] = useState('');
    // Gel judiciaire : { [clé du rapport]: entrée } ; la fenêtre de saisie sert à geler (autorité, référence, motif) et à lever (justificatif).
    const [freezes, setFreezes] = useState({});
    const [freezeTarget, setFreezeTarget] = useState(null);   // { report, mode: 'freeze' | 'lift' }
    const [freezeForm, setFreezeForm] = useState({ autorite: 'mandat', reference: '', motif: '' });
    const [freezeBusy, setFreezeBusy] = useState(false);

    useEffect(() => {
        if (!active) return undefined;
        let cancelled = false;
        // Une lecture ratée n'efface rien : la suppression et les opérations d'admin revérifient le gel elles-mêmes.
        loadFreezeMap().then((map) => { if (!cancelled) setFreezes(map); }).catch((error) => console.warn('Gels judiciaires illisibles :', error?.message || error));
        return () => { cancelled = true; };
    }, [active]);

    const freezeOf = (report) => freezes[keyOf(report)] || null;
    const frozenOf = (report) => isFrozen(freezeOf(report));
    const isPublicDeath = (report) => isPublicDeathVersion(report.bbCodeVersion) && !isCopyOf(report);
    const isPublishedOf = (report) => isPublicDeath(report) && (publishOverrides[keyOf(report)] ?? report.publie === true);

    const openFreezeDialog = (report, mode) => {
        setFreezeForm({ autorite: 'mandat', reference: '', motif: '' });
        setFreezeTarget({ report, mode });
    };

    const handlePublish = async (report) => {
        if (publishBusy) return;
        if (!window.confirm("Publier ce rapport public de décès ? Tout le personnel du PHMC pourra le consulter (lecture seule). Vous pourrez le dépublier plus tard, avec un justificatif.")) return;
        setPublishBusy(true);
        try {
            await publishReport({ reportPath: report.reportPath, title: titleOf(report), patientID: report.patientID, byName: staffName || 'admin' });
            setPublishOverrides((previous) => ({ ...previous, [keyOf(report)]: true }));
            showNotification('Rapport publié : le personnel peut maintenant le consulter.', 'check-circle');
        } catch (error) {
            console.error('Publication impossible :', error);
            showNotification(`Publication impossible : ${String(error?.message || error).slice(0, 140)}`, 'error');
        } finally {
            setPublishBusy(false);
        }
    };

    const handleConfirmUnpublish = async () => {
        if (!unpublishTarget || publishBusy) return;
        if (!unpublishReason.trim()) { showNotification('Un justificatif est obligatoire pour dépublier un rapport.', 'warning'); return; }
        setPublishBusy(true);
        try {
            await unpublishReport({
                reportPath: unpublishTarget.reportPath, title: titleOf(unpublishTarget),
                patientID: unpublishTarget.patientID, byName: staffName || 'admin', reason: unpublishReason,
            });
            setPublishOverrides((previous) => ({ ...previous, [keyOf(unpublishTarget)]: false }));
            showNotification('Rapport dépublié : le personnel ne peut plus le consulter.', 'check-circle');
            setUnpublishTarget(null);
            setUnpublishReason('');
        } catch (error) {
            console.error('Dépublication impossible :', error);
            showNotification(`Dépublication impossible : ${String(error?.message || error).slice(0, 140)}`, 'error');
        } finally {
            setPublishBusy(false);
        }
    };

    const handleConfirmFreeze = async () => {
        if (!freezeTarget || freezeBusy) return;
        const { report, mode } = freezeTarget;
        const key = keyOf(report);
        setFreezeBusy(true);
        try {
            if (mode === 'freeze') {
                const entry = await freezeReport({
                    reportPath: report.reportPath, title: titleOf(report), patientID: report.patientID,
                    byName: staffName || 'admin', ...freezeForm,
                });
                setFreezes((previous) => ({ ...previous, [key]: entry }));
                showNotification('Rapport gelé : il ne peut plus être modifié, supprimé ni publié.', 'check-circle');
            } else {
                await liftFreeze({
                    reportPath: report.reportPath, title: titleOf(report), patientID: report.patientID,
                    byName: staffName || 'admin', reason: freezeForm.motif,
                });
                setFreezes((previous) => ({ ...previous, [key]: { ...previous[key], actif: false } }));
                showNotification('Gel judiciaire levé.', 'check-circle');
            }
            setFreezeTarget(null);
        } catch (error) {
            console.error('Gel judiciaire impossible :', error);
            showNotification(String(error?.message || error).slice(0, 160), 'error');
        } finally {
            setFreezeBusy(false);
        }
    };

    // Pastilles « Publié » et « Gel judiciaire ».
    const chips = (report) => {
        const freeze = freezeOf(report);
        return (
            <>
                {isPublishedOf(report) && <Pill color="#58a6ff" title="Publié : tout le personnel du PHMC peut le consulter">Publié</Pill>}
                {isFrozen(freeze) && <Pill color="#f85149" title={`Gel judiciaire depuis le ${new Date(freeze.depuis).toLocaleDateString('fr-FR')} (${AUTHORITY_TYPES[freeze.autorite] || 'autorité'}${freeze.reference ? ` ${freeze.reference}` : ''}) : ${freeze.motif}`}>Gel judiciaire</Pill>}
            </>
        );
    };

    // Boutons Geler / Lever le gel / Publier / Dépublier, selon les droits de la personne et l'état du rapport.
    const buttons = (report, { disabled = false } = {}) => {
        const freeze = freezeOf(report);
        const frozen = isFrozen(freeze);
        const published = isPublishedOf(report);
        const canFreeze = viewerIsDmec && isDmecReportVersion(report.bbCodeVersion) && !isCopyOf(report) && !disabled;
        return (
            <>
                {canFreeze && (frozen ? (isAdmin && (
                    <Button size="sm" variant="outline-danger" title="Lever le gel judiciaire (un justificatif est demandé)" disabled={locked || freezeBusy} onClick={() => openFreezeDialog(report, 'lift')}>
                        <i className="fas fa-lock-open me-1"></i>Lever le gel
                    </Button>
                )) : ((isAdmin || !freeze) && (
                    // Un rapport dont le gel a été levé ne se regèle que par un admin (l'historique du gel est conservé).
                    <Button size="sm" variant="outline-danger" title={locked ? lockTitle : 'Geler ce rapport (procédure judiciaire en cours) : plus aucune modification ni suppression'} disabled={locked || freezeBusy} onClick={() => openFreezeDialog(report, 'freeze')}>
                        <i className="fas fa-gavel me-1"></i>Geler
                    </Button>
                )))}
                {isPublicDeath(report) && viewerIsDmec && !disabled && (published ? (
                    <Button
                        size="sm" variant="outline-warning"
                        title={locked ? lockTitle : 'Retirer la publication (un justificatif est demandé)'}
                        disabled={locked || publishBusy || frozen}
                        onClick={() => { setUnpublishReason(''); setUnpublishTarget(report); }}
                    >
                        <i className="fas fa-eye-slash me-1"></i>Dépublier
                    </Button>
                ) : (
                    <Button
                        size="sm" variant="success"
                        title={locked ? lockTitle : 'Rendre ce rapport consultable par tout le personnel du PHMC'}
                        disabled={locked || publishBusy || frozen}
                        onClick={() => handlePublish(report)}
                    >
                        <i className="fas fa-bullhorn me-1"></i>Publier
                    </Button>
                ))}
            </>
        );
    };

    const dialogs = (
        <>
            <Modal show={!!unpublishTarget} onHide={() => { if (!publishBusy) setUnpublishTarget(null); }} centered style={{ zIndex: 1070 }}>
                <Modal.Header closeButton><Modal.Title>Dépublier ce rapport</Modal.Title></Modal.Header>
                <Modal.Body>
                    <p className="mb-2">« {unpublishTarget ? titleOf(unpublishTarget) : ''} » ne sera plus consultable par le personnel. Indiquez le justificatif (il est consigné dans le journal d'activité et sur le rapport).</p>
                    <Form.Control as="textarea" rows={3} maxLength={500} autoFocus value={unpublishReason} onChange={(event) => setUnpublishReason(event.target.value)} placeholder="Justificatif (obligatoire)" />
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setUnpublishTarget(null)} disabled={publishBusy}>Annuler</Button>
                    <Button variant="warning" onClick={handleConfirmUnpublish} disabled={publishBusy || !unpublishReason.trim()}>
                        <i className="fas fa-eye-slash me-1"></i>Dépublier
                    </Button>
                </Modal.Footer>
            </Modal>
            <Modal show={!!freezeTarget} onHide={() => { if (!freezeBusy) setFreezeTarget(null); }} centered style={{ zIndex: 1070 }}>
                <Modal.Header closeButton><Modal.Title>{freezeTarget?.mode === 'lift' ? 'Lever le gel judiciaire' : 'Geler ce rapport'}</Modal.Title></Modal.Header>
                <Modal.Body>
                    {freezeTarget?.mode === 'lift' ? (
                        <>
                            <p className="mb-2">« {titleOf(freezeTarget.report)} » pourra de nouveau être modifié ou supprimé. Indiquez le justificatif (il est consigné dans le journal d'activité et sur le gel).</p>
                            <Form.Control as="textarea" rows={3} maxLength={500} autoFocus value={freezeForm.motif} onChange={(event) => setFreezeForm((f) => ({ ...f, motif: event.target.value }))} placeholder="Justificatif (obligatoire)" />
                        </>
                    ) : (
                        <>
                            <p className="mb-2">Tant que le rapport est gelé, plus personne ne peut le modifier, le supprimer, le publier ou le dépublier. Seul un administrateur peut lever le gel, avec un justificatif.</p>
                            <Form.Group className="mb-2">
                                <Form.Label>Autorité à l'origine du gel</Form.Label>
                                <Form.Select value={freezeForm.autorite} onChange={(event) => setFreezeForm((f) => ({ ...f, autorite: event.target.value }))}>
                                    {Object.entries(AUTHORITY_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Référence <small className="text-muted">(n° de mandat, de dossier… facultatif)</small></Form.Label>
                                <Form.Control maxLength={120} value={freezeForm.reference} onChange={(event) => setFreezeForm((f) => ({ ...f, reference: event.target.value }))} />
                            </Form.Group>
                            <Form.Group>
                                <Form.Label>Motif du gel</Form.Label>
                                <Form.Control as="textarea" rows={2} maxLength={500} autoFocus value={freezeForm.motif} onChange={(event) => setFreezeForm((f) => ({ ...f, motif: event.target.value }))} />
                            </Form.Group>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setFreezeTarget(null)} disabled={freezeBusy}>Annuler</Button>
                    <Button variant="danger" onClick={handleConfirmFreeze} disabled={freezeBusy || freezeForm.motif.trim().length < 3}>
                        <i className={`fas ${freezeTarget?.mode === 'lift' ? 'fa-lock-open' : 'fa-gavel'} me-1`}></i>{freezeTarget?.mode === 'lift' ? 'Lever le gel' : 'Geler le rapport'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );

    return { viewerIsDmec, isFrozen: frozenOf, isPublished: isPublishedOf, chips, buttons, dialogs };
};

export default useReportGovernance;
