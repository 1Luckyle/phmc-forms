// src/components/Admin/PrivacyPolicyManager.js
//
// Panneau admin → « Politique de confidentialité » : édite l'UNIQUE texte de la politique, affiché dans la fenêtre du pied de page et dans le guide de
// configuration. L'aperçu est le rendu réel (PolicyView). Publier remplace le texte partout ; l'ancienne version est gardée dans l'historique.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { PolicyView } from '../PrivacyPolicyContent';
import {
    DEFAULT_POLICY_TEXT, DEFAULT_UPDATE, MAX_POLICY_LENGTH, loadPolicy, savePolicy, todayLabel, validatePolicy,
} from '../../utils/privacyPolicy';
import './PrivacyPolicyManager.css';

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleString('fr-FR') : '—');

const PrivacyPolicyManager = ({ showNotification, onLogAction, adminName }) => {
    const [policy, setPolicy] = useState(null);       // version publiée (ou texte d'origine)
    const [texte, setTexte] = useState('');
    const [miseAJour, setMiseAJour] = useState('');
    const [autoDate, setAutoDate] = useState(true);   // la date devient celle du jour à la publication
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const area = useRef(null);

    const load = useCallback(async () => {
        try {
            const loaded = await loadPolicy();
            setPolicy(loaded);
            setTexte(loaded.texte);
            setMiseAJour(loaded.miseAJour);
            setError('');
        } catch (err) {
            console.error(err);
            setError('Impossible de charger la politique de confidentialité.');
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const effectiveDate = autoDate ? todayLabel() : miseAJour;
    const dirty = !!policy && (texte !== policy.texte || (!autoDate && miseAJour !== policy.miseAJour));
    const problems = policy ? validatePolicy({ texte, miseAJour: effectiveDate }) : [];

    // Barre d'outils : entoure la sélection (ou insère un modèle) puis replace le curseur.
    const edit = (build) => {
        const el = area.current;
        if (!el) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const { text, from, to } = build(texte.slice(0, start), texte.slice(start, end), texte.slice(end));
        setTexte(text);
        requestAnimationFrame(() => { el.focus(); el.setSelectionRange(from, to); });
    };
    const wrap = (mark, placeholder) => () => edit((before, selected, after) => {
        const inner = selected || placeholder;
        return { text: `${before}${mark}${inner}${mark}${after}`, from: before.length + mark.length, to: before.length + mark.length + inner.length };
    });
    const linePrefix = (prefix, placeholder) => () => edit((before, selected, after) => {
        const lineStart = before.lastIndexOf('\n') + 1;
        const head = before.slice(0, lineStart);
        const current = before.slice(lineStart);
        const inner = selected || placeholder;
        const needsBreak = current.length > 0;
        const insert = `${needsBreak ? '\n' : ''}${prefix}`;
        return { text: `${head}${current}${insert}${inner}${after}`, from: head.length + current.length + insert.length, to: head.length + current.length + insert.length + inner.length };
    });
    const link = () => edit((before, selected, after) => {
        const label = selected || 'texte du lien';
        const url = 'https://';
        const text = `${before}[${label}](${url})${after}`;
        const from = before.length + label.length + 3;
        return { text, from, to: from + url.length };
    });

    const publish = async () => {
        setSaving(true);
        try {
            const saved = await savePolicy({ texte, miseAJour: effectiveDate }, adminName);
            setPolicy(saved);
            setTexte(saved.texte);
            setMiseAJour(saved.miseAJour);
            showNotification('Politique de confidentialité publiée : elle est à jour partout.', 'check-circle');
            if (onLogAction) onLogAction('Politique de confidentialité publiée', `Mise à jour : ${saved.miseAJour} · ${saved.texte.length} caractères`);
        } catch (err) {
            showNotification(`Publication impossible : ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const restoreDefault = () => {
        if (texte !== DEFAULT_POLICY_TEXT && !window.confirm("Remplacer le texte de l'éditeur par le texte d'origine ? (Rien n'est publié tant que vous ne cliquez pas sur « Publier ».)")) return;
        setTexte(DEFAULT_POLICY_TEXT);
        setMiseAJour(DEFAULT_UPDATE);
        setAutoDate(true);
    };

    const restoreVersion = (entry) => {
        if (!window.confirm(`Charger la version du ${formatDate(entry.majLe)} dans l'éditeur ? (Rien n'est publié tant que vous ne cliquez pas sur « Publier ».)`)) return;
        setTexte(entry.texte);
        setMiseAJour(entry.miseAJour);
        setAutoDate(true);
    };

    return (
        <div className="adm-card">
            <div className="adm-card-head">
                <div>
                    <h4><i className="fas fa-user-shield"></i> Politique de confidentialité</h4>
                    <p>Un seul texte, affiché dans la fenêtre du pied de page et dans le guide de configuration. Publier le met à jour partout.</p>
                </div>
            </div>
            <div className="adm-card-body">
                {error && <Alert variant="danger" className="py-2">{error}</Alert>}
                {!policy && !error && <Spinner animation="border" size="sm" />}
                {policy && (
                    <>
                        <div className="pp-status">
                            {policy.personnalisee
                                ? <Badge bg="success">Version publiée le {formatDate(policy.majLe)}{policy.majPar ? ` par ${policy.majPar}` : ''}</Badge>
                                : <Badge bg="secondary">Texte d'origine (aucune version publiée)</Badge>}
                            {dirty && <Badge bg="warning" text="dark">Modifications non publiées</Badge>}
                        </div>

                        <div className="pp-toolbar" role="toolbar" aria-label="Mise en forme">
                            <Button size="sm" variant="outline-secondary" onClick={linePrefix('## ', 'Titre de la section')} title="Intertitre"><i className="fas fa-heading me-1"></i>Titre</Button>
                            <Button size="sm" variant="outline-secondary" onClick={wrap('**', 'texte en gras')} title="Gras"><i className="fas fa-bold"></i></Button>
                            <Button size="sm" variant="outline-secondary" onClick={wrap('*', 'texte en italique')} title="Italique"><i className="fas fa-italic"></i></Button>
                            <Button size="sm" variant="outline-secondary" onClick={linePrefix('- ', 'élément de la liste')} title="Puce"><i className="fas fa-list-ul me-1"></i>Puce</Button>
                            <Button size="sm" variant="outline-secondary" onClick={link} title="Lien (http ou https)"><i className="fas fa-link me-1"></i>Lien</Button>
                            <span className="pp-count">{texte.length.toLocaleString('fr-FR')} / {MAX_POLICY_LENGTH.toLocaleString('fr-FR')}</span>
                        </div>

                        <div className="pp-layout">
                            <div>
                                <Form.Label>Texte</Form.Label>
                                <Form.Control as="textarea" ref={area} className="pp-editor" value={texte} onChange={(e) => setTexte(e.target.value)} spellCheck />
                                <Form.Text className="text-muted d-block mt-1">
                                    <code>## Titre</code> · <code>- puce</code> · <code>**gras**</code> · <code>*italique*</code> · <code>[texte](https://adresse)</code>. Une ligne vide sépare deux paragraphes.
                                </Form.Text>
                            </div>
                            <div>
                                <Form.Label>Aperçu (tel qu'affiché)</Form.Label>
                                <div className="pp-preview"><PolicyView text={texte} miseAJour={effectiveDate} /></div>
                            </div>
                        </div>

                        <div className="pp-date">
                            <Form.Check type="checkbox" id="pp-auto-date" checked={autoDate} onChange={(e) => setAutoDate(e.target.checked)}
                                label={`Dater la mise à jour d'aujourd'hui à la publication (${todayLabel()})`} />
                            {!autoDate && (
                                <Form.Control className="mt-2" style={{ maxWidth: 280 }} value={miseAJour} maxLength={80} onChange={(e) => setMiseAJour(e.target.value)} placeholder="ex. 25 octobre 2026" aria-label="Date de dernière mise à jour" />
                            )}
                        </div>

                        {problems.length > 0 && dirty && <Alert variant="warning" className="py-2 small">{problems[0]}</Alert>}

                        <div className="d-flex flex-wrap gap-2 mb-4">
                            <Button variant="primary" onClick={publish} disabled={saving || problems.length > 0 || (!dirty && policy.personnalisee)}>
                                {saving ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-cloud-arrow-up me-1"></i>Publier</>}
                            </Button>
                            <Button variant="outline-secondary" onClick={restoreDefault} disabled={saving}><i className="fas fa-rotate-left me-1"></i>Revenir au texte d'origine</Button>
                            {dirty && <Button variant="outline-secondary" onClick={load} disabled={saving}>Abandonner les modifications</Button>}
                        </div>

                        <h6>Versions précédentes</h6>
                        {policy.historique.length === 0 ? <p className="text-muted small">Aucune version précédente : la prochaine publication gardera celle-ci.</p> : (
                            <ul className="pp-history">
                                {policy.historique.map((entry) => (
                                    <li key={entry.majLe}>
                                        <span>Publiée le {formatDate(entry.majLe)}{entry.majPar ? ` par ${entry.majPar}` : ''} · mise à jour « {entry.miseAJour} »</span>
                                        <Button size="sm" variant="outline-info" onClick={() => restoreVersion(entry)}>Charger dans l'éditeur</Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PrivacyPolicyManager;
