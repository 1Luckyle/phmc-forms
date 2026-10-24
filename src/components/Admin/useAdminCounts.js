// src/components/Admin/useAdminCounts.js
//
// Compteurs du panneau admin : demandes de compte et de modification en attente (pastilles du menu et vue d'ensemble).
// Les images à supprimer ont leur propre compteur (useImgbbQueueCount).
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';

const countPending = (snapshot) => Object.values(snapshot.val() || {}).filter((entry) => entry && entry.status === 'pending').length;

const useAdminCounts = () => {
    const [counts, setCounts] = useState({ accounts: 0, modifications: 0, requests: 0, cctv: 0 });

    useEffect(() => {
        const unsubscribers = [
            onValue(ref(database, 'pendingAccountRequests'), (snapshot) => setCounts((previous) => ({ ...previous, accounts: countPending(snapshot) })), () => {}),
            onValue(ref(database, 'siteRequests'), (snapshot) => setCounts((previous) => ({ ...previous, requests: Object.values(snapshot.val() || {}).filter((entry) => entry && entry.status === 'nouveau').length })), () => {}),
            onValue(ref(database, 'cctvRequests'), (snapshot) => setCounts((previous) => ({ ...previous, cctv: Object.values(snapshot.val() || {}).filter((entry) => entry && entry.statut === 'nouvelle').length })), () => {}),
            onValue(ref(database, 'pendingModificationRequests'), (snapshot) => setCounts((previous) => ({ ...previous, modifications: countPending(snapshot) })), () => {}),
        ];
        return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    }, []);

    return counts;
};

export default useAdminCounts;
