// src/components/Admin/MailTemplatesManager.js
//
// Panneau admin → « E-mails » : tous les mails que le système envoie, avec pour chacun quand il part, à qui, son aperçu (avec des valeurs d'exemple)
// et son texte modifiable. Le catalogue et le texte par défaut sont dans utils/mailTemplatesCore.js ; un texte modifié est enregistré dans
// adminSettings/mailTemplates/{id} et lu à l'envoi, côté application comme côté Cloud Functions.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import {
    MAIL_TEMPLATES, MAIL_CATEGORIES, loadMailOverrides, saveMailTemplate, resetMailTemplate, renderMail, wrapMailHtml, sampleVars, validateTemplate, SUBJECT_MAX, BODY_MAX,
} from '../../utils/mailTemplates';
import './MailTemplatesManager.css';

const formatDate = (timestamp) => (timestamp ? new Date(timestamp).toLocaleString('fr-FR') : '');

const PREVIEW_STYLE = 'body{margin:0;background:#0d1117}p{margin:0 0 12px}ul{margin:0 0 12px;padding-left:22px}';

const effectiveOf = (id, overrides) => {
    const template = MAIL_TEMPLATES[id];
    const custom = overrides[id];
    return {
        subject: custom && typeof custom.subject === 'string' && custom.subject.trim() ? custom.subject : template.subject,
        body: custom && typeof custom.body === 'string' && custom.body.trim() ? custom.body : template.body,
    };
};

const MailTemplatesManager = ({ showNotification, onLogAction, adminName }) => {
    const [overrides, setOverrides] = useState({});
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(Object.keys(MAIL_TEMPLATES)[0]);
    const [query, setQuery] = useState('');
    const [draft, setDraft] = useState({ subject: '', body: '' });
    const [samples, setSamples] = useState({});
    const [view, setView] = useState('html');
    const [saving, setSaving] = useState(false);
    const bodyRef = useRef(null);
    const subjectRef = useRef(null);
    const lastField = useRef('body');

    const reload = useCallback(async () => {
        setLoading(true);
        setOverrides(await loadMailOverrides({ force: true }));
        setLoading(false);
    }, []);
    useEffect(() => { reload(); }, [reload]);

    const template = MAIL_TEMPLATES[selected];
    const saved = useMemo(() => effectiveOf(selected, overrides), [selected, overrides]);
    useEffect(() => { setDraft(saved); setSamples({}); }, [saved]);

    const customized = (id) => !!overrides[id];
    const dirty = draft.subject !== saved.subject || draft.body !== saved.body;
    const errors = useMemo(() => validateTemplate(selected, draft), [selected, draft]);

    const vars = useMemo(() => ({ ...sampleVars(selected), ...samples }), [selected, samples]);
    const preview = useMemo(() => {
        try { return renderMail(selected, vars, { [selected]: draft, signature: overrides.signature }); } catch (error) { return { subject: '', body: '', html: '' }; }
    }, [selected, vars, draft, overrides.signature]);

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        return Object.entries(MAIL_CATEGORIES).map(([key, category]) => ({
            key, category,
            items: Object.entries(MAIL_TEMPLATES)
                .filter(([id, t]) => t.category === key && (!q || t.label.toLowerCase().includes(q) || t.quand.toLowerCase().includes(q) || id.includes(q)))
                .map(([id, t]) => ({ id, ...t })),
        })).filter((group) => group.items.length > 0);
    }, [query]);

    const insert = (text) => {
        const field = lastField.current === 'subject' && !template.fragment ? 'subject' : 'body';
        const element = field === 'subject' ? subjectRef.current : bodyRef.current;
        const value = draft[field];
        const start = element ? element.selectionStart : value.length;
        const end = element ? element.selectionEnd : value.length;
        const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
        setDraft((previous) => ({ ...previous, [field]: next }));
        requestAnimationFrame(() => {
            if (!element) return;
            element.focus();
            const caret = start + text.length;
            element.setSelectionRange(caret, caret);
        });
    };

    const save = async () => {
        setSaving(true);
        try {
            await saveMailTemplate(selected, draft, adminName);
            if (onLogAction) onLogAction('Modèle de mail modifié', template.label);
            showNotification(`Mail « ${template.label} » enregistré : il est utilisé dès le prochain envoi.`, 'check-circle');
            await reload();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const restoreDefault = async () => {
        if (!window.confirm(`Rétablir le texte par défaut du mail « ${template.label} » ? Votre version sera perdue.`)) return;
        setSaving(true);
        try {
            await resetMailTemplate(selected);
            if (onLogAction) onLogAction('Modèle de mail rétabli par défaut', template.label);
            showNotification('Texte par défaut rétabli.', 'info');
            await reload();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const custom = overrides[selected];
    const isServer = template.canal.startsWith('Serveur');
    const scalarVars = template.vars.filter((variable) => !variable.liste);
    const iframeDoc = `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_STYLE}</style></head><body>${wrapMailHtml(preview.html)}</body></html>`;

    return (
        <div className="adm-card mt-card">
            <div className="adm-card-head">
                <div>
                    <h4><i className="fas fa-envelope-open-text"></i> E-mails</h4>
                    <p>Tous les mails envoyés par le système : quand ils partent, à qui, leur aperçu, et leur texte (modifiable).</p>
                </div>
                <Badge bg="secondary">{Object.keys(MAIL_TEMPLATES).length - 1} mails · {Object.keys(overrides).length} modifié{Object.keys(overrides).length > 1 ? 's' : ''}</Badge>
            </div>
            <div className="adm-card-body mt-layout">
                <nav className="mt-list" aria-label="Liste des mails">
                    <Form.Control size="sm" type="search" placeholder="Rechercher un mail…" value={query} onChange={(e) => setQuery(e.target.value)} className="mb-2" />
                    {loading && <Spinner animation="border" size="sm" />}
                    {groups.map((group) => (
                        <div key={group.key} className="mt-group">
                            <div className="mt-group-title"><i className={`fas ${group.category.icon} me-2`}></i>{group.category.label}</div>
                            {group.items.map((item) => (
                                <button type="button" key={item.id} className={`mt-item${selected === item.id ? ' active' : ''}`} onClick={() => setSelected(item.id)}>
                                    <span className="mt-item-label">{item.label}</span>
                                    <span className="mt-item-tags">
                                        {item.canal.startsWith('Serveur') && <i className="fas fa-server" title="Envoyé automatiquement par le serveur"></i>}
                                        {customized(item.id) && <span className="mt-dot" title="Texte modifié"></span>}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ))}
                    {!loading && groups.length === 0 && <p className="text-muted small">Aucun mail ne correspond.</p>}
                </nav>

                <section className="mt-detail">
                    <header className="mt-detail-head">
                        <h5>{template.label}</h5>
                        <div className="d-flex gap-2 flex-wrap">
                            {customized(selected) ? <Badge bg="warning" text="dark">Texte modifié</Badge> : <Badge bg="secondary">Texte par défaut</Badge>}
                            <Badge bg={isServer ? 'info' : 'primary'} text={isServer ? 'dark' : undefined}>{isServer ? 'Automatique (serveur)' : 'Depuis l\'application'}</Badge>
                        </div>
                    </header>

                    <dl className="mt-facts">
                        <div><dt><i className="fas fa-clock me-2"></i>Quand part-il ?</dt><dd>{template.quand}</dd></div>
                        <div><dt><i className="fas fa-user me-2"></i>À qui ?</dt><dd>{template.destinataire}</dd></div>
                        <div><dt><i className="fas fa-bolt me-2"></i>Déclenchement</dt><dd>{template.canal}</dd></div>
                        {custom && <div><dt><i className="fas fa-pen me-2"></i>Dernière modification</dt><dd>{formatDate(custom.majLe)}{custom.majPar ? ` par ${custom.majPar}` : ''}</dd></div>}
                    </dl>
                    {template.note && <Alert variant="warning" className="py-2 small">{template.note}</Alert>}

                    <h6 className="mt-section-title">Contenu</h6>
                    {!template.fragment && (
                        <Form.Group className="mb-2">
                            <Form.Label>Sujet <small className="text-muted">({draft.subject.length}/{SUBJECT_MAX})</small></Form.Label>
                            <Form.Control ref={subjectRef} value={draft.subject} onFocus={() => { lastField.current = 'subject'; }} onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))} />
                        </Form.Group>
                    )}
                    <Form.Group className="mb-2">
                        <Form.Label>Corps du mail <small className="text-muted">({draft.body.length}/{BODY_MAX})</small></Form.Label>
                        <Form.Control as="textarea" rows={template.fragment ? 3 : 12} ref={bodyRef} className="mt-body" value={draft.body}
                            onFocus={() => { lastField.current = 'body'; }} onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))} spellCheck />
                    </Form.Group>

                    {template.vars.length > 0 && (
                        <div className="mt-vars">
                            <span className="mt-vars-label">Insérer une variable :</span>
                            {template.vars.map((variable) => (
                                <button type="button" key={variable.key} className="mt-chip" title={`${variable.label}${template.required.includes(variable.key) ? ' — obligatoire' : ''}`} onClick={() => insert(`{{${variable.key}}}`)}>
                                    {`{{${variable.key}}}`}{template.required.includes(variable.key) && <span className="mt-req">*</span>}
                                </button>
                            ))}
                            {!template.fragment && <button type="button" className="mt-chip mt-chip-plain" onClick={() => insert('{{signature}}')} title="Formule de politesse commune">{'{{signature}}'}</button>}
                        </div>
                    )}
                    <details className="mt-help">
                        <summary>Aide sur la mise en forme</summary>
                        <ul>
                            <li>Une <strong>ligne vide</strong> sépare deux paragraphes ; un simple retour à la ligne reste un retour à la ligne.</li>
                            <li><code>**texte**</code> met en <strong>gras</strong> ; <code>[texte](https://adresse)</code> crée un lien ; <code># texte</code> met une ligne en avant (un code, par exemple).</li>
                            <li>Des lignes commençant par <code>- </code> forment une liste. Une variable de liste (ex. <code>{'{{factures}}'}</code>) seule sur sa ligne affiche la liste fournie par le système.</li>
                            <li><code>{'{{?motif}}'}…{'{{/motif}}'}</code> : le texte entre les deux n'apparaît que si la variable « motif » est renseignée.</li>
                            <li><code>{'{{signature}}'}</code> insère la formule de politesse commune (modèle « Formule de politesse commune »).</li>
                        </ul>
                    </details>

                    {errors.length > 0 && <Alert variant="danger" className="py-2 small mb-2">{errors.map((message) => <div key={message}>{message}</div>)}</Alert>}
                    <div className="d-flex flex-wrap gap-2 mb-3">
                        <Button variant="primary" onClick={save} disabled={saving || !dirty || errors.length > 0}>{saving ? <Spinner as="span" animation="border" size="sm" /> : 'Enregistrer'}</Button>
                        <Button variant="outline-secondary" onClick={() => setDraft(saved)} disabled={saving || !dirty}>Annuler les changements</Button>
                        <Button variant="outline-warning" onClick={restoreDefault} disabled={saving || !customized(selected)}>Rétablir le texte par défaut</Button>
                    </div>
                    {isServer && <p className="text-muted small">Ce mail part du serveur : il lit le même texte, la modification s'applique dès l'envoi suivant.</p>}

                    <h6 className="mt-section-title">Aperçu <small className="text-muted">(valeurs d'exemple{dirty ? ', avec vos modifications non enregistrées' : ''})</small></h6>
                    {scalarVars.length > 0 && (
                        <details className="mt-help">
                            <summary>Changer les valeurs d'exemple</summary>
                            <div className="mt-samples">
                                {scalarVars.map((variable) => (
                                    <Form.Group key={variable.key}>
                                        <Form.Label>{variable.label}</Form.Label>
                                        <Form.Control size="sm" value={vars[variable.key] ?? ''} onChange={(e) => setSamples((p) => ({ ...p, [variable.key]: e.target.value }))} />
                                    </Form.Group>
                                ))}
                            </div>
                        </details>
                    )}
                    {!template.fragment && (
                        <div className="mt-preview">
                            <div className="mt-preview-meta">
                                <div><span>À :</span> {template.destinataire}</div>
                                <div><span>Sujet :</span> <strong>{preview.subject || '—'}</strong></div>
                            </div>
                            <div className="mt-preview-tabs" role="group" aria-label="Version du mail">
                                <button type="button" className={view === 'html' ? 'active' : ''} onClick={() => setView('html')}>Mis en forme</button>
                                <button type="button" className={view === 'texte' ? 'active' : ''} onClick={() => setView('texte')}>Texte brut</button>
                            </div>
                            {view === 'html'
                                ? <iframe title="Aperçu du mail" sandbox="" srcDoc={iframeDoc} className="mt-frame" />
                                : <pre className="mt-text">{preview.body}</pre>}
                        </div>
                    )}
                    {template.fragment && <pre className="mt-text">{draft.body}</pre>}
                </section>
            </div>
        </div>
    );
};

export default MailTemplatesManager;
