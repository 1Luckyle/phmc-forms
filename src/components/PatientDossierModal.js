// src/components/PatientDossierModal.js
//
// Outil personnel (Lot 5 du plan Civil) : recherche le dossier complet d'un
// patient par son ID, en lisant patientRecords/{patientID} SANS filtre de
// visibilité (contrairement à la vue Civil dans SavedReportsModal, qui ne
// voit que owner/shared) — n'importe quel personnel PHMC/DMEC connecté peut
// ainsi voir tout ce qui a été enregistré ou mentionné pour ce patient, y
// compris les rapports staff-only jamais partagés.
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Button } from 'react-bootstrap';
import Select from 'react-select';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { copyToClipboard } from './notificationService';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import DebugFillButton from './DebugFillButton';

const modalStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000,
};

const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '5px', width: '95%', maxWidth: '1100px', height: '85vh',
    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    overflowY: 'hidden', position: 'relative', border: '1px solid #30363d',
};

const closeButtonStyle = {
    position: 'absolute', top: '15px', right: '15px', background: 'transparent',
    border: 'none', color: '#f85149', fontSize: '28px', fontWeight: 'bold',
    lineHeight: '1', padding: '0.25rem 0.5rem', cursor: 'pointer', zIndex: 10,
};

const reactSelectStyles = {
    container: (base) => ({ ...base, flexGrow: 1, maxWidth: '400px' }),
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
};

const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const thStyle = {
    backgroundColor: '#161b22', border: '1px solid #30363d', padding: '10px',
    textAlign: 'left', fontWeight: '600', position: 'sticky', top: 0,
};
const tdStyle = {
    border: '1px solid #30363d', padding: '8px 10px', verticalAlign: 'middle',
};

const visibilityBadge = (visibility) => {
    const labels = {
        owner: { text: 'Créé par le patient', color: '#3fb950' },
        shared: { text: 'Partagé avec le patient', color: '#58a6ff' },
        'staff-only': { text: 'Personnel uniquement', color: '#d29922' },
    };
    const info = labels[visibility] || { text: visibility || 'Inconnu', color: '#8b949e' };
    return <span style={{ color: info.color, fontSize: '0.85em' }}>{info.text}</span>;
};

const PatientDossierModal = ({ show, onHide, showNotification, copyReportToOwnAccount, shareReportWithPatient }) => {
    const { isAdmin, employeeProfile, currentEmployee } = useEmployeeAuth();
    const isStaffViewer = isAdmin || !!employeeProfile;
    const staffAuthorNameForCopy = employeeProfile?.name
        || (employeeProfile?.firstName && employeeProfile?.lastName ? `${employeeProfile.firstName} ${employeeProfile.lastName}` : null)
        || (isAdmin ? (currentEmployee?.email || null) : null);

    const [selectedPatientOption, setSelectedPatientOption] = useState(null);
    const [civilianOptions, setCivilianOptions] = useState([]);
    const [isLoadingCivilians, setIsLoadingCivilians] = useState(false);
    const [searchedPatientId, setSearchedPatientId] = useState(null);
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Liste des civils enregistrés pour le menu déroulant — évite d'avoir à
    // taper l'ID patient à la main (et de faire une faute de frappe).
    useEffect(() => {
        if (!show) return;
        setIsLoadingCivilians(true);
        get(ref(database, 'civilians')).then((snap) => {
            if (!snap.exists()) {
                setCivilianOptions([]);
                return;
            }
            const options = Object.values(snap.val())
                .filter((c) => c && c.patientID)
                .map((c) => ({
                    value: c.patientID,
                    label: `${c.firstName || ''} ${c.lastName || ''} (${c.patientID})`.trim(),
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
            setCivilianOptions(options);
        }).catch((error) => {
            console.error('Error loading civilians for patient dossier selector:', error);
        }).finally(() => {
            setIsLoadingCivilians(false);
        });
    }, [show]);

    if (!show) return null;

    const handleSearch = async (patientIdOverride) => {
        const patientId = (patientIdOverride ?? selectedPatientOption?.value ?? '').trim();
        if (!patientId) {
            showNotification('Veuillez sélectionner un patient.', 'warning');
            return;
        }
        setIsLoading(true);
        setSearchedPatientId(patientId);
        try {
            const indexSnap = await get(ref(database, `patientRecords/${patientId}`));
            if (!indexSnap.exists()) {
                setEntries([]);
                showNotification(`Aucun dossier trouvé pour l'ID patient "${patientId}".`, 'info-circle');
                return;
            }
            const indexEntries = Object.entries(indexSnap.val() || {});
            const resolved = await Promise.all(indexEntries.map(async ([indexKey, entry]) => {
                if (!entry?.reportPath) return null;
                try {
                    const reportSnap = await get(ref(database, entry.reportPath));
                    if (!reportSnap.exists()) return null;
                    const report = reportSnap.val();
                    return {
                        indexKey,
                        reportPath: entry.reportPath,
                        visibility: entry.visibility,
                        originalKey: report.originalKey,
                        bbCodeVersion: report.bbCodeVersion,
                        timestamp: report.timestamp,
                        authorName: report.authorName,
                        bbCode: report.bbCode,
                    };
                } catch (err) {
                    console.warn('Could not fetch report for patient dossier:', entry.reportPath, err);
                    return null;
                }
            }));
            const validEntries = resolved.filter(Boolean).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setEntries(validEntries);
            if (validEntries.length === 0) {
                showNotification(`Aucun rapport exploitable trouvé pour l'ID patient "${patientId}".`, 'info-circle');
            }
        } catch (error) {
            console.error('Error searching patient dossier:', error);
            showNotification('Erreur lors de la recherche du dossier patient.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyBBCode = async (entry) => {
        if (entry.bbCode) {
            await copyToClipboard(entry.bbCode, showNotification, 'BBCode copié !');
        } else {
            showNotification('Aucun BBCode trouvé pour ce rapport.', 'warning');
        }
    };

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
                <h5 style={{ marginBottom: '15px' }}>Dossier Patient</h5>
                <p style={{ color: '#8b949e', fontSize: '0.9em' }}>
                    Recherchez tous les rapports liés à un ID patient, qu'ils aient été créés par le civil,
                    partagés avec lui, ou remplis par le personnel sans partage.
                </p>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <Select
                        options={civilianOptions}
                        value={selectedPatientOption}
                        onChange={(option) => {
                            setSelectedPatientOption(option);
                            if (option) handleSearch(option.value);
                        }}
                        isClearable
                        isLoading={isLoadingCivilians}
                        placeholder="Rechercher un patient par nom ou ID..."
                        noOptionsMessage={() => 'Aucun civil enregistré'}
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
                    {searchedPatientId && !isLoading && entries.length > 0 && (
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Nom / Identifiant</th>
                                    <th style={thStyle}>Date</th>
                                    <th style={thStyle}>Auteur</th>
                                    <th style={thStyle}>Visibilité</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry) => (
                                    <tr key={entry.indexKey}>
                                        <td style={tdStyle} title={entry.originalKey}>{entry.originalKey}</td>
                                        <td style={tdStyle}>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A'}</td>
                                        <td style={tdStyle}>{entry.authorName || 'N/A'}</td>
                                        <td style={tdStyle}>{visibilityBadge(entry.visibility)}</td>
                                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="me-2"
                                                onClick={() => handleCopyBBCode(entry)}
                                            >
                                                Copier le BBCode
                                            </Button>
                                            {entry.visibility !== 'shared' && shareReportWithPatient && (
                                                <Button
                                                    size="sm"
                                                    className="me-2"
                                                    style={{ backgroundColor: '#8957e5', border: 'none' }}
                                                    onClick={() => shareReportWithPatient(searchedPatientId, entry.indexKey)}
                                                >
                                                    Partager avec le patient
                                                </Button>
                                            )}
                                            {copyReportToOwnAccount && entry.authorName !== staffAuthorNameForCopy && (
                                                <Button
                                                    size="sm"
                                                    style={{ backgroundColor: '#316dca', border: 'none' }}
                                                    disabled={!staffAuthorNameForCopy}
                                                    onClick={() => copyReportToOwnAccount(entry.reportPath, staffAuthorNameForCopy)}
                                                >
                                                    Récupérer une copie
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {searchedPatientId && !isLoading && entries.length === 0 && (
                        <p style={{ textAlign: 'center', marginTop: '20px' }}>
                            Aucun dossier trouvé pour l'ID patient "{searchedPatientId}".
                        </p>
                    )}
                </div>
            </div>
        </div>,
        document.getElementById('modal-root')
    );
};

export default PatientDossierModal;
