// src/hooks/useForumNotice.js
//
// Fenêtre d'aide « forums » (voir ForumCopyNoticeModal) pour les menus qui téléchargent du HTML : à appeler
// après un téléchargement réussi. Respecte « Ne plus afficher ce message ».
// Usage : const { openForumNotice, forumNoticeModal } = useForumNotice(); … {forumNoticeModal}
import React, { useCallback, useState } from 'react';
import ForumCopyNoticeModal, { isForumNoticeHidden } from '../components/ForumCopyNoticeModal';

const useForumNotice = () => {
    const [kind, setKind] = useState(null);
    const openForumNotice = useCallback((noticeKind, force = false) => {
        if (force || !isForumNoticeHidden(noticeKind)) setKind(noticeKind);
    }, []);
    const forumNoticeModal = (
        <ForumCopyNoticeModal kind={kind || 'html'} show={!!kind} onHide={() => setKind(null)} />
    );
    return { openForumNotice, forumNoticeModal };
};

export default useForumNotice;
