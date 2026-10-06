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

const modalStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};

const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '5px', width: '95%', maxWidth: '1300px', height: '88vh',
    maxHeight: '88vh', display: 'flex', flexDirection: 'column',
    overflowY: 'hidden', position: 'relative', border: '1px solid #30363d',
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
    placeholder: (base) => ({ ...base, color: '#6c757d' }),
    groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }),
};

const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const thStyle = {
    backgroundColor: '#161b22', border: '1px solid #30363d', padding: '10px',
    textAlign: 'left', fontWeight: '600', position: 'sticky', top: 0, zIndex: 1,
};
const tdStyle = {
    border: '1px solid #30363d', padding: '8px 10px', verticalAlign: 'middle',
};
// La colonne d'actions n'est jamais tronquée.
const actionsTdStyle = { ...tdStyle, whiteSpace: 'nowrap' };

const chipStyle = (highlight) => ({
    display: 'inline-block', margin: '1px 4px 1px 0', padding: '1px 8px', borderRadius: '10px',
    fontSize: '0.78em', whiteSpace: 'nowrap',
    backgroundColor: highlight ? '#1f6feb' : '#21262d', color: highlight ? '#fff' : '#c9d1d9',
    border: `1px solid ${highlight ? '#1f6feb' : '#30363d'}`,
});

const visibilityBadge = (entry) => {
    if (entry.ownerDeleted) {
        return <span style={{ color: '#8b949e', fontSize: '0.85em' }}>Retiré par son créateur — conservé tant que des copies existent</span>;
    }
    if (entry.copiedFrom) {
        return <span style={{ color: '#8b949e', fontSize: '0.85em' }}>Copie (jamais partageable)</span>;
    }
    const labels = {
        owner: { text: 'Créé par le patient', color: '#3fb950' },
        shared: { text: 'Partagé avec le patient', color: '#58a6ff' },
        'staff-only': { text: 'Personnel uniquement', color: '#d29922' },
    };
    const info = labels[entry.visibility] || { text: entry.visibility || 'Inconnu', color: '#8b949e' };
    return <span style={{ color: info.color, fontSize: '0.85em' }}>{info.text}</span>;
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
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState([]);

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
                    listIndexedPatientIds().catch(() => []),
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
        setSelectedKeys([]);
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
    const allSelected = families.length > 0 && families.every((f) => selectedKeys.includes(f.root.indexKey));

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

    const renderCopyMenu = (entry) => (
        <Dropdown className="d-inline-block me-2">
            <Dropdown.Toggle size="sm" variant="secondary">Copier</Dropdown.Toggle>
            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                {entry.kind === 'ama' ? (
                    <>
                        <Dropdown.Item onClick={() => copyText(reportTitleOf(entry), 'Titre copié !', 'Aucun titre trouvé.')}>Copier le titre</Dropdown.Item>
                        <Dropdown.Item disabled={!entry.imageUrl} onClick={() => copyText(entry.imageUrl, "Lien de l'image copié !", "Aucun lien d'image.")}>
                            Copier le lien de l'image
                        </Dropdown.Item>
                    </>
                ) : (
                    <>
                        <Dropdown.Item onClick={() => copyText(entry.bbCode, 'BBCode copié !', 'Aucun BBCode trouvé pour ce rapport.')}>Copier le BBCode</Dropdown.Item>
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
                    <p style={{ textAlign: 'center', marginTop: '40px' }}>
                        Cet outil est réservé au personnel PHMC/DMEC connecté.
                    </p>
                </div>
            </div>,
            document.getElementById('modal-root')
        );
    }

    return ReactDOM.createPortal(
        <div style={modalStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                <h5 style={{ marginBottom: '10px' }}>Dossier Patient</h5>
                <p style={{ color: '#8b949e', fontSize: '0.9em', marginBottom: '10px' }}>
                    Recherchez tous les rapports d'un patient avec ou sans compte : choisissez-le dans la liste ou tapez son ID
                    (<strong>2752</strong> ou <strong>PHMC-2752</strong>). <strong>Une ligne = un rapport</strong> : les copies des médecins
                    sont regroupées sur la ligne du rapport d'origine (colonne « Copies »).
                </p>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                    <Button onClick={() => handleSearch()} disabled={isLoading || !selectedPatientOption} variant="primary">
                        {isLoading ? 'Recherche...' : 'Actualiser'}
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

                <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                    {searchedPatientId && !isLoading && families.length > 0 && (
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>
                                        <Form.Check
                                            type="checkbox"
                                            id="dossier-select-all"
                                            checked={allSelected}
                                            onChange={(e) => setSelectedKeys(e.target.checked ? families.map((f) => f.root.indexKey) : [])}
                                            title="Tout sélectionner / désélectionner"
                                        />
                                    </th>
                                    <th style={thStyle}>Titre du rapport</th>
                                    <th style={thStyle}>Créé par</th>
                                    <th style={thStyle} title="Médecins qui ont récupéré une copie de ce rapport">Copies</th>
                                    <th style={thStyle}>Date</th>
                                    <th style={thStyle}>Visibilité</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {families.map((family) => {
                                    const { root, copiers, myCopy, iAmHolder, deleteTarget, canShare, canCopy } = family;
                                    const rowStyle = {
                                        ...(selectedKeys.includes(root.indexKey) ? { backgroundColor: '#161b22' } : {}),
                                        ...(root.ownerDeleted ? { opacity: 0.65 } : {}),
                                    };
                                    return (
                                        <tr key={root.indexKey} style={rowStyle}>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <Form.Check
                                                    type="checkbox"
                                                    id={`dossier-select-${root.indexKey}`}
                                                    checked={selectedKeys.includes(root.indexKey)}
                                                    onChange={(e) => toggleKey(root.indexKey, e.target.checked)}
                                                />
                                            </td>
                                            <td style={{ ...tdStyle, maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={reportTitleOf(root) || root.originalKey}>
                                                {root.originalKey}
                                                {iAmHolder && <span style={{ ...chipStyle(true), marginLeft: '6px' }}>Mon rapport</span>}
                                            </td>
                                            <td style={tdStyle}>{reportCreatorOf(root) || 'N/A'}</td>
                                            <td style={tdStyle}>
                                                {copiers.length === 0 ? (
                                                    <span style={{ color: '#6e7681' }}>—</span>
                                                ) : copiers.map((copier) => (
                                                    <span key={copier.nodeKey} style={chipStyle(copier.nodeKey === myNodeKey)}
                                                        title={copier.nodeKey === myNodeKey ? 'Vous avez une copie de ce rapport' : `${copier.name} a une copie de ce rapport`}>
                                                        {copier.nodeKey === myNodeKey ? 'Vous' : copier.name}
                                                    </span>
                                                ))}
                                            </td>
                                            <td style={tdStyle}>{root.timestamp ? new Date(root.timestamp).toLocaleString() : 'N/A'}</td>
                                            <td style={tdStyle}>{visibilityBadge(root)}</td>
                                            <td style={actionsTdStyle}>
                                                {loadReport && isLoadable(root) && (
                                                    <Button size="sm" variant="primary" className="me-2" onClick={() => handleLoad(root)}>
                                                        Charger
                                                    </Button>
                                                )}
                                                {renderCopyMenu(root)}
                                                {canShare && shareReportWithPatient && (
                                                    <Button
                                                        size="sm"
                                                        className="me-2"
                                                        style={{ backgroundColor: '#8957e5', border: 'none' }}
                                                        onClick={async () => {
                                                            await shareReportWithPatient(searchedPatientId, root.indexKey, root.patientNode);
                                                            handleSearch(searchedPatientId);
                                                        }}
                                                    >
                                                        Partager avec le patient
                                                    </Button>
                                                )}
                                                {canCopy && copyReportToOwnAccount && (
                                                    <Button
                                                        size="sm"
                                                        className="me-2"
                                                        style={{ backgroundColor: '#316dca', border: 'none' }}
                                                        title={`Enregistrer une copie dans les rapports de ${staffAuthorNameForCopy} (une seule copie par médecin)`}
                                                        onClick={async () => {
                                                            await copyReportToOwnAccount(root.reportPath, staffAuthorNameForCopy, { patientID: root.patientID, patientNode: root.patientNode });
                                                            handleSearch(searchedPatientId);
                                                        }}
                                                    >
                                                        Récupérer une copie
                                                    </Button>
                                                )}
                                                {!staffAuthorNameForCopy && !iAmHolder && (
                                                    <span style={{ fontSize: '0.75em', color: '#8b949e' }} title="Votre compte n'est lié à aucune fiche du personnel : impossible de rattacher une copie">
                                                        Copie indisponible
                                                    </span>
                                                )}
                                                {deleteReportsForUser && deleteTarget && (
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        title={myCopy
                                                            ? "Supprime uniquement VOTRE copie : le rapport et les copies des autres médecins restent dans le dossier"
                                                            : 'Supprime ce rapport (conservé dans le dossier tant que des médecins en ont une copie)'}
                                                        onClick={() => handleDelete([deleteTarget.entry], `${deleteTarget.label} : « ${root.originalKey} » ?`)}
                                                    >
                                                        {deleteTarget.label}
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    {searchedPatientId && !isLoading && families.length === 0 && (
                        <p style={{ textAlign: 'center', marginTop: '20px' }}>
                            Aucun rapport trouvé pour l'ID patient "{searchedPatientId}".
                            {isAdmin && " Si des rapports devraient exister, lancez « Réindexer les dossiers patients » depuis l'onglet Utilisateurs du panneau admin."}
                        </p>
                    )}
                </div>

                {families.length > 0 && !isLoading && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #30363d', flexShrink: 0, flexWrap: 'wrap' }}>
                        {deleteReportsForUser && (
                            <Button variant="danger" disabled={selectedFamilies.length === 0} onClick={handleDeleteSelected}
                                title="Supprime vos copies / vos rapports parmi la sélection (les autres sont ignorés)">
                                Supprimer la sélection ({selectedFamilies.length})
                            </Button>
                        )}
                        <Dropdown drop="up">
                            <Dropdown.Toggle variant="secondary" disabled={selectedFamilies.length === 0}>
                                Copier la sélection ({selectedFamilies.length})
                            </Dropdown.Toggle>
                            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                <Dropdown.Item onClick={() => copyText(
                                    selectedFamilies.map((f) => f.root.bbCode).filter(Boolean).join('\n\n'),
                                    'BBCode copié !', 'Aucun BBCode trouvé dans la sélection.'
                                )}>Copier le BBCode sélectionné</Dropdown.Item>
                                <Dropdown.Item onClick={() => copyText(
                                    selectedFamilies.map((f) => reportTitleOf(f.root)).filter(Boolean).join('\n'),
                                    'Titres copiés !', 'Aucun titre trouvé dans la sélection.'
                                )}>Copier les titres sélectionnés</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                        {loadReport && (
                            <Button
                                variant="success"
                                disabled={selectedFamilies.length !== 1}
                                title={selectedFamilies.length > 1 ? 'Un seul rapport peut être chargé à la fois' : ''}
                                onClick={handleLoadSelected}
                            >
                                Charger le rapport sélectionné ({selectedFamilies.length})
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default PatientDossierModal;
