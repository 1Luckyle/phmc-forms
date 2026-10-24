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
import { loadPatientDossier, reportTitleOf, reportCreatorOf } from '../utils/patientRecords';
import PatientInvoicesPanel from './PatientInvoicesPanel';
import ForumHint from './ForumHint';
import useForumNotice from '../hooks/useForumNotice';
import { downloadBbCodeAsHtml, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../utils/reportExport';
import ReportExpansion, { ExpandToggle, useExpansions } from './ReportExpansion';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL, SVG_EXPORT_LABEL } from '../utils/reportDocumentExport';

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

const MyPatientFileModal = ({ show, onHide, showNotification }) => {
    const { myPatientID } = useEmployeeAuth();
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
                                        <td style={tdStyle}>{entry.originalKey}</td>
                                        <td style={tdStyle}>{reportCreatorOf(entry) || 'N/A'}</td>
                                        <td style={tdStyle}>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A'}</td>
                                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                            {(entry.bbCode || entry.imageUrl) && (
                                                <ExpandToggle open={!!openRows[entry.indexKey]} onClick={() => toggleRow(entry.indexKey)} title="Déplier / replier l'aperçu du rapport" />
                                            )}
                                            <Dropdown className="d-inline-block">
                                                <Dropdown.Toggle size="sm" variant="secondary">Copier</Dropdown.Toggle>
                                                <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                                    {entry.kind === 'ama' ? (
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
                                                            <Dropdown.Item onClick={() => exportDocument('svg', entry)} disabled={!entry.bbCode}>{SVG_EXPORT_LABEL}</Dropdown.Item>
                                                            <Dropdown.Item onClick={() => exportDocument('png', entry)} disabled={!entry.bbCode}>Télécharger l'image (PNG, pour Discord)</Dropdown.Item>
                                                            <Dropdown.Item onClick={() => exportDocument('png-copy', entry)} disabled={!entry.bbCode}>Copier l'image (à coller dans Discord)</Dropdown.Item>
                                                            <Dropdown.Item onClick={() => copy(reportTitleOf(entry), 'Titre copié !')}>Copier le titre</Dropdown.Item>
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
