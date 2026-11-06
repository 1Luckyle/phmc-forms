// src/components/Admin/DebugMailViewer.js
//
// Vue admin de la messagerie interne, réservée au mode debug : tant que l'interrupteur « adminSettings/debugMessagerieAdmin » est
// désactivé, les règles Firebase REFUSENT aux admins toute lecture des messages (comme pour n'importe qui d'étranger au message).
// Activé, un admin peut lister et ouvrir les messages ; chaque ouverture est inscrite au journal d'activité (qui a lu quoi), car il
// s'agit de correspondance privée du personnel.
import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { ReportPreviewFrame } from '../ReportExpansion';
import { loadAllInternalMails, messageToBbcode, formatDateFr } from '../../utils/internalMail';
import { logActivity } from '../../utils/activityLog';

const DebugMailViewer = ({ enabled }) => {
    const [messages, setMessages] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [openId, setOpenId] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const all = await loadAllInternalMails();
            setMessages(all);
            logActivity({ category: 'admin', action: 'mail_admin_list', severity: 'warning', summary: `Liste de la messagerie interne consultée par un admin (${all.length} message(s))` });
        } catch (loadError) {
            setError(loadError?.message || 'Lecture refusée.');
            setMessages(null);
        } finally {
            setLoading(false);
        }
    };

    const open = (message) => {
        setOpenId((current) => (current === message.id ? '' : message.id));
        logActivity({
            category: 'admin', action: 'mail_admin_read', severity: 'warning',
            summary: `Message interne lu par un admin : « ${message.objet} »`,
            details: `De : ${message.deNom}\nÀ : ${Object.values(message.dest || {}).join(', ')}\nMessage : ${message.id}`,
        });
    };

    if (!enabled) {
        return <p className="text-muted mb-0">Interrupteur désactivé : les admins ne lisent aucun message (les règles Firebase l'interdisent).</p>;
    }
    return (
        <div className="mt-3">
            <Button size="sm" variant="outline-warning" onClick={load} disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : <><i className="fas fa-envelope-open-text me-1"></i>{messages ? 'Actualiser' : 'Afficher les messages'}</>}
            </Button>
            {error && <div className="text-danger small mt-2">{error}</div>}
            {messages && messages.length === 0 && <p className="text-muted mt-2 mb-0">Aucun message.</p>}
            {messages && messages.map((message) => {
                const noAccess = !message.acces || Object.keys(message.acces).length === 0;
                return (
                    <div key={message.id} className="mt-2" style={{ border: '1px solid #30363d', borderRadius: 6, padding: 8 }}>
                        <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                            <div>
                                <strong>{message.objet}</strong>
                                <div className="small text-muted">
                                    {message.deNom} → {Object.values(message.dest || {}).join(', ')} · {formatDateFr(message.creeLe)}
                                    {noAccess ? ' · supprimé par tous (effacé la nuit prochaine)' : ''}
                                </div>
                            </div>
                            <Button size="sm" variant={openId === message.id ? 'info' : 'outline-info'} onClick={() => open(message)}>
                                {openId === message.id ? 'Replier' : 'Lire'}
                            </Button>
                        </div>
                        {openId === message.id && <div className="mt-2"><ReportPreviewFrame bbCode={messageToBbcode(message)} title={message.objet} height={240} /></div>}
                    </div>
                );
            })}
        </div>
    );
};

export default DebugMailViewer;
