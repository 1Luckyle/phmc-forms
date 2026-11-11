// src/components/MyPatientFileModal.js
//
// « Mon dossier patient » pour le PERSONNEL : un médecin peut lui aussi être hospitalisé et
// donc avoir un dossier. Les rapports sont rattachés à un ID patient (pas à un rôle) : les
// collègues qui le soignent créent les rapports sur son ID comme sur n'importe quel patient,
// et il retrouve ici ceux qui ont été PARTAGÉS avec lui (comme un civil dans son propre dossier).
//
// L'ID patient est UNIQUE et lié à l'UCP de la personne (personnage GTA World) : il n'est donc
// jamais modifiable ici. Il est déduit de la fiche (PHMC-{personnage}) ; si une fiche n'en a
// pas, seul un administrateur peut le définir (menu Utilisateurs → Personnel → Modifier).
import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Dropdown } from 'react-bootstrap';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { copyToClipboard } from './notificationService';
import { PrescriptionMenuSection } from './PrescriptionMenu';
import { reportLinkUrl, linkTargetOf } from '../utils/reportLinks';
import { loadPatientDossier, reportTitleOf, reportCreatorOf, deleteReportWithRules } from '../utils/patientRecords';
import { loadDossierContext, canModifyForm } from '../utils/dossierPatient';
import { isDossierVersion } from '../utils/dossierCore';
import MyDossierPanel from './MyDossierPanel';
import PatientInvoicesPanel from './PatientInvoicesPanel';
import ExemptionStatusCard from './ExemptionStatusCard';
import ForumHint from './ForumHint';
import useForumNotice from '../hooks/useForumNotice';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../utils/reportExport';
import ReportExpansion, { ExpandToggle, useExpansions } from './ReportExpansion';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../utils/reportDocumentExport';

const overlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};
const contentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px', borderRadius: '5px',
    width: '95%', maxWidth: '900px', maxHeight: '85vh', overflowY: 'auto',
    position: 'relative', border: '1px solid #30363d',
};
const closeStyle = {
    position: 'absolute', top: '12px', right: '15px', background: 'transparent', border: 'none',
    color: '#f85149', fontSize: '28px', lineHeight: 1, cursor: 'pointer',
};
const thStyle = { backgroundColor: '#161b22', border: '1px solid #30363d', padding: '8px 10px', textAlign: 'left' };
const tdStyle = { border: '1px solid #30363d', padding: '8px 10px', verticalAlign: 'middle' };

const MyPatientFileModal = ({ show, onHide, showNotification, onLoadForm }) => {
    const { myPatientID, isAdmin, staffName } = useEmployeeAuth();
    // Formulaires du dossier (Basique, Avancé, Mise à jour) : leur état décide s'ils se modifient ou se suppriment encore (utils/dossierCore.js).
    const [dossierForms, setDossierForms] = useState({});
    const [busyKey, setBusyKey] = useState('');
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { openForumNotice, forumNoticeModal } = useForumNotice();
    const { bbcodeEnabled } = useSiteConfig();
    const { open: openRows, toggle: toggleRow, setTab: setRowTab } = useExpansions();

    const load = useCallback(async () => {
        if (!myPatientID) return;
        setIsLoading(true);
        try {
            const dossier = await loadPatientDossier(myPatientID);
            // Ce que le patient voit : ce que ses soignants ont partagé, et ce qu'il a créé
            // lui-même ; jamais les copies de médecins ni ce que le créateur a retiré.
            setEntries(dossier.filter((e) => !e.copiedFrom && !e.ownerDeleted
                && (e.visibility === 'shared' || e.visibility === 'owner')));
            try {
                const context = await loadDossierContext(myPatientID, Date.now(), { myPatientID, staffName });
                setDossierForms(Object.fromEntries(context.forms.map((form) => [form.key, form])));
            } catch (contextError) { setDossierForms({}); }
        } catch (error) {
            console.error('Error loading my patient file:', error);
            showNotification('Impossible de charger votre dossier patient.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [myPatientID, showNotification]);

    useEffect(() => {
        if (show) load();
    }, [show, load]);

    const copy = (text, message) => (text
        ? copyToClipboard(text, showNotification, message)
        : showNotification('Rien à copier.', 'warning'));

    const removeDossierForm = async (entry, form) => {
        if (!window.confirm(`Supprimer « ${form.title} » ?${form.phase === 'fenetre' ? '\n\nIl n\'alimentera pas votre dossier. Si vous aviez payé, vous recevez un jeton gratuit pour ce formulaire.' : ''}`)) return;
        setBusyKey(entry.indexKey);
        try {
            const outcome = await deleteReportWithRules({ reportPath: form.reportPath, indexKey: form.key, patientID: myPatientID, patientNode: entry.patientNode }, { role: 'staff', isAdmin, staffName, myPatientID });
            showNotification(outcome.message || 'Formulaire supprimé.', outcome.ok ? 'check-circle' : 'exclamation-circle');
            await load();
        } catch (error) {
            showNotification(`Suppression impossible : ${error.message || 'erreur'}`, 'exclamation-circle');
        } finally {
            setBusyKey('');
        }
    };

    const exportDocument = (format, entry) => exportReportDocument(format, { bbCode: entry.bbCode, title: reportTitleOf(entry) || entry.originalKey, showNotification });

    const downloadHtml = (entry) => {
        if (downloadBbCodeAsHtml({ bbCode: entry.bbCode, title: reportTitleOf(entry) || entry.originalKey, showNotification })) openForumNotice('html');
    };

    if (!show) return null;

    return ReactDOM.createPortal(
        <div style={overlayStyle} onClick={onHide}>
            <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onHide} style={closeStyle} aria-label="Fermer">&times;</button>
                {forumNoticeModal}
                <h5>Mon dossier patient</h5>
                <p style={{ color: '#8b949e', fontSize: '0.9em' }}>
                    Comme n'importe quel patient, vous avez un dossier rattaché à votre ID patient : vous y retrouvez
                    les rapports que vos soignants ont partagés avec vous.
                </p>

                <ExemptionStatusCard showNotification={showNotification} />
                {myPatientID ? (
                    <p>
                        ID patient : <strong>{myPatientID}</strong>
                        <span style={{ color: '#8b949e', fontSize: '0.85em', marginLeft: '8px' }}>(unique, lié à votre UCP)</span>
                    </p>
                ) : (
                    <p style={{ color: '#d29922' }}>
                        Aucun ID patient n'est rattaché à votre fiche du personnel. Contactez un administrateur : lui seul
                        peut le renseigner.
                    </p>
                )}

                {myPatientID && (
                    <div style={{ marginBottom: '16px' }}>
                        <MyDossierPanel patientID={myPatientID} showNotification={showNotification} onLoadForm={onLoadForm} />
                    </div>
                )}

                {myPatientID && (
                    <div style={{ marginBottom: '16px' }}>
                        <h6 style={{ marginBottom: '8px' }}>Mes factures</h6>
                        <PatientInvoicesPanel patientID={myPatientID} showNotification={showNotification} />
                    </div>
                )}

                {myPatientID && (
                    isLoading ? <p>Chargement…</p> : entries.length === 0 ? (
                        <p style={{ textAlign: 'center', marginTop: '20px' }}>
                            Aucun rapport partagé avec vous pour le moment.
                        </p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Titre du rapport</th>
                                    <th style={thStyle}>Créé par</th>
                                    <th style={thStyle}>Date</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry) => (
                                    <React.Fragment key={entry.indexKey}>
                                    <tr>
                                        <td style={tdStyle}>{entry.originalKey}{entry.ordonnance && <span className="badge bg-warning text-dark ms-2" title="Ce rapport comporte une ordonnance : menu « Copier », rubrique « Ordonnance de ce rapport »"><i className="fas fa-file-prescription me-1"></i>Ordonnance</span>}</td>
                                        <td style={tdStyle}>{reportCreatorOf(entry) || 'N/A'}</td>
                                        <td style={tdStyle}>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A'}</td>
                                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                            {(entry.bbCode || entry.imageUrl) && (
                                                <ExpandToggle open={!!openRows[entry.indexKey]} onClick={() => toggleRow(entry.indexKey)} title="Déplier / replier l'aperçu du rapport" />
                                            )}
                                            {(() => {
                                                const form = isDossierVersion(entry.bbCodeVersion) ? dossierForms[entry.indexKey] : null;
                                                if (!form) return null;
                                                const allowed = canModifyForm(form, { role: isAdmin ? 'admin' : 'patient' });
                                                return (
                                                    <>
                                                        {allowed.edit && onLoadForm && <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => onLoadForm(form)} title="Rouvre le formulaire pour le modifier (modifié sur place).">Modifier</button>}
                                                        {allowed.remove && <button type="button" className="btn btn-sm btn-outline-danger me-1" disabled={busyKey === entry.indexKey} onClick={() => removeDossierForm(entry, form)}>Supprimer</button>}
                                                    </>
                                                );
                                            })()}
                                            <Dropdown className="d-inline-block">
                                                <Dropdown.Toggle size="sm" variant="secondary">Copier</Dropdown.Toggle>
                                                <Dropdown.Menu className="dossier-menu" popperConfig={{ strategy: 'fixed' }}>
                                                    {entry.kind === 'ama' && !entry.bbCode ? (
                                                        <>
                                                            <Dropdown.Item onClick={() => copy(reportTitleOf(entry), 'Titre copié !')}>Copier le titre</Dropdown.Item>
                                                            <Dropdown.Item disabled={!entry.imageUrl} onClick={() => copy(entry.imageUrl, "Lien de l'image copié !")}>Copier le lien de l'image</Dropdown.Item>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {bbcodeEnabled && (
<Dropdown.Item onClick={() => copy(entry.bbCode, 'BBCode copié !')} title={COPY_BBCODE_HINT}>
                                                                Copier le BBCode<ForumHint kind="bbcode" />
                                                            </Dropdown.Item>
)}
                                                            <Dropdown.Item onClick={() => downloadHtml(entry)} disabled={!entry.bbCode} title={DOWNLOAD_HTML_HINT}>
                                                                Télécharger le HTML<ForumHint kind="html" />
                                                            </Dropdown.Item>
                                                            <Dropdown.Item onClick={() => exportDocument('pdf', entry)} disabled={!entry.bbCode}>{PDF_EXPORT_LABEL}</Dropdown.Item>
                                                            <Dropdown.Item onClick={() => exportDocument('png', entry)} disabled={!entry.bbCode}>Télécharger l'image (PNG, pour Discord)</Dropdown.Item>
                                                            <Dropdown.Item onClick={() => exportDocument('png-copy', entry)} disabled={!entry.bbCode}>Copier l'image (à coller dans Discord)</Dropdown.Item>
                                                            <Dropdown.Item onClick={() => copy(reportTitleOf(entry), 'Titre copié !')}>Copier le titre</Dropdown.Item>
                                                            <Dropdown.Item onClick={() => copy(reportLinkUrl(linkTargetOf(entry)), 'Lien copié !')} disabled={!reportLinkUrl(linkTargetOf(entry))} title="Lien direct vers ce rapport : la personne qui l'ouvre doit être connectée et avoir les accès">Copier le lien du rapport</Dropdown.Item>
                                                            <PrescriptionMenuSection prescription={entry.ordonnance} showNotification={showNotification} />
                                                        </>
                                                    )}
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </td>
                                    </tr>
                                    {openRows[entry.indexKey] && (
                                        <tr>
                                            <td colSpan={4} style={{ ...tdStyle, backgroundColor: '#0d1117' }}>
                                                <ReportExpansion
                                                    tab={openRows[entry.indexKey]}
                                                    onTabChange={(tab) => setRowTab(entry.indexKey, tab)}
                                                    bbCode={entry.bbCode}
                                                    imageUrl={entry.imageUrl}
                                                    title={reportTitleOf(entry) || entry.originalKey}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    )
                )}
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default MyPatientFileModal;
