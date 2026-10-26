// src/components/ExportProgressModal.js
//
// Fenêtre d'export d'un rapport LONG en plusieurs images PNG : elle montre la progression de la génération, puis liste chaque
// image avec son propre bouton « Télécharger » (un clic = un téléchargement, comme l'exige le navigateur), et suit le nombre
// d'images déjà téléchargées. À monter une seule fois, à la racine de l'application.
import React, { useSyncExternalStore } from 'react';
import ReactDOM from 'react-dom';
import { Button, ProgressBar } from 'react-bootstrap';
import { exportProgress } from '../utils/exportProgress';
import { downloadExportPart } from '../utils/reportDocumentExport';

const overlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000,
};
const contentStyle = {
    backgroundColor: '#0d1117', color: '#e6edf3', padding: '22px 24px', borderRadius: '8px',
    width: '94%', maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto', border: '1px solid #30363d', position: 'relative',
};
const rowStyle = (done) => ({
    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', marginBottom: '8px',
    background: done ? 'rgba(46, 160, 67, 0.12)' : '#161b22', border: `1px solid ${done ? 'rgba(63, 185, 80, 0.55)' : '#30363d'}`, borderRadius: '8px',
});

const ExportProgressModal = () => {
    const state = useSyncExternalStore(exportProgress.subscribe, exportProgress.get);
    if (!state) return null;

    const isRendering = state.phase === 'render';
    const parts = state.parts || [];
    const downloaded = parts.filter((part) => part.downloaded).length;
    const allDone = !isRendering && parts.length > 0 && downloaded === parts.length;

    return ReactDOM.createPortal(
        <div style={overlayStyle}>
            <div style={contentStyle} role="dialog" aria-modal="true" aria-label="Export en plusieurs images">
                <h5 style={{ color: '#f0f6fc', marginBottom: '4px' }}>
                    <i className="fas fa-images" style={{ marginRight: '8px' }}></i>Rapport long : {state.total} images
                </h5>
                <p style={{ color: '#b1bac4', fontSize: '0.9rem', marginBottom: '14px' }}>
                    Ce rapport est trop long pour une seule image : il est découpé en {state.total} parties, sans couper un tableau ni un rapport en deux
                    quand c'est possible. Joignez-les <strong>dans l'ordre</strong> sur Discord.
                </p>

                {isRendering ? (
                    <>
                        <p style={{ marginBottom: '6px' }}>Génération des images… {state.rendered} / {state.total}</p>
                        <ProgressBar animated now={Math.round((state.rendered / state.total) * 100)} style={{ height: '10px', background: '#21262d' }} />
                    </>
                ) : (
                    <>
                        <p style={{ marginBottom: '6px' }}>
                            Téléchargées : <strong>{downloaded} / {parts.length}</strong>{' '}
                            {!allDone && <span style={{ color: '#b1bac4' }}>— cliquez sur chaque image ci-dessous.</span>}
                        </p>
                        <ProgressBar now={parts.length ? Math.round((downloaded / parts.length) * 100) : 0} variant="success" style={{ height: '10px', background: '#21262d', marginBottom: '14px' }} />
                        {parts.map((part, index) => (
                            <div key={part.name} style={rowStyle(part.downloaded)}>
                                <i className={`fas ${part.downloaded ? 'fa-circle-check' : 'fa-image'}`} style={{ color: part.downloaded ? '#3fb950' : '#8b949e', fontSize: '1.2rem' }}></i>
                                <span style={{ flex: '1 1 auto' }}>
                                    <strong>Image {index + 1} sur {parts.length}</strong>
                                    <small style={{ display: 'block', color: '#b1bac4' }}>{part.downloaded ? 'Téléchargée' : 'À télécharger'}</small>
                                </span>
                                <Button size="sm" variant={part.downloaded ? 'outline-secondary' : 'primary'} onClick={() => downloadExportPart(index)}>
                                    <i className="fas fa-download me-1"></i>{part.downloaded ? 'Re-télécharger' : 'Télécharger'}
                                </Button>
                            </div>
                        ))}
                        {allDone && <p style={{ color: '#3fb950', marginTop: '10px' }}><i className="fas fa-check me-1"></i>Toutes les images sont téléchargées : joignez-les dans l'ordre sur Discord.</p>}
                    </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                    <Button variant={allDone ? 'success' : 'outline-secondary'} onClick={exportProgress.close}>
                        {allDone ? 'Terminé' : 'Fermer'}
                    </Button>
                </div>
            </div>
        </div>,
        document.getElementById('modal-root') || document.body
    );
};

export default ExportProgressModal;
