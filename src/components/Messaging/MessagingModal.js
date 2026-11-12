// src/components/Messaging/MessagingModal.js
//
// Messagerie interne du personnel : réception, messages envoyés, lecture (aperçu mis en page, images comprises) et rédaction.
//   • On ne peut écrire qu'EN SON NOM : l'expéditeur est imposé (et vérifié par les règles Firebase) ;
//   • les destinataires se choisissent dans l'annuaire du personnel (comptes existants) ;
//   • chacun supprime SA copie ; le message disparaît pour de bon quand plus personne ne l'a ;
//   • chaque message (ou toute la conversation) s'exporte comme un rapport : PDF (A4), image PNG, fichier HTML, texte brut (et BBCode si l'accès BBCode est activé).
// Données et règles : utils/internalMail.js, database.rules.json (messagesInternes / messagerie).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Spinner, Form } from 'react-bootstrap';
import Select from 'react-select';
import BaseModal from '../BaseModal';
import { ReportPreviewFrame } from '../ReportExpansion';
import RichMessageEditor from './RichMessageEditor';
import { auth } from '../../firebase';
import { useEmployeeAuth } from '../../contexts/EmployeeAuthContext';
import { useSiteConfig } from '../../contexts/SiteConfigContext';
import {
    MAIL_LIMITS, loadMailDirectory, loadInternalMail, sendInternalMail, setMailRead, deleteMyMailCopy,
    validateMailDraft, messageToEmailBbcode, conversationToEmailBbcode, conversationTitle, mailTitle, bbcodeToPlainText, formatDateFr, stripImgWidth,
} from '../../utils/internalMail';
import { markMessageNotificationsRead } from '../../utils/notifications';
import { messageLinkUrl } from '../../utils/deepLinks';
import { bbcodeToHtmlFragment } from '../../utils/bbcodeToHtml';
import { getCachedSignatureUrl } from '../../utils/userCreations';
import ImagePreview from '../ImagePreview';
import { exportReportDocument } from '../../utils/reportDocumentExport';
import { downloadBbCodeAsHtml } from '../../utils/reportExport';
import './MessagingModal.css';

const selectStyles = {
    control: (base) => ({ ...base, backgroundColor: '#16202c', borderColor: '#30363d', minHeight: 38, '&:hover': { borderColor: '#30363d' } }),
    menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 2000 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#1f6feb55' : '#16202c', color: '#e6edf3' }),
    multiValue: (base) => ({ ...base, backgroundColor: '#1f6feb33' }),
    multiValueLabel: (base) => ({ ...base, color: '#e6edf3' }),
    input: (base) => ({ ...base, color: '#e6edf3' }),
    placeholder: (base) => ({ ...base, color: '#8b949e' }),
    singleValue: (base) => ({ ...base, color: '#e6edf3' }),
};

const draftKey = (uid) => `phmcMailDraft_${uid}`;
const readDraft = (uid) => { try { return JSON.parse(localStorage.getItem(draftKey(uid)) || 'null'); } catch (error) { return null; } };
const writeDraft = (uid, draft) => { try { if (draft) localStorage.setItem(draftKey(uid), JSON.stringify(draft)); else localStorage.removeItem(draftKey(uid)); } catch (error) { /* stockage indisponible */ } };

const shortDate = (ms) => {
    const date = new Date(ms);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return date.toDateString() === now.toDateString()
        ? `${pad(date.getHours())}:${pad(date.getMinutes())}`
        : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(2)}`;
};

// Ligne de boîte d'un message pour l'onglet consulté (un message envoyé à soi-même a une ligne « reçu » ET une ligne « envoyé »).
const entryFor = (mailbox, id, tab) => {
    const lines = (mailbox?.items || []).filter((item) => item.id === id);
    return lines.find((item) => item.role === (tab === 'envoye' ? 'envoye' : 'recu')) || lines[0];
};

const MessagingModal = ({ show, onHide, mailbox, initialMessageId = '', showNotification }) => {
    const { staffName } = useEmployeeAuth();
    const { bbcodeEnabled } = useSiteConfig();
    const uid = auth.currentUser?.uid || '';
    const notify = useMemo(() => showNotification || (() => {}), [showNotification]);

    const [tab, setTab] = useState('recu');
    const [search, setSearch] = useState('');
    const [view, setView] = useState({ mode: 'list', id: '' });          // list | read | compose
    const [message, setMessage] = useState(null);                         // message ouvert (contenu complet)
    const [loadingMessage, setLoadingMessage] = useState(false);
    const [directory, setDirectory] = useState({});
    const [directoryReady, setDirectoryReady] = useState(false);

    // Rédaction
    const [recipients, setRecipients] = useState([]);                     // options react-select { value: uid, label, name }
    const [subject, setSubject] = useState('');
    const [bodyBb, setBodyBb] = useState('');
    const [reply, setReply] = useState(null);                             // { id, fil, quote }
    const [composeTab, setComposeTab] = useState('write');
    // En-tête « email PHMC » (ancien formulaire PHMC Email Interne) : fonction, département et signature de l'expéditeur.
    const [fonction, setFonction] = useState('');
    const [service, setService] = useState('');
    const [signature, setSignature] = useState('');
    const [sending, setSending] = useState(false);
    const [editorKey, setEditorKey] = useState(0);
    const [editorSeed, setEditorSeed] = useState('');
    const editorRef = useRef(null);

    useEffect(() => {
        if (!show || directoryReady) return;
        loadMailDirectory().then((map) => { setDirectory(map); setDirectoryReady(true); }).catch(() => setDirectoryReady(true));
    }, [show, directoryReady]);

    const nameOf = useCallback((userId, fallback) => (directory[userId]?.name || fallback || 'Inconnu'), [directory]);
    const recipientOptions = useMemo(() => Object.values(directory).filter((person) => person.uid !== uid)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((person) => ({ value: person.uid, name: person.name, label: person.rank ? `${person.name} — ${person.rank}` : person.name })), [directory, uid]);

    const items = useMemo(() => {
        const role = tab === 'recu' ? 'recu' : 'envoye';
        const needle = search.trim().toLowerCase();
        return (mailbox?.items || []).filter((item) => item.role === role)
            .filter((item) => !needle || `${item.objet} ${item.de} ${item.apercu}`.toLowerCase().includes(needle));
    }, [mailbox, tab, search]);
    const unreadCount = mailbox?.unread || 0;

    // ───── Lecture ─────
    const openMessage = useCallback(async (id) => {
        setView({ mode: 'read', id });
        setLoadingMessage(true);
        setMessage(null);
        try {
            const loaded = await loadInternalMail(id);
            setMessage(loaded);
            // Lu par la messagerie : la notification de la cloche qui y renvoie l'est aussi.
            if (loaded) markMessageNotificationsRead(uid, id).catch(() => {});
        } catch (error) {
            notify('Message introuvable ou illisible.', 'error');
        } finally {
            setLoadingMessage(false);
        }
    }, [uid, notify]);

    // Marquage « lu » : dès que le message est affiché ET que sa ligne de boîte est connue (ouverture depuis une notification, avant le
    // chargement de la boîte, comprise). Un seul essai par message : un refus des règles ne doit pas relancer l'écriture en boucle.
    const readAttempts = useRef(new Set());
    useEffect(() => {
        if (view.mode !== 'read' || !message || message.id !== view.id || !uid) return;
        const entry = entryFor(mailbox, view.id, tab);
        if (!entry || entry.role !== 'recu' || entry.lu || readAttempts.current.has(view.id)) return;
        readAttempts.current.add(view.id);
        setMailRead(uid, view.id, true).catch((error) => notify(`Le message n'a pas pu être marqué comme lu : ${error.message || 'erreur'}`, 'warning', 7000));
    }, [view, message, mailbox, tab, uid, notify]);

    // Fil de discussion : les autres messages de la même conversation présents dans MA boîte (reçus ou envoyés), du plus ancien au plus récent.
    const [threadOpen, setThreadOpen] = useState({});                       // id -> message chargé | null (en cours) | false (indisponible)
    const threadFil = view.mode === 'read' ? (message ? (message.fil || message.id) : '') : (view.mode === 'compose' && reply ? reply.fil : '');
    const threadItems = useMemo(() => {
        if (!threadFil) return [];
        return (mailbox?.items || []).filter((item) => (item.fil || item.id) === threadFil && !(view.mode === 'read' && item.id === view.id))
            .sort((a, b) => a.le - b.le);
    }, [mailbox, threadFil, view]);
    useEffect(() => { setThreadOpen({}); }, [view.mode, view.id, threadFil]);
    const toggleThreadItem = async (id) => {
        if (threadOpen[id] !== undefined) { setThreadOpen((prev) => { const next = { ...prev }; delete next[id]; return next; }); return; }
        setThreadOpen((prev) => ({ ...prev, [id]: null }));
        try {
            const loaded = await loadInternalMail(id);
            setThreadOpen((prev) => (prev[id] === undefined ? prev : { ...prev, [id]: loaded || false }));
        } catch (error) {
            setThreadOpen((prev) => (prev[id] === undefined ? prev : { ...prev, [id]: false }));
        }
    };

    // Ouverture depuis une notification : on affiche directement le message.
    const openedFromNotification = useRef('');
    useEffect(() => {
        if (show && initialMessageId && openedFromNotification.current !== initialMessageId) {
            openedFromNotification.current = initialMessageId;
            openMessage(initialMessageId);
        }
        if (!show) openedFromNotification.current = '';
    }, [show, initialMessageId, openMessage]);

    useEffect(() => { if (!show) { setView({ mode: 'list', id: '' }); setMessage(null); } }, [show]);

    const readEntry = entryFor(mailbox, view.id, tab);
    const senderName = message ? nameOf(message.deUid, message.deNom) : '';
    // Le document du message est la mise en page « email PHMC » : c'est lui qu'on voit, qu'on exporte et dont on copie le titre ou le BBCode.
    const fullBbcode = message ? messageToEmailBbcode(message, { fromName: senderName }) : '';
    const exportTitle = message ? mailTitle(message) : 'Message';

    // Export d'un seul message ou de toute la conversation (les messages présents dans MA boîte, du plus ancien au plus récent, en un seul document).
    const [exportingThread, setExportingThread] = useState(false);
    const threadCount = message ? new Set([message.id, ...threadItems.map((item) => item.id)]).size : 0;
    const runExport = async (kind, scope) => {
        let bbCode = fullBbcode;
        let title = exportTitle;
        if (scope === 'thread') {
            setExportingThread(true);
            try {
                const ids = [...new Set(threadItems.map((item) => item.id))].filter((id) => id !== message.id);
                const loaded = await Promise.all(ids.map((id) => (threadOpen[id] && typeof threadOpen[id] === 'object'
                    ? Promise.resolve(threadOpen[id]) : loadInternalMail(id).catch(() => null))));
                const messages = [message, ...loaded.filter(Boolean)];
                if (messages.length < ids.length + 1) notify(`${ids.length + 1 - messages.length} message(s) de la conversation n'ont pas pu être chargés et sont absents de l'export.`, 'warning', 7000);
                bbCode = conversationToEmailBbcode(messages, { fromNameOf: (m) => nameOf(m.deUid, m.deNom) });
                title = conversationTitle(messages);
            } catch (error) {
                notify(`Export de la conversation impossible : ${error.message || 'erreur'}`, 'error');
                return;
            } finally {
                setExportingThread(false);
            }
        }
        const options = { bbCode, title, showNotification: notify };
        if (kind === 'title') copyText(title, 'Titre copié !');
        else if (kind === 'pdf' || kind === 'png' || kind === 'png-copy') exportReportDocument(kind, options);
        else if (kind === 'html') downloadBbCodeAsHtml(options);
        else if (kind === 'text') copyText(bbcodeToPlainText(bbCode), 'Texte copié.');
        else if (kind === 'bbcode') copyText(stripImgWidth(bbCode), 'BBCode copié.');
    };
    const renderExportItems = (scope) => (
        <>
            <Dropdown.Item onClick={() => runExport('title', scope)}><i className="fas fa-heading me-2"></i>Copier le titre</Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item onClick={() => runExport('pdf', scope)}><i className="fas fa-file-pdf me-2"></i>PDF (A4)</Dropdown.Item>
            <Dropdown.Item onClick={() => runExport('png', scope)}><i className="fas fa-file-image me-2"></i>Image PNG (pour Discord)</Dropdown.Item>
            <Dropdown.Item onClick={() => runExport('png-copy', scope)}><i className="fas fa-copy me-2"></i>Copier l'image</Dropdown.Item>
            <Dropdown.Item onClick={() => runExport('html', scope)}><i className="fas fa-file-code me-2"></i>Fichier HTML</Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item onClick={() => runExport('text', scope)}><i className="fas fa-align-left me-2"></i>Copier le texte</Dropdown.Item>
            {bbcodeEnabled && <Dropdown.Item onClick={() => runExport('bbcode', scope)}><i className="fas fa-code me-2"></i>Copier le BBCode</Dropdown.Item>}
        </>
    );

    const handleDelete = async () => {
        if (!view.id || !window.confirm('Supprimer ce message de votre boîte ? Les autres personnes le gardent ; il disparaît pour de bon quand plus personne ne l\'a.')) return;
        try {
            await deleteMyMailCopy(uid, view.id);
            setView({ mode: 'list', id: '' });
            setMessage(null);
            notify('Message supprimé de votre boîte.', 'check-circle');
        } catch (error) {
            notify(`Suppression impossible : ${error.message || 'erreur'}`, 'error');
        }
    };

    const copyText = async (text, okMessage) => {
        try { await navigator.clipboard.writeText(text); notify(okMessage, 'check-circle'); } catch (error) { notify('Copie impossible dans ce navigateur.', 'error'); }
    };

    // ───── Rédaction ─────
    const serviceKey = `phmcMailService_${uid}`;
    const resetCompose = () => {
        setRecipients([]); setSubject(''); setBodyBb(''); setReply(null); setComposeTab('write'); setEditorSeed(''); setEditorKey((k) => k + 1);
        // Par défaut : mon grade, le dernier département utilisé et ma signature (Carte de visite → Signature).
        let lastService = '';
        try { lastService = localStorage.getItem(serviceKey) || ''; } catch (error) { /* stockage indisponible */ }
        setFonction(directory[uid]?.rank || '');
        setService(lastService);
        setSignature(getCachedSignatureUrl() || '');
    };

    const startCompose = (preset = {}) => {
        resetCompose();
        const draft = !preset.reply ? readDraft(uid) : null;
        if (preset.reply) {
            setReply(preset.reply);
            setSubject(preset.subject || '');
            setRecipients(preset.recipients || []);
        } else if (draft) {
            setSubject(draft.subject || '');
            setRecipients((draft.recipients || []).filter((id) => directory[id]).map((id) => ({ value: id, name: directory[id].name, label: directory[id].name })));
            setEditorSeed(draft.html || '');
            notify('Brouillon repris.', 'info-circle', 3000);
        }
        setView({ mode: 'compose', id: '' });
    };

    const startReply = (all) => {
        if (!message) return;
        const ids = all ? [message.deUid, ...Object.keys(message.dest || {})].filter((id) => id && id !== uid) : [message.deUid];
        const unique = Array.from(new Set(ids));
        const options = unique.filter((id) => directory[id]).map((id) => ({ value: id, name: directory[id].name, label: directory[id].name }));
        if (options.length < unique.length) notify('Certains destinataires n\'ont plus de compte dans l\'annuaire : ils sont retirés de la réponse.', 'warning', 6000);
        const plain = bbcodeToPlainText((message.corps || '').replace(/\[quote\][\s\S]*\[\/quote\]/gi, '')).slice(0, 1500);
        startCompose({
            reply: { id: message.id, fil: message.fil || message.id, quote: `\n\n[quote][b]${senderName} a écrit le ${formatDateFr(message.creeLe)} :[/b]\n${plain}[/quote]` },
            subject: /^re\s*:/i.test(message.objet) ? message.objet : `RE: ${message.objet}`,
            recipients: options,
        });
    };

    // Brouillon : sauvegardé (sans destinataire obligatoire) tant qu'on rédige un nouveau message.
    useEffect(() => {
        if (view.mode !== 'compose' || reply || !uid) return undefined;
        const timer = setTimeout(() => {
            const html = editorRef.current ? editorRef.current.getHtml() : '';
            const empty = !subject.trim() && !html.trim() && recipients.length === 0;
            writeDraft(uid, empty ? null : { subject, recipients: recipients.map((r) => r.value), html });
        }, 600);
        return () => clearTimeout(timer);
    }, [view.mode, reply, uid, subject, recipients, bodyBb]);

    const draftBody = reply ? `${bodyBb}${reply.quote}` : bodyBb;
    const problems = view.mode === 'compose' ? validateMailDraft({ objet: subject, corps: draftBody, destinataires: recipients, fonction, service }) : [];
    const draftMessage = {
        objet: subject || '(sans objet)', deNom: staffName, dest: Object.fromEntries(recipients.map((r) => [r.value, r.name])), creeLe: Date.now(), corps: draftBody,
        deFonction: fonction.trim(), deService: service.trim(), deSignature: signature.trim(),
    };

    const handleSend = async () => {
        if (problems.length) { notify(problems[0], 'warning'); return; }
        setSending(true);
        try {
            const result = await sendInternalMail({
                objet: subject, corps: draftBody, fromName: staffName, fonction, service, signature,
                destinataires: recipients.map((r) => ({ uid: r.value, nom: r.name })),
                reponseA: reply?.id || '', fil: reply?.fil || '',
            });
            writeDraft(uid, null);
            try { localStorage.setItem(serviceKey, service.trim()); } catch (error) { /* stockage indisponible */ }
            if (result.failed.length) notify(`Message envoyé, mais non déposé chez : ${result.failed.join(', ')}.`, 'warning', 9000);
            else notify('Message envoyé.', 'check-circle');
            resetCompose();
            setTab('envoye');
            setView({ mode: 'list', id: '' });
        } catch (error) {
            notify(`Envoi impossible : ${error.message || 'erreur'}`, 'error', 8000);
        } finally {
            setSending(false);
        }
    };

    const discardCompose = () => {
        if ((subject.trim() || bodyBb.trim()) && !window.confirm('Abandonner ce message ? Il ne sera pas enregistré.')) return;
        writeDraft(uid, null);
        resetCompose();
        setView({ mode: 'list', id: '' });
    };

    // ───── Affichage ─────
    const detailOpen = view.mode !== 'list';

    const renderList = () => (
        <div className="mm-list">
            <div className="mm-tabs">
                <button type="button" className={tab === 'recu' ? 'active' : ''} onClick={() => setTab('recu')}>
                    Réception{unreadCount > 0 && <span className="mm-badge">{unreadCount}</span>}
                </button>
                <button type="button" className={tab === 'envoye' ? 'active' : ''} onClick={() => setTab('envoye')}>Envoyés</button>
            </div>
            <Form.Control size="sm" type="search" placeholder="Rechercher (objet, expéditeur, texte)…" value={search} onChange={(event) => setSearch(event.target.value)} className="mm-search" />
            <div className="mm-items">
                {!mailbox?.ready && <div className="mm-empty"><Spinner animation="border" size="sm" /> Chargement…</div>}
                {mailbox?.ready && items.length === 0 && (
                    <div className="mm-empty">{search ? 'Aucun message ne correspond.' : tab === 'recu' ? 'Aucun message reçu.' : 'Aucun message envoyé.'}</div>
                )}
                {items.map((item) => {
                    const unread = item.role === 'recu' && !item.lu;
                    return (
                        <button key={item.id} type="button" className={`mm-item${view.id === item.id ? ' active' : ''}${unread ? ' unread' : ''}`} onClick={() => openMessage(item.id)}>
                            <span className="mm-item-top">
                                <span className="mm-item-from">{item.role === 'recu' ? nameOf('', item.de) : `À ${item.nb || 1} personne${item.nb > 1 ? 's' : ''}`}</span>
                                <span className="mm-item-date">{shortDate(item.le)}</span>
                            </span>
                            <span className="mm-item-subject">{unread && <i className="fas fa-circle mm-dot"></i>}{item.objet}</span>
                            <span className="mm-item-preview">{item.apercu}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    // Fil de la discussion, façon messagerie : les autres messages de la conversation, du plus ancien au plus récent ; un clic déplie le texte.
    const renderThread = () => {
        if (threadItems.length === 0) return null;
        return (
            <div className="mm-thread">
                <div className="mm-thread-title"><i className="fas fa-comments me-2"></i>Fil de la discussion ({threadItems.length} {view.mode === 'read' ? 'autre' : 'message'}{threadItems.length > 1 ? 's' : ''})</div>
                {threadItems.map((item) => {
                    const opened = threadOpen[item.id];
                    const isOpen = opened !== undefined;
                    return (
                        <div key={item.id} className={`mm-thread-item${isOpen ? ' open' : ''}`}>
                            <button type="button" className="mm-thread-head" onClick={() => toggleThreadItem(item.id)} aria-expanded={isOpen}>
                                <i className={`fas ${isOpen ? 'fa-chevron-down' : 'fa-chevron-right'} mm-thread-chevron`}></i>
                                <span className="mm-thread-who">{item.role === 'envoye' ? 'Moi' : nameOf('', item.de)}</span>
                                <span className="mm-thread-preview">{isOpen ? item.objet : item.apercu}</span>
                                <span className="mm-item-date">{shortDate(item.le)}</span>
                            </button>
                            {isOpen && opened === null && <div className="mm-empty"><Spinner animation="border" size="sm" /> Chargement…</div>}
                            {isOpen && opened === false && <div className="mm-empty">Ce message n'est plus disponible.</div>}
                            {isOpen && opened && (
                                <div className="mm-thread-content">
                                    <div className="mm-thread-meta">
                                        De : {nameOf(opened.deUid, opened.deNom)} — À : {Object.entries(opened.dest || {}).map(([id, name]) => nameOf(id, name)).join(', ')} — {formatDateFr(opened.creeLe)}
                                    </div>
                                    <div className="mm-thread-body" dangerouslySetInnerHTML={{ __html: bbcodeToHtmlFragment(opened.corps || '') }} />
                                    {view.mode === 'read' && <Button size="sm" variant="outline-primary" className="mt-2" onClick={() => openMessage(item.id)}>Ouvrir ce message</Button>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderRead = () => (
        <div className="mm-detail">
            <div className="mm-detail-bar">
                <Button size="sm" variant="outline-secondary" className="mm-back" onClick={() => { setView({ mode: 'list', id: '' }); setMessage(null); }}>
                    <i className="fas fa-arrow-left me-1"></i>Retour
                </Button>
                {message && (
                    <>
                        {message.deUid !== uid && <Button size="sm" variant="primary" onClick={() => startReply(false)}><i className="fas fa-reply me-1"></i>Répondre</Button>}
                        {message.deUid !== uid && Object.keys(message.dest || {}).filter((id) => id !== uid).length > 0 && (
                            <Button size="sm" variant="outline-primary" onClick={() => startReply(true)}><i className="fas fa-reply-all me-1"></i>Répondre à tous</Button>
                        )}
                        <Button size="sm" variant="outline-secondary" disabled={!messageLinkUrl(view.id)}
                            title="Copier le lien direct vers ce message (comme sur Discord) : seuls l'expéditeur et les destinataires peuvent l'ouvrir"
                            onClick={() => copyText(messageLinkUrl(view.id), 'Lien du message copié ! Seuls ses participants pourront l\'ouvrir.')}>
                            <i className="fas fa-link me-1"></i>Copier le lien
                        </Button>
                        <Dropdown>
                            <Dropdown.Toggle size="sm" variant="outline-info" disabled={exportingThread}>
                                {exportingThread ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="fas fa-file-export me-1"></i>}Exporter
                            </Dropdown.Toggle>
                            <Dropdown.Menu className="mm-export-menu">
                                {threadCount > 1 && <Dropdown.Header>Ce message seulement</Dropdown.Header>}
                                {renderExportItems('message')}
                                {threadCount > 1 && (
                                    <>
                                        <Dropdown.Divider />
                                        <Dropdown.Header>Toute la conversation ({threadCount} messages)</Dropdown.Header>
                                        {renderExportItems('thread')}
                                    </>
                                )}
                            </Dropdown.Menu>
                        </Dropdown>
                        {/* « Non lu » n'a de sens que pour un message REÇU. */}
                        {readEntry && readEntry.role === 'recu' && (
                            <Button size="sm" variant="outline-secondary" title="Remettre en non lu et fermer le message" onClick={() => {
                                readAttempts.current.delete(view.id);
                                setMailRead(uid, view.id, false).catch(() => {});
                                setView({ mode: 'list', id: '' }); setMessage(null);
                            }}>
                                <i className="fas fa-envelope"></i>
                            </Button>
                        )}
                        <Button size="sm" variant="outline-secondary" title="Fermer l'aperçu du message" aria-label="Fermer l'aperçu" onClick={() => { setView({ mode: 'list', id: '' }); setMessage(null); }}>
                            <i className="fas fa-xmark me-1"></i>Fermer
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={handleDelete} title="Supprimer de ma boîte"><i className="fas fa-trash"></i></Button>
                    </>
                )}
            </div>
            {loadingMessage && <div className="mm-empty"><Spinner animation="border" size="sm" /> Ouverture…</div>}
            {!loadingMessage && !message && <div className="mm-empty">Ce message n'existe plus ou vous n'y avez plus accès.</div>}
            {message && (
                <>
                    <h5 className="mm-subject">{message.objet}</h5>
                    <div className="mm-meta">
                        <div><strong>De :</strong> {senderName}</div>
                        <div><strong>À :</strong> {Object.entries(message.dest || {}).map(([id, name]) => nameOf(id, name)).join(', ')}</div>
                        <div><strong>Le :</strong> {formatDateFr(message.creeLe)}</div>
                    </div>
                    <ReportPreviewFrame bbCode={fullBbcode} title={exportTitle} height={320} />
                    {renderThread()}
                </>
            )}
        </div>
    );

    const renderCompose = () => (
        <div className="mm-detail">
            <div className="mm-detail-bar">
                <Button size="sm" variant="outline-secondary" className="mm-back" onClick={discardCompose}><i className="fas fa-arrow-left me-1"></i>Retour</Button>
                <strong>{reply ? 'Répondre' : 'Nouveau message'}</strong>
            </div>
            <Form.Group className="mb-2">
                <Form.Label className="mm-label">De</Form.Label>
                <Form.Control size="sm" value={`${staffName || 'Moi'} (vous)`} disabled readOnly />
                <small className="text-muted">Un message est toujours envoyé en votre nom : l'expéditeur ne peut pas être changé.</small>
            </Form.Group>
            <Form.Group className="mb-2">
                <Form.Label className="mm-label">À *</Form.Label>
                <Select
                    isMulti
                    value={recipients}
                    onChange={(selected) => setRecipients(selected || [])}
                    options={recipientOptions}
                    isLoading={!directoryReady}
                    placeholder="Choisir dans l'annuaire du personnel… (tapez pour rechercher)"
                    noOptionsMessage={() => 'Aucune personne trouvée'}
                    styles={selectStyles}
                    closeMenuOnSelect={false}
                />
                {recipients.length >= MAIL_LIMITS.recipients && <small className="text-warning">Maximum {MAIL_LIMITS.recipients} destinataires.</small>}
            </Form.Group>
            <Form.Group className="mb-2">
                <Form.Label className="mm-label">Objet *</Form.Label>
                <Form.Control size="sm" value={subject} maxLength={MAIL_LIMITS.subject} onChange={(event) => setSubject(event.target.value)} placeholder="Objet du message" />
            </Form.Group>
            <details className="mm-sign" open={!fonction.trim() || !service.trim()}>
                <summary>Fonction *, département * et signature (facultative) — affichés sous le message</summary>
                <div className="mm-sign-grid">
                    <Form.Group>
                        <Form.Label className="mm-label">Fonction au sein du PHMC *</Form.Label>
                        <Form.Control size="sm" value={fonction} maxLength={MAIL_LIMITS.name} onChange={(event) => setFonction(event.target.value)} placeholder="ex. Médecin Titulaire" />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label className="mm-label">Département *</Form.Label>
                        <Form.Control size="sm" value={service} maxLength={MAIL_LIMITS.name} onChange={(event) => setService(event.target.value)} placeholder="ex. Médecine interne" />
                    </Form.Group>
                </div>
                <div className="mm-sign-image">
                    <span className="mm-label">Signature (facultative)</span>
                    {signature ? <ImagePreview imageUrls={signature} /> : <small className="text-muted">Aucune signature.</small>}
                    <div className="d-flex gap-2 mt-1">
                        <Button size="sm" variant="outline-primary" onClick={() => {
                            const mine = getCachedSignatureUrl();
                            if (mine) setSignature(mine); else notify('Vous n\'avez pas encore de signature : créez-la dans la boîte à outils → Carte de visite → onglet Signature.', 'warning', 7000);
                        }}><i className="fas fa-signature me-1"></i>Ma signature</Button>
                        {signature && <Button size="sm" variant="outline-secondary" onClick={() => setSignature('')}>Retirer</Button>}
                    </div>
                </div>
            </details>
            <div className="mm-tabs mm-compose-tabs">
                <button type="button" className={composeTab === 'write' ? 'active' : ''} onClick={() => setComposeTab('write')}>Rédaction</button>
                <button type="button" className={composeTab === 'preview' ? 'active' : ''} onClick={() => setComposeTab('preview')}>Aperçu</button>
            </div>
            {/* L'éditeur reste monté (masqué) pendant l'aperçu : on ne perd rien en changeant d'onglet. */}
            <div style={{ display: composeTab === 'write' ? 'block' : 'none' }}>
                <RichMessageEditor key={editorKey} ref={editorRef} initialHtml={editorSeed} onChange={(bb) => setBodyBb(bb)} onNotify={notify} />
            </div>
            {composeTab === 'preview' && (
                bodyBb.trim()
                    ? <ReportPreviewFrame bbCode={messageToEmailBbcode(draftMessage, { fromName: staffName })} title={mailTitle(draftMessage)} height={340} />
                    : <div className="mm-empty">Rien à afficher : le message est vide.</div>
            )}
            {reply && <small className="text-muted d-block mt-1"><i className="fas fa-quote-left me-1"></i>Le message d'origine sera cité à la suite de votre réponse.</small>}
            {problems.length > 0 && (
                <small className="text-warning d-block mt-1"><i className="fas fa-exclamation-circle me-1"></i>Pour envoyer : {problems.join(' ')}</small>
            )}
            <div className="mm-send-bar">
                <Button variant="success" onClick={handleSend} disabled={sending || problems.length > 0}>
                    {sending ? <Spinner animation="border" size="sm" /> : <><i className="fas fa-paper-plane me-1"></i>Envoyer</>}
                </Button>
                <Button variant="outline-secondary" onClick={discardCompose} disabled={sending}>Annuler</Button>
                {!reply && <small className="text-muted ms-2">Brouillon enregistré automatiquement sur cet appareil.</small>}
            </div>
            {renderThread()}
        </div>
    );

    return (
        <BaseModal isOpen={show} onClose={onHide} title="Messagerie interne" modalSize="xl" className="mm-modal" closeOnOverlayClick={false}>
            <div className={`mm-layout${detailOpen ? ' has-detail' : ''}`}>
                <div className="mm-side">
                    <Button variant="primary" className="mm-new" onClick={() => startCompose()}>
                        <i className="fas fa-pen me-2"></i>Nouveau message
                    </Button>
                    {renderList()}
                </div>
                <div className="mm-main">
                    {view.mode === 'read' && renderRead()}
                    {view.mode === 'compose' && renderCompose()}
                    {view.mode === 'list' && (
                        <div className="mm-placeholder">
                            <i className="fas fa-envelope-open-text"></i>
                            <p>Sélectionnez un message, ou écrivez-en un nouveau.</p>
                        </div>
                    )}
                </div>
            </div>
        </BaseModal>
    );
};

export default MessagingModal;
