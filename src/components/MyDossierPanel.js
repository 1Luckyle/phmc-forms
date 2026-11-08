// src/components/MyDossierPanel.js
//
// « Mon dossier médical » (Mon profil) : le dossier du patient au format PHMC, ses jetons gratuits et les formulaires qui l'ont alimenté, avec leur état :
//   • à payer (brouillon) : rien n'est appliqué, modifiable et supprimable par son patient ;
//   • payé depuis moins de 15 minutes : pas encore appliqué, modifiable et supprimable (le compte à rebours est affiché) ;
//   • appliqué : verrouillé. Une information fausse se corrige par la « Mise à jour du dossier médical » ; sur un formulaire rempli par le personnel, le patient peut
//     la signaler et reçoit un jeton gratuit de mise à jour.
// Règles : utils/dossierCore.js. Le dossier lui-même n'est écrit que par le serveur.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Dropdown } from 'react-bootstrap';
import { ReportPreviewFrame, ExpandToggle } from './ReportExpansion';
import { copyToClipboard } from './notificationService';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../utils/reportDocumentExport';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../utils/reportExport';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { loadDossierContext, loadAccountIdentity, canModifyForm, reportDossierError } from '../utils/dossierPatient';
import { deleteReportWithRules } from '../utils/patientRecords';
import { dossierBbCode, formatDossierDate } from '../utils/dossierView';
import { getFormLabel } from '../formDefinitions';

const PHASE = {
    brouillon: { text: 'À payer', bg: 'warning' },
    fenetre: { text: 'En attente d\'application', bg: 'info' },
    verrouille: { text: 'Appliqué', bg: 'success' },
};
const TOKEN_LABELS = { basique: 'Dossier Basique', avance: 'Dossier Avancé', maj: 'Mise à jour' };
const cardStyle = { border: '1px solid #30363d', borderRadius: 6, padding: '10px 12px', background: '#0d1117', marginBottom: 10 };
const mutedStyle = { color: '#8b949e', fontSize: '0.8rem' };

const minutesLeft = (lockAt, now) => Math.max(0, Math.ceil((lockAt - now) / 60000));

// identity : champs d'identité du compte (profil) qui priment sur le dossier : { patientFirstName, patientPH, ..., patientEmail }.
// staffView : le personnel consulte le dossier d'un patient (« Dossier Patient ») : mêmes informations, formulées pour lui, sans les actions réservées au patient.
const MyDossierPanel = ({ patientID, identity = {}, showNotification, onLoadForm, staffView = false }) => {
    const { isCivilian, isAdmin, staffName, myPatientID } = useEmployeeAuth();
    const [context, setContext] = useState(null);
    const [loading, setLoading] = useState(false);
    const [busyKey, setBusyKey] = useState('');
    const [reported, setReported] = useState({});
    const [now, setNow] = useState(Date.now());
    const [previewOpen, setPreviewOpen] = useState(false);
    const { bbcodeEnabled } = useSiteConfig();

    const reload = useCallback(async () => {
        if (!patientID) return;
        setLoading(true);
        try { setContext(await loadDossierContext(patientID, Date.now(), staffView ? null : { myPatientID, staffName })); } catch (error) { setContext(null); } finally { setLoading(false); }
    }, [patientID, staffView, myPatientID, staffName]);
    useEffect(() => { reload(); }, [reload]);
    // Le compte à rebours des 15 minutes se met à jour chaque 30 secondes.
    useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);

    // Vue du personnel : l'identité vient du compte du patient, comme dans son propre « Mon profil » (sinon le personnel verrait le dossier brut, sans les coordonnées modifiées depuis).
    const [accountIdentity, setAccountIdentity] = useState({});
    useEffect(() => {
        let cancelled = false;
        if (!staffView || !patientID) { setAccountIdentity({}); return undefined; }
        loadAccountIdentity(patientID).then((found) => { if (!cancelled) setAccountIdentity(found); });
        return () => { cancelled = true; };
    }, [staffView, patientID]);
    const shownIdentity = staffView ? accountIdentity : identity;
    const bbCode = useMemo(() => (context && context.dossier && context.dossier.donnees ? dossierBbCode(context.dossier.donnees, { patientID: context.patientNode, ...shownIdentity }) : ''), [context, shownIdentity]);
    const exportTitle = `Dossier médical - ${context ? context.patientNode : patientID}`;
    const notify = (message, icon = 'info-circle') => { if (showNotification) showNotification(message, icon, 7000); };

    const remove = async (form) => {
        if (!window.confirm(`Supprimer « ${form.title} » ?${form.phase === 'fenetre' && form.createur === 'patient' ? '\n\nIl n\'alimentera pas votre dossier. Si vous aviez payé, vous recevez un jeton gratuit pour ce formulaire.' : ''}`)) return;
        setBusyKey(form.key);
        try {
            const outcome = await deleteReportWithRules(
                { reportPath: form.reportPath, indexKey: form.key, patientID: context.patientNode, patientNode: context.patientNode },
                { role: isCivilian ? 'civil' : 'staff', isAdmin, staffName, myPatientID: staffView ? '' : myPatientID },
            );
            notify(outcome.message || 'Formulaire supprimé.', outcome.ok ? 'check-circle' : 'exclamation-circle');
            await reload();
        } catch (error) {
            notify(`Suppression impossible : ${error.message || 'erreur'}`, 'exclamation-circle');
        } finally {
            setBusyKey('');
        }
    };

    const reportError = async (form) => {
        setBusyKey(form.key);
        try {
            await reportDossierError(context.patientNode, form.key);
            setReported((prev) => ({ ...prev, [form.key]: true }));
            notify('Erreur signalée : un jeton gratuit de « Mise à jour du dossier médical » vous sera accordé dans la minute.', 'check-circle');
        } catch (error) {
            notify('Le signalement a échoué (déjà signalé ?).', 'exclamation-circle');
        } finally {
            setBusyKey('');
        }
    };

    if (!patientID) return <div style={mutedStyle}>Aucun ID patient lié à ce compte.</div>;
    if (loading && !context) return <div style={mutedStyle}>Chargement du dossier…</div>;
    if (!context) return <div style={mutedStyle}>Le dossier n'a pas pu être chargé.</div>;

    const tokens = Object.entries(context.tokens).filter(([, count]) => Number(count) > 0);
    // Le panneau « Mon dossier » est celui du patient lui-même (Civil ou membre du personnel) ; en vue du personnel (Dossier Patient), la personne agit comme personnel.
    const actor = { role: isAdmin ? 'admin' : (staffView ? 'personnel' : 'patient') };

    return (
        <div data-no-tip="1">
            <div className="d-flex justify-content-between align-items-center mb-2">
                <strong><i className="fas fa-notes-medical me-2"></i>{staffView ? 'Dossier médical du patient' : 'Mon dossier médical'}</strong>
                <Button size="sm" variant="outline-secondary" onClick={reload} disabled={loading}><i className="fas fa-rotate me-1"></i>Actualiser</Button>
            </div>

            {context.access.initialised
                ? (context.dossier && context.dossier.majLe ? <div style={{ ...mutedStyle, marginBottom: 6 }}>Dernière mise à jour du dossier : {formatDossierDate(context.dossier.majLe)}. Pour le compléter ou le corriger : « Mise à jour du dossier médical ».</div> : null)
                : staffView
                    ? <div style={{ ...cardStyle, borderColor: '#d29922' }}>Le dossier médical de ce patient n'est pas encore créé (Dossier Médical Basique ou Avancé, appliqué 15 minutes après son paiement).</div>
                    : <div style={{ ...cardStyle, borderColor: '#d29922' }}>Votre dossier médical n'est pas encore créé : remplissez le <strong>Dossier Médical Basique</strong> ou le <strong>Dossier Médical Avancé</strong> (il est appliqué 15 minutes après son paiement).</div>}

            {tokens.length > 0 && (
                <div style={{ ...cardStyle, borderColor: '#3fb950' }}>
                    <i className="fas fa-ticket me-2"></i>Jetons gratuits : {tokens.map(([kind, count]) => `${count} × ${TOKEN_LABELS[kind] || kind}`).join(' · ')}. Un jeton s'utilise automatiquement au prochain formulaire du même type.
                </div>
            )}

            {bbCode && (
                <div style={{ marginBottom: 12 }}>
                    {/* Mêmes actions que sur un rapport : montrer / cacher l'aperçu, et copier ou exporter le dossier médical. */}
                    <div className="d-flex align-items-center gap-2 mb-2">
                        <ExpandToggle open={previewOpen} onClick={() => setPreviewOpen((value) => !value)} title="Montrer ou cacher l'aperçu du dossier médical" />
                        <Dropdown className="d-inline-block">
                            <Dropdown.Toggle size="sm" variant="secondary">Copier</Dropdown.Toggle>
                            <Dropdown.Menu className="dossier-menu" popperConfig={{ strategy: 'fixed' }}>
                                {bbcodeEnabled && (
                                    <Dropdown.Item onClick={() => copyToClipboard(bbCode, showNotification, 'BBCode copié !')} title={COPY_BBCODE_HINT}>Copier le BBCode</Dropdown.Item>
                                )}
                                <Dropdown.Item onClick={() => downloadBbCodeAsHtml({ bbCode, title: exportTitle, showNotification })} title={DOWNLOAD_HTML_HINT}>Télécharger le HTML</Dropdown.Item>
                                <Dropdown.Item onClick={() => exportReportDocument('pdf', { bbCode, title: exportTitle, showNotification })}>{PDF_EXPORT_LABEL}</Dropdown.Item>
                                <Dropdown.Item onClick={() => exportReportDocument('png', { bbCode, title: exportTitle, showNotification })}>Télécharger l'image (PNG, pour Discord)</Dropdown.Item>
                                <Dropdown.Item onClick={() => exportReportDocument('png-copy', { bbCode, title: exportTitle, showNotification })}>Copier l'image (à coller dans Discord)</Dropdown.Item>
                                <Dropdown.Item onClick={() => copyToClipboard(exportTitle, showNotification, 'Titre copié !')}>Copier le titre</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </div>
                    {previewOpen && <ReportPreviewFrame bbCode={bbCode} title={exportTitle} height={420} />}
                </div>
            )}

            <strong className="d-block mb-2">Formulaires du dossier</strong>
            {context.forms.length === 0 && <div style={mutedStyle}>Aucun formulaire de dossier pour l'instant.</div>}
            {context.forms.map((form) => {
                const phase = PHASE[form.phase] || PHASE.brouillon;
                const allowed = canModifyForm(form, actor);
                const staffPaid = form.createur === 'personnel' && form.invoice && form.invoice.statutEffectif === 'paye';
                return (
                    <div key={form.key} style={cardStyle}>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                            <Badge bg={phase.bg} text={phase.bg === 'warning' || phase.bg === 'info' ? 'dark' : undefined}>{phase.text}</Badge>
                            <strong style={{ overflowWrap: 'anywhere' }}>{form.title}</strong>
                            <span style={mutedStyle}>{getFormLabel(form.version)} · {formatDossierDate(form.timestamp)}{form.createur === 'personnel' ? ` · rempli par ${form.authorName || 'le personnel'}` : ''}</span>
                        </div>
                        <div style={{ ...mutedStyle, marginTop: 4 }}>
                            {staffView && form.phase === 'brouillon' && 'Brouillon : le patient ne l\'a pas encore payé, rien n\'est appliqué à son dossier.'}
                            {staffView && form.phase === 'fenetre' && `Sera appliqué au dossier dans environ ${minutesLeft(form.lockAt, now)} min.`}
                            {staffView && form.phase === 'verrouille' && 'Appliqué au dossier du patient.'}
                            {!staffView && form.phase === 'brouillon' && (form.createur === 'personnel'
                                ? 'Rempli par le personnel : rien ne change dans votre dossier tant que vous ne l\'avez pas payé (paiement depuis « Mes factures »). Vous ne pouvez pas le modifier.'
                                : 'Pas encore payé : rien n\'est appliqué ; vous pouvez le modifier ou le supprimer.')}
                            {!staffView && form.phase === 'fenetre' && `Sera appliqué à votre dossier dans environ ${minutesLeft(form.lockAt, now)} min.${allowed.remove ? ' Jusque-là vous pouvez le modifier ou le supprimer.' : ''}`}
                            {!staffView && form.phase === 'verrouille' && 'Appliqué à votre dossier : il ne se modifie ni ne se supprime plus. Corrigez via la « Mise à jour du dossier médical ».'}
                        </div>
                        <div className="d-flex flex-wrap gap-2 mt-2">
                            {allowed.edit && onLoadForm && <Button size="sm" variant="outline-primary" onClick={() => onLoadForm(form)} title="Rouvre le formulaire pour le modifier (il est modifié sur place).">Modifier</Button>}
                            {allowed.remove && <Button size="sm" variant="outline-danger" disabled={busyKey === form.key} onClick={() => remove(form)}>Supprimer</Button>}
                            {staffPaid && isCivilian && (
                                <Button size="sm" variant="outline-warning" disabled={busyKey === form.key || reported[form.key]} onClick={() => reportError(form)}
                                    title="Une information de ce formulaire est fausse : vous recevez un jeton gratuit de mise à jour pour la corriger.">
                                    {reported[form.key] ? 'Erreur signalée' : 'Signaler une erreur'}
                                </Button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MyDossierPanel;
