// src/components/Recruitment/ApplicationThread.js
//
// Fil d'échanges d'une candidature (candidat ↔ recrutement), même présentation que les demandes CCTV.
//   staff=true  : côté recrutement (réponses types, message marqué « Recrutement »)
//   staff=false : côté candidat
// Voir utils/applicationThreads.js pour les conditions d'ouverture et de fermeture.
import React, { useEffect, useRef, useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { subscribeThread, sendThreadMessage, isThreadOpenStatus } from '../../utils/applicationThreads';
import '../Cctv/CctvRequests.css';
import useWriteLock from '../../hooks/useWriteLock';

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (ts) => {
    const d = new Date(ts);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Réponses types proposées au recrutement (elles remplissent le champ, à relire avant d'envoyer).
const QUICK_REPLIES = [
    { label: 'Informations manquantes', text: "Bonjour, nous avons besoin de précisions pour examiner votre candidature : pouvez-vous compléter les informations suivantes ?\n- " },
    { label: 'Disponibilités entretien', text: "Bonjour, nous souhaitons vous rencontrer en entretien. Pouvez-vous nous indiquer vos disponibilités ?" },
    { label: 'Dossier bien reçu', text: "Bonjour, nous avons bien reçu votre candidature, elle est en cours d'examen. Nous reviendrons vers vous rapidement." },
];

const ApplicationThread = ({ application, staff, authorName, authorRole, onSent, onMailNeeded }) => {
    const { locked, lockTitle } = useWriteLock();
    const [thread, setThread] = useState({ messages: [], ferme: null });
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const endRef = useRef(null);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = subscribeThread(
            application.candidatUid, application.id,
            (value) => { setThread(value); setLoading(false); },
            (err) => { setError(err?.message || 'Lecture impossible.'); setLoading(false); },
        );
        return () => unsubscribe();
    }, [application.candidatUid, application.id]);

    useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [thread.messages.length]);

    const open = isThreadOpenStatus(application.statut) && !thread.ferme;

    const send = async (event) => {
        event.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        setError('');
        try {
            const message = await sendThreadMessage({ application, text, staff, authorName, authorRole });
            setText('');
            if (onSent) onSent(message);
            if (staff && onMailNeeded) onMailNeeded(message);
        } catch (err) {
            setError(err.message || "L'envoi a échoué.");
        } finally {
            setBusy(false);
        }
    };

    let closedNote = null;
    if (!open) {
        if (thread.ferme) closedNote = thread.ferme.motif === 'Contrat signé'
            ? 'Contrat signé : les échanges sont clos.'
            : 'Les échanges sur cette candidature sont clos.';
        else if (application.statut === 'refusee') closedNote = 'Candidature refusée : les échanges sont clos.';
        else if (['brouillon', 'soumise', 'en_pause', 'retiree'].includes(application.statut)) {
            closedNote = staff
                ? "Les échanges s'ouvrent quand la candidature est prise en charge (« En cours d'examen »)."
                : "Les échanges s'ouvriront quand le recrutement prendra votre candidature en charge.";
        } else closedNote = 'Les échanges ne sont pas disponibles sur cette candidature.';
    }

    return (
        <div className="cctv-thread">
            <div className="cctv-thread-title"><i className="fas fa-comments"></i> Échanges avec {staff ? 'le candidat' : 'le recrutement'}</div>
            {loading && <p className="cctv-muted"><Spinner size="sm" animation="border" className="me-2" />Chargement…</p>}
            {!loading && thread.messages.length === 0 && (
                <p className="cctv-muted">{open ? 'Aucun message pour l\'instant.' : 'Aucun message.'}</p>
            )}
            {thread.messages.map((message) => (
                <div key={message.id} className={`cctv-msg ${message.par?.staff ? 'staff' : 'asker'}`}>
                    <div className="cctv-msg-head">
                        <strong>{message.par?.name || 'Inconnu'}</strong>
                        <span className="cctv-msg-role">{message.par?.staff ? (message.par?.role || 'Recrutement') : 'Candidat'}</span>
                        <span className="cctv-msg-date">{formatDate(message.ts)}</span>
                    </div>
                    <p>{message.texte}</p>
                </div>
            ))}
            <div ref={endRef} />

            {open ? (
                <>
                    {staff && (
                        <div className="cctv-quick">
                            <span>Réponses types :</span>
                            {QUICK_REPLIES.map((quick) => (
                                <button key={quick.label} type="button" onClick={() => setText(quick.text)}>{quick.label}</button>
                            ))}
                        </div>
                    )}
                    <form className="cctv-reply" onSubmit={send}>
                        <textarea
                            rows={3} value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
                            placeholder={staff ? 'Votre message au candidat…' : 'Votre message au recrutement…'}
                        />
                        <div className="cctv-reply-actions">
                            <Button type="submit" variant="primary" size="sm" disabled={busy || !text.trim() || locked} title={locked ? lockTitle : undefined}>
                                {busy ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-paper-plane me-1"></i>Envoyer</>}
                            </Button>
                        </div>
                    </form>
                </>
            ) : <p className="cctv-muted"><i className="fas fa-lock me-1"></i>{closedNote}</p>}
            {error && <div className="cctv-error">{error}</div>}
        </div>
    );
};

export default ApplicationThread;
