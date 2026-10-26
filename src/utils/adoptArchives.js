// src/utils/adoptArchives.js
//
// Compte recréé : demande au serveur de rattacher à ce compte les CANDIDATURES et CONTRATS archivés de la même personne
// (même ID patient), restés liés à l'ancien identifiant de connexion supprimé. Les rapports et le dossier patient n'ont pas besoin
// de ça : ils sont déjà liés à l'ID patient et au nom. Best-effort, une fois par session.
import { auth } from '../firebase';

const ADOPT_URL = 'https://europe-west1-phmcfr-forms.cloudfunctions.net/adoptArchivedRecords';

export const adoptArchivedRecords = async () => {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const key = `archivesAdoptees:${user.uid}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
        const token = await user.getIdToken();
        await fetch(ADOPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
    } catch (error) {
        console.warn('Récupération des archives impossible :', error?.message || error);
    }
};
