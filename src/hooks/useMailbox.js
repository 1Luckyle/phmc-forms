// src/hooks/useMailbox.js
//
// Boîte de la messagerie interne de la personne connectée, en direct (voir utils/internalMail.js) :
// { items, unread, ready }. Sans compte (ou sans fiche du personnel : la messagerie lui est fermée), la boîte reste vide et rien n'est écouté.
import { useEffect, useState } from 'react';
import { subscribeMailbox } from '../utils/internalMail';

const useMailbox = (uid, enabled = true) => {
    const [state, setState] = useState({ items: [], unread: 0, ready: false });
    useEffect(() => {
        if (!uid || !enabled) { setState({ items: [], unread: 0, ready: true }); return undefined; }
        return subscribeMailbox(uid, (data) => setState({ ...data, ready: true }));
    }, [uid, enabled]);
    return state;
};

export default useMailbox;
