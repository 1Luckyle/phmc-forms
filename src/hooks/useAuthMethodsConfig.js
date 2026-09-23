import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

// Lit adminSettings/authConfig en direct : par défaut (donnée absente), seule
// la connexion/création de compte via GTA World est proposée aux employés —
// c'est la méthode principale désormais. Un admin peut réactiver la méthode
// email/mot de passe depuis le panneau admin (section "Méthodes de connexion").
// Ne s'applique jamais à /login (connexion admin), qui garde toujours les deux.
export function useAuthMethodsConfig() {
    const [gtawOnly, setGtawOnly] = useState(true);

    useEffect(() => {
        const configRef = ref(database, 'adminSettings/authConfig');
        const unsubscribe = onValue(configRef, (snapshot) => {
            const data = snapshot.val();
            setGtawOnly(data?.gtawOnly !== false);
        });
        return () => unsubscribe();
    }, []);

    return { gtawOnly };
}
