import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { useSiteConfig } from '../contexts/SiteConfigContext';

// Fenêtres d'aide affichées après une copie du BBCode ou un téléchargement du HTML :
//   • BBCode copié  → destiné au forum PHMC (pas encore disponible actuellement), PAS au forum GTA World (Invision Community) ;
//   • HTML téléchargé → destiné au forum GTA World : étapes pour copier-coller le rapport.
// Chaque fenêtre peut être masquée définitivement (« Ne plus afficher »), préférence gardée dans ce
// navigateur ; le bouton « ? » à côté du téléchargement la rouvre toujours.
const STORAGE_PREFIX = 'hideForumNotice_';

export const isForumNoticeHidden = (kind) => {
    try { return localStorage.getItem(`${STORAGE_PREFIX}${kind}`) === '1'; } catch (e) { return false; }
};

const rememberHidden = (kind, hidden) => {
    try {
        if (hidden) localStorage.setItem(`${STORAGE_PREFIX}${kind}`, '1');
        else localStorage.removeItem(`${STORAGE_PREFIX}${kind}`);
    } catch (e) { /* stockage indisponible : la fenêtre s'affichera simplement à chaque fois */ }
};

const headerStyle = { backgroundColor: '#1a1a1a', color: '#fff', borderBottom: '1px solid #444' };
const bodyStyle = { backgroundColor: '#2a2a2a', color: '#fff' };
const footerStyle = { backgroundColor: '#1a1a1a', borderTop: '1px solid #444', justifyContent: 'space-between' };
const rowStyle = { display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' };

const ForumCopyNoticeModal = ({ kind, show, onHide, onDownloadHtml }) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        if (show) setDontShowAgain(isForumNoticeHidden(kind));
    }, [show, kind]);

    const close = () => {
        rememberHidden(kind, dontShowAgain);
        onHide();
    };

    const isHtml = kind === 'html';
    // BBCode désactivé par les admins : plus aucune mention du BBCode ni du forum PHMC.
    const { bbcodeEnabled } = useSiteConfig();

    return (
        <Modal show={show} onHide={close} centered>
            <Modal.Header closeButton style={headerStyle} closeVariant="white">
                <Modal.Title>
                    <i className={`fas ${isHtml ? 'fa-file-code' : 'fa-copy'}`} style={{ marginRight: '10px' }}></i>
                    {isHtml ? 'HTML téléchargé : comment le publier' : 'BBCode copié'}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body style={bodyStyle}>
                {isHtml ? (
                    <>
                        <div style={rowStyle}>
                            <i className="fas fa-circle-check" style={{ color: '#3fb950', fontSize: '1.3rem', marginTop: '2px' }}></i>
                            <span>
                                Le HTML est destiné au <strong>forum GTA World</strong> : le copier-coller de ce fichier y fonctionne.
                            </span>
                        </div>
                        {bbcodeEnabled && (
<div style={rowStyle}>
                            <i className="fas fa-circle-info" style={{ color: '#58a6ff', fontSize: '1.3rem', marginTop: '2px' }}></i>
                            <span>
                                Le <strong>forum PHMC</strong> n'est <strong>pas encore disponible</strong> actuellement : c'est lui qui utilisera le BBCode.
                            </span>
                        </div>
)}
                        <ol style={{ paddingLeft: '1.2rem', marginBottom: '14px' }}>
                            <li className="mb-2">Ouvrez le fichier téléchargé dans votre navigateur, de préférence sur <strong>PC</strong>.</li>
                            <li className="mb-2"><strong>Ctrl+A</strong> pour tout sélectionner, puis <strong>Ctrl+C</strong>.</li>
                            <li className="mb-2">Dans l'éditeur du forum, collez avec <strong>Ctrl+V</strong> (collage normal, <strong>pas</strong> Ctrl+Maj+V ni « texte brut »).</li>
                            <li>Publiez, puis <strong>vérifiez le message publié</strong> : l'aperçu de l'éditeur ne suffit pas (il peut afficher des couleurs différentes).</li>
                        </ol>
                    </>
                ) : (
                    <>
                        <div style={rowStyle}>
                            <i className="fas fa-circle-check" style={{ color: '#3fb950', fontSize: '1.3rem', marginTop: '2px' }}></i>
                            <span>
                                Ce BBCode est destiné au <strong>forum PHMC</strong>, qui n'est <strong>pas encore disponible</strong> actuellement.
                            </span>
                        </div>
                        <div style={rowStyle}>
                            <i className="fas fa-circle-xmark" style={{ color: '#f85149', fontSize: '1.3rem', marginTop: '2px' }}></i>
                            <span>
                                Il <strong>ne fonctionne pas sur le forum GTA World</strong> : ce forum ne reconnaît pas ces balises et le rapport
                                s'y afficherait cassé.
                            </span>
                        </div>
                        <div style={{ ...rowStyle, marginBottom: 0 }}>
                            <i className="fas fa-lightbulb" style={{ color: '#d29922', fontSize: '1.3rem', marginTop: '2px' }}></i>
                            <span>
                                Pour publier sur le forum GTA World, utilisez <strong>« Télécharger le HTML »</strong> : le HTML est fait pour
                                <strong> ce forum</strong> (le BBCode est réservé au forum PHMC).
                            </span>
                        </div>
                    </>
                )}
            </Modal.Body>
            <Modal.Footer style={footerStyle}>
                <Form.Check
                    type="checkbox"
                    id={`forum-notice-hide-${kind}`}
                    label="Ne plus afficher ce message"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    style={{ color: '#ccc', fontSize: '0.9em' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                    {!isHtml && onDownloadHtml && (
                        <Button variant="success" onClick={() => { close(); onDownloadHtml(); }}>
                            <i className="fas fa-download"></i> Télécharger le HTML
                        </Button>
                    )}
                    <Button variant="primary" onClick={close}>Compris</Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default ForumCopyNoticeModal;
