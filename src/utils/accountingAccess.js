// src/utils/accountingAccess.js
//
// Droit « Comptabilité » (outil de la Boîte à outils : tarifs des formulaires et page Transparence) : admins, Directeur(trice) et Assistant(e) de Direction
// (rôle principal ou supplémentaire de la fiche). Les règles Firebase ne peuvent pas lire le rôle d'une fiche à partir de l'uid : la fonction serveur
// syncCctvAccess (la même que pour la vidéosurveillance) le vérifie et tient à jour le drapeau comptabiliteGestionnaires/{uid}, que les règles testent
// pour autoriser l'écriture. Ce hook relit ce drapeau pour n'afficher l'outil qu'à ceux qui peuvent réellement l'utiliser.
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database, auth } from '../firebase';
import { syncCctvAccess } from './cctvRequests';

// true si la personne connectée peut ouvrir la Comptabilité (admin, ou drapeau posé par le serveur d'après son rôle).
export const useAccountingAccess = (isAdmin) => {
    const [flag, setFlag] = useState(false);
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) { setFlag(false); return undefined; }
        syncCctvAccess();   // corrige le drapeau si le rôle a changé (au plus une fois par minute)
        return onValue(ref(database, `comptabiliteGestionnaires/${user.uid}`), (snapshot) => setFlag(snapshot.val() === true), () => setFlag(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.currentUser?.uid]);
    return !!isAdmin || flag;
};
