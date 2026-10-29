// src/components/PublishedDeathReportsModal.js
//
// Rapports Publics de Décès PUBLIÉS par le DMEC : consultables (lecture seule) par tout le personnel, quelle que soit sa famille.
// La liste vient de rapportsPublics (index posé par le DMEC à la publication) ; le rapport lui-même est lu à la demande.
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { copyToClipboard } from './notificationService';
import { ReportCard, Pill } from './Reports/ReportParts';
import ReportExpansion, { ExpandToggle, useExpansions } from './ReportExpansion';
import { useSiteConfig } from '../contexts/SiteConfigContext';
import { loadPublishedList } from '../utils/deathReports';
import { Button } from 'react-bootstrap';

const modalStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1060,
};

const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '5px', width: '95%', maxWidth: '1000px', height: '85vh',
    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', position: 'relative', border: '1px solid #30363d',
};

const closeButtonStyle = {
    position: 'absolute', top: '15px', right: '15px', background: 'transparent',
    border: 'none', color: '#f85149', fontSize: '28px', fontWeight: 'bold',
    lineHeight: '1', padding: '0.25rem 0.5rem', cursor: 'pointer', zIndex: 10,
};

const PublishedDeathReportsModal = ({ show, onHide, showNotification }) => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    // Contenu lu à la demande : { [clé]: { bbCode } | { error } }.
    const [contents, setContents] = useState({});
    const { bbcodeEnabled } = useSiteConfig();
    const { open, toggle, setTab } = useExpansions();

    useEffect(() => {
        if (!show) return undefined;
        let cancelled = false;
        setIsLoading(true);
        setContents({});
        loadPublishedList()
            .then((list) => { if (!cancelled) setItems(list); })
            .catch((error) => {
                console.error('Could not load published death reports:', error);
                if (!cancelled) {
                    setItems([]);
                    showNotification('Impossible de lister les rapports publics (règles Firebase à déployer ?).', 'warning');
                }
            })
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    const ensureContent = async (item) => {
        if (contents[item.key]) return contents[item.key];
        let content;
        try {
            const snap = await get(ref(database, item.reportPath));
            content = snap.exists() ? { bbCode: snap.val().bbCode || '' } : { error: "Ce rapport n'existe plus." };
        } catch (error) {
            content = { error: "Lecture impossible : ce rapport n'est plus publié, ou vous n'y avez pas accès." };
        }
        setContents((previous) => ({ ...previous, [item.key]: content }));
        return content;
    };

    if (!show) return null;

    return ReactDOM.createPortal(
        <div style={modalStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={(event) => event.stopPropagation()}>
                <button onClick={onHide} style={closeButtonStyle} aria-label="Fermer">&times;</button>
                <div className="rpt-modal-head">
                    <h5><i className="fas fa-bullhorn me-2"></i>Rapports publics de décès publiés</h5>
                    <span className="rpt-sub">{items.length} rapport{items.length > 1 ? 's' : ''} · lecture seule</span>
                </div>
                <div className="rpt-body">
                    {isLoading && <p className="rpt-muted">Chargement…</p>}
                    {!isLoading && items.length === 0 && <p className="rpt-empty">Aucun rapport public de décès n'est publié pour le moment.</p>}
                    {items.map((item) => {
                        const content = contents[item.key];
                        return (
                            <ReportCard
                                key={item.key}
                                color="#58a6ff"
                                title={item.titre || item.key}
                                meta={`${item.par || 'DMEC'} · publié le ${new Date(item.publieLe).toLocaleString('fr-FR')}${item.patientID ? ` · ${item.patientID}` : ''}`}
                                chips={<Pill color="#58a6ff" title="Publié par le DMEC : consultable par tout le personnel">Publié</Pill>}
                                actions={(
                                    <>
                                        <ExpandToggle
                                            open={!!open[item.key]}
                                            onClick={async () => { if (!open[item.key]) await ensureContent(item); toggle(item.key); }}
                                            title="Afficher / masquer le rapport"
                                        />
                                        {bbcodeEnabled && content?.bbCode && (
                                            <Button size="sm" variant="secondary" onClick={() => copyToClipboard(content.bbCode, showNotification, 'BBCode copié !')}>
                                                Copier le BBCode
                                            </Button>
                                        )}
                                    </>
                                )}
                                expansion={open[item.key] ? (
                                    content?.error
                                        ? <p className="rpt-muted">{content.error}</p>
                                        : (
                                            <ReportExpansion
                                                tab={open[item.key]}
                                                onTabChange={(tab) => setTab(item.key, tab)}
                                                bbCode={content?.bbCode || ''}
                                                title={item.titre || item.key}
                                            />
                                        )
                                ) : null}
                            />
                        );
                    })}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PublishedDeathReportsModal;
