// src/components/ReportExpansion.js
//
// Zone dépliable sous un rapport / une candidature / des statuts (Rapports enregistrés, Dossier Patient, Mon dossier
// patient, Mes candidatures, Gestion du recrutement) : onglets « Aperçu » (le rapport tel qu'il sera publié, images
// comprises), « BBCode » (le texte brut) et, au besoin, d'autres onglets (historique, détails).
// Le bouton qui l'ouvre (ExpandToggle) la déplie ET la replie. Tout est converti dans le navigateur (aucun appel serveur).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// (useState sert à useExpansions)
import { Button } from 'react-bootstrap';
import { bbcodeToHtmlDocument, escapeHtml } from '../utils/bbcodeToHtml';
import { useSiteConfig } from '../contexts/SiteConfigContext';

// État « quel onglet est ouvert pour quelle ligne » : { [clé]: 'preview' | 'bbcode' | … }.
export const useExpansions = () => {
    const [open, setOpen] = useState({});
    // Même onglet cliqué deux fois = on replie ; un autre onglet = on change d'onglet.
    const toggle = useCallback((key, tab = 'preview') => setOpen((previous) => {
        const next = { ...previous };
        if (next[key] === tab) delete next[key];
        else next[key] = tab;
        return next;
    }), []);
    const setTab = useCallback((key, tab) => setOpen((previous) => ({ ...previous, [key]: tab })), []);
    const close = useCallback((key) => setOpen((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
    }), []);
    return { open, toggle, setTab, close };
};

export const ExpandToggle = ({ open, onClick, label = 'Aperçu', title, icon }) => (
    <Button
        size="sm"
        variant={open ? 'info' : 'outline-info'}
        className="me-2"
        onClick={onClick}
        title={title || (open ? 'Replier' : 'Déplier')}
        aria-expanded={!!open}
    >
        <i className={`fas ${icon || (open ? 'fa-chevron-up' : 'fa-chevron-down')} me-1`}></i>{label}
    </Button>
);

const tabButtonStyle = (active) => ({
    background: active ? '#1f6feb' : 'transparent',
    color: active ? '#fff' : '#c9d1d9',
    border: '1px solid #30363d',
    borderRadius: '4px',
    padding: '2px 12px',
    fontSize: '0.85em',
    cursor: 'pointer',
});

const buildPreviewDocument = (bbCode, title) => {
    try {
        return bbcodeToHtmlDocument(bbCode, { title: title || 'Aperçu' });
    } catch (error) {
        console.error('Aperçu impossible :', error);
        return `<!DOCTYPE html><html><body style="font-family:Arial;padding:16px;">Aperçu impossible : ${escapeHtml(error.message || '')}</body></html>`;
    }
};

// Cadre d'aperçu : le BBCode converti en HTML, comme il s'affichera sur le forum (images comprises). Mis à jour
// ~0,4 s après la dernière modification (le formulaire change à chaque frappe).
export const ReportPreviewFrame = ({ bbCode, title, height = 460 }) => {
    const [settled, setSettled] = useState(bbCode);
    // Hauteur du contenu (mesurée dans le cadre) ; manualHeight : hauteur choisie par l'utilisateur en tirant le coin.
    const [contentHeight, setContentHeight] = useState(null);
    const [manualHeight, setManualHeight] = useState(null);
    const wrapperRef = useRef(null);
    const iframeRef = useRef(null);
    const observerRef = useRef(null);

    useEffect(() => {
        const timer = setTimeout(() => setSettled(bbCode), 400);
        return () => clearTimeout(timer);
    }, [bbCode]);
    const previewDocument = useMemo(() => (settled ? buildPreviewDocument(settled, title) : ''), [settled, title]);

    useEffect(() => () => { if (observerRef.current) observerRef.current.disconnect(); }, []);

    // Par défaut l'aperçu s'étend jusqu'au bas du dernier texte ; on suit aussi le chargement des images.
    const handleLoad = () => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc || !doc.documentElement) return;
        let frame = 0;
        const measure = () => {
            // On mesure le CORPS du document, pas la racine : documentElement.scrollHeight ne descend jamais sous la hauteur du cadre, donc un
            // contrat court affiché après un long gardait une grande page blanche en bas.
            const body = doc.body;
            let measured = 0;
            if (body) {
                const style = doc.defaultView ? doc.defaultView.getComputedStyle(body) : null;
                const margins = style ? (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0) : 0;
                measured = Math.ceil(Math.max(body.getBoundingClientRect().height, body.scrollHeight) + margins);
            } else {
                measured = doc.documentElement.scrollHeight;
            }
            if (measured > 0) setContentHeight(Math.min(30000, measured + 4));
        };
        measure();
        if (observerRef.current) observerRef.current.disconnect();
        if (typeof ResizeObserver !== 'undefined') {
            // Mesure au prochain affichage : changer la hauteur du cadre DANS le rappel de l'observateur déclenchait l'avertissement « ResizeObserver loop ».
            observerRef.current = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); });
            observerRef.current.observe(doc.documentElement);
        }
    };

    // Dès que l'utilisateur redimensionne le cadre (coin en bas à droite), on garde SA hauteur.
    const handleResizeEnd = () => {
        const wrapper = wrapperRef.current;
        if (!wrapper || contentHeight == null) return;
        const current = wrapper.offsetHeight;
        if (Math.abs(current - (manualHeight ?? contentHeight)) > 3) setManualHeight(current);
    };

    const shownHeight = manualHeight ?? contentHeight ?? height;
    return (
        <div>
            <div
                ref={wrapperRef}
                onMouseUp={handleResizeEnd}
                onTouchEnd={handleResizeEnd}
                style={{ resize: 'vertical', overflow: 'auto', height: `${shownHeight}px`, minHeight: '120px', border: '1px solid #30363d', borderRadius: '4px', backgroundColor: '#fff' }}
            >
                <iframe
                    ref={iframeRef}
                    title={`Aperçu - ${title || 'rapport'}`}
                    // Scripts désactivés (aucun `allow-scripts`) : `allow-same-origin` ne sert qu'à mesurer la hauteur du contenu.
                    sandbox="allow-same-origin"
                    referrerPolicy="no-referrer"
                    srcDoc={previewDocument}
                    onLoad={handleLoad}
                    style={{ width: '100%', height: manualHeight ? '100%' : `${contentHeight ?? height}px`, minHeight: '100%', border: 0, display: 'block' }}
                />
            </div>
            {manualHeight && (
                <div style={{ textAlign: 'right', marginTop: '4px' }}>
                    <button type="button" onClick={() => setManualHeight(null)} style={{ background: 'transparent', border: 0, color: '#58a6ff', fontSize: '0.8em', cursor: 'pointer' }}>
                        Afficher tout l'aperçu
                    </button>
                </div>
            )}
        </div>
    );
};

// props : tab (onglet affiché), onTabChange, bbCode, title, imageUrl (formulaires « image » comme l'AMA),
// extraTabs : [{ key, label, content }].
const ReportExpansion = ({ tab, onTabChange, bbCode, title, imageUrl, extraTabs = [] }) => {
    const { bbcodeEnabled } = useSiteConfig();
    const tabs = [
        ...(bbCode || imageUrl ? [{ key: 'preview', label: 'Aperçu' }] : []),
        ...(bbCode && bbcodeEnabled ? [{ key: 'bbcode', label: 'BBCode' }] : []),
        ...extraTabs.map(({ key, label }) => ({ key, label })),
    ];
    const current = extraTabs.find((entry) => entry.key === tab);

    return (
        <div style={{ color: '#c9d1d9' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {tabs.map((entry) => (
                    <button key={entry.key} type="button" style={tabButtonStyle(tab === entry.key)} onClick={() => onTabChange(entry.key)}>
                        {entry.label}
                    </button>
                ))}
            </div>

            {tab === 'preview' && (
                bbCode ? (
                    <ReportPreviewFrame bbCode={bbCode} title={title} />
                ) : imageUrl ? (
                    <div style={{ textAlign: 'center' }}>
                        <img src={imageUrl} alt={title || 'Image'} style={{ maxWidth: '100%', height: 'auto', border: '1px solid #30363d', borderRadius: '4px' }} referrerPolicy="no-referrer" />
                    </div>
                ) : (
                    <p style={{ color: '#8b949e', margin: 0 }}>Aucun contenu enregistré pour l'aperçu.</p>
                )
            )}

            {tab === 'bbcode' && bbcodeEnabled && (
                <textarea
                    readOnly
                    value={bbCode || ''}
                    rows={14}
                    onFocus={(event) => event.target.select()}
                    style={{ width: '100%', backgroundColor: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: '4px', fontFamily: 'Consolas, monospace', fontSize: '0.8em', padding: '8px' }}
                />
            )}

            {current && <div>{current.content}</div>}
        </div>
    );
};

export default ReportExpansion;
