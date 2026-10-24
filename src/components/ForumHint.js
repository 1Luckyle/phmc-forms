// src/components/ForumHint.js
//
// Petite mention « pour quel forum » à côté d'une entrée de menu BBCode / HTML :
//   bbcode → forum PHMC (pas encore disponible actuellement), html → forum GTA World.
import React from 'react';
import { BBCODE_FORUM_HINT, HTML_FORUM_HINT } from '../utils/reportExport';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const ForumHint = ({ kind }) => {
    const { bbcodeEnabled } = useSiteConfig();
    if (kind !== 'html' && !bbcodeEnabled) return null;
    return (
    <span style={{ fontSize: '0.78em', opacity: 0.7, marginLeft: '6px', whiteSpace: 'nowrap' }}>
        ({kind === 'html' ? HTML_FORUM_HINT : BBCODE_FORUM_HINT})
    </span>
    );
};

export default ForumHint;
