// src/components/Notifications/NotificationBell.js
//
// La cloche du central de notifications (voir utils/notifications.js) : pastille du nombre de non lues, liste des notifications, clic = aller à
// l'endroit concerné et marquer comme lu ; boutons « marquer comme lu » (une) et « tout marquer comme lu ».
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    subscribeNotifications, markNotificationRead, markAllNotificationsRead, NOTIFICATION_GROUPS, NOTIFICATION_TYPES,
} from '../../utils/notifications';
import './Notifications.css';

const relativeTime = (timestamp, now) => {
    const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
    if (seconds < 60) return "à l'instant";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.round(hours / 24);
    if (days < 8) return `il y a ${days} j`;
    return new Date(timestamp).toLocaleDateString('fr-FR');
};

const NotificationBell = ({ uid, groups, onNavigate }) => {
    const [state, setState] = useState({ items: [], unread: 0 });
    const [open, setOpen] = useState(false);
    const [onlyUnread, setOnlyUnread] = useState(true);
    const [now, setNow] = useState(Date.now());
    const rootRef = useRef(null);
    const groupsKey = groups.join(',');

    useEffect(() => subscribeNotifications({ uid, groups: groupsKey ? groupsKey.split(',') : [], onData: setState }), [uid, groupsKey]);

    // Fermeture au clic extérieur / Échap ; l'heure relative se rafraîchit tant que la liste est ouverte.
    useEffect(() => {
        if (!open) return undefined;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 30000);
        const onPointer = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
        const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => { clearInterval(timer); document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const visible = useMemo(() => (onlyUnread ? state.items.filter((item) => !item.lu) : state.items), [state.items, onlyUnread]);

    const markRead = useCallback((item) => { if (!item.lu) markNotificationRead(uid, item.key).catch(() => {}); }, [uid]);

    const openItem = (item) => {
        markRead(item);
        setOpen(false);
        if (item.lien && onNavigate) onNavigate(item.lien);
    };

    if (!uid) return null;
    return (
        <div className="notif-root" ref={rootRef}>
            <button
                type="button" className={`notif-bell ${state.unread > 0 ? 'has-unread' : ''}`} onClick={() => setOpen((value) => !value)}
                aria-label={state.unread > 0 ? `Notifications : ${state.unread} non lue${state.unread > 1 ? 's' : ''}` : 'Notifications'} aria-expanded={open}
                title="Notifications"
            >
                <i className="fas fa-bell"></i>
                {state.unread > 0 && <span className="notif-count">{state.unread > 99 ? '99+' : state.unread}</span>}
            </button>

            {open && (
                <div className="notif-panel" role="dialog" aria-label="Notifications">
                    <div className="notif-head">
                        <strong>Notifications</strong>
                        <button type="button" className="notif-link" disabled={state.unread === 0} onClick={() => markAllNotificationsRead(uid, state.items).catch(() => {})}>
                            <i className="fas fa-check-double me-1"></i>Tout marquer comme lu
                        </button>
                    </div>
                    <div className="notif-tabs">
                        <button type="button" className={onlyUnread ? 'active' : ''} onClick={() => setOnlyUnread(true)}>Non lues{state.unread > 0 ? ` (${state.unread})` : ''}</button>
                        <button type="button" className={!onlyUnread ? 'active' : ''} onClick={() => setOnlyUnread(false)}>Toutes</button>
                    </div>
                    <div className="notif-list">
                        {visible.length === 0 && (
                            <p className="notif-empty">{onlyUnread ? 'Rien de nouveau : vous êtes à jour.' : 'Aucune notification.'}</p>
                        )}
                        {visible.map((item) => {
                            const type = NOTIFICATION_TYPES[item.type] || NOTIFICATION_TYPES.demande;
                            const group = item.feed !== 'personnel' ? NOTIFICATION_GROUPS[item.feed] : null;
                            return (
                                <div key={item.key} className={`notif-item ${item.lu ? '' : 'unread'}`}>
                                    <button type="button" className="notif-main" onClick={() => openItem(item)} title={item.lien ? 'Ouvrir' : undefined}>
                                        <span className="notif-icon" style={{ '--c': type.color }}><i className={`fas ${type.icon}`}></i></span>
                                        <span className="notif-body">
                                            <span className="notif-title">{item.titre}</span>
                                            {item.texte && <span className="notif-text">{item.texte}</span>}
                                            <span className="notif-meta">
                                                {group && <span className="notif-group" style={{ '--c': group.color }}>{group.label}</span>}
                                                {relativeTime(item.creeLe, now)}
                                            </span>
                                        </span>
                                    </button>
                                    {!item.lu && (
                                        <button type="button" className="notif-read" onClick={() => markRead(item)} title="Marquer comme lu" aria-label="Marquer comme lu">
                                            <i className="fas fa-check"></i>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
