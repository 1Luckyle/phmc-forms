// src/hooks/useMySignature.js
//
// Signature du personnel connecté (userCreations/{uid}/signature) : chargée à la connexion pour être posée par défaut au bas des rapports, et créée automatiquement à
// l'enregistrement d'un rapport si la personne n'en a pas encore (voir utils/staffSignature.js).
//   const { url, urlRef, ensure } = useMySignature({ uid, name, uploadImageDetailed, enabled });
// `urlRef.current` est lu par la génération du BBCode (valeur à jour même au milieu d'un enregistrement) ; `ensure()` retourne l'adresse de la signature (créée au besoin).
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadUserCreations } from '../utils/userCreations';
import { ensureStaffSignature } from '../utils/staffSignature';

const useMySignature = ({ uid, name, uploadImageDetailed, enabled = true }) => {
    const [url, setUrl] = useState('');
    const urlRef = useRef('');

    useEffect(() => {
        urlRef.current = '';
        setUrl('');
        if (!uid || !enabled) return undefined;
        let cancelled = false;
        loadUserCreations(uid)
            .then((creations) => {
                if (cancelled) return;
                const found = creations.signature?.url || '';
                urlRef.current = found;
                setUrl(found);
            })
            .catch(() => { /* signature illisible : le nom seul s'imprime, elle sera créée à l'enregistrement */ });
        return () => { cancelled = true; };
    }, [uid, enabled]);

    const ensure = useCallback(async () => {
        if (urlRef.current) return urlRef.current;
        if (!uid || !enabled) return '';
        const result = await ensureStaffSignature({ uid, name, uploadImageDetailed });
        if (result.url) { urlRef.current = result.url; setUrl(result.url); }
        return result.url;
    }, [uid, name, uploadImageDetailed, enabled]);

    return { url, urlRef, ensure };
};

export default useMySignature;
