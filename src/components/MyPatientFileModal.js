// src/components/MyPatientFileModal.js
//
// « Mon dossier patient » pour le PERSONNEL : un médecin peut lui aussi être hospitalisé et
// donc avoir un dossier. Les rapports sont rattachés à un ID patient (pas à un rôle) : les
// collègues qui le soignent créent les rapports sur son ID comme sur n'importe quel patient,
// et il retrouve ici ceux qui ont été PARTAGÉS avec lui (comme un civil dans son propre dossier).
// Son ID est déduit de son personnage GTA World quand c'est possible, sinon il le renseigne.
import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form, Dropdown } from 'react-bootstrap';
import { useEmployeeAuth } from '../contexts/EmployeeAuthContext';
import { copyToClipboard } from './notificationService';
import { loadPatientDossier, reportTitleOf, reportCreatorOf } from '../utils/patientRecords';
import { canonicalPatientId } from '../utils/patientId';

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
    const { myPatientID, setMyPatientId } = useEmployeeAuth();
    const [idInput, setIdInput] = useState('');
    const [editing, setEditing] = useState(false);
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

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
        if (show) {
            setEditing(false);
            setIdInput(myPatientID || '');
            load();
        }
    }, [show, load, myPatientID]);

    const handleSaveId = async () => {
        const canonical = canonicalPatientId(idInput);
        if (!canonical) {
            showNotification('Saisissez votre ID patient (ex. 2752 ou PHMC-2752).', 'warning');
            return;
        }
        try {
            await setMyPatientId(canonical);
            setEditing(false);
            showNotification(`ID patient enregistré : ${canonical}`, 'check-circle');
        } catch (error) {
            console.error('Error saving staff patient id:', error);
            showNotification("Impossible d'enregistrer l'ID patient (règles Firebase à déployer ?).", 'error');
        }
    };

    const copy = (text, message) => (text
        ? copyToClipboard(text, showNotification, message)
        : showNotification('Rien à copier.', 'warning'));

    if (!show) return null;

    return ReactDOM.createPortal(
        <div style={overlayStyle} onClick={onHide}>
            <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onHide} style={closeStyle} aria-label="Fermer">&times;</button>
                <h5>Mon dossier patient</h5>
                <p style={{ color: '#8b949e', fontSize: '0.9em' }}>
                    Comme n'importe quel patient, vous avez un dossier rattaché à votre ID patient : vous y retrouvez
                    les rapports que vos soignants ont partagés avec vous.
                </p>

                {(!myPatientID || editing) ? (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '15px' }}>
                        <Form.Control
                            style={{ maxWidth: '260px' }}
                            placeholder="Mon ID patient (ex. 2752)"
                            value={idInput}
                            onChange={(e) => setIdInput(e.target.value)}
                            onBlur={() => setIdInput((v) => (v.trim() ? canonicalPatientId(v) : v))}
                        />
                        <Button onClick={handleSaveId}>Enregistrer</Button>
                        {myPatientID && <Button variant="secondary" onClick={() => setEditing(false)}>Annuler</Button>}
                        {!myPatientID && (
                            <span style={{ fontSize: '0.85em', color: '#d29922' }}>
                                Votre ID n'a pas pu être déduit de votre fiche : renseignez-le une fois.
                            </span>
                        )}
                    </div>
                ) : (
                    <p>
                        ID patient : <strong>{myPatientID}</strong>{' '}
                        <Button variant="link" size="sm" onClick={() => setEditing(true)}>Modifier</Button>
                        <Button variant="link" size="sm" onClick={load} disabled={isLoading}>Actualiser</Button>
                    </p>
                )}

                {myPatientID && !editing && (
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
                                    <tr key={entry.indexKey}>
                                        <td style={tdStyle}>{entry.originalKey}</td>
                                        <td style={tdStyle}>{reportCreatorOf(entry) || 'N/A'}</td>
                                        <td style={tdStyle}>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A'}</td>
                                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
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
                                                            <Dropdown.Item onClick={() => copy(entry.bbCode, 'BBCode copié !')}>Copier le BBCode</Dropdown.Item>
                                                            <Dropdown.Item onClick={() => copy(reportTitleOf(entry), 'Titre copié !')}>Copier le titre</Dropdown.Item>
                                                        </>
                                                    )}
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </td>
                                    </tr>
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
