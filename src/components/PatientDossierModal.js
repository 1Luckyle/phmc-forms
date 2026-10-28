// src/components/PatientDossierModal.js
//
// Outil personnel « Dossier Patient » (Lot 5) : retrouve tous les rapports liés à
// un ID patient — créés par le patient lui-même, créés par un médecin (partagés ou
// non avec le patient), formulaires AMA — que le patient ait un compte sur le
// logiciel ou non (un médecin peut créer des rapports sur un patient qui n'a jamais
// ouvert de compte : il suffit de connaître son ID). La recherche accepte « 2752 »
// comme « PHMC-2752 ».
//
// UNE LIGNE = UN RAPPORT. Les copies que des médecins en ont faites ne sont pas
// affichées comme des rapports séparés : elles sont listées sur la ligne du rapport
// d'origine (colonne « Copies »), et les boutons s'adaptent à celui qui regarde :
//   • « Supprimer ma copie » si on a une copie (elle seule est supprimée) ;
//   • « Supprimer » si on est le créateur du rapport ;
//   • « Récupérer une copie » seulement si on n'en a pas déjà une (une par médecin) ;
//   • « Partager avec le patient » seulement pour le créateur d'un rapport non partagé
//     (jamais pour une copie, jamais deux fois).
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form, Dropdown } from 'react-bootstrap';
import CreatableSelect from 'react-select/creatable';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { copyToClipboard } from './notificationService';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import DebugFillButton from './DebugFillButton';
import { getFormDefinition } from '../formDefinitions';
import {
    loadPatientDossier, listIndexedPatientIds, groupDossierEntries, canonicalPatientId,
    reportTitleOf, reportCreatorOf, comprehensiveSanitize,
} from '../utils/patientRecords';
import useReportInvoices from '../hooks/useReportInvoices';
import { formatMoney, INVOICE_STATUS_COLORS } from '../utils/patientBilling';
import { ReportCard, FilterChips, PaymentPill, Pill, BulkBar } from './Reports/ReportParts';
import ForumHint from './ForumHint';
import useForumNotice from '../hooks/useForumNotice';
import { downloadBbCodeAsHtml, combineBbCodes, combineBbCodesForExport, COPY_BBCODE_HINT, DOWNLOAD_HTML_HINT } from '../utils/reportExport';
import ReportExpansion, { ExpandToggle, useExpansions } from './ReportExpansion';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { exportReportDocument, PDF_EXPORT_LABEL } from '../utils/reportDocumentExport';
import { loadDeletedMark } from '../utils/deletedAccounts';
import useWriteLock from '../hooks/useWriteLock';

const modalStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};

const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '5px', width: '95%', maxWidth: '1300px', height: '88vh',
    maxHeight: '88vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', position: 'relative', border: '1px solid #30363d',
};

const closeButtonStyle = {
    position: 'absolute', top: '15px', right: '15px', background: 'transparent',
    border: 'none', color: '#f85149', fontSize: '28px', fontWeight: 'bold',
    lineHeight: '1', padding: '0.25rem 0.5rem', cursor: 'pointer', zIndex: 10,
};

const reactSelectStyles = {
    container: (base) => ({ ...base, flexGrow: 1, maxWidth: '460px' }),
    control: (base) => ({
        ...base, backgroundColor: '#0d1117', color: '#c9d1d9', borderColor: '#30363d',
        '&:hover': { borderColor: '#c9d1d9' },
    }),
    menu: (base) => ({ ...base, backgroundColor: '#0d1117', zIndex: 1051 }),
    option: (base, state) => ({
        ...base, backgroundColor: state.isFocused ? '#1f2937' : '#0d1117', color: '#c9d1d9',
        '&:hover': { backgroundColor: '#1f2937' },
    }),
    singleValue: (base) => ({ ...base, color: '#c9d1d9' }),
    input: (base) => ({ ...base, color: '#c9d1d9' }),
    placeholder: (base) => ({ ...base, color: '#9aa7b4' }),
    groupHeading: (base) => ({ ...base, color: '#9aa7b4', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }),
};

// Visibilité d'un rapport du dossier : libellé, couleur et aide.
const visibilityInfo = (entry) => {
    if (entry.ownerDeleted) return { text: 'Retiré par son créateur', color: '#8b949e', hint: 'Conservé tant que des copies existent' };
    if (entry.copiedFrom) return { text: 'Copie', color: '#8b949e', hint: 'Une copie ne peut jamais être partagée' };
    const labels = {
        owner: { text: 'Créé par le patient', color: '#3fb950', hint: 'Rapport créé par le patient lui-même' },
        shared: { text: 'Partagé avec le patient', color: '#58a6ff', hint: 'Le patient le voit dans son dossier' },
        'staff-only': { text: 'Personnel uniquement', color: '#d29922', hint: "Non partagé : le patient ne le voit pas" },
    };
    return labels[entry.visibility] || { text: entry.visibility || 'Inconnu', color: '#8b949e', hint: '' };
};

const PatientDossierModal = ({
    show, onHide, showNotification, copyReportToOwnAccount, shareReportWithPatient,
    loadReport, deleteReportsForUser,
}) => {
    const { isAdmin, employeeProfile, staffName } = useEmployeeAuth();
    const isStaffViewer = isAdmin || !!employeeProfile;
    // Nom du médecin sous lequel ses rapports sont rangés (jamais l'e-mail).
    const staffAuthorNameForCopy = staffName || null;
    const myNodeKey = comprehensiveSanitize(staffAuthorNameForCopy);

    const [selectedPatientOption, setSelectedPatientOption] = useState(null);
    const [patientOptions, setPatientOptions] = useState([]);
    const [isLoadingPatients, setIsLoadingPatients] = useState(false);
    const [searchedPatientId, setSearchedPatientId] = useState(null);
    // Marqueur « compte supprimé » du patient affiché (ancien membre du personnel ou compte Civil supprimé).
    const [deletedMark, setDeletedMark] = useState(null);
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchText, setSearchText] = useState('');
    // État de paiement de chaque rapport payant (rechargé à chaque recherche / « Actualiser »).
    const [invoiceRefresh, setInvoiceRefresh] = useState(0);
    const { invoiceOf } = useReportInvoices(entries, !!show, invoiceRefresh);
    const { openForumNotice, forumNoticeModal } = useForumNotice();
    const { locked, lockTitle } = useWriteLock();
    const { bbcodeEnabled } = useSiteConfig();
    const { open: openRows, toggle: toggleRow, setTab: setRowTab } = useExpansions();

    // Liste déroulante : patients avec compte (civils) + patients sans compte, connus
    // uniquement par des rapports du personnel. On peut aussi taper un ID librement.
    useEffect(() => {
        if (!show) return;
        let cancelled = false;
        setIsLoadingPatients(true);
        (async () => {
            try {
                const [civilSnap, indexed] = await Promise.all([
                    get(ref(database, 'civilians')),
                    listIndexedPatientIds().catch((error) => {
                        console.error('Could not list indexed patient ids:', error);
                        showNotification("Impossible de lister les patients sans compte (règles Firebase « patientRecords » à déployer : firebase deploy --only database).", 'warning', 8000);
                        return [];
                    }),
                ]);
                const withAccount = new Map();
                if (civilSnap.exists()) {
                    Object.values(civilSnap.val()).forEach((c) => {
                        if (c && c.patientID) {
                            const id = canonicalPatientId(c.patientID);
                            withAccount.set(id, {
                                value: id,
                                label: `${c.firstName || ''} ${c.lastName || ''} (${id})`.trim(),
                            });
                        }
                    });
                }
                const withoutAccount = indexed
                    .filter((p) => !withAccount.has(canonicalPatientId(p.patientNode)))
                    .map((p) => ({
                        value: p.patientNode,
                        label: `${p.patientName || 'Patient sans compte'} (${p.patientNode}) — ${p.reportCount} rapport(s)`,
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label));
                const accountOptions = [...withAccount.values()].sort((a, b) => a.label.localeCompare(b.label));
                if (!cancelled) {
                    setPatientOptions([
                        { label: 'Patients avec un compte', options: accountOptions },
                        { label: 'Patients sans compte (rapports du personnel)', options: withoutAccount },
                    ].filter((group) => group.options.length > 0));
                }
            } catch (error) {
                console.error('Error loading patients for dossier selector:', error);
            } finally {
                if (!cancelled) setIsLoadingPatients(false);
            }
        })();
        return () => { cancelled = true; };
    }, [show]);

    const isLoadable = (entry) => entry.kind !== 'ama' && !!getFormDefinition(entry.bbCodeVersion)?.FieldComponent;
    // Le rapport est rangé sous savedReports/{ownerNode}/{key}.
    const ownerNodeOf = (entry) => entry.reportPath.split('/')[1];
    const keyOf = (entry) => entry.reportPath.split('/').pop();

    const handleSearch = async (patientIdOverride) => {
        const patientId = (patientIdOverride ?? selectedPatientOption?.value ?? '').trim();
        if (!patientId) {
            showNotification('Veuillez sélectionner ou saisir un ID patient.', 'warning');
            return;
        }
        const canonical = canonicalPatientId(patientId);
        setIsLoading(true);
        setSearchedPatientId(canonical);
        setDeletedMark(null);
        loadDeletedMark(canonical).then(setDeletedMark);
        setSelectedKeys([]);
        setStatusFilter('all');
        setSearchText('');
        setInvoiceRefresh((n) => n + 1);
        try {
            const dossier = await loadPatientDossier(canonical);
            setEntries(dossier);
            if (dossier.length === 0) {
                showNotification(`Aucun rapport trouvé pour l'ID patient "${canonical}".`, 'info-circle');
            }
        } catch (error) {
            console.error('Error searching patient dossier:', error);
            showNotification('Erreur lors de la recherche du dossier patient.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const copyText = async (text, message, emptyMessage) => {
        if (text) await copyToClipboard(text, showNotification, message);
        else showNotification(emptyMessage, 'warning');
    };

    // Un rapport et ses copies = une « famille » (une ligne), vue selon qui regarde.
    const families = useMemo(() => groupDossierEntries(entries).map((family) => {
        const { root, copies } = family;
        // Orphelin : la ligne est elle-même la copie de quelqu'un (original disparu).
        const rootIsCopy = !!root.copiedFrom;
        const myCopy = rootIsCopy
            ? (ownerNodeOf(root) === myNodeKey ? root : null)
            : (copies.find((c) => ownerNodeOf(c) === myNodeKey) || null);
        const iAmHolder = !rootIsCopy && !!myNodeKey && ownerNodeOf(root) === myNodeKey;
        // L'exemplaire que « Supprimer » vise pour CE lecteur (jamais l'original du patient).
        let deleteTarget = null;
        if (myCopy) deleteTarget = { entry: myCopy, label: 'Supprimer ma copie' };
        else if (iAmHolder) deleteTarget = { entry: root, label: 'Supprimer' };
        else if (isAdmin) deleteTarget = { entry: root, label: 'Supprimer (admin)' };
        return {
            ...family,
            myCopy,
            iAmHolder,
            deleteTarget,
            canShare: !rootIsCopy && root.visibility === 'staff-only' && !root.ownerDeleted && (iAmHolder || isAdmin),
            canCopy: !!staffAuthorNameForCopy && !rootIsCopy && !iAmHolder && !myCopy,
        };
    }), [entries, myNodeKey, isAdmin, staffAuthorNameForCopy]); // eslint-disable-line react-hooks/exhaustive-deps

    // Filtres : recherche par titre + pastilles (mes rapports, créés par le patient, partagés, personnel uniquement, copies, à payer).
    const matchesDossierFilter = (family, key) => {
        const { root, copiers, myCopy, iAmHolder } = family;
        switch (key) {
            case 'mine': return iAmHolder || !!myCopy;
            case 'owner': return !root.copiedFrom && root.visibility === 'owner';
            case 'shared': return !root.copiedFrom && root.visibility === 'shared';
            case 'staff': return !root.copiedFrom && root.visibility === 'staff-only';
            case 'copies': return copiers.length > 0;
            case 'unpaid': return invoiceOf(root)?.statutEffectif === 'a_payer';
            default: return true;
        }
    };
    const dossierSearched = useMemo(() => {
        const needle = searchText.trim().toLowerCase();
        return needle ? families.filter((family) => String(family.root.originalKey || '').toLowerCase().includes(needle)) : families;
    }, [families, searchText]);
    const visibleFamilies = useMemo(
        () => dossierSearched.filter((family) => matchesDossierFilter(family, statusFilter)),
        [dossierSearched, statusFilter, invoiceOf] // eslint-disable-line react-hooks/exhaustive-deps
    );
    const dossierChips = useMemo(() => {
        const count = (key) => dossierSearched.filter((family) => matchesDossierFilter(family, key)).length;
        return [
            { key: 'all', label: 'Tous', count: dossierSearched.length },
            { key: 'mine', label: 'Mes rapports', count: count('mine'), color: '#58a6ff' },
            { key: 'owner', label: 'Créés par le patient', count: count('owner'), color: '#3fb950' },
            { key: 'shared', label: 'Partagés', count: count('shared'), color: '#58a6ff' },
            { key: 'staff', label: 'Personnel uniquement', count: count('staff'), color: '#d29922' },
            { key: 'copies', label: 'Avec copies', count: count('copies'), color: '#a371f7' },
            { key: 'unpaid', label: 'À payer', count: count('unpaid'), color: '#d29922' },
        ];
    }, [dossierSearched, invoiceOf]); // eslint-disable-line react-hooks/exhaustive-deps
    const stats = useMemo(() => {
        const unpaidFamilies = families.filter((family) => invoiceOf(family.root)?.statutEffectif === 'a_payer');
        return {
            mine: families.filter((family) => family.iAmHolder || family.myCopy).length,
            copies: families.reduce((sum, family) => sum + family.copiers.length, 0),
            unpaid: unpaidFamilies.length,
            unpaidAmount: unpaidFamilies.reduce((sum, family) => sum + Number(invoiceOf(family.root)?.montant || 0), 0),
        };
    }, [families, invoiceOf]);

    const toDeletePayload = (entry) => ({
        key: entry.indexKey,
        reportPath: entry.reportPath,
        patientID: entry.patientID,
        patientNode: entry.patientNode,
        isCopy: !!entry.copiedFrom,
        copiedFrom: entry.copiedFrom,
    });

    const handleDelete = async (targets, description) => {
        if (!deleteReportsForUser || targets.length === 0) return;
        if (!window.confirm(`${description}\n\nCette action est irréversible (les règles de suppression du dossier s'appliquent).`)) return;
        await deleteReportsForUser(targets.map(toDeletePayload), staffAuthorNameForCopy, { skipReload: true });
        setSelectedKeys([]);
        await handleSearch(searchedPatientId);
    };

    const handleLoad = (entry) => {
        if (!loadReport) return;
        if (!isLoadable(entry)) {
            showNotification("Ce rapport (ex. formulaire AMA) n'a pas de formulaire associé : il ne peut pas être rechargé.", 'warning');
            return;
        }
        loadReport(keyOf(entry), ownerNodeOf(entry));
        onHide();
    };

    const selectedFamilies = useMemo(
        () => families.filter((f) => selectedKeys.includes(f.root.indexKey)),
        [families, selectedKeys]
    );
    const toggleKey = (indexKey, checked) =>
        setSelectedKeys((prev) => (checked ? [...new Set([...prev, indexKey])] : prev.filter((k) => k !== indexKey)));
    const allSelected = visibleFamilies.length > 0 && visibleFamilies.every((f) => selectedKeys.includes(f.root.indexKey));

    const handleDeleteSelected = () => {
        const targets = selectedFamilies.map((f) => f.deleteTarget).filter(Boolean);
        const skipped = selectedFamilies.length - targets.length;
        if (targets.length === 0) {
            showNotification("Aucun des rapports sélectionnés n'est supprimable par vous (créés par le patient ou par un autre médecin, sans copie à vous).", 'warning', 7000);
            return;
        }
        handleDelete(targets.map((t) => t.entry), `Supprimer ${targets.length} rapport(s) ou copie(s) ?${skipped > 0 ? `\n(${skipped} rapport(s) sélectionné(s) ne vous appartiennent pas et seront ignorés.)` : ''}`);
    };

    const handleLoadSelected = () => {
        if (selectedFamilies.length !== 1) {
            showNotification("Vous ne pouvez charger qu'un seul rapport à la fois : sélectionnez-en un seul.", 'warning');
            return;
        }
        handleLoad(selectedFamilies[0].root);
    };

    // Téléchargement HTML (forum GTA World) : un rapport, ou la sélection en un seul fichier.
    const downloadHtml = (bbCode, title) => {
        if (downloadBbCodeAsHtml({ bbCode, title, showNotification })) openForumNotice('html');
    };

    // PDF (A4) / SVG : un rapport, ou la sélection en un seul document.
    const exportDocument = (format, bbCode, title) => exportReportDocument(format, { bbCode, title, showNotification });

    const handleExportSelectedDocument = (format) => {
        const roots = selectedFamilies.map((f) => f.root);
        const title = roots.length === 1 ? (reportTitleOf(roots[0]) || roots[0].originalKey) : `${roots.length} rapports`;
        exportDocument(format, combineBbCodesForExport(roots), title);
    };

    const handleDownloadSelectedHtml = () => {
        const roots = selectedFamilies.map((f) => f.root);
        const title = roots.length === 1 ? (reportTitleOf(roots[0]) || roots[0].originalKey) : `${roots.length} rapports`;
        downloadHtml(combineBbCodesForExport(roots), title);
    };

    const renderCopyMenu = (entry) => (
        <Dropdown className="d-inline-block">
            <Dropdown.Toggle size="sm" variant="secondary">Copier</Dropdown.Toggle>
            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                {entry.kind === 'ama' && !entry.bbCode ? (
                    <>
                        <Dropdown.Item onClick={() => copyText(reportTitleOf(entry), 'Titre copié !', 'Aucun titre trouvé.')}>Copier le titre</Dropdown.Item>
                        <Dropdown.Item disabled={!entry.imageUrl} onClick={() => copyText(entry.imageUrl, "Lien de l'image copié !", "Aucun lien d'image.")}>
                            Copier le lien de l'image
                        </Dropdown.Item>
                    </>
                ) : (
                    <>
                        {bbcodeEnabled && (
<Dropdown.Item onClick={() => copyText(entry.bbCode, 'BBCode copié !', 'Aucun BBCode trouvé pour ce rapport.')} title={COPY_BBCODE_HINT}>
                            Copier le BBCode<ForumHint kind="bbcode" />
                        </Dropdown.Item>
)}
                        <Dropdown.Item onClick={() => downloadHtml(entry.bbCode, reportTitleOf(entry) || entry.originalKey)} disabled={!entry.bbCode} title={DOWNLOAD_HTML_HINT}>
                            Télécharger le HTML<ForumHint kind="html" />
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => exportDocument('pdf', entry.bbCode, reportTitleOf(entry) || entry.originalKey)} disabled={!entry.bbCode}>{PDF_EXPORT_LABEL}</Dropdown.Item>
                        <Dropdown.Item onClick={() => exportDocument('png', entry.bbCode, reportTitleOf(entry) || entry.originalKey)} disabled={!entry.bbCode}>Télécharger l'image (PNG, pour Discord)</Dropdown.Item>
                        <Dropdown.Item onClick={() => exportDocument('png-copy', entry.bbCode, reportTitleOf(entry) || entry.originalKey)} disabled={!entry.bbCode}>Copier l'image (à coller dans Discord)</Dropdown.Item>
                        <Dropdown.Item onClick={() => copyText(reportTitleOf(entry), 'Titre copié !', 'Aucun titre trouvé.')}>Copier le titre</Dropdown.Item>
                    </>
                )}
            </Dropdown.Menu>
        </Dropdown>
    );

    if (!show) return null;

    if (!isStaffViewer) {
        return ReactDOM.createPortal(
            <div style={modalStyle} onClick={onHide}>
                <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                    <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                    <p className="rpt-empty">Cet outil est réservé au personnel PHMC/DMEC connecté.</p>
                </div>
            </div>,
            document.getElementById('modal-root')
        );
    }

    const typeLabelOf = (entry) => (entry.kind === 'ama'
        ? 'Formulaire AMA'
        : (getFormDefinition(entry.bbCodeVersion)?.name || `Formulaire ${entry.bbCodeVersion}`));

    // Une carte par rapport d'origine (ses copies sont résumées dessus).
    const renderFamilyCard = (family) => {
        const { root, copiers, myCopy, iAmHolder, deleteTarget, canShare, canCopy } = family;
        const invoice = invoiceOf(root);
        const visibility = visibilityInfo(root);
        const title = reportTitleOf(root) || root.originalKey;
        const copiersLabel = copiers.map((copier) => (copier.nodeKey === myNodeKey ? 'Vous' : copier.name)).join(', ');
        return (
            <ReportCard
                key={root.indexKey}
                color={invoice ? (INVOICE_STATUS_COLORS[invoice.statutEffectif] || visibility.color) : visibility.color}
                selected={selectedKeys.includes(root.indexKey)}
                selectId={`dossier-select-${root.indexKey}`}
                onSelect={(checked) => toggleKey(root.indexKey, checked)}
                dimmed={!!root.ownerDeleted}
                title={root.originalKey}
                titleHint={title}
                meta={`${reportCreatorOf(root) || 'N/A'} · ${root.timestamp ? new Date(root.timestamp).toLocaleString() : 'N/A'} · ${typeLabelOf(root)}${copiers.length ? ` · Copies : ${copiersLabel}` : ''}`}
                chips={(
                    <>
                        {iAmHolder && <Pill color="#58a6ff" title="Rapport que vous avez créé">Mon rapport</Pill>}
                        {myCopy && !iAmHolder && <Pill color="#a371f7" title="Vous avez une copie de ce rapport">Ma copie</Pill>}
                        {copiers.length > 0 && (
                            <Pill color="#a371f7" title={`Médecins qui ont récupéré une copie : ${copiersLabel}`}>{copiers.length} copie{copiers.length > 1 ? 's' : ''}</Pill>
                        )}
                        <Pill color={visibility.color} title={visibility.hint}>{visibility.text}</Pill>
                        <PaymentPill invoice={invoice} />
                    </>
                )}
                actions={(
                    <>
                        {loadReport && isLoadable(root) && (
                            <Button size="sm" variant="primary" onClick={() => handleLoad(root)}>
                                <i className="fas fa-upload me-1"></i>Charger
                            </Button>
                        )}
                        {renderCopyMenu(root)}
                        {(root.bbCode || root.imageUrl) && (
                            <ExpandToggle open={!!openRows[root.indexKey]} onClick={() => toggleRow(root.indexKey)} title="Déplier / replier l'aperçu du rapport" />
                        )}
                        {canShare && shareReportWithPatient && (
                            <Button
                                size="sm" style={{ backgroundColor: '#8957e5', border: 'none' }} disabled={locked} title={locked ? lockTitle : undefined}
                                onClick={async () => {
                                    await shareReportWithPatient(searchedPatientId, root.indexKey, root.patientNode);
                                    handleSearch(searchedPatientId);
                                }}
                            >
                                <i className="fas fa-share-nodes me-1"></i>Partager avec le patient
                            </Button>
                        )}
                        {canCopy && copyReportToOwnAccount && (
                            <Button
                                size="sm" style={{ backgroundColor: '#316dca', border: 'none' }}
                                disabled={locked}
                                title={locked ? lockTitle : `Enregistrer une copie dans les rapports de ${staffAuthorNameForCopy} (une seule copie par médecin)`}
                                onClick={async () => {
                                    await copyReportToOwnAccount(root.reportPath, staffAuthorNameForCopy, { patientID: root.patientID, patientNode: root.patientNode });
                                    handleSearch(searchedPatientId);
                                }}
                            >
                                <i className="fas fa-copy me-1"></i>Récupérer une copie
                            </Button>
                        )}
                        {!staffAuthorNameForCopy && !iAmHolder && (
                            <span className="rpt-note" title="Votre compte n'est lié à aucune fiche du personnel : impossible de rattacher une copie">Copie indisponible</span>
                        )}
                        {deleteReportsForUser && deleteTarget && (
                            <Button
                                size="sm" variant="outline-danger" className="ms-auto" disabled={locked}
                                title={locked ? lockTitle : myCopy
                                    ? "Supprime uniquement VOTRE copie : le rapport et les copies des autres médecins restent dans le dossier"
                                    : 'Supprime ce rapport (conservé dans le dossier tant que des médecins en ont une copie)'}
                                onClick={() => handleDelete([deleteTarget.entry], `${deleteTarget.label} : « ${root.originalKey} » ?`)}
                            >
                                <i className="fas fa-trash me-1"></i>{deleteTarget.label}
                            </Button>
                        )}
                    </>
                )}
                expansion={openRows[root.indexKey] ? (
                    <ReportExpansion
                        tab={openRows[root.indexKey]}
                        onTabChange={(tab) => setRowTab(root.indexKey, tab)}
                        bbCode={root.bbCode}
                        imageUrl={root.imageUrl}
                        title={title}
                    />
                ) : null}
            />
        );
    };

    const patientName = selectedPatientOption && !selectedPatientOption.__isNew__
        && canonicalPatientId(selectedPatientOption.value) === searchedPatientId
        ? selectedPatientOption.label.replace(/\s*\([^)]*\)\s*(—.*)?$/, '').trim() : '';
    const hasResults = !!searchedPatientId && !isLoading && families.length > 0;

    return ReactDOM.createPortal(
        <div style={modalStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                {forumNoticeModal}
                <div className="rpt-modal-head">
                    <h5><i className="fas fa-folder-tree me-2"></i>Dossier Patient</h5>
                    <span className="rpt-sub">
                        Tous les rapports d'un patient, avec ou sans compte : choisissez-le dans la liste ou tapez son ID (<strong>2752</strong> ou <strong>PHMC-2752</strong>).
                        Une carte = un rapport ; les copies des médecins sont résumées sur le rapport d'origine.
                    </span>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2 mb-2" style={{ flexShrink: 0 }}>
                    <CreatableSelect
                        options={patientOptions}
                        value={selectedPatientOption}
                        onChange={(option) => {
                            setSelectedPatientOption(option);
                            if (option) handleSearch(option.value);
                        }}
                        isClearable
                        isLoading={isLoadingPatients}
                        placeholder="Choisir un patient ou taper un ID (ex. 2752 ou PHMC-2752)…"
                        noOptionsMessage={() => 'Aucun patient connu — tapez un ID pour le rechercher'}
                        formatCreateLabel={(typed) => `Rechercher l'ID « ${canonicalPatientId(typed)} »`}
                        isValidNewOption={(typed) => typed.trim().length >= 3}
                        styles={reactSelectStyles}
                    />
                    <Button onClick={() => handleSearch()} disabled={isLoading || !selectedPatientOption} variant="primary" size="sm">
                        <i className="fas fa-rotate me-1"></i>{isLoading ? 'Recherche…' : 'Actualiser'}
                    </Button>
                    {/* Mode debug : ouvre le dossier du patient de test utilisé par les
                        gabarits « Remplir (debug) » (ID PHMC-99999). */}
                    <DebugFillButton
                        label="Patient de test"
                        disabled={isLoading}
                        onFill={() => {
                            setSelectedPatientOption({ value: 'PHMC-99999', label: 'Jean Michel Testard (PHMC-99999)' });
                            handleSearch('PHMC-99999');
                        }}
                    />
                </div>

                <div className="rpt-body">
                    {searchedPatientId && deletedMark && (
                        <div className="rpt-banner warn">
                            <i className="fas fa-user-slash me-2" style={{ color: '#d29922' }}></i>
                            {deletedMark.type === 'personnel' ? 'Ancien membre du personnel' : 'Compte supprimé'}
                            {deletedMark.nom ? ` : ${deletedMark.nom}` : ''}{deletedMark.role ? ` (${deletedMark.role})` : ''}
                            {' — '}n'est plus lié à un compte actif depuis le {new Date(deletedMark.supprimeLe).toLocaleDateString('fr-FR')}. Ses rapports et son dossier restent archivés.
                        </div>
                    )}

                    {isLoading && <p className="rpt-muted">Recherche du dossier…</p>}

                    {hasResults && (
                        <>
                            <div className="rpt-summary">
                                <span className="rpt-summary-main">
                                    <strong>{patientName || searchedPatientId}</strong>
                                    <small>{patientName ? searchedPatientId : 'Patient'}</small>
                                </span>
                                <span className="rpt-stats">
                                    <span className="rpt-stat"><b>{families.length}</b><span>Rapports</span></span>
                                    <span className="rpt-stat"><b>{stats.mine}</b><span>À moi</span></span>
                                    <span className="rpt-stat"><b>{stats.copies}</b><span>Copies</span></span>
                                    <span className={`rpt-stat${stats.unpaid > 0 ? ' warn' : ''}`}><b>{stats.unpaid}</b><span>À payer{stats.unpaid > 0 ? ` (${formatMoney(stats.unpaidAmount)})` : ''}</span></span>
                                </span>
                            </div>

                            <div className="rpt-toolbar">
                                <div className="rpt-toolbar-row">
                                    <input
                                        type="search" className="rpt-search" placeholder="Rechercher par titre…"
                                        value={searchText} onChange={(e) => setSearchText(e.target.value)}
                                    />
                                </div>
                                <FilterChips items={dossierChips} value={statusFilter} onChange={setStatusFilter} label="Filtrer le dossier" />
                            </div>

                            {visibleFamilies.length > 0
                                ? <div className="rpt-list">{visibleFamilies.map(renderFamilyCard)}</div>
                                : <p className="rpt-empty">Aucun rapport ne correspond à ces filtres.</p>}
                        </>
                    )}

                    {searchedPatientId && !isLoading && families.length === 0 && (
                        <p className="rpt-empty">
                            Aucun rapport trouvé pour l'ID patient « {searchedPatientId} ».
                            {isAdmin && " Si des rapports devraient exister, lancez « Réindexer les dossiers patients » depuis l'onglet Utilisateurs du panneau admin."}
                        </p>
                    )}
                    {!searchedPatientId && !isLoading && (
                        <p className="rpt-empty">Choisissez un patient ci-dessus pour afficher son dossier.</p>
                    )}
                </div>

                {hasResults && (
                    <BulkBar count={selectedFamilies.length} onClear={() => setSelectedKeys([])}>
                        <Form.Check
                            type="checkbox" id="dossier-select-all" label="Tout" className="align-self-center mb-0 me-1"
                            checked={allSelected}
                            onChange={(e) => setSelectedKeys(e.target.checked ? visibleFamilies.map((f) => f.root.indexKey) : [])}
                            title="Tout sélectionner / désélectionner (rapports affichés)"
                        />
                        {deleteReportsForUser && (
                            <Button variant="outline-danger" size="sm" disabled={selectedFamilies.length === 0 || locked} onClick={handleDeleteSelected}
                                title="Supprime vos copies / vos rapports parmi la sélection (les autres sont ignorés)">
                                <i className="fas fa-trash me-1"></i>Supprimer
                            </Button>
                        )}
                        <Dropdown drop="up">
                            <Dropdown.Toggle variant="secondary" size="sm" disabled={selectedFamilies.length === 0}>Copier / exporter</Dropdown.Toggle>
                            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                {bbcodeEnabled && (
                                    <Dropdown.Item onClick={() => copyText(
                                        selectedFamilies.map((f) => f.root.bbCode).filter(Boolean).join('\n\n'),
                                        'BBCode copié !', 'Aucun BBCode trouvé dans la sélection.'
                                    )} title={COPY_BBCODE_HINT}>Copier le BBCode sélectionné<ForumHint kind="bbcode" /></Dropdown.Item>
                                )}
                                <Dropdown.Item onClick={handleDownloadSelectedHtml} title={DOWNLOAD_HTML_HINT}>
                                    Télécharger le HTML sélectionné<ForumHint kind="html" />
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => handleExportSelectedDocument('pdf')}>Télécharger le PDF (A4) sélectionné</Dropdown.Item>
                                <Dropdown.Item onClick={() => handleExportSelectedDocument('png')}>Télécharger l'image (PNG) sélectionnée</Dropdown.Item>
                                <Dropdown.Item onClick={() => copyText(
                                    selectedFamilies.map((f) => reportTitleOf(f.root)).filter(Boolean).join('\n'),
                                    'Titres copiés !', 'Aucun titre trouvé dans la sélection.'
                                )}>Copier les titres sélectionnés</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                        {loadReport && (
                            <Button
                                variant="success" size="sm"
                                disabled={selectedFamilies.length !== 1}
                                title={selectedFamilies.length > 1 ? 'Un seul rapport peut être chargé à la fois' : ''}
                                onClick={handleLoadSelected}
                            >
                                <i className="fas fa-upload me-1"></i>Charger le rapport sélectionné
                            </Button>
                        )}
                    </BulkBar>
                )}
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default PatientDossierModal;
